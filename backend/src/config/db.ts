import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartmetrix';

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    console.warn('[Database Notice] Ensure MongoDB is running locally or provide a valid MONGODB_URI in .env');
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB connection disconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`[Database Error] MongoDB connection error: ${err.message}`);
  });
};
