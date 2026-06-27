const router = require('express').Router();
const { getProfile, updateProfile, updateProfilePhoto } = require('../controllers/user.controller');
const { protect }         = require('../middleware/auth.middleware');
const { uploadProfilePhoto, handleMulterError } = require('../middleware/upload.middleware');

// GET  /api/users/profile
router.get('/profile', protect, getProfile);

// PUT  /api/users/profile
router.put('/profile', protect, updateProfile);

// PUT  /api/users/profile/photo
router.put('/profile/photo', protect, uploadProfilePhoto, handleMulterError, updateProfilePhoto);

module.exports = router;