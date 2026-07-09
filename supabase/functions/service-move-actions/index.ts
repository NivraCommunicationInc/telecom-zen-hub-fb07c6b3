// service-move-actions — Module 17 (Transfert / Déménagement)
// Canonical entry point for service move requests on an account.
// Actions: request_move, cancel_move
//
// Guarantees:
//  - Ownership check on account_id / subscription_id
//  - Reason mandatory (audit)
//  - Idempotency: refuse if a pending move already exists for the account
//  - Full traceability: admin_audit_log + client_activity_logs + client_internal_notes
//  - Bilingual email enqueued (never sent directly here)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Payload {
  action: "request_move" | "cancel_move";
  account_id: string;
  subscription_id?: string | null;
  new_address?: string;
  new_city?: string;
  new_postal_code?: string;
  move_date?: string; // YYYY-MM-DD
  request_id?: string; // for cancel_move
  __audit_reason: string;
}

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
    if (!["admin", "employee", "core_admin", "core_operator"].includes(actorRole)) {
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

    // Ownership: fetch account -> client_user_id
    const { data: account, error: accErr } = await admin
      .from("accounts")
      .select("id, client_id, account_number, status")
      .eq("id", body.account_id)
      .maybeSingle();
    if (accErr || !account) return json({ error: "Compte introuvable" }, 404);
    const clientId = account.client_id as string;

    if (body.action === "request_move") {
      const addr = (body.new_address ?? "").trim();
      const city = (body.new_city ?? "").trim();
      const pc = (body.new_postal_code ?? "").trim().toUpperCase();
      if (addr.length < 5) return json({ error: "Adresse invalide" }, 400);
      if (city.length < 2) return json({ error: "Ville requise" }, 400);
      if (!/^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/.test(pc)) {
        return json({ error: "Code postal invalide" }, 400);
      }
      const moveDate = body.move_date;
      if (!moveDate || !/^\d{4}-\d{2}-\d{2}$/.test(moveDate)) {
        return json({ error: "Date invalide" }, 400);
      }
      const d = new Date(moveDate + "T00:00:00Z").getTime();
      const now = Date.now();
      if (isNaN(d)) return json({ error: "Date invalide" }, 400);
      if (d < now - 86400000) return json({ error: "Date passée non permise" }, 400);
      if (d > now + 180 * 86400000) return json({ error: "Max 180 jours" }, 400);

      // Idempotency: refuse if a pending move exists for account
      const { data: existing } = await admin
        .from("service_change_requests")
        .select("id")
        .eq("account_id", body.account_id)
        .eq("change_type", "move")
        .eq("status", "pending")
        .limit(1);
      if (existing && existing.length > 0) {
        return json(
          { error: "Une demande de transfert est déjà en attente sur ce compte", request_id: existing[0].id },
          409,
        );
      }

      // Optional subscription check
      let subId: string | null = body.subscription_id ?? null;
      if (subId) {
        const { data: sub } = await admin
          .from("billing_subscriptions")
          .select("id, customer_id, plan_name")
          .eq("id", subId)
          .maybeSingle();
        if (!sub || sub.customer_id !== clientId) {
          return json({ error: "Abonnement invalide pour ce compte" }, 403);
        }
      }

      const fullAddress = `${addr}, ${city} ${pc}`;
      const notes = `Nouvelle adresse: ${fullAddress} — Motif: ${body.__audit_reason}`;

      const { data: inserted, error: insErr } = await admin
        .from("service_change_requests")
        .insert({
          account_id: body.account_id,
          client_id: clientId,
          subscription_id: subId,
          requested_by: actor.id,
          change_type: "move",
          status: "pending",
          effective_date: moveDate,
          requested_plan_name: "Transfert de service",
          notes,
        })
        .select("id")
        .single();
      if (insErr) return json({ error: insErr.message }, 500);

      // Audit
      await admin.from("admin_audit_log").insert({
        admin_user_id: actor.id,
        admin_email: prof?.email ?? null,
        action: "service_move_requested",
        target_type: "service_change_request",
        target_id: inserted.id,
        details: {
          account_id: body.account_id,
          client_id: clientId,
          subscription_id: subId,
          new_address: fullAddress,
          move_date: moveDate,
          reason: body.__audit_reason,
        },
      });

      // Activity log
      await admin.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: actor.id,
        actor_name: actorName,
        actor_role: actorRole,
        action_type: "service_change",
        entity_type: "service",
        entity_id: inserted.id,
        summary: `Demande de transfert de service planifiée le ${moveDate} vers ${fullAddress}`,
        after_data: { new_address: fullAddress, move_date: moveDate, subscription_id: subId },
      });

      // Internal note
      await admin.from("client_internal_notes").insert({
        client_id: clientId,
        account_id: body.account_id,
        note_type: actorRole === "admin" || actorRole === "core_admin" ? "admin" : "employee",
        body: `[SERVICE.MOVE.REQUESTED] Transfert planifié le ${moveDate} vers ${fullAddress}. Motif: ${body.__audit_reason}`,
        created_by_user_id: actor.id,
        created_by_role: actorRole,
        created_by_name: actorName,
      });

      // Email queued (bilingual template handled by consumer)
      const { data: clientProf } = await admin
        .from("profiles")
        .select("email, full_name, preferred_language")
        .eq("user_id", clientId)
        .maybeSingle();
      if (clientProf?.email) {
        const { error: emailErr } = await admin.from("email_queue").insert({
          to_email: clientProf.email,
          subject: "Transfert de service planifié / Service move scheduled",
          template_key: "service_move_requested",
          template_vars: {
            recipient_name: clientProf.full_name ?? null,
            new_address: fullAddress,
            move_date: moveDate,
            account_number: account.account_number,
          },
          status: "queued",
          priority: 5,
          language: (clientProf.preferred_language === "en" ? "en" : "fr"),
          event_key: `service_move_requested:${inserted.id}`,
          entity_type: "service_change_request",
          entity_id: inserted.id,
        });
        if (emailErr) console.error("[service-move-actions] email_queue insert failed", emailErr);
      } else {
        console.log("[service-move-actions] no client email to queue", { clientId });
      }

      return json({ ok: true, request_id: inserted.id });
    }

    if (body.action === "cancel_move") {
      if (!body.request_id) return json({ error: "request_id requis" }, 400);
      const { data: sr } = await admin
        .from("service_change_requests")
        .select("id, account_id, client_id, status, change_type, effective_date, notes")
        .eq("id", body.request_id)
        .maybeSingle();
      if (!sr) return json({ error: "Demande introuvable" }, 404);
      if (sr.account_id !== body.account_id || sr.client_id !== clientId) {
        return json({ error: "Isolation: demande n'appartient pas au compte" }, 403);
      }
      if (sr.change_type !== "move") return json({ error: "Pas une demande de transfert" }, 400);
      if (sr.status !== "pending") {
        return json({ error: `Impossible d'annuler (statut=${sr.status})` }, 409);
      }

      const { error: updErr } = await admin
        .from("service_change_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", body.request_id);
      if (updErr) return json({ error: updErr.message }, 500);

      await admin.from("admin_audit_log").insert({
        admin_user_id: actor.id,
        admin_email: prof?.email ?? null,
        action: "service_move_cancelled",
        target_type: "service_change_request",
        target_id: body.request_id,
        details: { account_id: body.account_id, reason: body.__audit_reason },
      });
      await admin.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: actor.id,
        actor_name: actorName,
        actor_role: actorRole,
        action_type: "service_change",
        entity_type: "service",
        entity_id: body.request_id,
        summary: `Demande de transfert annulée (${body.__audit_reason})`,
        before_data: { status: "pending" },
        after_data: { status: "cancelled" },
      });
      await admin.from("client_internal_notes").insert({
        client_id: clientId,
        account_id: body.account_id,
        note_type: actorRole === "admin" || actorRole === "core_admin" ? "admin" : "employee",
        body: `[SERVICE.MOVE.CANCELLED] Transfert annulé. Motif: ${body.__audit_reason}`,
        created_by_user_id: actor.id,
        created_by_role: actorRole,
        created_by_name: actorName,
      });
      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("[service-move-actions]", e);
    return json({ error: (e as Error).message ?? "Erreur interne" }, 500);
  }
});
