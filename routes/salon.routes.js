// const router = require('express').Router();
// const {
//   getAllSalons,
//   getSalonById,
//   createSalon,
//   updateSalon,
//   deleteGalleryImage,
//   deleteSalon,
//   getMySalons,
// } = require('../controllers/salon.controller');

// const { protect, ownerOrAdmin, salonOwnershipCheck } = require('../middleware/auth.middleware');
// const { uploadSalonImages, handleMulterError }        = require('../middleware/upload.middleware');

// // ── Public routes ──────────────────────────────────────────────────────────────

// // GET /api/salons            → home page salon listing
// // GET /api/salons?search=&category=&city=&sortBy=&page=&limit=
// router.get('/', getAllSalons);

// // GET /api/salons/:id        → salon detail page with services grouped by category
// router.get('/:id', getSalonById);

// // ── Private routes ─────────────────────────────────────────────────────────────

// // GET /api/salons/my         → owner's own salons (owner dashboard)
// router.get('/owner/my', protect, ownerOrAdmin, getMySalons);

// // POST /api/salons           → register a new salon (owner signup flow)
// // multipart/form-data: fields(name,description,category,phone,email,address,tags,workingHours)
// //                    + files(coverImage, gallery[])
// router.post(
//   '/',
//   protect,
//   ownerOrAdmin,
//   uploadSalonImages,
//   handleMulterError,
//   createSalon
// );

// // PUT /api/salons/:id        → update salon info / images
// router.put(
//   '/:id',
//   protect,
//   ownerOrAdmin,
//   salonOwnershipCheck,
//   uploadSalonImages,
//   handleMulterError,
//   updateSalon
// );

// // DELETE /api/salons/:id/gallery  → remove one gallery image
// router.delete('/:id/gallery', protect, ownerOrAdmin, salonOwnershipCheck, deleteGalleryImage);

// // DELETE /api/salons/:id          → soft-delete a salon
// router.delete('/:id', protect, ownerOrAdmin, salonOwnershipCheck, deleteSalon);

// module.exports = router;

const router = require('express').Router();
const {
  getAllSalons, getSalonById, createSalon,
  updateSalon, deleteGalleryImage, deleteSalon, getMySalons,
} = require('../controllers/salon.controller');
const { protect, ownerOrAdmin, salonOwnershipCheck } = require('../middleware/auth.middleware');
const { uploadSalonImages, handleMulterError }        = require('../middleware/upload.middleware');
const { validateSalon, handleValidation }             = require('../validators/salon.validator');

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/',          getAllSalons);
router.get('/:id',       getSalonById);

// ── Owner ─────────────────────────────────────────────────────────────────────
// Must come BEFORE /:id to avoid route conflict
router.get('/owner/my',  protect, ownerOrAdmin, getMySalons);

// POST /api/salons — any verified user can register a salon
// (controller auto-upgrades their role to salon_owner)
router.post('/',
  protect,
  uploadSalonImages,
  handleMulterError,
  validateSalon,
  handleValidation,
  createSalon
);

// PUT /api/salons/:id
router.put('/:id',
  protect, ownerOrAdmin, salonOwnershipCheck,
  uploadSalonImages, handleMulterError,
  updateSalon
);

// DELETE /api/salons/:id/gallery
router.delete('/:id/gallery', protect, ownerOrAdmin, salonOwnershipCheck, deleteGalleryImage);

// DELETE /api/salons/:id
router.delete('/:id',         protect, ownerOrAdmin, salonOwnershipCheck, deleteSalon);

module.exports = router;