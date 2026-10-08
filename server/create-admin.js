import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initDb, query, closeDb } from './db.js';
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
  password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 14)
  throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 14 characters in .env.');
await initDb();
await query(
  'INSERT INTO admins(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET password_hash=$2',
  [email, await bcrypt.hash(password, 12)],
);
console.log('Administrator created. Remove ADMIN_PASSWORD from .env after provisioning.');
await closeDb();
