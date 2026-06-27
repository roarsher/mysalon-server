 const { verifyToken } = require('../utils/generateToken');
const User = require('../models/User.model');

/**
 * protect
 * Verifies JWT from Authorization: Bearer <token>
 * Attaches the MongoDB user to req.user
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const user    = await User.findById(decoded.id);

    if (!user)          return res.status(401).json({ success: false, message: 'User not found.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account deactivated.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
};

const ownerOrAdmin = (req, res, next) => {
  if (!['salon_owner', 'admin'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Salon owner access required.' });
  }
  next();
};

const salonOwnershipCheck = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return next();
    const Salon   = require('../models/Salon.model');
    const salonId = req.params.salonId || req.params.id;
    const salon   = await Salon.findById(salonId).select('owner');
    if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });
    if (salon.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You do not own this salon.' });
    }
    req.salon = salon;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { protect, adminOnly, ownerOrAdmin, salonOwnershipCheck };
