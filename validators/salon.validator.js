 const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation Middleware
 * ---------------------
 * Uses express-validator to validate request body/params BEFORE
 * the request reaches the controller.
 *
 * Usage in routes:
 *   router.post('/', protect, validateSalon, handleValidation, createSalon)
 */

// ── Shared: run validations and return errors if any ─────────────────────────
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Salon create/update validator ─────────────────────────────────────────────
const validateSalon = [
  body('name')
    .trim()
    .notEmpty().withMessage('Salon name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(["men's", "women's", "unisex", "bridal", "spa", "kids"])
    .withMessage('Invalid category. Must be one of: mens, womens, unisex, bridal, spa, kids'),

  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[0-9+\-\s]{7,15}$/).withMessage('Invalid phone number'),

  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Invalid email address'),

  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),

  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
];

// ── Salon query params validator ──────────────────────────────────────────────
const validateSalonQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),

  query('sortBy')
    .optional()
    .isIn(['rating', 'newest', 'name']).withMessage('sortBy must be rating, newest, or name'),

  query('category')
    .optional()
    .isIn(["men's", "women's", "unisex", "bridal", "spa", "kids"])
    .withMessage('Invalid category filter'),
];

// ── MongoDB ObjectId param validator ─────────────────────────────────────────
const validateMongoId = (paramName = 'id') => [
  param(paramName)
    .isMongoId().withMessage(`Invalid ${paramName}. Must be a valid MongoDB ObjectId`),
];

module.exports = { validateSalon, validateSalonQuery, validateMongoId, handleValidation };