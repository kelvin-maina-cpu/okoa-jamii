import { apiRequest } from './apiClient';
import {
  CreateIncidentInput,
  IncidentListResponse,
  IncidentMutationResponse,
  IncidentRecord,
} from '../types/incidents';

/**
 * Evidence upload infrastructure is not configured yet. We only send metadata
 * to the server and keep the device-local URI in the offline queue, so the
 * confirmation UI can honestly report that evidence has not been uploaded.
 */
function toServerPayload(payload: CreateIncidentInput): CreateIncidentInput {
  return {
    ...payload,
    evidence: payload.evidence?.map(({ uri: _localUri, ...metadata }) => metadata),
  };
}

export function createIncident(payload: CreateIncidentInput, accessToken: string): Promise<IncidentMutationResponse> {
  return apiRequest<IncidentMutationResponse>('/incidents', {
    method: 'POST',
    body: JSON.stringify(toServerPayload(payload)),
    authToken: accessToken,
  });
}

export function createSos(payload: CreateIncidentInput, accessToken: string): Promise<IncidentMutationResponse> {
  return apiRequest<IncidentMutationResponse>('/incidents/sos', {
    method: 'POST',
    body: JSON.stringify(toServerPayload(payload)),
    authToken: accessToken,
  });
}

export function getMyIncidents(
  accessToken: string,
  page = 1,
  limit = 20,
): Promise<IncidentListResponse> {
  return apiRequest<IncidentListResponse>(`/incidents/my-incidents?page=${page}&limit=${limit}`, {
    method: 'GET',
    authToken: accessToken,
  });
}

export function getIncident(incidentId: string, accessToken: string): Promise<{ incident: IncidentRecord }> {
  return apiRequest<{ incident: IncidentRecord }>(`/incidents/${encodeURIComponent(incidentId)}`, {
    method: 'GET',
    authToken: accessToken,
  });
}
