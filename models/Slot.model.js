const mongoose = require('mongoose');

/**
 * Slot Model
 * Represents a bookable time slot for a specific stylist on a specific date.
 * Slots are generated from the salon's working hours.
 * Each slot is tied to a stylist — "Any available" bookings don't block slots.
 */
const slotSchema = new mongoose.Schema({
  salon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salon',
    required: true,
  },
  stylist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stylist',
    required: true,
  },
  date: {
    type: String,   // "YYYY-MM-DD"
    required: true,
  },
  startTime: {
    type: String,   // "HH:MM" 24hr
    required: true,
  },
  endTime: {
    type: String,   // "HH:MM" 24hr
    required: true,
  },
  duration: {
    type: Number,   // minutes
    required: true,
  },
  isBooked: {
    type: Boolean,
    default: false,
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null,
  },
}, { timestamps: true });

// Compound index — prevent duplicate slots for same stylist/date/time
slotSchema.index({ salon: 1, stylist: 1, date: 1, startTime: 1 }, { unique: true });
slotSchema.index({ salon: 1, date: 1 });
slotSchema.index({ stylist: 1, date: 1, isBooked: 1 });

module.exports = mongoose.model('Slot', slotSchema);
 