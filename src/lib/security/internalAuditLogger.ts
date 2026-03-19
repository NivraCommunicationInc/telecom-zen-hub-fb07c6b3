/**
 * Internal Audit Logger — Centralized audit trail for all internal staff actions.
 * 
 * Categories:
 * - auth: login, logout, mfa_enroll, mfa_verify, step_up
 * - access: portal_entry, hub_access, route_access
 * - security: role_change, access_flag_change, account_lock, mfa_reset
 * - operations: refund, credit, billing_approval, kyc_override
 * - data: profile_edit, status_change, document_access
 */
import { supabase } from "@/integrations/supabase/client";

export type AuditCategory =
  | "auth"
  | "access"
  | "security"
  | "operations"
  | "data";

export interface AuditEntry {
  action: string;
  category: AuditCategory;
  portal?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an internal audit event for the current user.
 * Fire-and-forget — does not throw on failure.
 */
export async function logInternalAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Get user role (cached in session metadata or fetch)
    let userRole = "unknown";
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (roleData) userRole = roleData.role;

    await supabase.from("internal_audit_log").insert({
      user_id: session.user.id,
      user_email: session.user.email ?? null,
      user_role: userRole,
      action: entry.action,
      category: entry.category,
      portal: entry.portal ?? null,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      details: entry.details ?? {},
    });
  } catch (err) {
    console.error("[InternalAudit] Failed to log:", err);
  }
}

/**
 * Convenience loggers for common patterns
 */
export const auditAuth = (action: string, details?: Record<string, unknown>) =>
  logInternalAudit({ action, category: "auth", details });

export const auditAccess = (action: string, portal: string, details?: Record<string, unknown>) =>
  logInternalAudit({ action, category: "access", portal, details });

export const auditSecurity = (action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>) =>
  logInternalAudit({ action, category: "security", targetType, targetId, details });

export const auditOperation = (action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>) =>
  logInternalAudit({ action, category: "operations", targetType, targetId, details });

export const auditData = (action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>) =>
  logInternalAudit({ action, category: "data", targetType, targetId, details });
