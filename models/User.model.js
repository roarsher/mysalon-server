 

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

/**
 * User Model — updated for OTP + JWT auth (no Firebase dependency)
 *
 * Auth flow:
 *   Email signup  → password hashed here → OTP sent → verified → JWT issued
 *   Google signup → googleId stored      → JWT issued directly
 *
 * OTP fields are temporary — cleared after successful verification.
 * Password reset uses a separate token + expiry pair.
 */
const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      minlength: [2,  'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: {
      type:  String,
      default: '',
      trim:  true,
    },
    photoURL: { type: String, default: '' },
    role: {
      type:    String,
      enum:    ['user', 'salon_owner', 'admin'],
      default: 'user',
    },

    // ── Password (email/password users only) ──────────────────────────────────
    // Not required for Google users
    password: {
      type:   String,
      select: false,   // never returned in queries unless explicitly asked
    },

    // ── Google OAuth ──────────────────────────────────────────────────────────
    googleId: {
      type:   String,
      unique: true,
      sparse: true,    // allows multiple null values (non-Google users)
    },
    isGoogleUser: { type: Boolean, default: false },

    // ── Email verification via OTP ─────────────────────────────────────────────
    isEmailVerified: { type: Boolean, default: false },

    // OTP stored as hashed value for security
    emailOtp:        { type: String,  select: false },
    emailOtpExpires: { type: Date,    select: false },
    emailOtpAttempts:{ type: Number,  default: 0   }, // wrong attempt counter

    // ── Password reset ─────────────────────────────────────────────────────────
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },

    // ── Profile completion flag (Google users adding phone) ───────────────────
    isProfileComplete: { type: Boolean, default: false },

    // ── Relations ────────────────────────────────────────────────────────────
    bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
    salons:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Salon'   }],

    // ── Account status ────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },

    // FCM token for push notifications
    fcmToken: { type: String, default: '' },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
//userSchema.index({ email:    1 });
//userSchema.index({ googleId: 1 });
userSchema.index({ role:     1 });

// ── Hash password before saving ───────────────────────────────────────────────
 // ✅ CORRECT
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// ── Instance method: compare password ─────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: safe user object (no sensitive fields) ───────────────────
userSchema.methods.toSafeObject = function () {
  return {
    _id:               this._id,
    name:              this.name,
    email:             this.email,
    phone:             this.phone,
    photoURL:          this.photoURL,
    role:              this.role,
    isEmailVerified:   this.isEmailVerified,
    isGoogleUser:      this.isGoogleUser,
    isProfileComplete: this.isProfileComplete,
    isActive:          this.isActive,
    createdAt:         this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);