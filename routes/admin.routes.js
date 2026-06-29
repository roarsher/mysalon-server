const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const {
  getDashboardStats,
  getAdminSalons, verifySalon,
  getAdminUsers, updateUserStatus, updateUserRole,
  getRevenue,
  getAdminBookings, flagBooking, refundOverride, updateBookingStatus,
} = require('../controllers/admin.controller');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// Dashboard
router.get('/stats',                    getDashboardStats);

// Salon verification
router.get('/salons',                   getAdminSalons);
router.patch('/salons/:id/verify',      verifySalon);

// User management
router.get('/users',                    getAdminUsers);
router.patch('/users/:id/status',       updateUserStatus);
router.patch('/users/:id/role',         updateUserRole);

// Revenue analytics
router.get('/revenue',                  getRevenue);

// Dispute / bookings
router.get('/bookings',                 getAdminBookings);
router.patch('/bookings/:id/flag',      flagBooking);
router.patch('/bookings/:id/refund-override', refundOverride);
router.patch('/bookings/:id/status',    updateBookingStatus);

module.exports = router;