 
const { body } = require('express-validator');
const { handleValidation } = require('./salon.validator');

const validateService = [
  body('name')
    .trim()
    .notEmpty().withMessage('Service name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(['hair','skin','beard','nail','bridal','spa','makeup','threading','waxing','massage','other'])
    .withMessage('Invalid service category'),

  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

  body('duration')
    .notEmpty().withMessage('Duration is required')
    .isInt({ min: 5, max: 480 }).withMessage('Duration must be between 5 and 480 minutes'),

  body('description')
    .optional()
    .isLength({ max: 300 }).withMessage('Description cannot exceed 300 characters'),

  body('displayOrder')
    .optional()
    .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
];

module.exports = { validateService, handleValidation };
 



