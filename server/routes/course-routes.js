const express = require("express");
const {
  createCourse,
  getAllCourses,
  getCoursesByMentor,
  getCoursesByStudent,
  getCourseById,
  updateCourse,
  deleteCourse,
  getCoursesByClassroom,
  assignStudentsToCourse,
  getAssignedStudents,
  getStudentDebugData
} = require("../controllers/course-controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { checkCoursesQuota } = require("../middleware/quotaMiddleware");

const router = express.Router();

/* ================= CREATE COURSE ================= */
router.post(
  "/create-course",
  authMiddleware,
  roleMiddleware(["mentor", "admin", "teacher"]),
  checkCoursesQuota,
  createCourse
);

/* ================= GET ALL COURSES ================= */
router.get("/", authMiddleware, getAllCourses);

/* ================= GET COURSES BY CLASSROOM ================= */
router.get(
  "/classroom/:classroomId",
  authMiddleware,
  getCoursesByClassroom
);
router.get(
  "/classroom",
  authMiddleware,
  getCoursesByClassroom
);

/* ================= GET MENTOR COURSES ================= */
router.get(
  "/mentor",
  authMiddleware,
  roleMiddleware(["mentor"]),
  getCoursesByMentor
);

/* ================= GET STUDENT COURSES ================= */
router.get(
  "/student",
  authMiddleware,
  roleMiddleware(["student"]),
  getCoursesByStudent
);

/* ================= ASSIGN STUDENTS TO COURSE ================= */
router.post(
  "/:id/assign-students",
  authMiddleware,
  roleMiddleware(["mentor", "admin"]),
  assignStudentsToCourse
);

/* ================= GET ASSIGNED STUDENTS ================= */
router.get(
  "/:courseId/students",
  authMiddleware,
  getAssignedStudents
);

/* ================= GET COURSE BY ID ================= */
router.get("/:id", authMiddleware, getCourseById);

/* ================= UPDATE COURSE ================= */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["mentor", "admin"]),
  updateCourse
);

/* ================= DELETE COURSE ================= */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["mentor", "admin"]),
  deleteCourse
);

module.exports = router;

module.exports = router;
