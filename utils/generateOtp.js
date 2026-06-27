const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * generateOtp
 * -----------
 * Generates a cryptographically secure 6-digit OTP.
 * Returns both the plain OTP (to send in email) and
 * the hashed version (to store in the database).
 *
 * We hash the OTP before storing it so that even if the
 * database is leaked, OTPs cannot be used to log in.
 *
 * OTP expires in 10 minutes.
 */
const generateOtp = async () => {
  // Secure random 6-digit number (000000 – 999999)
  const otp       = crypto.randomInt(100000, 999999).toString();
  const otpHash   = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  return { otp, otpHash, otpExpires };
};

/**
 * verifyOtp
 * Compares the user-submitted OTP with the hashed one stored in the database.
 */
const verifyOtp = async (submittedOtp, hashedOtp) => {
  return bcrypt.compare(submittedOtp, hashedOtp);
};

module.exports = { generateOtp, verifyOtp };