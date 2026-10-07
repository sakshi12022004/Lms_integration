const express = require("express");
const router = express.Router();
const resultController = require("../controllers/resultController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Student: Get my results
router.get(
  "/my-results",
  authMiddleware,
  resultController.getMyResults
);

// Student: Get results by student ID
router.get(
  "/student/:studentId",
  authMiddleware,
  resultController.getStudentResults
);

// Teacher: Get classroom results
router.get(
  "/classroom/:classroomId",
  authMiddleware,
  roleMiddleware(["mentor", "admin"]),
  resultController.getClassroomResults
);

// Teacher: Add/Update result
router.post(
  "/add",
  authMiddleware,
  roleMiddleware(["mentor", "admin"]),
  resultController.addResult
);

// Get all results (compat)
router.get(
  "/",
  authMiddleware,
  resultController.getResults
);

module.exports = router;
