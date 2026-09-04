import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/user.model';

const seedAdmin = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartmetrix';
  const adminName = process.env.ADMIN_NAME || 'Super Admin';
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('[Admin Seed Error] ADMIN_EMAIL and ADMIN_PASSWORD must be defined in your environment (.env)');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI);
    console.log('[Admin Seed] Connected to MongoDB');

    const normalizedEmail = adminEmail.toLowerCase().trim();
    const existingAdmin = await User.findOne({ email: normalizedEmail });

    if (existingAdmin) {
      console.log(`[Admin Seed Notice] Admin account already exists with email: ${normalizedEmail}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const admin = new User({
      name: adminName.trim(),
      email: normalizedEmail,
      password: adminPassword,
      role: 'ADMIN',
      isActive: true,
      tokenVersion: 0
    });

    await admin.save();
    console.log(`[Admin Seed Success] First ADMIN account successfully created for email: ${normalizedEmail}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error(`[Admin Seed Error] Failed to create admin: ${error.message}`);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedAdmin();
