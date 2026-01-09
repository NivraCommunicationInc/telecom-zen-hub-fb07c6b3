import { useAuth } from "@/hooks/useAuth";

/**
 * Role-based access hook - ADMIN ONLY
 * 
 * All staff roles (employee, technician, client) have been removed.
 * Only admin role remains for this internal management system.
 */
type AppRole = "admin";

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

const adminPermissions: RolePermissions = {
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
};

export const useRoleAccess = () => {
  const { role } = useAuth();

  // Only admin role exists - all others redirect to login
  const isAdmin = role === "admin";

  // Legacy flags - always false (staff/client roles removed)
  const isEmployee = false;
  const isTechnician = false;
  const isClient = false;

  // Mask card number - admin sees full details
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
    role: isAdmin ? "admin" as AppRole : null,
    permissions: isAdmin ? adminPermissions : null,
    isAdmin,
    isEmployee, // Always false
    isTechnician, // Always false
    isClient, // Always false
    maskCardNumber,
    formatCardDisplay,
  };
};
