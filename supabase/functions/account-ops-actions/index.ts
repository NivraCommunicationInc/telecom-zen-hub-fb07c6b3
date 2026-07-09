// Account ops actions — Nivra Core & Nivra OneView CS
// Staff-only quick-create operations from the Account 360 action bar:
//   - create_ticket        : opens a support_tickets row for the client
//   - send_reminder        : opens a "rappel" ticket (billing/general) + client email
//   - schedule_appointment : creates an appointments row + client email
//   - add_internal_note    : writes a client_internal_notes row (no client email)
//
// Each write is gated by staff role, audited, and (when appropriate) queues
// a branded Violet Bold corporate-shell client email.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set([
  "admin", "employee", "supervisor", "support", "billing_admin", "sales",
]);

type Action =
  | "create_ticket"
  | "send_reminder"
  | "schedule_appointment"
  | "add_internal_note"
  | "notify_address_change"
  | "pause_account"
  | "unpause_account"
  | "cancel_account";

interface Body {
  action: Action;
  client_user_id: string;
  account_id?: string | null;
  idempotency_key?: string | null;

  // create_ticket / send_reminder
  subject?: string;
  description?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  category?: string;             // free-form, e.g. "billing", "technical"
  reminder_type?: "billing_overdue" | "appointment" | "kyc" | "equipment_return" | "general";

  // schedule_appointment
  title?: string;
  scheduled_at?: string;         // ISO
  duration_minutes?: number;
  service_type?: string;
  service_address?: string;
  service_city?: string;
  service_postal_code?: string;
  client_phone?: string;
  internal_notes?: string;

  // add_internal_note
  note_type?: "Général" | "Facturation" | "Technique" | "Plainte" | "Suivi" | "Important";
  body?: string;

  // notify_address_change
  new_address?: string;
  new_city?: string;
  new_province?: string;
  new_postal?: string;
  old_address?: string;

  // pause_account / unpause_account
  paused_until?: string;         // ISO date
  pause_charge_pct?: number;     // 0..100
  reason?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fmtDateTime = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fr-CA", {
      dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto",
    }).format(new Date(iso));
  } catch (_e) { return iso; }
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

  const { isStaff, callerRole } = await checkStaffAuth(admin, user.id);
  if (!isStaff) return json(403, { error: "Action réservée au personnel autorisé" });

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return json(400, { error: "Champs requis: action, client_user_id" });
  }

  // Caller name
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("first_name,last_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const callerName = [callerProfile?.first_name, callerProfile?.last_name]
    .filter(Boolean).join(" ") || "Personnel Nivra";

  // Client profile
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, email, first_name, last_name, phone, account_number")
    .eq("user_id", client_user_id)
    .maybeSingle();
  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";

  const audit = async (label: string, payload: Record<string, unknown>) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `account_ops.${label}`,
        admin_user_id: user.id,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        details: payload,
      });
    } catch (_e) { /* swallow */ }
  };

  const enqueueEmail = async (template: string, vars: Record<string, unknown>, attachments?: any[] | null) => {
    if (!clientEmail) return;
    try {
      await admin.from("email_queue").insert({
        to_email: clientEmail,
        template_key: template,
        template_vars: { ...vars, first_name: firstName, to_email: clientEmail },
        attachments: attachments ?? null,
        status: "queued",
        priority: 0,
      });
    } catch (_e) { /* swallow */ }
  };

  try {
    switch (action) {
      // ============================================================
      case "create_ticket":
      case "send_reminder": {
        const subject = (body.subject || "").trim();
        const description = (body.description || "").trim();
        if (!subject) return json(400, { error: "Sujet requis" });
        if (!description) return json(400, { error: "Description requise" });
        const priority = body.priority || "normal";
        const category = body.category || (action === "send_reminder" ? "reminder" : "general");

        const { data, error } = await admin
          .from("support_tickets")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subject,
            description,
            status: "open",
            priority,
            category,
            client_email: clientEmail,
            client_name: clientName,
            created_by_user_id: user.id,
            created_by_role: callerRole,
            source: "staff_account_360",
          })
          .select("id,ticket_number")
          .single();
        if (error) return json(500, { error: error.message });

        await audit(action, { ticket_id: data.id, ticket_number: data.ticket_number, priority, category });

        if (action === "send_reminder") {
          await enqueueEmail("client_account_reminder", {
            subject, message: description,
            ticket_number: data.ticket_number || "—",
            reminder_type: body.reminder_type || "general",
          });
        } else {
          await enqueueEmail("client_ticket_opened", {
            subject, message: description,
            ticket_number: data.ticket_number || "—",
            priority,
          });
        }

        return json(200, { ok: true, ticket_id: data.id, ticket_number: data.ticket_number });
      }

      // ============================================================
      case "schedule_appointment": {
        const title = (body.title || "").trim();
        const scheduled_at = body.scheduled_at;
        if (!title) return json(400, { error: "Titre requis" });
        if (!scheduled_at) return json(400, { error: "Date/heure requise" });
        const when = new Date(scheduled_at);
        if (Number.isNaN(when.getTime())) return json(400, { error: "Date invalide" });

        const { data, error } = await admin
          .from("appointments")
          .insert({
            client_id: client_user_id,
            admin_id: user.id,
            created_by: user.id,
            title,
            description: body.internal_notes ?? null,
            scheduled_at: when.toISOString(),
            duration_minutes: body.duration_minutes ?? 60,
            status: "scheduled",
            service_type: body.service_type ?? null,
            service_address: body.service_address ?? null,
            service_city: body.service_city ?? null,
            service_postal_code: body.service_postal_code ?? null,
            client_email: clientEmail,
            client_phone: body.client_phone ?? profile?.phone ?? null,
            installation_method: "auto",
            environment: "live",
            internal_notes: body.internal_notes ?? null,
          })
          .select("id, appointment_number, scheduled_at")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("schedule_appointment", {
          appointment_id: data.id,
          appointment_number: data.appointment_number,
          scheduled_at: data.scheduled_at,
        });
        await enqueueEmail("client_appointment_scheduled", {
          title,
          appointment_number: data.appointment_number || "—",
          scheduled_at: fmtDateTime(data.scheduled_at as string),
          service_type: body.service_type || "—",
          service_address: [body.service_address, body.service_city, body.service_postal_code]
            .filter(Boolean).join(", ") || "—",
        });

        return json(200, { ok: true, appointment_id: data.id, appointment_number: data.appointment_number });
      }

      // ============================================================
      case "add_internal_note": {
        const note_type = body.note_type || "Général";
        const txt = (body.body || "").trim();
        if (!txt) return json(400, { error: "Note requise" });

        const { data, error } = await admin
          .from("client_internal_notes")
          .insert({
            client_id: client_user_id,
            account_id: body.account_id ?? null,
            note_type,
            body: txt,
            created_by_user_id: user.id,
            created_by_role: callerRole,
            created_by_name: callerName,
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("add_internal_note", { note_id: data.id, note_type, length: txt.length });
        // No client email — internal only.
        return json(200, { ok: true, note_id: data.id });
      }

      // ============================================================
      case "notify_address_change": {
        const parts = [body.new_address, body.new_city, body.new_province, body.new_postal].filter(Boolean);
        const newAddr = parts.join(", ");
        if (!newAddr) return json(400, { error: "Nouvelle adresse requise" });

        try {
          const { buildAutoDocPdfAttachment } = await import("../_shared/pdfFromDb.ts");
          const addrPdf = await buildAutoDocPdfAttachment("address_change", {
            client_email: clientEmail,
            first_name: firstName,
            last_name: profile?.last_name || "",
            account_number: profile?.account_number || "",
            new_address: newAddr,
            old_address: body.old_address || "—",
            effective_date: new Date().toISOString(),
          }).catch(() => null);

          await enqueueEmail("client_address_change_notice", {
            new_address: newAddr,
            old_address: body.old_address || "—",
            effective_date: new Date().toISOString().split("T")[0],
            account_number: profile?.account_number || "",
          }, addrPdf ? [addrPdf] : null);

          await audit("notify_address_change", { new_address: newAddr, old_address: body.old_address || null });
        } catch (_e) { /* swallow */ }

        return json(200, { ok: true });
      }

      // ============================================================
      case "pause_account": {
        const reason = (body.reason || "").trim();
        const untilRaw = body.paused_until;
        const pct = Number.isFinite(body.pause_charge_pct as number) ? Math.max(0, Math.min(100, Number(body.pause_charge_pct))) : 35;
        if (!body.account_id) return json(400, { error: "account_id requis" });
        if (!untilRaw) return json(400, { error: "Date de fin requise" });
        if (!reason) return json(400, { error: "Motif obligatoire" });
        const until = new Date(untilRaw);
        if (Number.isNaN(until.getTime())) return json(400, { error: "Date invalide" });
        if (until.getTime() <= Date.now()) return json(400, { error: "La date doit être dans le futur" });

        const { data: acct, error: acctErr } = await admin
          .from("accounts")
          .select("id, status, paused_until")
          .eq("id", body.account_id)
          .maybeSingle();
        if (acctErr) return json(500, { error: acctErr.message });
        if (!acct) return json(404, { error: "Compte introuvable" });
        if (acct.status === "suspended") return json(409, { error: "Ce compte est déjà en pause temporaire" });
        if (acct.status === "cancelled") return json(409, { error: "Ce compte est résilié — pause impossible" });

        const nowIso = new Date().toISOString();
        const { error: upErr } = await admin.from("accounts").update({
          status: "suspended",
          paused_at: nowIso,
          paused_until: until.toISOString(),
          pause_charge_pct: pct,
          pause_reason: reason,
          updated_at: nowIso,
        }).eq("id", body.account_id);
        if (upErr) return json(500, { error: upErr.message });

        await audit("pause_account", {
          account_id: body.account_id,
          paused_until: until.toISOString(),
          pause_charge_pct: pct,
          reason,
        });

        try {
          await admin.from("client_activity_logs").insert({
            client_id: client_user_id,
            actor_user_id: user.id,
            actor_name: callerName,
            actor_role: callerRole,
            action_type: "account_pause",
            entity_type: "account",
            entity_id: body.account_id,
            summary: `Pause temporaire appliquée jusqu'au ${until.toISOString().split("T")[0]} (${pct}%)`,
            after_data: { paused_until: until.toISOString(), pause_charge_pct: pct, reason },
          });
        } catch (_e) { /* swallow */ }

        try {
          await admin.from("client_internal_notes").insert({
            client_id: client_user_id,
            account_id: body.account_id,
            note_type: "system",
            body: `Pause temporaire — par ${user.email || callerName} — jusqu'au ${until.toISOString().split("T")[0]} (${pct}% du forfait) — motif: ${reason}`,
            created_by_user_id: user.id,
            created_by_role: callerRole,
            created_by_name: callerName,
          });
        } catch (_e) { /* swallow */ }

        return json(200, { ok: true, account_id: body.account_id });
      }

      // ============================================================
      case "unpause_account": {
        const reason = (body.reason || "").trim();
        if (!body.account_id) return json(400, { error: "account_id requis" });
        if (!reason) return json(400, { error: "Motif obligatoire" });

        const { data: acct, error: acctErr } = await admin
          .from("accounts")
          .select("id, status")
          .eq("id", body.account_id)
          .maybeSingle();
        if (acctErr) return json(500, { error: acctErr.message });
        if (!acct) return json(404, { error: "Compte introuvable" });
        if (acct.status !== "suspended") return json(409, { error: "Le compte n'est pas en pause" });

        const nowIso = new Date().toISOString();
        const { error: upErr } = await admin.from("accounts").update({
          status: "active",
          paused_at: null,
          paused_until: null,
          pause_charge_pct: null,
          pause_reason: null,
          updated_at: nowIso,
        }).eq("id", body.account_id);
        if (upErr) return json(500, { error: upErr.message });

        await audit("unpause_account", { account_id: body.account_id, reason });

        try {
          await admin.from("client_activity_logs").insert({
            client_id: client_user_id,
            actor_user_id: user.id,
            actor_name: callerName,
            actor_role: callerRole,
            action_type: "account_pause",
            entity_type: "account",
            entity_id: body.account_id,
            summary: "Pause temporaire levée — compte réactivé",
            after_data: { reason },
          });
        } catch (_e) { /* swallow */ }

        try {
          await admin.from("client_internal_notes").insert({
            client_id: client_user_id,
            account_id: body.account_id,
            note_type: "system",
            body: `Pause temporaire levée — par ${user.email || callerName} — motif: ${reason}`,
            created_by_user_id: user.id,
            created_by_role: callerRole,
            created_by_name: callerName,
          });
        } catch (_e) { /* swallow */ }

        return json(200, { ok: true, account_id: body.account_id });
      }

      // ============================================================
      case "cancel_account": {
        const reason = (body.reason || "").trim();
        if (!body.account_id) return json(400, { error: "account_id requis" });
        if (!reason) return json(400, { error: "Motif obligatoire" });

        const { data: acct, error: acctErr } = await admin
          .from("accounts")
          .select("id, status")
          .eq("id", body.account_id)
          .maybeSingle();
        if (acctErr) return json(500, { error: acctErr.message });
        if (!acct) return json(404, { error: "Compte introuvable" });
        if (acct.status === "cancelled") return json(409, { error: "Ce compte est déjà résilié" });

        const nowIso = new Date().toISOString();
        const { error: upErr } = await admin.from("accounts").update({
          status: "cancelled",
          cancelled_at: nowIso,
          cancellation_reason: reason,
          updated_at: nowIso,
        }).eq("id", body.account_id);
        if (upErr) return json(500, { error: upErr.message });

        // Cancel every non-terminal subscription (billing_subscriptions is keyed by customer_id = auth user id).
        // Terminal states we never re-touch: cancelled, terminated, expired, refunded.
        let cancelledSubs = 0;
        try {
          const { data: subs, error: subErr } = await admin
            .from("billing_subscriptions")
            .update({ status: "cancelled", updated_at: nowIso })
            .eq("customer_id", client_user_id)
            .not("status", "in", "(cancelled,terminated,expired,refunded)")
            .select("id");
          if (subErr) console.error("cancel_account subs update", subErr);
          cancelledSubs = subs?.length ?? 0;
        } catch (e) { console.error("cancel_account subs exception", e); }

        await audit("cancel_account", {
          account_id: body.account_id,
          reason,
          previous_status: acct.status,
          cancelled_subscriptions: cancelledSubs,
        });

        try {
          await admin.from("client_activity_logs").insert({
            client_id: client_user_id,
            actor_user_id: user.id,
            actor_name: callerName,
            actor_role: callerRole,
            action_type: "account_cancel",
            entity_type: "account",
            entity_id: body.account_id,
            summary: `Compte annulé — motif: ${reason}${cancelledSubs ? ` — ${cancelledSubs} service(s) résilié(s)` : ""}`,
            after_data: { reason, cancelled_subscriptions: cancelledSubs },
          });
        } catch (_e) { /* swallow */ }

        try {
          await admin.from("client_internal_notes").insert({
            client_id: client_user_id,
            account_id: body.account_id,
            note_type: "system",
            body: `Compte annulé — par ${user.email || callerName} — motif: ${reason}${cancelledSubs ? ` — ${cancelledSubs} service(s) résilié(s)` : ""}`,
            created_by_user_id: user.id,
            created_by_role: callerRole,
            created_by_name: callerName,
          });
        } catch (_e) { /* swallow */ }

        return json(200, { ok: true, account_id: body.account_id, cancelled_subscriptions: cancelledSubs });
      }


      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
