const db = require('../config/database-switch');

/* ================= ADD/UPDATE RESULT (TEACHER) ================= */
const addResult = async (req, res) => {
  try {
    let { studentId, classroomId, subjects, term, comments, marks, totalMarks, status, remarks } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!classroomId || !studentId) {
      return res.status(400).json({ message: "Student ID and Classroom ID are required" });
    }

    // Normalize payload: if legacy fields provided, convert to subjects array
    let normalizedSubjects = Array.isArray(subjects) ? subjects : [];
    if ((!normalizedSubjects || normalizedSubjects.length === 0) && (marks !== undefined || totalMarks !== undefined || status)) {
      normalizedSubjects = [
        {
          name: "General",
          marks: Number(marks || 0),
          total: Number(totalMarks || 100),
          status: String(status || "PASS").toUpperCase() === "FAIL" ? "FAIL" : "PASS",
        },
      ];
      comments = remarks || comments || "";
    }

    let totalObtained = 0;
    let totalMax = 0;
    let failCount = 0;

    normalizedSubjects.forEach(sub => {
      totalObtained += parseFloat(sub.marks || 0);
      totalMax += parseFloat(sub.total || 100);
      if ((sub.status || "PASS") === "FAIL") failCount++;
    });

    const overallPercentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
    const overallStatus = failCount > 0 ? "FAIL" : "PASS";
    const subjectsJson = JSON.stringify(normalizedSubjects);
    const termName = term || "General Examination";

    // Upsert into results
    db.get(
      "SELECT id FROM results WHERE studentId = ? AND classroomId = ? AND term = ?",
      [studentId, classroomId, termName],
      (err, existing) => {
        if (err) {
          console.error("Database error checking results:", err);
          return res.status(500).json({ message: "Database error" });
        }

        if (existing) {
          db.run(
            `UPDATE results SET 
              subjects = ?, 
              overallPercentage = ?, 
              overallStatus = ?, 
              comments = ?, 
              updatedAt = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [subjectsJson, overallPercentage, overallStatus, comments || "", existing.id],
            (updateErr) => {
              if (updateErr) return res.status(500).json({ message: "Failed to update result" });
              res.json({ message: "Result updated successfully", resultId: existing.id });
            }
          );
        } else {
          db.run(
            `INSERT INTO results (studentId, classroomId, term, subjects, overallPercentage, overallStatus, comments, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [studentId, classroomId, termName, subjectsJson, overallPercentage, overallStatus, comments || "", userId],
            function(insertErr) {
              if (insertErr) return res.status(500).json({ message: "Failed to create result" });
              res.status(201).json({ message: "Result saved successfully", resultId: this.lastID });
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("ADD RESULT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET UNIFIED RESULTS (FOR A STUDENT) ================= */
const fetchStudentUnifiedResults = (studentId, callback) => {
  const unifiedResults = [];

  // 1. Term results
  db.all(
    `SELECT r.*, c.name as classroomName, c.grade, c.section 
     FROM results r 
     LEFT JOIN classrooms c ON r.classroomId = c.id 
     WHERE r.studentId = ? 
     ORDER BY r.createdAt DESC`,
    [studentId],
    (err1, termResults) => {
      if (!err1 && termResults) {
        termResults.forEach(r => {
          let parsedSubjects = [];
          try {
            parsedSubjects = r.subjects ? JSON.parse(r.subjects) : [];
          } catch (e) {
            parsedSubjects = [];
          }
          unifiedResults.push({
            id: `term-${r.id}`,
            _id: `term-${r.id}`,
            type: 'term_exam',
            term: r.term || 'Academic Term',
            classroomName: r.classroomName,
            grade: r.grade,
            section: r.section,
            overallPercentage: r.overallPercentage,
            overallStatus: r.overallStatus,
            comments: r.comments,
            subjects: parsedSubjects,
            createdAt: r.createdAt
          });
        });
      }

      // 2. Course Test Attempts (Legacy)
      db.all(
        `SELECT aa.*, a.title as assessmentTitle, c.title as courseTitle 
         FROM assessment_attempts aa 
         LEFT JOIN assessments a ON aa.assessmentId = a.id 
         LEFT JOIN courses c ON a.courseId = c.id 
         WHERE aa.studentId = ? 
         ORDER BY aa.attemptedAt DESC`,
        [studentId],
        (err2, courseAttempts) => {
          if (!err2 && courseAttempts) {
            courseAttempts.forEach(ca => {
              unifiedResults.push({
                id: `course-test-${ca.id}`,
                _id: `course-test-${ca.id}`,
                type: 'course_test',
                term: `${ca.courseTitle || 'Course'}: ${ca.assessmentTitle || 'Assessment'}`,
                classroomName: ca.courseTitle || 'Course Test',
                overallPercentage: ca.percentage,
                overallStatus: ca.result,
                score: ca.score,
                totalQuestions: ca.totalQuestions,
                subjects: [
                  {
                    name: ca.assessmentTitle || 'Quiz',
                    marks: ca.score,
                    total: ca.totalQuestions,
                    status: ca.result
                  }
                ],
                createdAt: ca.attemptedAt
              });
            });
          }

          // 3. AI Assessment Agent Attempts (Class Tests)
          db.all(
            `SELECT att.*, a.title as assessmentTitle, cl.name as classroomName, cl.grade, cl.section 
             FROM aia_attempts att 
             LEFT JOIN aia_assessments a ON att.assessment_id = a.id 
             LEFT JOIN classrooms cl ON a.classroom_id = cl.id 
             WHERE att.student_id = ? 
             ORDER BY att.created_at DESC`,
            [studentId],
            (err3, aiaAttempts) => {
              if (!err3 && aiaAttempts) {
                aiaAttempts.forEach(aa => {
                  const status = (aa.percentage >= 50 || aa.status === 'passed') ? 'PASS' : 'FAIL';
                  unifiedResults.push({
                    id: `aia-test-${aa.id}`,
                    _id: `aia-test-${aa.id}`,
                    type: 'ai_assessment',
                    term: aa.assessmentTitle || 'AI Assessment Test',
                    classroomName: aa.classroomName || 'Class Test',
                    grade: aa.grade,
                    section: aa.section,
                    overallPercentage: aa.percentage,
                    overallStatus: status,
                    score: aa.score,
                    totalQuestions: aa.total_questions,
                    subjects: [
                      {
                        name: aa.assessmentTitle || 'Class Assessment',
                        marks: aa.score,
                        total: aa.total_questions,
                        status: status
                      }
                    ],
                    createdAt: aa.created_at
                  });
                });
              }

              // 4. AI Assignment Submissions (Evaluated PDF Assignments)
              db.all(
                `SELECT sub.*, asg.title as assignmentTitle, asg.max_marks, cl.name as classroomName 
                 FROM aia_assignment_submissions sub 
                 LEFT JOIN aia_assignments asg ON sub.assignment_id = asg.id 
                 LEFT JOIN classrooms cl ON asg.classroom_id = cl.id 
                 WHERE sub.student_id = ? AND sub.status = 'evaluated' 
                 ORDER BY sub.graded_at DESC`,
                [studentId],
                (err4, submissions) => {
                  if (!err4 && submissions) {
                    submissions.forEach(sub => {
                      const maxMarks = sub.max_marks || 10;
                      const marks = sub.final_marks || 0;
                      const pct = maxMarks > 0 ? Math.round((marks / maxMarks) * 100) : 0;
                      const status = pct >= 40 ? 'PASS' : 'FAIL';

                      unifiedResults.push({
                        id: `asg-${sub.id}`,
                        _id: `asg-${sub.id}`,
                        type: 'assignment',
                        term: sub.assignmentTitle || 'Assignment',
                        classroomName: sub.classroomName || 'Classroom Assignment',
                        overallPercentage: pct,
                        overallStatus: status,
                        comments: sub.feedback,
                        subjects: [
                          {
                            name: sub.assignmentTitle || 'Assignment Submission',
                            marks: marks,
                            total: maxMarks,
                            status: status
                          }
                        ],
                        createdAt: sub.graded_at || sub.created_at
                      });
                    });
                  }

                  // Sort all results chronologically
                  unifiedResults.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                  callback(null, unifiedResults);
                }
              );
            }
          );
        }
      );
    }
  );
};

/* ================= GET MY RESULTS (STUDENT) ================= */
const getMyResults = async (req, res) => {
  try {
    const studentId = req.user.userId || req.user.id;
    fetchStudentUnifiedResults(studentId, (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json(results);
    });
  } catch (error) {
    console.error("GET MY RESULTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET RESULTS BY STUDENT ID ================= */
const getStudentResults = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.query.studentId || req.user.userId || req.user.id;
    fetchStudentUnifiedResults(studentId, (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json(results);
    });
  } catch (error) {
    console.error("GET STUDENT RESULTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET CLASSROOM RESULTS (TEACHER) ================= */
const getClassroomResults = async (req, res) => {
  try {
    const { classroomId } = req.params;

    // Fetch all students in the classroom
    db.all(
      `SELECT u.id, u.name, u.email 
       FROM users u 
       JOIN student_classroom_assignment sca ON u.id = sca.studentId 
       WHERE sca.classroomId = ? 
       ORDER BY u.name ASC`,
      [classroomId],
      (err, students) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (!students || students.length === 0) {
          return res.json([]);
        }

        let completed = 0;
        const studentReports = [];

        students.forEach(student => {
          fetchStudentUnifiedResults(student.id, (stuErr, stuResults) => {
            studentReports.push({
              student: {
                _id: student.id,
                id: student.id,
                name: student.name,
                email: student.email
              },
              results: stuResults || [],
              latestResult: stuResults && stuResults.length > 0 ? stuResults[0] : null
            });

            completed++;
            if (completed === students.length) {
              res.json(studentReports);
            }
          });
        });
      }
    );
  } catch (error) {
    console.error("GET CLASSROOM RESULTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET ALL RESULTS (COMPAT) ================= */
const getResults = async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user?.userId;
    if (studentId) {
      return getStudentResults(req, res);
    }
    const classroomId = req.query.classroomId;
    if (classroomId) {
      req.params.classroomId = classroomId;
      return getClassroomResults(req, res);
    }
    res.json([]);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addResult,
  getMyResults,
  getStudentResults,
  getClassroomResults,
  getResults
};
