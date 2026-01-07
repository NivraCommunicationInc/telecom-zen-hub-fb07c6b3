/**
 * useEmployeePermissions - Role-based permission checks for employee portal
 * 
 * Employees CAN:
 * - View accounts/clients, invoices/billing, payments, orders (READ-ONLY), contracts
 * - Create internal tickets to admin/employee
 * - Create external client tickets
 * - Add internal notes
 * - Manage Streaming+ subscriptions
 * - Take/record payments with proof
 * 
 * Employees CANNOT:
 * - Create/process/modify orders
 * - Change order status
 * - Access admin settings
 * - Access sensitive identifiers without PIN unlock
 */

import { useMemo } from "react";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";

export type EmployeePermission =
  // View permissions
  | "view_clients"
  | "view_accounts"
  | "view_orders"
  | "view_invoices"
  | "view_payments"
  | "view_contracts"
  | "view_tickets"
  | "view_streaming"
  // Action permissions
  | "create_internal_ticket"
  | "create_client_ticket"
  | "add_internal_note"
  | "record_payment"
  | "manage_streaming"
  | "download_invoice"
  | "download_contract"
  // Sensitive data access (requires PIN)
  | "view_sensitive_data"
  // Denied permissions
  | "create_order"
  | "modify_order"
  | "change_order_status"
  | "access_admin_settings";

// Permissions that employees always have
const EMPLOYEE_ALLOWED_PERMISSIONS: EmployeePermission[] = [
  "view_clients",
  "view_accounts",
  "view_orders",
  "view_invoices",
  "view_payments",
  "view_contracts",
  "view_tickets",
  "view_streaming",
  "create_internal_ticket",
  "create_client_ticket",
  "add_internal_note",
  "record_payment",
  "manage_streaming",
  "download_invoice",
  "download_contract",
  "view_sensitive_data", // Requires PIN unlock
];

// Permissions that employees never have
const EMPLOYEE_DENIED_PERMISSIONS: EmployeePermission[] = [
  "create_order",
  "modify_order",
  "change_order_status",
  "access_admin_settings",
];

export const useEmployeePermissions = () => {
  const { isEmployee, role } = useEmployeeAuth();

  const permissions = useMemo(() => {
    const can = (permission: EmployeePermission): boolean => {
      if (!isEmployee) return false;
      
      // Explicitly denied
      if (EMPLOYEE_DENIED_PERMISSIONS.includes(permission)) {
        return false;
      }
      
      // Explicitly allowed
      if (EMPLOYEE_ALLOWED_PERMISSIONS.includes(permission)) {
        return true;
      }
      
      return false;
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
      isEmployee,
      role,
    };
  }, [isEmployee, role]);

  return permissions;
};

export default useEmployeePermissions;
