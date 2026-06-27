
/**
 * Notification Utility
 * --------------------
 * Sends queue position updates to users.
 *
 * Currently implemented via Firebase Cloud Messaging (FCM).
 * You can also plug in Twilio SMS or email (Nodemailer) here.
 *
 * To enable FCM push notifications:
 *   1. In Firebase Console → Project Settings → Cloud Messaging
 *   2. Get the Server Key
 *   3. On the frontend, register the service worker and get the device FCM token
 *   4. Save the FCM token to the User document when the user logs in
 *
 * The admin SDK we already initialised in config/firebase.js handles sending.
 */

const admin = require('../config/firebase');

/**
 * Send a push notification to a single device
 * @param {string} fcmToken   - device FCM token saved on the User document
 * @param {string} title      - notification title
 * @param {string} body       - notification body text
 * @param {object} data       - extra key-value payload (all values must be strings)
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) return; // user hasn't enabled notifications

  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: { priority: 'high' },
      apns:    { payload: { aps: { sound: 'default' } } },
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Notification sent: ${response}`);
    return response;
  } catch (err) {
    // Don't crash the app if a notification fails
    console.error(`⚠️  Notification failed: ${err.message}`);
  }
};

// ─── Pre-built notification helpers ──────────────────────────────────────────

/**
 * Notify user when they are 2 people away from being served
 */
const notifyAlmostYourTurn = async (user, booking, position) => {
  if (!user.fcmToken) return;
  await sendPushNotification(
    user.fcmToken,
    "Almost your turn! ✂️",
    `${position} person${position > 1 ? 's' : ''} ahead of you at ${booking.salonName}. Head over now!`,
    { bookingId: booking._id.toString(), type: 'queue_update' }
  );
};

/**
 * Notify user when it's their turn
 */
const notifyYourTurn = async (user, booking) => {
  if (!user.fcmToken) return;
  await sendPushNotification(
    user.fcmToken,
    "It's your turn! 🎉",
    `Token ${booking.tokenNumber} — please head to the counter now.`,
    { bookingId: booking._id.toString(), type: 'your_turn' }
  );
};

/**
 * Notify user when their booking is cancelled by the salon
 */
const notifyBookingCancelled = async (user, booking, reason) => {
  if (!user.fcmToken) return;
  await sendPushNotification(
    user.fcmToken,
    "Booking Cancelled",
    `Your booking (Token: ${booking.tokenNumber}) was cancelled. Reason: ${reason}`,
    { bookingId: booking._id.toString(), type: 'cancelled' }
  );
};

module.exports = {
  sendPushNotification,
  notifyAlmostYourTurn,
  notifyYourTurn,
  notifyBookingCancelled,
};