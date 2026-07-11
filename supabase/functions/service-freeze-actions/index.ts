// service-freeze-actions — Module 20 (Geler cycle / essai)
// Canonical entry point for freeze/hold/trial-extension requests on an account.
//
// Actions:
//   - request_freeze : create a controlled freeze request
//   - cancel_freeze  : cancel a pending freeze request
//
// Freeze modes (strict separation, mutually exclusive per request):
//   - freeze_cycle     : Pause du cycle de facturation SEULEMENT
//                        (le renouvellement automatique est suspendu jusqu'à la date de fin)
//   - trial_extension  : Prolongation de la période d'essai SEULEMENT
//                        (aucun impact sur un cycle de facturation actif)
//   - billing_hold     : Les deux — suspend cycle ET essai (pause complète facturation)
//
// Guarantees:
//  - No direct UI writes to billing_subscriptions / billing_invoices
//  - Reason mandatory (min. 3 chars)
//  - Date validation (must be future, max 90 days)
//  - Cross-client isolation (account ownership check)
//  - Idempotency: refuse a second active freeze on the same account
//  - Full traceability: admin_audit_log (admin_user_id) + client_activity_logs + client_internal_notes
//  - Bilingual email enqueued only (never sent directly here)
//  - Never mutates cycle_end_date / next_renewal_at directly; downstream billing-lifecycle
//    reads the pending request and applies the freeze on its next scheduled tick.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type FreezeMode = "freeze_cycle" | "trial_extension" | "billing_hold";

interface Payload {
  action: "request_freeze" | "cancel_freeze";
  account_id: string;
  mode?: FreezeMode;
  until_date?: string; // YYYY-MM-DD
  request_id?: string; // for cancel_freeze
  __audit_reason: string;
}

const MODE_LABELS_FR: Record<FreezeMode, string> = {
  freeze_cycle: "Gel du cycle de facturation",
  trial_extension: "Prolongation de la période d'essai",
  billing_hold: "Pause complète de la facturation",
};

const MODE_SCOPE: Record<FreezeMode, string> = {
  freeze_cycle: "billing_cycle_only",
  trial_extension: "trial_only",
  billing_hold: "billing_cycle_and_trial",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing authorization" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
    const actor = userData.user;

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", actor.id)
      .eq("status", "active")
      .maybeSingle();
    const actorRole = roleRow?.role ?? "unknown";
    if (!["admin", "employee", "core_admin", "core_operator", "supervisor", "billing_admin"].includes(actorRole)) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: prof } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", actor.id)
      .maybeSingle();
    const actorName = prof?.full_name || prof?.email || "Système Core";

    const body = (await req.json()) as Payload;
    if (!body || !body.action || !body.account_id) return json({ error: "Bad request" }, 400);
    if (!body.__audit_reason || body.__audit_reason.trim().length < 3) {
      return json({ error: "Motif requis (min. 3 caractères)" }, 400);
    }

    // Ownership
    const { data: account, error: accErr } = await admin
      .from("accounts")
      .select("id, client_id, account_number, status")
      .eq("id", body.account_id)
      .maybeSingle();
    if (accErr || !account) return json({ error: "Compte introuvable" }, 404);
    const clientId = account.client_id as string;

    if (body.action === "request_freeze") {
      const mode = body.mode as FreezeMode | undefined;
      if (!mode || !["freeze_cycle", "trial_extension", "billing_hold"].includes(mode)) {
        return json({ error: "Mode invalide (freeze_cycle | trial_extension | billing_hold)" }, 400);
      }
      const until = body.until_date;
      if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
        return json({ error: "Date invalide" }, 400);
      }
      const d = new Date(until + "T00:00:00Z").getTime();
      const now = Date.now();
      if (isNaN(d)) return json({ error: "Date invalide" }, 400);
      if (d <= now) return json({ error: "Date de fin doit être dans le futur" }, 400);
      if (d > now + 90 * 86400000) return json({ error: "Durée maximale du gel : 90 jours" }, 400);

      // Idempotency: refuse a second active freeze request (any mode) on the same account
      const { data: existing } = await admin
        .from("service_change_requests")
        .select("id, change_type")
        .eq("account_id", body.account_id)
        .in("change_type", ["freeze_cycle", "trial_extension", "billing_hold"])
        .eq("status", "pending")
        .limit(1);
      if (existing && existing.length > 0) {
        return json(
          { error: "Un gel est déjà en attente sur ce compte", request_id: existing[0].id },
          409,
        );
      }

      const label = MODE_LABELS_FR[mode];
      const scope = MODE_SCOPE[mode];
      const notes = `${label} jusqu'au ${until} — Portée: ${scope} — Motif: ${body.__audit_reason}`;

      const { data: inserted, error: insErr } = await admin
        .from("service_change_requests")
        .insert({
          account_id: body.account_id,
          client_id: clientId,
          requested_by: actor.id,
          change_type: mode,
          status: "pending",
          effective_date: until,
          requested_plan_name: label,
          notes,
        })
        .select("id")
        .single();
      if (insErr) return json({ error: insErr.message }, 500);

      const details = {
        account_id: body.account_id,
        client_id: clientId,
        mode,
        scope,
        until_date: until,
        reason: body.__audit_reason,
        impacts_billing_cycle: mode !== "trial_extension",
        impacts_trial: mode !== "freeze_cycle",
      };

      // Parallel: audit + activity + note + tag + email
      await Promise.all([
        admin.from("admin_audit_log").insert({
          admin_user_id: actor.id,
          admin_email: prof?.email ?? null,
          action: `service_${mode}_requested`,
          target_type: "service_change_request",
          target_id: inserted.id,
          details,
        }),
        admin.from("client_activity_logs").insert({
          client_id: clientId,
          actor_user_id: actor.id,
          actor_name: actorName,
          actor_role: actorRole,
          action_type: "service_change",
          entity_type: "service",
          entity_id: inserted.id,
          summary: `${label} demandé jusqu'au ${until} (portée: ${scope})`,
          after_data: { mode, scope, until_date: until },
        }),
        admin.from("client_internal_notes").insert({
          client_id: clientId,
          account_id: body.account_id,
          note_type: (actorRole === "admin" || actorRole === "core_admin") ? "admin" : "employee",
          body: `[SERVICE.${mode.toUpperCase()}.REQUESTED] ${label} jusqu'au ${until}. Portée: ${scope}. Motif: ${body.__audit_reason}`,
          created_by_user_id: actor.id,
          created_by_role: actorRole,
          created_by_name: actorName,
        }),
        admin.from("account_tags").upsert({
          client_user_id: clientId,
          account_id: body.account_id,
          tag_key: mode,
          tag_label: label,
          severity: "warning",
          note: `${body.__audit_reason} — jusqu'au ${until}`,
          created_by: actor.id,
          created_by_email: prof?.email ?? null,
        } as any, { onConflict: "client_user_id,tag_key" }),
      ]);

      // Email queued only (never sent directly)
      const { data: clientProf } = await admin
        .from("profiles")
        .select("email, full_name, preferred_language")
        .eq("user_id", clientId)
        .maybeSingle();
      if (clientProf?.email) {
        let emailErr: any = null;
        try { await enqueueCommunication({
          channel: "email",
          templateKey: `service_${mode}_requested`,
          recipient: clientProf.email,
          idempotencyKey: `service_${mode}_requested:${inserted.id}`,
          templateVars: { recipient_name: clientProf.full_name ?? null,
            mode,
            scope,
            until_date: until,
            account_number: account.account_number, language: (clientProf.preferred_language === "en" ? "en" : "fr") },
          subject: `${label} enregistré / Freeze registered`,
          priority: 5,
          entityType: "service_change_request",
          entityId: inserted.id,
        }); } catch (__e) { emailErr = __e; }
        if (emailErr) console.error("[service-freeze-actions] email_queue insert failed", emailErr);
      }

      return json({ ok: true, request_id: inserted.id, mode, scope, until_date: until });
    }

    if (body.action === "cancel_freeze") {
      if (!body.request_id) return json({ error: "request_id requis" }, 400);
      const { data: sr } = await admin
        .from("service_change_requests")
        .select("id, account_id, client_id, status, change_type, effective_date")
        .eq("id", body.request_id)
        .maybeSingle();
      if (!sr) return json({ error: "Demande introuvable" }, 404);
      if (sr.account_id !== body.account_id || sr.client_id !== clientId) {
        return json({ error: "Isolation: demande n'appartient pas au compte" }, 403);
      }
      if (!["freeze_cycle", "trial_extension", "billing_hold"].includes(sr.change_type)) {
        return json({ error: "Pas une demande de gel" }, 400);
      }
      if (sr.status !== "pending") {
        return json({ error: `Impossible d'annuler (statut=${sr.status})` }, 409);
      }

      const { error: updErr } = await admin
        .from("service_change_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", body.request_id);
      if (updErr) return json({ error: updErr.message }, 500);

      const mode = sr.change_type as FreezeMode;
      const label = MODE_LABELS_FR[mode];

      await Promise.all([
        admin.from("admin_audit_log").insert({
          admin_user_id: actor.id,
          admin_email: prof?.email ?? null,
          action: `service_${mode}_cancelled`,
          target_type: "service_change_request",
          target_id: body.request_id,
          details: { account_id: body.account_id, mode, reason: body.__audit_reason },
        }),
        admin.from("client_activity_logs").insert({
          client_id: clientId,
          actor_user_id: actor.id,
          actor_name: actorName,
          actor_role: actorRole,
          action_type: "service_change",
          entity_type: "service",
          entity_id: body.request_id,
          summary: `${label} annulé (${body.__audit_reason})`,
          before_data: { status: "pending", mode },
          after_data: { status: "cancelled" },
        }),
        admin.from("client_internal_notes").insert({
          client_id: clientId,
          account_id: body.account_id,
          note_type: (actorRole === "admin" || actorRole === "core_admin") ? "admin" : "employee",
          body: `[SERVICE.${mode.toUpperCase()}.CANCELLED] ${label} annulé. Motif: ${body.__audit_reason}`,
          created_by_user_id: actor.id,
          created_by_role: actorRole,
          created_by_name: actorName,
        }),
        admin.from("account_tags").delete()
          .eq("client_user_id", clientId)
          .eq("account_id", body.account_id)
          .eq("tag_key", mode),
      ]);

      return json({ ok: true, mode });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("[service-freeze-actions]", e);
    return json({ error: (e as Error).message ?? "Erreur interne" }, 500);
  }
});
