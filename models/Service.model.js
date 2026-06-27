const mongoose = require('mongoose');

/**
 * Service Model
 *
 * Think of this exactly like a food item on a Zomato restaurant menu.
 * Each salon has many services. When a user opens a salon's page,
 * all services are fetched and displayed grouped by category —
 * just like how Zomato shows "Starters", "Main Course", "Desserts".
 *
 * Example categories for a salon:
 *   Hair     → Haircut (Men), Hair Colour, Keratin Treatment
 *   Skin     → Facial, Cleanup, Bleach
 *   Beard    → Beard Trim, Hot Towel Shave
 *   Nail     → Manicure, Pedicure
 *   Bridal   → Bridal Makeup, Pre-Bridal Package
 *
 * Each service has:
 *   - name, description, category   (for display)
 *   - price, duration               (for booking)
 *   - image                         (optional — shown on the service card)
 *   - isAvailable                   (owner can toggle off temporarily)
 */

// ─── Service Image Sub-schema ─────────────────────────────────────────────────
const serviceImageSchema = new mongoose.Schema(
  {
    url:       { type: String, required: true },   // Cloudinary URL
    public_id: { type: String, required: true },   // Cloudinary public_id
  },
  { _id: false }
);

// ─── Main Service Schema ──────────────────────────────────────────────────────
const serviceSchema = new mongoose.Schema(
  {
    // Which salon this service belongs to
    salon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Salon',
      required: [true, 'Service must belong to a salon'],
    },

    // ── Display Info (shown on salon page like a menu item) ──────────────────
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [300, 'Description cannot exceed 300 characters'],
      trim: true,
    },
    // Category groups services on the UI (like menu sections in Zomato)
    category: {
      type: String,
      required: [true, 'Service category is required'],
      trim: true,
      enum: {
        values: [
          'hair',
          'skin',
          'beard',
          'nail',
          'bridal',
          'spa',
          'makeup',
          'threading',
          'waxing',
          'massage',
          'other',
        ],
        message: 'Invalid service category',
      },
    },
    // Optional image for the service (like food photos on Zomato)
    image: {
      type: serviceImageSchema,
      default: null,
    },

    // ── Pricing & Duration ────────────────────────────────────────────────────
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    // Duration in minutes — used to calculate queue wait times
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [5,   'Duration must be at least 5 minutes'],
      max: [480, 'Duration cannot exceed 8 hours'],
    },

    // ── Availability ──────────────────────────────────────────────────────────
    // Owner can toggle individual services off without deleting them
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // Some services need an advance appointment (not walk-in)
    requiresAppointment: {
      type: Boolean,
      default: false,
    },

    // ── Ordering on the UI ────────────────────────────────────────────────────
    // Controls which services appear first within a category
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
serviceSchema.index({ salon: 1, category: 1 });
serviceSchema.index({ salon: 1, isAvailable: 1 });
serviceSchema.index({ salon: 1, displayOrder: 1 });

// ─── Virtual: formatted duration string ──────────────────────────────────────
serviceSchema.virtual('durationFormatted').get(function () {
  if (this.duration < 60) return `${this.duration} min`;
  const hrs  = Math.floor(this.duration / 60);
  const mins = this.duration % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
});

// ─── Virtual: formatted price string ─────────────────────────────────────────
serviceSchema.virtual('priceFormatted').get(function () {
  return `₹${this.price.toLocaleString('en-IN')}`;
});

module.exports = mongoose.model('Service', serviceSchema);