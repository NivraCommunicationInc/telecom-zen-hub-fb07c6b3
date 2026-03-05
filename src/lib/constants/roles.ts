/**
 * User Roles Constants - Single Source of Truth
 * Matches app_role enum in database
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
  TECHNICIAN: 'technician',
  CLIENT: 'client',
  SYSTEM: 'system',
  // Granular staff roles (carrier-grade)
  SALES: 'sales',
  KYC_AGENT: 'kyc_agent',
  BILLING_ADMIN: 'billing_admin',
  TECHOPS: 'techops',
  SUPPORT: 'support',
  SUPERVISOR: 'supervisor',
  // Legacy
  INFLUENCER: 'influencer',
  FIELD_SALES: 'field_sales',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Roles that can access admin panel
export const ADMIN_PANEL_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
  USER_ROLES.SUPERVISOR,
  USER_ROLES.SALES,
  USER_ROLES.KYC_AGENT,
  USER_ROLES.BILLING_ADMIN,
  USER_ROLES.TECHOPS,
  USER_ROLES.SUPPORT,
];

// Roles that can modify client data
export const CLIENT_MODIFIER_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
  USER_ROLES.SUPERVISOR,
];

// Roles that can record payments
export const PAYMENT_RECORDER_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
  USER_ROLES.BILLING_ADMIN,
  USER_ROLES.SYSTEM,
];

// Roles that can manage KYC
export const KYC_MANAGER_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
  USER_ROLES.SUPERVISOR,
  USER_ROLES.KYC_AGENT,
];

// Roles that can manage provisioning
export const PROVISIONING_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
  USER_ROLES.SUPERVISOR,
  USER_ROLES.TECHOPS,
];

// Roles that can create orders (POS)
export const SALES_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
  USER_ROLES.SUPERVISOR,
  USER_ROLES.SALES,
  USER_ROLES.FIELD_SALES,
];

// Roles that can manage support tickets
export const SUPPORT_ROLES: UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.EMPLOYEE,
  USER_ROLES.SUPERVISOR,
  USER_ROLES.SUPPORT,
];

// Human-readable labels (French)
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLES.ADMIN]: 'Administrateur',
  [USER_ROLES.EMPLOYEE]: 'Employé',
  [USER_ROLES.TECHNICIAN]: 'Technicien',
  [USER_ROLES.CLIENT]: 'Client',
  [USER_ROLES.SYSTEM]: 'Système',
  [USER_ROLES.SALES]: 'Ventes',
  [USER_ROLES.KYC_AGENT]: 'Agent KYC',
  [USER_ROLES.BILLING_ADMIN]: 'Admin Facturation',
  [USER_ROLES.TECHOPS]: 'Opérations Techniques',
  [USER_ROLES.SUPPORT]: 'Support',
  [USER_ROLES.SUPERVISOR]: 'Superviseur',
  [USER_ROLES.INFLUENCER]: 'Influenceur',
  [USER_ROLES.FIELD_SALES]: 'Ventes Terrain',
};
