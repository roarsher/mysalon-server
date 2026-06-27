const cloudinary = require('cloudinary').v2;

/**
 * Cloudinary Configuration
 *
 * Cloudinary is used to store all images (salon cover, gallery, service images).
 * Images are uploaded here and only the URL + public_id are stored in MongoDB.
 *
 * To get credentials:
 *   cloudinary.com → Dashboard → API Keys
 *   → copy Cloud Name, API Key, API Secret into .env
 *
 * Folder structure in Cloudinary:
 *   mysalon/salons/{salonId}/cover       → cover image
 *   mysalon/salons/{salonId}/gallery     → gallery images
 *   mysalon/services/{salonId}           → service images
 *   mysalon/users/{userId}               → profile photos (optional)
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,   // always use https URLs
});

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer   - file buffer from multer memoryStorage
 * @param {string} folder   - Cloudinary folder path
 * @param {object} options  - extra Cloudinary options
 * @returns {Promise<{url, public_id}>}
 */
const uploadToCloudinary = (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { quality: 'auto:good' },   // auto compress
          { fetch_format: 'auto' },    // serve webp to modern browsers
        ],
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url:       result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Delete an image from Cloudinary by its public_id
 * Call this when an owner replaces or deletes an image
 */
const deleteFromCloudinary = async (public_id) => {
  if (!public_id) return;
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
};

module.exports = { cloudinary, uploadToCloudinary, deleteFromCloudinary };