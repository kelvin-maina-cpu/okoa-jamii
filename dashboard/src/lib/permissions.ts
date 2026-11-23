import { Permission, UserRole } from '../types/auth';

export const ADMIN_ROLES: UserRole[] = [
  'Community Leader',
  'Security Officer',
  'County Administrator',
  'Super Administrator',
];

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

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}
