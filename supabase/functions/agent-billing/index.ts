/**
 * agent-billing — hourly billing automation.
 * Handles renewals reminders (J-7, J-3), failed payments, overdue accounts
 * (with Gemini decisioning), stuck orders, and daily reconciliation.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ALERT_EMAIL = "support@nivra-telecom.ca";

async function geminiDecide(input: Record<string, unknown>): Promise<"suspend" | "grace_period"> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{
          role: "user",
          content: `Tu es l'agent de facturation Nivra Telecom. Décide entre "suspend" ou "grace_period" pour ce client en retard de paiement.\n${JSON.stringify(input, null, 2)}\nRègles: clients fidèles (>1 an) sans historique de défaut → grace_period. Récidivistes ou nouveaux → suspend.\nRéponds STRICTEMENT en JSON: {"decision":"suspend"|"grace_period","reason":"..."}`,
        }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return "grace_period";
    const data = await res.json();
    const json = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return json.decision === "suspend" ? "suspend" : "grace_period";
  } catch (_e) {
    return "grace_period";
  }
}

async function logAudit(supabase: any, action: string, result: string, details: unknown, ms: number, err?: string) {
  await supabase.from("agent_audit_log").insert({
    agent_name: "agent-billing", action, result, details, execution_time_ms: ms, error_message: err,
  });
}

function expectedTolerance(mrr: number): number {
  // Allow ±15% tolerance vs expected MRR.
  return Math.max(50, mrr * 0.15);
}

async function queueIfNotSent(
  supabase: any, templateKey: string, accountId: string, toEmail: string, vars: Record<string, unknown>, subject: string, withinDays: number,
) {
  const cutoff = new Date(Date.now() - withinDays * 86400_000).toISOString();
  const { data: existing } = await supabase.from("email_queue")
    .select("id")
    .eq("template_key", templateKey)
    .gte("created_at", cutoff)
    .filter("template_vars->>account_id", "eq", accountId)
    .limit(1);
  if (existing && existing.length > 0) return false;
  await supabase.from("email_queue").insert({
    to_email: toEmail,
    template_key: templateKey,
    subject,
    template_vars: { ...vars, account_id: accountId },
    status: "queued",
  });
  return true;
}

async function check7DayRenewals(supabase: any) {
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString();
  const { data: subs } = await supabase
    .from("billing_subscriptions")
    .select("customer_id, plan_name, plan_price, next_renewal_at, status")
    .eq("status", "active")
    .gte("next_renewal_at", new Date().toISOString())
    .lte("next_renewal_at", in7);

  let sent = 0;
  for (const s of (subs ?? []) as any[]) {
    const { data: account } = await supabase.from("accounts").select("id, status").eq("client_id", s.customer_id).eq("status", "active").maybeSingle();
    if (!account) continue;
    const { data: p } = await supabase.from("profiles").select("email, first_name, full_name").eq("user_id", s.customer_id).maybeSingle();
    if (!p?.email) continue;
    const ok = await queueIfNotSent(supabase, "payment_reminder_7", account.id, p.email, {
      client_name: p.full_name ?? p.first_name ?? "Client",
      first_name: p.first_name ?? "Client",
      plan_name: s.plan_name,
      amount: s.plan_price,
      renewal_date: s.next_renewal_at,
    }, "Votre service Nivra se renouvelle dans 7 jours", 6);
    if (ok) sent++;
  }
  return sent;
}

async function check3DayRenewals(supabase: any) {
  const in3 = new Date(Date.now() + 3 * 86400_000).toISOString();
  const { data: subs } = await supabase
    .from("billing_subscriptions")
    .select("customer_id, plan_name, plan_price, next_renewal_at, status")
    .eq("status", "active")
    .gte("next_renewal_at", new Date().toISOString())
    .lte("next_renewal_at", in3);

  let sent = 0;
  for (const s of (subs ?? []) as any[]) {
    const { data: account } = await supabase.from("accounts").select("id, status").eq("client_id", s.customer_id).eq("status", "active").maybeSingle();
    if (!account) continue;
    const { data: p } = await supabase.from("profiles").select("email, first_name, full_name").eq("user_id", s.customer_id).maybeSingle();
    if (!p?.email) continue;
    const ok = await queueIfNotSent(supabase, "payment_reminder_3", account.id, p.email, {
      client_name: p.full_name ?? p.first_name ?? "Client",
      first_name: p.first_name ?? "Client",
      plan_name: s.plan_name,
      amount: s.plan_price,
      renewal_date: s.next_renewal_at,
    }, "Rappel : renouvellement Nivra dans 3 jours", 2);
    if (ok) sent++;
  }
  return sent;
}

async function checkFailedPayments(supabase: any) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, user_id, client_email, total_amount, order_number")
    .eq("payment_status", "failed")
    .gte("created_at", since);
  let processed = 0;
  for (const o of (orders ?? []) as any[]) {
    if (!o.client_email) continue;
    await supabase.from("email_queue").insert({
      to_email: o.client_email,
      template_key: "payment_failed_notice",
      subject: "Échec de paiement — Action requise",
      template_vars: {
        client_name: o.client_email,
        order_number: o.order_number,
        amount: o.total_amount,
      },
      status: "queued",
    });
    processed++;
  }
  return processed;
}

async function checkOverdueAccounts(supabase: any) {
  // FIX (2026-05-23): the documented suspension rule is "J+5" — suspend 5 days
  // after the renewal/due date passed. The previous code used -3 days which
  // suspended accounts 2 days too early, violating the grace-period contract
  // promised to customers. Constant kept as a single named value so future
  // changes happen in one obvious place.
  const SUSPENSION_GRACE_DAYS = 5;
  const overdueCutoff = new Date(Date.now() - SUSPENSION_GRACE_DAYS * 86400_000).toISOString();
  const { data: subs } = await supabase
    .from("billing_subscriptions")
    .select("customer_id, plan_name, plan_price, next_renewal_at, status")
    .eq("status", "active")
    .lt("next_renewal_at", overdueCutoff);

  let suspended = 0, grace = 0;
  for (const s of (subs ?? []) as any[]) {
    const { data: account } = await supabase.from("accounts").select("id, status, created_at").eq("client_id", s.customer_id).eq("status", "active").maybeSingle();
    if (!account) continue;
    const { data: p } = await supabase.from("profiles").select("email, first_name, full_name").eq("user_id", s.customer_id).maybeSingle();
    if (!p?.email) continue;
    const ageDays = Math.floor((Date.now() - new Date(account.created_at).getTime()) / 86400_000);
    const decision = await geminiDecide({
      account_age_days: ageDays,
      plan_name: s.plan_name,
      amount_owed: s.plan_price,
      days_overdue: Math.floor((Date.now() - new Date(s.next_renewal_at).getTime()) / 86400_000),
    });
    if (decision === "suspend") {
      await supabase.from("accounts").update({ status: "suspended" }).eq("id", account.id);
      await supabase.from("email_queue").insert({
        to_email: p.email,
        template_key: "payment_failed_notice",
        subject: "Suspension de votre service Nivra",
        template_vars: { client_name: p.full_name, amount: s.plan_price, plan_name: s.plan_name, account_id: account.id },
        status: "queued",
      });
      suspended++;
    } else {
      const deadline = new Date(Date.now() + 48 * 3600_000).toISOString().slice(0, 10);
      await supabase.from("email_queue").insert({
        to_email: p.email,
        template_key: "grace_period_offer",
        subject: "On vous donne 48 heures supplémentaires",
        template_vars: { client_name: p.full_name, amount: s.plan_price, deadline, account_id: account.id },
        status: "queued",
      });
      grace++;
    }
  }
  return { suspended, grace };
}

// NEW (2026-05-23) — J+10 void. Per the documented billing rule:
// "Modèle 100% prépayé, aucune dette" — after 10 days of being overdue
// (i.e. 5 days after suspension at J+5), we void the unpaid invoices and
// mark the subscription as 'not_renewed'. No collections, no debt accrual.
async function checkVoidOverdue(supabase: any) {
  const VOID_AT_DAYS = 10;
  const voidCutoff = new Date(Date.now() - VOID_AT_DAYS * 86400_000).toISOString();
  let invoicesVoided = 0;
  let subscriptionsNotRenewed = 0;

  // 1. Void overdue invoices that have been overdue past the threshold.
  const { data: overdueInvoices } = await supabase
    .from("billing_invoices")
    .select("id, total, balance_due, subscription_id, due_date")
    .in("status", ["overdue", "pending", "partially_paid"])
    .lt("due_date", voidCutoff);

  for (const inv of overdueInvoices ?? []) {
    const { error } = await supabase
      .from("billing_invoices")
      .update({
        status: "void",
        balance_due: 0,
        notes: `Auto-voided at J+${VOID_AT_DAYS} (prepaid model — no debt accrual)`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inv.id);
    if (!error) invoicesVoided++;
  }

  // 2. Mark the subscriptions that backed those invoices as not_renewed.
  //    A future re-subscription requires a fresh cycle anchor — no carryover.
  const subIds = Array.from(
    new Set((overdueInvoices ?? []).map((i: any) => i.subscription_id).filter(Boolean)),
  );
  if (subIds.length > 0) {
    const { data: subUpdated } = await supabase
      .from("billing_subscriptions")
      .update({
        status: "not_renewed",
        auto_billing_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", subIds)
      .in("status", ["active", "suspended"])
      .select("id");
    subscriptionsNotRenewed = subUpdated?.length ?? 0;
  }

  return { invoices_voided: invoicesVoided, subscriptions_not_renewed: subscriptionsNotRenewed };
}

async function checkStuckOrders(supabase: any) {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data: orders, count } = await supabase
    .from("orders")
    .select("id, order_number, created_at", { count: "exact" })
    .eq("status", "pending")
    .lt("created_at", twoHoursAgo)
    .limit(100);
  if ((count ?? 0) > 0) {
    await supabase.from("email_queue").insert({
      to_email: ALERT_EMAIL,
      template_key: "site_health_alert",
      subject: `[ALERTE] ${count} commandes bloquées >2h`,
      template_vars: {
        client_name: "Équipe Nivra",
        health_score: 70,
        critical_count: count,
        total_issues: count,
        summary: `${count} commande(s) bloquée(s) en statut 'pending' depuis plus de 2 heures.`,
        issues: (orders ?? []).slice(0, 10).map((o: any) => ({
          title: `Commande ${o.order_number}`,
          description: `Créée le ${o.created_at}`,
        })),
      },
      status: "queued",
    });
  }
  return count ?? 0;
}

async function reconcile(supabase: any) {
  const { data: subs } = await supabase.from("billing_subscriptions").select("plan_price").eq("status", "active");
  const expectedMRR = (subs ?? []).reduce((s: number, r: any) => s + Number(r.plan_price ?? 0), 0);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: payments } = await supabase.from("billing_payments").select("amount").eq("status", "confirmed").gte("created_at", since);
  const actual30d = (payments ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
  const discrepancy = expectedMRR - actual30d;
  return { expected_mrr: expectedMRR, actual_30d: actual30d, discrepancy };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    let body: any = {};
    try { body = await req.json(); } catch (_e) { /* empty */ }

    if (body.action === "reconcile") {
      const r = await reconcile(supabase);
      if (Math.abs(r.discrepancy) > expectedTolerance(r.expected_mrr)) {
        const todayKey = new Date().toISOString().slice(0, 10);
        await supabase.from("email_queue").insert({
          event_key: `billing_reconcile_mrr_${todayKey}`,
          to_email: ALERT_EMAIL,
          template_key: "site_health_alert",
          subject: "Écart de réconciliation MRR détecté",
          template_vars: {
            client_name: "Équipe Nivra", health_score: 60, critical_count: 1, total_issues: 1,
            summary: `Écart de ${r.discrepancy.toFixed(2)}$ entre MRR attendu (${r.expected_mrr.toFixed(2)}$) et paiements réels 30j (${r.actual_30d.toFixed(2)}$).`,
            issues: [],
          },
          status: "queued",
        });
      }
      await logAudit(supabase, "reconcile", "success", r, Date.now() - startedAt);
      return new Response(JSON.stringify({ ok: true, ...r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [r7, r3, failed, overdue, stuck, voided] = await Promise.all([
      check7DayRenewals(supabase),
      check3DayRenewals(supabase),
      checkFailedPayments(supabase),
      checkOverdueAccounts(supabase),
      checkStuckOrders(supabase),
      checkVoidOverdue(supabase), // J+10 void per prepaid model
    ]);
    const summary = {
      reminders_7: r7,
      reminders_3: r3,
      failed_payments_handled: failed,
      overdue,
      stuck_orders: stuck,
      voided_at_j10: voided,
    };
    await logAudit(supabase, "hourly_run", "success", summary, Date.now() - startedAt);
    return new Response(JSON.stringify({ ok: true, ...summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await logAudit(supabase, "error", "failure", null, Date.now() - startedAt, String(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
