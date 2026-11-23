import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import { User, Incident, CommunityAlert, AuditLog } from './models/index.js';

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Development seed data must not run in production');
  await connectDatabase();

  const passwordHash = await bcrypt.hash('DevelopmentOnly123!', 12);
  const users = await Promise.all([
    User.findOneAndUpdate({ email: 'citizen@example.test' }, { $set: { fullName: '[TEST] Citizen', email: 'citizen@example.test', passwordHash, role: 'Citizen' } }, { upsert: true, new: true }),
    User.findOneAndUpdate({ email: 'officer@example.test' }, { $set: { fullName: '[TEST] Security Officer', email: 'officer@example.test', passwordHash, role: 'Security Officer' } }, { upsert: true, new: true }),
  ]);

  const [citizen, officer] = users;
  const incident = await Incident.findOneAndUpdate(
    { clientGeneratedId: 'DEV-TEST-INCIDENT-001' },
    { $setOnInsert: { incidentType: 'suspicious activity', description: '[TEST DATA] Suspicious activity near test market.', reporterId: citizen._id, location: { type: 'Point', coordinates: [36.8219, -1.2921] }, addressOrArea: '[TEST] Nairobi Central', status: 'pending', priority: 'normal', source: 'mobile', clientGeneratedId: 'DEV-TEST-INCIDENT-001' } },
    { upsert: true, new: true },
  );
  await CommunityAlert.findOneAndUpdate({ title: '[TEST] Community safety notice' }, { $setOnInsert: { title: '[TEST] Community safety notice', message: '[TEST DATA] Demonstration community alert only.', targetArea: '[TEST] Nairobi Central', createdBy: officer._id, publishedAt: new Date() } }, { upsert: true, new: true });
  await AuditLog.findOneAndUpdate({ resourceId: String(incident._id), action: 'seed.created' }, { $setOnInsert: { actorId: officer._id, action: 'seed.created', resourceType: 'Incident', resourceId: incident._id, metadata: { testData: true } } }, { upsert: true, new: true });

  console.log('Development seed data created. All records are test data.');
  await mongoose.disconnect();
}

seed().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
