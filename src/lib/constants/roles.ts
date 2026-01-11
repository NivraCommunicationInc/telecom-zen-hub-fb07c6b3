/**
 * User Roles Constants - Single Source of Truth
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
  TECHNICIAN: 'technician',
  CLIENT: 'client',
  SYSTEM: 'system',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Roles that can access admin panel
export const ADMIN_PANEL_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
];

// Roles that can modify client data
export const CLIENT_MODIFIER_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
];

// Roles that can record payments
export const PAYMENT_RECORDER_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
  USER_ROLES.SYSTEM,
];

// Human-readable labels (French)
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLES.ADMIN]: 'Administrateur',
  [USER_ROLES.EMPLOYEE]: 'Employé',
  [USER_ROLES.TECHNICIAN]: 'Technicien',
  [USER_ROLES.CLIENT]: 'Client',
  [USER_ROLES.SYSTEM]: 'Système',
};
