const router = require('express').Router({ mergeParams: true });
// mergeParams: true lets us access :salonId from the parent router
// Mounted at: /api/salons/:salonId/services

const {
  getServicesBySalon,
  createService,
  updateService,
  toggleServiceAvailability,
  deleteService,
} = require('../controllers/service.controller');

const { protect, ownerOrAdmin, salonOwnershipCheck } = require('../middleware/auth.middleware');
const { uploadServiceImage, handleMulterError }       = require('../middleware/upload.middleware');

// GET /api/salons/:salonId/services              → all services (public, shown on salon page like menu)
// GET /api/salons/:salonId/services?category=hair → filter by category
router.get('/', getServicesBySalon);

// POST /api/salons/:salonId/services             → add a new service (owner only)
// multipart/form-data: fields(name,description,category,price,duration,displayOrder)
//                    + file(image - optional)
router.post(
  '/',
  protect,
  ownerOrAdmin,
  salonOwnershipCheck,
  uploadServiceImage,
  handleMulterError,
  createService
);

// PUT /api/salons/:salonId/services/:id          → edit a service
router.put(
  '/:id',
  protect,
  ownerOrAdmin,
  salonOwnershipCheck,
  uploadServiceImage,
  handleMulterError,
  updateService
);

// PATCH /api/salons/:salonId/services/:id/toggle → toggle available on/off
router.patch('/:id/toggle', protect, ownerOrAdmin, salonOwnershipCheck, toggleServiceAvailability);

// DELETE /api/salons/:salonId/services/:id       → delete a service
router.delete('/:id', protect, ownerOrAdmin, salonOwnershipCheck, deleteService);

module.exports = router;
