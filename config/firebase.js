const admin = require('firebase-admin');

/**
 * Firebase Admin SDK
 * Used ONLY to verify Firebase ID tokens on the backend.
 * The actual auth (login/signup) happens on the frontend.
 *
 * To get these credentials:
 *   Firebase Console → Project Settings → Service Accounts
 *   → Generate new private key → download JSON
 *   → copy values into your .env file
 */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The private key comes from .env as a string with literal \n
      // We replace them with actual newlines for the SDK to work
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin initialized');
}

module.exports = admin;