const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { checkLiveClassQuota } = require("../middleware/quotaMiddleware");
const {
  createLiveClass,
  getCourseLiveClasses,
  startLiveClass,
  endLiveClass,
  deleteLiveClass,
  getStudentLiveClasses,
  joinLiveClass,
  leaveLiveClass
} = require("../controllers/liveClassController");

/* ================= CREATE LIVE CLASS ================= */
router.post(
  "/",
  authMiddleware,
  checkLiveClassQuota,
  createLiveClass
);

/* ================= GET LIVE CLASSES FOR COURSE ================= */
router.get(
  "/course/:courseId",
  authMiddleware,
  getCourseLiveClasses
);

/* ================= START LIVE CLASS ================= */
router.put(
  "/:liveClassId/start",
  authMiddleware,
  startLiveClass
);

/* ================= END LIVE CLASS ================= */
router.post(
  "/:liveClassId/end",
  authMiddleware,
  endLiveClass
);

/* ================= GET LIVE CLASSES FOR STUDENT ================= */
router.get(
  "/student/upcoming",
  authMiddleware,
  getStudentLiveClasses
);

/* ================= JOIN LIVE CLASS ================= */
router.post(
  "/:liveClassId/join",
  authMiddleware,
  joinLiveClass
);

/* ================= LEAVE LIVE CLASS ================= */
router.post(
  "/:liveClassId/leave",
  authMiddleware,
  leaveLiveClass
);

/* ================= DELETE LIVE CLASS ================= */
router.delete(
  "/:liveClassId",
  authMiddleware,
  deleteLiveClass
);

module.exports = router;
