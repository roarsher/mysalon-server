//  const Review  = require('../models/Review.model');
// const Booking = require('../models/Booking.model');

// /**
//  * @desc    Submit a review after a completed booking
//  * @route   POST /api/reviews
//  * @access  Private
//  * @body    { bookingId, salonId, rating, comment }
//  */
// const createReview = async (req, res) => {
//   try {
//     const { bookingId, salonId, rating, comment } = req.body;

//     // Verify the booking exists, belongs to this user, and is completed
//     const booking = await Booking.findOne({
//       _id:           bookingId,
//       user:          req.user._id,
//       salon:         salonId,
//       bookingStatus: 'completed',   // ← fixed: was 'status', model uses 'bookingStatus'
//     });

//     if (!booking) {
//       return res.status(400).json({
//         success: false,
//         message: 'You can only review salons after your booking is completed.',
//       });
//     }

//     // Check if already reviewed
//     const existing = await Review.findOne({ booking: bookingId });
//     if (existing) {
//       return res.status(400).json({ success: false, message: 'You have already reviewed this booking.' });
//     }

//     const review = await Review.create({
//       user:    req.user._id,
//       salon:   salonId,
//       booking: bookingId,
//       rating,
//       comment: comment?.trim() || '',
//     });

//     await review.populate('user', 'name photoURL');

//     res.status(201).json({ success: true, data: review });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// /**
//  * @desc    Get all reviews for a salon
//  * @route   GET /api/reviews/salon/:salonId
//  * @access  Public
//  */
// const getSalonReviews = async (req, res) => {
//   try {
//     const { page = 1, limit = 10 } = req.query;
//     const skip  = (Number(page) - 1) * Number(limit);
//     const total = await Review.countDocuments({ salon: req.params.salonId, isVisible: true });

//     const reviews = await Review.find({ salon: req.params.salonId, isVisible: true })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(Number(limit))
//       .populate('user', 'name photoURL');

//     res.status(200).json({ success: true, total, data: reviews });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// /**
//  * @desc    Owner replies to a review
//  * @route   PATCH /api/reviews/:id/reply
//  * @access  Private (salon_owner or admin)
//  * @body    { text }
//  */
// const replyToReview = async (req, res) => {
//   try {
//     const review = await Review.findByIdAndUpdate(
//       req.params.id,
//       { ownerReply: { text: req.body.text.trim(), repliedAt: new Date() } },
//       { new: true }
//     ).populate('user', 'name photoURL');

//     if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

//     res.status(200).json({ success: true, data: review });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// module.exports = { createReview, getSalonReviews, replyToReview };



const Review     = require('../models/Review.model');
const Booking    = require('../models/Booking.model');
 const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');



 

/**
 * @desc    Submit a review after a completed booking (with optional photos)
 * @route   POST /api/reviews          (multipart/form-data)
 * @access  Private
 * @body    bookingId, salonId, rating, comment   (+ up to 3 image files as "photos")
 */
const createReview = async (req, res) => {
  try {
    const { bookingId, salonId, rating, comment } = req.body;

    const booking = await Booking.findOne({
      _id:           bookingId,
      user:          req.user._id,
      salon:         salonId,
      bookingStatus: 'completed',
    });

    if (!booking) {
      return res.status(400).json({
        success: false,
        message: 'You can only review salons after your booking is completed.',
      });
    }

    const existing = await Review.findOne({ booking: bookingId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this booking.' });
    }

    // ── Upload photos if provided ─────────────────────────────────────────
    let photos = [];
    if (req.files && req.files.length > 0) {
      const uploads = await Promise.all(
        req.files.slice(0, 3).map((file) => uploadToCloudinary(file.buffer, 'reviews'))
      );
      photos = uploads.map((u) => ({ url: u.url, publicId: u.public_id || '' }));
    }
    const uploads = await Promise.all(
  req.files.slice(0, 3).map((file) =>
    uploadToCloudinary(file.buffer, 'mysalon/reviews')
  )
);
console.log('Cloudinary uploads:', uploads); // ← add this
photos = uploads.map((u) => ({ url: u.url, publicId: u.public_id || '' }));
    const review = await Review.create({
      user:    req.user._id,
      salon:   salonId,
      booking: bookingId,
      rating:  Number(rating),
      comment: comment?.trim() || '',
      photos,
    });

    await review.populate('user', 'name photoURL');

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get all reviews for a salon
 * @route   GET /api/reviews/salon/:salonId
 * @access  Public
 */
const getSalonReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Review.countDocuments({ salon: req.params.salonId, isVisible: true });

    const reviews = await Review.find({ salon: req.params.salonId, isVisible: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name photoURL');

    res.status(200).json({ success: true, total, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Owner replies to a review
 * @route   PATCH /api/reviews/:id/reply
 * @access  Private (salon_owner or admin)
 */
const replyToReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { ownerReply: { text: req.body.text.trim(), repliedAt: new Date() } },
      { new: true }
    ).populate('user', 'name photoURL');

    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

    res.status(200).json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createReview, getSalonReviews, replyToReview };