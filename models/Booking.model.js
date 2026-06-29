 




const mongoose = require('mongoose');

/**
 * Booking Model — Full spec implementation
 * Supports: time slots, stylist, pricing breakdown, COD, online payment
 */

// ── Snapshot of a selected service at booking time ───────────────────────────
const selectedServiceSchema = new mongoose.Schema({
  service:  { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  name:     { type: String, required: true },
  price:    { type: Number, required: true },
  duration: { type: Number, required: true },
  category: { type: String, required: true },
}, { _id: false });

// ── Pricing breakdown ────────────────────────────────────────────────────────
const pricingSchema = new mongoose.Schema({
  subtotal:        { type: Number, default: 0 },  // sum of service prices
  gstPercent:      { type: Number, default: 18 }, // GST rate %
  gstAmount:       { type: Number, default: 0 },  // calculated GST
  platformFee:     { type: Number, default: 0 },  // platform charge
  discountCode:    { type: String, default: '' },  // coupon code used
  discountLabel:   { type: String, default: '' },  // e.g. "First booking - ₹100 off"
  discountAmount:  { type: Number, default: 0 },  // rupee discount
  totalAmount:     { type: Number, default: 0 },  // final payable
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  // ── References ────────────────────────────────────────────────────────────
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  salon:  { type: mongoose.Schema.Types.ObjectId, ref: 'Salon',   required: true },

  // ── Services ──────────────────────────────────────────────────────────────
  services: {
    type: [selectedServiceSchema],
    validate: { validator: (a) => a.length >= 1 && a.length <= 10, message: 'Select 1–10 services' },
  },

  // ── Stylist (optional) ────────────────────────────────────────────────────
  stylist: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Stylist',
    default: null,
  },
  stylistName: { type: String, default: 'Any available' },

  // ── Time slot ─────────────────────────────────────────────────────────────
  slotDate:  { type: String, default: '' },  // "YYYY-MM-DD"
  slotTime:  { type: String, default: '' },  // "HH:MM"
  slotLabel: { type: String, default: '' },  // "Today, 3:00 PM"

  // ── Queue token ───────────────────────────────────────────────────────────
  tokenNumber:   { type: String, unique: true, sparse: true },
  queuePosition: { type: Number, default: 0 },

  // ── Pricing ───────────────────────────────────────────────────────────────
  pricing:      { type: pricingSchema, default: () => ({}) },
  totalAmount:  { type: Number, required: true },   // = pricing.totalAmount
  totalDuration:{ type: Number, default: 0 },       // sum of durations in minutes

  // ── Booking status lifecycle ──────────────────────────────────────────────
  // PENDING → CONFIRMED → COMPLETED
  //         ↘ CANCELLED
  bookingStatus: {
    type:    String,
    enum:    ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending',
  },

  // ── Payment ───────────────────────────────────────────────────────────────
  paymentMethod: {
    type:    String,
    enum:    ['online', 'cod'],   // online = Razorpay, cod = Pay at Salon
    default: 'online',
  },
  paymentStatus: {
    type:    String,
    enum:    ['pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'collected'],
    default: 'pending',
  },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },

  // ── Timestamps ────────────────────────────────────────────────────────────
  startedAt:   { type: Date, default: null },
  completedAt: { type: Date, default: null },
  estimatedStartTime: { type: Date, default: null },

  // ── Cancellation ─────────────────────────────────────────────────────────
  cancelledBy:        { type: String, enum: ['user','owner','system', null], default: null },
  cancellationReason: { type: String, default: '' },

  // ── Notes & review ────────────────────────────────────────────────────────
  notes:  { type: String, default: '', maxlength: 300 },
  // ── Admin / dispute fields ────────────────────────────────────────────────────
isFlagged:  { type: Boolean, default: false },
flagReason: { type: String,  default: '' },
flaggedAt:  { type: Date,    default: null },
flaggedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
adminNote:  { type: String,  default: '' },
  rating: {
    score:   { type: Number, min: 1, max: 5, default: null },
    comment: { type: String, default: '' },
    ratedAt: { type: Date, default: null },
  },

  // ── First booking flag (used for discount) ────────────────────────────────
  isFirstBooking: { type: Boolean, default: false },
}, { timestamps: true });

// Indexes
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ salon: 1, bookingStatus: 1, createdAt: 1 });
//bookingSchema.index({ tokenNumber: 1 });
bookingSchema.index({ salon: 1, slotDate: 1, slotTime: 1 });

 // AFTER
bookingSchema.pre('validate', function () {
  if (!this.tokenNumber) {
    const ts     = Date.now().toString().slice(-4);
    const suffix = Math.floor(10 + Math.random() * 90);
    this.tokenNumber = `MS${ts}${suffix}`;
  }
});

bookingSchema.pre('save', function () {
  if (this.isModified('bookingStatus')) {
    if (this.bookingStatus === 'in_progress' && !this.startedAt)   this.startedAt   = new Date();
    if (this.bookingStatus === 'completed'   && !this.completedAt) this.completedAt = new Date();
  }
});

module.exports = mongoose.model('Booking', bookingSchema);

