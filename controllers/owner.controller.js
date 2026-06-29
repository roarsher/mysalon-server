const Booking = require('../models/Booking.model');
const Payment = require('../models/Payment.model');
const Salon   = require('../models/Salon.model');
const User    = require('../models/User.model');

// ── Helper: verify salon belongs to owner ─────────────────────────────────────
const verifySalonOwner = async (salonId, userId) => {
  const salon = await Salon.findOne({ _id: salonId, owner: userId, isActive: true });
  return salon;
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/owner/:salonId/revenue?period=daily|weekly|monthly&from=&to=
// Revenue reports — daily/weekly/monthly breakdown
// ══════════════════════════════════════════════════════════════════════════════
const getSalonRevenue = async (req, res) => {
  try {
    const salon = await verifySalonOwner(req.params.salonId, req.user._id);
    if (!salon) return res.status(403).json({ success: false, message: 'Salon not found or access denied.' });

    const { period = 'daily', from, to } = req.query;
    const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    const toDate   = to   ? new Date(to)   : new Date();

    const fmtMap = { daily: '%Y-%m-%d', weekly: '%Y-%U', monthly: '%Y-%m' };
    const fmt    = fmtMap[period] || '%Y-%m-%d';

    const [chart, summary, byService, byPaymentMethod] = await Promise.all([
      // Revenue grouped by period
      Booking.aggregate([
        { $match: { salon: salon._id, bookingStatus: 'completed', createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: {
          _id:          { $dateToString: { format: fmt, date: '$createdAt' } },
          revenue:      { $sum: '$totalAmount' },
          bookings:     { $sum: 1 },
          avgTicket:    { $avg: '$totalAmount' },
          platformFees: { $sum: '$pricing.platformFee' },
          gstAmount:    { $sum: '$pricing.gstAmount' },
        }},
        { $sort: { _id: 1 } },
      ]),

      // Overall summary
      Booking.aggregate([
        { $match: { salon: salon._id, bookingStatus: 'completed', createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: {
          _id:           null,
          totalRevenue:  { $sum: '$totalAmount' },
          totalBookings: { $sum: 1 },
          avgTicket:     { $avg: '$totalAmount' },
          totalGst:      { $sum: '$pricing.gstAmount' },
          totalFees:     { $sum: '$pricing.platformFee' },
          totalDiscount: { $sum: '$pricing.discountAmount' },
        }},
      ]),

      // Revenue by service
      Booking.aggregate([
        { $match: { salon: salon._id, bookingStatus: 'completed', createdAt: { $gte: fromDate, $lte: toDate } } },
        { $unwind: '$services' },
        { $group: {
          _id:     '$services.name',
          revenue: { $sum: '$services.price' },
          count:   { $sum: 1 },
        }},
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),

      // Revenue by payment method
      Booking.aggregate([
        { $match: { salon: salon._id, bookingStatus: 'completed', createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: {
          _id:     '$paymentMethod',
          revenue: { $sum: '$totalAmount' },
          count:   { $sum: 1 },
        }},
      ]),
    ]);

    const s = summary[0] || { totalRevenue: 0, totalBookings: 0, avgTicket: 0, totalGst: 0, totalFees: 0, totalDiscount: 0 };

    res.status(200).json({
      success: true,
      data: { period, fromDate, toDate, chart, summary: s, byService, byPaymentMethod },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/owner/:salonId/customers?page=&search=&type=returning|new
// Customer history — returning vs new, spend per customer
// ══════════════════════════════════════════════════════════════════════════════
const getSalonCustomers = async (req, res) => {
  try {
    const salon = await verifySalonOwner(req.params.salonId, req.user._id);
    if (!salon) return res.status(403).json({ success: false, message: 'Salon not found or access denied.' });

    const { page = 1, limit = 20, search, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Aggregate all customers who have booked this salon
    const pipeline = [
      { $match: { salon: salon._id, bookingStatus: { $in: ['completed', 'confirmed', 'cancelled'] } } },
      { $group: {
        _id:           '$user',
        totalVisits:   { $sum: { $cond: [{ $eq: ['$bookingStatus', 'completed'] }, 1, 0] } },
        totalSpend:    { $sum: { $cond: [{ $eq: ['$bookingStatus', 'completed'] }, '$totalAmount', 0] } },
        totalBookings: { $sum: 1 },
        lastVisit:     { $max: '$createdAt' },
        firstVisit:    { $min: '$createdAt' },
        cancelCount:   { $sum: { $cond: [{ $eq: ['$bookingStatus', 'cancelled'] }, 1, 0] } },
        avgSpend:      { $avg: { $cond: [{ $eq: ['$bookingStatus', 'completed'] }, '$totalAmount', null] } },
      }},
      // returning = more than 1 completed visit
      ...(type === 'returning' ? [{ $match: { totalVisits: { $gt: 1 } } }] : []),
      ...(type === 'new'       ? [{ $match: { totalVisits: { $lte: 1 } } }] : []),
      { $sort: { totalSpend: -1 } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: {
        'user.name': 1, 'user.email': 1, 'user.phone': 1, 'user.photoURL': 1,
        totalVisits: 1, totalSpend: 1, totalBookings: 1,
        lastVisit: 1, firstVisit: 1, cancelCount: 1, avgSpend: 1,
      }},
    ];

    // Apply search filter after lookup
    if (search) {
      pipeline.push({ $match: { $or: [
        { 'user.name':  { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } },
        { 'user.phone': { $regex: search, $options: 'i' } },
      ]}});
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    pipeline.push({ $skip: skip }, { $limit: Number(limit) });

    const [customers, countResult] = await Promise.all([
      Booking.aggregate(pipeline),
      Booking.aggregate(countPipeline),
    ]);

    // Summary stats
    const stats = await Booking.aggregate([
      { $match: { salon: salon._id, bookingStatus: 'completed' } },
      { $group: { _id: '$user' } },
      { $count: 'uniqueCustomers' },
    ]);

    const returningCount = await Booking.aggregate([
      { $match: { salon: salon._id, bookingStatus: 'completed' } },
      { $group: { _id: '$user', visits: { $sum: 1 } } },
      { $match: { visits: { $gt: 1 } } },
      { $count: 'count' },
    ]);

    res.status(200).json({
      success: true,
      total: countResult[0]?.total || 0,
      stats: {
        uniqueCustomers: stats[0]?.uniqueCustomers || 0,
        returningCustomers: returningCount[0]?.count || 0,
      },
      data: customers,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/owner/:salonId/customers/:userId/history
// Full booking history for one customer at this salon
// ══════════════════════════════════════════════════════════════════════════════
const getCustomerHistory = async (req, res) => {
  try {
    const salon = await verifySalonOwner(req.params.salonId, req.user._id);
    if (!salon) return res.status(403).json({ success: false, message: 'Access denied.' });

    const bookings = await Booking.find({ salon: salon._id, user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('user', 'name email phone photoURL');

    const user = bookings[0]?.user || await User.findById(req.params.userId).select('name email phone photoURL');

    res.status(200).json({ success: true, data: { user, bookings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSalonRevenue, getSalonCustomers, getCustomerHistory };