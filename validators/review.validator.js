 
const { body } = require('express-validator');
const { handleValidation } = require('./salon.validator');

const validateReview = [
  body('bookingId')
    .notEmpty().withMessage('bookingId is required')
    .isMongoId().withMessage('Invalid bookingId'),

  body('salonId')
    .notEmpty().withMessage('salonId is required')
    .isMongoId().withMessage('Invalid salonId'),

  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),

  body('comment')
    .optional()
    .isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters'),
];

const validateReply = [
  body('text')
    .trim()
    .notEmpty().withMessage('Reply text is required')
    .isLength({ max: 500 }).withMessage('Reply cannot exceed 500 characters'),
];

module.exports = { validateReview, validateReply, handleValidation };