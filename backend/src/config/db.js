import mongoose from 'mongoose';

let isConnecting = false;

const connectDB = async (retryIntervalMs = 5000) => {
  if (mongoose.connection.readyState === 1 || isConnecting) {
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI is not set. Database operations will fail.');
    return;
  }

  isConnecting = true;
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    isConnecting = false;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    isConnecting = false;
    // Retry connection instead of crashing the process
    console.log(`⏳ Retrying MongoDB connection in ${retryIntervalMs / 1000}s...`);
    setTimeout(() => connectDB(retryIntervalMs), retryIntervalMs);
  }
};

export default connectDB;
