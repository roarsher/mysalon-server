const multer = require('multer');

/**
 * Upload Middleware (Multer)
 * Uses memoryStorage — files stored as Buffer, then piped to Cloudinary.
 */

const storage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and WEBP images are allowed.'), false);
  }
};

const upload = multer({ storage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * uploadSalonImages
 * Accepts: coverImage (single) + gallery (up to 10)
 * In controller: req.files.coverImage[0]  and  req.files.gallery[]
 */
const uploadSalonImages = upload.fields([
  { name: 'coverImage', maxCount: 1  },
  { name: 'gallery',    maxCount: 10 },
]);

/**
 * uploadServiceImage
 * Single service image. In controller: req.file
 */
const uploadServiceImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
}).single('image');

/**
 * uploadProfilePhoto
 * Single profile photo. In controller: req.file
 */
const uploadProfilePhoto = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('photo');


const uploadStylistPhoto = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'), false);
  },
}).single('photo');

/**
 * handleMulterError
 * Place AFTER upload middleware in the route chain to catch multer errors.
 */
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')     return res.status(400).json({ success: false, message: 'File too large. Max 5MB.' });
    if (err.code === 'LIMIT_FILE_COUNT')    return res.status(400).json({ success: false, message: 'Too many files.' });
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ success: false, message: `Unexpected field: ${err.field}` });
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) return res.status(400).json({ success: false, message: err.message });
  next();
};

module.exports = { uploadSalonImages, uploadServiceImage,uploadStylistPhoto, uploadProfilePhoto, handleMulterError };