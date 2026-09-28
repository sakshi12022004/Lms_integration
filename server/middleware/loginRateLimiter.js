// Simple Login Rate Limiting Middleware (Memory Store Only)
// No Redis dependency - uses in-memory storage

const crypto = require('crypto');

// Configuration constants
const CONFIG = {
  MAX_ATTEMPTS_PER_MINUTE: 1000,
  BLOCK_DURATION_SECONDS: 60,
  ATTEMPT_WINDOW_SECONDS: 60,
  REDIS_PREFIX: 'login:',
  REDIS_TTL: 3600 // 1 hour for keys
};

// Memory store
const memoryStore = new Map();

// Memory store functions
function getMemoryKey(key) {
  const data = memoryStore.get(key);
  if (!data) return null;
  
  // Check if expired
  if (Date.now() > data.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  
  return data.value;
}

function setMemoryKey(key, value, ttlSeconds) {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
}

function deleteMemoryKey(key) {
  memoryStore.delete(key);
}

// Generate keys for tracking
function generateKeys(ip, email = null) {
  const ipKey = `${CONFIG.REDIS_PREFIX}fail:ip:${ip}`;
  const emailKey = email ? `${CONFIG.REDIS_PREFIX}fail:user:${email}` : null;
  const blockKey = `${CONFIG.REDIS_PREFIX}block:${ip}`;
  
  return { ipKey, emailKey, blockKey };
}

// Get client IP address
function getClientIP(req) {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         'unknown';
}

// Main rate limiting middleware
const loginRateLimiter = async (req, res, next) => {
  try {
    const ip = getClientIP(req);
    const { email } = req.body;
    const { ipKey, emailKey, blockKey } = generateKeys(ip, email);

    console.log(`🔐 Login attempt - IP: ${ip}, Email: ${email || 'not provided'}`);

    // Check if user is blocked
    const blockData = getMemoryKey(blockKey);
    if (blockData) {
      const remainingTime = Math.ceil((blockData.expiresAt - Date.now()) / 1000);
      
      console.log(`🚫 Login blocked for ${remainingTime}s - IP: ${ip}, Email: ${email || 'not provided'}`);
      
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again later.',
        blocked: true,
        remainingTime: remainingTime,
        blockType: 'ip'
      });
    }

    // Check failed attempts for IP
    const ipAttempts = getMemoryKey(ipKey) || { count: 0, firstAttempt: Date.now() };
    
    // Check failed attempts for email (if provided)
    let emailAttempts = null;
    if (email) {
      emailAttempts = getMemoryKey(emailKey) || { count: 0, firstAttempt: Date.now() };
    }

    // Determine if we should block
    const ipExceeded = ipAttempts.count >= CONFIG.MAX_ATTEMPTS_PER_MINUTE;
    const emailExceeded = emailAttempts && emailAttempts.count >= CONFIG.MAX_ATTEMPTS_PER_MINUTE;

    if (ipExceeded || emailExceeded) {
      // Block the user
      const blockExpiresAt = Date.now() + (CONFIG.BLOCK_DURATION_SECONDS * 1000);
      
      setMemoryKey(blockKey, {
        blocked: true,
        expiresAt: blockExpiresAt,
        blockReason: ipExceeded ? 'ip_limit' : 'email_limit',
        blockedAt: Date.now()
      }, CONFIG.BLOCK_DURATION_SECONDS);

      console.log(`🚫 Login blocked for ${CONFIG.BLOCK_DURATION_SECONDS}s - Reason: ${ipExceeded ? 'IP limit' : 'Email limit'}`);

      return res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again later.',
        blocked: true,
        remainingTime: CONFIG.BLOCK_DURATION_SECONDS,
        blockType: 'ip'
      });
    }

    // Not blocked, continue to login
    // Store original res.json to intercept responses
    const originalJson = res.json;
    
    res.json = function(data) {
      // Handle successful login - reset counters
      if (data.success && data.token) {
        console.log(`✅ Successful login - IP: ${ip}, Email: ${email || 'not provided'}`);
        
        // Reset failed attempt counters
        deleteMemoryKey(ipKey);
        if (email) {
          deleteMemoryKey(emailKey);
        }
        deleteMemoryKey(blockKey);
      } 
      // Handle failed login - increment counters
      else if (!data.success) {
        console.log(`❌ Failed login - IP: ${ip}, Email: ${email || 'not provided'}`);
        
        // Increment IP counter
        const newIpAttempts = {
          count: ipAttempts.count + 1,
          firstAttempt: ipAttempts.firstAttempt
        };
        setMemoryKey(ipKey, newIpAttempts, CONFIG.ATTEMPT_WINDOW_SECONDS);
        
        // Increment email counter (if provided)
        let newEmailAttempts = null;
        if (email) {
          newEmailAttempts = {
            count: (emailAttempts?.count || 0) + 1,
            firstAttempt: emailAttempts?.firstAttempt || Date.now()
          };
          setMemoryKey(emailKey, newEmailAttempts, CONFIG.ATTEMPT_WINDOW_SECONDS);
        }
        
        // Add attempt info to response for frontend
        data.attemptInfo = {
          ipAttempts: newIpAttempts.count,
          emailAttempts: email ? newEmailAttempts.count : 0,
          maxAttempts: CONFIG.MAX_ATTEMPTS_PER_MINUTE,
          remainingAttempts: CONFIG.MAX_ATTEMPTS_PER_MINUTE - Math.max(newIpAttempts.count, email ? newEmailAttempts.count : 0)
        };
      }
      
      // Call original json
      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    console.error('❌ Rate limiting middleware error:', error);
    // If middleware fails, allow request to continue
    next();
  }
};

// Helper function to reset user's rate limit (for admin use)
async function resetUserRateLimit(ip, email = null) {
  try {
    const { ipKey, emailKey, blockKey } = generateKeys(ip, email);
    
    deleteMemoryKey(ipKey);
    if (email) {
      deleteMemoryKey(emailKey);
    }
    deleteMemoryKey(blockKey);
    
    console.log(`🔄 Rate limit reset - IP: ${ip}, Email: ${email || 'not provided'}`);
    return true;
  } catch (error) {
    console.error('❌ Error resetting rate limit:', error);
    return false;
  }
}

// Helper function to check if user is blocked
async function isUserBlocked(ip, email = null) {
  try {
    const { blockKey } = generateKeys(ip, email);
    const blockData = getMemoryKey(blockKey);
    
    if (!blockData) return null;
    
    const remainingTime = Math.ceil((blockData.expiresAt - Date.now()) / 1000);
    return {
      blocked: true,
      remainingTime,
      blockReason: blockData.blockReason,
      blockedAt: blockData.blockedAt
    };
  } catch (error) {
    console.error('❌ Error checking block status:', error);
    return null;
  }
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, data] of memoryStore.entries()) {
    if (now > data.expiresAt) {
      memoryStore.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} expired rate limiting entries`);
  }
}, 60000); // Clean every minute

module.exports = {
  loginRateLimiter,
  resetUserRateLimit,
  isUserBlocked,
  CONFIG
};
