const express = require("express");
const router = express.Router();

const controller = require("../controllers/assessmentController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkAssessmentsQuota } = require("../middleware/quotaMiddleware");

/**
 * ============================
 * MENTOR ROUTES
 * ============================
 */

// Create assessment (title + start/end time)
router.post(
  "/create",
  authMiddleware,
  checkAssessmentsQuota,
  controller.createAssessment
);

// Also support POST / for compatibility
router.post(
  "/",
  authMiddleware,
  checkAssessmentsQuota,
  controller.createAssessment
);

// Add question to assessment
router.post(
  "/questions",
  authMiddleware,
  controller.addQuestion
);

// Get questions for an assessment
router.get(
  "/:assessmentId/questions",
  authMiddleware,
  controller.getAssessmentQuestions
);

// Publish assessment
router.put(
  "/:assessmentId/publish",
  authMiddleware,
  controller.publishAssessment
);

// Get ALL assessments for course (Mentor)
router.get(
  "/course/:courseId/all",
  authMiddleware,
  controller.getAllCourseAssessments
);

/**
 * ============================
 * STUDENT ROUTES
 * ============================
 */

// Get all published assessments for a course (lock/unlock handled)
router.get(
  "/course/:courseId",
  authMiddleware,
  controller.getCourseAssessments
);

// Submit assessment (student)
router.post(
  "/submit",
  authMiddleware,
  controller.submitAssessment
);

module.exports = router;
