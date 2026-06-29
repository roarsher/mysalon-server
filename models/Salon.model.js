const mongoose = require('mongoose');

/**
 * Salon Model
 *
 * This is the core model — like a "Restaurant" in Zomato.
 * When a salon owner signs up and registers their salon:
 *   - They upload a cover photo + gallery images (stored via Cloudinary)
 *   - They add all services they provide (haircut, facial, etc.)
 *   - Their salon appears on the home page with name, images, and services listed
 *
 * Image storage strategy:
 *   - We use Cloudinary for actual image hosting
 *   - Only the Cloudinary URL and public_id are stored in MongoDB
 *   - multer (middleware) handles the file upload buffer
 *   - cloudinary.uploader.upload() converts buffer → hosted URL
 */

// ─── Working Hours Sub-schema ────────────────────────────────────────────────
const workingHoursSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
    },
    isOpen: { type: Boolean, default: true },
    openTime: { type: String, default: '09:00' },  // "HH:MM" 24hr format
    closeTime: { type: String, default: '21:00' },
  },
  { _id: false }
);

// ─── Image Sub-schema ─────────────────────────────────────────────────────────
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },           // Cloudinary HTTPS URL
    public_id: { type: String, required: true },     // Cloudinary public_id (needed to delete)
    altText: { type: String, default: '' },
  },
  { _id: false }
);

// ─── Main Salon Schema ────────────────────────────────────────────────────────
const salonSchema = new mongoose.Schema(
  {
    // Owner reference — the salon_owner User who registered this salon
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Salon must have an owner'],
    },

    // ── Basic Info (shown on listing card like Zomato) ──────────────────────
    name: {
      type: String,
      required: [true, 'Salon name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
      trim: true,
    },
    category: {
      type: String,
      enum: {
        values: ["men's", "women's", "unisex", "bridal", "spa", "kids"],
        message: 'Invalid salon category',
      },
      required: [true, 'Category is required'],
    },
    // Tags shown as chips on the salon card (e.g. Haircut, Facial, Bridal)
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'Maximum 10 tags allowed',
      },
    },

    // ── Images (uploaded by salon owner during registration) ─────────────────
    // Cover photo — the main image shown on the listing card (like Zomato's restaurant photo)
    coverImage: {
      type: imageSchema,
      default: null,
    },
    // Gallery photos — shown in the salon detail page slideshow
    gallery: {
      type: [imageSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'Maximum 10 gallery images allowed',
      },
    },

    // ── Contact & Location ────────────────────────────────────────────────────
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    address: {
      street: { type: String, default: '', trim: true },
      area:   { type: String, default: '', trim: true },   // locality / neighbourhood
      city:   { type: String, default: '', trim: true },
      state:  { type: String, default: '', trim: true },
      pincode:{ type: String, default: '', trim: true },
    },
    // GeoJSON point for location-based queries ("salons near me")
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],  // [longitude, latitude] — GeoJSON order
        default: [0, 0],
        validate: {
          validator: ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
          message: 'Invalid coordinates',
        },
      },
    },

    // ── Services reference ────────────────────────────────────────────────────
    // Services are stored in a separate Service collection for flexibility
    // but referenced here so we can populate them in one query
    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],

    // ── Business Hours ────────────────────────────────────────────────────────
    workingHours: {
      type: [workingHoursSchema],
      default: () => [
        { day: 'monday',    isOpen: true,  openTime: '09:00', closeTime: '21:00' },
        { day: 'tuesday',   isOpen: true,  openTime: '09:00', closeTime: '21:00' },
        { day: 'wednesday', isOpen: true,  openTime: '09:00', closeTime: '21:00' },
        { day: 'thursday',  isOpen: true,  openTime: '09:00', closeTime: '21:00' },
        { day: 'friday',    isOpen: true,  openTime: '09:00', closeTime: '21:00' },
        { day: 'saturday',  isOpen: true,  openTime: '09:00', closeTime: '21:00' },
        { day: 'sunday',    isOpen: false, openTime: '10:00', closeTime: '18:00' },
      ],
    },

    // ── Rating & Reviews ──────────────────────────────────────────────────────
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot exceed 5'],
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },

    // ── Status ────────────────────────────────────────────────────────────────
    isOpen: {
      type: Boolean,
      default: true,    // manually toggled by owner (e.g. holiday closures)
    },
    isVerified: {
      type: Boolean,
      default: false,   // admin verifies the salon before it goes live
    },
    isActive: {
      type: Boolean,
      default: true,    // soft delete flag
    },
    // ── Admin verification ────────────────────────────────────────────────────────
verificationReason: { type: String, default: '' },
rejectedAt:         { type: Date,   default: null },
    // ── Pricing range (for listing card display) ──────────────────────────────
    priceRangeMin: { type: Number, default: 0 },
    priceRangeMax: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
salonSchema.index({ location: '2dsphere' });   // for geospatial near-me queries
salonSchema.index({ owner: 1 });
salonSchema.index({ category: 1 });
salonSchema.index({ isActive: 1, isVerified: 1 });
salonSchema.index({ name: 'text', description: 'text', tags: 'text' }); // full-text search

// ─── Virtual: currently open based on time ───────────────────────────────────
salonSchema.virtual('isCurrentlyOpen').get(function () {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const now  = new Date();
  const day  = days[now.getDay()];
  const hours = this.workingHours?.find((h) => h.day === day);
  if (!hours || !hours.isOpen || !this.isOpen) return false;

  const [openH, openM]   = hours.openTime.split(':').map(Number);
  const [closeH, closeM] = hours.closeTime.split(':').map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes  = openH  * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
});

// ─── Method: update price range from services ─────────────────────────────────
salonSchema.methods.updatePriceRange = async function () {
  const Service = mongoose.model('Service');
  const services = await Service.find({ salon: this._id, isAvailable: true });
  if (services.length === 0) return;
  const prices = services.map((s) => s.price);
  this.priceRangeMin = Math.min(...prices);
  this.priceRangeMax = Math.max(...prices);
  await this.save();
};

module.exports = mongoose.model('Salon', salonSchema);