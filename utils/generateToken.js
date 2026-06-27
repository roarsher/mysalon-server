const jwt = require('jsonwebtoken');

/**
 * generateToken
 * -------------
 * Signs a JWT containing the user's _id and role.
 * The frontend stores this token in localStorage and sends it
 * as  Authorization: Bearer <token>  on every API request.
 *
 * Expiry: 30 days (user stays logged in for a month unless they log out)
 *
 * The JWT_SECRET must be a long random string — generate with:
 *   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

/**
 * verifyToken
 * Verifies and decodes a JWT. Throws if invalid or expired.
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { generateToken, verifyToken };