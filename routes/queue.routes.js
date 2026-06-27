const router = require('express').Router();
const {
  getQueueBySalon,
  getUserQueuePosition,
  serveNext,
  completeCurrentBooking,
  toggleQueuePause,
  ownerCancelBooking,
} = require('../controllers/queue.controller');

const { protect, ownerOrAdmin, salonOwnershipCheck } = require('../middleware/auth.middleware');

// ── Public / Customer routes ──────────────────────────────────────────────────

// GET /api/queue/salon/:salonId            → live queue count for salon detail page
router.get('/salon/:salonId', getQueueBySalon);

// GET /api/queue/position/:bookingId       → user's live position (polled every 15s)
router.get('/position/:bookingId', protect, getUserQueuePosition);

// ── Owner routes ──────────────────────────────────────────────────────────────

// POST /api/queue/serve/:salonId           → call next customer
router.post('/serve/:salonId', protect, ownerOrAdmin, salonOwnershipCheck, serveNext);

// POST /api/queue/complete/:salonId        → mark current as done (without calling next)
router.post('/complete/:salonId', protect, ownerOrAdmin, salonOwnershipCheck, completeCurrentBooking);

// PATCH /api/queue/pause/:salonId          → pause/unpause queue
// body: { isPaused: true, reason: "Lunch break" }
router.patch('/pause/:salonId', protect, ownerOrAdmin, salonOwnershipCheck, toggleQueuePause);

// PATCH /api/queue/cancel-booking/:bookingId → owner cancels a specific booking
router.patch('/cancel-booking/:bookingId', protect, ownerOrAdmin, ownerCancelBooking);

module.exports = router;
