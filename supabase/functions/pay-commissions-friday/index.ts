/**
 * pay-commissions-friday
 *
 * Runs every Friday at 18:00 (cron). For each field_sales agent:
 *   1. Sum every approved field_commission row.
 *   2. Mark those rows as paid (status='paid', paid_at=now()).
 *   3. Insert a payroll_entries row recording the payout.
 *   4. Enqueue an `hr_commission_paid` email (Violet Bold) to the agent.
 *
 * Invocation is idempotent per (agent, friday) — `payroll_entries` rows are
 * only inserted when at least one approved commission flips to paid, so
 * re-running the function on the same day is a no-op for already-paid agents.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function fridayPeriodLabel(d: Date): string {
  const end = d.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const startDate = new Date(d.getTime() - 6 * 24 * 60 * 60 * 1000);
  const start = startDate.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
  });
  return `${start} → ${end}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const periodLabel = fridayPeriodLabel(now);

  // 1. Pull all approved commissions, grouped by agent in code.
  const { data: approved, error: fetchErr } = await supabase
    .from("field_commissions")
    .select("id, agent_id, amount")
    .eq("status", "approved");

  if (fetchErr) {
    return new Response(JSON.stringify({ ok: false, error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const byAgent = new Map<string, { ids: string[]; total: number }>();
  for (const row of approved ?? []) {
    const a = (row as any).agent_id as string;
    if (!a) continue;
    const cur = byAgent.get(a) ?? { ids: [], total: 0 };
    cur.ids.push((row as any).id);
    cur.total += Number((row as any).amount || 0);
    byAgent.set(a, cur);
  }

  const results: any[] = [];

  for (const [agentId, agg] of byAgent) {
    if (agg.total <= 0 || agg.ids.length === 0) continue;

    // 2. Flip status -> paid for the exact ids we just summed (no race).
    const paidAt = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("field_commissions")
      .update({ status: "paid", paid_at: paidAt })
      .in("id", agg.ids);

    if (updErr) {
      results.push({ agent_id: agentId, error: updErr.message });
      continue;
    }

    // 3. Record payroll entry.
    await supabase.from("payroll_entries").insert({
      employee_id: agentId,
      gross_amount: agg.total,
      net_amount: agg.total,
      pay_period_start: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      pay_period_end: now.toISOString().slice(0, 10),
      paid_at: paidAt,
      payment_method: "Dépôt direct",
      source: "field_commissions",
      commission_count: agg.ids.length,
    } as any);

    // 4. Resolve agent email + name.
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, first_name, last_name")
      .eq("user_id", agentId)
      .maybeSingle();

    const email = (profile as any)?.email;
    const agentName =
      (profile as any)?.full_name ||
      [(profile as any)?.first_name, (profile as any)?.last_name]
        .filter(Boolean)
        .join(" ") ||
      "Collègue";

    if (email) {
      await supabase.from("email_queue").insert({
        event_key: `commission_paid_${agentId}_${paidAt}`,
        to_email: email,
        template_key: "hr_commission_paid",
        template_vars: {
          client_name: agentName,
          amount: agg.total,
          period_label: periodLabel,
          paid_at: paidAt,
          payment_method: "Dépôt direct",
          portal_url: "https://nivra-telecom.ca/rh/commissions",
        },
        message_type: "hr_commission_paid",
        entity_type: "commission_payout",
        entity_id: agentId,
        status: "queued",
      } as any);
    }

    // 5. In-app notification.
    await supabase.from("employee_notifications").insert({
      user_id: agentId,
      notification_type: "system",
      title: `Commission payée — ${agg.total.toFixed(2)} $`,
      message: `Votre paiement de commission (${periodLabel}) a été versé. ${agg.ids.length} commission${agg.ids.length > 1 ? "s" : ""} réglée${agg.ids.length > 1 ? "s" : ""}.`,
      is_read: false,
    });

    results.push({
      agent_id: agentId,
      total: agg.total,
      count: agg.ids.length,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      period: periodLabel,
      agents_paid: results.length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
