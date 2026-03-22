/**
 * updateOrderStatus — Shared canonical order status mutation.
 * Respects DB lifecycle guard (trg_guard_order_lifecycle_no_skip).
 * Logs to activity_logs + internal_audit_log. Both portals use this.
 */
import { supabase } from "@/integrations/supabase/client";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

export interface StatusUpdateParams {
  orderId: string;
  newStatus: string;
  logAction: string;
  portal: "core" | "employee";
}

export async function updateOrderStatus({ orderId, newStatus, logAction, portal }: StatusUpdateParams) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Non authentifié");

  const { error } = await supabase
    .from("orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw error;

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).maybeSingle();

  await supabase.from("activity_logs").insert({
    user_id: session.user.id,
    entity_id: orderId,
    entity_type: "order",
    action: logAction,
    actor_name: profile?.full_name ?? session.user.email ?? "Agent",
    actor_role: portal,
  });

  await logInternalAudit({
    action: logAction.toLowerCase().replace(/\s/g, "_"),
    category: "operations",
    portal,
    targetType: "order",
    targetId: orderId,
  });
}