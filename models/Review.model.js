// const mongoose = require('mongoose');

// /**
//  * Review Model
//  *
//  * After a booking is completed, users can leave a rating (1–5) and a comment.
//  * The salon's overall rating in Salon.model.js is the average of all reviews.
//  * One user can only review a salon once per completed booking.
//  */
// const reviewSchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: [true, 'Review must have a user'],
//     },
//     salon: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Salon',
//       required: [true, 'Review must belong to a salon'],
//     },
//     booking: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Booking',
//       required: [true, 'Review must be linked to a booking'],
//       unique: true,   // one review per booking
//     },
//     rating: {
//       type: Number,
//       required: [true, 'Rating is required'],
//       min: [1, 'Rating must be at least 1'],
//       max: [5, 'Rating cannot exceed 5'],
//     },
//     comment: {
//       type: String,
//       default: '',
//       maxlength: [500, 'Comment cannot exceed 500 characters'],
//       trim: true,
//     },
//     // Owner can reply to the review
//     ownerReply: {
//       text:      { type: String, default: '', maxlength: 500 },
//       repliedAt: { type: Date,   default: null },
//     },
//     isVisible: {
//       type: Boolean,
//       default: true,   // admin can hide inappropriate reviews
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// // ─── Indexes ──────────────────────────────────────────────────────────────────
// reviewSchema.index({ salon: 1, createdAt: -1 });
// reviewSchema.index({ user:  1, salon: 1 });
// //reviewSchema.index({ booking: 1 }, { unique: true });

// // ─── Post-save: update salon's average rating ─────────────────────────────────
// reviewSchema.post('save', async function () {
//   const Salon = mongoose.model('Salon');
//   const stats = await mongoose.model('Review').aggregate([
//     { $match: { salon: this.salon, isVisible: true } },
//     {
//       $group: {
//         _id:          '$salon',
//         avgRating:    { $avg: '$rating' },
//         totalReviews: { $sum: 1 },
//       },
//     },
//   ]);

//   if (stats.length > 0) {
//     await Salon.findByIdAndUpdate(this.salon, {
//       rating:       Math.round(stats[0].avgRating * 10) / 10, // round to 1 decimal
//       totalReviews: stats[0].totalReviews,
//     });
//   }
// });

// module.exports = mongoose.model('Review', reviewSchema);


const mongoose = require('mongoose');

/**
 * Review Model
 *
 * After a booking is completed, users can leave a rating (1–5) and a comment.
 * The salon's overall rating in Salon.model.js is the average of all reviews.
 * One user can only review a salon once per completed booking.
 */
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must have a user'],
    },
    salon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Salon',
      required: [true, 'Review must belong to a salon'],
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Review must be linked to a booking'],
      unique: true,   // one review per booking
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      default: '',
      maxlength: [500, 'Comment cannot exceed 500 characters'],
      trim: true,
    },

    // ── Customer photos (optional, up to 3) ──────────────────────────────
    photos: [
      {
        url:       { type: String, required: true },
        publicId:  { type: String, default: '' },   // Cloudinary public_id for deletion
        _id: false,
      },
    ],

    // Owner can reply to the review
    ownerReply: {
      text:      { type: String, default: '', maxlength: 500 },
      repliedAt: { type: Date,   default: null },
    },
    isVisible: {
      type: Boolean,
      default: true,   // admin can hide inappropriate reviews
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
reviewSchema.index({ salon: 1, createdAt: -1 });
reviewSchema.index({ user:  1, salon: 1 });

// ─── Post-save: update salon's average rating ─────────────────────────────────
reviewSchema.post('save', async function () {
  const Salon = mongoose.model('Salon');
  const stats = await mongoose.model('Review').aggregate([
    { $match: { salon: this.salon, isVisible: true } },
    {
      $group: {
        _id:          '$salon',
        avgRating:    { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Salon.findByIdAndUpdate(this.salon, {
      rating:       Math.round(stats[0].avgRating * 10) / 10,
      totalReviews: stats[0].totalReviews,
    });
  }
});

module.exports = mongoose.model('Review', reviewSchema);