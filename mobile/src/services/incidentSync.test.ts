import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateIncidentInput, QueuedIncident } from '../types/incidents';

const mocked = vi.hoisted(() => ({
  online: true,
  candidates: [] as QueuedIncident[],
  records: [] as QueuedIncident[],
  networkListener: undefined as ((state: { isConnected?: boolean; isInternetReachable?: boolean }) => void) | undefined,
  getNetworkStateAsync: vi.fn(),
  addNetworkStateListener: vi.fn(),
  createIncident: vi.fn(),
  createSos: vi.fn(),
  getServerIncident: vi.fn(),
  getLocalIncident: vi.fn(),
  listSyncCandidates: vi.fn(),
  listIncidents: vi.fn(),
  markIncidentAttemptStarted: vi.fn(),
  markIncidentFailed: vi.fn(),
  markIncidentPending: vi.fn(),
  markIncidentSynced: vi.fn(),
  resetInterruptedSyncs: vi.fn(),
  enqueueIncident: vi.fn(),
}));

vi.mock('expo-network', () => ({
  getNetworkStateAsync: mocked.getNetworkStateAsync,
  addNetworkStateListener: mocked.addNetworkStateListener,
}));
vi.mock('./incidentApi', () => ({
  createIncident: mocked.createIncident,
  createSos: mocked.createSos,
  getIncident: mocked.getServerIncident,
}));
vi.mock('./incidentQueue', () => ({
  listSyncCandidates: mocked.listSyncCandidates,
  listIncidents: mocked.listIncidents,
  markIncidentAttemptStarted: mocked.markIncidentAttemptStarted,
  markIncidentFailed: mocked.markIncidentFailed,
  markIncidentPending: mocked.markIncidentPending,
  markIncidentSynced: mocked.markIncidentSynced,
  resetInterruptedSyncs: mocked.resetInterruptedSyncs,
  enqueueIncident: mocked.enqueueIncident,
  getIncident: mocked.getLocalIncident,
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));

const payload: CreateIncidentInput = {
  incidentType: 'other', description: 'Urgent report near the market',
  location: { latitude: -1.2, longitude: 36.8 }, occurredAt: '2026-11-25T10:00:00.000Z',
  clientGeneratedId: 'stable-client-id-0001',
};
const queued: QueuedIncident = {
  localId: 'user-a:stable-client-id-0001', reporterId: 'user-a', endpoint: 'incident', payload,
  createdAt: payload.occurredAt, syncStatus: 'pending_sync', retryCount: 0,
};

async function syncModule() { return import('./incidentSync.js'); }

describe('offline incident synchronization manager', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocked.online = true;
    mocked.candidates = [{ ...queued }];
    mocked.records = [{ ...queued }];
    mocked.getNetworkStateAsync.mockImplementation(async () => ({ isConnected: mocked.online, isInternetReachable: mocked.online }));
    mocked.addNetworkStateListener.mockImplementation((listener) => { mocked.networkListener = listener; return { remove: vi.fn() }; });
    mocked.listSyncCandidates.mockImplementation(async () => mocked.candidates);
    mocked.listIncidents.mockImplementation(async () => mocked.records);
    mocked.markIncidentAttemptStarted.mockResolvedValue(true);
    mocked.markIncidentPending.mockResolvedValue(undefined);
    mocked.markIncidentFailed.mockResolvedValue(undefined);
    mocked.markIncidentSynced.mockImplementation(async (localId, serverId) => {
      const record = mocked.records.find((item) => item.localId === localId);
      if (record) { record.syncStatus = 'synced'; record.serverIncidentId = serverId; }
    });
    mocked.getLocalIncident.mockImplementation(async (localId) => mocked.records.find((item) => item.localId === localId) ?? null);
    mocked.getServerIncident.mockResolvedValue({ incident: { id: 'server-id-1', clientGeneratedId: payload.clientGeneratedId } });
    mocked.enqueueIncident.mockImplementation(async (_endpoint, newPayload, ownerId) => {
      const item = { ...queued, localId: `${ownerId}:${newPayload.clientGeneratedId}`, reporterId: ownerId, payload: newPayload };
      mocked.candidates = [item]; mocked.records = [item];
      return item;
    });
    mocked.createIncident.mockResolvedValue({ incident: { id: 'server-id-1', clientGeneratedId: payload.clientGeneratedId }, duplicate: false, message: 'received' });
    mocked.createSos.mockResolvedValue({ incident: { id: 'server-id-1', clientGeneratedId: payload.clientGeneratedId }, duplicate: false, message: 'received' });
  });

  it('leaves reports untouched in airplane mode', async () => {
    mocked.online = false;
    const { syncQueuedIncidents } = await syncModule();
    await expect(syncQueuedIncidents('token', 'user-a')).resolves.toEqual({ synced: 0, failed: 0, remaining: 1 });
    expect(mocked.createIncident).not.toHaveBeenCalled();
    expect(mocked.markIncidentSynced).not.toHaveBeenCalled();
  });

  it('sends the original clientGeneratedId after connectivity returns and records server confirmation', async () => {
    const { syncQueuedIncidents } = await syncModule();
    const result = await syncQueuedIncidents('token', 'user-a');
    expect(result).toEqual({ synced: 1, failed: 0, remaining: 0 });
    expect(mocked.createIncident).toHaveBeenCalledWith(payload, 'token');
    expect(mocked.markIncidentSynced).toHaveBeenCalledWith(queued.localId, 'server-id-1');
  });

  it('writes the incident locally before issuing its first API request', async () => {
    const { submitIncidentLocallyFirst } = await syncModule();
    const result = await submitIncidentLocallyFirst('incident', payload, 'token', 'user-a');
    expect(mocked.enqueueIncident.mock.invocationCallOrder[0]).toBeLessThan(mocked.createIncident.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({ outcome: 'delivered', incidentId: 'server-id-1' });
  });

  it('retains the local record after a server outage for a later retry', async () => {
    const { ApiError } = await import('./apiClient.js');
    mocked.createIncident.mockRejectedValue(new ApiError('Service unavailable', 503));
    const { syncQueuedIncidents } = await syncModule();
    const result = await syncQueuedIncidents('token', 'user-a');
    expect(result.failed).toBe(1);
    expect(mocked.markIncidentPending).toHaveBeenCalledWith(queued.localId, expect.stringContaining('temporarily unavailable'));
    expect(mocked.markIncidentSynced).not.toHaveBeenCalled();
  });

  it('accepts the backend idempotent duplicate response as confirmation of the original report', async () => {
    mocked.createIncident.mockResolvedValue({ incident: { id: 'original-server-id', clientGeneratedId: payload.clientGeneratedId }, duplicate: true, message: 'already received' });
    const { syncQueuedIncidents } = await syncModule();
    await syncQueuedIncidents('token', 'user-a');
    expect(mocked.markIncidentSynced).toHaveBeenCalledWith(queued.localId, 'original-server-id');
  });

  it('uses one worker when two sync triggers arrive together', async () => {
    let finish!: (value: { incident: { id: string; clientGeneratedId: string }; duplicate: boolean; message: string }) => void;
    mocked.createIncident.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { syncQueuedIncidents } = await syncModule();
    const first = syncQueuedIncidents('token', 'user-a');
    const second = syncQueuedIncidents('token', 'user-a', { manual: true });
    expect(second).toBe(first);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    finish({ incident: { id: 'server-id-1', clientGeneratedId: payload.clientGeneratedId }, duplicate: false, message: 'received' });
    await Promise.all([first, second]);
    expect(mocked.createIncident).toHaveBeenCalledTimes(1);
  });

  it('restores interrupted sync state and syncs on a network restored event', async () => {
    mocked.online = false;
    const { startIncidentSyncManager, stopIncidentSyncManager } = await syncModule();
    await startIncidentSyncManager('token', 'user-a');
    expect(mocked.resetInterruptedSyncs).toHaveBeenCalledOnce();
    mocked.online = true;
    mocked.networkListener?.({ isConnected: true, isInternetReachable: true });
    await vi.waitFor(() => expect(mocked.createIncident).toHaveBeenCalledOnce());
    stopIncidentSyncManager();
  });
});
