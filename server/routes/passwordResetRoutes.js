const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/passwordResetController');
const { rateLimiters } = require('../middleware/rateLimiter');

// Apply rate limiting to all password reset endpoints (50 requests per minute)
router.use(rateLimiters.sensitive);

// Step 1: Send OTP to email
router.post('/send-otp', passwordResetController.sendOTP);

// Step 2: Verify OTP
router.post('/verify-otp', passwordResetController.verifyOTP);

// Step 3: Reset password
router.post('/reset-password', passwordResetController.resetPassword);

// Check OTP cooldown status
router.get('/check-cooldown', passwordResetController.checkCooldown);

module.exports = router;
