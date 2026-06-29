 const router = require('express').Router();
const { getSlots, getAvailableDates } = require('../controllers/slot.controller');
const { protect } = require('../middleware/auth.middleware');

// GET /api/slots/:salonId?date=YYYY-MM-DD&stylistId=xxx  — get slots for a date
router.get('/:salonId', getSlots);

// GET /api/slots/:salonId/dates?month=YYYY-MM  — get open dates in a month
router.get('/:salonId/dates', getAvailableDates);

module.exports = router;