/**
 * portalRedirect — Resolve the canonical portal landing path for an authenticated staff user.
 *
 * Reads the user's `user_roles` row (role + portal access flags) and returns the most
 * relevant portal root path. Field Sales agents land on the Field Portal, employees on
 * the RH Portal, technicians on the Technician workspace, admins on Nivra Core.
 *
 * Used by:
 *  - HubCreateAccountPage (after first-time onboarding completion)
 *  - HubLoginPage (when reached without a `?portal=...` selector)
 */
import { supabase } from "@/integrations/supabase/client";

export const HUB_LOGIN_PATH = "/nivra-secure-hub-2617-internal/login";

/** Resolve the best landing portal path for the given user, or HUB_LOGIN_PATH if unknown. */
export async function resolveStaffLandingPath(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select(
        "role, is_active, status, can_access_core, can_access_employee, can_access_field, can_access_technician, can_access_rh"
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error || !data || !data.is_active) return HUB_LOGIN_PATH;
    return landingPathForRole(data.role, data as Record<string, unknown>);
  } catch {
    return HUB_LOGIN_PATH;
  }
}

/** Map a role + access flags to a portal root path. */
export function landingPathForRole(
  role: string | null | undefined,
  access: Record<string, unknown> = {}
): string {
  if (!role) return HUB_LOGIN_PATH;

  if (role === "field_sales" && access.can_access_field !== false) return "/field";
  if (role === "technician" && access.can_access_technician !== false) return "/staff/technician";
  if (role === "admin" && access.can_access_core !== false) return "/core";

  // Employees and other staff roles default to HR portal when granted, otherwise Employee portal.
  if (access.can_access_rh) return "/hr";
  if (role === "employee" && access.can_access_employee !== false) return "/employee";

  // Fallback by role even when access flags are missing.
  switch (role) {
    case "field_sales":
      return "/field";
    case "technician":
      return "/staff/technician";
    case "admin":
      return "/core";
    case "employee":
    case "supervisor":
    case "sales":
    case "kyc_agent":
    case "billing_admin":
    case "techops":
    case "support":
      return "/hr";
    default:
      return HUB_LOGIN_PATH;
  }
}
