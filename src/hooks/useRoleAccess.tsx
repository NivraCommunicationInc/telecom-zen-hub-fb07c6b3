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
  },
  employee: {
    canViewFullCardDetails: false, // Only last 4 digits
    canViewLastFourOnly: true,
    canUpdatePaymentStatus: true, // Can update status but not see full card
    canViewActivityLogs: false, // Cannot view logs
    canViewInternalNotes: false,
    canManageClients: true,
    canManageOrders: true,
    canExportData: false,
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
  },
  client: {
    canViewFullCardDetails: false,
    canViewLastFourOnly: true, // Own cards only
    canUpdatePaymentStatus: false,
    canViewActivityLogs: false,
    canViewInternalNotes: false,
    canManageClients: false,
    canManageOrders: false,
    canExportData: false,
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
