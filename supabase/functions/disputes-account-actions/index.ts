// Billing disputes (Litige facturation) — staff-only management on payment_disputes.
// Actions:
//   - open_on_behalf      : open a new dispute on behalf of the client (staff entry)
//   - set_under_review    : move submitted -> under_review
//   - request_client_info : move -> awaiting_client (with public_message)
//   - resolve_approved    : resolved_approved (resolution_notes required)
//   - resolve_rejected    : resolved_rejected (rejection_reason required)
//   - add_staff_note      : append to staff_notes (internal only)
// All transitions are audited as account_ops.dispute_*; client emails fire via
// the existing dispute triggers — we add a dedicated email_queue entry only for
// the new "client_dispute_status_update" branded template.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = new Set([
  "admin", "employee", "billing_admin", "supervisor", "support",
]);

type Action =
  | "open_on_behalf"
  | "set_under_review"
  | "request_client_info"
  | "resolve_approved"
  | "resolve_rejected"
  | "add_staff_note";

type ReasonCode =
  | "duplicate_charge" | "incorrect_amount" | "service_not_received"
  | "unauthorized" | "fraud" | "other";

interface Body {
  action: Action;
  client_user_id: string;
  dispute_id?: string;
  payment_id?: string;
  reason_code?: ReasonCode;
  client_message?: string;
  public_message?: string;
  resolution_notes?: string;
  rejection_reason?: string;
  staff_note?: string;
}

const json = (s: number, p: unknown) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const REASON_LABEL: Record<string, string> = {
  duplicate_charge: "Double facturation",
  incorrect_amount: "Montant incorrect",
  service_not_received: "Service non reçu",
  unauthorized: "Transaction non autorisée",
  fraud: "Fraude présumée",
  other: "Autre",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Soumis",
  under_review: "En analyse",
  awaiting_client: "En attente du client",
  resolved_approved: "Approuvé",
  resolved_rejected: "Refusé",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Non autorisé" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: roles } = await admin
    .from("user_roles").select("role").eq("user_id", user.id);
  const isStaff = (roles || []).some((r: { role: string }) => STAFF_ROLES.has(r.role));
  if (!isStaff) return json(403, { error: "Action réservée au personnel" });

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return json(400, { error: "Champs requis: action, client_user_id" });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("user_id", client_user_id)
    .maybeSingle();
  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("first_name,last_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const callerName = [callerProfile?.first_name, callerProfile?.last_name]
    .filter(Boolean).join(" ") || "Personnel Nivra";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";

  const audit = async (label: string, payload: Record<string, unknown>) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `account_ops.dispute_${label}`,
        admin_id: user.id,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        metadata: payload,
      });
    } catch { /* swallow */ }
  };

  const enqueueStatusEmail = async (
    dispute_number: string | null,
    new_status: string,
    reason_code: string | null,
    public_message: string | null,
  ) => {
    if (!clientEmail) return;
    try {
      await admin.from("email_queue").insert({
        to_email: clientEmail,
        template_key: "client_dispute_status_update",
        template_vars: {
          first_name: firstName,
          to_email: clientEmail,
          dispute_number: dispute_number || "—",
          status_label: STATUS_LABEL[new_status] || new_status,
          new_status,
          reason_label: reason_code ? (REASON_LABEL[reason_code] || reason_code) : "—",
          public_message: public_message || "",
        },
        status: "queued",
        priority: "normal",
      });
    } catch { /* swallow */ }
  };

  const updateDispute = async (
    dispute_id: string,
    patch: Record<string, unknown>,
  ) => {
    const { data: existing } = await admin
      .from("payment_disputes")
      .select("id, user_id, status, reason_code, dispute_number")
      .eq("id", dispute_id)
      .maybeSingle();
    if (!existing) return { err: "Litige introuvable", row: null as any };
    if (existing.user_id !== client_user_id) return { err: "Litige hors compte", row: null as any };

    const { data, error } = await admin
      .from("payment_disputes")
      .update({
        ...patch,
        processed_by_id: user.id,
        processed_by_name: callerName,
        processed_at: new Date().toISOString(),
      })
      .eq("id", dispute_id)
      .select("id, dispute_number, status, reason_code")
      .single();
    if (error) return { err: error.message, row: null as any };
    return { err: null, row: data };
  };

  try {
    switch (action) {
      case "open_on_behalf": {
        if (!body.payment_id) return json(400, { error: "payment_id requis" });
        if (!body.reason_code) return json(400, { error: "Motif requis" });

        const { data: pay } = await admin
          .from("billing")
          .select("id, user_id")
          .eq("id", body.payment_id)
          .maybeSingle();
        if (!pay) return json(404, { error: "Paiement introuvable" });
        if (pay.user_id !== client_user_id) return json(403, { error: "Paiement hors compte" });

        const { data, error } = await admin
          .from("payment_disputes")
          .insert({
            user_id: client_user_id,
            payment_id: body.payment_id,
            reason_code: body.reason_code,
            client_message: body.client_message || `Litige ouvert par ${callerName} pour le client.`,
            status: "submitted",
            staff_notes: body.staff_note || null,
          })
          .select("id, dispute_number")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("open_on_behalf", {
          dispute_id: data.id,
          dispute_number: data.dispute_number,
          payment_id: body.payment_id,
          reason_code: body.reason_code,
        });
        return json(200, { ok: true, dispute_id: data.id, dispute_number: data.dispute_number });
      }

      case "set_under_review": {
        if (!body.dispute_id) return json(400, { error: "dispute_id requis" });
        const { err, row } = await updateDispute(body.dispute_id, {
          status: "under_review",
          staff_notes: body.staff_note ?? undefined,
        });
        if (err) return json(400, { error: err });
        await audit("set_under_review", { dispute_id: row.id, dispute_number: row.dispute_number });
        await enqueueStatusEmail(row.dispute_number, "under_review", row.reason_code, null);
        return json(200, { ok: true });
      }

      case "request_client_info": {
        if (!body.dispute_id) return json(400, { error: "dispute_id requis" });
        if (!body.public_message?.trim()) return json(400, { error: "Message au client requis" });
        const { err, row } = await updateDispute(body.dispute_id, {
          status: "awaiting_client",
          public_message: body.public_message.trim(),
          staff_notes: body.staff_note ?? undefined,
        });
        if (err) return json(400, { error: err });
        await audit("request_client_info", { dispute_id: row.id, dispute_number: row.dispute_number });
        await enqueueStatusEmail(row.dispute_number, "awaiting_client", row.reason_code, body.public_message);
        return json(200, { ok: true });
      }

      case "resolve_approved": {
        if (!body.dispute_id) return json(400, { error: "dispute_id requis" });
        if (!body.resolution_notes?.trim()) return json(400, { error: "Notes de résolution requises" });
        const { err, row } = await updateDispute(body.dispute_id, {
          status: "resolved_approved",
          resolution_notes: body.resolution_notes.trim(),
          public_message: body.public_message ?? undefined,
          staff_notes: body.staff_note ?? undefined,
        });
        if (err) return json(400, { error: err });
        await audit("resolve_approved", { dispute_id: row.id, dispute_number: row.dispute_number });
        await enqueueStatusEmail(row.dispute_number, "resolved_approved", row.reason_code, body.public_message ?? body.resolution_notes);
        return json(200, { ok: true });
      }

      case "resolve_rejected": {
        if (!body.dispute_id) return json(400, { error: "dispute_id requis" });
        if (!body.rejection_reason?.trim()) return json(400, { error: "Motif de refus requis" });
        const { err, row } = await updateDispute(body.dispute_id, {
          status: "resolved_rejected",
          rejection_reason: body.rejection_reason.trim(),
          public_message: body.public_message ?? undefined,
          staff_notes: body.staff_note ?? undefined,
        });
        if (err) return json(400, { error: err });
        await audit("resolve_rejected", { dispute_id: row.id, dispute_number: row.dispute_number });
        await enqueueStatusEmail(row.dispute_number, "resolved_rejected", row.reason_code, body.public_message ?? body.rejection_reason);
        return json(200, { ok: true });
      }

      case "add_staff_note": {
        if (!body.dispute_id) return json(400, { error: "dispute_id requis" });
        if (!body.staff_note?.trim()) return json(400, { error: "Note requise" });
        const { data: cur } = await admin
          .from("payment_disputes")
          .select("staff_notes, user_id")
          .eq("id", body.dispute_id)
          .maybeSingle();
        if (!cur) return json(404, { error: "Litige introuvable" });
        if (cur.user_id !== client_user_id) return json(403, { error: "Litige hors compte" });
        const stamp = `[${new Date().toISOString().slice(0, 10)} — ${callerName}] ${body.staff_note.trim()}`;
        const next = cur.staff_notes ? `${cur.staff_notes}\n${stamp}` : stamp;
        const { error } = await admin
          .from("payment_disputes")
          .update({ staff_notes: next, processed_by_id: user.id, processed_by_name: callerName, processed_at: new Date().toISOString() })
          .eq("id", body.dispute_id);
        if (error) return json(500, { error: error.message });
        await audit("add_staff_note", { dispute_id: body.dispute_id });
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
