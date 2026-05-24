// Billing account actions — Nivra Core & Nivra OneView CS
// Single entry for all client billing management operations:
//   - add_payment_method     : register a tokenized payment method (PayPal/Visa/Mastercard/Interac)
//   - remove_payment_method  : soft-delete a payment method
//   - set_default_method     : promote a method to default (unique active default per user)
//   - toggle_autopay         : enable/disable auto-pay, link to method, set day offset
//   - create_payment_plan    : create an installment plan for an invoice/balance
//   - cancel_payment_plan    : cancel an active installment plan
//   - update_billing_settings: cycle day, delivery format, language, billing email
//   - create_direct_refund   : record an out-of-band refund (manual processing)
//
// Authorization (PayPal is primary, Stripe decommissioned — no charge logic here,
// this function only records administrative state and triggers client emails):
//   - payment_method / autopay / billing_settings : admin, employee, supervisor, support, billing_admin
//   - payment_plan / direct_refund               : admin, supervisor, billing_admin only

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  method_type?: "paypal" | "visa" | "mastercard" | "interac" | "bank_account";
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  holder_name?: string;
  paypal_email?: string;
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
  refund_method?: "paypal" | "interac" | "cheque" | "credit_balance" | "bank_transfer";
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
  paypal: "PayPal",
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

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const userRoles = new Set((roles || []).map((r: { role: string }) => r.role));

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
      await admin.from("admin_audit_log").insert({
        action: `billing.${label}`,
        admin_id: user.id,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        metadata: payload,
      });
    } catch (_e) { /* swallow */ }
  };

  const enqueueEmail = async (template: string, vars: Record<string, unknown>) => {
    if (!clientEmail) return;
    try {
      await admin.from("email_queue").insert({
        to_email: clientEmail,
        template_key: template,
        template_vars: { ...vars, first_name: firstName, to_email: clientEmail },
        status: "queued",
        priority: "normal",
      });
    } catch (_e) { /* swallow */ }
  };

  try {
    switch (action) {
      // ============================================================
      case "add_payment_method": {
        const method_type = body.method_type;
        if (!method_type) return json(400, { error: "method_type requis" });

        // If marking as default, demote previous defaults
        if (body.is_default) {
          await admin.from("client_payment_methods")
            .update({ is_default: false })
            .eq("user_id", client_user_id)
            .eq("is_default", true)
            .eq("status", "active");
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
            paypal_email: body.paypal_email ?? null,
            provider_token: body.provider_token ?? null,
            is_default: !!body.is_default,
            status: "active",
            added_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("add_payment_method", {
          method_id: data.id, method_type, last4: body.last4, is_default: !!body.is_default,
        });
        await enqueueEmail("client_payment_method_change", {
          change_type: "added",
          method_label: METHOD_LABELS[method_type] || method_type,
          last4: body.last4 || "—",
          is_default: body.is_default ? "true" : "false",
        });
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
        await enqueueEmail("client_payment_method_change", {
          change_type: "removed",
          method_label: METHOD_LABELS[existing.method_type] || existing.method_type,
          last4: existing.last4 || "—",
          is_default: "false",
        });
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
        await enqueueEmail("client_payment_method_change", {
          change_type: "default_set",
          method_label: METHOD_LABELS[existing.method_type] || existing.method_type,
          last4: existing.last4 || "—",
          is_default: "true",
        });
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
        await enqueueEmail("client_autopay_change", {
          enabled: enabled ? "true" : "false",
          charge_day_offset: String(charge_day_offset),
          reason: body.reason || "—",
        });
        return json(200, { ok: true });
      }

      // ============================================================
      case "create_payment_plan": {
        const total = Number(body.total_amount ?? 0);
        const count = Number(body.installment_count ?? 0);
        if (!Number.isFinite(total) || total <= 0) return json(400, { error: "total_amount invalide" });
        if (!Number.isInteger(count) || count < 2 || count > 24) {
          return json(400, { error: "installment_count doit être entre 2 et 24" });
        }
        const frequency = body.frequency || "monthly";
        const first_due_date = body.first_due_date || new Date().toISOString().slice(0, 10);
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
            reason: body.reason ?? null,
            approved_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("create_payment_plan", {
          plan_id: data.id, total_amount: total, installment_count: count,
          installment_amount, frequency,
        });
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
        const id = body.plan_id;
        if (!id) return json(400, { error: "plan_id requis" });
        const { data: existing, error: fErr } = await admin.from("client_payment_plans")
          .select("id,user_id,status,total_amount,installment_count")
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
            cancelled_reason: body.reason ?? null,
          })
          .eq("id", id);
        if (uErr) return json(500, { error: uErr.message });

        await audit("cancel_payment_plan", { plan_id: id });
        await enqueueEmail("client_payment_plan_cancelled", {
          total_amount: fmtMoney(Number(existing.total_amount ?? 0)),
          installment_count: String(existing.installment_count ?? 0),
          reason: body.reason || "—",
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
        if (!refund_method || !["paypal","interac","cheque","credit_balance","bank_transfer"].includes(refund_method)) {
          return json(400, { error: "refund_method invalide" });
        }

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
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("create_direct_refund", {
          refund_id: data.id, amount, refund_method,
          external_reference: body.external_reference,
        });
        await enqueueEmail("client_direct_refund_processed", {
          amount: fmtMoney(amount),
          refund_method: METHOD_LABELS[refund_method] || refund_method,
          external_reference: body.external_reference || "—",
          reason: body.reason.trim(),
        });
        return json(200, { ok: true, refund_id: data.id });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
