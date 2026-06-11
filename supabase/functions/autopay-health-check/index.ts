/**
 * autopay-health-check — Daily ops alert if PayPal autopay starts failing
 *
 * Why: a silent PayPal outage or a bad credentials rotation can fail dozens
 * of autopay charges overnight. Without an alert we'd only learn about it
 * when an angry customer calls 3 days later. This cron computes the failure
 * rate over a rolling window and pages ops the moment it crosses a threshold.
 *
 * Schedule (recommended): once daily at 08:00 UTC via pg_cron.
 *
 * Auth: SERVICE_ROLE_KEY required (cron-only).
 *
 * Alert thresholds (any one fires the alert):
 *   - failure_rate > 10% over last 24h
 *   - absolute failures >= 5 in 24h
 *
 * The alert email itself is idempotent per day: re-running the cron won't
 * spam the inbox if conditions are still met.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALERT_EMAIL = "support@nivra-telecom.ca";

const FAILURE_RATE_THRESHOLD_PERCENT = 10;
const ABSOLUTE_FAILURE_THRESHOLD = 5;
const WINDOW_HOURS = 24;

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${SERVICE_KEY}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();

  try {
    const sinceIso = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();

    // Count PayPal autopay payment attempts in window
    const { data: payments, error: payErr } = await supabase
      .from("billing_payments")
      .select("status, metadata, created_at")
      .eq("provider", "paypal")
      .gte("created_at", sinceIso);

    if (payErr) throw payErr;

    const total = payments?.length ?? 0;
    const failed = (payments ?? []).filter((p: any) =>
      ["failed", "declined", "error"].includes(String(p.status).toLowerCase())
    );
    const failedCount = failed.length;
    const failureRate = total > 0 ? (failedCount / total) * 100 : 0;

    // Also pull enrollment failures from paypal_autopay_attempts
    const { data: enrollFailed } = await supabase
      .from("paypal_autopay_attempts")
      .select("error_message, started_at")
      .eq("status", "failed")
      .gte("started_at", sinceIso);
    const enrollFailedCount = enrollFailed?.length ?? 0;

    const sampleErrors = [
      ...(failed.map((p: any) => p?.metadata?.error_message).filter(Boolean) as string[]),
      ...(enrollFailed?.map((e: any) => e.error_message).filter(Boolean) ?? []),
    ].slice(0, 3);

    const shouldAlert =
      failureRate > FAILURE_RATE_THRESHOLD_PERCENT ||
      failedCount >= ABSOLUTE_FAILURE_THRESHOLD ||
      enrollFailedCount >= ABSOLUTE_FAILURE_THRESHOLD;

    let alertSent = false;
    if (shouldAlert) {
      // Idempotency: skip if we already alerted today
      const todayKey = new Date().toISOString().split("T")[0];
      const alertEventKey = `autopay_health_alert_${todayKey}`;
      const { data: existing } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", alertEventKey)
        .maybeSingle();

      if (!existing) {
        await supabase.from("email_queue").insert({
          event_key: alertEventKey,
          to_email: ALERT_EMAIL,
          template_key: "autopay_health_alert",
          template_vars: {
            failure_rate_percent: failureRate.toFixed(1),
            failed_count: failedCount + enrollFailedCount,
            total_count: total,
            window_hours: WINDOW_HOURS,
            sample_errors: sampleErrors,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 5,
        });
        alertSent = true;

        // Also raise a billing_system_alerts row so it shows in /core dashboards
        await supabase.from("billing_system_alerts").insert({
          alert_type: "autopay_failure_spike",
          entity_type: "billing_payments",
          details: {
            failure_rate_percent: failureRate,
            failed_count: failedCount,
            enroll_failed_count: enrollFailedCount,
            total_count: total,
            window_hours: WINDOW_HOURS,
            sample_errors: sampleErrors,
          },
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      `[autopay-health-check] total=${total} failed=${failedCount} enroll_failed=${enrollFailedCount} ` +
      `rate=${failureRate.toFixed(1)}% alert=${alertSent} (${durationMs}ms)`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        window_hours: WINDOW_HOURS,
        total_payments: total,
        failed_payments: failedCount,
        enroll_failed_count: enrollFailedCount,
        failure_rate_percent: Number(failureRate.toFixed(1)),
        alert_sent: alertSent,
        thresholds: {
          failure_rate_percent: FAILURE_RATE_THRESHOLD_PERCENT,
          absolute_failures: ABSOLUTE_FAILURE_THRESHOLD,
        },
        duration_ms: durationMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[autopay-health-check] fatal:", err);
    reportEdgeError(err, { function: "autopay-health-check" }).catch(() => {});
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
