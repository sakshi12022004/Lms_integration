const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { checkCalendarAccess } = require("../middleware/quotaMiddleware");
const {
  createCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
} = require("../controllers/calendarController");

// 🔐 PROTECTED CALENDAR ROUTES

// Create new calendar event (Admin / Mentor)
router.post("/", authMiddleware, checkCalendarAccess, createCalendarEvent);

// Get calendar events (Role based)
router.get("/", authMiddleware, checkCalendarAccess, getCalendarEvents);

// Update calendar event (Owner only)
router.put("/:id", authMiddleware, checkCalendarAccess, updateCalendarEvent);

// Delete calendar event (Owner only)
router.delete("/:id", authMiddleware, checkCalendarAccess, deleteCalendarEvent);

module.exports = router;
