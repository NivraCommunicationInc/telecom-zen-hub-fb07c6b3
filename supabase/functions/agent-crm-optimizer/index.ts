/**
 * agent-crm-optimizer — Nightly CRM scoring + morning briefing.
 *
 * Phase 1 (cron 2h UTC, action=optimize): Score all contacts in batches of 50.
 *   Returns immediately; processing continues in background via EdgeRuntime.waitUntil.
 * Phase 2 (cron 7h UTC, action=send_briefing): Read pre-scored data + send briefing.
 *   Fast (< 5s) — no scoring work.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const BATCH_SIZE = 50;
const INTER_BATCH_DELAY_MS = 100;
const MAX_BATCHES = 200; // safety cap (10k contacts)

async function logAudit(supabase: any, action: string, result: string, details: unknown, ms: number, err?: string) {
  await supabase.from("agent_audit_log").insert({
    agent_name: "agent-crm-optimizer", action, result, details, execution_time_ms: ms, error_message: err,
  });
}

function scoreContact(c: any, callStats: { calls: number; lastCalled: string | null; sales: number }): number {
  let s = 0;
  if (c.city) s += 20;
  if (c.phone && c.phone.length >= 10) s += 15;
  if (c.email) s += 10;
  if (c.callback_scheduled_at && new Date(c.callback_scheduled_at) >= new Date()) s += 25;
  if (callStats.calls <= 1) s += 15;
  if (callStats.sales > 0) s += 20;
  if (c.call_status === "interested" || c.tags?.includes?.("interested")) s += 20;
  if (c.tags?.includes?.("dncl")) return 0;
  return Math.max(0, Math.min(100, s));
}

async function processBatch(supabase: any, contacts: any[]): Promise<number> {
  const ids = contacts.map((c) => c.id);
  const { data: logs } = await supabase.from("crm_call_logs")
    .select("contact_id, outcome, created_at")
    .in("contact_id", ids);

  const byContact = new Map<string, { calls: number; sales: number; lastCalled: string | null }>();
  for (const id of ids) byContact.set(id, { calls: 0, sales: 0, lastCalled: null });
  for (const l of (logs ?? [])) {
    const agg = byContact.get(l.contact_id)!;
    agg.calls++;
    if (l.outcome === "sold") agg.sales++;
    if (!agg.lastCalled || l.created_at > agg.lastCalled) agg.lastCalled = l.created_at;
  }

  let updated = 0;
  for (const c of contacts) {
    const stats = byContact.get(c.id)!;
    const score = scoreContact(c, stats);
    const { error } = await supabase.from("crm_contacts").update({ priority: score }).eq("id", c.id);
    if (!error) updated++;
  }
  return updated;
}

async function runOptimizeBackground(supabase: any, jobStart: number) {
  let totalScored = 0;
  let batchesProcessed = 0;
  let offset = 0;
  try {
    for (let i = 0; i < MAX_BATCHES; i++) {
      const { data: contacts, error } = await supabase.from("crm_contacts")
        .select("id, city, phone, email, tags, call_status, callback_scheduled_at")
        .not("call_status", "in", "(sold,do_not_call,not_interested)")
        .order("id", { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);
      if (error) throw error;
      if (!contacts || contacts.length === 0) break;

      totalScored += await processBatch(supabase, contacts);
      batchesProcessed++;
      offset += BATCH_SIZE;

      if (contacts.length < BATCH_SIZE) break;
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
    await logAudit(supabase, "optimize", "success",
      { scored: totalScored, batches: batchesProcessed },
      Date.now() - jobStart);
  } catch (e) {
    await logAudit(supabase, "optimize", "failure",
      { scored: totalScored, batches: batchesProcessed },
      Date.now() - jobStart, String(e));
  }
}

async function geminiBriefing(stats: any) {
  const prompt = `Tu es le coordinateur CRM de Nivra Telecom.
Analyse ces données CRM et crée un briefing matinal pour les agents:

Données:
- ${stats.available} contacts disponibles
- ${stats.callbacks_today} rappels programmés aujourd'hui
- ${stats.new_week} nouveaux contacts cette semaine
- Top villes: ${stats.top_cities.join(", ")}
- Taux conversion hier: ${stats.conversion_yesterday}%
- Top 10 contacts (par score):
${stats.top_contacts.map((c: any, i: number) => `  ${i+1}. ${c.full_name ?? c.first_name ?? c.email} — ${c.city ?? "?"} — score ${c.priority}`).join("\n")}

Réponds STRICTEMENT en JSON:
{
  "summary": "résumé situation 2-3 phrases motivantes",
  "top_priorities": ["raison pour contact 1", "...10 entrées"],
  "strategy": "stratégie recommandée du jour",
  "scripts": ["script d'approche 1", "script 2", "script 3"],
  "objectives": "objectifs réalistes du jour (ex: 30 appels / 3 ventes)"
}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  return JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "{}");
}

async function runBriefing(supabase: any) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const yesterday = new Date(Date.now() - 86400_000); yesterday.setHours(0, 0, 0, 0);

  const { count: available } = await supabase.from("crm_contacts").select("*", { count: "exact", head: true })
    .not("call_status", "in", "(sold,do_not_call,not_interested)");
  const { count: callbacks } = await supabase.from("crm_contacts").select("*", { count: "exact", head: true })
    .gte("callback_scheduled_at", today.toISOString()).lt("callback_scheduled_at", new Date(today.getTime() + 86400_000).toISOString());
  const { count: newWeek } = await supabase.from("crm_contacts").select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo);

  const { data: topCities } = await supabase.from("crm_contacts").select("city").not("city", "is", null).limit(500);
  const cityFreq: Record<string, number> = {};
  for (const c of (topCities ?? [])) cityFreq[c.city] = (cityFreq[c.city] ?? 0) + 1;
  const top_cities = Object.entries(cityFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);

  const { data: yLogs } = await supabase.from("crm_call_logs").select("outcome").gte("created_at", yesterday.toISOString());
  const yCalls = yLogs?.length ?? 0;
  const ySold = (yLogs ?? []).filter((l: any) => l.outcome === "sold").length;
  const conv = yCalls > 0 ? Math.round((ySold / yCalls) * 100) : 0;

  const { data: top10 } = await supabase.from("crm_contacts")
    .select("full_name, first_name, email, city, priority")
    .not("call_status", "in", "(sold,do_not_call,not_interested)")
    .order("priority", { ascending: false }).limit(10);

  const ai = await geminiBriefing({
    available: available ?? 0, callbacks_today: callbacks ?? 0,
    new_week: newWeek ?? 0, top_cities, conversion_yesterday: conv,
    top_contacts: top10 ?? [],
  });

  const { data: emps } = await supabase.from("profiles")
    .select("email, first_name, full_name")
    .in("role", ["field_sales", "employee", "cs"])
    .eq("account_status", "active")
    .not("email", "is", null);

  let sent = 0;
  for (const e of (emps ?? [])) {
    await enqueueCommunication(supabase, {
      channel: "email",
      recipient: e.email,
      templateKey: "crm_morning_briefing",
      subject: `Briefing CRM du matin — ${new Date().toLocaleDateString("fr-CA"),
      idempotencyKey: `crm-optimizer:briefing:${e.id ?? e.email}:${new Date().toISOString().slice(0,10)}`,
      templateVars: {},
    });
    sent++;
  }
  return { briefings_sent: sent, available, callbacks, conversion_yesterday: conv };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const _auth = req.headers.get("Authorization") ?? "";
  const _agentSecret = Deno.env.get("AGENT_SECRET");
  if (_auth !== `Bearer ${SERVICE_KEY}` && (!_agentSecret || _auth !== `Bearer ${_agentSecret}`)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    let body: any = {};
    try { body = await req.json(); } catch (_e) { /* */ }

    if (body.action === "send_briefing") {
      const r = await runBriefing(supabase);
      await logAudit(supabase, "briefing", "success", r, Date.now() - startedAt);
      return new Response(JSON.stringify({ ok: true, ...r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Phase 1: optimize — kick off in background, return immediately.
    // @ts-ignore EdgeRuntime is provided by Supabase Edge Runtime
    EdgeRuntime.waitUntil(runOptimizeBackground(supabase, startedAt));
    return new Response(JSON.stringify({
      ok: true,
      queued: true,
      mode: "background",
      batch_size: BATCH_SIZE,
      message: "Optimization started in background; check agent_audit_log for results.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await logAudit(supabase, "error", "failure", null, Date.now() - startedAt, String(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
