/**
 * Shared staff/admin authentication helper.
 * Checks user_roles table first, then falls back to admin_users.
 * This covers the case where an admin exists in admin_users but not user_roles.
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
  // 1. Check user_roles table
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

  // 2. Fallback: check admin_users table (active admins)
  const { data: adminRow } = await adminClient
    .from("admin_users")
    .select("user_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (adminRow) {
    const adminRole = adminRow.role || "admin";
    return {
      isStaff: true,
      callerRole: adminRole,
      roles: [adminRole],
    };
  }

  return { isStaff: false, callerRole: "unknown", roles: [] };
}
