const tenantConnectionManager = require('../config/tenant-connection-manager');
const db = require('../config/database-switch');



/* ================= DEBUG: CREATE TEST ASSIGNMENT ================= */
const createTestAssignment = async (req, res) => {
  try {
    console.log("DEBUG: Creating test classroom assignment");
    
    const universityId = req.user?.universityId || 1;
    // Create a test classroom first
    db.run(`
      INSERT INTO classrooms (university_id, name, grade, section, classTeacher, studentCount)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [universityId, "Test Classroom", "1", "A", req.user.userId, 0], function(err) {
      if (err) {
        console.error("DEBUG: Error creating test classroom:", err);
        return res.status(500).json({ message: 'Database error' });
      }
      
      const classroomId = this.lastID;
      console.log("DEBUG: Test classroom created with ID:", classroomId);
      
      // Create assignment
      db.run(`
        INSERT INTO classroomAssignments (classroomId, teacherId, role)
        VALUES (?, ?, 'class_teacher')
      `, [classroomId, req.user.userId], (err) => {
        if (err) {
          console.error("DEBUG: Error creating test assignment:", err);
          return res.status(500).json({ message: 'Database error' });
        }
        
        console.log("DEBUG: Test assignment created successfully");
        res.json({ 
          message: 'Test assignment created successfully',
          classroomId,
          teacherId: req.user.userId
        });
      });
    });
  } catch (error) {
    console.error("DEBUG: Create test assignment error:", error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= GET ASSIGNED CLASSROOMS FOR TEACHER ================= */
const getAssignedClassrooms = async (req, res) => {
  try {
    // Get user ID - handle both authenticated and default users
    let teacherId = req.user?.id;
    
    console.log("GET ASSIGNED CLASSROOMS - User:", req.user, "TeacherId:", teacherId);
    
    // If no user or invalid ID, fallback to fetching all classrooms
    if (!teacherId || teacherId === "default_user") {
      console.log("GET ASSIGNED CLASSROOMS - No valid teacherId, returning all classrooms");
      
      const universityId = req.user?.universityId || 1;
      db.all(`
        SELECT 
          c.id,
          c.name,
          c.grade,
          c.section,
          c.classTeacher,
          c.studentCount,
          c.createdAt,
          u.name as classTeacherName,
          'class_teacher' as role
        FROM classrooms c
        LEFT JOIN users u ON c.classTeacher = u.id
        WHERE c.university_id = ?
        ORDER BY c.createdAt DESC
      `, [universityId], (err, classrooms) => {
        if (err) {
          console.error("❌ Database error in getAssignedClassrooms (fallback):", err);
          console.error("❌ Error message:", err.message);
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        const formattedClassrooms = classrooms.map(classroom => {
          const { classTeacherName, ...classroomData } = classroom;
          return {
            ...classroomData,
            classTeacher: classroom.classTeacher ? {
              id: classroom.classTeacher,
              name: classroom.classTeacherName
            } : null
          };
        });
        
        res.json({
          success: true,
          data: formattedClassrooms || []
        });
      });
    } else {
      // Get classrooms assigned to this specific teacher
      console.log("GET ASSIGNED CLASSROOMS - Getting classrooms for teacher:", teacherId);
      
      db.all(`
        SELECT 
          ca.classroomId,
          ca.role,
          c.id,
          c.name,
          c.grade,
          c.section,
          c.classTeacher,
          c.studentCount,
          c.createdAt,
          u.name as classTeacherName
        FROM classroomAssignments ca
        JOIN classrooms c ON ca.classroomId = c.id
        LEFT JOIN users u ON c.classTeacher = u.id
        WHERE ca.teacherId = ?
        ORDER BY c.createdAt DESC
      `, [teacherId], (err, assignments) => {
        if (err) {
          console.error("❌ Database error in getAssignedClassrooms (teacher):", err);
          console.error("❌ Error message:", err.message);
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        const formattedClassrooms = assignments.map(assignment => {
          const { classTeacherName, ...assignmentData } = assignment;
          return {
            ...assignmentData,
            classTeacher: assignment.classTeacher ? {
              id: assignment.classTeacher,
              name: assignment.classTeacherName
            } : null
          };
        });
        
        console.log("GET ASSIGNED CLASSROOMS - Found assignments:", formattedClassrooms);
        res.json({
          success: true,
          data: formattedClassrooms || []
        });
      });
    }
  } catch (error) {
    console.error("❌ GET ASSIGNED CLASSROOMS - Catch block error:", error);
    console.error("❌ Error message:", error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/* ================= GET SINGLE CLASSROOM ================= */
const getSingleClassroom = async (req, res) => {
  try {
    const { id } = req.params;
    const universityId = req.user?.universityId || 1;
    
    console.log("GET SINGLE CLASSROOM - ID:", id, "University:", universityId);
    
    db.get(`
      SELECT 
        c.id,
        c.name,
        c.grade,
        c.section,
        c.classTeacher,
        c.studentCount,
        c.createdAt,
        u.name as classTeacherName
      FROM classrooms c
      LEFT JOIN users u ON c.classTeacher = u.id
      WHERE c.id = ? AND c.university_id = ?
    `, [id, universityId], (err, classroom) => {
      if (err) {
        console.error("❌ Database error in getSingleClassroom:", err);
        console.error("❌ Error message:", err.message);
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!classroom) {
        console.log("GET SINGLE CLASSROOM - Classroom not found");
        return res.status(404).json({ message: 'Classroom not found' });
      }
      
      const formattedClassroom = {
        ...classroom,
        classTeacher: classroom.classTeacher ? {
          id: classroom.classTeacher,
          name: classroom.classTeacherName
        } : null
      };
      
      res.json(formattedClassroom);
    });
  } catch (error) {
    console.error("❌ GET SINGLE CLASSROOM - Error:", error);
    console.error("❌ Error message:", error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/* ================= GET ALL CLASSROOMS ================= */
const getAllClassrooms = async (req, res) => {
  try {
    console.log("GET ALL CLASSROOMS - Request received");
    
    const universityId = req.user?.universityId || 1;
    console.log(`🏫 GET ALL CLASSROOMS - University ID: ${universityId}`);
    
    db.all(`
      SELECT 
        c.id,
        c.university_id,
        c.name,
        c.grade,
        c.section,
        c.classTeacher,
        c.studentCount,
        c.createdAt,
        u.name as classTeacherName
      FROM classrooms c
      LEFT JOIN users u ON c.classTeacher = u.id
      WHERE c.university_id = ?
      ORDER BY c.createdAt DESC
    `, [universityId], (err, classrooms) => {
      if (err) {
        console.error("❌ Database error in getAllClassrooms:", err);
        console.error("❌ Error code:", err.code);
        console.error("❌ Error message:", err.message);
        console.error("❌ Error stack:", err.stack);
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      console.log(`🏫 GET ALL CLASSROOMS - Found ${classrooms?.length || 0} classrooms for university ${universityId}:`, classrooms?.map(c => ({ id: c.id, name: c.name, university_id: c.university_id })));
      
      // Format the response to include classTeacher as object
      const formattedClassrooms = classrooms.map(classroom => {
        const { classTeacherName, ...classroomData } = classroom;
        return {
          ...classroomData,
          classTeacher: classroom.classTeacher ? {
            id: classroom.classTeacher,
            name: classroom.classTeacherName
          } : null
        };
      });
      
      console.log("GET ALL CLASSROOMS - Found classrooms:", formattedClassrooms);
      res.json({
        success: true,
        data: formattedClassrooms || []
      });
    });
  } catch (error) {
    console.error("❌ GET ALL CLASSROOMS - Catch block error:", error);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/* ================= CREATE CLASSROOM ================= */
const createClassroom = async (req, res) => {
  try {
    console.log("CREATE CLASSROOM - Request body:", req.body);
    console.log("CREATE CLASSROOM - User:", req.user);
    
    const { grade, section, classTeacherId, studentIds } = req.body;

    if (!grade) {
      console.log("CREATE CLASSROOM - Grade missing");
      return res.status(400).json({ message: 'Grade is required' });
    }

    if (!section) {
      console.log("CREATE CLASSROOM - Section missing");
      return res.status(400).json({ message: 'Section is required' });
    }

    console.log("CREATE CLASSROOM - Processing grade:", grade);

    // Determine fee structure category based on grade
    const gradeNum = parseInt(grade);
    const feeCategory = gradeNum >= 1 && gradeNum <= 4 ? 'Primary' : 'Secondary';
    
    console.log("CREATE CLASSROOM - Grade:", grade, "Fee Category:", feeCategory);

    // Get fee structure for the category (don't fail hard if table/migration missing)
    const universityId = req.user?.universityId || 1;
    db.get(
      `SELECT * FROM feeStructures WHERE category = ? AND university_id = ?`,
      [feeCategory, universityId],
      (err, feeStructure) => {
        if (err) {
          console.warn("CREATE CLASSROOM - Fee structure lookup failed, continuing without fees:", err.message || err);
          feeStructure = null; // proceed without fee structure
        }

        console.log("CREATE CLASSROOM - Fee structure:", feeStructure);

        // Create classroom name
        const classroomName = `Grade ${grade} - ${section}`;

        // Use the classTeacherId directly from the request
        let teacherIdToAssign = classTeacherId ? parseInt(classTeacherId, 10) : null;
        
        if (Number.isNaN(teacherIdToAssign)) {
          teacherIdToAssign = null;
        }

        console.log("CREATE CLASSROOM - teacherIdToAssign:", teacherIdToAssign);

        // Insert classroom into database
        db.run(
          `INSERT INTO classrooms (university_id, name, grade, section, classTeacher, studentCount) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            universityId,
            classroomName,
            grade,
            section,
            teacherIdToAssign,
            studentIds ? studentIds.length : 0
          ],
          function(err) {
            if (err) {
              console.error("Error creating classroom:", err);
              return res.status(500).json({ message: 'Error creating classroom' });
            }

            // SAVE classroomId from this context before using in nested callbacks
            const classroomId = this.lastID;

            const classroom = {
              id: classroomId,
              name: classroomName,
              grade,
              section,
              classTeacher: teacherIdToAssign,
              studentCount: studentIds ? studentIds.length : 0,
              feeStructure: feeStructure || null,
              feeCategory: feeCategory
            };

        console.log("CREATE CLASSROOM - Classroom created:", classroom);

        // Create classroom assignment if a teacher id is provided
        if (teacherIdToAssign) {
          console.log("CREATE CLASSROOM - Creating assignment for teacher id:", teacherIdToAssign, "Classroom ID:", classroomId);
          db.run(`
            INSERT INTO classroomAssignments (classroomId, teacherId, role)
            VALUES (?, ?, 'class_teacher')
          `, [classroomId, teacherIdToAssign], (err) => {
            if (err) {
              console.error("Error creating classroom assignment:", err);
            } else {
              console.log("CREATE CLASSROOM - Class teacher assigned successfully");
            }
          });
        } else {
          console.log("CREATE CLASSROOM - No class teacher provided");
        }

        // ASSIGN STUDENTS TO CLASSROOM (KEY FIX)
        if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
          console.log("CREATE CLASSROOM - Assigning students to classroom:", studentIds);
          
          // Create the student_classroom_assignment table if it doesn't exist
          db.run(`
            CREATE TABLE IF NOT EXISTS student_classroom_assignment (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              studentId TEXT NOT NULL,
              classroomId INTEGER NOT NULL,
              assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(studentId, classroomId),
              FOREIGN KEY(classroomId) REFERENCES classrooms(id)
            )
          `, () => {
            // Assign each student to the classroom
            studentIds.forEach(studentId => {
              console.log(`CREATE CLASSROOM - Assigning student ${studentId} to classroom ${classroomId}`);
              
              db.run(`
                INSERT OR IGNORE INTO student_classroom_assignment (studentId, classroomId)
                VALUES (?, ?)
              `, [studentId, classroomId], (err) => {
                if (err) {
                  console.error(`Error assigning student ${studentId} to classroom:`, err);
                } else {
                  console.log(`Student ${studentId} assigned successfully`);
                }
              });

              // Apply fee structure to the student
              if (feeStructure) {
                db.run(`
                  UPDATE students 
                  SET totalFees = ?, grade = ?, pendingFees = ?
                  WHERE userId = ?
                `, [
                  feeStructure.totalFee,
                  grade,
                  feeStructure.totalFee, // Initially, pending = total
                  studentId
                ], (err) => {
                  if (err) {
                    console.error("Error updating student fees:", err);
                  }
                });
              }
            });
          });
        }

        console.log("CREATE CLASSROOM - Sending success response");
        res.status(201).json({
          message: 'Classroom created successfully',
          data: {
            classroom: {
              id: classroomId,
              name: classroom.name,
              grade: classroom.grade,
              section: classroom.section,
              classTeacher: classroom.classTeacher,
              studentCount: classroom.studentCount,
              feeStructure: classroom.feeStructure,
              feeCategory: classroom.feeCategory
            },
            feeApplied: feeStructure ? true : false,
            studentsAssigned: studentIds ? studentIds.length : 0
          }
        });
      });
    });
  } catch (error) {
    console.error("CREATE CLASSROOM - Error:", error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= SAVE FEE STRUCTURE ================= */
const saveFeeStructure = async (req, res) => {
  try {
    console.log('SAVE FEE STRUCTURE - Request body:', req.body);
    console.log('SAVE FEE STRUCTURE - User:', req.user);
    const { category, grade, tuitionFee, transportFee, computerLabFee, libraryFee, sportsFee, examinationFee, miscellaneousFee, dueDate, totalFee } = req.body;

    if (!category) {
      console.log('SAVE FEE STRUCTURE - Category missing');
      return res.status(400).json({ message: 'Category is required' });
    }

    // Check if fee structure already exists for this category
    const universityId = req.user?.universityId || 1;
    db.get(`
      SELECT * FROM feeStructures WHERE category = ? AND university_id = ?
    `, [category, universityId], (err, existing) => {
      if (err) {
        console.error("Error checking existing fee structure:", err);
        return res.status(500).json({ message: 'Database error: ' + err.message });
      }

      if (existing) {
        console.log('SAVE FEE STRUCTURE - Structure already exists for category:', category);
        return res.status(400).json({ message: `Fee structure for ${category} already exists. Use edit to modify it.` });
      }

      console.log('SAVE FEE STRUCTURE - Inserting new structure for:', category);
      // Insert new fee structure
      db.run(`
        INSERT INTO feeStructures 
        (university_id, category, grade, tuitionFee, transportFee, computerLabFee, libraryFee, sportsFee, examinationFee, miscellaneousFee, totalFee, dueDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        universityId,
        category,
        grade || (category === 'Primary' ? '1-4' : '5-12'),
        tuitionFee || 0,
        transportFee || 0,
        computerLabFee || 0,
        libraryFee || 0,
        sportsFee || 0,
        examinationFee || 0,
        miscellaneousFee || 0,
        totalFee || 0,
        dueDate
      ], function(err) {
        if (err) {
          console.error("Error saving fee structure:", err);
          return res.status(500).json({ message: 'Error saving fee structure: ' + err.message });
        }

        console.log('SAVE FEE STRUCTURE - Inserted successfully with ID:', this.lastID);
        
        // Apply fee structure to existing students in respective classrooms
        applyFeeStructureToStudents(category, {
          tuitionFee: tuitionFee || 0,
          transportFee: transportFee || 0,
          computerLabFee: computerLabFee || 0,
          libraryFee: libraryFee || 0,
          sportsFee: sportsFee || 0,
          examinationFee: examinationFee || 0,
          miscellaneousFee: miscellaneousFee || 0,
          totalFee: totalFee || 0
        });

        res.status(201).json({
          message: 'Fee structure saved successfully',
          feeStructure: {
            id: this.lastID,
            category,
            grade: grade || (category === 'Primary' ? '1-4' : '5-12'),
            tuitionFee,
            transportFee,
            computerLabFee,
            libraryFee,
            sportsFee,
            examinationFee,
            miscellaneousFee,
            totalFee,
            dueDate
          }
        });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= APPLY FEE STRUCTURE TO STUDENTS ================= */
const applyFeeStructureToStudents = (category, feeData) => {
  try {
    const gradeRange = category === 'Primary' ? ['1', '2', '3', '4'] : ['5', '6', '7', '8', '9', '10', '11', '12'];

    // Update students assigned to classrooms in each grade in a safe way:
    // - only students who are assigned to classrooms (student_classroom_assignment) will be updated
    // - pendingFees is calculated as totalFee - feesPaid to preserve payments already recorded
    gradeRange.forEach(grade => {
      const sql = `
        UPDATE students
        SET totalFees = ?, pendingFees = (? - feesPaid)
        WHERE userId IN (
          SELECT sca.studentId FROM student_classroom_assignment sca
          INNER JOIN classrooms c ON sca.classroomId = c.id
          WHERE c.grade = ?
        )
      `;

      db.run(sql, [feeData.totalFee, feeData.totalFee, grade], (err) => {
        if (err) {
          console.error(`Error updating fees for grade ${grade}:`, err);
        } else {
          console.log(`Applied ${category} fee structure to grade ${grade} students (assigned to classrooms)`);
        }
      });
    });
  } catch (error) {
    console.error('Error applying fee structure to students:', error);
  }
};

/* ================= UPDATE FEE STRUCTURE ================= */
const updateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { tuitionFee, transportFee, computerLabFee, libraryFee, sportsFee, examinationFee, miscellaneousFee, dueDate, totalFee } = req.body;

    if (!tuitionFee && !transportFee && !computerLabFee && !libraryFee && !sportsFee && !examinationFee && !miscellaneousFee) {
      return res.status(400).json({ message: 'At least one fee field is required' });
    }

    const calculatedTotalFee = totalFee || (
      (tuitionFee || 0) + 
      (transportFee || 0) + 
      (computerLabFee || 0) + 
      (libraryFee || 0) + 
      (sportsFee || 0) + 
      (examinationFee || 0) + 
      (miscellaneousFee || 0)
    );

    const universityId = req.user?.universityId || 1;
    db.run(`
      UPDATE feeStructures 
      SET tuitionFee = ?, transportFee = ?, computerLabFee = ?, libraryFee = ?, sportsFee = ?, examinationFee = ?, miscellaneousFee = ?, totalFee = ?, dueDate = ?
      WHERE id = ? AND university_id = ?
    `, [
      tuitionFee || 0,
      transportFee || 0,
      computerLabFee || 0,
      libraryFee || 0,
      sportsFee || 0,
      examinationFee || 0,
      miscellaneousFee || 0,
      calculatedTotalFee,
      dueDate,
      id,
      universityId
    ], function(err) {
      if (err) {
        console.error("Error updating fee structure:", err);
        return res.status(500).json({ message: 'Error updating fee structure' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Fee structure not found' });
      }

      // Get the updated fee structure to apply to students
      db.get(`
        SELECT * FROM feeStructures WHERE id = ? AND university_id = ?
      `, [id, universityId], (err, structure) => {
        if (err) {
          console.error("Error fetching updated fee structure:", err);
        } else if (structure) {
          // Apply updated fee structure to students
          applyFeeStructureToStudents(structure.category, {
            tuitionFee: structure.tuitionFee,
            transportFee: structure.transportFee,
            computerLabFee: structure.computerLabFee,
            libraryFee: structure.libraryFee,
            sportsFee: structure.sportsFee,
            examinationFee: structure.examinationFee,
            miscellaneousFee: structure.miscellaneousFee,
            totalFee: structure.totalFee
          });
        }
      });

      res.json({
        message: 'Fee structure updated successfully',
        feeStructure: {
          id,
          tuitionFee,
          transportFee,
          computerLabFee,
          libraryFee,
          sportsFee,
          examinationFee,
          miscellaneousFee,
          totalFee: calculatedTotalFee,
          dueDate
        }
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= GET ALL FEE STRUCTURES ================= */
const getAllFeeStructures = async (req, res) => {
  try {
    const universityId = req.user?.universityId || 1;
    db.all(`
      SELECT * FROM feeStructures WHERE university_id = ? ORDER BY category
    `, [universityId], (err, structures) => {
      if (err) {
        console.error("Error fetching fee structures:", err);
        return res.status(500).json({ message: 'Database error' });
      }

      res.json(structures || []);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= GET FEE STRUCTURE BY GRADE ================= */
const getFeeStructureByGrade = async (req, res) => {
  try {
    const { grade } = req.params;

    const universityId = req.user?.universityId || 1;
    db.get(`
      SELECT * FROM feeStructures WHERE grade = ? AND university_id = ?
    `, [parseInt(grade), universityId], (err, feeStructure) => {
      if (err) {
        console.error("Error fetching fee structure:", err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!feeStructure) {
        return res.status(404).json({ message: 'Fee structure not found for this grade' });
      }

      res.json(feeStructure);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= UPDATE CLASSROOM ================= */
const updateClassroom = async (req, res) => {
  try {
    const { id } = req.params;
    const { className, classTeacher, description } = req.body;

    // For now, just return success since we don't have a classrooms table
    res.json({
      message: 'Classroom updated successfully',
      classroom: {
        id,
        className,
        classTeacher,
        description,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= DELETE CLASSROOM ================= */
const deleteClassroom = async (req, res) => {
  try {
    const { id } = req.params;

    // For now, just return success since we don't have a classrooms table
    res.json({ message: 'Classroom deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= GET CLASSROOM ANALYTICS ================= */
const getClassroomAnalytics = async (req, res) => {
  try {
    const universityId = req.user?.universityId || 1;
    // Get analytics data
    db.all(`
      SELECT 
        u.name as className,
        u.email as classTeacherEmail,
        COUNT(s.id) as studentCount,
        COUNT(CASE WHEN s.pendingFees > 0 THEN 1 END) as studentsWithPendingFees,
        SUM(s.pendingFees) as totalPendingFees
      FROM users u
      LEFT JOIN students s ON u.id = s.userId
      WHERE u.role = 'mentor' AND u.isApproved = 1 AND u.university_id = ?
      GROUP BY u.id, u.name, u.email
      ORDER BY studentCount DESC
    `, [universityId], (err, analytics) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(analytics || []);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= ASSIGN STUDENT TO CLASSROOM ================= */
const assignStudentToClassroom = async (req, res) => {
  try {
    const { classroomId, studentId } = req.body;
    const universityId = req.user?.universityId || 1;

    console.log('assignStudentToClassroom called with:', { classroomId, studentId, universityId });

    if (!classroomId || !studentId) {
      console.error('Missing required fields:', { classroomId, studentId });
      return res.status(400).json({ message: 'Classroom ID and Student ID are required' });
    }

    // First verify classroom belongs to this university
    db.get(
      `SELECT * FROM classrooms WHERE id = ? AND university_id = ?`,
      [classroomId, universityId],
      (err, classroom) => {
        if (err) {
          console.error("Database error checking classroom:", err);
          return res.status(500).json({ message: 'Database error' });
        }

        if (!classroom) {
          return res.status(403).json({ message: 'Classroom not found or does not belong to your university' });
        }

        // Check if assignment already exists
        db.get(
          `SELECT * FROM student_classroom_assignment WHERE studentId = ? AND classroomId = ?`,
          [studentId, classroomId],
          (err, existing) => {
            if (err) {
              console.error("Database error checking existing assignment:", err);
              return res.status(500).json({ message: 'Database error' });
            }

            if (existing) {
              return res.status(400).json({ message: 'Student already assigned to this classroom' });
            }

            // Create the assignment
            db.run(
              `INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (?, ?)`,
              [studentId, classroomId],
              function(err) {
                if (err) {
                  console.error("Database error creating assignment:", err);
                  return res.status(500).json({ message: 'Failed to assign student to classroom', error: err.message });
                }
                db.get(
                  `SELECT COUNT(*) as count FROM student_classroom_assignment WHERE classroomId = ?`,
                  [classroomId],
                  (countErr, row) => {
                    if (countErr) {
                      console.error('Error counting classroom students:', countErr);
                      // Assignment succeeded; return success anyway
                      return res.json({
                        message: 'Student assigned to classroom successfully',
                        studentId,
                        classroomId
                      });
                    }

                    const newCount = row?.count || 0;
                    db.run(
                      `UPDATE classrooms SET studentCount = ? WHERE id = ?`,
                      [newCount, classroomId],
                      (updateErr) => {
                        if (updateErr) {
                          console.error('Error updating classrooms.studentCount:', updateErr);
                        }

                        console.log(`Successfully assigned student ${studentId} to classroom ${classroomId}. New studentCount=${newCount}`);
                        res.json({
                          message: 'Student assigned to classroom successfully',
                          studentId,
                          classroomId,
                          studentCount: newCount
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Error in assignStudentToClassroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/* ================= GET CLASSROOM FEE STRUCTURE ================= */
const getClassroomFeeStructure = async (req, res) => {
  try {
    const { id: classroomId } = req.params;
    const universityId = req.user?.universityId || 1;

    if (!classroomId) {
      return res.status(400).json({ message: 'Classroom ID is required' });
    }

    // First, get the classroom to find its grade
    db.get(
      `SELECT id, name, grade, section FROM classrooms WHERE id = ? AND university_id = ?`,
      [classroomId, universityId],
      (err, classroom) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: 'Database error' });
        }

        if (!classroom) {
          return res.status(404).json({ message: 'Classroom not found' });
        }

        // Determine fee category based on classroom grade
        const gradeNum = parseInt(classroom.grade);
        const feeCategory = gradeNum >= 1 && gradeNum <= 4 ? 'Primary' : 'Secondary';
        
        // Now fetch the fee structure for this classroom's category
        db.get(
          `SELECT 
            tuitionFee,
            transportFee,
            computerLabFee,
            libraryFee,
            sportsFee,
            examinationFee,
            miscellaneousFee,
            totalFee,
            dueDate,
            category
          FROM feeStructures WHERE category = ? AND university_id = ?`,
          [feeCategory, universityId],
          (err, fees) => {
            if (err) {
              console.error("Database error fetching fees:", err);
              return res.status(500).json({ message: 'Database error' });
            }

            // Return classroom info with fee structure (use defaults if not found)
            res.json({
              id: classroom.id,
              name: classroom.name,
              grade: classroom.grade,
              section: classroom.section,
              feeCategory: feeCategory,
              tuitionFee: fees?.tuitionFee || 5000,
              transportFee: fees?.transportFee || 1000,
              computerLabFee: fees?.computerLabFee || 800,
              libraryFee: fees?.libraryFee || 500,
              sportsFee: fees?.sportsFee || 300,
              examinationFee: fees?.examinationFee || 700,
              miscellaneousFee: fees?.miscellaneousFee || 200,
              totalFee: fees?.totalFee || 8050,
              dueDate: fees?.dueDate || '2026-01-31',
              category: fees?.category || feeCategory
            });
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= GET STUDENT CLASSROOMS ================= */
const getStudentClassrooms = async (req, res) => {
  try {
    const studentId = req.user.id;
    console.log("getStudentClassrooms - Student ID:", studentId);
    console.log("getStudentClassrooms - Full user object:", req.user);

    db.all(
      `SELECT 
        c.id,
        c.name,
        c.grade,
        c.section,
        c.classTeacher,
        c.classTeacherId,
        c.studentCount,
        c.timetable,
        u.name as classTeacherName,
        u.email as classTeacherEmail
      FROM classrooms c
      INNER JOIN student_classroom_assignment sca ON c.id = sca.classroomId
      LEFT JOIN users u ON c.classTeacherId = u.id
      WHERE sca.studentId = ?`,
      [studentId],
      (err, classrooms) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: 'Database error' });
        }

        console.log("getStudentClassrooms - Found classrooms:", classrooms);

        // Add fee structure information and classTeacher object to each classroom
        const classroomsWithFees = (classrooms || []).map(classroom => {
          const gradeNum = parseInt(classroom.grade);
          const feeCategory = gradeNum >= 1 && gradeNum <= 4 ? 'Primary' : 'Secondary';
          
          return {
            ...classroom,
            _id: classroom.id,
            feeCategory: feeCategory,
            classTeacher: {
              name: classroom.classTeacherName || classroom.classTeacher || "Not Assigned",
              email: classroom.classTeacherEmail || ""
            }
          };
        });

        console.log("getStudentClassrooms - Returning:", classroomsWithFees);
        res.json(classroomsWithFees || []);
      }
    );
  } catch (error) {
    console.error("getStudentClassrooms - Error:", error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ================= TEST STUDENT ASSIGNMENT ================= */
const testStudentAssignment = async (req, res) => {
  try {
    const studentId = req.user.userId;
    console.log("testStudentAssignment - Student ID:", studentId);

    // Check if student exists
    db.get("SELECT id, name, email, role FROM users WHERE id = ?", [studentId], (err, student) => {
      if (err) {
        console.error("Error finding student:", err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (!student) {
        return res.status(404).json({ message: 'Student not found', studentId });
      }

      console.log("testStudentAssignment - Found student:", student);

      // Check all classroom assignments
      db.all("SELECT * FROM student_classroom_assignment", [], (err, allAssignments) => {
        if (err) {
          console.error("Error getting all assignments:", err);
          return res.status(500).json({ message: 'Database error' });
        }

        console.log("testStudentAssignment - All assignments:", allAssignments);

        // Check student's specific assignments
        db.all(
          "SELECT sca.*, c.name as classroomName, c.grade, c.section FROM student_classroom_assignment sca LEFT JOIN classrooms c ON sca.classroomId = c.id WHERE sca.studentId = ?",
          [studentId],
          (err, studentAssignments) => {
            if (err) {
              console.error("Error getting student assignments:", err);
              return res.status(500).json({ message: 'Database error' });
            }

            console.log("testStudentAssignment - Student assignments:", studentAssignments);

            res.json({
              student,
              allAssignments,
              studentAssignments,
              message: `Found ${studentAssignments.length} assignments for student`
            });
          }
        );
      });
    });
  } catch (error) {
    console.error("testStudentAssignment - Error:", error);
    res.status(500).json({ message: 'Server error' });
  }
};
const getClassroomStudents = async (req, res) => {
  try {
    const { classroomId } = req.params;
    const universityId = req.user?.universityId || 1;

    if (!classroomId) {
      return res.status(400).json({ message: 'Classroom ID is required' });
    }

    db.all(`
      SELECT 
        u.id,
        u.name,
        u.email,
        s.grade,
        s.rollNumber
      FROM users u
      INNER JOIN student_classroom_assignment sca ON u.id = sca.studentId
      LEFT JOIN students s ON u.id = s.userId
      WHERE sca.classroomId = ? AND u.role = 'student' AND u.university_id = ?
      ORDER BY u.name
    `, [classroomId, universityId], (err, students) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: 'Database error' });
      }

      res.json(students || []);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllClassrooms,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  getClassroomAnalytics,
  getFeeStructureByGrade,
  saveFeeStructure,
  updateFeeStructure,
  getAllFeeStructures,
  getSingleClassroom,
  getAssignedClassrooms,
  createTestAssignment,
  assignStudentToClassroom,
  getClassroomFeeStructure,
  getStudentClassrooms,
  getClassroomStudents,
  testStudentAssignment
};
