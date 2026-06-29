const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log("MONGO_URI:", process.env.MONGO_URI);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 7+ doesn't need these flags, but they don't hurt
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
   } catch (error) {
  console.error("========== MONGODB ERROR ==========");
  console.error(error);
  console.error("Name:", error.name);
  console.error("Message:", error.message);
  console.error("Code:", error.code);
  console.error("Cause:", error.cause);
  console.error("===================================");
  process.exit(1);
}
};

// Log any future connection issues after initial connect
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});
mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

module.exports = connectDB;