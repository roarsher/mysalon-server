const router = require('express').Router({ mergeParams: true });
// Mounted at: /api/salons/:salonId/stylists

const {
  getStylistsBySalon,
  createStylist,
  updateStylist,
  toggleStylist,
  deleteStylist,
} = require('../controllers/stylist.controller');

const { protect, ownerOrAdmin, salonOwnershipCheck } = require('../middleware/auth.middleware');
const { uploadStylistPhoto, handleMulterError }       = require('../middleware/upload.middleware');

// GET  /api/salons/:salonId/stylists           → public, shown on salon page
router.get('/', getStylistsBySalon);

// POST /api/salons/:salonId/stylists           → owner adds stylist
router.post('/',
  protect, ownerOrAdmin, salonOwnershipCheck,
  uploadStylistPhoto, handleMulterError,
  createStylist
);

// PUT  /api/salons/:salonId/stylists/:id       → owner edits stylist
router.put('/:id',
  protect, ownerOrAdmin, salonOwnershipCheck,
  uploadStylistPhoto, handleMulterError,
  updateStylist
);

// PATCH /api/salons/:salonId/stylists/:id/toggle
router.patch('/:id/toggle', protect, ownerOrAdmin, salonOwnershipCheck, toggleStylist);

// DELETE /api/salons/:salonId/stylists/:id
router.delete('/:id', protect, ownerOrAdmin, salonOwnershipCheck, deleteStylist);

module.exports = router;