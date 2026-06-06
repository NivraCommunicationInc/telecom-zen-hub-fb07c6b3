/**
 * nps-survey-batch
 *
 * Batch cron: sends NPS survey to clients whose subscription was created
 * 28-32 days ago (catches daily runs ± 2 days of the 30-day target).
 *
 * Scheduled via pg_cron: daily at 14:00 UTC (9-10am EST/EDT).
 * Idempotent: 90-day guard via nps_surveys_sent table + event_key in email_queue.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NPS_WINDOW_MIN_DAYS = 28;
const NPS_WINDOW_MAX_DAYS = 32;
const NPS_COOLDOWN_DAYS   = 90;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const windowStart = new Date(now.getTime() - NPS_WINDOW_MAX_DAYS * 86_400_000).toISOString();
    const windowEnd   = new Date(now.getTime() - NPS_WINDOW_MIN_DAYS * 86_400_000).toISOString();
    const cutoff90    = new Date(now.getTime() - NPS_COOLDOWN_DAYS   * 86_400_000).toISOString();

    console.log(`[nps-survey-batch] Looking for subscriptions created ${windowStart} → ${windowEnd}`);

    const { data: subs, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select("id, customer_id, plan_name, created_at, customer:billing_customers(id, email, first_name, last_name, user_id)")
      .eq("status", "active")
      .gte("created_at", windowStart)
      .lte("created_at", windowEnd);

    if (subErr) throw new Error(`billing_subscriptions query failed: ${subErr.message}`);

    console.log(`[nps-survey-batch] Found ${subs?.length ?? 0} subscriptions in window`);

    let queued = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const sub of subs ?? []) {
      const cust = sub.customer as any;
      if (!cust?.email) { skipped++; continue; }

      const email = cust.email.toLowerCase();
      const eventKey = `nps_30d_sub_${sub.id}`;

      // Guard 1: already queued for this subscription
      const { data: existingQueue } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", eventKey)
        .limit(1)
        .maybeSingle();
      if (existingQueue) { skipped++; continue; }

      // Guard 2: 90-day cooldown per email
      const { data: recentSurvey } = await supabase
        .from("nps_surveys_sent")
        .select("id")
        .eq("client_email", email)
        .gte("sent_at", cutoff90)
        .limit(1)
        .maybeSingle();
      if (recentSurvey) { skipped++; continue; }

      const token = crypto.randomUUID();
      const npsLink = `https://nivra-telecom.ca/feedback?token=${token}`;

      const { error: queueErr } = await supabase.from("email_queue").insert({
        event_key: eventKey,
        to_email: email,
        template_key: "nps_survey",
        template_vars: {
          first_name: cust.first_name || "Client",
          nps_link: npsLink,
        },
        message_type: "transactional",
        status: "queued",
        attempts: 0,
        max_attempts: 3,
      });

      if (queueErr) {
        errors.push(`${email}: ${queueErr.message}`);
        continue;
      }

      await supabase.from("nps_surveys_sent").insert({
        client_email: email,
        token,
        sent_at: now.toISOString(),
      }).catch(() => { /* non-fatal */ });

      queued++;
      console.log(`[nps-survey-batch] Queued NPS for ${email} (sub ${sub.id})`);
    }

    // Heartbeat
    await supabase.from("billing_system_alerts").insert({
      alert_type: "cron_heartbeat",
      entity_type: "cron",
      entity_id: "nps-survey-batch",
      severity: "info",
      message: `NPS batch OK — window [${NPS_WINDOW_MIN_DAYS}-${NPS_WINDOW_MAX_DAYS}d] — queued: ${queued}, skipped: ${skipped}, errors: ${errors.length}`,
      details: { window_start: windowStart, window_end: windowEnd, queued, skipped, errors: errors.slice(0, 5) },
    }).catch(() => {});

    console.log(`[nps-survey-batch] Done. Queued: ${queued}, Skipped: ${skipped}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ success: true, queued, skipped, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[nps-survey-batch] Fatal:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
