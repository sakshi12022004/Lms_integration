const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  createAnnouncement,
  getAllAnnouncements,
  deleteAnnouncement,
  markAsRead,
  getAnnouncement,
  suggestNotificationText,
} = require("../controllers/announcementController");

/* ================= ANNOUNCEMENT ROUTES ================= */

// Create announcement (Admin / Mentor) - no quota restrictions
router.post("/", authMiddleware, createAnnouncement);

// Get announcements (Role based)
router.get("/", authMiddleware, getAllAnnouncements);

// Suggest a short notification message for preview (Admin / Mentor)
router.post("/suggest-text", authMiddleware, suggestNotificationText);

// Get one announcement / notification the user is allowed to see
router.get("/:id", authMiddleware, getAnnouncement);

// Delete announcement (Admin / Creator)
router.delete("/:id", authMiddleware, deleteAnnouncement);

// Mark announcement as read
router.put("/:id/read", authMiddleware, markAsRead);

module.exports = router;
