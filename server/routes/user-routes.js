const express = require("express");
const {
  getAllUsers,
  approveMentor,
  rejectMentor,
  deleteUser,
  getMentors,
  getStudents,
  updateUser,
  getAdminDashboard,
  getAllMentorsSimple,
  getMentorsForCourseTeachers,
  getStudentsForMentors,
} = require("../controllers/user-controller");
const {
  getClassroomAnalytics,
} = require("../controllers/classroomController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { checkTeacherQuota, checkMentorQuota, checkStudentQuota } = require("../middleware/quotaMiddleware");

const router = express.Router();

/* ================= ADMIN ROUTES ================= */
router.get(
  "/all",
  authMiddleware,
  roleMiddleware(["admin"]),
  getAllUsers
);

router.put(
  "/approve-mentor/:userId",
  authMiddleware,
  roleMiddleware(["admin"]),
  approveMentor
);

router.delete(
  "/reject-mentor/:userId",
  authMiddleware,
  roleMiddleware(["admin"]),
  rejectMentor
);

router.delete(
  "/:userId",
  authMiddleware,
  roleMiddleware(["admin"]),
  deleteUser
);

router.get(
  "/mentors-simple",
  authMiddleware,
  roleMiddleware(["admin"]),
  getAllMentorsSimple
);

router.get(
  "/mentors",
  authMiddleware,
  roleMiddleware(["mentor", "admin"]),
  getMentorsForCourseTeachers
);

router.get(
  "/students-simple",
  authMiddleware,
  roleMiddleware(["mentor", "admin"]),
  getStudentsForMentors
);

router.put(
  "/:userId",
  authMiddleware,
  roleMiddleware(["admin"]),
  updateUser
);

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware(["admin"]),
  getAdminDashboard
);

router.get(
  "/analytics",
  authMiddleware,
  roleMiddleware(["admin"]),
  getClassroomAnalytics
);

module.exports = router;
