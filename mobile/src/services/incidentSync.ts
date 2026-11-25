import { ApiError } from './apiClient';
import { createIncident, createSos } from './incidentApi';
import {
  listQueuedIncidents,
  markQueuedIncidentFailed,
  removeQueuedIncident,
} from './incidentQueue';

export interface SyncSummary {
  synced: number;
  failed: number;
  remaining: number;
}

export function describeSubmissionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401) return 'Your session has expired. Sign in again, then retry.';
    if (error.statusCode === 403) return 'You are not allowed to submit this report.';
    if (error.statusCode === 429) return 'Too many submissions. Wait a moment and retry.';
    if (error.statusCode >= 500) return 'The server is temporarily unavailable. Retry shortly.';
    return error.message;
  }
  return 'No network connection. The report is stored on this device.';
}

export async function syncQueuedIncidents(accessToken: string): Promise<SyncSummary> {
  const queued = await listQueuedIncidents();
  let synced = 0;
  let failed = 0;

  for (const item of queued) {
    try {
      if (item.endpoint === 'sos') {
        await createSos(item.payload, accessToken);
      } else {
        await createIncident(item.payload, accessToken);
      }
      await removeQueuedIncident(item.localId);
      synced += 1;
    } catch (error) {
      await markQueuedIncidentFailed(item.localId, describeSubmissionError(error));
      failed += 1;
    }
  }

  return {
    synced,
    failed,
    remaining: queued.length - synced,
  };
}
