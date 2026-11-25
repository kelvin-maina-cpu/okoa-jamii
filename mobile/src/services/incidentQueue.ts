import * as SQLite from 'expo-sqlite';
import { CreateIncidentInput, QueueEndpoint, QueuedIncident } from '../types/incidents';

const DATABASE_NAME = 'okoa-jamii-incidents.db';
const SCHEMA_VERSION = 3;

interface IncidentRow {
  local_id: string;
  client_generated_id: string;
  incident_type: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  sync_status: string;
  retry_count: number;
  last_attempt_at: string | null;
  server_incident_id: string | null;
  error_message: string | null;
  reporter_id: string | null;
  endpoint: string;
  payload: string;
}

let database: SQLite.SQLiteDatabase | null = null;

/** Open the persistent database and apply versioned, forward-only migrations. */
export function initializeIncidentDatabase(): SQLite.SQLiteDatabase {
  if (database) return database;
  database = SQLite.openDatabaseSync(DATABASE_NAME);
  try {
  const version = database.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version > SCHEMA_VERSION) throw new Error(`Incident database version ${version} is newer than this app supports.`);

  if (version < 1) {
    database.execSync(`
      CREATE TABLE IF NOT EXISTS incidents (
        local_id TEXT PRIMARY KEY NOT NULL,
        client_generated_id TEXT NOT NULL,
        incident_type TEXT NOT NULL,
        description TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        created_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending_sync'
          CHECK (sync_status IN ('pending_sync', 'syncing', 'synced', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TEXT,
        server_incident_id TEXT,
        error_message TEXT,
        endpoint TEXT NOT NULL CHECK (endpoint IN ('incident', 'sos')),
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS incidents_sync_idx ON incidents(sync_status, created_at);
      PRAGMA user_version = 1;
    `);
  }

  if (version < 2) {
    // Migrate the Phase 3 table in place so updates never discard queued reports.
    const oldTable = database.getFirstSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pending_incidents'",
    );
    if (oldTable) {
      const legacy = database.getAllSync<{
        local_id: string; endpoint: string; payload: string; created_at: string;
        sync_state: string; attempt_count: number; last_error: string | null;
      }>('SELECT * FROM pending_incidents');
      for (const row of legacy) {
        const payload = JSON.parse(row.payload) as CreateIncidentInput;
        database.runSync(
          `INSERT OR IGNORE INTO incidents
           (local_id, client_generated_id, incident_type, description, latitude, longitude, created_at,
            sync_status, retry_count, error_message, endpoint, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.local_id, payload.clientGeneratedId, payload.incidentType, payload.description,
            payload.location?.latitude ?? null, payload.location?.longitude ?? null, row.created_at,
            row.sync_state === 'failed' ? 'failed' : 'pending_sync', row.attempt_count, row.last_error,
            row.endpoint === 'sos' ? 'sos' : 'incident', row.payload],
        );
      }
      // Keep the source table during migration as a recovery copy; no pending data is deleted.
    }
    database.execSync('PRAGMA user_version = 2');
  }
  if (version < 3) {
    const columns = database.getAllSync<{ name: string }>('PRAGMA table_info(incidents)');
    if (!columns.some((column) => column.name === 'reporter_id')) database.execSync('ALTER TABLE incidents ADD COLUMN reporter_id TEXT');
    database.execSync('CREATE UNIQUE INDEX IF NOT EXISTS incidents_reporter_client_idx ON incidents(reporter_id, client_generated_id)');
    database.execSync('PRAGMA user_version = 3');
  }
  return database;
  } catch (error) {
    database = null;
    throw error;
  }
}

function db(): SQLite.SQLiteDatabase { return initializeIncidentDatabase(); }

function toIncident(row: IncidentRow): QueuedIncident {
  return {
    localId: row.local_id,
    reporterId: row.reporter_id ?? undefined,
    endpoint: row.endpoint === 'sos' ? 'sos' : 'incident',
    payload: JSON.parse(row.payload) as CreateIncidentInput,
    createdAt: row.created_at,
    syncStatus: (['pending_sync', 'syncing', 'synced', 'failed'].includes(row.sync_status)
      ? row.sync_status : 'pending_sync') as QueuedIncident['syncStatus'],
    retryCount: row.retry_count,
    lastAttemptAt: row.last_attempt_at ?? undefined,
    serverIncidentId: row.server_incident_id ?? undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

/** Idempotent insert: a repeated enqueue preserves the first durable copy and its retry state. */
export async function enqueueIncident(endpoint: QueueEndpoint, payload: CreateIncidentInput, reporterId: string): Promise<QueuedIncident> {
  const createdAt = new Date().toISOString();
  const localId = `${reporterId}:${payload.clientGeneratedId}`;
  db().runSync(
    `INSERT OR IGNORE INTO incidents
     (local_id, client_generated_id, incident_type, description, latitude, longitude, created_at, endpoint, payload, reporter_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [localId, payload.clientGeneratedId, payload.incidentType, payload.description,
      payload.location?.latitude ?? null, payload.location?.longitude ?? null, createdAt, endpoint, JSON.stringify(payload), reporterId],
  );
  const saved = await getIncident(localId);
  if (!saved) throw new Error('Could not save report to local storage.');
  return saved;
}

export async function listIncidents(reporterId?: string): Promise<QueuedIncident[]> {
  const rows = reporterId
    ? db().getAllSync<IncidentRow>('SELECT * FROM incidents WHERE reporter_id = ? ORDER BY created_at DESC', [reporterId])
    : db().getAllSync<IncidentRow>('SELECT * FROM incidents ORDER BY created_at DESC');
  return rows.map(toIncident);
}

export async function countUnownedLegacyIncidents(): Promise<number> {
  const row = db().getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM incidents WHERE reporter_id IS NULL AND sync_status != 'synced'",
  );
  return row?.count ?? 0;
}

/** Kept as a compatibility alias for existing report UI. */
export async function getIncident(localId: string): Promise<QueuedIncident | null> {
  const row = db().getFirstSync<IncidentRow>('SELECT * FROM incidents WHERE local_id = ?', [localId]);
  return row ? toIncident(row) : null;
}

export async function getIncidentByClientId(clientGeneratedId: string, reporterId: string): Promise<QueuedIncident | null> {
  const row = db().getFirstSync<IncidentRow>('SELECT * FROM incidents WHERE client_generated_id = ? AND reporter_id = ?', [clientGeneratedId, reporterId]);
  return row ? toIncident(row) : null;
}

export async function listSyncCandidates(reporterId: string): Promise<QueuedIncident[]> {
  const rows = db().getAllSync<IncidentRow>(
    "SELECT * FROM incidents WHERE reporter_id = ? AND sync_status IN ('pending_sync', 'failed') ORDER BY created_at ASC",
    [reporterId],
  );
  return rows.map(toIncident);
}

export async function markIncidentAttemptStarted(localId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const result = db().runSync(
    `UPDATE incidents SET sync_status = 'syncing', retry_count = retry_count + 1,
      last_attempt_at = ?, error_message = NULL
     WHERE local_id = ? AND sync_status IN ('pending_sync', 'failed')`, [now, localId],
  );
  return result.changes === 1;
}

export async function markIncidentSynced(localId: string, serverIncidentId: string): Promise<void> {
  if (!serverIncidentId.trim()) throw new Error('A server incident ID is required to mark a report synced.');
  const result = db().runSync(
    `UPDATE incidents SET sync_status = 'synced', server_incident_id = ?, error_message = NULL
     WHERE local_id = ? AND sync_status = 'syncing'`, [serverIncidentId, localId],
  );
  if (result.changes !== 1) throw new Error('Report sync state changed before confirmation was saved.');
}

export async function markIncidentPending(localId: string, message?: string): Promise<void> {
  db().runSync(
    `UPDATE incidents SET sync_status = 'pending_sync', error_message = ?
     WHERE local_id = ? AND sync_status = 'syncing'`, [message?.slice(0, 500) ?? null, localId],
  );
}

export async function markIncidentFailed(localId: string, message: string): Promise<void> {
  db().runSync(
    `UPDATE incidents SET sync_status = 'failed', error_message = ?
     WHERE local_id = ? AND sync_status = 'syncing'`, [message.slice(0, 500), localId],
  );
}

export async function resetInterruptedSyncs(): Promise<void> {
  db().runSync("UPDATE incidents SET sync_status = 'pending_sync' WHERE sync_status = 'syncing'");
}

export async function updateIncident(endpoint: QueueEndpoint, payload: CreateIncidentInput, reporterId: string): Promise<QueuedIncident> {
  const id = payload.clientGeneratedId;
  const result = db().runSync(
    `UPDATE incidents SET incident_type = ?, description = ?, latitude = ?, longitude = ?, endpoint = ?, payload = ?
     WHERE client_generated_id = ? AND reporter_id = ? AND sync_status IN ('pending_sync', 'failed')`,
    [payload.incidentType, payload.description, payload.location?.latitude ?? null, payload.location?.longitude ?? null, endpoint, JSON.stringify(payload), id, reporterId],
  );
  if (result.changes !== 1) throw new Error('Only an unsynchronized incident can be edited.');
  const saved = await getIncident(`${reporterId}:${id}`);
  if (!saved) throw new Error('Incident was not found after update.');
  return saved;
}

/** Deletion is intentionally restricted to confirmed server records. */
export async function deleteIncident(localId: string): Promise<void> {
  const result = db().runSync("DELETE FROM incidents WHERE local_id = ? AND sync_status = 'synced'", [localId]);
  if (result.changes !== 1) throw new Error('Unsynchronized incidents cannot be deleted.');
}

// Deprecated compatibility methods preserve data and funnel all state changes through repository checks.
export async function markQueuedIncidentFailed(localId: string, message: string): Promise<void> {
  const item = await getIncident(localId);
  if (item?.syncStatus === 'pending_sync') await markIncidentAttemptStarted(localId);
  await markIncidentFailed(localId, message);
}
export async function removeQueuedIncident(localId: string): Promise<void> { return deleteIncident(localId); }
