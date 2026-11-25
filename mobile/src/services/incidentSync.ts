import * as Network from 'expo-network';
import { AppState, AppStateStatus } from 'react-native';
import { ApiError } from './apiClient';
import { createIncident, createSos, getIncident as getServerIncident } from './incidentApi';
import {
  listSyncCandidates, markIncidentAttemptStarted, markIncidentFailed,
  markIncidentPending, markIncidentSynced, resetInterruptedSyncs, listIncidents,
  enqueueIncident, getIncident,
} from './incidentQueue';
import { CreateIncidentInput, IncidentRecord, QueueEndpoint } from '../types/incidents';

export interface SyncSummary { synced: number; failed: number; remaining: number }
export type LocalSubmissionResult =
  | { outcome: 'delivered'; localId: string; incidentId: string; incident?: IncidentRecord }
  | { outcome: 'queued'; localId: string; message: string }
  | { outcome: 'failed'; localId: string; message: string };
const MAX_AUTOMATIC_RETRIES = 8;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const AUTOMATIC_RETRY_MESSAGE = /network request failed|temporarily unavailable|server is busy|request timed out|remains saved for retry|sign in again/i;

let activeSync: Promise<SyncSummary> | null = null;
let networkSubscription: ReturnType<typeof Network.addNetworkStateListener> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let currentToken: string | null = null;
let currentOwnerId: string | null = null;
const syncListeners = new Set<() => void>();

export function subscribeToIncidentSync(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => { syncListeners.delete(listener); };
}

export function retryDelayMs(retryCount: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** Math.max(0, retryCount - 1)));
}

export function describeSubmissionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401) return 'Sign in again to sync this report.';
    if (error.statusCode === 403) return 'This account cannot submit this report.';
    if (error.statusCode === 429) return 'The server is busy. The report remains saved for retry.';
    if (error.statusCode === 408) return 'The request timed out. The report remains saved for retry.';
    if (error.statusCode >= 500) return 'The server is temporarily unavailable. The report remains saved for retry.';
    return error.message;
  }
  return 'Network request failed. The report remains saved on this device.';
}

async function hasInternet(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch { return false; }
}

async function processQueue(accessToken: string, ownerUserId: string, manual: boolean): Promise<SyncSummary> {
  if (!await hasInternet()) return { synced: 0, failed: 0, remaining: (await listIncidents(ownerUserId)).filter((i) => i.syncStatus !== 'synced').length };
  const candidates = await listSyncCandidates(ownerUserId);
  let synced = 0;
  let failed = 0;
  for (const item of candidates) {
    if (!manual && item.retryCount >= MAX_AUTOMATIC_RETRIES) continue;
    if (!manual && item.syncStatus === 'failed' && item.errorMessage && !AUTOMATIC_RETRY_MESSAGE.test(item.errorMessage)) continue;
    if (!manual && item.lastAttemptAt && Date.now() - Date.parse(item.lastAttemptAt) < retryDelayMs(item.retryCount)) continue;
    if (!await markIncidentAttemptStarted(item.localId)) continue;
    try {
      const result = item.endpoint === 'sos'
        ? await createSos(item.payload, accessToken)
        : await createIncident(item.payload, accessToken);
      if (!result.incident?.id || result.incident.clientGeneratedId !== item.payload.clientGeneratedId) {
        throw new Error('The server response did not confirm this report ID.');
      }
      await markIncidentSynced(item.localId, result.incident.id);
      synced += 1;
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode >= 500 || error.statusCode === 429 || error.statusCode === 408) {
        await markIncidentPending(item.localId, describeSubmissionError(error));
      } else {
        await markIncidentFailed(item.localId, describeSubmissionError(error));
      }
      failed += 1;
      // Avoid hammering an unavailable server during a batch.
      if (!(error instanceof ApiError) || error.statusCode >= 500 || error.statusCode === 429 || error.statusCode === 408) break;
    }
  }
  const remaining = (await listIncidents(ownerUserId)).filter((i) => i.syncStatus !== 'synced').length;
  return { synced, failed, remaining };
}

export function syncQueuedIncidents(accessToken: string, ownerUserId: string, options: { manual?: boolean } = {}): Promise<SyncSummary> {
  if (activeSync) return activeSync;
  activeSync = processQueue(accessToken, ownerUserId, options.manual === true).then((summary) => {
    for (const listener of syncListeners) listener();
    return summary;
  }).finally(() => { activeSync = null; });
  return activeSync;
}

/** Persist first, then hand the durable row to the same locked sync worker used by connectivity events. */
export async function submitIncidentLocallyFirst(
  endpoint: QueueEndpoint, payload: CreateIncidentInput, accessToken: string, ownerUserId: string,
): Promise<LocalSubmissionResult> {
  const local = await enqueueIncident(endpoint, payload, ownerUserId);
  await syncQueuedIncidents(accessToken, ownerUserId, { manual: true });
  const saved = await getIncident(local.localId);
  if (saved?.syncStatus === 'synced' && saved.serverIncidentId) {
    try {
      const response = await getServerIncident(saved.serverIncidentId, accessToken);
      return { outcome: 'delivered', localId: saved.localId, incidentId: saved.serverIncidentId, incident: response.incident };
    } catch {
      return { outcome: 'delivered', localId: saved.localId, incidentId: saved.serverIncidentId };
    }
  }
  const message = saved?.errorMessage ?? 'Saved on this device. The server has not confirmed receipt.';
  const retryable = !saved?.errorMessage || AUTOMATIC_RETRY_MESSAGE.test(saved.errorMessage);
  return retryable
    ? { outcome: 'queued', localId: local.localId, message }
    : { outcome: 'failed', localId: local.localId, message };
}

async function runAutomaticSync(): Promise<void> {
  if (!currentToken || !currentOwnerId || !await hasInternet()) return;
  try { await syncQueuedIncidents(currentToken, currentOwnerId); } catch { /* Keep the durable row for a later retry. */ }
  scheduleRetry();
}

function scheduleRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (!currentToken || !currentOwnerId) return;
  void listSyncCandidates(currentOwnerId).then((items) => {
    const retryable = items.filter((item) => item.retryCount < MAX_AUTOMATIC_RETRIES &&
      (item.syncStatus !== 'failed' || !item.errorMessage || AUTOMATIC_RETRY_MESSAGE.test(item.errorMessage)));
    if (!retryable.length) return;
    const now = Date.now();
    const nextDue = Math.min(...retryable.map((item) => item.lastAttemptAt
      ? Date.parse(item.lastAttemptAt) + retryDelayMs(item.retryCount)
      : now));
    retryTimer = setTimeout(() => { void runAutomaticSync(); }, Math.max(250, nextDue - now));
  }).catch(() => undefined);
}

/** Start listeners once per authenticated app session. Stop them on logout/token change. */
export async function startIncidentSyncManager(accessToken: string, ownerUserId: string): Promise<void> {
  stopIncidentSyncManager();
  currentToken = accessToken;
  currentOwnerId = ownerUserId;
  await resetInterruptedSyncs();
  if (currentToken !== accessToken || currentOwnerId !== ownerUserId) return;
  networkSubscription = Network.addNetworkStateListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) void runAutomaticSync();
  });
  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') void runAutomaticSync();
  });
  await runAutomaticSync();
}

export function stopIncidentSyncManager(): void {
  currentToken = null;
  currentOwnerId = null;
  networkSubscription?.remove(); networkSubscription = null;
  appStateSubscription?.remove(); appStateSubscription = null;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}
