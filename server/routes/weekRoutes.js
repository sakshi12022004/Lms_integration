const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const quotaMiddleware = require("../middleware/quotaMiddleware");
const {
  createWeek,
  getWeeks,
  updateWeek,
  deleteWeek,
} = require("../controllers/weekController");

// Match both POST / and POST /create for compatibility
router.post("/", authMiddleware, quotaMiddleware.checkWeeksQuota, createWeek);
router.post("/create", authMiddleware, quotaMiddleware.checkWeeksQuota, createWeek);
router.get("/", authMiddleware, getWeeks);
router.put("/:id", authMiddleware, updateWeek);
router.delete("/:id", authMiddleware, deleteWeek);

module.exports = router;
