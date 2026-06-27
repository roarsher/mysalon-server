 
const router = require('express').Router();
const { createReview, getSalonReviews, replyToReview } = require('../controllers/review.controller');
const { protect, ownerOrAdmin } = require('../middleware/auth.middleware');

// POST /api/reviews                     → submit a review after completed booking
 

// GET  /api/reviews/salon/:salonId      → get all reviews for a salon (public)
router.get('/salon/:salonId', getSalonReviews);

// PATCH /api/reviews/:id/reply          → owner replies to a review
router.patch('/:id/reply', protect, ownerOrAdmin, replyToReview);
const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage() });

router.post('/', protect, upload.array('photos', 3), createReview);

module.exports = router;