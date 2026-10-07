const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  markAttendance,
  getAttendance,
  getStudentAttendance,
  downloadAttendanceExcel,
} = require("../controllers/attendanceController");

// Class teacher routes
router.post("/mark", authMiddleware, markAttendance);
router.get("/download", authMiddleware, downloadAttendanceExcel);
router.get("/student", authMiddleware, getStudentAttendance);
router.get("/classroom/:classroomId/date/:date", authMiddleware, (req, res, next) => {
  req.query.classroomId = req.params.classroomId;
  req.query.date = req.params.date;
  getAttendance(req, res, next);
});
router.get("/", authMiddleware, getAttendance);

module.exports = router;
