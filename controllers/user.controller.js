const User                  = require('../models/User.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

/**
 * @desc    Get logged-in user's profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('salons', 'name coverImage category isOpen rating address');

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Update logged-in user's profile (name, phone)
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};
    if (name  !== undefined) updates.name  = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Upload / replace profile photo
 * @route   PUT /api/users/profile/photo
 * @access  Private
 * @body    multipart/form-data with field "photo"
 */
const updateProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo uploaded.' });
    }

    // Delete old photo from Cloudinary if it was uploaded by us
    // (Google photos have a different URL pattern — don't try to delete those)
    const oldURL = req.user.photoURL || '';
    if (oldURL.includes('res.cloudinary.com')) {
      const oldPublicId = oldURL.split('/').slice(-2).join('/').split('.')[0];
      await deleteFromCloudinary(`mysalon/users/${oldPublicId}`);
    }

    const result = await uploadToCloudinary(
      req.file.buffer,
      `mysalon/users/${req.user._id}`,
      { transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }] }
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { photoURL: result.url },
      { new: true }
    );

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getProfile, updateProfile, updateProfilePhoto };