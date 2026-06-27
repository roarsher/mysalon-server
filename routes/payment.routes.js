  
const router = require('express').Router();
const {
  createOrder, verifyPayment, handleWebhook,
  initiateRefund, markCodCollected, getMyPayments, getPaymentByBooking,
} = require('../controllers/payment.controller');
const { protect, ownerOrAdmin } = require('../middleware/auth.middleware');

// Webhook — no auth (Razorpay calls this)
router.post('/webhook',           handleWebhook);

// Online payment
router.post('/create-order',      protect, createOrder);
router.post('/verify',            protect, verifyPayment);
router.post('/refund',            protect, initiateRefund);

// COD
router.post('/cod/collect',       protect, ownerOrAdmin, markCodCollected);

// History
router.get('/my',                 protect, getMyPayments);
router.get('/booking/:bookingId', protect, getPaymentByBooking);

module.exports = router;


