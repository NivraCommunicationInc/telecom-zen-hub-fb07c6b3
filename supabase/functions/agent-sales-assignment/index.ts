/**
 * agent-sales-assignment — Agent 12: Sales assignment & commission ledger.
 *
 * Runs every 15 minutes. Steps:
 *   A. Detect field_sales_orders without salesperson_id and flag for manual review.
 *   B. For converted orders without a sales_commissions row, compute commission
 *      (Internet/Bundle 30% monthly; Mobile 0%; equipment 5%) and INSERT a
 *      pending commission.
 *   C. Detect duplicate assignments (same client by 2+ agents in 7 days).
 *   D. Build per-agent daily performance summary into agent_events.
 *   E. Notify agents of newly confirmed sales via 'sale_assigned_notification'.
 *
 * All steps are idempotent: re-running does not double-insert commissions or
 * re-notify already-notified sales (tracked via commissions.notes marker).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGENT = "sales-assignment";
const NOTIF_MARKER = "[notified:sale_assigned]";

type EventType =
  | "info" | "success" | "warning" | "error" | "critical"
  | "action" | "gemini_call" | "email_sent" | "auto_fix" | "escalation";

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  event_type: EventType,
  message: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("agent_events").insert({ agent_name: AGENT, event_type, message, details });
}

interface Service {
  type?: string;
  plan_type?: string;
  category?: string;
  name?: string;
  monthly_price?: number;
  monthly?: number;
  price?: number;
  one_time?: number;
  qty?: number;
}

function computeCommission(services: unknown, totalAmount: number): { amount: number; rate: number; breakdown: Record<string, number> } {
  const list: Service[] = Array.isArray(services) ? services as Service[] : [];
  let monthly = 0, equipment = 0;
  for (const s of list) {
    const t = String(s.type ?? s.plan_type ?? s.category ?? "").toLowerCase();
    const monthlyVal = Number(s.monthly_price ?? s.monthly ?? 0);
    const oneTime = Number(s.one_time ?? 0);
    const qty = Number(s.qty ?? 1);
    if (t.includes("internet") || t.includes("bundle") || t.includes("tv")) {
      monthly += monthlyVal * qty;
    } else if (t.includes("mobile") || t.includes("sim")) {
      // 0% on mobile per policy
    } else if (t.includes("equipment") || t.includes("hardware") || oneTime > 0) {
      equipment += (oneTime || Number(s.price ?? 0)) * qty;
    } else {
      monthly += monthlyVal * qty;
    }
  }
  const commission = monthly * 0.30 + equipment * 0.05;
  return {
    amount: Math.round(commission * 100) / 100,
    rate: 0.30,
    breakdown: { monthly_base: monthly, equipment_base: equipment, total_amount: totalAmount },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = new Date();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: runRow } = await supabase
    .from("agent_runs")
    .insert({ agent_name: AGENT, status: "running", started_at: startedAt.toISOString() })
    .select("id").maybeSingle();
  const runId = (runRow as { id: string } | null)?.id ?? null;

  await logEvent(supabase, "info", "Scan assignation des ventes démarré");
  const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  let actions = 0, processed = 0, errors = 0;

  // CHECK A — unassigned
  const { data: unassigned } = await supabase
    .from("field_sales_orders")
    .select("id, local_id, customer_name, customer_city, created_at, salesperson_id")
    .gte("created_at", since24)
    .is("salesperson_id", null);
  for (const o of (unassigned ?? []) as Array<Record<string, any>>) {
    await logEvent(supabase, "warning", `Vente non assignée: ${o.local_id ?? o.id} (${o.customer_name ?? "?"})`, {
      order_id: o.id, requires_manual_review: true,
    });
    actions++;
  }

  // CHECK B — commissions
  const { data: converted } = await supabase
    .from("field_sales_orders")
    .select("id, local_id, customer_name, services, total_amount, salesperson_id, converted_order_id, converted_at, created_at")
    .gte("created_at", since7d)
    .not("converted_order_id", "is", null)
    .not("salesperson_id", "is", null);

  for (const o of (converted ?? []) as Array<Record<string, any>>) {
    processed++;
    const { data: existing } = await supabase
      .from("sales_commissions")
      .select("id")
      .eq("field_order_id", o.id)
      .maybeSingle();
    if (existing) continue;

    const { amount, rate, breakdown } = computeCommission(o.services, Number(o.total_amount ?? 0));
    const { error: insErr } = await supabase.from("sales_commissions").insert({
      salesperson_id: o.salesperson_id,
      field_order_id: o.id,
      converted_order_id: o.converted_order_id,
      sale_amount: Number(o.total_amount ?? 0),
      commission_rate: rate,
      commission_amount: amount,
      status: "pending",
      notes: `Auto-assigned by agent-sales-assignment. Breakdown: ${JSON.stringify(breakdown)}`,
    });
    if (insErr) {
      errors++;
      await logEvent(supabase, "error", `Échec création commission ${o.id}: ${insErr.message}`, { order_id: o.id });
      continue;
    }
    actions++;
    await logEvent(supabase, "auto_fix", `Commission créée: ${amount}$ pour ${o.local_id ?? o.id}`, {
      order_id: o.id, amount, salesperson_id: o.salesperson_id,
    });

    // CHECK E — notify agent
    const { data: agent } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", o.salesperson_id)
      .maybeSingle();
    const email = (agent as any)?.email;
    if (email) {
      const planName = Array.isArray(o.services) && o.services.length
        ? (o.services as Array<Record<string, unknown>>).map((s) => s.name ?? s.type ?? "").filter(Boolean).join(", ")
        : "Service Nivra";
      await enqueueCommunication(supabase, {
      channel: "email",
      recipient: email,
      templateKey: "sale_assigned_notification",
      idempotencyKey: `sales-assign:${o.id}:${(agent as any)?.id ?? "no-agent"}`,
      templateVars: {
      agent_name: (agent as any)?.full_name ?? "agent",
      customer_name: o.customer_name ?? "",
      plan_name: planName,
      commission_amount: amount,
      order_reference: o.local_id ?? o.id,
    },
    });
      await logEvent(supabase, "email_sent", `Notification de vente envoyée à ${email}`, { order_id: o.id });
    }
  }

  // CHECK C — duplicate assignments (same customer_email by 2+ agents in 7d)
  const { data: dups } = await supabase
    .from("field_sales_orders")
    .select("customer_email, salesperson_id")
    .gte("created_at", since7d)
    .not("salesperson_id", "is", null)
    .not("customer_email", "is", null);
  const byEmail = new Map<string, Set<string>>();
  for (const r of (dups ?? []) as Array<Record<string, any>>) {
    const key = String(r.customer_email).toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, new Set());
    byEmail.get(key)!.add(String(r.salesperson_id));
  }
  for (const [email, agents] of byEmail.entries()) {
    if (agents.size > 1) {
      await logEvent(supabase, "warning", `Client ${email} vendu par ${agents.size} agents différents (7j)`, {
        customer_email: email, agent_ids: Array.from(agents), requires_manual_review: true,
      });
      actions++;
    }
  }

  // CHECK D — daily performance per agent
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const { data: dailyComm } = await supabase
    .from("sales_commissions")
    .select("salesperson_id, commission_amount, sale_amount")
    .gte("created_at", todayStart.toISOString());
  const perAgent = new Map<string, { sales: number; commission: number; count: number }>();
  for (const c of (dailyComm ?? []) as Array<Record<string, any>>) {
    const id = String(c.salesperson_id);
    const cur = perAgent.get(id) ?? { sales: 0, commission: 0, count: 0 };
    cur.sales += Number(c.sale_amount ?? 0);
    cur.commission += Number(c.commission_amount ?? 0);
    cur.count += 1;
    perAgent.set(id, cur);
  }
  if (perAgent.size > 0) {
    await logEvent(supabase, "info", `Performance du jour: ${perAgent.size} agent(s) avec ventes`, {
      per_agent: Array.from(perAgent.entries()).map(([id, v]) => ({ salesperson_id: id, ...v })),
    });
  }

  const completedAt = new Date();
  const duration = completedAt.getTime() - startedAt.getTime();
  if (runId) {
    await supabase.from("agent_runs").update({
      status: errors > 0 ? "failed" : "success",
      completed_at: completedAt.toISOString(),
      duration_ms: duration,
      actions_taken: actions,
      items_processed: processed,
      errors_count: errors,
      summary: `${actions} action(s), ${processed} commande(s) examinée(s), ${errors} erreur(s)`,
    }).eq("id", runId);
  }
  await supabase.from("agent_registry").update({
    last_run_at: completedAt.toISOString(),
    last_success_at: errors === 0 ? completedAt.toISOString() : undefined,
    last_error_at: errors > 0 ? completedAt.toISOString() : undefined,
    consecutive_failures: errors > 0 ? undefined : 0,
  }).eq("agent_name", AGENT);

  return new Response(JSON.stringify({ ok: true, actions, processed, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
