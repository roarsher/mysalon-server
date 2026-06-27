const Razorpay = require('razorpay');

/**
 * Razorpay Configuration
 * ----------------------
 * Get credentials from: razorpay.com → Settings → API Keys
 * Use TEST keys during development (starts with rzp_test_)
 * Switch to LIVE keys in production (starts with rzp_live_)
 *
 * Test card: 4111 1111 1111 1111  CVV: any 3 digits  Expiry: any future date
 * Test UPI:  success@razorpay
 */
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('⚠️  RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in .env');
}

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpay;