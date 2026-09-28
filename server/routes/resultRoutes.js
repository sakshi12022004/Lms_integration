const express = require("express");
const router = express.Router();
const resultController = require("../controllers/resultController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Student: Get my results
router.get(
  "/my-results",
  authMiddleware,
  roleMiddleware(["student"]),
  resultController.getMyResults
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

module.exports = router;
