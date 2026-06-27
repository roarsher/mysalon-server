 const router  = require('express').Router();
const {
  register,
  verifyOtpController,
  resendOtp,
  login,
  googleSignIn,
  completeProfile,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
} = require('../controllers/auth.controller');
const { protect }     = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');

// Public — rate-limited
router.post('/register',          authLimiter, register);
router.post('/verify-otp',        authLimiter, verifyOtpController);
router.post('/resend-otp',        authLimiter, resendOtp);
router.post('/login',             authLimiter, login);
router.post('/google',            authLimiter, googleSignIn);
router.post('/forgot-password',   authLimiter, forgotPassword);
router.post('/reset-password',    authLimiter, resetPassword);

// Private
router.patch('/complete-profile', protect, completeProfile);
router.get('/me',                 protect, getMe);
router.post('/logout',            protect, logout);

module.exports = router;