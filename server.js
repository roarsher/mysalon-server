 const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const dotenv   = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
require('./config/firebase');
require('./config/cloudinary');
require('./config/razorpay');

connectDB();

const app = express();

// ── Webhook route needs raw body BEFORE express.json() ────────────────────────
// Razorpay signature verification requires the raw request body
app.use('/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Convert raw Buffer to parsed JSON for the controller
    // but keep raw body available for signature check
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      req.body    = JSON.parse(req.body.toString());
    }
    next();
  }
);

// ── Standard middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));


const routeFiles = {
  auth:     './routes/auth.routes',
  users:    './routes/user.routes',
  salons:   './routes/salon.routes',
  services: './routes/service.routes',
  bookings: './routes/booking.routes',
  queue:    './routes/queue.routes',
  reviews:  './routes/review.routes',
  payments: './routes/payment.routes',
  notifications: './routes/notification.routes',
};
Object.entries(routeFiles).forEach(([name, path]) => {
  const mod = require(path);
  if (typeof mod !== 'function') console.error(`❌ BAD EXPORT: ${name} →`, typeof mod);
  else console.log(`✅ ${name}`);
});
// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth.routes'));
app.use('/api/users',    require('./routes/user.routes'));
app.use('/api/salons',   require('./routes/salon.routes'));
app.use('/api/salons/:salonId/services', require('./routes/service.routes'));
app.use('/api/bookings', require('./routes/booking.routes'));
app.use('/api/queue',    require('./routes/queue.routes'));
app.use('/api/reviews',  require('./routes/review.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: '💈 MYSALON API running', version: '1.0.0' });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));