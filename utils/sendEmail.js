const nodemailer = require('nodemailer');

/**
 * Email Utility — Nodemailer
 * --------------------------
 * Sends transactional emails (OTP verification, password reset).
 *
 * Supports two providers based on NODE_ENV:
 *   development  → Ethereal (fake SMTP, catches emails in browser preview)
 *   production   → Gmail / any SMTP (set EMAIL_* env vars)
 *
 * To use Gmail in production:
 *   1. Enable 2FA on your Google account
 *   2. Generate an App Password (Google Account → Security → App Passwords)
 *   3. Set EMAIL_USER=you@gmail.com and EMAIL_PASS=your-app-password in .env
 *
 * To use Ethereal in development (auto-created test account):
 *   Leave EMAIL_USER and EMAIL_PASS empty — a test account is created automatically.
 *   The email preview URL is printed in the terminal.
 */

let transporter = null;

const createTransporter = async () => {
  if (transporter) return transporter;

   // ✅ NEW — uses real Gmail if credentials exist, Ethereal as fallback
   if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // ── Production: use real SMTP credentials ──────────────────────────────
    transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
      port:   parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    // ── Development: Ethereal fake SMTP ───────────────────────────────────
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Ethereal test account:', testAccount.user);
  }

  return transporter;
};

/**
 * sendEmail
 * @param {string} to      - recipient email
 * @param {string} subject - email subject
 * @param {string} html    - HTML body
 */
const sendEmail = async ({ to, subject, html }) => {
  const transport = await createTransporter();

  const info = await transport.sendMail({
    from:    `"MYSALON" <${process.env.EMAIL_USER || 'noreply@mysalon.in'}>`,
    to,
    subject,
    html,
  });

  // In development, log the Ethereal preview URL so you can view the email
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📧 Email preview: ${nodemailer.getTestMessageUrl(info)}`);
  }

  return info;
};

// ── Email templates ────────────────────────────────────────────────────────

/**
 * sendOtpEmail
 * Sends the 6-digit OTP verification email after signup.
 */
const sendOtpEmail = async (to, name, otp) => {
  const subject = `${otp} — Your MYSALON verification code`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Inter, Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0; }
        .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #eee; }
        .header { background: linear-gradient(135deg, #534AB7, #1D9E75); padding: 32px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
        .logo span { color: #A5F3D3; }
        .body { padding: 32px; }
        .greeting { font-size: 16px; color: #333; margin-bottom: 8px; }
        .msg { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 28px; }
        .otp-box { background: #F3F2FE; border: 2px dashed #534AB7; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 28px; }
        .otp { font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #534AB7; }
        .expiry { font-size: 13px; color: #999; margin-top: 8px; }
        .warn { font-size: 13px; color: #888; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; }
        .footer { font-size: 12px; color: #bbb; text-align: center; padding: 20px 32px; border-top: 1px solid #f0f0f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">MY<span>SALON</span></div>
        </div>
        <div class="body">
          <p class="greeting">Hi ${name},</p>
          <p class="msg">
            Welcome to MYSALON! Use the code below to verify your email address and complete your registration.
          </p>
          <div class="otp-box">
            <div class="otp">${otp}</div>
            <div class="expiry">⏱ This code expires in <strong>10 minutes</strong></div>
          </div>
          <div class="warn">
            🔒 Never share this code with anyone. MYSALON will never ask for your OTP.
          </div>
          <p class="msg">If you didn't create a MYSALON account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} MYSALON. Skip the queue, book your chair.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
};

/**
 * sendPasswordResetEmail
 * Sends a reset link with a secure token in the URL.
 */
const sendPasswordResetEmail = async (to, name, resetUrl) => {
  const subject = 'Reset your MYSALON password';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Inter, Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0; }
        .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #eee; }
        .header { background: linear-gradient(135deg, #534AB7, #1D9E75); padding: 32px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; color: #fff; }
        .logo span { color: #A5F3D3; }
        .body { padding: 32px; }
        .msg { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px; }
        .btn { display: inline-block; background: #534AB7; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 14px; }
        .btn-wrap { text-align: center; margin: 28px 0; }
        .expiry { font-size: 13px; color: #999; text-align: center; margin-bottom: 24px; }
        .url-box { background: #f4f4f4; border-radius: 8px; padding: 10px 14px; font-size: 11px; color: #888; word-break: break-all; margin-bottom: 24px; }
        .footer { font-size: 12px; color: #bbb; text-align: center; padding: 20px 32px; border-top: 1px solid #f0f0f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">MY<span>SALON</span></div>
        </div>
        <div class="body">
          <p class="msg">Hi ${name},</p>
          <p class="msg">
            We received a request to reset the password for your MYSALON account.
            Click the button below to set a new password:
          </p>
          <div class="btn-wrap">
            <a href="${resetUrl}" class="btn">Reset My Password</a>
          </div>
          <p class="expiry">⏱ This link expires in <strong>1 hour</strong>.</p>
          <p class="msg" style="font-size:13px;">If the button doesn't work, copy and paste this link:</p>
          <div class="url-box">${resetUrl}</div>
          <p class="msg" style="font-size:13px;color:#999;">
            If you didn't request a password reset, you can safely ignore this email.
            Your password will not change.
          </p>
        </div>
        <div class="footer">© ${new Date().getFullYear()} MYSALON. Skip the queue, book your chair.</div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html });
};

module.exports = { sendEmail, sendOtpEmail, sendPasswordResetEmail };