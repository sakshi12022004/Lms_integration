const express = require("express");
const router = express.Router();
const { schoolParam, guardParams, callerMayAccess } = require("../helpers/schoolScope");

// Ids in the URL must name a record the caller may work with (helpers/schoolScope.js).
guardParams(router, { classroomId: "classroom", mentorId: "user" });
const feeStructureParam = schoolParam("feeStructure");
const classroomParam = schoolParam("classroom");
router.param("id", (req, res, next, id) =>
  (String(req.route?.path || "").startsWith("/fee-structures") ? feeStructureParam : classroomParam)(req, res, next, id)
);

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { checkClassroomQuota } = require("../middleware/quotaMiddleware");

const {
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
  assignStudentToClassroom,
  getClassroomFeeStructure,
  getStudentClassrooms,
  getClassroomStudents,
  getTeachingScopeTree
} = require("../controllers/classroomController");

/* ================= ADMIN ONLY ================= */
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

/* ================= ROUTES ================= */

// ADMIN
router.post(
  "/",
  authMiddleware,
  adminOnly,
  checkClassroomQuota,
  createClassroom
);

router.get("/", authMiddleware, adminOnly, getAllClassrooms);

/* ================= SPECIFIC ROUTES (before dynamic routes) ================= */
// Classes -> sections -> courses the signed-in admin/teacher may target
router.get(
  "/teaching-scope",
  authMiddleware,
  getTeachingScopeTree
);

router.get(
  "/my-classrooms",
  authMiddleware,
  getAssignedClassrooms
);

router.get(
  "/student-classrooms",
  authMiddleware,
  getStudentClassrooms
);



router.get(
  "/analytics",
  authMiddleware,
  adminOnly,
  getClassroomAnalytics
);

router.post(
  "/assign-student",
  authMiddleware,
  roleMiddleware(["mentor", "admin"]),
  assignStudentToClassroom
);

router.get(
  "/fee-structures",
  authMiddleware,
  getAllFeeStructures
);

router.post(
  "/fee-structures",
  authMiddleware,
  adminOnly,
  saveFeeStructure
);

router.put(
  "/fee-structures/:id",
  authMiddleware,
  adminOnly,
  updateFeeStructure
);

/* ================= MENTOR-SPECIFIC ROUTES ================= */
// The attendance pages ask for "the signed-in teacher's classes" with the word "me".
// It must be declared before /mentor/:mentorId, whose id check answers 404 for a non-number.
router.get(
  "/mentor/me",
  authMiddleware,
  getAssignedClassrooms
);

router.get(
  "/mentor/:mentorId",
  authMiddleware,
  getAssignedClassrooms
);

/* ================= DYNAMIC ROUTES (after specific routes) ================= */
router.get(
  "/:classroomId/students",
  authMiddleware,
  getClassroomStudents
);

router.get(
  "/:id/fee-structure",
  authMiddleware,
  getClassroomFeeStructure
);

router.get(
  "/:id",
  authMiddleware,
  getSingleClassroom
);

router.put(
  "/:id",
  authMiddleware,
  adminOnly,
  updateClassroom
);

router.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  deleteClassroom
);

/**
 * GET /api/classrooms/teacher/students-fees
 * Fetch students assigned to teacher classrooms along with real-time fee details
 */
router.get("/teacher/students-fees", authMiddleware, roleMiddleware(["mentor"]), (req, res) => {
  try {
    const db = req.tenant?.database || require("../config/database-switch");
    const isTeacher = req.user.role !== "admin";

    // A teacher sees the students of the classrooms they work in; an admin the whole school.
    const teacherFilter = isTeacher
      ? `AND EXISTS (
           SELECT 1 FROM student_classroom_assignment sca JOIN classrooms c ON c.id = sca.classroomId
           WHERE sca.studentId = u.id AND (
             CAST(c.classTeacher AS INTEGER) = ? OR c.classTeacherId = ?
             OR EXISTS (SELECT 1 FROM classroomAssignments ca WHERE ca.classroomId = c.id AND ca.teacherId = ? AND ca.role = 'class_teacher')
             OR EXISTS (SELECT 1 FROM courses co WHERE co.mentorId = ? AND (co.classroomId = c.id OR EXISTS (SELECT 1 FROM course_classrooms cocc WHERE cocc.courseId = co.id AND cocc.classroomId = c.id)))
           ))`
      : "";
    const params = [req.user.universityId, ...(isTeacher ? Array(4).fill(req.user.userId) : [])];

    db.all(
      `SELECT u.id, u.name, u.email,
              (SELECT c.name FROM student_classroom_assignment sca JOIN classrooms c ON c.id = sca.classroomId
               WHERE sca.studentId = u.id ORDER BY sca.id LIMIT 1) AS className,
              (SELECT SUM(p.amount) FROM payments p WHERE p.studentId = u.id AND p.status IN ('success', 'paid')) AS paidAmount
       FROM users u
       WHERE u.role = 'student' AND u.university_id = ? ${teacherFilter}
       ORDER BY u.name ASC`,
      params,
      (err, students) => {
        if (err) {
          console.error("Error fetching teacher student fees:", err.message);
          return res.status(500).json({ success: false, message: "Database query error" });
        }

        const DEFAULT_TOTAL_FEE = 15000;
        const DEFAULT_DUE_DATE = '2026-10-31';

        res.status(200).json({
          success: true,
          students: (students || []).map((s) => {
            const paidAmount = s.paidAmount || 0;
            const remainingBalance = Math.max(0, DEFAULT_TOTAL_FEE - paidAmount);
            return {
              id: s.id,
              name: s.name || `Student #${s.id}`,
              email: s.email,
              phone: 'N/A',
              className: s.className || 'N/A',
              totalFee: DEFAULT_TOTAL_FEE,
              paidAmount,
              remainingBalance,
              status: remainingBalance === 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending',
              dueDate: DEFAULT_DUE_DATE
            };
          })
        });
      }
    );
  } catch (error) {
    console.error("Error in /teacher/students-fees:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /api/classrooms/send-fee-reminder
 * Send Fee Reminder (In-App Announcement + Email Notification)
 */
router.post("/send-fee-reminder", authMiddleware, roleMiddleware(["mentor"]), async (req, res) => {
  try {
    const { studentId, classroomName, amount, dueDate, message: customNote } = req.body || {};
    const db = req.tenant?.database || require("../config/database-switch");
    const emailService = require("../services/emailService");

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student is required." });
    }
    // The student must be one the caller may work with (own school; for a teacher, own students)
    if (!(await callerMayAccess(req, "user", studentId))) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const student = await new Promise((resolve, reject) => {
      db.get("SELECT id, name, email FROM users WHERE id = ? AND role = 'student'", [studentId], (err, row) =>
        err ? reject(err) : resolve(row)
      );
    });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    // 1. In-app notification, visible to this student only
    const notifTitle = `Fee Payment Reminder: ${classroomName || 'Classroom'}`;
    const notifContent = `Dear ${student.name || 'Student'}, your pending fee amount of ₹${Number(amount || 0).toLocaleString('en-IN')} is due on ${dueDate || 'soon'}. Please make the payment at your earliest convenience.`;
    db.run(
      `INSERT INTO announcements (university_id, title, content, createdByUser, createdByRole, publishFor, recipientUserId)
       VALUES (?, ?, ?, ?, ?, 'student', ?)`,
      [req.user.universityId, notifTitle, notifContent, req.user.userId, req.user.role, student.id],
      (err) => {
        if (err) console.error("Error creating fee reminder notification:", err.message);
      }
    );

    // 2. Email to the address on the student's record
    const emailRes = await emailService.sendFeeReminderEmail({
      studentEmail: student.email,
      studentName: student.name,
      classroomName,
      amount,
      dueDate,
      customNote
    });

    res.status(200).json({
      success: true,
      message: `Fee reminder sent to ${student.name || 'the student'}.`,
      emailInfo: { success: Boolean(emailRes && emailRes.success) }
    });
  } catch (error) {
    console.error("Error in /send-fee-reminder:", error.message);
    res.status(500).json({ success: false, message: "Server error sending fee reminder." });
  }
});

module.exports = router;

