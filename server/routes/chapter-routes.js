const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapter-controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const uploadChapterMaterial = require("../middleware/uploadChapterMaterial");

// All routes require authentication
router.use(authMiddleware);

// Mentor-only routes
router.post("/create-chapter", roleMiddleware(["mentor"]), uploadChapterMaterial.single("file"), chapterController.createChapter);
router.put("/update-chapter/:chapterId", roleMiddleware(["mentor"]), uploadChapterMaterial.single("file"), chapterController.updateChapter);
router.delete("/delete-chapter/:chapterId", roleMiddleware(["mentor"]), chapterController.deleteChapter);

// Shared routes (mentors and students)
router.get("/get-chapters", chapterController.getChapters);
router.get("/course/:courseId", chapterController.getChapters);

module.exports = router;
