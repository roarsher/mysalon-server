// cat > /home/claude/mysalon-backend/middleware/error.middleware.js << 'EOF'
const { AppError } = require('../utils/apiResponse');

/**
 * Global Error Handler
 * --------------------
 * Catches ALL errors thrown anywhere in the app (controllers, middleware, etc.)
 * Must be registered LAST in server.js:  app.use(errorHandler)
 *
 * Handles these special Mongoose/Firebase error types automatically:
 *   - CastError          → invalid MongoDB ObjectId
 *   - ValidationError    → Mongoose schema validation failed
 *   - 11000 duplicate    → unique field already exists (email, token, etc.)
 *   - JWT / Firebase auth errors
 */

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message    = err.message;
  error.statusCode = err.statusCode || 500;

  // ── Log in development ──────────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ ERROR:', {
      message: err.message,
      stack:   err.stack,
      code:    err.code,
    });
  }

  // ── Mongoose: invalid ObjectId ──────────────────────────────────────────────
  // e.g. /api/salons/not-a-valid-id
  if (err.name === 'CastError') {
    error.message    = `Resource not found. Invalid ID: ${err.value}`;
    error.statusCode = 404;
  }

  // ── Mongoose: unique field duplicate ─────────────────────────────────────────
  // e.g. registering with an email that already exists
  if (err.code === 11000) {
    const field      = Object.keys(err.keyValue)[0];
    error.message    = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists. Please use a different ${field}.`;
    error.statusCode = 400;
  }

  // ── Mongoose: schema validation error ────────────────────────────────────────
  // e.g. required field missing, enum value invalid, minlength failed
  if (err.name === 'ValidationError') {
    const messages   = Object.values(err.errors).map((e) => e.message);
    error.message    = messages.join('. ');
    error.statusCode = 400;
    return res.status(400).json({
      success: false,
      message: error.message,
      errors:  messages,
    });
  }

  // ── Firebase: token expired ───────────────────────────────────────────────
  if (err.code === 'auth/id-token-expired') {
    error.message    = 'Session expired. Please log in again.';
    error.statusCode = 401;
  }

  // ── Multer: file too large ────────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    error.message    = 'File too large. Maximum upload size is 5MB.';
    error.statusCode = 400;
  }

  // ── Default response ──────────────────────────────────────────────────────
  res.status(error.statusCode).json({
    success: false,
    message: error.message || 'Internal Server Error',
    // Show stack trace only in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Handler
 * -----------
 * Catches requests to routes that don't exist.
 * Register BEFORE errorHandler in server.js
 */
const notFound = (req, res, next) => {
  const error = new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404);
  next(error);
};

module.exports = { errorHandler, notFound };