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
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";

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
  | "update_pause"
  | "cancel_account"
  | "reactivate_account";

// Module 25 — durée max de pause temporaire (jours)
const PAUSE_MAX_DAYS = 180;

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

  // pause_account / unpause_account / update_pause
  paused_until?: string;         // ISO date
  pause_charge_pct?: number;     // 0..100 — F5: ignoré serveur, conservé pour compat
  reason?: string;
  auto_resume?: boolean;         // set by pause-auto-resume cron (bypasses reason requirement)

  // reactivate_account
  resume_suspended?: boolean;    // default true
  reactivate_cancelled?: boolean; // default false
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

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Service-role bypass reserved for the pause-auto-resume cron (auto_resume=true).
  // Parse body early so we can distinguish this legitimate machine caller.
  let earlyBody: any = null;
  try { earlyBody = await req.clone().json(); } catch { /* ignore */ }
  const isServiceRoleCaller =
    authHeader === `Bearer ${serviceKey}` &&
    earlyBody?.action === "unpause_account" &&
    earlyBody?.auto_resume === true;

  let user: { id: string; email?: string | null } | null = null;
  let callerRole = "system";
  let roles: string[] = ["admin"];

  if (isServiceRoleCaller) {
    user = { id: "00000000-0000-0000-0000-000000000000", email: "system@nivra-telecom.ca" };
  } else {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: u }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !u) return json(401, { error: "Session invalide" });
    user = u;
    const staff = await checkStaffAuth(admin, u.id);
    if (!staff.isStaff) return json(403, { error: "Action réservée au personnel autorisé" });
    if (!staff.roles.some((r) => ALLOWED_ROLES.has(r))) {
      return json(403, { error: "Rôle non autorisé pour cette action" });
    }
    callerRole = staff.callerRole;
    roles = staff.roles;
  }

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
      await enqueueCommunication(admin, {
      channel: "email",
      recipient: clientEmail,
      templateKey: template,
      attachments: attachments ?? null,
      priority: 0,
      idempotencyKey: `acct360:account-ops:${body.account_id ?? "na"}:${template}:${body.idempotency_key ?? body.__audit_reason ?? "default"}`,
      templateVars: { ...vars, first_name: firstName, to_email: clientEmail },
    });
    } catch (_e) { /* swallow */ }
  };

  try {
    switch (action) {
      // ============================================================
      case "create_ticket":
      case "send_reminder": {
        // MODULE 35 — SINGLE DOOR: delegate to canonical support-account-actions.
        // This block is now a thin backward-compat wrapper. All Ticket writes
        // must ultimately flow through public.rpc_ticket_create.
        const subject = (body.subject || "").trim();
        const description = (body.description || "").trim();
        if (!subject) return json(400, { error: "Sujet requis" });
        if (!description) return json(400, { error: "Description requise" });
        const priority = body.priority || "normal";
        const category = body.category || (action === "send_reminder" ? "reminder" : "general");

        const { createTicket } = await import("../_shared/ticketService.ts");
        try {
          const ticket = await createTicket(admin, {
            user_id: user.id, role: (callerRole === "admin" ? "admin" : "employee"),
            name: callerName, email: user.email ?? null,
          }, {
            owner_user_id: client_user_id,
            account_id: body.account_id ?? null,
            subject, description,
            category, priority,
            source: action === "send_reminder" ? "reminder_account_360" : "staff_account_360",
            client_email: clientEmail,
            client_name: clientName,
            related_order_id: null,
            idempotency_key: body.idempotency_key ?? null,
            metadata: action === "send_reminder"
              ? { reminder_type: body.reminder_type || "general" }
              : {},
          });
          await audit(action, { ticket_id: ticket.id, ticket_number: ticket.ticket_number, priority, category, via: "ticketService" });
          return json(200, { ok: true, ticket_id: ticket.id, ticket_number: ticket.ticket_number });
        } catch (e) {
          return json(500, { error: (e as Error).message });
        }
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
      // Module 25 — Pause temporaire (create / update / lift)
      //
      // F5 note: `pause_charge_pct` is intentionally NOT read by billing.
      // La pause temporaire = suspension opérationnelle complète du compte;
      // le billing lifecycle ignore les comptes `status='suspended'`. Nous
      // gelons donc la valeur à 0 côté serveur pour éviter toute promesse
      // non tenue. Le champ reste dans la table pour rétro-compatibilité
      // mais n'est plus alimenté par cette EF. Si un jour un vrai prorata
      // partiel devait être appliqué, ce sera un nouveau module dédié.
      // ============================================================
      case "pause_account": {
        const reason = (body.reason || "").trim();
        const untilRaw = body.paused_until;
        if (!body.account_id) return json(400, { error: "account_id requis" });
        if (!untilRaw) return json(400, { error: "Date de fin requise" });
        if (reason.length < 5) return json(400, { error: "Motif obligatoire (min. 5 caractères)" });
        const until = new Date(untilRaw);
        if (Number.isNaN(until.getTime())) return json(400, { error: "Date invalide" });
        if (until.getTime() <= Date.now()) return json(400, { error: "La date doit être dans le futur" });
        const maxTs = Date.now() + PAUSE_MAX_DAYS * 86_400_000;
        if (until.getTime() > maxTs) {
          return json(400, { error: `La pause ne peut dépasser ${PAUSE_MAX_DAYS} jours` });
        }

        const { data: acct, error: acctErr } = await admin
          .from("accounts")
          .select("id, status, paused_until, client_id")
          .eq("id", body.account_id)
          .maybeSingle();
        if (acctErr) return json(500, { error: acctErr.message });
        if (!acct) return json(404, { error: "Compte introuvable" });
        // F2 — Ownership check: le compte doit appartenir au client_user_id fourni.
        if ((acct as any).client_id !== client_user_id) {
          await audit("pause_account_denied", {
            reason_code: "CROSS_CLIENT_TARGET",
            account_id: body.account_id,
            claimed_client_user_id: client_user_id,
          });
          return json(403, { error: "Compte non associé à ce client" });
        }
        if (acct.status === "suspended") return json(409, { error: "Ce compte est déjà en pause temporaire" });
        if (acct.status === "cancelled") return json(409, { error: "Ce compte est résilié — pause impossible" });

        // F10 — Conflit avec Module 20 (Geler cycle / essai).
        // Interdit si une requête de gel active existe pour ce compte.
        try {
          const { data: freeze } = await admin
            .from("service_change_requests")
            .select("id, status, change_type")
            .eq("account_id", body.account_id)
            .in("change_type", ["freeze_cycle", "trial_extension", "billing_hold"])
            .in("status", ["pending", "approved", "active"])
            .limit(1)
            .maybeSingle();
          if (freeze) {
            await audit("pause_account_denied", {
              reason_code: "FREEZE_ACTIVE",
              account_id: body.account_id,
              freeze_id: (freeze as any).id,
            });
            return json(409, { error: "Un gel de cycle est déjà actif sur ce compte (Module 20). Levez-le avant d'appliquer une pause." });
          }
        } catch (_e) { /* swallow — best effort */ }

        const nowIso = new Date().toISOString();
        const { error: upErr } = await admin.from("accounts").update({
          status: "suspended",
          paused_at: nowIso,
          paused_until: until.toISOString(),
          pause_charge_pct: 0, // F5 — neutralisé
          pause_reason: reason,
          updated_at: nowIso,
        }).eq("id", body.account_id);
        if (upErr) return json(500, { error: upErr.message });

        await audit("pause_account", {
          module_tag: "pause_temporaire",
          account_id: body.account_id,
          paused_until: until.toISOString(),
          pause_charge_pct: 0,
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
            summary: `Pause temporaire appliquée jusqu'au ${until.toISOString().split("T")[0]}`,
            after_data: { paused_until: until.toISOString(), reason },
          });
        } catch (_e) { /* swallow */ }

        try {
          await admin.from("client_internal_notes").insert({
            client_id: client_user_id,
            account_id: body.account_id,
            note_type: "system",
            body: `Pause temporaire — par ${user.email || callerName} — jusqu'au ${until.toISOString().split("T")[0]} — motif: ${reason}`,
            created_by_user_id: user.id,
            created_by_role: callerRole,
            created_by_name: callerName,
          });
        } catch (_e) { /* swallow */ }

        // F6 — Notification client via email_queue uniquement.
        await enqueueEmail("client_account_paused", {
          paused_until: until.toISOString().split("T")[0],
          reason,
        });

        return json(200, { ok: true, account_id: body.account_id });
      }

      // ============================================================
      // F8 — Modifier une pause existante (paused_until + motif)
      // ============================================================
      case "update_pause": {
        const reason = (body.reason || "").trim();
        const untilRaw = body.paused_until;
        if (!body.account_id) return json(400, { error: "account_id requis" });
        if (!untilRaw) return json(400, { error: "Nouvelle date de fin requise" });
        if (reason.length < 5) return json(400, { error: "Motif obligatoire (min. 5 caractères)" });
        const until = new Date(untilRaw);
        if (Number.isNaN(until.getTime())) return json(400, { error: "Date invalide" });
        if (until.getTime() <= Date.now()) return json(400, { error: "La date doit être dans le futur" });
        const maxTs = Date.now() + PAUSE_MAX_DAYS * 86_400_000;
        if (until.getTime() > maxTs) return json(400, { error: `La pause ne peut dépasser ${PAUSE_MAX_DAYS} jours` });

        const { data: acct, error: acctErr } = await admin
          .from("accounts")
          .select("id, status, paused_until, pause_reason, client_id")
          .eq("id", body.account_id)
          .maybeSingle();
        if (acctErr) return json(500, { error: acctErr.message });
        if (!acct) return json(404, { error: "Compte introuvable" });
        if ((acct as any).client_id !== client_user_id) {
          await audit("update_pause_denied", { reason_code: "CROSS_CLIENT_TARGET", account_id: body.account_id });
          return json(403, { error: "Compte non associé à ce client" });
        }
        if (acct.status !== "suspended") return json(409, { error: "Le compte n'est pas en pause" });

        const nowIso = new Date().toISOString();
        const before = { paused_until: (acct as any).paused_until, pause_reason: (acct as any).pause_reason };
        const { error: upErr } = await admin.from("accounts").update({
          paused_until: until.toISOString(),
          pause_reason: reason,
          updated_at: nowIso,
        }).eq("id", body.account_id);
        if (upErr) return json(500, { error: upErr.message });

        await audit("update_pause", {
          module_tag: "pause_temporaire",
          account_id: body.account_id,
          before_state: before,
          after_state: { paused_until: until.toISOString(), pause_reason: reason },
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
            summary: `Pause temporaire modifiée — nouvelle échéance ${until.toISOString().split("T")[0]}`,
            before_data: before,
            after_data: { paused_until: until.toISOString(), reason },
          });
        } catch (_e) { /* swallow */ }

        try {
          await admin.from("client_internal_notes").insert({
            client_id: client_user_id,
            account_id: body.account_id,
            note_type: "system",
            body: `Pause temporaire modifiée — par ${user.email || callerName} — nouvelle échéance ${until.toISOString().split("T")[0]} — motif: ${reason}`,
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
        const autoResume = body.auto_resume === true; // appelé par cron
        if (!body.account_id) return json(400, { error: "account_id requis" });
        if (!autoResume && reason.length < 5) {
          return json(400, { error: "Motif obligatoire (min. 5 caractères)" });
        }

        const { data: acct, error: acctErr } = await admin
          .from("accounts")
          .select("id, status, client_id")
          .eq("id", body.account_id)
          .maybeSingle();
        if (acctErr) return json(500, { error: acctErr.message });
        if (!acct) return json(404, { error: "Compte introuvable" });
        // F2 — Ownership check (skip for cron/service auto-resume: client_user_id may equal owner already).
        if ((acct as any).client_id !== client_user_id) {
          await audit("unpause_account_denied", {
            reason_code: "CROSS_CLIENT_TARGET",
            account_id: body.account_id,
            claimed_client_user_id: client_user_id,
          });
          return json(403, { error: "Compte non associé à ce client" });
        }
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

        await audit("unpause_account", {
          module_tag: "pause_temporaire",
          account_id: body.account_id,
          reason: autoResume ? "auto_resume" : reason,
          auto_resume: autoResume,
        });

        try {
          await admin.from("client_activity_logs").insert({
            client_id: client_user_id,
            actor_user_id: user.id,
            actor_name: autoResume ? "Système (reprise automatique)" : callerName,
            actor_role: autoResume ? "system" : callerRole,
            action_type: "account_pause",
            entity_type: "account",
            entity_id: body.account_id,
            summary: autoResume
              ? "Pause temporaire levée automatiquement (échéance atteinte)"
              : "Pause temporaire levée — compte réactivé",
            after_data: { reason: autoResume ? "auto_resume" : reason },
          });
        } catch (_e) { /* swallow */ }

        try {
          await admin.from("client_internal_notes").insert({
            client_id: client_user_id,
            account_id: body.account_id,
            note_type: "system",
            body: autoResume
              ? `Pause temporaire levée automatiquement (échéance atteinte)`
              : `Pause temporaire levée — par ${user.email || callerName} — motif: ${reason}`,
            created_by_user_id: user.id,
            created_by_role: autoResume ? "system" : callerRole,
            created_by_name: autoResume ? "Système" : callerName,
          });
        } catch (_e) { /* swallow */ }

        // F6 — Notification client
        await enqueueEmail("client_account_resumed", {
          auto_resume: autoResume,
          reason: autoResume ? "Échéance atteinte" : reason,
        });



        return json(200, { ok: true, account_id: body.account_id });
      }

      // ============================================================
      // MODULE 26 — Annuler le compte
      // Fixes appliqués : F26-1 ownership · F26-2 cascade via billing_customers ·
      // F26-3 email bilingue · F26-4 motif min 5 · F26-5 AutoPay OFF · F26-6 idempotency ·
      // F26-7 snapshot before/after · F26-8 garde solde impayé · F26-9 équipement à retourner ·
      // F26-11 rôle restreint (admin/supervisor/billing_admin)
      case "cancel_account": {
        // F26-11 — rôle restreint pour cette action destructrice
        const CANCEL_ALLOWED = new Set(["admin", "supervisor", "billing_admin"]);
        if (!isServiceRoleCaller && !roles.some((r) => CANCEL_ALLOWED.has(r))) {
          await audit("cancel_account_denied", {
            reason_code: "ROLE_NOT_ALLOWED",
            account_id: body.account_id,
            caller_roles: roles,
          });
          return json(403, { error: "Action réservée à admin / superviseur / billing_admin", code: "ROLE_NOT_ALLOWED" });
        }

        const reason = (body.reason || "").trim();
        const idempotencyKey = (body.idempotency_key || "").trim() || null;
        const acknowledgeUnpaid = body.acknowledge_unpaid === true;
        const acknowledgeEquipment = body.acknowledge_equipment === true;

        if (!body.account_id) return json(400, { error: "account_id requis" });
        // F26-4 — motif min 5 caractères (parité Modules 20/24/25)
        if (reason.length < 5) return json(400, { error: "Motif obligatoire (min 5 caractères)", code: "REASON_REQUIRED" });

        // F26-6 — Idempotency : rejouer la même clé retourne le résultat original.
        if (idempotencyKey) {
          const { data: prior } = await admin
            .from("admin_audit_log")
            .select("id, details")
            .eq("action", "account_ops.cancel_account")
            .eq("target_id", client_user_id)
            .contains("details", { idempotency_key: idempotencyKey })
            .limit(1)
            .maybeSingle();
          if (prior) {
            return json(200, {
              ok: true,
              idempotent: true,
              account_id: body.account_id,
              cancelled_subscriptions: (prior as any).details?.cancelled_subscriptions ?? 0,
            });
          }
        }

        const { data: acct, error: acctErr } = await admin
          .from("accounts")
          .select("id, status, client_id, account_number")
          .eq("id", body.account_id)
          .maybeSingle();
        if (acctErr) return json(500, { error: acctErr.message });
        if (!acct) return json(404, { error: "Compte introuvable" });

        // F26-1 — Ownership cross-client
        if ((acct as any).client_id !== client_user_id) {
          await audit("cancel_account_denied", {
            reason_code: "CROSS_CLIENT_TARGET",
            account_id: body.account_id,
            claimed_client_user_id: client_user_id,
          });
          return json(403, { error: "Compte non associé à ce client", code: "CROSS_CLIENT_TARGET" });
        }

        if (acct.status === "cancelled") return json(409, { error: "Ce compte est déjà résilié", code: "ALREADY_CANCELLED" });

        // F26-2 — résoudre billing_customers.id (customer_id canonique) à partir du user_id.
        const { data: billingCust } = await admin
          .from("billing_customers")
          .select("id, autopay_enabled, autopay_discount_active")
          .eq("user_id", client_user_id)
          .maybeSingle();
        const customerId = billingCust?.id ?? null;

        // F26-8 — Solde impayé : agrégat des factures non réglées liées au customer_id.
        let balanceDue = 0;
        if (customerId) {
          const { data: openInv } = await admin
            .from("billing_invoices")
            .select("balance_due, status")
            .eq("customer_id", customerId)
            .not("status", "in", "(paid,void,cancelled,refunded)");
          balanceDue = (openInv ?? []).reduce((s: number, r: any) => s + Number(r?.balance_due ?? 0), 0);
        }
        if (balanceDue > 0 && !acknowledgeUnpaid) {
          return json(400, {
            error: `Solde impayé de ${balanceDue.toFixed(2)} $ — confirmez que la dette reste due (acknowledge_unpaid=true) ou routez vers Recouvrement.`,
            code: "UNPAID_BALANCE_ACK_REQUIRED",
            balance_due: balanceDue,
          });
        }

        // Snapshot BEFORE (F26-7)
        let subsBefore: any[] = [];
        if (customerId) {
          const { data } = await admin
            .from("billing_subscriptions")
            .select("id, status, plan_name")
            .eq("customer_id", customerId);
          subsBefore = data ?? [];
        }


        // F26-9 — équipement encore attribué : forcer acknowledgment
        const { data: equipAssigned } = await admin
          .from("equipment_inventory")
          .select("id, category, serial_number")
          .eq("account_id", body.account_id)
          .in("status", ["assigned", "deployed", "active"]);
        const equipmentCount = equipAssigned?.length ?? 0;
        if (equipmentCount > 0 && !acknowledgeEquipment) {
          return json(400, {
            error: `${equipmentCount} équipement(s) encore attribué(s) — confirmez la création des retours (acknowledge_equipment=true).`,
            code: "EQUIPMENT_RETURN_ACK_REQUIRED",
            equipment_count: equipmentCount,
          });
        }

        const nowIso = new Date().toISOString();
        const previousStatus = acct.status;

        // ---- Mutation principale ---------------------------------------
        const { error: upErr } = await admin.from("accounts").update({
          status: "cancelled",
          cancelled_at: nowIso,
          cancellation_reason: reason,
          updated_at: nowIso,
        }).eq("id", body.account_id);
        if (upErr) return json(500, { error: upErr.message });

        // F26-2 — cascade réelle sur customer_id canonique
        const NON_TERMINAL_STATES = ["active", "pending", "suspended"];
        let cancelledSubs = 0;
        let subsAfter: any[] = [];
        if (customerId) {
          try {
            const { data: subs, error: subErr } = await admin
              .from("billing_subscriptions")
              .update({ status: "cancelled", updated_at: nowIso })
              .eq("customer_id", customerId)
              .in("status", NON_TERMINAL_STATES)
              .select("id, plan_name");
            if (subErr) console.error("cancel_account subs update", subErr);
            cancelledSubs = subs?.length ?? 0;
            subsAfter = subs ?? [];
          } catch (e) { console.error("cancel_account subs exception", e); }
        }

        // F26-5 — désactivation AutoPay + neutralisation de la remise
        let autopayDisabled = false;
        if (customerId && (billingCust?.autopay_enabled || billingCust?.autopay_discount_active)) {
          try {
            const { error: apErr } = await admin
              .from("billing_customers")
              .update({
                autopay_enabled: false,
                autopay_discount_active: false,
                updated_at: nowIso,
              })
              .eq("id", customerId);
            if (apErr) console.error("cancel_account autopay off", apErr);
            else autopayDisabled = true;
          } catch (e) { console.error("cancel_account autopay exception", e); }
        }

        // F26-9 — créer une demande de retour par équipement encore attribué
        let equipmentReturnRequests = 0;
        if (equipmentCount > 0) {
          try {
            const rows = (equipAssigned ?? []).map((eq: any) => ({
              account_id: body.account_id,
              equipment_inventory_id: eq.id,
              client_user_id,
              reason: "account_cancelled",
              reason_detail: `Annulation compte — motif: ${reason}`,
              status: "pending",
              requested_at: nowIso,
            }));
            const { data: retIns, error: retErr } = await admin
              .from("equipment_return_requests")
              .insert(rows)
              .select("id");
            if (retErr) console.error("cancel_account equipment returns", retErr);
            else equipmentReturnRequests = retIns?.length ?? 0;
          } catch (e) { console.error("cancel_account equipment exception", e); }
        }

        // F26-7 — audit snapshot before/after complet
        await audit("cancel_account", {
          account_id: body.account_id,
          account_number: (acct as any).account_number ?? null,
          reason,
          idempotency_key: idempotencyKey,
          previous_status: previousStatus,
          new_status: "cancelled",
          before_state: {
            status: previousStatus,
            balance_due: balanceDue,
            unpaid_invoices: subsBefore.length ? null : null,
            subscriptions: subsBefore,
            autopay_enabled: billingCust?.autopay_enabled ?? false,
            equipment_assigned: equipmentCount,
          },
          after_state: {
            status: "cancelled",
            cancelled_at: nowIso,
            cancelled_subscriptions: subsAfter,
            autopay_disabled: autopayDisabled,
            equipment_return_requests: equipmentReturnRequests,
          },
          cancelled_subscriptions: cancelledSubs,
          autopay_disabled: autopayDisabled,
          equipment_return_requests: equipmentReturnRequests,
          unpaid_balance_acknowledged: balanceDue > 0 ? acknowledgeUnpaid : null,
          equipment_acknowledged: equipmentCount > 0 ? acknowledgeEquipment : null,
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
            summary: `Compte annulé — motif: ${reason}${cancelledSubs ? ` — ${cancelledSubs} service(s) résilié(s)` : ""}${autopayDisabled ? " — AutoPay désactivé" : ""}${equipmentReturnRequests ? ` — ${equipmentReturnRequests} retour(s) équipement` : ""}`,
            before_data: { status: previousStatus, balance_due: balanceDue, subscriptions: subsBefore.length },
            after_data: {
              status: "cancelled",
              reason,
              cancelled_subscriptions: cancelledSubs,
              autopay_disabled: autopayDisabled,
              equipment_return_requests: equipmentReturnRequests,
            },
          });
        } catch (_e) { /* swallow */ }

        try {
          await admin.from("client_internal_notes").insert({
            client_id: client_user_id,
            account_id: body.account_id,
            note_type: "system",
            body: `Compte annulé — par ${user.email || callerName} — motif: ${reason}${cancelledSubs ? ` — ${cancelledSubs} service(s) résilié(s)` : ""}${autopayDisabled ? " — AutoPay désactivé" : ""}${equipmentReturnRequests ? ` — ${equipmentReturnRequests} retour(s) équipement demandé(s)` : ""}${balanceDue > 0 ? ` — Solde impayé ${balanceDue.toFixed(2)} $ reste dû` : ""}`,
            created_by_user_id: user.id,
            created_by_role: callerRole,
            created_by_name: callerName,
          });
        } catch (_e) { /* swallow */ }

        // F26-3 — email bilingue via email_queue
        await enqueueEmail("client_account_cancelled", {
          account_number: (acct as any).account_number ?? null,
          cancelled_at_display: fmtDateTime(nowIso),
          reason,
          balance_due: balanceDue,
          cancelled_subscriptions: cancelledSubs,
          equipment_return_requests: equipmentReturnRequests,
        });

        return json(200, {
          ok: true,
          account_id: body.account_id,
          cancelled_subscriptions: cancelledSubs,
          autopay_disabled: autopayDisabled,
          equipment_return_requests: equipmentReturnRequests,
          balance_due: balanceDue,
        });
      }


      // ============================================================
      case "reactivate_account": {
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
        if (acct.status === "active") return json(409, { error: "Ce compte est déjà actif" });
        const REACTIVATABLE = ["cancelled", "suspended"];
        if (!REACTIVATABLE.includes(acct.status ?? "")) {
          return json(409, { error: `Statut '${acct.status}' non réactivable` });
        }

        const nowIso = new Date().toISOString();
        const { error: upErr } = await admin.from("accounts").update({
          status: "active",
          cancelled_at: null,
          cancellation_reason: null,
          paused_at: null,
          paused_until: null,
          pause_charge_pct: null,
          pause_reason: null,
          updated_at: nowIso,
        }).eq("id", body.account_id);
        if (upErr) return json(500, { error: upErr.message });

        // Cascade: resume suspended subs (default true) and/or reactivate cancelled subs (opt-in).
        // Enum billing_subscription_status: active | pending | suspended | cancelled | expired | not_renewed.
        // F26-2 sibling — resolve billing_customers.id first (customer_id canonique).
        const resumeSuspended = body.resume_suspended !== false;
        const reactivateCancelled = body.reactivate_cancelled === true;
        const targetStates: string[] = [];
        if (resumeSuspended) targetStates.push("suspended");
        if (reactivateCancelled) targetStates.push("cancelled");

        let reactivatedSubs = 0;
        if (targetStates.length > 0) {
          try {
            const { data: bc } = await admin
              .from("billing_customers")
              .select("id")
              .eq("user_id", client_user_id)
              .maybeSingle();
            if (bc?.id) {
              const { data: subs, error: subErr } = await admin
                .from("billing_subscriptions")
                .update({ status: "active", updated_at: nowIso })
                .eq("customer_id", bc.id)
                .in("status", targetStates)
                .select("id");
              if (subErr) console.error("reactivate_account subs update", subErr);
              reactivatedSubs = subs?.length ?? 0;
            }
          } catch (e) { console.error("reactivate_account subs exception", e); }
        }

        await audit("reactivate_account", {
          account_id: body.account_id,
          reason,
          previous_status: acct.status,
          reactivated_subscriptions: reactivatedSubs,
          resume_suspended: resumeSuspended,
          reactivate_cancelled: reactivateCancelled,
        });

        try {
          await admin.from("client_activity_logs").insert({
            client_id: client_user_id,
            actor_user_id: user.id,
            actor_name: callerName,
            actor_role: callerRole,
            action_type: "account_reactivate",
            entity_type: "account",
            entity_id: body.account_id,
            summary: `Compte réactivé (depuis ${acct.status}) — motif: ${reason}${reactivatedSubs ? ` — ${reactivatedSubs} service(s) réactivé(s)` : ""}`,
            after_data: { reason, reactivated_subscriptions: reactivatedSubs, previous_status: acct.status },
          });
        } catch (_e) { /* swallow */ }

        try {
          await admin.from("client_internal_notes").insert({
            client_id: client_user_id,
            account_id: body.account_id,
            note_type: "system",
            body: `Compte réactivé — par ${user.email || callerName} — motif: ${reason}${reactivatedSubs ? ` — ${reactivatedSubs} service(s) réactivé(s)` : ""}`,
            created_by_user_id: user.id,
            created_by_role: callerRole,
            created_by_name: callerName,
          });
        } catch (_e) { /* swallow */ }

        return json(200, {
          ok: true,
          account_id: body.account_id,
          reactivated_subscriptions: reactivatedSubs,
          previous_status: acct.status,
        });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
