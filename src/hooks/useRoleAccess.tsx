import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "employee" | "technician" | "client";

interface RolePermissions {
  canViewFullCardDetails: boolean;
  canViewLastFourOnly: boolean;
  canUpdatePaymentStatus: boolean;
  canViewActivityLogs: boolean;
  canViewInternalNotes: boolean;
  canManageClients: boolean;
  canManageOrders: boolean;
  canExportData: boolean;
  // Appointment permissions
  canViewAllAppointments: boolean;
  canModifyAppointments: boolean;
  canCancelAppointments: boolean;
  canAssignTechnicians: boolean;
  canUpdateInstallationStatus: boolean;
  canAddInternalNotes: boolean;
  // ── Privilege separation (added 2026-05) — admin-only actions ───────────
  // Employees previously inherited every admin power. These flags let us
  // hide irreversible / financial / configuration buttons from non-admins
  // even when they're working in shared Core pages. Server-side enforcement
  // still uses has_role() in RLS; this is the UI layer.
  canSuspendAccount: boolean;        // suspend / reactivate an account
  canCancelSubscription: boolean;    // cancel an active subscription
  canDeleteRecords: boolean;         // delete invoices, payments, etc.
  canIssueRefund: boolean;           // process a refund
  canIssueManualCredit: boolean;     // apply account_adjustment credit
  canViewFinancialReports: boolean;  // MRR, P&L, cashflow
  canManageRoles: boolean;           // grant / revoke user_roles
  canManageBilling: boolean;         // edit billing config, tax rules
  canImpersonateClient: boolean;     // /admin/clients impersonation
  canTriggerBulkActions: boolean;    // mass email, bulk suspension, etc.
}

const rolePermissions: Record<AppRole, RolePermissions> = {
  admin: {
    canViewFullCardDetails: true,
    canViewLastFourOnly: true,
    canUpdatePaymentStatus: true,
    canViewActivityLogs: true,
    canViewInternalNotes: true,
    canManageClients: true,
    canManageOrders: true,
    canExportData: true,
    canViewAllAppointments: true,
    canModifyAppointments: true,
    canCancelAppointments: true,
    canAssignTechnicians: true,
    canUpdateInstallationStatus: true,
    canAddInternalNotes: true,
    // Admin has every privileged action.
    canSuspendAccount: true,
    canCancelSubscription: true,
    canDeleteRecords: true,
    canIssueRefund: true,
    canIssueManualCredit: true,
    canViewFinancialReports: true,
    canManageRoles: true,
    canManageBilling: true,
    canImpersonateClient: true,
    canTriggerBulkActions: true,
  },
  employee: {
    // Employee has READ-heavy access + lightweight ops. NO destructive,
    // NO financial, NO config powers. If they need those, they escalate
    // to an admin (the EscalationRequestDialog in Employee portal exists
    // precisely for this).
    canViewFullCardDetails: false, // see only last 4
    canViewLastFourOnly: true,
    canUpdatePaymentStatus: true,
    canViewActivityLogs: true,
    canViewInternalNotes: true,
    canManageClients: true,
    canManageOrders: true,
    canExportData: false,           // raised: admin-only (privacy / Loi 25)
    canViewAllAppointments: true,
    canModifyAppointments: true,
    canCancelAppointments: false,   // raised: admins
    canAssignTechnicians: true,
    canUpdateInstallationStatus: true,
    canAddInternalNotes: true,
    // Privilege separation — employee CANNOT do any of these.
    canSuspendAccount: false,
    canCancelSubscription: false,
    canDeleteRecords: false,
    canIssueRefund: false,
    canIssueManualCredit: false,
    canViewFinancialReports: false,
    canManageRoles: false,
    canManageBilling: false,
    canImpersonateClient: false,
    canTriggerBulkActions: false,
  },
  technician: {
    canViewFullCardDetails: false,
    canViewLastFourOnly: false,
    canUpdatePaymentStatus: false,
    canViewActivityLogs: false,
    canViewInternalNotes: false,
    canManageClients: false,
    canManageOrders: false,
    canExportData: false,
    canViewAllAppointments: false,
    canModifyAppointments: false,
    canCancelAppointments: false,
    canAssignTechnicians: false,
    canUpdateInstallationStatus: true,
    canAddInternalNotes: false,
    canSuspendAccount: false,
    canCancelSubscription: false,
    canDeleteRecords: false,
    canIssueRefund: false,
    canIssueManualCredit: false,
    canViewFinancialReports: false,
    canManageRoles: false,
    canManageBilling: false,
    canImpersonateClient: false,
    canTriggerBulkActions: false,
  },
  client: {
    canViewFullCardDetails: false,
    canViewLastFourOnly: true,
    canUpdatePaymentStatus: false,
    canViewActivityLogs: false,
    canViewInternalNotes: false,
    canManageClients: false,
    canManageOrders: false,
    canExportData: false,
    canViewAllAppointments: false,
    canModifyAppointments: false,
    canCancelAppointments: false,
    canAssignTechnicians: false,
    canUpdateInstallationStatus: false,
    canAddInternalNotes: false,
    canSuspendAccount: false,
    canCancelSubscription: false,
    canDeleteRecords: false,
    canIssueRefund: false,
    canIssueManualCredit: false,
    canViewFinancialReports: false,
    canManageRoles: false,
    canManageBilling: false,
    canImpersonateClient: false,
    canTriggerBulkActions: false,
  },
};

export const useRoleAccess = () => {
  const { role } = useAuth();

  const currentRole = (role as AppRole) || "client";
  const permissions = rolePermissions[currentRole] || rolePermissions.client;

  const isAdmin = currentRole === "admin";
  const isEmployee = currentRole === "employee";
  const isTechnician = currentRole === "technician";
  const isClient = currentRole === "client";

  // Mask card number based on role
  const maskCardNumber = (cardNumber: string): string => {
    if (!cardNumber) return "";
    
    // Admin sees full card number
    if (isAdmin) {
      return cardNumber;
    }
    
    // Employee sees only last 4 digits
    if (isEmployee) {
      const lastFour = cardNumber.slice(-4);
      return `****${lastFour}`;
    }
    
    // Everyone else (including clients for their own cards) sees masked
    const lastFour = cardNumber.slice(-4);
    return `****${lastFour}`;
  };

  // Format display for card in UI
  const formatCardDisplay = (cardType: string, lastFour: string): string => {
    return `${cardType} •••• ${lastFour}`;
  };

  return {
    role: currentRole,
    permissions,
    isAdmin,
    isEmployee,
    isTechnician,
    isClient,
    maskCardNumber,
    formatCardDisplay,
  };
};
