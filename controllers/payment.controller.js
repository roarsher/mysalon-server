// const crypto   = require('crypto');
// const razorpay = require('../config/razorpay');
// const Payment  = require('../models/Payment.model');
// const Booking  = require('../models/Booking.model');
// const Queue    = require('../models/Queue.model');

// // ══════════════════════════════════════════════════════════════════════════════
// // POST /api/payments/create-order
// // ══════════════════════════════════════════════════════════════════════════════
// /**
//  * Step 1 of payment flow.
//  * Creates a Razorpay order and saves a Payment doc with status 'created'.
//  * Returns the order details needed to open the Razorpay checkout modal.
//  *
//  * Called right before the Razorpay modal opens on the BookingPage.
//  */
// const createOrder = async (req, res) => {
//   try {
//     const { bookingId } = req.body;

//     if (!bookingId) {
//       return res.status(400).json({ success: false, message: 'bookingId is required.' });
//     }

//     // ── Fetch booking ─────────────────────────────────────────────────────
//     const booking = await Booking.findById(bookingId)
//       .populate('salon', 'name')
//       .populate('user',  'name email phone');

//     if (!booking) {
//       return res.status(404).json({ success: false, message: 'Booking not found.' });
//     }

//     // Only the booking owner can pay
//     if (booking.user._id.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Access denied.' });
//     }

//     // Prevent duplicate payment
//     const existingPayment = await Payment.findOne({ booking: bookingId, status: 'paid' });
//     if (existingPayment) {
//       return res.status(400).json({ success: false, message: 'This booking is already paid.' });
//     }

//     // ── Razorpay wants amount in paise (₹1 = 100 paise) ─────────────────
//     const amountInPaise = Math.round(booking.totalAmount * 100);

//     // ── Create Razorpay order ─────────────────────────────────────────────
//     const razorpayOrder = await razorpay.orders.create({
//       amount:   amountInPaise,
//       currency: 'INR',
//       receipt:  `booking_${bookingId}`,  // your internal reference
//       notes: {
//         bookingId:  bookingId.toString(),
//         salonName:  booking.salon.name,
//         customerName: booking.user.name,
//       },
//     });

//     // ── Save Payment record ───────────────────────────────────────────────
//     // Delete any old 'created' (unpaid) payment for this booking first
//     await Payment.findOneAndDelete({ booking: bookingId, status: 'created' });

//     const payment = await Payment.create({
//       user:            req.user._id,
//       booking:         bookingId,
//       salon:           booking.salon._id,
//       amount:          booking.totalAmount,
//       amountInPaise,
//       razorpayOrderId: razorpayOrder.id,
//     });

//     // ── Return everything frontend needs to open Razorpay modal ──────────
//     res.status(201).json({
//       success: true,
//       data: {
//         // Razorpay modal config
//         key:         process.env.RAZORPAY_KEY_ID,   // publishable key (safe for frontend)
//         orderId:     razorpayOrder.id,
//         amount:      amountInPaise,
//         currency:    'INR',
//         // Pre-fill customer details in the modal
//         name:        'MYSALON',
//         description: `Booking at ${booking.salon.name}`,
//         prefill: {
//           name:    booking.user.name,
//           email:   booking.user.email,
//           contact: booking.user.phone,
//         },
//         // Our internal reference
//         paymentId:  payment._id,
//         bookingId,
//       },
//     });
//   } catch (err) {
//     console.error('Create order error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // POST /api/payments/verify
// // ══════════════════════════════════════════════════════════════════════════════
// /**
//  * Step 2 of payment flow.
//  * Called after the user completes payment in the Razorpay modal.
//  * Razorpay sends 3 values to the frontend which we use to verify authenticity.
//  *
//  * Verification formula (from Razorpay docs):
//  *   HMAC-SHA256( razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET )
//  *   must match razorpay_signature
//  *
//  * On success: marks Payment as 'paid', Booking as 'waiting' (confirmed).
//  */
// const verifyPayment = async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       bookingId,
//     } = req.body;

//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
//       return res.status(400).json({ success: false, message: 'Missing required payment verification fields.' });
//     }

//     // ── Verify signature ──────────────────────────────────────────────────
//     const body      = `${razorpay_order_id}|${razorpay_payment_id}`;
//     const expected  = crypto
//       .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//       .update(body)
//       .digest('hex');

//     if (expected !== razorpay_signature) {
//       // Signature mismatch — payment may have been tampered with
//       await Payment.findOneAndUpdate(
//         { razorpayOrderId: razorpay_order_id },
//         { status: 'failed' }
//       );
//       return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
//     }

//     // ── Fetch payment details from Razorpay to get method ────────────────
//     let method = 'unknown';
//     try {
//       const rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
//       method = rzpPayment.method || 'unknown';
//     } catch { /* non-critical — don't fail the verification */ }

//     // ── Update Payment record ─────────────────────────────────────────────
//     const payment = await Payment.findOneAndUpdate(
//       { razorpayOrderId: razorpay_order_id },
//       {
//         razorpayPaymentId: razorpay_payment_id,
//         razorpaySignature: razorpay_signature,
//         status:  'paid',
//         method,
//         paidAt:  new Date(),
//       },
//       { new: true }
//     );

//     if (!payment) {
//       return res.status(404).json({ success: false, message: 'Payment record not found.' });
//     }

//     // ── Update Booking — mark as confirmed (waiting in queue) ────────────
//     await Booking.findByIdAndUpdate(bookingId, {
//       paymentStatus: 'paid',
//       paymentId:     payment._id,
//     });

//     res.status(200).json({
//       success: true,
//       message: 'Payment successful! Your booking is confirmed.',
//       data: {
//         paymentId:         payment._id,
//         razorpayPaymentId: razorpay_payment_id,
//         amount:            payment.amount,
//         method,
//         paidAt:            payment.paidAt,
//       },
//     });
//   } catch (err) {
//     console.error('Verify payment error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // POST /api/payments/webhook
// // ══════════════════════════════════════════════════════════════════════════════
// /**
//  * Razorpay Webhook Handler
//  * ------------------------
//  * Razorpay calls this URL after every payment event.
//  * This is a backup to /verify — handles cases where the user
//  * closes the modal before the frontend can call /verify.
//  *
//  * Set the webhook URL in Razorpay Dashboard → Settings → Webhooks:
//  *   https://your-api.com/api/payments/webhook
//  *
//  * Set RAZORPAY_WEBHOOK_SECRET in .env (different from KEY_SECRET).
//  */
// const handleWebhook = async (req, res) => {
//   try {
//     const signature      = req.headers['x-razorpay-signature'];
//     const webhookSecret  = process.env.RAZORPAY_WEBHOOK_SECRET;

//     if (!webhookSecret) {
//       console.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping webhook verification');
//     } else {
//       // ── Verify webhook signature ────────────────────────────────────────
//       const expected = crypto
//         .createHmac('sha256', webhookSecret)
//         .update(JSON.stringify(req.body))
//         .digest('hex');

//       if (expected !== signature) {
//         return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
//       }
//     }

//     const { event, payload } = req.body;
//     console.log(`📦 Razorpay webhook: ${event}`);

//     // ── payment.captured → same as /verify success ────────────────────────
//     if (event === 'payment.captured') {
//       const rzpPayment = payload.payment.entity;
//       const orderId    = rzpPayment.order_id;

//       const payment = await Payment.findOne({ razorpayOrderId: orderId });
//       if (payment && payment.status !== 'paid') {
//         payment.razorpayPaymentId = rzpPayment.id;
//         payment.status            = 'paid';
//         payment.method            = rzpPayment.method || 'unknown';
//         payment.paidAt            = new Date();
//         payment.webhookPayload    = rzpPayment;
//         await payment.save();

//         await Booking.findByIdAndUpdate(payment.booking, {
//           paymentStatus: 'paid',
//           paymentId:     payment._id,
//         });
//       }
//     }

//     // ── payment.failed ────────────────────────────────────────────────────
//     if (event === 'payment.failed') {
//       const rzpPayment = payload.payment.entity;
//       await Payment.findOneAndUpdate(
//         { razorpayOrderId: rzpPayment.order_id },
//         { status: 'failed', webhookPayload: rzpPayment }
//       );
//     }

//     // ── refund.processed ─────────────────────────────────────────────────
//     if (event === 'refund.processed') {
//       const refund = payload.refund.entity;
//       await Payment.findOneAndUpdate(
//         { razorpayPaymentId: refund.payment_id },
//         {
//           status:       'refunded',
//           refundId:     refund.id,
//           refundAmount: refund.amount / 100,
//           refundStatus: 'processed',
//           refundedAt:   new Date(),
//         }
//       );
//     }

//     res.status(200).json({ success: true });
//   } catch (err) {
//     console.error('Webhook error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // POST /api/payments/refund
// // ══════════════════════════════════════════════════════════════════════════════
// /**
//  * Initiates a refund when a booking is cancelled.
//  * Refund policy (set in .env or hardcoded):
//  *   - Cancelled 2+ hours before → 100% refund
//  *   - Cancelled < 2 hours before → 50% refund
//  *   - Already in_progress        → no refund
//  */
// const initiateRefund = async (req, res) => {
//   try {
//     const { bookingId, reason } = req.body;

//     if (!bookingId) {
//       return res.status(400).json({ success: false, message: 'bookingId is required.' });
//     }

//     const payment = await Payment.findOne({ booking: bookingId, status: 'paid' });
//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: 'No paid payment found for this booking. Nothing to refund.',
//       });
//     }

//     // Only the booking owner or admin can initiate refund
//     if (
//       payment.user.toString() !== req.user._id.toString() &&
//       req.user.role !== 'admin'
//     ) {
//       return res.status(403).json({ success: false, message: 'Access denied.' });
//     }

//     const booking = await Booking.findById(bookingId);

//     // ── Refund policy ────────────────────────────────────────────────────
//     let refundPercent = 100;
//     const hoursAhead = (booking.estimatedStartTime - new Date()) / (1000 * 60 * 60);
//     if (hoursAhead < 0)   refundPercent = 0;    // already started
//     else if (hoursAhead < 2) refundPercent = 50; // less than 2 hrs notice

//     if (refundPercent === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Refund not available — service has already started.',
//       });
//     }

//     const refundAmountInPaise = Math.round((payment.amountInPaise * refundPercent) / 100);

//     // ── Initiate Razorpay refund ──────────────────────────────────────────
//     const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
//       amount: refundAmountInPaise,
//       notes:  { reason: reason || 'Customer cancelled booking', bookingId: bookingId.toString() },
//     });

//     // ── Update Payment ────────────────────────────────────────────────────
//     payment.status        = refundPercent === 100 ? 'refunded' : 'partially_refunded';
//     payment.refundId      = refund.id;
//     payment.refundAmount  = refundAmountInPaise / 100;
//     payment.refundStatus  = refund.status;
//     payment.refundedAt    = new Date();
//     payment.refundReason  = reason || 'Customer cancelled booking';
//     await payment.save();

//     // ── Update Booking ────────────────────────────────────────────────────
//     await Booking.findByIdAndUpdate(bookingId, {
//       status:        'cancelled',
//       cancelledBy:   'user',
//       cancellationReason: reason || '',
//       paymentStatus: payment.status,
//     });

//     // ── Remove from queue ─────────────────────────────────────────────────
//     await Queue.findOneAndUpdate(
//       { salon: booking.salon },
//       { $pull: { activeBookings: booking._id } }
//     );

//     res.status(200).json({
//       success: true,
//       message: `Refund of ₹${payment.refundAmount} initiated. It will reflect in 5–7 business days.`,
//       data: {
//         refundId:     refund.id,
//         refundAmount: payment.refundAmount,
//         refundStatus: refund.status,
//         percent:      refundPercent,
//       },
//     });
//   } catch (err) {
//     console.error('Refund error:', err);
//     if (err.error?.description) {
//       return res.status(400).json({ success: false, message: err.error.description });
//     }
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // GET /api/payments/my
// // ══════════════════════════════════════════════════════════════════════════════
// /** Get all payments for the logged-in user */
// const getMyPayments = async (req, res) => {
//   try {
//     const payments = await Payment.find({ user: req.user._id })
//       .sort({ createdAt: -1 })
//       .populate('booking', 'tokenNumber services totalAmount status')
//       .populate('salon',   'name address coverImage');

//     res.status(200).json({ success: true, count: payments.length, data: payments });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // GET /api/payments/booking/:bookingId
// // ══════════════════════════════════════════════════════════════════════════════
// /** Get payment details for a specific booking */
// const getPaymentByBooking = async (req, res) => {
//   try {
//     const payment = await Payment.findOne({ booking: req.params.bookingId })
//       .populate('booking', 'tokenNumber services totalAmount status')
//       .populate('salon',   'name');

//     if (!payment) {
//       return res.status(404).json({ success: false, message: 'No payment found for this booking.' });
//     }

//     // Only the booking owner or admin can view
//     if (payment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
//       return res.status(403).json({ success: false, message: 'Access denied.' });
//     }

//     res.status(200).json({ success: true, data: payment });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// module.exports = {
//   createOrder,
//   verifyPayment,
//   handleWebhook,
//   initiateRefund,
//   getMyPayments,
//   getPaymentByBooking,
// };


const crypto   = require('crypto');
const Payment  = require('../models/Payment.model');
const Booking  = require('../models/Booking.model');
const Queue    = require('../models/Queue.model');

// ── Lazy-load razorpay so missing keys don't crash server startup ─────────────
let razorpay = null;
const getRazorpay = () => {
  if (!razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET ||
        process.env.RAZORPAY_KEY_ID === 'rzp_test_xxxxxxxxxxxxxxxx') {
      throw new Error('Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.');
    }
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/create-order
// ══════════════════════════════════════════════════════════════════════════════
const createOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId is required.' });

    const booking = await Booking.findById(bookingId)
      .populate('salon', 'name')
      .populate('user',  'name email phone');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (booking.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (booking.paymentMethod === 'cod') {
      return res.status(400).json({ success: false, message: 'This booking uses Pay at Salon.' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Already paid.' });
    }

    // Check Razorpay configured
    let rp;
    try { rp = getRazorpay(); }
    catch (e) {
      return res.status(503).json({ success: false, message: e.message });
    }

    const amountInPaise = Math.round(booking.totalAmount * 100);

    const razorpayOrder = await rp.orders.create({
      amount:   amountInPaise,
      currency: 'INR',
      receipt:  `bkg_${bookingId.toString().slice(-8)}`,
      notes: {
        bookingId:    bookingId.toString(),
        salonName:    booking.salon?.name || '',
        customerName: booking.user?.name  || '',
      },
    });

    // Delete old unpaid payment for this booking (retry)
    await Payment.findOneAndDelete({ booking: bookingId, status: 'created' });

    const payment = await Payment.create({
      user:            req.user._id,
      booking:         bookingId,
      salon:           booking.salon._id,
      amount:          booking.totalAmount,
      amountInPaise,
      razorpayOrderId: razorpayOrder.id,
    });

    res.status(201).json({
      success: true,
      data: {
        key:         process.env.RAZORPAY_KEY_ID,
        orderId:     razorpayOrder.id,
        amount:      amountInPaise,
        currency:    'INR',
        name:        'MYSALON',
        description: `Booking at ${booking.salon?.name}`,
        prefill: {
          name:    booking.user?.name  || '',
          email:   booking.user?.email || '',
          contact: booking.user?.phone || '',
        },
        paymentId: payment._id,
        bookingId,
      },
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/verify
// ══════════════════════════════════════════════════════════════════════════════
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields.' });
    }

    // Verify HMAC signature
    const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      await Payment.findOneAndUpdate({ razorpayOrderId: razorpay_order_id }, { status: 'failed' });
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    // Get payment method from Razorpay
    let method = 'unknown';
    try {
      const rp    = getRazorpay();
      const rzpPay = await rp.payments.fetch(razorpay_payment_id);
      method = rzpPay.method || 'unknown';
    } catch { /* non-critical */ }

    // Update Payment record
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature, status: 'paid', method, paidAt: new Date() },
      { new: true }
    );

    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found.' });

    // Update booking → confirmed, add to queue
    const booking = await Booking.findByIdAndUpdate(bookingId, {
      paymentStatus: 'paid',
      paymentId:     payment._id,
      bookingStatus: 'confirmed',
    }, { new: true });

    // Add to queue now that payment is confirmed
    await Queue.findOneAndUpdate(
      { salon: booking.salon },
      { $addToSet: { activeBookings: booking._id } }
    );

    res.status(200).json({
      success: true,
      message: 'Payment successful! Booking confirmed.',
      data: { paymentId: payment._id, razorpayPaymentId: razorpay_payment_id, amount: payment.amount, method, paidAt: payment.paidAt },
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/webhook  (Razorpay calls this directly)
// ══════════════════════════════════════════════════════════════════════════════
const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-razorpay-signature'];
      const expected  = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (expected !== signature) {
        return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
      }
    }

    const { event, payload } = req.body;
    console.log(`📦 Webhook: ${event}`);

    if (event === 'payment.captured') {
      const rzpPay  = payload.payment.entity;
      const payment = await Payment.findOne({ razorpayOrderId: rzpPay.order_id });
      if (payment && payment.status !== 'paid') {
        await payment.updateOne({ razorpayPaymentId: rzpPay.id, status: 'paid', method: rzpPay.method, paidAt: new Date() });
        const booking = await Booking.findByIdAndUpdate(payment.booking, { paymentStatus: 'paid', bookingStatus: 'confirmed', paymentId: payment._id }, { new: true });
        if (booking) await Queue.findOneAndUpdate({ salon: booking.salon }, { $addToSet: { activeBookings: booking._id } });
      }
    }
    if (event === 'payment.failed') {
      const rzpPay = payload.payment.entity;
      await Payment.findOneAndUpdate({ razorpayOrderId: rzpPay.order_id }, { status: 'failed' });
      await Booking.findOneAndUpdate({ paymentId: { $exists: true } }, { paymentStatus: 'failed' });
    }
    if (event === 'refund.processed') {
      const refund = payload.refund.entity;
      await Payment.findOneAndUpdate(
        { razorpayPaymentId: refund.payment_id },
        { status: 'refunded', refundId: refund.id, refundAmount: refund.amount / 100, refundStatus: 'processed', refundedAt: new Date() }
      );
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/refund
// ══════════════════════════════════════════════════════════════════════════════
const initiateRefund = async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId is required.' });

    const payment = await Payment.findOne({ booking: bookingId, status: 'paid' });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'No paid payment found for this booking.' });
    }

    if (payment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const booking = await Booking.findById(bookingId);

    // Refund policy
    let refundPercent = 100;
    const hoursAhead  = booking.estimatedStartTime
      ? (booking.estimatedStartTime - new Date()) / (1000 * 60 * 60)
      : 24;
    if (hoursAhead < 0)    refundPercent = 0;
    else if (hoursAhead < 2) refundPercent = 50;

    if (refundPercent === 0) {
      return res.status(400).json({ success: false, message: 'Refund not available — service already started.' });
    }

    const refundAmountInPaise = Math.round((payment.amountInPaise * refundPercent) / 100);

    let rp;
    try { rp = getRazorpay(); } catch (e) {
      return res.status(503).json({ success: false, message: e.message });
    }

    const refund = await rp.payments.refund(payment.razorpayPaymentId, {
      amount: refundAmountInPaise,
      notes:  { reason: reason || 'Customer cancelled', bookingId: bookingId.toString() },
    });

    await payment.updateOne({
      status: refundPercent === 100 ? 'refunded' : 'partially_refunded',
      refundId: refund.id, refundAmount: refundAmountInPaise / 100,
      refundStatus: refund.status, refundedAt: new Date(), refundReason: reason || '',
    });

    await Booking.findByIdAndUpdate(bookingId, {
      bookingStatus: 'cancelled', cancelledBy: 'user',
      paymentStatus: refundPercent === 100 ? 'refunded' : 'partially_refunded',
    });

    await Queue.findOneAndUpdate({ salon: booking.salon }, { $pull: { activeBookings: booking._id } });

    res.status(200).json({
      success: true,
      message: `Refund of ₹${refundAmountInPaise / 100} initiated. Reflects in 5–7 business days.`,
      data: { refundId: refund.id, refundAmount: refundAmountInPaise / 100, percent: refundPercent },
    });
  } catch (err) {
    console.error('Refund error:', err);
    res.status(500).json({ success: false, message: err?.error?.description || err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/payments/cod/collect  (owner marks COD as collected)
// ══════════════════════════════════════════════════════════════════════════════
const markCodCollected = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.paymentMethod !== 'cod') {
      return res.status(400).json({ success: false, message: 'This is not a COD booking.' });
    }

    await booking.updateOne({ paymentStatus: 'collected', bookingStatus: 'completed', completedAt: new Date() });

    res.status(200).json({ success: true, message: 'Payment marked as collected. Booking completed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyPayments    = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('booking', 'tokenNumber services totalAmount bookingStatus')
      .populate('salon',   'name address');
    res.status(200).json({ success: true, data: payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getPaymentByBooking = async (req, res) => {
  try {
    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.status(200).json({ success: true, data: payment });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { createOrder, verifyPayment, handleWebhook, initiateRefund, markCodCollected, getMyPayments, getPaymentByBooking }