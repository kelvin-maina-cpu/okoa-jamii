export const USER_ROLES = [
  'Citizen',
  'Community Leader',
  'Security Officer',
  'County Administrator',
  'Super Administrator',
] as const;

export type UserRole = (typeof USER_ROLES)[number];
