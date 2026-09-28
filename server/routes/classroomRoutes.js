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
  testStudentAssignment
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
  adminOnly,
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

module.exports = router;
