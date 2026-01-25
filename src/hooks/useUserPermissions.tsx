import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// All available permissions in the system
export const ALL_PERMISSIONS = [
  "view_clients",
  "manage_clients",
  "view_orders",
  "manage_orders",
  "view_billing",
  "manage_billing",
  "view_appointments",
  "manage_appointments",
  "view_tickets",
  "manage_tickets",
  "view_logs",
  "view_internal_notes",
  "export_data",
  "manage_staff",
  "manage_streaming",
  "manage_channels",
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export interface PermissionSet {
  view_clients: boolean;
  manage_clients: boolean;
  view_orders: boolean;
  manage_orders: boolean;
  view_billing: boolean;
  manage_billing: boolean;
  view_appointments: boolean;
  manage_appointments: boolean;
  view_tickets: boolean;
  manage_tickets: boolean;
  view_logs: boolean;
  view_internal_notes: boolean;
  export_data: boolean;
  manage_staff: boolean;
  manage_streaming: boolean;
  manage_channels: boolean;
}

// Default permissions by role
export const DEFAULT_PERMISSIONS: Record<string, Partial<PermissionSet>> = {
  admin: {
    view_clients: true,
    manage_clients: true,
    view_orders: true,
    manage_orders: true,
    view_billing: true,
    manage_billing: true,
    view_appointments: true,
    manage_appointments: true,
    view_tickets: true,
    manage_tickets: true,
    view_logs: true,
    view_internal_notes: true,
    export_data: true,
    manage_staff: true,
    manage_streaming: true,
    manage_channels: true,
  },
  employee: {
    view_clients: true,
    manage_clients: false,
    view_orders: true,
    manage_orders: true,
    view_billing: true,
    manage_billing: false,
    view_appointments: true,
    manage_appointments: true,
    view_tickets: true,
    manage_tickets: true,
    view_logs: false,
    view_internal_notes: false,
    export_data: false,
    manage_staff: false,
    manage_streaming: true,
    manage_channels: false,
  },
  technician: {
    view_clients: false,
    manage_clients: false,
    view_orders: false,
    manage_orders: false,
    view_billing: false,
    manage_billing: false,
    view_appointments: true,
    manage_appointments: false,
    view_tickets: true,
    manage_tickets: false,
    view_logs: false,
    view_internal_notes: false,
    export_data: false,
    manage_staff: false,
    manage_streaming: false,
    manage_channels: false,
  },
  client: {
    view_clients: false,
    manage_clients: false,
    view_orders: false,
    manage_orders: false,
    view_billing: false,
    manage_billing: false,
    view_appointments: false,
    manage_appointments: false,
    view_tickets: false,
    manage_tickets: false,
    view_logs: false,
    view_internal_notes: false,
    export_data: false,
    manage_staff: false,
    manage_streaming: false,
    manage_channels: false,
  },
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_clients: "Voir les clients",
  manage_clients: "Gérer les clients",
  view_orders: "Voir les commandes",
  manage_orders: "Gérer les commandes",
  view_billing: "Voir la facturation",
  manage_billing: "Gérer la facturation",
  view_appointments: "Voir les rendez-vous",
  manage_appointments: "Gérer les rendez-vous",
  view_tickets: "Voir les tickets",
  manage_tickets: "Gérer les tickets",
  view_logs: "Voir les logs d'activité",
  view_internal_notes: "Voir les notes internes",
  export_data: "Exporter les données",
  manage_staff: "Gérer le personnel",
  manage_streaming: "Gérer le streaming",
  manage_channels: "Gérer les chaînes TV",
};

export const useUserPermissions = () => {
  const { user, role } = useAuth();

  const { data: permissionsData, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role, permissions")
        .eq("user_id", user.id)
        .in("role", ["admin", "employee", "technician"])
        .maybeSingle();

      if (error) {
        console.error("Error fetching permissions:", error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id,
  });

  const currentRole = (role as string) || "client";
  const defaultPerms = DEFAULT_PERMISSIONS[currentRole] || DEFAULT_PERMISSIONS.client;
  
  // Merge custom permissions over defaults
  const customPerms = (permissionsData?.permissions as Partial<PermissionSet>) || {};
  
  const permissions: PermissionSet = {
    view_clients: customPerms.view_clients ?? defaultPerms.view_clients ?? false,
    manage_clients: customPerms.manage_clients ?? defaultPerms.manage_clients ?? false,
    view_orders: customPerms.view_orders ?? defaultPerms.view_orders ?? false,
    manage_orders: customPerms.manage_orders ?? defaultPerms.manage_orders ?? false,
    view_billing: customPerms.view_billing ?? defaultPerms.view_billing ?? false,
    manage_billing: customPerms.manage_billing ?? defaultPerms.manage_billing ?? false,
    view_appointments: customPerms.view_appointments ?? defaultPerms.view_appointments ?? false,
    manage_appointments: customPerms.manage_appointments ?? defaultPerms.manage_appointments ?? false,
    view_tickets: customPerms.view_tickets ?? defaultPerms.view_tickets ?? false,
    manage_tickets: customPerms.manage_tickets ?? defaultPerms.manage_tickets ?? false,
    view_logs: customPerms.view_logs ?? defaultPerms.view_logs ?? false,
    view_internal_notes: customPerms.view_internal_notes ?? defaultPerms.view_internal_notes ?? false,
    export_data: customPerms.export_data ?? defaultPerms.export_data ?? false,
    manage_staff: customPerms.manage_staff ?? defaultPerms.manage_staff ?? false,
    manage_streaming: customPerms.manage_streaming ?? defaultPerms.manage_streaming ?? false,
    manage_channels: customPerms.manage_channels ?? defaultPerms.manage_channels ?? false,
  };

  const hasPermission = (permission: Permission): boolean => {
    // Admins always have all permissions
    if (currentRole === "admin") return true;
    return permissions[permission] ?? false;
  };

  const hasAnyPermission = (...perms: Permission[]): boolean => {
    return perms.some(p => hasPermission(p));
  };

  const hasAllPermissions = (...perms: Permission[]): boolean => {
    return perms.every(p => hasPermission(p));
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading,
    role: currentRole,
    isAdmin: currentRole === "admin",
    isEmployee: currentRole === "employee",
    isTechnician: currentRole === "technician",
    isClient: currentRole === "client",
  };
};
