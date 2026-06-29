const Stylist  = require('../models/Stylist.model');
const Salon    = require('../models/Salon.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// ── GET /api/salons/:salonId/stylists  (public) ───────────────────────────────
const getStylistsBySalon = async (req, res) => {
  try {
    const stylists = await Stylist.find({
      salon:    req.params.salonId,
      isActive: true,
    }).sort({ displayOrder: 1, createdAt: 1 });

    res.status(200).json({ success: true, data: stylists });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/salons/:salonId/stylists  (owner) ───────────────────────────────
const createStylist = async (req, res) => {
  try {
    const { name, speciality, experience, bio, displayOrder } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Stylist name is required.' });

    // Upload photo if provided
    let photo = { url: '', public_id: '' };
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, `mysalon/stylists/${req.params.salonId}`);
      photo = { url: result.url, public_id: result.public_id };
    }

    const stylist = await Stylist.create({
      salon:        req.params.salonId,
      name:         name.trim(),
      photo,
      speciality:   speciality ? (Array.isArray(speciality) ? speciality : speciality.split(',').map(s => s.trim()).filter(Boolean)) : [],
      experience:   Number(experience) || 0,
      bio:          bio?.trim() || '',
      displayOrder: Number(displayOrder) || 0,
    });

    res.status(201).json({ success: true, data: stylist });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── PUT /api/salons/:salonId/stylists/:id  (owner) ────────────────────────────
const updateStylist = async (req, res) => {
  try {
    const stylist = await Stylist.findOne({ _id: req.params.id, salon: req.params.salonId });
    if (!stylist) return res.status(404).json({ success: false, message: 'Stylist not found.' });

    const { name, speciality, experience, bio, displayOrder, isActive } = req.body;

    if (name)         stylist.name         = name.trim();
    if (bio !== undefined) stylist.bio     = bio.trim();
    if (experience !== undefined) stylist.experience = Number(experience) || 0;
    if (displayOrder !== undefined) stylist.displayOrder = Number(displayOrder) || 0;
    if (isActive !== undefined) stylist.isActive = isActive === 'true' || isActive === true;
    if (speciality)   stylist.speciality   = Array.isArray(speciality)
      ? speciality
      : speciality.split(',').map(s => s.trim()).filter(Boolean);

    // Replace photo if new file uploaded
    if (req.file) {
      if (stylist.photo?.public_id) await deleteFromCloudinary(stylist.photo.public_id);
      const result = await uploadToCloudinary(req.file.buffer, `mysalon/stylists/${req.params.salonId}`);
      stylist.photo = { url: result.url, public_id: result.public_id };
    }

    await stylist.save();
    res.status(200).json({ success: true, data: stylist });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/salons/:salonId/stylists/:id/toggle  (owner) ──────────────────
const toggleStylist = async (req, res) => {
  try {
    const stylist = await Stylist.findOne({ _id: req.params.id, salon: req.params.salonId });
    if (!stylist) return res.status(404).json({ success: false, message: 'Stylist not found.' });

    stylist.isActive = !stylist.isActive;
    await stylist.save();

    res.status(200).json({ success: true, data: stylist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/salons/:salonId/stylists/:id  (owner) ─────────────────────────
const deleteStylist = async (req, res) => {
  try {
    const stylist = await Stylist.findOne({ _id: req.params.id, salon: req.params.salonId });
    if (!stylist) return res.status(404).json({ success: false, message: 'Stylist not found.' });

    if (stylist.photo?.public_id) await deleteFromCloudinary(stylist.photo.public_id);
    await stylist.deleteOne();

    res.status(200).json({ success: true, message: 'Stylist removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStylistsBySalon, createStylist, updateStylist, toggleStylist, deleteStylist };