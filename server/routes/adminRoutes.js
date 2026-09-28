const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { checkStudentQuota, checkTeacherQuota, checkMentorQuota } = require("../middleware/quotaMiddleware");
const {
  createStudent,
  createTeacher,
  getMentors,   // ✅ REQUIRED for classroom dropdown
  deleteUser,   // ✅ REQUIRED for deleting users
} = require("../controllers/adminController");
const {
  getAllUsers,
  getStudents,
  getAdminDashboard,
  getUserHierarchy,
} = require("../controllers/user-controller");
const {
  getAllClassrooms,
  getClassroomAnalytics,
} = require("../controllers/classroomController");

/* ================= ADMIN ONLY ================= */
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

/* ================= ROUTES ================= */

/**
 * @route   POST /api/admin/create-student
 * @desc    Create student (admin only)
 */
router.post(
  "/create-student",
  authMiddleware,
  adminOnly,
  checkStudentQuota,
  createStudent
);

/**
 * @route   POST /api/admin/create-teacher
 * @desc    Create teacher / mentor (admin only)
 */
router.post(
  "/create-teacher",
  authMiddleware,
  adminOnly,
  checkTeacherQuota,
  checkMentorQuota,
  createTeacher
);

/**
 * @route   GET /api/admin/mentors
 * @desc    Get all mentors (for classroom dropdown)
 */
router.get(
  "/mentors",
  authMiddleware,
  adminOnly,
  getMentors
);

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard data
 */
router.get(
  "/dashboard",
  authMiddleware,
  adminOnly,
  getAdminDashboard
);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 */
router.get(
  "/users",
  authMiddleware,
  adminOnly,
  getAllUsers
);

/**
 * @route   GET /api/admin/user-hierarchy
 * @desc    Get user hierarchy tree
 */
router.get(
  "/user-hierarchy",
  authMiddleware,
  adminOnly,
  getUserHierarchy
);

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Delete user (student/mentor) - admin only
 */
router.delete(
  "/users/:userId",
  authMiddleware,
  adminOnly,
  deleteUser
);

/**
 * @route   GET /api/admin/students
 * @desc    Get all students
 */
router.get(
  "/students",
  authMiddleware,
  adminOnly,
  getStudents
);

/**
 * @route   GET /api/admin/classrooms
 * @desc    Get all classrooms
 */
router.get(
  "/classrooms",
  authMiddleware,
  adminOnly,
  getAllClassrooms
);

/**
 * @route   GET /api/admin/analytics
 * @desc    Get analytics data
 */
router.get(
  "/analytics",
  authMiddleware,
  adminOnly,
  getClassroomAnalytics
);

module.exports = router;
