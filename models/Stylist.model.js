const mongoose = require('mongoose');

const stylistSchema = new mongoose.Schema({
  salon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salon',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Stylist name is required'],
    trim: true,
    maxlength: [60, 'Name cannot exceed 60 characters'],
  },
  photo: {
    url:       { type: String, default: '' },
    public_id: { type: String, default: '' },
  },
  speciality: {
    type: [String],
    default: [],   // e.g. ['Haircut', 'Bridal', 'Colour']
  },
  experience: {
    type: Number,
    default: 0,    // years of experience
    min: 0,
    max: 50,
  },
  bio: {
    type: String,
    default: '',
    maxlength: [300, 'Bio cannot exceed 300 characters'],
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Order in which stylist appears on the salon page
  displayOrder: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

stylistSchema.index({ salon: 1, isActive: 1 });
stylistSchema.index({ salon: 1, displayOrder: 1 });

module.exports = mongoose.model('Stylist', stylistSchema);