const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['booking_confirmed', 'booking_cancelled', 'queue_update', 'service_completed', 'new_booking'],
    required: true,
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  isRead:  { type: Boolean, default: false },
  data: {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    salonId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Salon',   default: null },
  },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);