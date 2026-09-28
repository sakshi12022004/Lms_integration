// Razorpay Configuration
// Update these with your actual Razorpay credentials

const RAZORPAY_CONFIG = {
  // Test Mode (for development)
  TEST: {
    KEY_ID: 'rzp_test_YourKeyHere',
    KEY_SECRET: 'YourSecretKey'
  },
  
  // Live Mode (for production)
  LIVE: {
    KEY_ID: 'rzp_live_YourLiveKey',
    KEY_SECRET: 'YourLiveSecret'
  },
  
  // Current mode (change to 'LIVE' for production)
  CURRENT_MODE: 'TEST'
};

// Get current configuration
const getCurrentConfig = () => {
  return RAZORPAY_CONFIG[RAZORPAY_CONFIG.CURRENT_MODE];
};

module.exports = {
  RAZORPAY_CONFIG,
  getCurrentConfig
};
