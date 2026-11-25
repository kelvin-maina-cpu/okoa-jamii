import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  type Row = Record<string, any>;
  const rows = new Map<string, Row>();
  let version = 0;
  let hasLegacy = false;
  const legacyRows = [{
    local_id: 'legacy-client-001', endpoint: 'sos',
    payload: JSON.stringify({ incidentType: 'other', description: 'Legacy saved SOS', location: { latitude: 1, longitude: 2 }, occurredAt: '2026-11-25T10:00:00.000Z', clientGeneratedId: 'legacy-client-001' }),
    created_at: '2026-11-25T10:00:00.000Z', sync_state: 'pending', attempt_count: 2, last_error: null,
  }];
  const columns = new Set(['local_id', 'client_generated_id', 'incident_type', 'description', 'latitude', 'longitude', 'created_at', 'sync_status', 'retry_count', 'last_attempt_at', 'server_incident_id', 'error_message', 'endpoint', 'payload']);
  const db = {
    execSync(sql: string) {
      const setVersion = sql.match(/PRAGMA user_version = (\d+)/);
      if (setVersion) version = Number(setVersion[1]);
      const added = sql.match(/ALTER TABLE incidents ADD COLUMN ([a-z_]+)/);
      if (added) columns.add(added[1]);
    },
    getFirstSync(sql: string, values: unknown[] = []) {
      if (sql.includes('PRAGMA user_version')) return { user_version: version };
      if (sql.includes('sqlite_master')) return hasLegacy ? { name: 'pending_incidents' } : null;
      if (sql.includes('COUNT(*)')) return { count: [...rows.values()].filter((row) => row.reporter_id == null && row.sync_status !== 'synced').length };
      if (sql.includes('WHERE local_id =')) return rows.get(String(values[0])) ?? null;
      if (sql.includes('WHERE client_generated_id =')) return [...rows.values()].find((row) => row.client_generated_id === values[0] && row.reporter_id === values[1]) ?? null;
      return null;
    },
    getAllSync(sql: string, values: unknown[] = []) {
      if (sql.includes('PRAGMA table_info')) return [...columns].map((name) => ({ name }));
      if (sql.includes('pending_incidents')) return legacyRows;
      const selected = [...rows.values()].filter((row) => {
        if (sql.includes('reporter_id = ? AND sync_status')) return row.reporter_id === values[0] && ['pending_sync', 'failed'].includes(row.sync_status);
        if (sql.includes('reporter_id = ?')) return row.reporter_id === values[0];
        return true;
      });
      return selected.sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    runSync(sql: string, values: unknown[] = []) {
      if (sql.includes('INSERT OR IGNORE INTO incidents')) {
        const legacy = values.length === 12;
        const [local_id, client_generated_id, incident_type, description, latitude, longitude, created_at] = values;
        const endpoint = legacy ? values[10] : values[7];
        const payload = legacy ? values[11] : values[8];
        const reporter_id = legacy ? null : values[9];
        const sync_status = legacy ? values[7] : 'pending_sync';
        const retry_count = legacy ? values[8] : 0;
        const error_message = legacy ? values[9] : null;
        if (rows.has(String(local_id))) return { changes: 0 };
        rows.set(String(local_id), { local_id, client_generated_id, incident_type, description, latitude, longitude, created_at, endpoint, payload, reporter_id, sync_status, retry_count, last_attempt_at: null, server_incident_id: null, error_message });
        return { changes: 1 };
      }
      const local_id = String(values.at(-1));
      const row = rows.get(local_id);
      if (sql.includes("SET sync_status = 'syncing'")) {
        if (!row || !['pending_sync', 'failed'].includes(row.sync_status)) return { changes: 0 };
        row.sync_status = 'syncing'; row.retry_count += 1; row.last_attempt_at = values[0]; row.error_message = null;
        return { changes: 1 };
      }
      if (sql.includes("SET sync_status = 'synced'")) { if (!row || row.sync_status !== 'syncing') return { changes: 0 }; row.sync_status = 'synced'; row.server_incident_id = values[0]; row.error_message = null; return { changes: 1 }; }
      if (sql.includes("SET sync_status = 'pending_sync', error_message")) { if (!row) return { changes: 0 }; row.sync_status = 'pending_sync'; row.error_message = values[0]; return { changes: 1 }; }
      if (sql.includes("SET sync_status = 'failed'")) { if (!row) return { changes: 0 }; row.sync_status = 'failed'; row.error_message = values[0]; return { changes: 1 }; }
      if (sql.includes("SET sync_status = 'pending_sync' WHERE sync_status")) { for (const item of rows.values()) if (item.sync_status === 'syncing') item.sync_status = 'pending_sync'; return { changes: 1 }; }
      if (sql.includes('DELETE FROM incidents')) { if (row?.sync_status !== 'synced') return { changes: 0 }; rows.delete(local_id); return { changes: 1 }; }
      if (sql.includes('UPDATE incidents SET incident_type')) {
        const [incident_type, description, latitude, longitude, endpoint, payload, clientId, ownerId] = values;
        const found = [...rows.values()].find((item) => item.client_generated_id === clientId && item.reporter_id === ownerId && ['pending_sync', 'failed'].includes(item.sync_status));
        if (!found) return { changes: 0 };
        Object.assign(found, { incident_type, description, latitude, longitude, endpoint, payload });
        return { changes: 1 };
      }
      return { changes: 0 };
    },
  };
  return { db, rows, columns, getVersion: () => version, enableLegacy: () => { hasLegacy = true; }, reset: () => { rows.clear(); version = 0; hasLegacy = false; columns.delete('reporter_id'); } };
});

vi.mock('expo-sqlite', () => ({ openDatabaseSync: () => fake.db }));

const payload = {
  incidentType: 'other' as const,
  description: 'Test incident at the market',
  location: { latitude: -1.2, longitude: 36.8 },
  occurredAt: '2026-11-25T10:00:00.000Z',
  clientGeneratedId: 'client-generated-test-01',
};

async function repository() {
  return import('./incidentQueue.js');
}

describe('offline incident SQLite repository', () => {
  beforeEach(() => { fake.reset(); vi.resetModules(); });

  it('initializes the latest schema once and survives repository module reloads', async () => {
    let repo = await repository();
    repo.initializeIncidentDatabase();
    expect(fake.getVersion()).toBe(3);
    await repo.enqueueIncident('incident', payload, 'user-a');
    vi.resetModules();
    repo = await repository();
    expect(await repo.listIncidents('user-a')).toHaveLength(1);
    expect((await repo.listIncidents('user-a'))[0].payload.clientGeneratedId).toBe(payload.clientGeneratedId);
  });

  it('migrates the legacy queue without removing its source rows', async () => {
    fake.enableLegacy();
    const repo = await repository();
    repo.initializeIncidentDatabase();
    expect(fake.getVersion()).toBe(3);
    expect(fake.columns.has('reporter_id')).toBe(true);
    expect(fake.rows.size).toBe(1);
    expect((await repo.getIncident('legacy-client-001'))?.payload.description).toBe('Legacy saved SOS');
    expect(await repo.countUnownedLegacyIncidents()).toBe(1);
    expect(await repo.listSyncCandidates('user-a')).toHaveLength(0);
  });

  it('keeps idempotent local inserts scoped to the owning citizen', async () => {
    const repo = await repository();
    const first = await repo.enqueueIncident('incident', payload, 'user-a');
    const repeated = await repo.enqueueIncident('incident', payload, 'user-a');
    const otherOwner = await repo.enqueueIncident('incident', payload, 'user-b');
    expect(first.localId).toBe(repeated.localId);
    expect(otherOwner.localId).not.toBe(first.localId);
    expect(await repo.listIncidents('user-a')).toHaveLength(1);
    expect(await repo.listIncidents('user-b')).toHaveLength(1);
  });

  it('records retry attempts and stores server confirmation without deleting the local row', async () => {
    const repo = await repository();
    const item = await repo.enqueueIncident('sos', payload, 'user-a');
    expect(await repo.markIncidentAttemptStarted(item.localId)).toBe(true);
    await repo.markIncidentSynced(item.localId, 'server-incident-42');
    const saved = await repo.getIncident(item.localId);
    expect(saved).toMatchObject({ syncStatus: 'synced', retryCount: 1, serverIncidentId: 'server-incident-42' });
    expect(await repo.listIncidents('user-a')).toHaveLength(1);
  });

  it('retains the original client id across retries and never loses a failed request', async () => {
    const repo = await repository();
    const item = await repo.enqueueIncident('sos', payload, 'user-a');
    await repo.markIncidentAttemptStarted(item.localId);
    await repo.markIncidentPending(item.localId, 'Server temporarily unavailable');
    const retry = (await repo.listSyncCandidates('user-a'))[0];
    expect(retry.payload.clientGeneratedId).toBe(payload.clientGeneratedId);
    expect(await repo.markIncidentAttemptStarted(item.localId)).toBe(true);
    await repo.markIncidentPending(item.localId, 'Network request failed');
    expect(await repo.getIncident(item.localId)).toMatchObject({ syncStatus: 'pending_sync', retryCount: 2 });
  });

  it('prevents deleting any report before server confirmation', async () => {
    const repo = await repository();
    const item = await repo.enqueueIncident('incident', payload, 'user-a');
    await expect(repo.deleteIncident(item.localId)).rejects.toThrow('Unsynchronized incidents cannot be deleted');
    expect(await repo.getIncident(item.localId)).not.toBeNull();
  });

  it('allows deletion only after the server id has been saved', async () => {
    const repo = await repository();
    const item = await repo.enqueueIncident('incident', payload, 'user-a');
    await repo.markIncidentAttemptStarted(item.localId);
    await repo.markIncidentSynced(item.localId, 'server-incident-43');
    await expect(repo.deleteIncident(item.localId)).resolves.toBeUndefined();
    expect(await repo.getIncident(item.localId)).toBeNull();
  });
});
