
const mongoose = require('mongoose');

/**
 * Payment Model
 * -------------
 * Tracks every payment transaction in the system.
 *
 * Payment lifecycle:
 *   created → paid → (refunded if cancelled)
 *
 * Razorpay flow:
 *   1. Frontend calls POST /api/payments/create-order
 *      → Backend creates Razorpay order, returns { orderId, amount, currency, key }
 *   2. Frontend opens Razorpay checkout modal with those details
 *   3. User pays → Razorpay calls our webhook AND returns to frontend
 *   4. Frontend calls POST /api/payments/verify with razorpay signatures
 *      → Backend verifies signature, marks booking as paid
 *   5. On booking cancel → POST /api/payments/refund
 *      → Backend initiates Razorpay refund
 */
const paymentSchema = new mongoose.Schema(
  {
    // ── Relations ─────────────────────────────────────────────────────────────
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    booking: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
    },
    salon: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Salon',
      required: true,
    },

    // ── Amount ────────────────────────────────────────────────────────────────
    amount: {
      type:     Number,
      required: true,
      min:      0,
    },
    // Razorpay works in paise (1 rupee = 100 paise)
    amountInPaise: {
      type:     Number,
      required: true,
    },
    currency: {
      type:    String,
      default: 'INR',
    },

    // ── Razorpay IDs ──────────────────────────────────────────────────────────
    razorpayOrderId:   { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, default: '' },  // filled after payment
    razorpaySignature: { type: String, default: '' },  // filled after verification

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['created', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'created',
    },

    // ── Payment method (filled after Razorpay confirms) ───────────────────────
    method: {
      type:    String,
      enum:    ['upi', 'card', 'netbanking', 'wallet', 'emi', 'unknown', ''],
      default: '',
    },

    // ── Refund details ────────────────────────────────────────────────────────
    refundId:      { type: String, default: '' },
    refundAmount:  { type: Number, default: 0  },
    refundStatus:  { type: String, default: '' },
    refundedAt:    { type: Date,   default: null },
    refundReason:  { type: String, default: '' },

    // ── Webhook raw payload (for debugging / audit) ───────────────────────────
    webhookPayload: { type: mongoose.Schema.Types.Mixed, default: null },

    // ── Timestamps ────────────────────────────────────────────────────────────
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
paymentSchema.index({ user:             1, createdAt: -1 });
paymentSchema.index({ booking:          1 }, { unique: true });
//paymentSchema.index({ razorpayOrderId:  1 });
paymentSchema.index({ razorpayPaymentId:1 });
paymentSchema.index({ status:           1 });

module.exports = mongoose.model('Payment', paymentSchema);