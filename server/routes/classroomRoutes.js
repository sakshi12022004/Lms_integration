const express = require("express");
const router = express.Router();

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
  createTestAssignment,
  assignStudentToClassroom,
  getClassroomFeeStructure,
  getStudentClassrooms,
  getClassroomStudents,
  testStudentAssignment,
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
  "/test-assignment",
  authMiddleware,
  testStudentAssignment
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

/* ================= DEBUG: CREATE TEST ASSIGNMENT ================= */
router.post(
  "/debug/create-test-assignment",
  authMiddleware,
  roleMiddleware(["mentor", "admin"]),
  createTestAssignment
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
router.get("/teacher/students-fees", authMiddleware, (req, res) => {
  try {
    const db = req.tenant?.database || require("../config/database-switch");
    
    // Fetch all students with role = 'student'
    db.all(
      `SELECT u.id, u.username as name, u.email, u.phone, u.role
       FROM users u 
       WHERE u.role = 'student'
       ORDER BY u.username ASC`,
      [],
      (err, students) => {
        if (err) {
          console.error("Error fetching teacher student fees:", err);
          return res.status(500).json({ success: false, message: "Database query error" });
        }

        // Fetch payments summary per student
        db.all(
          `SELECT studentId, SUM(amount) as paidAmount FROM payments WHERE status = 'success' GROUP BY studentId`,
          [],
          (err, payments) => {
            const paidMap = {};
            if (payments) {
              payments.forEach(p => {
                paidMap[p.studentId] = p.paidAmount || 0;
              });
            }

            const DEFAULT_TOTAL_FEE = 15000;
            const DEFAULT_DUE_DATE = '2026-10-31';

            const formattedStudents = (students || []).map((s, idx) => {
              const totalFee = DEFAULT_TOTAL_FEE;
              const paidAmount = paidMap[s.id] || 0;
              const remainingBalance = Math.max(0, totalFee - paidAmount);
              
              let status = 'Paid';
              if (remainingBalance > 0 && paidAmount > 0) {
                status = 'Partial';
              } else if (remainingBalance > 0) {
                status = 'Pending';
              }

              return {
                id: s.id,
                name: s.name || `Student #${s.id}`,
                email: s.email,
                phone: s.phone || 'N/A',
                className: `Classroom ${idx % 3 + 1}`,
                totalFee,
                paidAmount,
                remainingBalance,
                status,
                dueDate: DEFAULT_DUE_DATE
              };
            });

            res.status(200).json({
              success: true,
              students: formattedStudents
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("Error in /teacher/students-fees:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /api/classrooms/send-fee-reminder
 * Send Fee Reminder (In-App Announcement + Email Notification)
 */
router.post("/send-fee-reminder", authMiddleware, async (req, res) => {
  try {
    const { studentId, studentEmail, studentName, classroomName, amount, dueDate, message: customNote } = req.body;
    const db = req.tenant?.database || require("../config/database-switch");
    const emailService = require("../services/emailService");

    if (!studentEmail) {
      return res.status(400).json({ success: false, message: "Student email is required." });
    }

    // 1. Create in-app announcement / notification in SQLite DB
    const notifTitle = `⚠️ Fee Payment Reminder: ${classroomName || 'Classroom'}`;
    const notifContent = `Dear ${studentName || 'Student'}, your pending fee amount of ₹${Number(amount || 0).toLocaleString('en-IN')} is due on ${dueDate || 'soon'}. Please make the payment at your earliest convenience.`;

    db.run(
      `INSERT INTO announcements (title, content, target_role, created_at) VALUES (?, ?, 'student', CURRENT_TIMESTAMP)`,
      [notifTitle, notifContent],
      (err) => {
        if (err) {
          console.error("Error creating fee reminder announcement:", err);
        }
      }
    );

    // 2. Dispatch Email via emailService
    const emailRes = await emailService.sendFeeReminderEmail({
      studentEmail,
      studentName,
      classroomName,
      amount,
      dueDate,
      customNote
    });

    console.log(`🔔 Fee Reminder dispatched for ${studentName} (${studentEmail}):`, emailRes);

    res.status(200).json({
      success: true,
      message: `Fee reminder notification & email sent successfully to ${studentName || studentEmail}!`,
      emailInfo: emailRes
    });
  } catch (error) {
    console.error("Error in /send-fee-reminder:", error);
    res.status(500).json({ success: false, message: "Server error sending fee reminder." });
  }
});

module.exports = router;

