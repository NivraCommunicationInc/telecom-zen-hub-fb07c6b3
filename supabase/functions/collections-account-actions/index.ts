// Collections (Recouvrement) — staff-only operations on a client's unpaid invoices.
// Actions:
//   - log_contact         : record contact_email / contact_phone / contact_sms attempt
//   - create_promise      : promise_to_pay (amount_promised + promise_date)
//   - create_payment_plan : payment_plan (installments stored as note)
//   - escalate            : escalate to collections / external
//   - writeoff            : write-off (admin/billing_admin only)
//   - mark_resolved       : mark collections file resolved
//   - add_note            : free-form internal collections note
// All actions write to public.collections_actions and audit-log under
// account_ops.collections_*; the *contact_*  / promise / payment_plan actions
// also queue a branded "client_collections_*" email.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = new Set([
  "admin", "billing_admin", "supervisor",
]);
const HIGH_PRIV = new Set(["admin", "billing_admin"]);

type Action =
  | "log_contact"
  | "create_promise"
  | "create_payment_plan"
  | "escalate"
  | "writeoff"
  | "mark_resolved"
  | "add_note";

interface Body {
  action: Action;
  client_user_id: string;
  invoice_id: string;
  notes?: string;
  channel?: "email" | "phone" | "sms";
  amount_promised?: number;
  promise_date?: string;       // YYYY-MM-DD
  installments?: number;
  installment_amount?: number;
  reason?: string;
}

const json = (s: number, p: unknown) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

const fmtDate = (d: string) => {
  try {
    return new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeZone: "America/Toronto" })
      .format(new Date(d + (d.length === 10 ? "T12:00:00" : "")));
  } catch (_e) { return d; }
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
  const { isStaff, callerRole: _callerRole, roles: _roles } = await checkStaffAuth(admin, user.id);
  const roleList = _roles;
  if (!isStaff) return json(403, { error: "Action réservée à l'équipe recouvrement" });

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { action, client_user_id, invoice_id } = body;
  if (!action || !client_user_id || !invoice_id) {
    return json(400, { error: "Champs requis: action, client_user_id, invoice_id" });
  }

  // Resolve invoice (canonical: client_unpaid_invoices view spans sources).
  const { data: inv } = await admin
    .from("client_unpaid_invoices")
    .select("id, invoice_number, total, amount_due, due_date, status")
    .eq("id", invoice_id)
    .maybeSingle();
  if (!inv) return json(404, { error: "Facture introuvable" });

  const { data: profile } = await admin
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("user_id", client_user_id)
    .maybeSingle();
  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";

  const audit = async (label: string, payload: Record<string, unknown>) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `account_ops.collections_${label}`,
        admin_user_id: user.id,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        details: { invoice_id, invoice_number: inv.invoice_number, ...payload },
      });
    } catch (_e) { /* swallow */ }
  };

  const enqueueEmail = async (template_key: string, vars: Record<string, unknown>) => {
    if (!clientEmail) return;
    try {
      await admin.from("email_queue").insert({
        to_email: clientEmail,
        template_key,
        template_vars: {
          ...vars,
          first_name: firstName,
          to_email: clientEmail,
          invoice_number: inv.invoice_number,
          amount_due: fmtMoney(Number(inv.amount_due || inv.total || 0)),
          due_date: inv.due_date ? fmtDate(inv.due_date) : "—",
        },
        status: "queued",
        priority: 0,
      });
    } catch (_e) { /* swallow */ }
  };

  const insertAction = async (
    action_type: string,
    extra: { notes?: string | null; amount_promised?: number | null; promise_date?: string | null } = {},
  ) => {
    return await admin
      .from("collections_actions")
      .insert({
        invoice_id,
        customer_id: client_user_id,
        action_type,
        notes: extra.notes ?? null,
        amount_promised: extra.amount_promised ?? null,
        promise_date: extra.promise_date ?? null,
        performed_by: user.id,
      })
      .select("id")
      .single();
  };

  try {
    switch (action) {
      case "log_contact": {
        const ch = body.channel || "email";
        const action_type = ch === "phone" ? "contact_phone" : ch === "sms" ? "contact_sms" : "contact_email";
        const { data, error } = await insertAction(action_type, { notes: body.notes ?? null });
        if (error) return json(500, { error: error.message });
        await audit("log_contact", { channel: ch });
        if (ch === "email") {
          await enqueueEmail("client_collections_reminder", {
            subject: `Rappel — Facture #${inv.invoice_number}`,
            message: body.notes || "Votre facture demeure impayée. Merci de régulariser la situation.",
          });
        }
        return json(200, { ok: true, id: data?.id });
      }

      case "create_promise": {
        const amt = Number(body.amount_promised || 0);
        const date = body.promise_date;
        if (!amt || amt <= 0) return json(400, { error: "Montant promis requis" });
        if (!date) return json(400, { error: "Date promise requise" });
        const { data, error } = await insertAction("promise_to_pay", {
          amount_promised: amt,
          promise_date: date,
          notes: body.notes ?? null,
        });
        if (error) return json(500, { error: error.message });
        await audit("promise_to_pay", { amount: amt, date });
        await enqueueEmail("client_collections_promise", {
          amount_promised: fmtMoney(amt),
          promise_date: fmtDate(date),
          message: body.notes || "",
        });
        return json(200, { ok: true, id: data?.id });
      }

      case "create_payment_plan": {
        const installments = Number(body.installments || 0);
        const each = Number(body.installment_amount || 0);
        if (installments < 2 || installments > 12) return json(400, { error: "2 à 12 versements" });
        if (each <= 0) return json(400, { error: "Montant par versement invalide" });
        const total = installments * each;
        const note = `Plan: ${installments} versements de ${fmtMoney(each)} (total ${fmtMoney(total)}). ${body.notes || ""}`.trim();
        const { data, error } = await insertAction("payment_plan", { notes: note });
        if (error) return json(500, { error: error.message });
        await audit("payment_plan", { installments, each, total });
        await enqueueEmail("client_collections_payment_plan", {
          installments: String(installments),
          installment_amount: fmtMoney(each),
          plan_total: fmtMoney(total),
          message: body.notes || "",
        });
        return json(200, { ok: true, id: data?.id });
      }

      case "escalate": {
        const { data, error } = await insertAction("escalation", { notes: body.reason || body.notes || "Escalade interne" });
        if (error) return json(500, { error: error.message });
        await audit("escalate", { reason: body.reason || null });
        return json(200, { ok: true, id: data?.id });
      }

      case "writeoff": {
        if (!roleList.some((r: string) => HIGH_PRIV.has(r))) {
          return json(403, { error: "Radiation réservée aux admins / billing_admin" });
        }
        if (!body.reason || body.reason.trim().length < 4) {
          return json(400, { error: "Motif de radiation requis" });
        }
        const { data, error } = await insertAction("writeoff", { notes: body.reason });
        if (error) return json(500, { error: error.message });
        await audit("writeoff", { reason: body.reason });
        return json(200, { ok: true, id: data?.id });
      }

      case "mark_resolved": {
        const { data, error } = await insertAction("resolved", { notes: body.notes ?? null });
        if (error) return json(500, { error: error.message });
        await audit("resolved", {});
        return json(200, { ok: true, id: data?.id });
      }

      case "add_note": {
        const txt = (body.notes || "").trim();
        if (!txt) return json(400, { error: "Note requise" });
        const { data, error } = await insertAction("note", { notes: txt });
        if (error) return json(500, { error: error.message });
        await audit("add_note", { length: txt.length });
        return json(200, { ok: true, id: data?.id });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
