/**
 * addOperationalNote — Shared canonical note action.
 * Logs to activity_logs + internal_audit_log. Both portals use this.
 */
import { supabase } from "@/integrations/supabase/client";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

import { logActivityLog } from "@/lib/logActivityLog";
export interface AddNoteParams {
  entityId: string;
  entityType: string;
  note: string;
  portal: "core" | "employee" | "field" | "technician";
}

export async function addOperationalNote({ entityId, entityType, note, portal }: AddNoteParams) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Non authentifié");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).maybeSingle();

  await logActivityLog({
    user_id: session.user.id,
    entity_id: entityId,
    entity_type: entityType,
    action: `Note: ${note}`,
    actor_name: profile?.full_name ?? session.user.email ?? "Agent",
    actor_role: portal,
  });

  await logInternalAudit({
    action: "add_note",
    category: "operations",
    portal,
    targetType: entityType,
    targetId: entityId,
  });
}