import { IncidentPriority, IncidentStatus, IncidentType } from '../types/incidents';

interface CategoryConfig {
  value: IncidentType;
  label: string;
  shortLabel: string;
}

export const INCIDENT_CATEGORIES: CategoryConfig[] = [
  { value: 'armed attack', label: 'Armed Attack', shortLabel: 'Armed attack' },
  { value: 'livestock theft', label: 'Livestock Theft', shortLabel: 'Livestock theft' },
  { value: 'suspicious activity', label: 'Suspicious Activity', shortLabel: 'Suspicious activity' },
  { value: 'missing person', label: 'Missing Person', shortLabel: 'Missing person' },
  { value: 'medical emergency', label: 'Medical Emergency', shortLabel: 'Medical emergency' },
  { value: 'community threat', label: 'Community Threat', shortLabel: 'Community threat' },
  { value: 'other', label: 'Other', shortLabel: 'Other' },
];

export function getCategoryLabel(type: IncidentType | string): string {
  return INCIDENT_CATEGORIES.find((category) => category.value === type)?.label ?? 'Other';
}

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  pending: 'Pending review',
  acknowledged: 'Acknowledged',
  assigned: 'Responder assigned',
  escalated: 'Escalated',
  resolved: 'Resolved',
};

export const PRIORITY_LABELS: Record<IncidentPriority, string> = {
  low: 'Low priority',
  normal: 'Normal priority',
  high: 'High priority',
  critical: 'Critical priority',
};

export function getStatusLabel(status: IncidentStatus): string {
  return STATUS_LABELS[status] ?? status;
}
