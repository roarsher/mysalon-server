 
/**
 * ApiResponse & AppError
 * ----------------------
 * Standardises every API response shape across the entire backend.
 *
 * Every success response:  { success: true,  data: ..., message: ..., meta: ... }
 * Every error response:    { success: false, message: ..., errors: ... }
 *
 * Usage in controllers:
 *   const { sendSuccess, sendError, AppError } = require('../utils/apiResponse');
 *
 *   sendSuccess(res, 200, user, 'User fetched');
 *   sendSuccess(res, 200, salons, 'Salons fetched', { page: 1, total: 42 });
 *   throw new AppError('Salon not found', 404);
 */

// ─── AppError ─────────────────────────────────────────────────────────────────
class AppError extends Error {
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.statusCode  = statusCode;
    this.errors      = errors;   // array of field-level validation errors
    this.isOperational = true;   // distinguishes our errors from unexpected ones
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── sendSuccess ─────────────────────────────────────────────────────────────
const sendSuccess = (res, statusCode = 200, data = null, message = 'Success', meta = {}) => {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  if (Object.keys(meta).length > 0) body.meta = meta; // pagination, counts etc.
  return res.status(statusCode).json(body);
};

// ─── sendError ────────────────────────────────────────────────────────────────
const sendError = (res, statusCode = 500, message = 'Something went wrong', errors = []) => {
  const body = { success: false, message };
  if (errors.length > 0) body.errors = errors;
  return res.status(statusCode).json(body);
};

module.exports = { AppError, sendSuccess, sendError };