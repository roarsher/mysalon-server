// server/utils/sendSMS.js
const axios = require("axios");

// ── SMS Provider: MSG91 (Best free option for India) ─────────────
//
// Why MSG91?
//   ✅ Indian provider — works perfectly for Indian numbers
//   ✅ Free trial with 100 SMS credits
//   ✅ Supports OTP templates, transactional SMS
//   ✅ Very reliable delivery
//
// Setup steps:
//   1. Sign up at https://msg91.com
//   2. Go to API → Generate Auth Key
//   3. Create an OTP template (get template ID)
//   4. Add these to .env:
//        MSG91_AUTH_KEY=your_auth_key
//        MSG91_SENDER_ID=GLAMRS       (6 chars)
//        MSG91_OTP_TEMPLATE_ID=your_template_id
//
// Alternative free option: Twilio (global, free trial gives $15 credit)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
//
// .env variables needed:
//   MSG91_AUTH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx
//   MSG91_SENDER_ID=GLAMRS
//   MSG91_OTP_TEMPLATE_ID=xxxxxxxxxxxxxxxxxxxxxxxx

// ════════════════════════════════════════════════════════════════
// SEND OTP SMS  (MSG91)
// Sends a 6-digit OTP via SMS to the user's phone number
//
// Usage in auth.controller.js:
//   await sendOtpSms("9876543210", "123456");
// ════════════════════════════════════════════════════════════════
const sendOtpSms = async (phone, otp) => {
  try {
    // MSG91 OTP API
    const response = await axios.post(
      "https://api.msg91.com/api/v5/otp",
      {
        template_id: process.env.MSG91_OTP_TEMPLATE_ID,
        mobile:      `91${phone}`,   // 91 = India country code
        authkey:     process.env.MSG91_AUTH_KEY,
        otp,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      }
    );

    if (response.data.type === "success") {
      console.log(`✅ OTP SMS sent to ${phone}`);
      return { success: true };
    } else {
      throw new Error(response.data.message || "SMS sending failed");
    }
  } catch (error) {
    console.error(`❌ SMS send failed to ${phone}:`, error.message);
    // Don't throw — SMS failure should not block the main flow
    return { success: false, error: error.message };
  }
};

// ════════════════════════════════════════════════════════════════
// SEND BOOKING CONFIRMATION SMS
// Sends a short booking summary to the customer's phone
//
// Usage:
//   await sendBookingConfirmationSms("9876543210", {
//     name: "Priya",
//     date: "25 Dec 2024",
//     time: "10:30 AM",
//     stylist: "Meera K.",
//     total: "₹1,299"
//   });
// ════════════════════════════════════════════════════════════════
const sendBookingConfirmationSms = async (phone, details) => {
  try {
    const message =
      `Hi ${details.name}! Your Glamour Salon appointment is confirmed.\n` +
      `Date: ${details.date} at ${details.time}\n` +
      `Stylist: ${details.stylist}\n` +
      `Total: ${details.total}\n` +
      `See you soon! - Glamour Salon`;

    const response = await axios.get(
      "https://api.msg91.com/api/sendhttp.php",
      {
        params: {
          authkey:  process.env.MSG91_AUTH_KEY,
          mobiles:  `91${phone}`,
          message,
          sender:   process.env.MSG91_SENDER_ID || "GLAMRS",
          route:    4,  // transactional route
          country:  91,
        },
        timeout: 5000,
      }
    );

    console.log(`✅ Booking SMS sent to ${phone}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Booking SMS failed to ${phone}:`, error.message);
    return { success: false, error: error.message };
  }
};

// ════════════════════════════════════════════════════════════════
// SEND CANCELLATION SMS
// Notifies customer when booking is cancelled
//
// Usage:
//   await sendCancellationSms("9876543210", "Priya", "25 Dec 2024");
// ════════════════════════════════════════════════════════════════
const sendCancellationSms = async (phone, name, date) => {
  try {
    const message =
      `Hi ${name}, your Glamour Salon appointment on ${date} has been cancelled. ` +
      `A refund (if applicable) will be processed in 5-7 business days. ` +
      `Book again at glamoursalon.com`;

    await axios.get("https://api.msg91.com/api/sendhttp.php", {
      params: {
        authkey: process.env.MSG91_AUTH_KEY,
        mobiles: `91${phone}`,
        message,
        sender:  process.env.MSG91_SENDER_ID || "GLAMRS",
        route:   4,
        country: 91,
      },
      timeout: 5000,
    });

    console.log(`✅ Cancellation SMS sent to ${phone}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Cancellation SMS failed:`, error.message);
    return { success: false };
  }
};

// ════════════════════════════════════════════════════════════════
// SEND REMINDER SMS
// Sent 2 hours before appointment (can be triggered by a cron job)
//
// Usage (in a scheduled job):
//   await sendReminderSms("9876543210", "Priya", "10:30 AM");
// ════════════════════════════════════════════════════════════════
const sendReminderSms = async (phone, name, time) => {
  try {
    const message =
      `Hi ${name}! Reminder: Your Glamour Salon appointment is today at ${time}. ` +
      `Please arrive 5 minutes early. See you soon! - Glamour Salon`;

    await axios.get("https://api.msg91.com/api/sendhttp.php", {
      params: {
        authkey: process.env.MSG91_AUTH_KEY,
        mobiles: `91${phone}`,
        message,
        sender:  process.env.MSG91_SENDER_ID || "GLAMRS",
        route:   4,
        country: 91,
      },
      timeout: 5000,
    });

    console.log(`✅ Reminder SMS sent to ${phone}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Reminder SMS failed:`, error.message);
    return { success: false };
  }
};

module.exports = {
  sendOtpSms,
  sendBookingConfirmationSms,
  sendCancellationSms,
  sendReminderSms,
};