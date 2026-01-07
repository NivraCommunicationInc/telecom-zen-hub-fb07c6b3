/**
 * useServerEmployeePermissions - Server-enforced employee permissions
 * 
 * Fetches actual permissions from the employee-operations edge function.
 * This replaces client-side hardcoded permissions with server-authoritative ones.
 */

import { useQuery } from "@tanstack/react-query";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import { employeeClient } from "@/integrations/backend/employeeClient";

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-operations/employee-permissions`;

export type EmployeePermission =
  | "can_view_profiles"
  | "can_view_orders"
  | "can_view_billing"
  | "can_create_tickets"
  | "can_record_payments"
  | "can_manage_streaming"
  | "can_manage_employees"
  | "can_view_audit"
  | "can_view_contracts"
  | "can_view_cancellations"
  | "can_view_disputes";

interface EmployeePermissionsResponse {
  success: boolean;
  permissions: Record<string, boolean>;
  employeeId: string;
  employeeEmail: string;
  employeeName: string;
  error?: string;
}

export const useServerEmployeePermissions = () => {
  const { isEmployee, session } = useEmployeeAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["employee-permissions", session?.user?.id],
    queryFn: async (): Promise<EmployeePermissionsResponse> => {
      const { data: sessionData } = await employeeClient.auth.getSession();
      if (!sessionData.session) {
        throw new Error("No session");
      }

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionData.session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch permissions");
      }

      return response.json();
    },
    enabled: !!isEmployee && !!session,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  const permissions = data?.permissions || {};

  const can = (permission: EmployeePermission): boolean => {
    if (!isEmployee) return false;
    // If permission is not explicitly set, default to true for basic view permissions
    const value = permissions[permission];
    if (value === undefined) {
      // Default permissions for employees
      const defaultTrue = [
        "can_view_profiles",
        "can_view_orders", 
        "can_view_billing",
        "can_create_tickets",
        "can_view_contracts",
        "can_view_cancellations",
        "can_view_disputes",
      ];
      return defaultTrue.includes(permission);
    }
    return value === true;
  };

  const canAny = (...perms: EmployeePermission[]): boolean => {
    return perms.some((p) => can(p));
  };

  const canAll = (...perms: EmployeePermission[]): boolean => {
    return perms.every((p) => can(p));
  };

  return {
    can,
    canAny,
    canAll,
    permissions,
    isEmployee,
    isLoading,
    error,
    refetch,
    employeeId: data?.employeeId,
    employeeEmail: data?.employeeEmail,
    employeeName: data?.employeeName,
  };
};

export default useServerEmployeePermissions;
