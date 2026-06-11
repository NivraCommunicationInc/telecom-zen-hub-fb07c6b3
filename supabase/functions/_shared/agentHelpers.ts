/**
 * Shared helpers for "Hungry Sales Agents" (Agents 13-18).
 * - Logs to agent_events + agent_audit_log
 * - Updates agent_registry stats
 * - Queues emails via email_queue with BCC support@nivra-telecom.ca
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

export const SUPPORT_BCC = "support@nivra-telecom.ca";
export const ADMIN_EMAIL = "support@nivra-telecom.ca";

/**
 * Internal Nivra addresses that must NEVER receive an outbound marketing /
 * promo email as the primary `to_email`. They keep getting BCC copies via
 * SUPPORT_BCC, which is what oversight requires.
 *
 * Add any future staff / owner mailboxes here. Domain match wins over the
 * exact-address list — anything @nivra-telecom.ca is treated as internal.
 */
export const INTERNAL_EMAIL_DOMAINS = new Set<string>([
  "nivra-telecom.ca",
  "nivratelecom.ca",
]);

export const INTERNAL_EMAIL_ADDRESSES = new Set<string>([
  "nivratelecom@gmail.com",
  "nivratelecom@hotmail.com",
  "support@nivra-telecom.ca",
  "admin@nivra-telecom.ca",
  "info@nivra-telecom.ca",
  "noreply@nivra-telecom.ca",
  "billing@nivra-telecom.ca",
]);

export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const norm = String(email).trim().toLowerCase();
  if (!norm) return false;
  if (INTERNAL_EMAIL_ADDRESSES.has(norm)) return true;
  const at = norm.lastIndexOf("@");
  if (at < 0) return false;
  const domain = norm.slice(at + 1);
  return INTERNAL_EMAIL_DOMAINS.has(domain);
}

export function makeClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

export async function logEvent(
  supabase: ReturnType<typeof createClient>,
  agentName: string,
  eventType: "info" | "success" | "warning" | "error" | "critical" | "action" | "gemini_call" | "email_sent" | "auto_fix" | "escalation",
  message: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("agent_events").insert({
      agent_name: agentName,
      event_type: eventType,
      message,
      details,
    });
  } catch (e) {
    console.error(`[${agentName}] logEvent failed:`, e);
  }
}

export async function logAudit(
  supabase: ReturnType<typeof createClient>,
  agentName: string,
  action: string,
  result: "success" | "failure" | "warning" | "skipped",
  details: Record<string, unknown> | null,
  executionMs: number,
  errorMessage?: string,
): Promise<void> {
  try {
    await supabase.from("agent_audit_log").insert({
      agent_name: agentName,
      action,
      result,
      details,
      execution_time_ms: executionMs,
      error_message: errorMessage ?? null,
    });
  } catch (e) {
    console.error(`[${agentName}] logAudit failed:`, e);
  }
}

export async function updateRegistry(
  supabase: ReturnType<typeof createClient>,
  agentName: string,
  ok: boolean,
  errorMessage?: string,
): Promise<void> {
  try {
    const { data: row } = await supabase
      .from("agent_registry")
      .select("total_runs,total_successes,total_failures,consecutive_failures")
      .eq("agent_name", agentName)
      .maybeSingle();
    const totalRuns = (row?.total_runs ?? 0) + 1;
    const totalSuccesses = (row?.total_successes ?? 0) + (ok ? 1 : 0);
    const totalFailures = (row?.total_failures ?? 0) + (ok ? 0 : 1);
    const consecutive = ok ? 0 : (row?.consecutive_failures ?? 0) + 1;
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      last_run_at: now,
      total_runs: totalRuns,
      total_successes: totalSuccesses,
      total_failures: totalFailures,
      consecutive_failures: consecutive,
      updated_at: now,
    };
    if (ok) patch.last_success_at = now;
    else {
      patch.last_error_at = now;
      patch.last_error_message = errorMessage ?? "Unknown error";
    }
    await supabase.from("agent_registry").update(patch).eq("agent_name", agentName);
  } catch (e) {
    console.error(`[${agentName}] updateRegistry failed:`, e);
  }
}

/**
 * Queue an email through the custom email_queue table.
 * Always BCCs support@nivra-telecom.ca by enqueuing a second row.
 */
/**
 * Marketing / promo templates that must NEVER trigger the BCC copy to
 * support@nivra-telecom.ca — they generate too much noise in the owner
 * inbox (one BCC per send → hundreds per week). Transactional templates
 * (invoices, PIN codes, status updates) still BCC for the audit trail.
 *
 * Add new marketing template_key values here when you create them.
 */
const NO_BCC_MARKETING_TEMPLATES = new Set<string>([
  "crm_promo_blast",
  "crm_followup",
  "crm_sequence_social",
  "crm_sequence_savings",
  "crm_sequence_lastcall",
  "marketing_promotion",
  "winback_offer",
]);

export async function queueEmail(
  supabase: ReturnType<typeof createClient>,
  args: {
    toEmail: string;
    templateKey: string;
    subject: string;
    templateVars: Record<string, unknown>;
    eventKey?: string;
    skipBcc?: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Defense-in-depth: never deliver a promo / marketing payload to an
    // internal Nivra address as the primary recipient.
    if (isInternalEmail(args.toEmail)) {
      return { ok: false, error: "internal_email_recipient_blocked" };
    }

    // Hard guard: NEVER BCC marketing/promo/sequence templates to the owner
    // inbox. Match by explicit list + prefix/keyword fallback so any future
    // marketing template (crm_*, winback_*, marketing_*, *_promo, *_blast)
    // is automatically excluded without requiring a code update.
    const k = (args.templateKey || "").toLowerCase();
    const isMarketingKey =
      NO_BCC_MARKETING_TEMPLATES.has(args.templateKey) ||
      k.startsWith("crm_") ||
      k.startsWith("winback") ||
      k.startsWith("marketing_") ||
      k.includes("promo") ||
      k.includes("blast") ||
      k.includes("sequence");
    const skipBcc = args.skipBcc === true || isMarketingKey;

    const eventKey = args.eventKey || `${args.templateKey}-${crypto.randomUUID()}`;
    const rows: Record<string, unknown>[] = [
      {
        event_key: eventKey,
        to_email: args.toEmail,
        template_key: args.templateKey,
        subject: args.subject,
        template_vars: args.templateVars,
        status: "queued",
      },
    ];

    // Transactional / admin templates keep the oversight BCC. Marketing
    // templates do not — operators get a daily/weekly digest instead.
    if (!skipBcc) {
      rows.push({
        event_key: `${eventKey}-bcc`,
        to_email: SUPPORT_BCC,
        template_key: args.templateKey,
        subject: `[BCC] ${args.subject}`,
        template_vars: { ...args.templateVars, _bcc_original_recipient: args.toEmail },
        status: "queued",
      });
    }

    const { error } = await supabase.from("email_queue").insert(rows);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function callGeminiJSON(prompt: string, model = "google/gemini-2.5-pro"): Promise<any> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    // attempt to extract JSON from text
    const m = content.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Verifies the request bears the Supabase service role key (or a configured
 * AGENT_SECRET) in the Authorization header. Use this on agent functions that
 * are only invoked by pg_cron / supervisor / other server-side callers so that
 * an anonymous public POST cannot trigger them (e.g. spam email blasts).
 *
 * Returns null when authorized, otherwise a 401 Response that the caller
 * should return immediately.
 */
export function requireServiceAuth(req: Request): Response | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${SERVICE_KEY}`;
  const agentSecret = Deno.env.get("AGENT_SECRET");
  const agentExpected = agentSecret ? `Bearer ${agentSecret}` : null;
  if (authHeader === expected) return null;
  if (agentExpected && authHeader === agentExpected) return null;
  return new Response(
    JSON.stringify({ error: "unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
