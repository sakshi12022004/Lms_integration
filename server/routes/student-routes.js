const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getStudentDashboard,
  getStudentCourses,
  getStudentPayments,
  getStudentClassroom,
} = require("../controllers/student-controller");

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Student dashboard data
router.get("/dashboard", getStudentDashboard);

// Student courses
router.get("/courses", getStudentCourses);

// Student payments
router.get("/payments", getStudentPayments);

// Student classroom
router.get("/:studentId/classroom", getStudentClassroom);

module.exports = router;
