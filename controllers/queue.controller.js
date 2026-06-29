 







const Queue   = require('../models/Queue.model');
const Booking = require('../models/Booking.model');
const Salon   = require('../models/Salon.model');
const { createNotification } = require('./notification.controller');
const { releaseSlot }        = require('./slot.controller');

// ── Helper: recalculate avgServiceTime from last 20 completed bookings ────────
const recalcAvgTime = async (salonId) => {
  const recent = await Booking.find({
    salon: salonId, bookingStatus: 'completed',
    startedAt: { $ne: null }, completedAt: { $ne: null },
  }).sort({ completedAt: -1 }).limit(20).select('startedAt completedAt');

  const avgTime = recent.length
    ? Math.max(1, Math.round(recent.reduce((sum, b) => sum + (b.completedAt - b.startedAt) / 60000, 0) / recent.length))
    : 15;

  await Queue.findOneAndUpdate({ salon: salonId }, { avgServiceTime: avgTime });
};

// GET /api/queue/salon/:salonId
const getQueueBySalon = async (req, res) => {
  try {
    const queue = await Queue.findOne({ salon: req.params.salonId })
      .populate({
        path: 'activeBookings',
        select: 'tokenNumber bookingStatus paymentStatus paymentMethod services createdAt totalAmount user',
        populate: { path: 'user', select: 'name photoURL phone' },
      });
    if (!queue) return res.status(404).json({ success: false, message: 'Queue not found.' });

    res.status(200).json({
      success: true,
      data: {
        salonId:          req.params.salonId,
        waitingCount:     queue.activeBookings.length,
        estimatedWait:    queue.activeBookings.length * queue.avgServiceTime,
        avgServiceTime:   queue.avgServiceTime,
        isPaused:         queue.isPaused,
        pauseReason:      queue.pauseReason,
        totalServedToday: queue.totalServedToday,
        activeBookings:   queue.activeBookings,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/queue/position/:bookingId
const getUserQueuePosition = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('salon', 'name address phone');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (booking.user.toString() !== req.user._id.toString() && req.user.role !== 'admin' && req.user.role !== 'salon_owner') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const queue = await Queue.findOne({ salon: booking.salon });
    if (!queue) return res.status(404).json({ success: false, message: 'Queue not found.' });

    const position = queue.activeBookings.findIndex(id => id.toString() === booking._id.toString());
    const estimatedWait = position === -1 ? 0 : position * queue.avgServiceTime;

    res.status(200).json({
      success: true,
      data: {
        bookingId: booking._id, tokenNumber: booking.tokenNumber,
        status: booking.bookingStatus, bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus, paymentMethod: booking.paymentMethod,
        position: position === -1 ? 0 : position,
        waitingCount: queue.activeBookings.length, estimatedWait,
        isPaused: queue.isPaused, totalAmount: booking.totalAmount,
        services: booking.services, salon: booking.salon, createdAt: booking.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/queue/serve/:salonId
const serveNext = async (req, res) => {
  try {
    const queue = await Queue.findOne({ salon: req.params.salonId });
    if (!queue) return res.status(404).json({ success: false, message: 'Queue not found.' });
    if (queue.activeBookings.length === 0) return res.status(400).json({ success: false, message: 'Queue is empty.' });

    if (!queue.avgServiceTime || queue.avgServiceTime < 1) queue.avgServiceTime = 15;

    // ── 1. Complete in_progress booking (if any) ──────────────────────────
    const inProgressBooking = await Booking.findOne({ salon: req.params.salonId, bookingStatus: 'in_progress' });
    if (inProgressBooking) {
      await Booking.findByIdAndUpdate(inProgressBooking._id, { bookingStatus: 'completed', completedAt: new Date() });

      // ── Release its slot ──────────────────────────────────────────────
      await releaseSlot(inProgressBooking._id);

      await recalcAvgTime(req.params.salonId);

      await createNotification({
        userId: inProgressBooking.user, type: 'service_completed', title: 'Service Completed 🎉',
        message: `Your visit is complete. Hope you loved the experience! Don't forget to leave a review.`,
        bookingId: inProgressBooking._id, salonId: req.params.salonId,
      });

      const updated = await Queue.findOne({ salon: req.params.salonId });
      if (updated?.avgServiceTime >= 1) queue.avgServiceTime = updated.avgServiceTime;
    }

    // ── 2. Pop next from queue ────────────────────────────────────────────
    const nextBookingId = queue.activeBookings.shift();
    queue.totalServedToday = (queue.totalServedToday || 0) + 1;
    queue.lastServedAt = new Date();

    const today = new Date().toISOString().slice(0, 10);
    if (queue.lastResetDate !== today) { queue.totalServedToday = 1; queue.lastResetDate = today; }

    await queue.save();

    // ── 3. Mark next as in_progress ───────────────────────────────────────
    const nextBooking = await Booking.findByIdAndUpdate(
      nextBookingId,
      { bookingStatus: 'in_progress', startedAt: new Date() },
      { new: true }
    ).populate('user', 'name phone photoURL');

    await createNotification({
      userId: nextBooking.user._id, type: 'queue_update', title: "It's Your Turn! ✂️",
      message: `Token #${nextBooking.tokenNumber} — please proceed to the salon. Your service is starting now.`,
      bookingId: nextBooking._id, salonId: req.params.salonId,
    });

    res.status(200).json({
      success: true,
      message: `Now serving ${nextBooking.user?.name} (Token: ${nextBooking.tokenNumber})`,
      data: { servedBooking: nextBooking, remainingCount: queue.activeBookings.length },
    });
  } catch (err) {
    console.error('serveNext error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/queue/complete/:salonId
const completeCurrentBooking = async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { salon: req.params.salonId, bookingStatus: 'in_progress' },
      { bookingStatus: 'completed', completedAt: new Date() },
      { new: true }
    ).populate('user', 'name phone');

    if (!booking) return res.status(400).json({ success: false, message: 'No booking is currently in progress.' });

    // ── Release its slot ──────────────────────────────────────────────────
    await releaseSlot(booking._id);

    await recalcAvgTime(req.params.salonId);

    await createNotification({
      userId: booking.user._id, type: 'service_completed', title: 'Service Completed 🎉',
      message: `Your visit is complete. Hope you loved the experience! Don't forget to leave a review.`,
      bookingId: booking._id, salonId: req.params.salonId,
    });

    res.status(200).json({ success: true, message: 'Booking marked as completed.', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/queue/pause/:salonId
const toggleQueuePause = async (req, res) => {
  try {
    const { isPaused, reason } = req.body;
    const queue = await Queue.findOneAndUpdate(
      { salon: req.params.salonId },
      { isPaused, pauseReason: isPaused ? (reason || 'Temporarily paused') : '' },
      { new: true }
    );
    if (!queue) return res.status(404).json({ success: false, message: 'Queue not found.' });
    res.status(200).json({ success: true, message: isPaused ? `Queue paused.` : 'Queue resumed.', data: queue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/queue/cancel-booking/:bookingId
const ownerCancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { bookingStatus: 'cancelled', cancelledBy: 'owner', cancellationReason: req.body.reason?.trim() || 'Cancelled by salon' },
      { new: true }
    ).populate('user', 'name phone');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // ── Release its slot ──────────────────────────────────────────────────
    await releaseSlot(booking._id);

    await Queue.findOneAndUpdate({ salon: booking.salon }, { $pull: { activeBookings: booking._id } });

    res.status(200).json({ success: true, message: 'Booking cancelled.', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getQueueBySalon, getUserQueuePosition, serveNext, completeCurrentBooking, toggleQueuePause, ownerCancelBooking };