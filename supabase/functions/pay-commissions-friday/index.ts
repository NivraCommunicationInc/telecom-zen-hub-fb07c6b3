/**
 * pay-commissions-friday
 *
 * Pay-cycle rules (canonical):
 *   - Week starts: Sunday 00:00:00 (America/Toronto, treated as EST fixed UTC-5).
 *   - Cutoff:       Thursday 18:00:00 EST (= 23:00:00 UTC).
 *   - Only field_commissions with status='approved' AND earned_at <= cutoff
 *     are paid in this Friday's run.
 *   - Last Friday of the month → also apply monthly bonus from
 *     field_bonus_rules (matched by agent's forfait count in the period).
 *   - After payout, a payroll_records row is inserted per agent for audit.
 *   - Idempotent: agent already paid this Friday is skipped.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fixed EST offset (UTC-5). DST is handled dynamically in getTorontoOffsetHours()
// but the cutoff/period helpers use this for the inverse conversion back to UTC.
const EST_OFFSET_HOURS = 5;

// Dynamically compute the Toronto UTC offset (handles EST/EDT DST transitions).
function getTorontoOffsetHours(d: Date): number {
  const utcStr = d.toLocaleString("en-US", { timeZone: "UTC" });
  const torStr = d.toLocaleString("en-US", { timeZone: "America/Toronto" });
  return Math.round((new Date(utcStr).getTime() - new Date(torStr).getTime()) / 3600_000);
}

/**
 * Compute the cutoff = most recent Thursday 18:00 Toronto time (<= now), in UTC.
 */
function lastThursdayCutoffUTC(now: Date): Date {
  const offsetHours = getTorontoOffsetHours(now);
  const estNow = new Date(now.getTime() - offsetHours * 3600_000);
  const dow = estNow.getUTCDay(); // 0=Sun..4=Thu..6=Sat (in EST clock)
  // Days back to Thursday (4).
  let back = (dow - 4 + 7) % 7;
  // If today is Thursday in EST but it's still before 18:00, use previous Thursday.
  if (back === 0 && estNow.getUTCHours() < 18) back = 7;
  const thuEst = new Date(estNow);
  thuEst.setUTCDate(thuEst.getUTCDate() - back);
  thuEst.setUTCHours(18, 0, 0, 0);
  // Convert back to real UTC using dynamic offset (handles EDT/EST).
  return new Date(thuEst.getTime() + getTorontoOffsetHours(thuEst) * 3600_000);
}

/**
 * Period start = Sunday 00:00 EST of the week containing the cutoff.
 */
function periodStartUTC(cutoffUTC: Date): Date {
  const est = new Date(cutoffUTC.getTime() - getTorontoOffsetHours(cutoffUTC) * 3600_000);
  const dow = est.getUTCDay(); // 0=Sun
  const sun = new Date(est);
  sun.setUTCDate(sun.getUTCDate() - dow);
  sun.setUTCHours(0, 0, 0, 0);
  return new Date(sun.getTime() + getTorontoOffsetHours(sun) * 3600_000);
}

/**
 * Is `friday` the last Friday of its month (in EST)?
 */
function isLastFridayOfMonth(friday: Date): boolean {
  const est = new Date(friday.getTime() - getTorontoOffsetHours(friday) * 3600_000);
  const month = est.getUTCMonth();
  const next = new Date(est);
  next.setUTCDate(next.getUTCDate() + 7);
  return next.getUTCMonth() !== month;
}

function periodLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-CA", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Toronto",
    });
  return `${fmt(start)} → ${fmt(end)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth gate: only service role or AGENT_SECRET can trigger payroll
  const _auth = req.headers.get("Authorization") ?? "";
  const _svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const _agentSecret = Deno.env.get("AGENT_SECRET");
  if (_auth !== `Bearer ${_svcKey}` && (!_agentSecret || _auth !== `Bearer ${_agentSecret}`)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const cutoff = lastThursdayCutoffUTC(now);
  const pStart = periodStartUTC(cutoff);
  const pEnd = cutoff;
  const lastFridayBonus = isLastFridayOfMonth(now);
  const payDateISO = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const label = periodLabel(pStart, pEnd);

  // 1. Approved commissions earned at/before cutoff.
  const { data: approved, error: fetchErr } = await supabase
    .from("field_commissions")
    .select("id, agent_id, amount, earned_at")
    .eq("status", "approved")
    .lte("earned_at", cutoff.toISOString());

  if (fetchErr) {
    return new Response(
      JSON.stringify({ ok: false, error: fetchErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Group by agent.
  const byAgent = new Map<string, { ids: string[]; total: number }>();
  for (const row of approved ?? []) {
    const a = (row as any).agent_id as string;
    if (!a) continue;
    const cur = byAgent.get(a) ?? { ids: [], total: 0 };
    cur.ids.push((row as any).id);
    cur.total += Number((row as any).amount || 0);
    byAgent.set(a, cur);
  }

  // 2. Load active bonus rules (only if last Friday of month).
  let bonusRules: Array<{ min_sales: number; max_sales: number | null; bonus_amount: number }> = [];
  if (lastFridayBonus) {
    const { data: rules } = await supabase
      .from("field_bonus_rules")
      .select("min_sales, max_sales, bonus_amount, is_active, period")
      .eq("is_active", true);
    bonusRules = (rules ?? []).filter((r: any) => !r.period || r.period === "monthly");
  }

  const computeBonus = (forfaitCount: number): number => {
    if (!lastFridayBonus) return 0;
    let best = 0;
    for (const r of bonusRules) {
      const min = Number(r.min_sales ?? 0);
      const max = r.max_sales == null ? Infinity : Number(r.max_sales);
      if (forfaitCount >= min && forfaitCount <= max) {
        best = Math.max(best, Number(r.bonus_amount || 0));
      }
    }
    return best;
  };

  const results: any[] = [];

  for (const [agentId, agg] of byAgent) {
    if (agg.ids.length === 0) continue;

    // 3. Idempotency: skip if this agent already has a payroll_records row for today.
    const { data: existing } = await supabase
      .from("payroll_records")
      .select("id")
      .eq("agent_id", agentId)
      .eq("pay_date", payDateISO)
      .maybeSingle();
    if (existing) {
      results.push({ agent_id: agentId, skipped: "already_paid_today" });
      continue;
    }

    // 4. Forfait count for the current month (for bonus tiering).
    let forfaitCount = 0;
    if (lastFridayBonus) {
      const monthStart = new Date(pEnd);
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const [ordersRes, intentsRes] = await Promise.all([
        supabase.from("field_sales_orders").select("id", { count: "exact", head: true })
          .eq("salesperson_id", agentId)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", pEnd.toISOString()),
        supabase.from("field_payment_intents").select("id", { count: "exact", head: true })
          .eq("agent_id", agentId)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", pEnd.toISOString()),
      ]);
      forfaitCount = (ordersRes.count ?? 0) + (intentsRes.count ?? 0);
    }
    const bonusAmount = computeBonus(forfaitCount);
    const totalAmount = agg.total + bonusAmount;

    if (totalAmount <= 0) continue;

    // 5. Flip commissions → paid. Also set paid_in_run_id so process-payroll won't re-pay them.
    const paidAt = new Date().toISOString();
    const syntheticRunId = `friday-${payDateISO}`;
    const { error: updErr } = await supabase
      .from("field_commissions")
      .update({ status: "paid", paid_at: paidAt, paid_in_run_id: syntheticRunId })
      .in("id", agg.ids)
      .is("paid_in_run_id", null);
    if (updErr) {
      results.push({ agent_id: agentId, error: updErr.message });
      continue;
    }

    // 6. Insert payroll_records audit row.
    const { error: prErr } = await supabase.from("payroll_records").insert({
      agent_id: agentId,
      pay_date: payDateISO,
      period_start: pStart.toISOString(),
      period_end: pEnd.toISOString(),
      commissions_amount: agg.total,
      bonus_amount: bonusAmount,
      total_amount: totalAmount,
      commission_ids: agg.ids,
      is_last_friday_of_month: lastFridayBonus,
      status: "paid",
    } as any);
    if (prErr) {
      results.push({ agent_id: agentId, payroll_insert_error: prErr.message });
    }

    // 7. Resolve agent email + name.
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
        event_key: `commission_paid_${agentId}_${payDateISO}`,
        to_email: email,
        template_key: "hr_commission_paid",
        template_vars: {
          client_name: agentName,
          amount: totalAmount,
          commissions_amount: agg.total,
          bonus_amount: bonusAmount,
          period_label: label,
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

    await supabase.from("employee_notifications").insert({
      user_id: agentId,
      notification_type: "system",
      title: `Commission payée — ${totalAmount.toFixed(2)} $`,
      message: `Paiement (${label}) versé. ${agg.ids.length} commission${agg.ids.length > 1 ? "s" : ""}${bonusAmount > 0 ? ` + boni ${bonusAmount.toFixed(2)} $` : ""}.`,
      is_read: false,
    });

    results.push({
      agent_id: agentId,
      commissions_amount: agg.total,
      bonus_amount: bonusAmount,
      total_amount: totalAmount,
      count: agg.ids.length,
    });
  }

  // If this is the last Friday of the month, pre-trigger the commission report
  // for the current month so it's ready before the pg_cron fires on the 1st.
  if (lastFridayBonus) {
    const monthISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const svcUrl   = Deno.env.get("SUPABASE_URL")!;
    const svcKey2  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${svcUrl}/functions/v1/commission-monthly-report?month=${monthISO}`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${svcKey2}`, "Content-Type": "application/json" },
      body:    "{}",
    }).catch((e) => console.warn("commission-monthly-report trigger failed:", e?.message));
  }

  return new Response(
    JSON.stringify({
      ok: true,
      cutoff: cutoff.toISOString(),
      period_start: pStart.toISOString(),
      period_end: pEnd.toISOString(),
      is_last_friday_of_month: lastFridayBonus,
      period_label: label,
      agents_paid: results.filter((r) => !r.skipped && !r.error).length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
