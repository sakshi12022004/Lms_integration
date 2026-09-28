const tenantConnectionManager = require('../config/tenant-connection-manager');
const db = require('../config/database-switch');
const BilingualDataService = require("../services/BilingualDataService");
const {
  getSuperadminSubscription,
  checkMentorCourseQuotaPerClass
} = require("../helpers/quotaHelper");



// Helper function to add _id field to courses for frontend compatibility
const mapCourse = (course) => {
  if (!course) return course;
  return { ...course, _id: course.id };
};

const mapCourses = (courses) => {
  if (!Array.isArray(courses)) return courses;
  return courses.map(mapCourse);
};

// Get all courses
const getAllCourses = async (req, res) => {
  try {
    // Filter by university_id for tenant isolation
    const universityId = req.user?.universityId || 1;
    const query = req.user?.role === 'superadmin' 
      ? "SELECT * FROM courses" 
      : "SELECT * FROM courses WHERE university_id = ?";
    const params = req.user?.role === 'superadmin' ? [] : [universityId];

    db.all(query, params, (err, courses) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      // Format courses according to requested language (default 'en')
      const language = req.language || 'en';
      const formatted = BilingualDataService.formatCourses(courses || [], language);
      res.json(mapCourses(formatted) || []);
    });
  } catch (err) {
    console.error("GET ALL COURSES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Create course
const createCourse = async (req, res) => {
  try {
    const { title, title_en, title_ar, description, description_en, description_ar, category, duration, mentorId, price, classroomId, studentIds } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Course title is required" });
    }

    let assignedMentorId = mentorId || req.user.userId;
    const universityId = req.user?.universityId || 1;

    // Helper functions inside createCourse
    const autoAssignStudentsFromClassroom = (courseId, classroomId, callback) => {
      console.log(`\n🔗 === AUTO-ASSIGN STUDENTS FROM CLASSROOM START ===`);
      console.log(`🔗 Course ID: ${courseId}, Classroom ID: ${classroomId}`);
      
      db.all(
        "SELECT sca.studentId FROM student_classroom_assignment sca WHERE sca.classroomId = ?",
        [classroomId],
        (err, students) => {
          if (err) {
            console.error(`❌ Error fetching students from classroom:`, err);
            if (callback) callback();
            console.log(`🔗 === AUTO-ASSIGN STUDENTS FROM CLASSROOM END (ERROR) ===\n`);
            return;
          }

          console.log(`🔗 Students found in classroom: ${students ? students.length : 0}`);
          
          if (!students || students.length === 0) {
            console.warn(`⚠️ No students found in classroom ${classroomId} - skipping auto-assign`);
            if (callback) callback();
            console.log(`🔗 === AUTO-ASSIGN STUDENTS FROM CLASSROOM END (NO STUDENTS) ===\n`);
            return;
          }

          console.log(`🔗 Students to assign:`, students.map(s => s.studentId));

          db.run(
            `CREATE TABLE IF NOT EXISTS course_students (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              courseId INTEGER NOT NULL,
              studentId TEXT NOT NULL,
              assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(courseId, studentId)
            )`,
            () => {
              const stmt = db.prepare(
                "INSERT OR IGNORE INTO course_students (courseId, studentId) VALUES (?, ?)"
              );

              let assignedCount = 0;
              students.forEach((student) => {
                stmt.run([courseId, student.studentId], function(runErr) {
                  if (runErr) {
                    console.error(`❌ Error assigning student ${student.studentId}:`, runErr);
                  } else {
                    assignedCount++;
                    console.log(`✅ Assigned student ${student.studentId} to course ${courseId}`);
                  }
                });
              });

              stmt.finalize(() => {
                console.log(`🔗 === AUTO-ASSIGN STUDENTS FROM CLASSROOM END (SUCCESS) ===\n`);
                console.log(`🔗 Total students assigned: ${assignedCount}`);
                if (callback) callback(assignedCount);
              });
            }
          );
        }
      );
    };

    const autoAssignSpecificStudents = (courseId, studentIds, callback) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS course_students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          courseId INTEGER NOT NULL,
          studentId TEXT NOT NULL,
          assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(courseId, studentId)
        )`,
        () => {
          const stmt = db.prepare(
            "INSERT OR IGNORE INTO course_students (courseId, studentId) VALUES (?, ?)"
          );

          let assignedCount = 0;
          studentIds.forEach((studentId) => {
            stmt.run([courseId, studentId], function(runErr) {
              if (runErr) {
                console.error(`❌ Error assigning student ${studentId}:`, runErr);
              } else {
                assignedCount++;
                console.log(`✅ Assigned student ${studentId} to course ${courseId}`);
              }
            });
          });

          stmt.finalize(() => {
            console.log(`🔗 === AUTO-ASSIGN SPECIFIC STUDENTS END ===\n`);
            console.log(`🔗 Total students assigned: ${assignedCount}`);
            if (callback) callback(assignedCount);
          });
        }
      );
    };

    // If classroomId is provided, check mentor course quota for that classroom
    let quotaCheckPromise = Promise.resolve(true);
    if (classroomId) {
      quotaCheckPromise = new Promise((resolve, reject) => {
        // Count courses by this mentor in this classroom
        db.get(
          "SELECT COUNT(*) as count FROM courses WHERE mentorId = ? AND classroomId = ?",
          [assignedMentorId, classroomId],
          async (err, row) => {
            if (err) {
              console.error("Error counting mentor courses:", err);
              resolve(true); // Allow on error (graceful fallback)
              return;
            }

            const currentCourseCount = row ? row.count : 0;
            
            // Get subscription for quota check
            const subscription = await getSuperadminSubscription("superadmin-1");
            
            // Check course quota per class
            const quotaCheck = checkMentorCourseQuotaPerClass(subscription.planType, currentCourseCount);
            if (!quotaCheck.allowed) {
              reject(new Error(quotaCheck.message));
            } else {
              resolve(true);
            }
          }
        );
      });
    }

    quotaCheckPromise.then(() => {
      // Get mentor name for storing in course record
      db.get(
        "SELECT id, name FROM users WHERE id = ?",
        [assignedMentorId],
        (mentorErr, mentorUser) => {
          if (mentorErr || !mentorUser) {
            console.error("Error fetching mentor:", mentorErr);
            return res.status(500).json({ message: "Error fetching mentor details" });
          }

          db.run(
            "INSERT INTO courses (title, description, category, duration, mentorId, price, classroomId, university_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              title || title_en || '',
              description || description_en || '',
              category || "",
              duration || 0,
              assignedMentorId,
              price || 0,
              classroomId || null,
              universityId
            ],
            function(err) {
              if (err) {
                console.error("Error creating course:", err);
                return res.status(500).json({ message: "Error creating course" });
              }

            const courseId = this.lastID;

            // ✅ AUTO-ASSIGN STUDENTS FROM CLASSROOM IF PROVIDED
            if (classroomId) {
              autoAssignStudentsFromClassroom(courseId, classroomId, (assignedStudents) => {
                // Get the assigned students' details
                db.all(
                  `SELECT cs.studentId, u.name as studentName 
                   FROM course_students cs 
                   LEFT JOIN users u ON cs.studentId = u.id 
                   WHERE cs.courseId = ?`,
                  [courseId],
                  (studentErr, students) => {
                    const studentList = students || [];
                    const createdCourse = {
                      id: courseId,
                      title: title || title_en || '',
                      description: description || description_en || '',
                      category,
                      duration,
                      mentorId: assignedMentorId,
                      mentorName: mentorUser.name,
                      price,
                      classroomId,
                      assignedStudents: studentList,
                      totalStudents: studentList.length
                    };
                    const formatted = BilingualDataService.formatCourse(createdCourse, req.language || 'en');
                    res.status(201).json({
                      message: "Course created successfully and students auto-assigned from classroom",
                      course: formatted
                    });
                  }
                );
              });
            } else if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
              // Auto-assign specific students
              autoAssignSpecificStudents(courseId, studentIds, () => {
                db.all(
                  `SELECT cs.studentId, u.name as studentName 
                   FROM course_students cs 
                   LEFT JOIN users u ON cs.studentId = u.id 
                   WHERE cs.courseId = ?`,
                  [courseId],
                  (studentErr, students) => {
                    const studentList = students || [];
                    const createdCourse = {
                      id: courseId,
                      title: title || title_en || '',
                      title_en: title_en || title || '',
                      title_ar: title_ar || '',
                      description: description || description_en || '',
                      description_en: description_en || description || '',
                      description_ar: description_ar || '',
                      category,
                      duration,
                      mentorId: assignedMentorId,
                      mentorName: mentorUser.name,
                      price,
                      classroomId,
                      assignedStudents: studentList,
                      totalStudents: studentList.length
                    };
                    const formatted = BilingualDataService.formatCourse(createdCourse, req.language || 'en');
                    res.status(201).json({
                      message: "Course created successfully and students assigned",
                      course: formatted
                    });
                  }
                );
              });
            } else {
              // No students assigned
              const createdCourse = {
                id: courseId,
                title: title || title_en || '',
                description: description || description_en || '',
                category,
                duration,
                mentorId: assignedMentorId,
                mentorName: mentorUser.name,
                price,
                classroomId,
                assignedStudents: [],
                totalStudents: 0
              };
              const formatted = BilingualDataService.formatCourse(createdCourse, req.language || 'en');
              res.status(201).json({ message: "Course created successfully", course: formatted });
            }
          }
        );
      }
    );
    }).catch((quotaErr) => {
      console.error("COURSE QUOTA ERROR:", quotaErr);
      return res.status(400).json({ message: quotaErr.message || "Course quota exceeded" });
    });
  } catch (err) {
    console.error("CREATE COURSE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get courses by mentor
const getCoursesByMentor = async (req, res) => {
  try {
    const mentorId = req.user.userId || req.user.id;

    db.all(
      `SELECT c.*, u.name as teacherName 
       FROM courses c 
       LEFT JOIN users u ON c.mentorId = u.id 
       WHERE c.mentorId = ?`,
      [mentorId],
      (err, courses) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        if (!courses || courses.length === 0) {
          return res.json([]);
        }

        // For each course, fetch the assigned students
        let completedCourses = 0;
        const coursesWithStudents = courses.map(course => ({
          ...course,
          _id: course.id,
          mentor: course.mentorUserId ? { id: course.mentorUserId, name: course.mentorName } : null,
          students: []
        }));

        courses.forEach((course, index) => {
          db.all(
            `SELECT cs.studentId, u.name as studentName 
             FROM course_students cs 
             LEFT JOIN users u ON cs.studentId = u.id 
             WHERE cs.courseId = ?`,
            [course.id],
            (studentErr, students) => {
              coursesWithStudents[index].students = students || [];
              completedCourses++;

              // Send response once all student data is fetched
                if (completedCourses === courses.length) {
                const language = req.language || 'en';
                const formatted = BilingualDataService.formatCourses(coursesWithStudents, language);
                res.json(mapCourses(formatted));
              }
            }
          );
        });
      }
    );
  } catch (err) {
    console.error("GET COURSES BY MENTOR ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get courses by student
const getCoursesByStudent = async (req, res) => {
  try {
    const studentId = req.user.userId;
    console.log(`\n📚 === COURSE FETCH START ===`);
    console.log(`📚 Student ID: ${studentId}`);
    console.log(`📚 Endpoint: /api/courses/student`);

    db.all(
      `SELECT c.*, u.name as courseTeacherName, u.email as courseTeacherEmail
       FROM courses c
       INNER JOIN course_students cs ON c.id = cs.courseId
       LEFT JOIN users u ON c.mentorId = u.id
       WHERE cs.studentId = ?`,
      [studentId],
      (err, courses) => {
        if (err) {
          console.error(`❌ Database error:`, err);
          return res.status(500).json({ message: "Database error", error: err.message });
        }

        console.log(`📚 Query executed successfully`);
        console.log(`📚 Courses found: ${courses ? courses.length : 0}`);
        
        if (courses && courses.length > 0) {
          console.log(`📚 First course:`, courses[0]);
        }
        
        // Enhance courses with courseTeacher object
        const enhancedCourses = (courses || []).map(course => ({
          ...mapCourse(course),
          courseTeacher: course.courseTeacherName ? {
            name: course.courseTeacherName,
            email: course.courseTeacherEmail
          } : null
        }));

        console.log(`✅ Returning ${enhancedCourses.length} enhanced courses`);
        console.log(`📚 === COURSE FETCH END ===\n`);
        res.json(enhancedCourses);
      }
    );
  } catch (err) {
    console.error("❌ GET COURSES BY STUDENT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get course by ID
const getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;

    db.get("SELECT * FROM courses WHERE id = ?", [courseId], (err, course) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
        const language = req.language || 'en';
        const formatted = BilingualDataService.formatCourse(course, language);
        res.json(mapCourse(formatted));
    });
  } catch (err) {
    console.error("GET COURSE BY ID ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update course
const updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const { title, description, category, duration, price } = req.body;

    db.run(
      "UPDATE courses SET title = ?, description = ?, category = ?, duration = ?, price = ? WHERE id = ?",
      [title, description, category, duration, price, courseId],
      function(err) {
        if (err) {
          console.error("Error updating course:", err);
          return res.status(500).json({ message: "Error updating course" });
        }

        res.json({ message: "Course updated successfully" });
      }
    );
  } catch (err) {
    console.error("UPDATE COURSE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const courseId = req.params.id;

    db.run("DELETE FROM courses WHERE id = ?", [courseId], function(err) {
      if (err) {
        console.error("Error deleting course:", err);
        return res.status(500).json({ message: "Error deleting course" });
      }

      res.json({ message: "Course deleted successfully" });
    });
  } catch (err) {
    console.error("DELETE COURSE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get courses by classroom
const getCoursesByClassroom = async (req, res) => {
  try {
    // Accept both route param and query param
    const classroomId = req.params.classroomId || req.query.classroomId;

    db.all(
      `SELECT 
         c.*, 
         u.id as mentorUserId,
         u.name as mentorName
       FROM courses c 
       LEFT JOIN users u ON c.mentorId = u.id 
       WHERE c.classroomId = ?
       ORDER BY c.createdAt DESC`,
      [classroomId],
      (err, courses) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        if (!courses || courses.length === 0) {
          return res.json([]);
        }

        // For each course, fetch the assigned students
        let completedCourses = 0;
        const coursesWithStudents = courses.map(course => ({ ...course, _id: course.id, students: [] }));

        courses.forEach((course, index) => {
          db.all(
            `SELECT cs.studentId, u.name as studentName 
             FROM course_students cs 
             LEFT JOIN users u ON cs.studentId = u.id 
             WHERE cs.courseId = ?`,
            [course.id],
            (studentErr, students) => {
              coursesWithStudents[index].students = students || [];
              completedCourses++;

              // Send response once all student data is fetched
              if (completedCourses === courses.length) {
                res.json(mapCourses(coursesWithStudents));
              }
            }
          );
        });
      }
    );
  } catch (err) {
    console.error("GET COURSES BY CLASSROOM ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Assign students to course
const assignStudentsToCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const { studentIds } = req.body;

    if (!courseId || !Array.isArray(studentIds)) {
      return res.status(400).json({ message: "Invalid course ID or student IDs" });
    }

    db.get("SELECT * FROM courses WHERE id = ?", [courseId], (err, course) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.mentorId !== req.user.userId && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }

      const values = studentIds.map(studentId => [courseId, studentId]);

      db.run("DELETE FROM course_students WHERE courseId = ?", [courseId], (deleteErr) => {
        if (deleteErr && deleteErr.message.includes("no such table")) {
          db.run(
            `CREATE TABLE IF NOT EXISTS course_students (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              courseId INTEGER NOT NULL,
              studentId INTEGER NOT NULL,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(courseId, studentId),
              FOREIGN KEY(courseId) REFERENCES courses(id)
            )`,
            (createErr) => {
              if (createErr) {
                return res.status(500).json({ message: "Server error" });
              }
              insertStudents();
            }
          );
        } else if (deleteErr) {
          return res.status(500).json({ message: "Server error" });
        } else {
          insertStudents();
        }
      });

      function insertStudents() {
        if (values.length === 0) {
          return res.json({ message: "No students to assign" });
        }

        const placeholders = values.map(() => "(?, ?)").join(",");
        const flatValues = values.flat();

        db.run(
          `INSERT INTO course_students (courseId, studentId) VALUES ${placeholders}`,
          flatValues,
          (insertErr) => {
            if (insertErr) {
              console.error("Error assigning students:", insertErr);
              return res.status(500).json({ message: "Error assigning students" });
            }

            res.json({
              message: "Students assigned successfully",
              count: studentIds.length
            });
          }
        );
      }
    });
  } catch (err) {
    console.error("ASSIGN STUDENTS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get assigned students for a course
const getAssignedStudents = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    db.all(
      `SELECT cs.id, cs.studentId, u.name, u.email 
       FROM course_students cs 
       LEFT JOIN users u ON cs.studentId = u.id 
       WHERE cs.courseId = ?
       ORDER BY u.name ASC`,
      [courseId],
      (err, students) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        // Map id to _id for frontend compatibility
        const mappedStudents = (students || []).map(student => ({
          ...student,
          _id: student.studentId
        }));

        res.json(mappedStudents || []);
      }
    );
  } catch (err) {
    console.error("GET ASSIGNED STUDENTS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Debug: Get student data for diagnosis
const getStudentDebugData = async (req, res) => {
  try {
    const studentId = req.user.userId || req.user.id;
    
    console.log(`\n🐛 === STUDENT DEBUG DATA START ===`);
    console.log(`🐛 Student ID: ${studentId}`);

    // Get classrooms
    db.all(
      `SELECT sc.id, sc.classroom_id, c.name as classroom_name 
       FROM student_classrooms sc 
       LEFT JOIN classrooms c ON sc.classroom_id = c.id 
       WHERE sc.student_id = ?`,
      [studentId],
      (err, classrooms) => {
        console.log(`🐛 Classrooms (student_classrooms):`, classrooms || []);

        // Get classroom assignments
        db.all(
          `SELECT sca.id, sca.classroomId, c.name as classroom_name 
           FROM student_classroom_assignment sca 
           LEFT JOIN classrooms c ON sca.classroomId = c.id 
           WHERE sca.studentId = ?`,
          [studentId],
          (err2, assignments) => {
            console.log(`🐛 Classroom Assignments (student_classroom_assignment):`, assignments || []);

            // Get course_students
            db.all(
              `SELECT cs.id, cs.courseId, cs.studentId, c.title as course_title 
               FROM course_students cs 
               LEFT JOIN courses c ON cs.courseId = c.id 
               WHERE cs.studentId = ?`,
              [studentId],
              (err3, courseStudents) => {
                console.log(`🐛 Course Students (course_students):`, courseStudents || []);

                // Get all courses in classrooms
                if (assignments && assignments.length > 0) {
                  const classroomIds = assignments.map(a => a.classroomId);
                  db.all(
                    `SELECT c.id, c.title, c.classroomId 
                     FROM courses c 
                     WHERE c.classroomId IN (${classroomIds.map(() => '?').join(',')})`,
                    classroomIds,
                    (err4, coursesInClassrooms) => {
                      console.log(`🐛 Courses in assigned classrooms:`, coursesInClassrooms || []);
                      console.log(`🐛 === STUDENT DEBUG DATA END ===\n`);

                      res.json({
                        studentId,
                        classrooms: classrooms || [],
                        classroom_assignments: assignments || [],
                        course_students: courseStudents || [],
                        courses_in_classrooms: coursesInClassrooms || []
                      });
                    }
                  );
                } else {
                  console.log(`🐛 === STUDENT DEBUG DATA END ===\n`);
                  res.json({
                    studentId,
                    classrooms: classrooms || [],
                    classroom_assignments: assignments || [],
                    course_students: courseStudents || [],
                    courses_in_classrooms: []
                  });
                }
              }
            );
          }
        );
      }
    );
  } catch (err) {
    console.error("DEBUG DATA ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  getAllCourses,
  createCourse,
  getCoursesByMentor,
  getCoursesByStudent,
  getCourseById,
  updateCourse,
  deleteCourse,
  getCoursesByClassroom,
  assignStudentsToCourse,
  getAssignedStudents,
  getStudentDebugData
};
