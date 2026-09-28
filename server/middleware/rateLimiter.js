const rateLimit = require('express-rate-limit');

// Get rate limit configuration from environment variables
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 600000;

// Rate limiting configuration - 600,000 requests per minute
const createRateLimiter = (windowMs = RATE_LIMIT_WINDOW_MS, max = RATE_LIMIT_MAX_REQUESTS, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: message || 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Rate limiters for different endpoints - all set to 600,000 requests per minute
const rateLimiters = {
  // Authentication endpoints - 600,000 requests per minute
  login: createRateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, 'Too many login attempts. Please try again later.'),
  register: createRateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, 'Too many registration attempts. Please try again later.'),
  
  // General API endpoints - 600,000 requests per minute
  general: createRateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, 'Too many requests. Please try again later.'),
  
  // Sensitive endpoints - 600,000 requests per minute
  sensitive: createRateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, 'Too many sensitive operations. Please try again later.'),
  
  // Payment endpoints - 600,000 requests per minute
  createOrder: createRateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, 'Too many payment attempts. Please try again later.'),
  verifyPayment: createRateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, 'Too many payment verification attempts. Please try again later.')
};

module.exports = { rateLimiters };
