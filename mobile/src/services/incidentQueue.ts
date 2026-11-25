import * as SQLite from 'expo-sqlite';
import { CreateIncidentInput, QueueEndpoint, QueuedIncident } from '../types/incidents';

const DATABASE_NAME = 'okoa-jamii-incidents.db';

interface QueueRow {
  local_id: string;
  endpoint: string;
  payload: string;
  created_at: string;
  sync_state: string;
  attempt_count: number;
  last_error: string | null;
}

let database: SQLite.SQLiteDatabase | null = null;

function getDatabase(): SQLite.SQLiteDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync(DATABASE_NAME);
    database.execSync(`
      CREATE TABLE IF NOT EXISTS pending_incidents (
        local_id TEXT PRIMARY KEY NOT NULL,
        endpoint TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sync_state TEXT NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
    `);
  }
  return database;
}

function toQueuedIncident(row: QueueRow): QueuedIncident {
  return {
    localId: row.local_id,
    endpoint: row.endpoint === 'sos' ? 'sos' : 'incident',
    payload: JSON.parse(row.payload) as CreateIncidentInput,
    createdAt: row.created_at,
    syncState: row.sync_state === 'failed' ? 'failed' : 'pending',
    attemptCount: row.attempt_count,
    lastError: row.last_error ?? undefined,
  };
}

export async function enqueueIncident(
  endpoint: QueueEndpoint,
  payload: CreateIncidentInput,
): Promise<QueuedIncident> {
  const createdAt = new Date().toISOString();
  const db = getDatabase();

  db.runSync(
    `INSERT OR REPLACE INTO pending_incidents
      (local_id, endpoint, payload, created_at, sync_state, attempt_count, last_error)
     VALUES (?, ?, ?, ?, 'pending', 0, NULL)`,
    [payload.clientGeneratedId, endpoint, JSON.stringify(payload), createdAt],
  );

  return {
    localId: payload.clientGeneratedId,
    endpoint,
    payload,
    createdAt,
    syncState: 'pending',
    attemptCount: 0,
  };
}

export async function listQueuedIncidents(): Promise<QueuedIncident[]> {
  const rows = getDatabase().getAllSync<QueueRow>(
    'SELECT * FROM pending_incidents ORDER BY created_at DESC',
  );
  return rows.map(toQueuedIncident);
}

export async function getQueuedIncident(localId: string): Promise<QueuedIncident | null> {
  const row = getDatabase().getFirstSync<QueueRow>(
    'SELECT * FROM pending_incidents WHERE local_id = ?',
    [localId],
  );
  return row ? toQueuedIncident(row) : null;
}

export async function markQueuedIncidentFailed(localId: string, errorMessage: string): Promise<void> {
  getDatabase().runSync(
    `UPDATE pending_incidents
     SET sync_state = 'failed',
         attempt_count = attempt_count + 1,
         last_error = ?
     WHERE local_id = ?`,
    [errorMessage.slice(0, 500), localId],
  );
}

export async function removeQueuedIncident(localId: string): Promise<void> {
  getDatabase().runSync('DELETE FROM pending_incidents WHERE local_id = ?', [localId]);
}
