const express = require('express');
const router = express.Router();
const {
  getCurrentSubscription,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  activateFreeTrial,
  cancelSubscription,
  checkFeatureAccess,
  testUpgradeSubscription
} = require('../controllers/subscription-controller');
const authMiddleware = require('../middleware/authMiddleware');

// Get current subscription
router.get('/current', getCurrentSubscription);

// Check feature access (Calendar, Export, etc.)
router.get('/check-feature-access', authMiddleware, checkFeatureAccess);

// Create subscription order
router.post('/create-order', createSubscriptionOrder);

// Verify subscription payment and activate
router.post('/verify-payment', verifySubscriptionPayment);

// Activate free trial
router.post('/activate-free-trial', activateFreeTrial);

// Cancel subscription
router.post('/cancel', cancelSubscription);

// Test upgrade subscription (for demonstration)
router.post('/test-upgrade', testUpgradeSubscription);

module.exports = router;
