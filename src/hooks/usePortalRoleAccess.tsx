import { useClientAuth } from "@/hooks/useClientAuth";

/**
 * Portal-only role access hook.
 * In the client portal, the user is ALWAYS a "client" role.
 * This hook provides consistent permissions for portal users
 * without depending on admin auth context.
 */
export const usePortalRoleAccess = () => {
  const { user, role } = useClientAuth();

  // In portal context, role is always "client"
  const currentRole = role || "client";

  const permissions = {
    canViewFullCardDetails: false,
    canViewLastFourOnly: true, // Own cards only
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
  };

  // Mask card number - clients always see masked
  const maskCardNumber = (cardNumber: string): string => {
    if (!cardNumber) return "";
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
    isAdmin: false,
    isEmployee: false,
    isTechnician: false,
    isClient: true,
    maskCardNumber,
    formatCardDisplay,
    userId: user?.id,
  };
};
