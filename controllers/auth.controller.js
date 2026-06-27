 const crypto           = require('crypto');
const User             = require('../models/User.model');
const { generateOtp, verifyOtp } = require('../utils/generateOtp');
const { generateToken }          = require('../utils/generateToken');
const { sendOtpEmail, sendPasswordResetEmail } = require('../utils/sendEmail');
const admin            = require('../config/firebase');

// ── Helper: send token response ───────────────────────────────────────────────
const sendTokenResponse = (res, statusCode, user, isNewUser = false, extra = {}) => {
  const token = generateToken(user._id, user.role);
  res.status(statusCode).json({
    success: true,
    token,
    user:    user.toSafeObject(),
    isNewUser,
    ...extra,
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Step 1 of email signup.
 * Creates an unverified user account and sends a 6-digit OTP to their email.
 * If account already exists but is unverified, resends a fresh OTP.
 * Returns { userId } — used on the OTP screen to call /verify-otp.
 */
const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // ── Basic validation ──────────────────────────────────────────────────
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, phone, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (!/\d/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one number.' });
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });
    }

    // ── Check if email already exists ─────────────────────────────────────
    let user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user) {
      if (user.isEmailVerified) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists. Try logging in.' });
      }
      // Unverified — regenerate OTP and resend
      const { otp, otpHash, otpExpires } = await generateOtp();
      user.emailOtp         = otpHash;
      user.emailOtpExpires  = otpExpires;
      user.emailOtpAttempts = 0;
      await user.save({ validateBeforeSave: false });
      await sendOtpEmail(user.email, user.name, otp);

      return res.status(200).json({
        success: true,
        message: 'Account already registered but not verified. A new OTP has been sent to your email.',
        userId:  user._id,
      });
    }

    // ── Check phone uniqueness ─────────────────────────────────────────────
    const phoneExists = await User.findOne({ phone: phone.trim() });
    if (phoneExists) {
      return res.status(409).json({ success: false, message: 'This phone number is already registered.' });
    }

    // ── Generate OTP ───────────────────────────────────────────────────────
    const { otp, otpHash, otpExpires } = await generateOtp();

    // ── Create user (unverified) ───────────────────────────────────────────
    user = await User.create({
      name:              name.trim(),
      email:             email.toLowerCase().trim(),
      phone:             phone.trim(),
      password,                         // hashed by pre-save hook
      role:              role === 'salon_owner' ? 'salon_owner' : 'user',
      isEmailVerified:   false,
      isProfileComplete: true,          // email users always complete at signup
      emailOtp:          otpHash,
      emailOtpExpires:   otpExpires,
      emailOtpAttempts:  0,
    });

    // ── Send OTP email ─────────────────────────────────────────────────────
    await sendOtpEmail(user.email, user.name, otp);

    res.status(201).json({
      success: true,
      message: `OTP sent to ${user.email}. Please verify to complete registration.`,
      userId:  user._id,
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `This ${field} is already registered.` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/verify-otp
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Step 2 of email signup.
 * Verifies the 6-digit OTP submitted by the user.
 * On success: marks email as verified and returns JWT + user.
 * Max 5 wrong attempts before OTP is invalidated.
 */
const verifyOtpController = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: 'userId and otp are required.' });
    }
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'OTP must be a 6-digit number.' });
    }

    // Fetch user WITH otp fields (they are select:false by default)
    const user = await User.findById(userId).select('+emailOtp +emailOtpExpires +emailOtpAttempts');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified. Please log in.' });
    }
    if (!user.emailOtp || !user.emailOtpExpires) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }

    // ── Check expiry ───────────────────────────────────────────────────────
    if (user.emailOtpExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // ── Max attempts check (5 wrong tries) ────────────────────────────────
    if (user.emailOtpAttempts >= 5) {
      user.emailOtp         = undefined;
      user.emailOtpExpires  = undefined;
      user.emailOtpAttempts = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        success: false,
        message: 'Too many wrong attempts. Please request a new OTP.',
      });
    }

    // ── Verify OTP ─────────────────────────────────────────────────────────
    const isMatch = await verifyOtp(otp, user.emailOtp);

    if (!isMatch) {
      user.emailOtpAttempts += 1;
      await user.save({ validateBeforeSave: false });
      const remaining = 5 - user.emailOtpAttempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    // ── OTP correct — verify the user ─────────────────────────────────────
    user.isEmailVerified   = true;
    user.emailOtp          = undefined;
    user.emailOtpExpires   = undefined;
    user.emailOtpAttempts  = 0;
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(res, 200, user, true);
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/resend-otp
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Resends a fresh 6-digit OTP to the user's email.
 * Rate-limited: only one resend per 60 seconds.
 */
const resendOtp = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    const user = await User.findById(userId).select('+emailOtp +emailOtpExpires +emailOtpAttempts');
    if (!user)               return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Email is already verified.' });

    // ── Rate limit: 60 seconds between resends ─────────────────────────────
    if (user.emailOtpExpires) {
      const secondsSinceSent = (user.emailOtpExpires - new Date()) / 1000;
      // OTP expires in 10min = 600s. If >540s remain, it was sent <60s ago.
      if (secondsSinceSent > 540) {
        const waitSecs = Math.ceil(secondsSinceSent - 540);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSecs} second${waitSecs !== 1 ? 's' : ''} before requesting a new OTP.`,
        });
      }
    }

    // ── Generate and send fresh OTP ────────────────────────────────────────
    const { otp, otpHash, otpExpires } = await generateOtp();
    user.emailOtp          = otpHash;
    user.emailOtpExpires   = otpExpires;
    user.emailOtpAttempts  = 0;
    await user.save({ validateBeforeSave: false });
    await sendOtpEmail(user.email, user.name, otp);

    res.status(200).json({
      success: true,
      message: `New OTP sent to ${user.email}.`,
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Email + password login.
 * If email not yet verified, sends a fresh OTP and returns requiresVerification.
 * On success returns JWT + user object.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Fetch user WITH password field (select:false by default)
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password +emailOtp +emailOtpExpires +emailOtpAttempts');

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email.' });
    }
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account was created with Google. Please use "Continue with Google" to sign in.',
      });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated. Contact support.' });
    }

    // ── Check password ─────────────────────────────────────────────────────
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
    }

    // ── Email not verified → send fresh OTP and block login ───────────────
    if (!user.isEmailVerified) {
      const { otp, otpHash, otpExpires } = await generateOtp();
      user.emailOtp         = otpHash;
      user.emailOtpExpires  = otpExpires;
      user.emailOtpAttempts = 0;
      await user.save({ validateBeforeSave: false });
      await sendOtpEmail(user.email, user.name, otp);

      return res.status(200).json({
        success:              true,
        requiresVerification: true,
        userId:               user._id,
        message:              'Please verify your email. A new OTP has been sent.',
      });
    }

    sendTokenResponse(res, 200, user);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/google
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Google OAuth sign-in / sign-up.
 * Frontend sends the Firebase idToken obtained from signInWithPopup().
 * Backend verifies it with Firebase Admin SDK, then:
 *   - New user  → create account → return JWT
 *   - Returning → find account   → return JWT
 *   - No phone  → return requiresPhone: true so frontend shows phone step
 */
const googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Firebase idToken is required.' });
    }

    // ── Verify Firebase token ──────────────────────────────────────────────
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (firebaseErr) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Google token. Please try again.' });
    }

    const { uid, name, email, picture } = decoded;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Google account must have an email address.' });
    }

    // ── Find or create user ────────────────────────────────────────────────
    let user      = await User.findOne({ $or: [{ googleId: uid }, { email: email.toLowerCase() }] });
    let isNewUser = false;

    if (!user) {
      // Brand new user — create account (no password, already verified via Google)
      user = await User.create({
        googleId:          uid,
        name:              name || email.split('@')[0],
        email:             email.toLowerCase(),
        photoURL:          picture || '',
        isGoogleUser:      true,
        isEmailVerified:   true,   // Google already verified the email
        isProfileComplete: false,  // phone not collected yet
      });
      isNewUser = true;
    } else {
      // Existing user — update their Google info in case it changed
      if (!user.googleId) user.googleId = uid;
      if (picture && !user.photoURL) user.photoURL = picture;
      user.isEmailVerified = true;
      await user.save({ validateBeforeSave: false });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated. Contact support.' });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success:       true,
      token,
      user:          user.toSafeObject(),
      isNewUser,
      // Tell frontend to show phone collection step if phone is missing
      requiresPhone: !user.phone || user.phone === '',
      message:       isNewUser ? 'Account created successfully!' : 'Welcome back!',
    });
  } catch (err) {
    console.error('Google sign-in error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// PATCH /api/auth/complete-profile
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Called after Google sign-in to collect the user's phone number.
 * Requires a valid JWT (protect middleware).
 */
const completeProfile = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });
    }

    const phoneExists = await User.findOne({ phone, _id: { $ne: req.user._id } });
    if (phoneExists) {
      return res.status(409).json({ success: false, message: 'This phone number is already registered to another account.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { phone, isProfileComplete: true },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile completed successfully!',
      user:    user.toSafeObject(),
    });
  } catch (err) {
    console.error('Complete profile error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/auth/me
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Returns the currently logged-in user's profile.
 * Used on app load to re-hydrate auth state.
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('salons', 'name coverImage category isOpen rating');
    res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/forgot-password
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Sends a password reset link to the user's email.
 * The link contains a cryptographically secure token valid for 1 hour.
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with this email exists, a reset link has been sent.',
      });
    }

    if (user.isGoogleUser) {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google sign-in. Password reset is not available.',
      });
    }

    // ── Generate reset token ───────────────────────────────────────────────
    const resetToken    = crypto.randomBytes(32).toString('hex');
    const tokenHash     = crypto.createHash('sha256').update(resetToken).digest('hex');
    const tokenExpires  = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken   = tokenHash;
    user.passwordResetExpires = tokenExpires;
    await user.save({ validateBeforeSave: false });

    // ── Send reset email ───────────────────────────────────────────────────
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/reset-password
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Validates the reset token and sets the new password.
 * Token is hashed before comparison (stored hashed in DB).
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }
    if (password.length < 6 || !/\d/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters and contain a number.' });
    }

    // Hash the incoming token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken:   tokenHash,
      passwordResetExpires: { $gt: new Date() }, // not expired
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    user.password             = password;   // pre-save hook hashes it
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    sendTokenResponse(res, 200, user);
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Server-side logout is just a success response.
 * The actual token invalidation happens on the frontend (clear localStorage).
 * For stronger security, implement a token blacklist with Redis.
 */
const logout = (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

module.exports = {
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
};