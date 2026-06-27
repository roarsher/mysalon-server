 
const { body } = require('express-validator');
const { handleValidation } = require('./salon.validator');

const validateBooking = [
  body('salonId')
    .notEmpty().withMessage('salonId is required')
    .isMongoId().withMessage('Invalid salonId'),

  body('serviceIds')
    .isArray({ min: 1 }).withMessage('At least one service must be selected')
    .custom((ids) => ids.every((id) => /^[a-f\d]{24}$/i.test(id)))
    .withMessage('One or more serviceIds are invalid'),

  body('notes')
    .optional()
    .isLength({ max: 300 }).withMessage('Notes cannot exceed 300 characters'),
];

const validateCancelBooking = [
  body('reason')
    .optional()
    .isLength({ max: 200 }).withMessage('Reason cannot exceed 200 characters'),
];

module.exports = { validateBooking, validateCancelBooking, handleValidation };
