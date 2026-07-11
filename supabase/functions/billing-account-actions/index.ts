// Billing account actions — Nivra Core & Nivra OneView CS
// Single entry for all client billing management operations:
//   - add_payment_method     : register a tokenized payment method (Visa/Mastercard/Interac/bank)
//   - remove_payment_method  : soft-delete a payment method
//   - set_default_method     : promote a method to default (unique active default per user)
//   - toggle_autopay         : enable/disable auto-pay, link to method, set day offset
//   - create_payment_plan    : create an installment plan for an invoice/balance
//   - cancel_payment_plan    : cancel an active installment plan
//   - update_billing_settings: cycle day, delivery format, language, billing email
//   - create_direct_refund   : record an out-of-band refund (manual processing)
//
// Authorization (Square/card is primary — no charge logic here,
// this function only records administrative state and triggers client emails):
//   - payment_method / autopay / billing_settings : admin, employee, supervisor, support, billing_admin
//   - payment_plan / direct_refund               : admin, supervisor, billing_admin only

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "add_payment_method"
  | "remove_payment_method"
  | "set_default_method"
  | "toggle_autopay"
  | "create_payment_plan"
  | "cancel_payment_plan"
  | "update_billing_settings"
  | "create_direct_refund";

interface Body {
  action: Action;
  client_user_id: string;
  account_id?: string | null;
  reason?: string | null;
  idempotency_key?: string | null;

  // payment method
  method_id?: string;
  method_type?: "visa" | "mastercard" | "interac" | "bank_account" | "square_card";
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  holder_name?: string;
  provider_token?: string;
  is_default?: boolean;

  // autopay
  enabled?: boolean;
  payment_method_id?: string | null;
  charge_day_offset?: number;

  // payment plan
  plan_id?: string;
  invoice_id?: string;
  total_amount?: number;
  installment_count?: number;
  frequency?: "weekly" | "biweekly" | "monthly";
  first_due_date?: string;

  // billing settings
  billing_day_of_month?: number;
  delivery_format?: "electronic" | "paper";
  language?: "fr" | "en";
  email_for_billing?: string;
  paper_mailing_address?: string;

  // refund
  payment_id?: string;
  amount?: number;
  refund_method?: "interac" | "cheque" | "credit_balance" | "bank_transfer" | "square";
  external_reference?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_BASIC = new Set([
  "admin", "employee", "supervisor", "support", "billing_admin",
]);
const ALLOWED_FINANCIAL = new Set(["admin", "supervisor", "billing_admin"]);

const fmtMoney = (n: number, currency = "CAD") => {
  try { return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(n); }
  catch { return `${n.toFixed(2)} $`; }
};

const METHOD_LABELS: Record<string, string> = {
  square: "Square",
  square_card: "Carte Square",
  visa: "Carte Visa",
  mastercard: "Carte Mastercard",
  interac: "Débit Interac",
  bank_account: "Compte bancaire",
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

    const { isStaff: _staffOk, roles: _roles } = await checkStaffAuth(admin, user.id);
  if (!_staffOk) return json(403, { error: "Action réservée au personnel autorisé" });
  const userRoles = new Set(_roles);

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return json(400, { error: "Champs requis: action, client_user_id" });
  }

  // Authorization per action
  const requireFinancial = action === "create_payment_plan"
    || action === "cancel_payment_plan"
    || action === "create_direct_refund";
  const allowed = requireFinancial ? ALLOWED_FINANCIAL : ALLOWED_BASIC;
  const isOk = [...userRoles].some((r) => allowed.has(r));
  if (!isOk) {
    return json(403, {
      error: requireFinancial
        ? "Action réservée à billing_admin / supervisor / admin"
        : "Action réservée au personnel autorisé",
    });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_id, email, first_name, last_name, account_number")
    .eq("user_id", client_user_id)
    .maybeSingle();

  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const audit = async (label: string, payload: Record<string, unknown>) => {
    try {
      const { error: audErr } = await admin.from("admin_audit_log").insert({
        action: `billing.${label}`,
        admin_user_id: user.id,
        admin_email: user.email ?? null,
        target_id: client_user_id,
        target_type: "client",
        target_email: clientEmail,
        ip_address: ip,
        details: payload,
      });
      if (audErr) console.error("[audit-insert]", JSON.stringify(audErr));
    } catch (e) { console.error("[audit-throw]", String(e)); }
  };

  const enqueueEmail = async (template: string, vars: Record<string, unknown>, attachments?: Array<{ filename: string; content: string; contentType: string }> | null) => {
    if (!clientEmail) return;
    try {
      await enqueueCommunication(admin, {
      channel: "email",
      recipient: clientEmail,
      templateKey: template,
      attachments: attachments || null,
      priority: 0,
      idempotencyKey: `acct360:billing:${body.account_id ?? "na"}:${template}:${body.idempotency_key ?? body.__audit_reason ?? "default"}`,
      templateVars: { ...vars, first_name: firstName, to_email: clientEmail },
    });
    } catch (_e) { /* swallow */ }
  };

  const enqueuePaymentMethodEmail = async (changeType: string, methodLabel: string, last4?: string, newMethod?: string) => {
    try {
      const { buildAutoDocPdfAttachment } = await import("../_shared/pdfFromDb.ts");
      const pdf = await buildAutoDocPdfAttachment("payment_method_change", {
        client_email: clientEmail,
        first_name: firstName,
        new_method: newMethod || methodLabel,
        effective_date: new Date().toISOString(),
      }).catch(() => null);
      await enqueueEmail("client_payment_method_change", {
        change_type: changeType,
        method_label: methodLabel,
        last4: last4 || "—",
        is_default: changeType === "default_set" ? "true" : "false",
      }, pdf ? [pdf] : null);
    } catch (_e) { /* swallow */ }
  };

  // ── A23-1 : parité activity_log + note interne pour toutes les actions ──
  const logAndNote = async (
    action_type: string,
    entity_type: string,
    entity_id: string | null,
    summary: string,
    before_data: Record<string, unknown> | null,
    after_data: Record<string, unknown> | null,
  ) => {
    try {
      await admin.from("client_activity_logs").insert({
        client_id:     client_user_id,
        actor_user_id: user.id,
        actor_name:    user.email ?? null,
        actor_role:    "admin",
        action_type,
        entity_type,
        entity_id,
        summary,
        before_data,
        after_data,
      });
      await admin.from("client_internal_notes").insert({
        client_id:          client_user_id,
        account_id:         body.account_id ?? null,
        note_type:          "system",
        body:               `${summary} — par ${user.email ?? user.id}`,
        created_by_user_id: user.id,
        created_by_role:    "admin",
        created_by_name:    user.email ?? null,
      });
    } catch (e) { console.warn("[logAndNote]", String(e)); }
  };

  // ── A23-3 : contrôle d'appartenance invoice/payment (sécurité cross-client) ──
  // NB: schéma canonique — billing_invoices.customer_id / account_id
  //                       billing_payments.customer_id (+ invoice_id)
  const ensureInvoiceOwnership = async (invoice_id: string) => {
    const { data: inv, error } = await admin
      .from("billing_invoices")
      .select("id, customer_id, account_id")
      .eq("id", invoice_id)
      .maybeSingle();
    if (error) return { ok: false, status: 500, error: error.message };
    if (!inv) return { ok: false, status: 404, error: "Facture introuvable" };
    const invUser = (inv as any).customer_id ?? null;
    const invAccount = (inv as any).account_id ?? null;
    const matchesUser = invUser && invUser === client_user_id;
    const matchesAccount = body.account_id && invAccount && invAccount === body.account_id;
    if (!matchesUser && !matchesAccount) {
      return { ok: false, status: 403, error: "Facture n'appartient pas à ce client (ownership check)" };
    }
    return { ok: true, invoice: inv };
  };

  const ensurePaymentOwnership = async (payment_id: string) => {
    const { data: pay, error } = await admin
      .from("billing_payments")
      .select("id, customer_id, invoice_id, amount, status, provider, provider_payment_id")
      .eq("id", payment_id)
      .maybeSingle();
    if (error) return { ok: false, status: 500, error: error.message };
    if (!pay) return { ok: false, status: 404, error: "Paiement introuvable" };
    const payUser = (pay as any).customer_id ?? null;
    if (!payUser || payUser !== client_user_id) {
      // Fallback : accepter si la facture liée appartient au client/compte
      if ((pay as any).invoice_id) {
        const own = await ensureInvoiceOwnership((pay as any).invoice_id);
        if (own.ok) return { ok: true, payment: pay };
      }
      return { ok: false, status: 403, error: "Paiement n'appartient pas à ce client (ownership check)" };
    }
    return { ok: true, payment: pay };
  };


  try {
    switch (action) {
      // ============================================================
      case "add_payment_method": {
        const method_type = body.method_type;
        if (!method_type) return json(400, { error: "method_type requis" });
        if (String(method_type).toLowerCase() === "paypal") {
          return json(410, { error: "paypal_decommissioned", message: "PayPal est désactivé. Utilisez Square/carte." });
        }

        // If marking as default, demote previous defaults
        if (body.is_default) {
          await admin.from("client_payment_methods")
            .update({ is_default: false })
            .eq("user_id", client_user_id)
            .eq("is_default", true)
            .eq("status", "active");
        }

        // Idempotency check: if same idempotency_key already produced a row
        // in the last 24h for this user, return that row instead of creating
        // a duplicate payment method. Protects against double-click bugs.
        if (body.idempotency_key) {
          const since = new Date(Date.now() - 24 * 3600_000).toISOString();
          const { data: existing } = await admin
            .from("client_payment_methods")
            .select("id")
            .eq("user_id", client_user_id)
            .gte("created_at", since)
            .contains("metadata", { idempotency_key: body.idempotency_key })
            .maybeSingle();
          if (existing?.id) {
            return json(200, { ok: true, method_id: existing.id, idempotent: true });
          }
        }

        const { data, error } = await admin
          .from("client_payment_methods")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            method_type,
            brand: body.brand ?? null,
            last4: body.last4 ? String(body.last4).slice(-4) : null,
            exp_month: body.exp_month ?? null,
            exp_year: body.exp_year ?? null,
            holder_name: body.holder_name ?? null,
            paypal_email: null,
            provider_token: body.provider_token ?? null,
            is_default: !!body.is_default,
            status: "active",
            added_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: "Failed to add payment method" });

        await audit("add_payment_method", {
          method_id: data.id, method_type, last4: body.last4, is_default: !!body.is_default,
        });
        await logAndNote(
          "payment_method_added",
          "client_payment_method",
          data.id,
          `Méthode de paiement ajoutée — ${METHOD_LABELS[method_type] || method_type}${body.last4 ? ` ••${String(body.last4).slice(-4)}` : ""}${body.is_default ? " (par défaut)" : ""}`,
          null,
          { method_id: data.id, method_type, last4: body.last4 ?? null, is_default: !!body.is_default },
        );
        await enqueuePaymentMethodEmail("added", METHOD_LABELS[method_type] || method_type, body.last4);
        return json(200, { ok: true, method_id: data.id });

      }

      // ============================================================
      case "remove_payment_method": {
        const id = body.method_id;
        if (!id) return json(400, { error: "method_id requis" });
        const { data: existing, error: fErr } = await admin
          .from("client_payment_methods")
          .select("id, user_id, status, method_type, last4")
          .eq("id", id)
          .maybeSingle();
        if (fErr) return json(500, { error: fErr.message });
        if (!existing) return json(404, { error: "Méthode introuvable" });
        if (existing.user_id !== client_user_id) return json(403, { error: "Cible invalide" });
        if (existing.status !== "active") return json(409, { error: "Déjà retirée" });

        const { error: uErr } = await admin
          .from("client_payment_methods")
          .update({
            status: "removed",
            removed_at: new Date().toISOString(),
            removed_by: user.id,
            removed_reason: body.reason ?? null,
            is_default: false,
          })
          .eq("id", id);
        if (uErr) return json(500, { error: uErr.message });

        // If this method was the auto-pay method, disable auto-pay
        await admin.from("client_autopay_settings")
          .update({
            enabled: false,
            disabled_at: new Date().toISOString(),
            disabled_by: user.id,
            disabled_reason: "payment_method_removed",
            payment_method_id: null,
          })
          .eq("user_id", client_user_id)
          .eq("payment_method_id", id);

        await audit("remove_payment_method", { method_id: id });
        await logAndNote(
          "payment_method_removed",
          "client_payment_method",
          id,
          `Méthode de paiement retirée — ${METHOD_LABELS[existing.method_type] || existing.method_type}${existing.last4 ? ` ••${existing.last4}` : ""}${body.reason ? ` — motif: ${body.reason}` : ""}`,
          { status: existing.status, method_type: existing.method_type, last4: existing.last4 },
          { status: "removed", removed_reason: body.reason ?? null },
        );
        await enqueuePaymentMethodEmail("removed", METHOD_LABELS[existing.method_type] || existing.method_type, existing.last4);
        return json(200, { ok: true });

      }

      // ============================================================
      case "set_default_method": {
        const id = body.method_id;
        if (!id) return json(400, { error: "method_id requis" });
        const { data: existing, error: fErr } = await admin
          .from("client_payment_methods")
          .select("id, user_id, status, method_type, last4")
          .eq("id", id).maybeSingle();
        if (fErr) return json(500, { error: fErr.message });
        if (!existing) return json(404, { error: "Méthode introuvable" });
        if (existing.user_id !== client_user_id) return json(403, { error: "Cible invalide" });
        if (existing.status !== "active") return json(409, { error: "Méthode inactive" });

        await admin.from("client_payment_methods")
          .update({ is_default: false })
          .eq("user_id", client_user_id).eq("is_default", true).eq("status", "active");
        const { error: uErr } = await admin.from("client_payment_methods")
          .update({ is_default: true }).eq("id", id);
        if (uErr) return json(500, { error: uErr.message });

        await audit("set_default_method", { method_id: id });
        await logAndNote(
          "payment_method_default_set",
          "client_payment_method",
          id,
          `Méthode par défaut définie — ${METHOD_LABELS[existing.method_type] || existing.method_type}${existing.last4 ? ` ••${existing.last4}` : ""}`,
          { is_default: false },
          { is_default: true },
        );
        await enqueuePaymentMethodEmail("default_set", METHOD_LABELS[existing.method_type] || existing.method_type, existing.last4);
        return json(200, { ok: true });

      }

      // ============================================================
      case "toggle_autopay": {
        const enabled = !!body.enabled;
        const payment_method_id = body.payment_method_id ?? null;
        const charge_day_offset = Number.isFinite(body.charge_day_offset)
          ? Math.max(-15, Math.min(15, Number(body.charge_day_offset))) : 0;

        if (enabled && !payment_method_id) {
          return json(400, { error: "payment_method_id requis pour activer le paiement automatique" });
        }
        if (enabled && payment_method_id) {
          const { data: pm } = await admin.from("client_payment_methods")
            .select("id,user_id,status").eq("id", payment_method_id).maybeSingle();
          if (!pm || pm.user_id !== client_user_id || pm.status !== "active") {
            return json(400, { error: "Méthode de paiement invalide" });
          }
        }

        const payload: Record<string, unknown> = {
          user_id: client_user_id,
          account_id: body.account_id ?? null,
          enabled,
          payment_method_id: enabled ? payment_method_id : null,
          charge_day_offset,
        };
        if (enabled) {
          payload.enabled_at = new Date().toISOString();
          payload.enabled_by = user.id;
          payload.disabled_at = null;
          payload.disabled_by = null;
          payload.disabled_reason = null;
        } else {
          payload.disabled_at = new Date().toISOString();
          payload.disabled_by = user.id;
          payload.disabled_reason = body.reason ?? null;
        }

        const { error } = await admin.from("client_autopay_settings")
          .upsert(payload, { onConflict: "user_id" });
        if (error) return json(500, { error: error.message });

        await audit("toggle_autopay", { enabled, payment_method_id, charge_day_offset });
        await logAndNote(
          enabled ? "autopay_enabled" : "autopay_disabled",
          "client_autopay_settings",
          null,
          `Paiement automatique ${enabled ? "activé" : "désactivé"} — décalage ${charge_day_offset}j${body.reason ? ` — motif: ${body.reason}` : ""}`,
          null,
          { enabled, payment_method_id, charge_day_offset, reason: body.reason ?? null },
        );
        await enqueueEmail("client_autopay_change", {
          enabled: enabled ? "true" : "false",
          charge_day_offset: String(charge_day_offset),
          reason: body.reason || "—",
        });
        return json(200, { ok: true });

      }

      // ============================================================
      case "create_payment_plan": {
        const reason = String(body.reason ?? "").trim();
        if (reason.length < 3) return json(400, { error: "reason requis (min 3 caractères)" });
        const total = Number(body.total_amount ?? 0);
        const count = Number(body.installment_count ?? 0);
        if (!Number.isFinite(total) || total <= 0) return json(400, { error: "total_amount invalide" });
        if (!Number.isInteger(count) || count < 2 || count > 24) {
          return json(400, { error: "installment_count doit être entre 2 et 24" });
        }
        if (!body.idempotency_key || body.idempotency_key.trim().length < 4) {
          return json(400, { error: "idempotency_key requis pour les plans de paiement (UUID recommandé)" });
        }
        const frequency = body.frequency || "monthly";
        if (!["weekly", "biweekly", "monthly"].includes(frequency)) {
          return json(400, { error: "frequency invalide (weekly|biweekly|monthly)" });
        }
        const first_due_date = body.first_due_date || new Date().toISOString().slice(0, 10);
        if (isNaN(new Date(first_due_date + "T00:00:00Z").getTime())) {
          return json(400, { error: "first_due_date invalide (YYYY-MM-DD)" });
        }
        // Dedup: return existing plan if same idempotency_key for this user (E2.1 fix)
        const { data: existingPlan } = await admin
          .from("client_payment_plans")
          .select("id")
          .contains("metadata", { idempotency_key: body.idempotency_key })
          .eq("user_id", client_user_id)
          .maybeSingle();
        if (existingPlan) {
          return json(200, { ok: true, plan_id: existingPlan.id, idempotent: true });
        }
        // A23-3 : ownership + balance check on invoice
        if (body.invoice_id) {
          const own = await ensureInvoiceOwnership(body.invoice_id);
          if (!own.ok) return json(own.status!, { error: own.error });
          const { data: inv, error: iErr } = await admin.from("billing_invoices")
            .select("id, balance_due, status")
            .eq("id", body.invoice_id).maybeSingle();
          if (iErr) return json(500, { error: iErr.message });
          if (!inv) return json(404, { error: "Facture introuvable" });
          if (total > Number(inv.balance_due ?? 0) + 0.01) {
            return json(400, {
              error: `total_amount (${fmtMoney(total)}) dépasse le solde de la facture (${fmtMoney(Number(inv.balance_due ?? 0))})`,
            });
          }
        }

        const installment_amount = Math.round((total / count) * 100) / 100;

        const { data, error } = await admin.from("client_payment_plans")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            invoice_id: body.invoice_id ?? null,
            total_amount: total,
            currency: "CAD",
            installment_count: count,
            installment_amount,
            frequency,
            first_due_date,
            status: "active",
            reason,
            approved_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("create_payment_plan", {
          plan_id: data.id, total_amount: total, installment_count: count,
          installment_amount, frequency, first_due_date,
          invoice_id: body.invoice_id ?? null, reason,
        });

        // ── Client activity log + system note (parity with Module 8/9) ──
        try {
          const summary = `Plan de paiement créé — ${count}× ${fmtMoney(installment_amount)} (${frequency}) · total ${fmtMoney(total)} · début ${first_due_date} — motif: ${reason}`;
          await admin.from("client_activity_logs").insert({
            client_id:     client_user_id,
            actor_user_id: user.id,
            actor_name:    user.email ?? null,
            actor_role:    "admin",
            action_type:   "payment_plan_created",
            entity_type:   "client_payment_plan",
            entity_id:     data.id,
            summary,
            after_data: {
              plan_id: data.id, total_amount: total, installment_count: count,
              installment_amount, frequency, first_due_date,
              invoice_id: body.invoice_id ?? null,
            },
          });
          await admin.from("client_internal_notes").insert({
            client_id:          client_user_id,
            account_id:         body.account_id ?? null,
            note_type:          "system",
            body:               `${summary} — par ${user.email ?? user.id}`,
            created_by_user_id: user.id,
            created_by_role:    "admin",
            created_by_name:    user.email ?? null,
          });
        } catch (_e) { /* swallow */ }

        await enqueueEmail("client_payment_plan_created", {
          total_amount: fmtMoney(total),
          installment_count: String(count),
          installment_amount: fmtMoney(installment_amount),
          frequency,
          first_due_date,
        });
        return json(200, { ok: true, plan_id: data.id });
      }

      // ============================================================
      case "cancel_payment_plan": {
        const reason = String(body.reason ?? "").trim();
        if (reason.length < 3) return json(400, { error: "reason requis (min 3 caractères)" });
        const id = body.plan_id;
        if (!id) return json(400, { error: "plan_id requis" });
        const { data: existing, error: fErr } = await admin.from("client_payment_plans")
          .select("id,user_id,account_id,status,total_amount,installment_count,installment_amount,frequency")
          .eq("id", id).maybeSingle();
        if (fErr) return json(500, { error: fErr.message });
        if (!existing) return json(404, { error: "Plan introuvable" });
        if (existing.user_id !== client_user_id) return json(403, { error: "Cible invalide" });
        if (existing.status !== "active") return json(409, { error: "Plan déjà clos" });

        const { error: uErr } = await admin.from("client_payment_plans")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancelled_reason: reason,
          })
          .eq("id", id);
        if (uErr) return json(500, { error: uErr.message });

        await audit("cancel_payment_plan", { plan_id: id, reason });

        // ── Client activity log + system note (parity with Module 8/9) ──
        try {
          const summary = `Plan de paiement annulé — total ${fmtMoney(Number(existing.total_amount ?? 0))} · ${existing.installment_count}× — motif: ${reason}`;
          await admin.from("client_activity_logs").insert({
            client_id:     client_user_id,
            actor_user_id: user.id,
            actor_name:    user.email ?? null,
            actor_role:    "admin",
            action_type:   "payment_plan_cancelled",
            entity_type:   "client_payment_plan",
            entity_id:     id,
            summary,
            after_data:    { plan_id: id, status: "cancelled" },
          });
          await admin.from("client_internal_notes").insert({
            client_id:          client_user_id,
            account_id:         existing.account_id ?? body.account_id ?? null,
            note_type:          "system",
            body:               `${summary} — par ${user.email ?? user.id}`,
            created_by_user_id: user.id,
            created_by_role:    "admin",
            created_by_name:    user.email ?? null,
          });
        } catch (_e) { /* swallow */ }

        await enqueueEmail("client_payment_plan_cancelled", {
          total_amount: fmtMoney(Number(existing.total_amount ?? 0)),
          installment_count: String(existing.installment_count ?? 0),
          reason,
        });
        return json(200, { ok: true });
      }

      // ============================================================
      case "update_billing_settings": {
        const day = Number(body.billing_day_of_month ?? 1);
        if (!Number.isInteger(day) || day < 1 || day > 28) {
          return json(400, { error: "billing_day_of_month doit être 1-28" });
        }
        const delivery_format = body.delivery_format || "electronic";
        if (!["electronic", "paper"].includes(delivery_format)) {
          return json(400, { error: "delivery_format invalide" });
        }
        const language = body.language || "fr";
        if (!["fr", "en"].includes(language)) return json(400, { error: "language invalide" });

        if (body.email_for_billing) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email_for_billing)) {
            return json(400, { error: "email_for_billing invalide" });
          }
        }

        // Capture before-state for audit parity
        const { data: prevSettings } = await admin.from("client_billing_settings")
          .select("billing_day_of_month, delivery_format, language, email_for_billing, paper_mailing_address")
          .eq("user_id", client_user_id).maybeSingle();

        const { error } = await admin.from("client_billing_settings")
          .upsert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            billing_day_of_month: day,
            delivery_format,
            language,
            email_for_billing: body.email_for_billing ?? null,
            paper_mailing_address: body.paper_mailing_address ?? null,
            updated_by: user.id,
          }, { onConflict: "user_id" });
        if (error) return json(500, { error: error.message });

        await audit("update_billing_settings", {
          billing_day_of_month: day, delivery_format, language,
        });
        await logAndNote(
          "billing_settings_updated",
          "client_billing_settings",
          null,
          `Préférences facturation mises à jour — jour ${day}, ${delivery_format}, ${language}${body.email_for_billing ? `, courriel ${body.email_for_billing}` : ""}`,
          prevSettings ?? null,
          { billing_day_of_month: day, delivery_format, language, email_for_billing: body.email_for_billing ?? null, paper_mailing_address: body.paper_mailing_address ?? null },
        );
        await enqueueEmail("client_billing_settings_change", {
          billing_day_of_month: String(day),
          delivery_format,
          language,
          email_for_billing: body.email_for_billing || "—",
        });
        return json(200, { ok: true });

      }

      // ============================================================
      case "create_direct_refund": {
        const amount = Number(body.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) return json(400, { error: "amount invalide" });
        if (amount > 10000) return json(400, { error: "Montant > 10 000 $ : approbation senior requise" });
        if (!body.reason || body.reason.trim().length < 5) {
          return json(400, { error: "Raison détaillée obligatoire (min. 5 caractères)" });
        }
        const refund_method = body.refund_method;
        if (!refund_method || !["interac","cheque","credit_balance","bank_transfer","square"].includes(refund_method)) {
          return json(400, { error: "refund_method invalide" });
        }

        // Idempotency guard: require key + prevent duplicate refunds
        if (!body.idempotency_key || body.idempotency_key.trim().length < 4) {
          return json(400, { error: "idempotency_key requis pour les remboursements (UUID recommandé)" });
        }
        const { data: existingRef } = await admin
          .from("client_direct_refunds")
          .select("id")
          .contains("metadata", { idempotency_key: body.idempotency_key })
          .eq("user_id", client_user_id)
          .maybeSingle();
        if (existingRef) {
          return json(200, { ok: true, refund_id: existingRef.id, idempotent: true });
        }

        // A23-3 : ownership checks — invoice + payment must belong to targeted client
        if (body.invoice_id) {
          const own = await ensureInvoiceOwnership(body.invoice_id);
          if (!own.ok) return json(own.status!, { error: own.error });
        }
        if (body.payment_id) {
          const own = await ensurePaymentOwnership(body.payment_id);
          if (!own.ok) return json(own.status!, { error: own.error });
        }


        // ────────────────────────────────────────────────────────────────
        // Chemin Square / original : passage obligatoire par la RPC
        // canonique `refund_payment` — aucune mutation directe des tables
        // financières côté Edge Function.
        // ────────────────────────────────────────────────────────────────
        if (refund_method === "square" && body.payment_id) {
          const { data: payment, error: payErr } = await admin
            .from("billing_payments")
            .select("id, amount, status, provider, provider_payment_id, invoice_id")
            .eq("id", body.payment_id)
            .single();

          if (payErr || !payment) return json(404, { error: "Paiement introuvable" });
          if (payment.status === "refunded") {
            return json(409, { error: "Ce paiement a déjà été remboursé" });
          }
          if (amount > Number(payment.amount)) {
            return json(400, { error: `Montant (${amount.toFixed(2)} $) supérieur au paiement original (${Number(payment.amount).toFixed(2)} $)` });
          }

          const { data: refundRpc, error: refundErr } = await admin.rpc("refund_payment", {
            p_provider: payment.provider ?? "square",
            p_event_id: `direct-refund-${body.idempotency_key}`,
            p_original_payment_id: body.payment_id,
            p_amount: amount,
            p_external_reference: body.external_reference ?? null,
            p_reason: body.reason.trim(),
            p_provider_created_at: new Date().toISOString(),
            p_context: {
              source: "billing-account-actions",
              idempotency_key: body.idempotency_key,
              partial: amount < Number(payment.amount),
              performed_by: user.id,
            },
          });
          if (refundErr) {
            console.error("[DirectRefund] refund_payment RPC error:", refundErr);
            return json(502, {
              error: "Remboursement échoué — aucune modification en base",
              details: refundErr.message,
            });
          }
          console.log(`[DirectRefund] refund_payment RPC id=${refundRpc}`);
        }

        // Enregistrement du log métier (client_direct_refunds) — aucune
        // mutation directe des tables financières ici : elles ont déjà été
        // faites par la RPC `refund_payment` ci-dessus.
        const { data, error } = await admin.from("client_direct_refunds")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            invoice_id: body.invoice_id ?? null,
            payment_id: body.payment_id ?? null,
            amount,
            currency: "CAD",
            refund_method,
            external_reference: body.external_reference ?? null,
            reason: body.reason.trim(),
            status: "processed",
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            performed_by: user.id,
            metadata: {
              idempotency_key: body.idempotency_key,
            },
          })
          .select("id")
          .single();
        if (error) { console.error("billing direct_refund insert error", error); return json(500, { error: "Refund insert failed" }); }

        await audit("create_direct_refund", {
          refund_id: data.id, amount, refund_method,
          external_reference: body.external_reference,
        });

        // ── Client activity log + system note (traçabilité client) ──────
        try {
          const amountLabel = fmtMoney(amount);
          const methodLabel = METHOD_LABELS[refund_method] || refund_method;
          await admin.from("client_activity_logs").insert({
            client_id:     client_user_id,
            actor_user_id: user.id,
            actor_name:    user.email ?? null,
            actor_role:    "admin",
            action_type:   "refund_processed",
            entity_type:   "billing_refund",
            entity_id:     data.id,
            summary:       `Remboursement ${amountLabel} traité (${methodLabel}) — motif: ${body.reason.trim()}`,
            after_data:    { refund_id: data.id, amount, refund_method, payment_id: body.payment_id ?? null, invoice_id: body.invoice_id ?? null },
          });
          await admin.from("client_internal_notes").insert({
            client_id:          client_user_id,
            account_id:         body.account_id ?? null,
            note_type:          "system",
            body:               `Remboursement ${amountLabel} traité (${methodLabel}) — par ${user.email ?? user.id} — motif: ${body.reason.trim()}${body.external_reference ? ` — ref ${body.external_reference}` : ""}`,
            created_by_user_id: user.id,
            created_by_role:    "admin",
            created_by_name:    user.email ?? null,
          });
        } catch (_e) { /* swallow */ }

        await enqueueEmail("client_direct_refund_processed", {
          amount: fmtMoney(amount),
          refund_method: METHOD_LABELS[refund_method] || refund_method,
          external_reference: body.external_reference ?? "—",
          reason: body.reason.trim(),
        });
        return json(200, {
          ok: true,
          refund_id: data.id,
        });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
