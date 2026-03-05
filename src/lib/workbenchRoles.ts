/**
 * Workbench role-gating: who can do what in the Order Workbench.
 */
import { UserRole, USER_ROLES } from "@/lib/constants/roles";

export type WorkbenchAction =
  | "view_order"
  | "edit_address"
  | "edit_service"
  | "add_note"
  | "approve_kyc"
  | "reject_kyc"
  | "retry_provisioning"
  | "override_provisioning"
  | "assign_inventory"
  | "manage_shipment"
  | "capture_payment"
  | "void_payment"
  | "refund_payment"
  | "create_ticket"
  | "send_communication"
  | "force_status"
  | "cancel_order";

const ACTION_ROLES: Record<WorkbenchAction, UserRole[]> = {
  view_order: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.SALES, USER_ROLES.KYC_AGENT, USER_ROLES.BILLING_ADMIN, USER_ROLES.TECHOPS, USER_ROLES.SUPPORT],
  edit_address: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.SALES],
  edit_service: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.SALES],
  add_note: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.SALES, USER_ROLES.KYC_AGENT, USER_ROLES.BILLING_ADMIN, USER_ROLES.TECHOPS, USER_ROLES.SUPPORT],
  approve_kyc: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.KYC_AGENT],
  reject_kyc: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.KYC_AGENT],
  retry_provisioning: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.TECHOPS],
  override_provisioning: [USER_ROLES.ADMIN, USER_ROLES.SUPERVISOR],
  assign_inventory: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.TECHOPS],
  manage_shipment: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.TECHOPS],
  capture_payment: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.BILLING_ADMIN],
  void_payment: [USER_ROLES.ADMIN, USER_ROLES.SUPERVISOR, USER_ROLES.BILLING_ADMIN],
  refund_payment: [USER_ROLES.ADMIN, USER_ROLES.SUPERVISOR, USER_ROLES.BILLING_ADMIN],
  create_ticket: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.SUPPORT, USER_ROLES.SALES],
  send_communication: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE, USER_ROLES.SUPERVISOR, USER_ROLES.SUPPORT],
  force_status: [USER_ROLES.ADMIN, USER_ROLES.SUPERVISOR],
  cancel_order: [USER_ROLES.ADMIN, USER_ROLES.SUPERVISOR],
};

export function canPerformAction(role: string | null, action: WorkbenchAction): boolean {
  if (!role) return false;
  const allowed = ACTION_ROLES[action];
  return allowed?.includes(role as UserRole) ?? false;
}

export function getOwnerRole(itemStatus: string): string {
  switch (itemStatus) {
    case "draft":
    case "submitted":
      return "sales";
    case "kyc_required":
    case "kyc_in_review":
      return "kyc_agent";
    case "payment_pending":
    case "payment_failed":
      return "billing_admin";
    case "fulfillment_pending":
    case "shipment_pending":
      return "techops";
    case "provisioning_pending":
    case "provisioning_in_progress":
    case "provisioning_failed":
      return "techops";
    case "active":
    case "completed":
      return "support";
    default:
      return "supervisor";
  }
}

export const OWNER_ROLE_LABELS: Record<string, { label: string; color: string }> = {
  sales: { label: "Ventes", color: "bg-blue-500/20 text-blue-400" },
  kyc_agent: { label: "KYC", color: "bg-purple-500/20 text-purple-400" },
  billing_admin: { label: "Facturation", color: "bg-amber-500/20 text-amber-400" },
  techops: { label: "TechOps", color: "bg-cyan-500/20 text-cyan-400" },
  support: { label: "Support", color: "bg-green-500/20 text-green-400" },
  supervisor: { label: "Superviseur", color: "bg-red-500/20 text-red-400" },
};
