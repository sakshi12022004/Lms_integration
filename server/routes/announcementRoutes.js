const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  createAnnouncement,
  getAllAnnouncements,
  deleteAnnouncement,
  markAsRead,
} = require("../controllers/announcementController");

/* ================= ANNOUNCEMENT ROUTES ================= */

// Create announcement (Admin / Mentor) - no quota restrictions
router.post("/", authMiddleware, createAnnouncement);

// Get announcements (Role based)
router.get("/", authMiddleware, getAllAnnouncements);

// Delete announcement (Admin / Creator)
router.delete("/:id", authMiddleware, deleteAnnouncement);

// Mark announcement as read
router.put("/:id/read", authMiddleware, markAsRead);

module.exports = router;
