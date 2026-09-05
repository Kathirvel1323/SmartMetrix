import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI ||
    (process.env.NODE_ENV !== 'production' ? 'mongodb://localhost:27017/smartmetrix' : '');

  if (!mongoURI) {
    throw new Error('MONGODB_URI is required in production');
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    throw error;
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB connection disconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`[Database Error] MongoDB connection error: ${err.message}`);
  });
};
