import { UserRole } from './roles.js';

export type Permission =
  | 'viewIncidents'
  | 'acknowledgeIncidents'
  | 'assignIncidents'
  | 'escalateIncidents'
  | 'resolveIncidents'
  | 'publishCommunityAlerts'
  | 'manageUsers'
  | 'viewAuditLogs';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Citizen: [],
  'Community Leader': ['viewIncidents', 'escalateIncidents', 'publishCommunityAlerts'],
  'Security Officer': ['viewIncidents', 'acknowledgeIncidents', 'assignIncidents', 'resolveIncidents'],
  'County Administrator': [
    'viewIncidents',
    'acknowledgeIncidents',
    'assignIncidents',
    'escalateIncidents',
    'resolveIncidents',
    'publishCommunityAlerts',
    'manageUsers',
    'viewAuditLogs',
  ],
  'Super Administrator': [
    'viewIncidents',
    'acknowledgeIncidents',
    'assignIncidents',
    'escalateIncidents',
    'resolveIncidents',
    'publishCommunityAlerts',
    'manageUsers',
    'viewAuditLogs',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
