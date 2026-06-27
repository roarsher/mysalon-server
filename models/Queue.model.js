const mongoose = require('mongoose');

/**
 * Queue Model
 *
 * One Queue document per salon — it is the live state of who is waiting.
 * Think of it as the token machine at a salon/bank.
 *
 * activeBookings[] is an ordered array of Booking IDs.
 *   [0] → currently being served (in_progress)
 *   [1] → next up (1 person ahead)
 *   [2] → 2 people ahead
 *   ...
 *
 * When the owner clicks "Serve Next":
 *   - activeBookings.shift() removes the first booking
 *   - That booking's status → in_progress
 *   - Everyone else's position drops by 1 automatically
 *     (position = index in activeBookings array)
 *
 * avgServiceTime is updated after each completed booking
 * and used to estimate wait times for new customers.
 */
const queueSchema = new mongoose.Schema(
  {
    salon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Salon',
      required: [true, 'Queue must belong to a salon'],
      unique: true,   // one queue per salon
    },

    // Ordered list of waiting/in-progress bookings
    // First item is the one currently being served
    activeBookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
      },
    ],

    // Rolling average of how long each customer takes (minutes)
    // Recalculated after each completed booking
    avgServiceTime: {
      type: Number,
      default: 20,   // default 20 minutes per customer
      min: 1,
    },

    // Total customers served today (for analytics / owner dashboard)
    totalServedToday: {
      type: Number,
      default: 0,
    },

    // Last time a customer was served (used to detect idle queues)
    lastServedAt: {
      type: Date,
      default: null,
    },

    // If the owner has temporarily paused the queue
    // (e.g. lunch break, technical issue)
    isPaused: {
      type: Boolean,
      default: false,
    },
    pauseReason: {
      type: String,
      default: '',
      maxlength: 200,
    },

    // Date when totalServedToday was last reset
    // Used to reset counter at midnight
    lastResetDate: {
      type: String,   // "YYYY-MM-DD"
      default: () => new Date().toISOString().slice(0, 10),
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// queueSchema.index({ salon: 1 }, { unique: true });

// ─── Virtual: number of people currently waiting ──────────────────────────────
queueSchema.virtual('waitingCount').get(function () {
  return this.activeBookings ? this.activeBookings.length : 0;
});

// ─── Virtual: estimated wait for a new customer joining now ──────────────────
queueSchema.virtual('estimatedWaitForNew').get(function () {
  return this.waitingCount * this.avgServiceTime;
});

// ─── Method: get position of a specific booking ───────────────────────────────
queueSchema.methods.getPosition = function (bookingId) {
  const idx = this.activeBookings.findIndex(
    (id) => id.toString() === bookingId.toString()
  );
  return idx; // -1 if not found, 0 = currently being served
};

// ─── Method: recalculate avgServiceTime from recent completed bookings ────────
queueSchema.methods.recalculateAvgTime = async function () {
  const Booking = mongoose.model('Booking');
  // Use last 20 completed bookings for the rolling average
  const recent = await Booking.find({
    salon:       this.salon,
    status:      'completed',
    startedAt:   { $ne: null },
    completedAt: { $ne: null },
  })
    .sort({ completedAt: -1 })
    .limit(20)
    .select('startedAt completedAt');

  if (recent.length === 0) return;

  const totalMins = recent.reduce((sum, b) => {
    const mins = (b.completedAt - b.startedAt) / 60000; // ms → minutes
    return sum + mins;
  }, 0);

  this.avgServiceTime = Math.round(totalMins / recent.length);
  await this.save();
};

// ─── Method: reset daily counter (call at midnight via cron) ──────────────────
queueSchema.methods.resetDailyCounter = async function () {
  const today = new Date().toISOString().slice(0, 10);
  if (this.lastResetDate !== today) {
    this.totalServedToday = 0;
    this.lastResetDate    = today;
    await this.save();
  }
};

module.exports = mongoose.model('Queue', queueSchema);