import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import app from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT || 5000;

let server: ReturnType<typeof app.listen> | undefined;

const startServer = async () => {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      console.log(`[SmartMetrix] Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`[SmartMetrix] Health endpoint available at http://localhost:${PORT}/api/health`);
    });
  } catch (error: any) {
    console.error(`[SmartMetrix] Startup aborted: ${error?.message || 'Database connection failed'}`);
    process.exit(1);
  }
};

void startServer();

// Handle graceful shutdown
const gracefulShutdown = () => {
  console.log('\n[SmartMetrix] Received shutdown signal. Closing server...');
  if (!server) {
    process.exit(0);
  }
  server.close(() => {
    console.log('[SmartMetrix] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
