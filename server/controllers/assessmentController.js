const tenantConnectionManager = require('../config/tenant-connection-manager');
const db = require('../config/database-switch');



// Helper function to add _id field for frontend compatibility
const mapAssessment = (assessment) => {
  if (!assessment) return assessment;
  return { ...assessment, _id: assessment.id };
};

/**
 * ================================
 * CREATE ASSESSMENT (MENTOR)
 * ================================
 */
exports.createAssessment = async (req, res) => {
  try {
    const { courseId, weekId, title, description, startTime, endTime, timer } = req.body;

    if (!courseId || !title || !startTime || !endTime) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify course exists and user is the mentor/course teacher
    db.get(
      "SELECT id, mentorId FROM courses WHERE id = ?",
      [courseId],
      (err, course) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        if (!course) {
          return res.status(404).json({ message: "Course not found" });
        }

        // Check if user is the course teacher/mentor
        if (course.mentorId !== req.user.userId) {
          return res.status(403).json({ message: "Not authorized for this course" });
        }

        // Insert assessment into database
        db.run(
          `INSERT INTO assessments (courseId, weekId, title, description, startTime, endTime, timer, createdBy, isPublished, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [courseId, weekId || null, title, description || "", startTime, endTime, timer || 60, req.user.userId],
          function(err) {
            if (err) {
              console.error("Error creating assessment:", err);
              return res.status(500).json({ message: "Failed to create assessment" });
            }

            // Fetch the created assessment
            db.get(
              "SELECT * FROM assessments WHERE id = ?",
              [this.lastID],
              (selectErr, assessment) => {
                if (selectErr) {
                  console.error("Error fetching assessment:", selectErr);
                  return res.status(500).json({ message: "Assessment created but could not fetch details" });
                }

                res.status(201).json({
                  message: "Assessment created successfully",
                  assessment: mapAssessment(assessment)
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error("CREATE ASSESSMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * ================================
 * GET ALL ASSESSMENTS (MENTOR)
 * ================================
 */
exports.getAllCourseAssessments = (req, res) => {
  try {
    const { courseId } = req.params;

    db.all(
      "SELECT * FROM assessments WHERE courseId = ? ORDER BY createdAt DESC",
      [courseId],
      (err, assessments) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        const mapped = (assessments || []).map(mapAssessment);
        res.json(mapped);
      }
    );
  } catch (error) {
    console.error("GET ASSESSMENTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * ================================
 * GET COURSE ASSESSMENTS (STUDENT)
 * ================================
 */
exports.getCourseAssessments = (req, res) => {
  try {
    const { courseId } = req.params;
    const now = new Date();

    // Get all assessments for the course (not filtered by isPublished)
    // All assessments created by the course teacher should be visible to students
    db.all(
      "SELECT * FROM assessments WHERE courseId = ? ORDER BY createdAt DESC",
      [courseId],
      (err, assessments) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        const response = (assessments || []).map(a => {
          // Auto-unlock assessments - show all assessments to enrolled students
          // If no startTime/endTime set, assessment is unlocked by default
          const startTime = a.startTime ? new Date(a.startTime) : new Date(0); // Default to past
          const endTime = a.endTime ? new Date(a.endTime) : new Date(9999999999999); // Default to future
          const isUnlocked = startTime <= now && now <= endTime;
          
          return {
            ...mapAssessment(a),
            isUnlocked: isUnlocked || (!a.startTime && !a.endTime) // Unlock if no time restrictions
          };
        });

        res.json(response);
      }
    );
  } catch (error) {
    console.error("GET COURSE ASSESSMENTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * ================================
 * ADD QUESTION (MENTOR)
 * ================================
 */
exports.addQuestion = (req, res) => {
  try {
    const { assessmentId, questionText, questionType, options, correctAnswer, marks } = req.body;

    if (!assessmentId || !questionText || !questionType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Get the next question number
    db.get(
      "SELECT MAX(questionNumber) as maxNum FROM assessment_questions WHERE assessmentId = ?",
      [assessmentId],
      (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        const questionNumber = (result?.maxNum || 0) + 1;
        const optionsJson = options ? JSON.stringify(options) : null;

        db.run(
          `INSERT INTO assessment_questions (assessmentId, questionNumber, questionText, questionType, options, correctAnswer, marks, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [assessmentId, questionNumber, questionText, questionType, optionsJson, correctAnswer, marks || 1],
          function(err) {
            if (err) {
              console.error("Error creating question:", err);
              return res.status(500).json({ message: "Failed to create question" });
            }

            db.get(
              "SELECT * FROM assessment_questions WHERE id = ?",
              [this.lastID],
              (selectErr, question) => {
                if (selectErr) {
                  console.error("Error fetching question:", selectErr);
                  return res.status(500).json({ message: "Question created but could not fetch details" });
                }

                // Parse options if they exist
                if (question.options) {
                  question.options = JSON.parse(question.options);
                }

                res.status(201).json({
                  message: "Question added successfully",
                  question: { ...question, _id: question.id }
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error("ADD QUESTION ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * ================================
 * GET ASSESSMENT QUESTIONS
 * ================================
 */
exports.getAssessmentQuestions = (req, res) => {
  try {
    const { assessmentId } = req.params;

    db.get(
      "SELECT * FROM assessments WHERE id = ?",
      [assessmentId],
      (err, assessment) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        if (!assessment) {
          return res.status(404).json({ message: "Assessment not found" });
        }

        db.all(
          "SELECT * FROM assessment_questions WHERE assessmentId = ? ORDER BY questionNumber ASC",
          [assessmentId],
          (questErr, questions) => {
            if (questErr) {
              console.error("Database error:", questErr);
              return res.status(500).json({ message: "Database error" });
            }

            const mappedQuestions = (questions || []).map(q => ({
              ...q,
              _id: q.id,
              options: q.options ? JSON.parse(q.options) : []
            }));

            res.json({
              assessment: mapAssessment(assessment),
              questions: mappedQuestions
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("GET ASSESSMENT QUESTIONS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * ================================
 * PUBLISH ASSESSMENT (MENTOR)
 * ================================
 */
exports.publishAssessment = (req, res) => {
  try {
    const { assessmentId } = req.params;

    db.get(
      "SELECT * FROM assessments WHERE id = ?",
      [assessmentId],
      (err, assessment) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        if (!assessment) {
          return res.status(404).json({ message: "Assessment not found" });
        }

        db.run(
          "UPDATE assessments SET isPublished = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
          [assessmentId],
          (updateErr) => {
            if (updateErr) {
              console.error("Database error:", updateErr);
              return res.status(500).json({ message: "Failed to publish assessment" });
            }

            res.json({ message: "Assessment published successfully" });
          }
        );
      }
    );
  } catch (error) {
    console.error("PUBLISH ASSESSMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * ================================
 * SUBMIT ASSESSMENT (STUDENT)
 * ================================
 */
exports.submitAssessment = (req, res) => {
  try {
    const { assessmentId, answers } = req.body;
    const studentId = req.user.userId;

    if (!assessmentId || !Array.isArray(answers)) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    // Check if student has already attempted this assessment
    db.get(
      "SELECT * FROM assessment_attempts WHERE assessmentId = ? AND studentId = ?",
      [assessmentId, studentId],
      (checkErr, previousAttempt) => {
        if (checkErr) {
          console.error("Database error:", checkErr);
          return res.status(500).json({ message: "Database error" });
        }

        // If already attempted, return previous result
        if (previousAttempt) {
          return res.status(200).json({
            alreadyAttempted: true,
            previousResult: {
              score: previousAttempt.score,
              totalQuestions: previousAttempt.totalQuestions,
              percentage: Math.round((previousAttempt.score / previousAttempt.totalQuestions) * 100),
              result: previousAttempt.score >= (previousAttempt.totalQuestions * 0.6) ? "PASS" : "FAIL",
              correctAnswers: previousAttempt.correctAnswers ? JSON.parse(previousAttempt.correctAnswers) : []
            }
          });
        }

        // Fetch all questions for this assessment
        db.all(
          "SELECT * FROM assessment_questions WHERE assessmentId = ? ORDER BY questionNumber ASC",
          [assessmentId],
          (questErr, questions) => {
            if (questErr) {
              console.error("Database error:", questErr);
              return res.status(500).json({ message: "Database error" });
            }

            if (!questions || questions.length === 0) {
              return res.status(404).json({ message: "Assessment questions not found" });
            }

            // Calculate score
            let score = 0;
            const correctAnswers = [];

            questions.forEach((q, index) => {
              const studentAnswer = answers[index];

              // Parse options if stored as JSON
              let options = [];
              try {
                options = q.options ? JSON.parse(q.options) : [];
              } catch (e) {
                options = [];
              }

              // Determine correct option index:
              // correctAnswer should now be stored as a numeric index (0-based)
              let correctOption = -1;
              if (q.correctAnswer !== null && q.correctAnswer !== undefined) {
                const ca = String(q.correctAnswer).trim();
                // Try to parse as number first (should be 0-based index)
                if (/^-?\d+$/.test(ca)) {
                  correctOption = parseInt(ca, 10);
                  // Validate it's within range
                  if (correctOption < 0 || correctOption >= options.length) {
                    correctOption = -1;
                  }
                } else if (/^[A-Za-z]$/.test(ca)) {
                  // Letter like A,B,C (convert to 0-based)
                  const letterIndex = ca.toUpperCase().charCodeAt(0) - 65;
                  if (letterIndex >= 0 && letterIndex < options.length) {
                    correctOption = letterIndex;
                  }
                } else {
                  // Try to match by option text as fallback
                  const found = options.findIndex(opt => String(opt).trim() === ca);
                  if (found !== -1) correctOption = found;
                }
              }

              // Check if answer matches
              console.log(`📝 Question ${index + 1}: Student Answer=${studentAnswer}, Correct Option=${correctOption}`);
              if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== -1 && correctOption !== -1) {
                if (Number(studentAnswer) === Number(correctOption)) {
                  score++;
                  console.log(`   ✅ CORRECT`);
                } else {
                  console.log(`   ❌ WRONG (${studentAnswer} !== ${correctOption})`);
                }
              } else {
                console.log(`   ⚠️  SKIPPED (studentAnswer=${studentAnswer}, correctOption=${correctOption})`);
              }

              correctAnswers.push({
                questionId: q.id,
                question: q.questionText,
                correctOptionIndex: correctOption,
                correctOptionText: options[correctOption] || null,
                studentAnswerIndex: studentAnswer,
                studentAnswerText: (options && options[studentAnswer]) || null
              });
            });

            const totalQuestions = questions.length;
            const percentage = Math.round((score / totalQuestions) * 100);
            const result = score >= (totalQuestions * 0.6) ? "PASS" : "FAIL"; // 60% passing score

            // Save attempt to database
            db.run(
              `INSERT INTO assessment_attempts 
               (assessmentId, studentId, score, totalQuestions, percentage, result, correctAnswers, attemptedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              [assessmentId, studentId, score, totalQuestions, percentage, result, JSON.stringify(correctAnswers)],
              (insertErr) => {
                if (insertErr) {
                  console.error("Error saving assessment attempt:", insertErr);
                  // Return score anyway even if save fails
                }

                res.status(200).json({
                  score,
                  totalQuestions,
                  percentage,
                  result,
                  correctAnswers
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error("SUBMIT ASSESSMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
