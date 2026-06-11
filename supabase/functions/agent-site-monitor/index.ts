/**
 * agent-site-monitor — runs every 10 minutes via cron.
 * Performs ~8 health checks, uses Gemini 2.5 Pro to score & summarize,
 * stores findings in site_health_checks, logs to agent_audit_log,
 * and emails CRITICAL issues to support@nivra-telecom.ca.
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

type Finding = {
  check_type: string;
  status: "ok" | "warning" | "critical" | "error";
  title: string;
  description?: string;
  details?: Record<string, unknown>;
};

async function runChecks(supabase: ReturnType<typeof createClient>): Promise<Finding[]> {
  const findings: Finding[] = [];

  // CHECK 1 — Email queue
  try {
    const { data: emailStats } = await supabase
      .from("email_queue")
      .select("status")
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    const counts: Record<string, number> = {};
    for (const r of (emailStats ?? []) as Array<{ status: string }>) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    const dlq = counts["dlq"] ?? 0;
    const queued = counts["queued"] ?? 0;
    if (dlq > 5) findings.push({ check_type: "email_queue", status: "critical", title: `${dlq} emails en DLQ`, description: "Plus de 5 emails échoués en file morte. Action requise.", details: counts });
    else if (dlq >= 1) findings.push({ check_type: "email_queue", status: "warning", title: `${dlq} email(s) en DLQ`, details: counts });
    else findings.push({ check_type: "email_queue", status: "ok", title: "File email saine", details: counts });

    if (queued > 100) findings.push({ check_type: "email_queue", status: "warning", title: `${queued} emails en attente`, description: "File saturée." });
  } catch (e) {
    findings.push({ check_type: "email_queue", status: "error", title: "Échec lecture file email", description: String(e) });
  }

  // CHECK 2 — Stuck orders
  try {
    const { count: stuck } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 2 * 3600_000).toISOString());
    if ((stuck ?? 0) > 5) findings.push({ check_type: "payments", status: "warning", title: `${stuck} commandes bloquées >2h`, description: "Commandes en attente non traitées." });
    else findings.push({ check_type: "payments", status: "ok", title: "Aucune commande bloquée", details: { stuck } });
  } catch (e) {
    findings.push({ check_type: "payments", status: "error", title: "Échec check paiements", description: String(e) });
  }

  // CHECK 3 — Failed payments (24h)
  try {
    const { count: failed } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if ((failed ?? 0) > 10) findings.push({ check_type: "payments", status: "critical", title: `${failed} paiements échoués (24h)` });
    else if ((failed ?? 0) > 3) findings.push({ check_type: "payments", status: "warning", title: `${failed} paiements échoués (24h)` });
  } catch { /* ignore */ }

  // CHECK 4 — Notification outbox
  try {
    const { count: blocked } = await supabase
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "blocked"]);
    if ((blocked ?? 0) > 10) findings.push({ check_type: "api", status: "warning", title: `${blocked} notifications bloquées` });
  } catch { /* ignore */ }

  // CHECK 5 — Recent agent failures
  try {
    const { count: fail } = await supabase
      .from("agent_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("result", "failure")
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((fail ?? 0) > 10) findings.push({ check_type: "security", status: "warning", title: `${fail} échecs agent (1h)` });
  } catch { /* ignore */ }

  // CHECK 6 — Storage buckets accessible
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) findings.push({ check_type: "storage", status: "warning", title: "Storage inaccessible", description: error.message });
    else findings.push({ check_type: "storage", status: "ok", title: `${buckets?.length ?? 0} buckets accessibles` });
  } catch (e) {
    findings.push({ check_type: "storage", status: "error", title: "Storage check failed", description: String(e) });
  }

  // CHECK 7 — Latest email send (API health proxy)
  try {
    const { data: lastSent } = await supabase
      .from("email_queue")
      .select("created_at")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSent) {
      const ageMin = (Date.now() - new Date((lastSent as { created_at: string }).created_at).getTime()) / 60_000;
      if (ageMin > 120) findings.push({ check_type: "api", status: "warning", title: `Aucun email envoyé depuis ${Math.round(ageMin)}min` });
      else findings.push({ check_type: "api", status: "ok", title: "API email opérationnelle" });
    }
  } catch { /* ignore */ }

  // CHECK 8 — DLQ template breakdown
  try {
    const { data: dlqRows } = await supabase
      .from("email_queue")
      .select("template_key,last_error,created_at")
      .eq("status", "dlq")
      .order("created_at", { ascending: false })
      .limit(50);
    if (dlqRows && dlqRows.length > 0) {
      const breakdown: Record<string, number> = {};
      for (const r of dlqRows as Array<{ template_key: string }>) {
        breakdown[r.template_key] = (breakdown[r.template_key] ?? 0) + 1;
      }
      findings.push({ check_type: "email_queue", status: dlqRows.length > 5 ? "critical" : "warning", title: "Analyse DLQ par template", details: breakdown });
    }
  } catch { /* ignore */ }

  return findings;
}

async function geminiAnalyze(findings: Finding[]): Promise<{ score: number; summary: string } | null> {
  try {
    const prompt = `Tu es l'agent de surveillance de Nivra Telecom. Voici les résultats:
${JSON.stringify(findings, null, 2)}

Réponds STRICTEMENT en JSON: { "score": <0-100>, "summary": "<3 phrases max, professionnel>" }`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const findings = await runChecks(supabase);
    const ai = await geminiAnalyze(findings);

    // Insert findings
    const rows = findings.map((f) => ({
      ...f,
      details: { ...(f.details ?? {}), ai_score: ai?.score, ai_summary: ai?.summary },
      requires_attention: f.status === "critical",
    }));
    if (rows.length > 0) await supabase.from("site_health_checks").insert(rows);

    // Email critical
    const critical = findings.filter((f) => f.status === "critical");
    if (critical.length > 0) {
      await supabase.from("email_queue").insert({
        to_email: ALERT_EMAIL,
        template_key: "site_health_alert",
        subject: "[ALERTE CRITIQUE] Problème détecté — Nivra Telecom",
        template_vars: {
          client_name: "Équipe Nivra",
          health_score: ai?.score ?? 0,
          critical_count: critical.length,
          total_issues: findings.filter((f) => f.status !== "ok").length,
          summary: ai?.summary ?? "Plusieurs problèmes critiques détectés.",
          issues: critical.map((c) => ({ title: c.title, description: c.description ?? "" })),
        },
        status: "queued",
      });
    }

    await supabase.from("agent_audit_log").insert({
      agent_name: "agent-site-monitor",
      action: "scan",
      result: "success",
      execution_time_ms: Date.now() - startedAt,
      details: { findings_count: findings.length, critical_count: critical.length, score: ai?.score },
    });

    return new Response(
      JSON.stringify({ ok: true, findings: findings.length, critical: critical.length, score: ai?.score }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await supabase.from("agent_audit_log").insert({
      agent_name: "agent-site-monitor",
      action: "scan",
      result: "failure",
      error_message: String(e),
      execution_time_ms: Date.now() - startedAt,
    });
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
