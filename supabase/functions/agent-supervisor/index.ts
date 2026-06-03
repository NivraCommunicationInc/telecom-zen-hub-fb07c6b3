/**
 * agent-supervisor — Agent 11: Supervises all AI agents.
 *
 * Runs every 15 minutes. For each row in agent_registry:
 *   A. Checks last_run_at against cron cadence and flags lateness.
 *   B. Detects consecutive_failures >= 2 and attempts auto-restart (>=3).
 *   C. Recomputes health_score from failures and 24h success/error mix.
 *   D. Restarts failing agents by invoking their function.
 *   E. Aggregates a global health score; emails alert when < 50.
 *
 * Uses Gemini 2.5 Pro (google/gemini-2.5-pro) on Lovable AI Gateway to
 * analyse the metrics matrix and produce a strict-JSON diagnostic that
 * is persisted in agent_runs.details and agent_events.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ALERT_EMAIL = "nivratelecom@gmail.com";
const AGENT = "supervisor";

type EventType =
  | "info" | "success" | "warning" | "error" | "critical"
  | "action" | "gemini_call" | "email_sent" | "auto_fix" | "escalation";

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  agent_name: string,
  event_type: EventType,
  message: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("agent_events").insert({ agent_name, event_type, message, details });
}

function cronMaxLatenessMin(schedule: string | null | undefined): number {
  if (!schedule) return 1440;
  const s = String(schedule).trim();
  if (s.startsWith("*/")) {
    const n = Number(s.split(" ")[0].slice(2));
    if (Number.isFinite(n) && n > 0) return Math.max(n + 5, 10);
  }
  if (s.startsWith("0 *")) return 90;       // hourly
  if (s.match(/^0 \*\/\d/)) {
    const n = Number(s.split(" ")[1].slice(2));
    if (Number.isFinite(n)) return n * 60 + 30;
  }
  if (s.match(/^0 \d+ \* \* \*/)) return 26 * 60; // daily
  if (s.match(/^0 \d+ \* \* \d/)) return 8 * 24 * 60; // weekly
  return 1440;
}

async function callGemini(prompt: string): Promise<string | null> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "Tu es un superviseur IA pour Nivra Telecom. Réponds en JSON strict uniquement, sans markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function restartAgent(functionName: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ triggered_by: "supervisor" }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = new Date();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: runRow } = await supabase
    .from("agent_runs")
    .insert({ agent_name: AGENT, status: "running", started_at: startedAt.toISOString() })
    .select("id")
    .maybeSingle();
  const runId = (runRow as { id: string } | null)?.id ?? null;

  await logEvent(supabase, AGENT, "info", "Supervisor scan démarré");

  const { data: agents } = await supabase
    .from("agent_registry")
    .select("agent_name,display_name,function_name,cron_schedule,status,last_run_at,last_error_message,consecutive_failures,total_runs,total_successes,total_failures,health_score")
    .neq("agent_name", AGENT);

  const now = Date.now();
  let actions = 0;
  let failing: Array<Record<string, unknown>> = [];
  const metrics: Array<Record<string, unknown>> = [];

  for (const a of (agents ?? []) as Array<Record<string, any>>) {
    const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [{ count: succ24 }, { count: err24 }] = await Promise.all([
      supabase.from("agent_runs").select("id", { count: "exact", head: true }).eq("agent_name", a.agent_name).eq("status", "success").gte("started_at", since24),
      supabase.from("agent_events").select("id", { count: "exact", head: true }).eq("agent_name", a.agent_name).in("event_type", ["error", "critical"]).gte("created_at", since24),
    ]);

    const maxLate = cronMaxLatenessMin(a.cron_schedule);
    const lastMs = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
    const lateMin = lastMs ? Math.round((now - lastMs) / 60000) : 999999;
    const isLate = a.status === "active" && lateMin > maxLate;

    let newHealth = 100 - (a.consecutive_failures ?? 0) * 20 - (err24 ?? 0) * 2 + (succ24 ?? 0) * 1;
    if (isLate) newHealth -= 15;
    if (a.status === "suspended") newHealth = Math.max(newHealth, 0);
    newHealth = Math.max(0, Math.min(100, newHealth));

    await supabase.from("agent_registry").update({ health_score: newHealth }).eq("agent_name", a.agent_name);

    metrics.push({
      agent: a.agent_name,
      health: newHealth,
      consecutive_failures: a.consecutive_failures ?? 0,
      successes_24h: succ24 ?? 0,
      errors_24h: err24 ?? 0,
      late_minutes: lateMin,
      status: a.status,
    });

    if (isLate) {
      await logEvent(supabase, AGENT, "warning", `Agent ${a.agent_name} en retard (${lateMin}min > ${maxLate}min)`, { agent: a.agent_name });
      actions++;
    }

    if ((a.consecutive_failures ?? 0) >= 2 && a.status === "active") {
      await logEvent(supabase, AGENT, "warning", `Agent ${a.agent_name}: ${a.consecutive_failures} échecs consécutifs`, { agent: a.agent_name });
      actions++;
    }

    if ((a.consecutive_failures ?? 0) >= 3 && a.status === "active") {
      // Guard against infinite restart cascade: max 3 restarts per agent per 24h
      const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count: restartsToday } = await supabase
        .from("agent_events")
        .select("id", { count: "exact", head: true })
        .eq("agent_name", AGENT)
        .eq("event_type", "auto_fix")
        .ilike("details->agent", `%${a.agent_name}%`)
        .gte("created_at", since24h);
      if ((restartsToday ?? 0) >= 3) {
        await logEvent(supabase, AGENT, "warning", `Redémarrage de ${a.agent_name} suspendu — limite 3/jour atteinte`, { agent: a.agent_name });
      } else {
        const ok = await restartAgent(a.function_name);
        await logEvent(supabase, AGENT, ok ? "auto_fix" : "error",
          ok ? `Redémarrage forcé de ${a.agent_name} réussi` : `Échec du redémarrage de ${a.agent_name}`,
          { agent: a.agent_name });
        actions++;
      }
    }

    if (newHealth < 50 || a.status === "error") {
      failing.push({ agent: a.agent_name, display_name: a.display_name, health: newHealth, last_error: a.last_error_message });
    }
  }

  const globalHealth = metrics.length
    ? Math.round(metrics.reduce((s, m) => s + Number(m.health ?? 0), 0) / metrics.length)
    : 100;

  const activeCount = metrics.filter((m) => m.status === "active").length;
  const errorCount = metrics.filter((m) => Number(m.health) < 50 || m.status === "error").length;

  // Gemini diagnostic
  let geminiSummary: unknown = null;
  if (failing.length > 0 || globalHealth < 75) {
    await logEvent(supabase, AGENT, "gemini_call", "Analyse Gemini 2.5 Pro des métriques agents");
    const raw = await callGemini(
      `Tu supervises les agents IA de Nivra Telecom. Analyse ces métriques et identifie les problèmes:\n${JSON.stringify(metrics, null, 2)}\n\nFournis EN JSON STRICT (clés exactes):\n{\n  "global_health": number,\n  "problem_agents": string[],\n  "probable_causes": string[],\n  "corrective_actions": string[],\n  "risk_forecast_24h": string\n}`,
    );
    if (raw) {
      try { geminiSummary = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
      catch { geminiSummary = { raw }; }
    }
  }

  await logEvent(supabase, AGENT, globalHealth < 50 ? "critical" : globalHealth < 75 ? "warning" : "success",
    `Santé globale: ${globalHealth}/100 — ${activeCount} actifs, ${errorCount} en erreur`,
    { global_health: globalHealth, active: activeCount, errors: errorCount, gemini: geminiSummary });

  // Email alert on low global health
  if (globalHealth < 50 || failing.length >= 2) {
    await supabase.from("email_queue").insert({
      to_email: ALERT_EMAIL,
      template_key: "agent_supervisor_alert",
      template_vars: {
        global_health: globalHealth,
        active_count: activeCount,
        error_count: errorCount,
        failing_agents: failing,
        gemini_summary: geminiSummary,
      },
      status: "queued",
    });
    await logEvent(supabase, AGENT, "email_sent", `Alerte superviseur envoyée à ${ALERT_EMAIL}`);
  }

  const completedAt = new Date();
  const duration = completedAt.getTime() - startedAt.getTime();
  if (runId) {
    await supabase.from("agent_runs").update({
      status: "success",
      completed_at: completedAt.toISOString(),
      duration_ms: duration,
      actions_taken: actions,
      items_processed: metrics.length,
      summary: `Santé globale ${globalHealth}/100, ${actions} actions, ${failing.length} agents en difficulté`,
      details: { metrics, gemini: geminiSummary, failing },
      gemini_used: !!geminiSummary,
    }).eq("id", runId);
  }
  await supabase.from("agent_registry").update({
    last_run_at: completedAt.toISOString(),
    last_success_at: completedAt.toISOString(),
    consecutive_failures: 0,
  }).eq("agent_name", AGENT);


  return new Response(JSON.stringify({ ok: true, global_health: globalHealth, actions, agents: metrics.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
