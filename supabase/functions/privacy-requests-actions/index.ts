import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const STAFF_ROLES = ["admin", "employee", "supervisor", "support"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isStaffData } = await admin.rpc("has_staff_role", { _user_id: user.id });
    if (isStaffData !== true) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, clientId, accountId, requestId, requestType, description, reason, status, refusalReason, internalNotes } = body;

    if (!action) return json({ error: "Missing action" }, 400);

    if (action === "list") {
      if (!clientId) return json({ error: "Missing clientId" }, 400);
      const { data, error } = await admin
        .from("privacy_requests")
        .select("*")
        .eq("client_id", clientId)
        .order("received_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ requests: data ?? [] });
    }

    if (action === "create") {
      if (!clientId || !requestType || !description?.trim() || !reason?.trim()) {
        return json({ error: "Champs requis: clientId, requestType, description, reason" }, 400);
      }
      const valid = ["access", "rectification", "deletion", "portability", "withdrawal_consent", "complaint"];
      if (!valid.includes(requestType)) return json({ error: "Type invalide" }, 400);

      const { data, error } = await admin.from("privacy_requests").insert({
        client_id: clientId,
        account_id: accountId ?? null,
        request_type: requestType,
        description: description.trim(),
        internal_notes: internalNotes?.trim() || null,
        created_by: user.id,
        created_by_email: user.email,
        last_updated_by: user.id,
        last_updated_by_email: user.email,
      }).select().single();
      if (error) return json({ error: error.message }, 500);

      await admin.from("admin_audit_log").insert({
        admin_user_id: user.id, admin_email: user.email, action: "account_ops.privacy_request_create",
        target_type: "privacy_request", target_id: data.id,
        details: { client_id: clientId, request_type: requestType, reason },
      });
      return json({ ok: true, request: data });
    }

    if (action === "update_status") {
      if (!requestId || !status || !reason?.trim()) return json({ error: "Champs requis: requestId, status, reason" }, 400);
      const valid = ["received", "in_review", "awaiting_client", "completed", "refused", "cancelled"];
      if (!valid.includes(status)) return json({ error: "Statut invalide" }, 400);
      if (status === "refused" && !refusalReason?.trim()) return json({ error: "Motif de refus requis" }, 400);

      const patch: any = {
        status, last_updated_by: user.id, last_updated_by_email: user.email,
      };
      if (status === "completed" || status === "refused" || status === "cancelled") patch.completed_at = new Date().toISOString();
      if (status === "refused") patch.refusal_reason = refusalReason.trim();
      if (internalNotes?.trim()) patch.internal_notes = internalNotes.trim();

      const { data, error } = await admin.from("privacy_requests").update(patch).eq("id", requestId).select().single();
      if (error) return json({ error: error.message }, 500);

      await admin.from("admin_audit_log").insert({
        admin_user_id: user.id, admin_email: user.email, action: "account_ops.privacy_request_update",
        target_type: "privacy_request", target_id: requestId,
        details: { status, reason, refusal_reason: refusalReason ?? null },
      });
      return json({ ok: true, request: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
