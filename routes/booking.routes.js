 
const router = require('express').Router();
const {
  createBooking, getMyBookings, getBookingById,
  cancelBooking, getSalonBookings, getPricingPreview,
} = require('../controllers/booking.controller');
const { protect, ownerOrAdmin, salonOwnershipCheck } = require('../middleware/auth.middleware');

// Pricing preview (before booking)
router.get('/pricing-preview',          protect, getPricingPreview);

// Customer
router.post('/',                         protect, createBooking);
router.get('/my',                         protect, getMyBookings);
router.get('/:id',                        protect, getBookingById);
router.patch('/:id/cancel',               protect, cancelBooking);

// Owner
router.get('/salon/:salonId',             protect, ownerOrAdmin, salonOwnershipCheck, getSalonBookings);

module.exports = router;
 