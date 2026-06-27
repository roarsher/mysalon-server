const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting Middleware
 * ------------------------
 * Protects the API from abuse — brute force attacks, bots, DDoS.
 *
 * Different limits for different route types:
 *   - General API     : 100 requests / 15 minutes per IP
 *   - Auth routes     : 10 requests  / 15 minutes per IP  (stricter)
 *   - Booking routes  : 20 requests  / 15 minutes per IP
 */

// ── General API limiter ───────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

// ── Auth route limiter (stricter — prevents brute force) ──────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  skipSuccessfulRequests: true,  // only count failed attempts
});

// ── Booking limiter ───────────────────────────────────────────────────────────
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many booking requests. Please slow down.',
  },
});

// ── Upload limiter (image uploads are expensive) ──────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max:      30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Upload limit reached. Please try again after 1 hour.',
  },
});

module.exports = { apiLimiter, authLimiter, bookingLimiter, uploadLimiter };