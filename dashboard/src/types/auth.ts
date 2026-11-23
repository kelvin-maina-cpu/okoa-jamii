export type UserRole =
  | 'Citizen'
  | 'Community Leader'
  | 'Security Officer'
  | 'County Administrator'
  | 'Super Administrator';

export interface AuthUser {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  preferredLanguage: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Permission =
  | 'viewIncidents'
  | 'acknowledgeIncidents'
  | 'assignIncidents'
  | 'escalateIncidents'
  | 'resolveIncidents'
  | 'publishCommunityAlerts'
  | 'manageUsers'
  | 'viewAuditLogs';
