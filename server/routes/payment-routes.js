const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getTransactionHistory, generateInvoice, getAllTransactions } = require('../controllers/payment-controller');
const { rateLimiters } = require('../middleware/rateLimiter');

// Create Razorpay order - rate limited (50 requests per minute)
router.post('/create-order', rateLimiters.createOrder, createOrder);

// Verify Razorpay payment - rate limited (50 requests per minute)
router.post('/verify-payment', rateLimiters.verifyPayment, verifyPayment);

// Generate professional invoice - rate limited (50 requests per minute)
router.post('/generate-invoice', rateLimiters.sensitive, generateInvoice);

// Get transaction history for a student
router.get('/transactions/:studentId', getTransactionHistory);

// Get all transactions for accountant portal
router.get('/all-transactions', getAllTransactions);

module.exports = router;
