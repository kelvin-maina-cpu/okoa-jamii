import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { IncidentNotification } from '../models/IncidentNotification.js';

async function migrate(): Promise<void> {
  await connectDatabase();
  const collection = IncidentNotification.collection;
  await collection.updateMany({ eventType: { $exists: false } }, { $set: { eventType: 'sos' } });
  const indexes = await collection.indexes();
  for (const index of indexes) {
    const keys = index.key as Record<string, number>;
    if (index.unique && keys.incidentId === 1 && keys.recipient === 1 && keys.channel === 1 && !('eventType' in keys)) {
      await collection.dropIndex(index.name!);
    }
  }
  await collection.createIndex({ incidentId: 1, eventType: 1, recipient: 1, channel: 1 }, { unique: true });
  console.log('Phase 5 incident notification index migration complete.');
}

migrate().catch((error) => {
  console.error('Phase 5 notification migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect(); });
