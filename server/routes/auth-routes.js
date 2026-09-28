const express = require('express');
const { register, login, getProfile } = require('../controllers/auth-controller');
const authMiddleware = require('../middleware/authMiddleware');
const { rateLimiters } = require('../middleware/rateLimiter');
const { loginRateLimiter } = require('../middleware/loginRateLimiter');

const router = express.Router();

// Public routes with rate limiting (50 requests per minute)
router.post('/register', rateLimiters.register, register);

// Login route with brute-force protection
router.post('/login', loginRateLimiter, login);

module.exports = router;
