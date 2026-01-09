import { useAuth } from "@/hooks/useAuth";

/**
 * Role-based access hook - ADMIN ONLY
 * 
 * All staff roles (employee, technician) have been removed.
 * Only admin and client roles remain.
 */
type AppRole = "admin" | "client";

interface RolePermissions {
  canViewFullCardDetails: boolean;
  canViewLastFourOnly: boolean;
  canUpdatePaymentStatus: boolean;
  canViewActivityLogs: boolean;
  canViewInternalNotes: boolean;
  canManageClients: boolean;
  canManageOrders: boolean;
  canExportData: boolean;
  canViewAllAppointments: boolean;
  canModifyAppointments: boolean;
  canCancelAppointments: boolean;
  canAssignTechnicians: boolean;
  canUpdateInstallationStatus: boolean;
  canAddInternalNotes: boolean;
  canVerifyPayments: boolean;
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
    canVerifyPayments: true,
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
    canVerifyPayments: false,
  },
};

export const useRoleAccess = () => {
  const { role } = useAuth();

  // Only admin or client - no other roles
  const currentRole: AppRole = role === "admin" ? "admin" : "client";
  const permissions = rolePermissions[currentRole];

  const isAdmin = currentRole === "admin";
  const isClient = currentRole === "client";

  // Legacy flags - always false (staff roles removed)
  const isEmployee = false;
  const isTechnician = false;

  // Mask card number - only admin sees full details
  const maskCardNumber = (cardNumber: string): string => {
    if (!cardNumber) return "";
    if (isAdmin) return cardNumber;
    const lastFour = cardNumber.slice(-4);
    return `****${lastFour}`;
  };

  const formatCardDisplay = (cardType: string, lastFour: string): string => {
    return `${cardType} •••• ${lastFour}`;
  };

  return {
    role: currentRole,
    permissions,
    isAdmin,
    isEmployee, // Always false
    isTechnician, // Always false
    isClient,
    maskCardNumber,
    formatCardDisplay,
  };
};
