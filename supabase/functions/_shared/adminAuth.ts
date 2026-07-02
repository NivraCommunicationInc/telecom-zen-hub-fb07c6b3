/**
 * Shared staff/admin authentication helper.
 * Checks user_roles table for staff access.
 */

const STAFF_ROLES = new Set([
  "admin", "super_admin", "employee", "supervisor", "support",
  "billing_admin", "sales", "manager", "hr", "field_agent", "field_sales",
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
  // Ignore deactivated / non-active role rows
  const { data: roleRows } = await adminClient
    .from("user_roles")
    .select("role, is_active, status")
    .eq("user_id", userId);

  const roles = (roleRows || [])
    .filter((r: any) => r.is_active !== false && (r.status ?? "active") === "active")
    .map((r: { role: string }) => r.role);
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

/**
 * Convenience: enforce that the caller has one of the given staff roles.
 * Returns { userId, role } on success, or a Response (401/403) to return from the handler.
 */
export async function requireStaff(
  req: Request,
  adminClient: any,
  allowedRoles: string[] = ["admin", "super_admin"],
): Promise<{ userId: string; role: string } | Response> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authentification requise" }), { status: 401, headers: cors });
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");
  // Allow service-role callers (cron / internal)
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return { userId: "service_role", role: "service_role" };
  }
  const { data: { user } } = await adminClient.auth.getUser(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: cors });
  }
  const result = await checkStaffAuth(adminClient, user.id);
  const allowed = new Set(allowedRoles);
  const match = result.roles.find((r) => allowed.has(r));
  if (!match) {
    return new Response(JSON.stringify({ error: "Accès refusé — rôle insuffisant" }), { status: 403, headers: cors });
  }
  return { userId: user.id, role: match };
}
