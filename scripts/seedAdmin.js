/**
 * One-time admin seeder — run with: node scripts/seedAdmin.js
 * Usage: ADMIN_USERNAME=admin ADMIN_PASSWORD=s3cur3! node scripts/seedAdmin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin    = require('../models/Admin');
const connectDB = require('../config/db');

const run = async () => {
  await connectDB();
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'GhostAdmin2025!';
  const existing = await Admin.findOne({ username });
  if (existing) {
    console.log(`[Seed] Admin '${username}' already exists.`);
  } else {
    const passwordHash = await Admin.hashPassword(password);
    await Admin.create({ username, passwordHash, role: 'superadmin' });
    console.log(`[Seed] Admin '${username}' created. Password: ${password}`);
  }
  await mongoose.disconnect();
};

run().catch(console.error);
