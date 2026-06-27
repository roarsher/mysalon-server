 

// const Booking  = require('../models/Booking.model');
// const Salon    = require('../models/Salon.model');
// const Service  = require('../models/Service.model');
// const Queue    = require('../models/Queue.model');
// const User     = require('../models/User.model');
// const Payment  = require('../models/Payment.model');
// const { calculatePricing } = require('../utils/pricing');

// // ══════════════════════════════════════════════════════════════════════════════
// // POST /api/bookings
// // ══════════════════════════════════════════════════════════════════════════════
// const createBooking = async (req, res) => {
//   try {
//     const {
//       salonId, serviceIds, notes,
//       paymentMethod = 'online',   // 'online' | 'cod'
//       slotDate, slotTime,         // optional — if salon uses time slots
//       stylistId,                   // optional
//     } = req.body;

//     if (!salonId || !serviceIds?.length) {
//       return res.status(400).json({ success: false, message: 'salonId and serviceIds are required.' });
//     }

//     // Validate payment method
//     if (!['online', 'cod'].includes(paymentMethod)) {
//       return res.status(400).json({ success: false, message: 'paymentMethod must be "online" or "cod".' });
//     }

//     // ── Validate salon ────────────────────────────────────────────────────
//     const salon = await Salon.findOne({ _id: salonId, isActive: true });
//     if (!salon) {
//       return res.status(404).json({ success: false, message: 'Salon not found or not accepting bookings.' });
//     }

//     // ── Check queue not paused ────────────────────────────────────────────
//     const queue = await Queue.findOne({ salon: salonId });
//     if (!queue) {
//       return res.status(404).json({ success: false, message: 'Salon queue not configured.' });
//     }
//     if (queue.isPaused) {
//       return res.status(400).json({
//         success: false,
//         message: `Queue is paused: ${queue.pauseReason || 'Temporarily unavailable'}`,
//       });
//     }

//     // ── Prevent duplicate active booking ─────────────────────────────────
//     const existing = await Booking.findOne({
//       user: req.user._id,
//       salon: salonId,
//       bookingStatus: { $in: ['pending', 'confirmed', 'in_progress'] },
//     });
//     if (existing) {
//       return res.status(400).json({
//         success: false,
//         message: 'You already have an active booking at this salon.',
//         bookingId: existing._id,
//       });
//     }

//     // ── Validate services ─────────────────────────────────────────────────
//     const services = await Service.find({
//       _id:         { $in: serviceIds },
//       salon:       salonId,
//       isAvailable: true,
//     });
//     if (!services.length) {
//       return res.status(400).json({ success: false, message: 'No valid services found.' });
//     }

//     // Snapshot at booking time
//     const serviceSnapshots = services.map((s) => ({
//       service:  s._id,
//       name:     s.name,
//       price:    s.price,
//       duration: s.duration,
//       category: s.category,
//     }));

//     const subtotal      = services.reduce((sum, s) => sum + s.price, 0);
//     const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

//     // ── Check if this is user's first booking ever ────────────────────────
//     const prevBookingsCount = await Booking.countDocuments({ user: req.user._id });
//     const isFirstBooking    = prevBookingsCount === 0;

//     // ── Calculate pricing with GST, platform fee, first-booking discount ─
//     const pricing = calculatePricing(subtotal, isFirstBooking);

//     // ── Queue position ────────────────────────────────────────────────────
//     const queuePosition      = queue.activeBookings.length;
//     const estimatedWait      = queuePosition * (queue.avgServiceTime || 20);
//     const estimatedStartTime = new Date(Date.now() + estimatedWait * 60000);

//     // ── For COD: status is confirmed immediately ──────────────────────────
//     // For online: status is pending until payment verified
//     const bookingStatus = paymentMethod === 'cod' ? 'confirmed' : 'pending';
//     const paymentStatus = 'pending';

//     // ── Create booking ────────────────────────────────────────────────────
//     const booking = await Booking.create({
//       user:          req.user._id,
//       salon:         salonId,
//       services:      serviceSnapshots,
//       stylistName:   stylistId ? 'Selected stylist' : 'Any available',
//       slotDate:      slotDate || '',
//       slotTime:      slotTime || '',
//       slotLabel:     slotDate && slotTime ? `${slotDate} at ${slotTime}` : '',
//       queuePosition,
//       totalAmount:   pricing.totalAmount,
//       totalDuration,
//       pricing,
//       bookingStatus,
//       paymentMethod,
//       paymentStatus,
//       isFirstBooking,
//       estimatedStartTime,
//       notes: notes?.trim() || '',
//     });

//     // ── For COD: add to queue immediately ────────────────────────────────
//     if (paymentMethod === 'cod') {
//       queue.activeBookings.push(booking._id);
//       await queue.save();
//     }

//     // Link booking to user
//     await User.findByIdAndUpdate(req.user._id, { $push: { bookings: booking._id } });

//     await booking.populate('salon', 'name address coverImage phone');

//     res.status(201).json({
//       success: true,
//       message: paymentMethod === 'cod'
//         ? 'Booking confirmed! Pay at the salon.'
//         : 'Booking created. Complete payment to confirm.',
//       data: {
//         ...booking.toObject(),
//         queuePosition,
//         estimatedWait,
//         pricing,
//       },
//     });
//   } catch (err) {
//     console.error('Create booking error:', err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // GET /api/bookings/my
// // ══════════════════════════════════════════════════════════════════════════════
// const getMyBookings = async (req, res) => {
//   try {
//     const { status, statuses, page = 1, limit = 50 } = req.query;
//     const filter = { user: req.user._id };

//     // Support single status: ?status=completed
//     // Support multiple: ?statuses=pending,confirmed,in_progress
//     if (statuses) {
//       filter.bookingStatus = { $in: statuses.split(',').map((s) => s.trim()) };
//     } else if (status) {
//       filter.bookingStatus = status;
//     }

//     const skip  = (Number(page) - 1) * Number(limit);
//     const total = await Booking.countDocuments(filter);

//     const bookings = await Booking.find(filter)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(Number(limit))
//       .populate('salon', 'name address coverImage phone');

//     res.status(200).json({
//       success: true, total,
//       page: Number(page),
//       pages: Math.ceil(total / Number(limit)),
//       data: bookings,
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // GET /api/bookings/:id
// // ══════════════════════════════════════════════════════════════════════════════
// const getBookingById = async (req, res) => {
//   try {
//     const booking = await Booking.findById(req.params.id)
//       .populate('salon', 'name address coverImage phone')
//       .populate('user',  'name email phone');

//     if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

//     const isOwner  = booking.user._id.toString() === req.user._id.toString();
//     const isAdmin  = req.user.role === 'admin';
//     const isSalonOwner = req.user.role === 'salon_owner';

//     if (!isOwner && !isAdmin && !isSalonOwner) {
//       return res.status(403).json({ success: false, message: 'Access denied.' });
//     }

//     res.status(200).json({ success: true, data: booking });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // PATCH /api/bookings/:id/cancel
// // ══════════════════════════════════════════════════════════════════════════════
// const cancelBooking = async (req, res) => {
//   try {
//     const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
//     if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

//     if (!['pending', 'confirmed', 'in_progress'].includes(booking.bookingStatus)) {
//       return res.status(400).json({ success: false, message: `Cannot cancel a ${booking.bookingStatus} booking.` });
//     }

//     booking.bookingStatus      = 'cancelled';
//     booking.cancelledBy        = 'user';
//     booking.cancellationReason = req.body.reason?.trim() || '';
//     await booking.save();

//     // Remove from queue
//     await Queue.findOneAndUpdate(
//       { salon: booking.salon },
//       { $pull: { activeBookings: booking._id } }
//     );

//     res.status(200).json({ success: true, message: 'Booking cancelled.', data: booking });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // GET /api/bookings/salon/:salonId  (owner)
// // ══════════════════════════════════════════════════════════════════════════════
// const getSalonBookings = async (req, res) => {
//   try {
//     const { status, date, page = 1, limit = 20 } = req.query;
//     const filter = { salon: req.params.salonId };
//     if (status) filter.bookingStatus = status;
//     if (date) {
//       const start = new Date(date);
//       const end   = new Date(date);
//       end.setDate(end.getDate() + 1);
//       filter.createdAt = { $gte: start, $lt: end };
//     }

//     const skip  = (Number(page) - 1) * Number(limit);
//     const total = await Booking.countDocuments(filter);

//     const bookings = await Booking.find(filter)
//       .sort({ createdAt: 1 })
//       .skip(skip)
//       .limit(Number(limit))
//       .populate('user', 'name phone email photoURL');

//     res.status(200).json({ success: true, total, data: bookings });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // GET /api/bookings/pricing-preview  (called before confirming booking)
// // ══════════════════════════════════════════════════════════════════════════════
// const getPricingPreview = async (req, res) => {
//   try {
//     const { salonId, serviceIds } = req.query;
//     if (!salonId || !serviceIds) {
//       return res.status(400).json({ success: false, message: 'salonId and serviceIds required.' });
//     }

//     const ids      = serviceIds.split(',');
//     const services = await Service.find({ _id: { $in: ids }, salon: salonId, isAvailable: true });
//     if (!services.length) return res.status(404).json({ success: false, message: 'No services found.' });

//     const subtotal       = services.reduce((sum, s) => sum + s.price, 0);
//     const prevCount      = await Booking.countDocuments({ user: req.user._id });
//     const isFirstBooking = prevCount === 0;
//     const pricing        = calculatePricing(subtotal, isFirstBooking);

//     res.status(200).json({ success: true, data: { pricing, isFirstBooking } });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// module.exports = { createBooking, getMyBookings, getBookingById, cancelBooking, getSalonBookings, getPricingPreview };

const Booking  = require('../models/Booking.model');
const Salon    = require('../models/Salon.model');
const Service  = require('../models/Service.model');
const Queue    = require('../models/Queue.model');
const User     = require('../models/User.model');
const Payment  = require('../models/Payment.model');
const { calculatePricing } = require('../utils/pricing');
const { createNotification } = require('./notification.controller');

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/bookings
// ══════════════════════════════════════════════════════════════════════════════
const createBooking = async (req, res) => {
  try {
    const {
      salonId, serviceIds, notes,
      paymentMethod = 'online',
      slotDate, slotTime,
      stylistId,
    } = req.body;

    if (!salonId || !serviceIds?.length) {
      return res.status(400).json({ success: false, message: 'salonId and serviceIds are required.' });
    }

    if (!['online', 'cod'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'paymentMethod must be "online" or "cod".' });
    }

    const salon = await Salon.findOne({ _id: salonId, isActive: true });
    if (!salon) {
      return res.status(404).json({ success: false, message: 'Salon not found or not accepting bookings.' });
    }

    const queue = await Queue.findOne({ salon: salonId });
    if (!queue) {
      return res.status(404).json({ success: false, message: 'Salon queue not configured.' });
    }
    if (queue.isPaused) {
      return res.status(400).json({
        success: false,
        message: `Queue is paused: ${queue.pauseReason || 'Temporarily unavailable'}`,
      });
    }

    const existing = await Booking.findOne({
      user: req.user._id,
      salon: salonId,
      bookingStatus: { $in: ['pending', 'confirmed', 'in_progress'] },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active booking at this salon.',
        bookingId: existing._id,
      });
    }

    const services = await Service.find({
      _id:         { $in: serviceIds },
      salon:       salonId,
      isAvailable: true,
    });
    if (!services.length) {
      return res.status(400).json({ success: false, message: 'No valid services found.' });
    }

    const serviceSnapshots = services.map((s) => ({
      service:  s._id,
      name:     s.name,
      price:    s.price,
      duration: s.duration,
      category: s.category,
    }));

    const subtotal      = services.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

    const prevBookingsCount = await Booking.countDocuments({ user: req.user._id });
    const isFirstBooking    = prevBookingsCount === 0;
    const pricing           = calculatePricing(subtotal, isFirstBooking);

    const queuePosition      = queue.activeBookings.length;
    const estimatedWait      = queuePosition * (queue.avgServiceTime || 20);
    const estimatedStartTime = new Date(Date.now() + estimatedWait * 60000);

    const bookingStatus = paymentMethod === 'cod' ? 'confirmed' : 'pending';
    const paymentStatus = 'pending';

    const booking = await Booking.create({
      user:          req.user._id,
      salon:         salonId,
      services:      serviceSnapshots,
      stylistName:   stylistId ? 'Selected stylist' : 'Any available',
      slotDate:      slotDate || '',
      slotTime:      slotTime || '',
      slotLabel:     slotDate && slotTime ? `${slotDate} at ${slotTime}` : '',
      queuePosition,
      totalAmount:   pricing.totalAmount,
      totalDuration,
      pricing,
      bookingStatus,
      paymentMethod,
      paymentStatus,
      isFirstBooking,
      estimatedStartTime,
      notes: notes?.trim() || '',
    });

    if (paymentMethod === 'cod') {
      queue.activeBookings.push(booking._id);
      await queue.save();

      // ── Notify customer: booking confirmed ────────────────────────────
      await createNotification({
        userId:    req.user._id,
        type:      'booking_confirmed',
        title:     'Booking Confirmed! ✅',
        message:   `Your booking at ${salon.name} is confirmed. Token: #${booking.tokenNumber}. Queue position: ${queuePosition + 1}.`,
        bookingId: booking._id,
        salonId:   salonId,
      });

      // ── Notify salon owner: new booking ───────────────────────────────
      if (salon.owner) {
        await createNotification({
          userId:    salon.owner,
          type:      'new_booking',
          title:     'New Booking Received 📋',
          message:   `${req.user.name} booked ${serviceSnapshots.map(s => s.name).join(', ')} at ${salon.name}.`,
          bookingId: booking._id,
          salonId:   salonId,
        });
      }
    }

    await User.findByIdAndUpdate(req.user._id, { $push: { bookings: booking._id } });
    await booking.populate('salon', 'name address coverImage phone');

    res.status(201).json({
      success: true,
      message: paymentMethod === 'cod'
        ? 'Booking confirmed! Pay at the salon.'
        : 'Booking created. Complete payment to confirm.',
      data: {
        ...booking.toObject(),
        queuePosition,
        estimatedWait,
        pricing,
      },
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/bookings/my
// ══════════════════════════════════════════════════════════════════════════════
const getMyBookings = async (req, res) => {
  try {
    const { status, statuses, page = 1, limit = 50 } = req.query;
    const filter = { user: req.user._id };

    if (statuses) {
      filter.bookingStatus = { $in: statuses.split(',').map((s) => s.trim()) };
    } else if (status) {
      filter.bookingStatus = status;
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Booking.countDocuments(filter);

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('salon', 'name address coverImage phone');

    res.status(200).json({
      success: true, total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: bookings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/bookings/:id
// ══════════════════════════════════════════════════════════════════════════════
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('salon', 'name address coverImage phone')
      .populate('user',  'name email phone');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const isOwner      = booking.user._id.toString() === req.user._id.toString();
    const isAdmin      = req.user.role === 'admin';
    const isSalonOwner = req.user.role === 'salon_owner';

    if (!isOwner && !isAdmin && !isSalonOwner) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// PATCH /api/bookings/:id/cancel
// ══════════════════════════════════════════════════════════════════════════════
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id })
      .populate('salon', 'name owner');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (!['pending', 'confirmed', 'in_progress'].includes(booking.bookingStatus)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a ${booking.bookingStatus} booking.` });
    }

    booking.bookingStatus      = 'cancelled';
    booking.cancelledBy        = 'user';
    booking.cancellationReason = req.body.reason?.trim() || '';
    await booking.save();

    await Queue.findOneAndUpdate(
      { salon: booking.salon._id },
      { $pull: { activeBookings: booking._id } }
    );

    // ── Notify customer ───────────────────────────────────────────────────
    await createNotification({
      userId:    req.user._id,
      type:      'booking_cancelled',
      title:     'Booking Cancelled ❌',
      message:   `Your booking at ${booking.salon.name} has been cancelled.`,
      bookingId: booking._id,
      salonId:   booking.salon._id,
    });

    // ── Notify owner ──────────────────────────────────────────────────────
    if (booking.salon.owner) {
      await createNotification({
        userId:    booking.salon.owner,
        type:      'booking_cancelled',
        title:     'Booking Cancelled ❌',
        message:   `A customer cancelled their booking at ${booking.salon.name}.`,
        bookingId: booking._id,
        salonId:   booking.salon._id,
      });
    }

    res.status(200).json({ success: true, message: 'Booking cancelled.', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/bookings/salon/:salonId  (owner)
// ══════════════════════════════════════════════════════════════════════════════
const getSalonBookings = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    const filter = { salon: req.params.salonId };
    if (status) filter.bookingStatus = status;
    if (date) {
      const start = new Date(date);
      const end   = new Date(date);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Booking.countDocuments(filter);

    const bookings = await Booking.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name phone email photoURL');

    res.status(200).json({ success: true, total, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/bookings/pricing-preview
// ══════════════════════════════════════════════════════════════════════════════
const getPricingPreview = async (req, res) => {
  try {
    const { salonId, serviceIds } = req.query;
    if (!salonId || !serviceIds) {
      return res.status(400).json({ success: false, message: 'salonId and serviceIds required.' });
    }

    const ids      = serviceIds.split(',');
    const services = await Service.find({ _id: { $in: ids }, salon: salonId, isAvailable: true });
    if (!services.length) return res.status(404).json({ success: false, message: 'No services found.' });

    const subtotal       = services.reduce((sum, s) => sum + s.price, 0);
    const prevCount      = await Booking.countDocuments({ user: req.user._id });
    const isFirstBooking = prevCount === 0;
    const pricing        = calculatePricing(subtotal, isFirstBooking);

    res.status(200).json({ success: true, data: { pricing, isFirstBooking } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createBooking, getMyBookings, getBookingById, cancelBooking, getSalonBookings, getPricingPreview };