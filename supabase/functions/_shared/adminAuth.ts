/**
 * Shared staff/admin authentication helper.
 * Checks user_roles table for staff access.
 */

const STAFF_ROLES = new Set([
  "admin", "employee", "supervisor", "support",
  "billing_admin", "sales", "manager", "hr", "field_agent",
]);

export interface StaffAuthResult {
  isStaff: boolean;
  callerRole: string;
  roles: string[];
}

export async function checkStaffAuth(
  adminClient: any,
  userId: string,
): Promise<StaffAuthResult> {
  const { data: roleRows } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (roleRows || []).map((r: { role: string }) => r.role);
  const hasRole = roles.some((r: string) => STAFF_ROLES.has(r));

  if (hasRole) {
    return {
      isStaff: true,
      callerRole: roles.find((r: string) => STAFF_ROLES.has(r)) || "support",
      roles,
    };
  }

  return { isStaff: false, callerRole: "unknown", roles: [] };
}
