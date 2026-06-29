const User    = require('../models/User.model');
const Salon   = require('../models/Salon.model');
const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');

// ══════════════════════════════════════════════════════════════════════════════
// ① DASHBOARD STATS
// GET /api/admin/stats
// ══════════════════════════════════════════════════════════════════════════════
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers, totalSalons, pendingSalons,
      totalBookings, completedBookings, cancelledBookings,
      revenueData,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      Salon.countDocuments({ isActive: true }),
      Salon.countDocuments({ isVerified: false, isActive: true }),
      Booking.countDocuments(),
      Booking.countDocuments({ bookingStatus: 'completed' }),
      Booking.countDocuments({ bookingStatus: 'cancelled' }),
      Booking.aggregate([
        { $match: { bookingStatus: 'completed' } },
        { $group: {
          _id: null,
          gmv:          { $sum: '$totalAmount' },
          platformFees: { $sum: '$pricing.platformFee' },
          gstCollected: { $sum: '$pricing.gstAmount' },
        }},
      ]),
    ]);

    const revenue = revenueData[0] || { gmv: 0, platformFees: 0, gstCollected: 0 };

    // Last 7 days bookings trend
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const trend = await Booking.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count:   { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
      }},
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        users:    { total: totalUsers },
        salons:   { total: totalSalons, pending: pendingSalons },
        bookings: { total: totalBookings, completed: completedBookings, cancelled: cancelledBookings },
        revenue:  { gmv: revenue.gmv, platformFees: revenue.platformFees, gstCollected: revenue.gstCollected },
        trend,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ② SALON VERIFICATION
// GET    /api/admin/salons?status=pending|verified|all
// PATCH  /api/admin/salons/:id/verify    { action: 'approve'|'reject', reason }
// ══════════════════════════════════════════════════════════════════════════════
const getAdminSalons = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20, search } = req.query;
    const filter = { isActive: true };
    if (status === 'pending')  filter.isVerified = false;
    if (status === 'verified') filter.isVerified = true;
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } },
    ];

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Salon.countDocuments(filter);
    const salons = await Salon.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
      .populate('owner', 'name email phone createdAt')
      .select('name category address coverImage isVerified isOpen rating totalReviews createdAt owner verificationReason');

    res.status(200).json({ success: true, total, data: salons });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const verifySalon = async (req, res) => {
  try {
    const { action, reason } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approve or reject.' });
    }

    const update = action === 'approve'
      ? { isVerified: true,  verificationReason: '', rejectedAt: null }
      : { isVerified: false, verificationReason: reason || 'Does not meet our standards.', rejectedAt: new Date() };

    const salon = await Salon.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('owner', 'name email');

    if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });

    res.status(200).json({
      success: true,
      message: action === 'approve' ? `${salon.name} approved and live.` : `${salon.name} rejected.`,
      data: salon,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ③ USER MANAGEMENT
// GET   /api/admin/users?role=&search=&page=
// PATCH /api/admin/users/:id/status   { action: 'block'|'unblock' }
// PATCH /api/admin/users/:id/role     { role: 'user'|'salon_owner'|'admin' }
// ══════════════════════════════════════════════════════════════════════════════
const getAdminUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const filter = { _id: { $ne: req.user._id } }; // exclude self
    if (role)   filter.role = role;
    if (search) filter.$or  = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
      .select('name email phone photoURL role isActive isEmailVerified isGoogleUser createdAt');

    res.status(200).json({ success: true, total, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { action } = req.body;
    if (!['block', 'unblock'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be block or unblock.' });
    }
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot block yourself.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: action === 'unblock' },
      { new: true }
    ).select('name email role isActive');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.status(200).json({ success: true, message: `User ${action}ed.`, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'salon_owner', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
      .select('name email role isActive');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.status(200).json({ success: true, message: `Role updated to ${role}.`, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ④ REVENUE ANALYTICS
// GET /api/admin/revenue?period=daily|weekly|monthly&from=&to=
// ══════════════════════════════════════════════════════════════════════════════
const getRevenue = async (req, res) => {
  try {
    const { period = 'daily', from, to } = req.query;

    const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    const toDate   = to   ? new Date(to)   : new Date();

    const formatMap = { daily: '%Y-%m-%d', weekly: '%Y-%U', monthly: '%Y-%m' };
    const fmt = formatMap[period] || '%Y-%m-%d';

    const [bookingRevenue, paymentRevenue, topSalons, topServices] = await Promise.all([
      // Revenue from completed bookings grouped by period
      Booking.aggregate([
        { $match: { bookingStatus: 'completed', createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: {
          _id:          { $dateToString: { format: fmt, date: '$createdAt' } },
          gmv:          { $sum: '$totalAmount' },
          platformFees: { $sum: '$pricing.platformFee' },
          gstAmount:    { $sum: '$pricing.gstAmount' },
          count:        { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),

      // Online payment totals
      Payment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: {
          _id:    null,
          total:  { $sum: '$amount' },
          count:  { $sum: 1 },
          refunded: { $sum: '$refundAmount' },
        }},
      ]),

      // Top earning salons
      Booking.aggregate([
        { $match: { bookingStatus: 'completed', createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: '$salon', revenue: { $sum: '$totalAmount' }, bookings: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'salons', localField: '_id', foreignField: '_id', as: 'salon' } },
        { $unwind: '$salon' },
        { $project: { 'salon.name': 1, 'salon.address.city': 1, revenue: 1, bookings: 1 } },
      ]),

      // Top services by booking count
      Booking.aggregate([
        { $match: { bookingStatus: 'completed', createdAt: { $gte: fromDate, $lte: toDate } } },
        { $unwind: '$services' },
        { $group: { _id: '$services.name', count: { $sum: 1 }, revenue: { $sum: '$services.price' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const payments = paymentRevenue[0] || { total: 0, count: 0, refunded: 0 };

    res.status(200).json({
      success: true,
      data: {
        period,
        fromDate,
        toDate,
        chart:       bookingRevenue,
        payments,
        topSalons,
        topServices,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ⑤ DISPUTE RESOLUTION
// GET   /api/admin/disputes           — flagged bookings
// GET   /api/admin/bookings?search=   — all bookings search
// PATCH /api/admin/bookings/:id/flag  { reason }
// PATCH /api/admin/bookings/:id/refund-override { amount, reason }
// PATCH /api/admin/bookings/:id/status { bookingStatus }
// ══════════════════════════════════════════════════════════════════════════════
const getAdminBookings = async (req, res) => {
  try {
    const { status, search, flagged, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)           filter.bookingStatus = status;
    if (flagged === 'true') filter.isFlagged   = true;
    if (search) {
      const users = await User.find({ $or: [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]}).select('_id');
      filter.$or = [
        { tokenNumber: { $regex: search, $options: 'i' } },
        { user: { $in: users.map(u => u._id) } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
      .populate('user',  'name email phone')
      .populate('salon', 'name address.city');

    res.status(200).json({ success: true, total, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const flagBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { isFlagged: true, flagReason: req.body.reason || 'Flagged by admin', flaggedAt: new Date(), flaggedBy: req.user._id },
      { new: true }
    ).populate('user', 'name email').populate('salon', 'name');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    res.status(200).json({ success: true, message: 'Booking flagged.', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const refundOverride = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const booking = await Booking.findById(req.params.id).populate('salon', 'name');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // Update payment record
    await Payment.findOneAndUpdate(
      { booking: req.params.id },
      {
        refundAmount: amount,
        refundReason: reason || 'Admin override refund',
        refundStatus: 'admin_override',
        refundedAt:   new Date(),
        status:       'refunded',
      }
    );

    await Booking.findByIdAndUpdate(req.params.id, {
      paymentStatus: 'refunded',
      isFlagged:     false,
      adminNote:     `Refund override: ₹${amount} — ${reason}`,
    });

    res.status(200).json({ success: true, message: `Refund of ₹${amount} override recorded.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { bookingStatus } = req.body;
    const valid = ['pending','confirmed','in_progress','completed','cancelled','no_show'];
    if (!valid.includes(bookingStatus)) return res.status(400).json({ success: false, message: 'Invalid status.' });

    const booking = await Booking.findByIdAndUpdate(
      req.params.id, { bookingStatus }, { new: true }
    ).populate('user', 'name email').populate('salon', 'name');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    res.status(200).json({ success: true, message: `Booking status updated to ${bookingStatus}.`, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getDashboardStats, getAdminSalons, verifySalon,
  getAdminUsers, updateUserStatus, updateUserRole,
  getRevenue, getAdminBookings, flagBooking, refundOverride, updateBookingStatus,
};