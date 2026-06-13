/**
 * complaint-escalate-crtc
 *
 * Daily cron: auto-escalates complaints open for 30+ days without resolution.
 * - Sets status = 'escalated', records escalated_at
 * - Emails client about CCTS escalation rights
 * - Emails support@nivra-telecom.ca with admin alert
 *
 * Idempotent: skips complaints already escalated + uses event_key guard.
 * Scheduled via pg_cron: daily at 10:00 UTC.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESCALATION_DAYS = 30;
const ADMIN_EMAIL = "support@nivra-telecom.ca";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoff = new Date(Date.now() - ESCALATION_DAYS * 86_400_000).toISOString();

    const { data: complaints, error } = await supabase
      .from("complaints")
      .select("id, ticket_number, submitted_by_email, submitted_by_name, subject, public_token, created_at")
      .not("status", "in", '("resolved","closed","escalated")')
      .lt("created_at", cutoff);

    if (error) throw new Error(`complaints query failed: ${error.message}`);

    console.log(`[complaint-escalate-crtc] Found ${complaints?.length ?? 0} complaints to escalate`);

    let escalated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (const c of complaints ?? []) {
      try {
        const eventKey = `ccts_escalated_${c.id}`;
        const { data: alreadySent } = await supabase
          .from("email_queue").select("id").eq("event_key", eventKey).limit(1).maybeSingle();
        if (alreadySent) { skipped++; continue; }

        // Mark escalated
        const { error: updErr } = await supabase
          .from("complaints")
          .update({ status: "escalated", escalated_at: now, updated_at: now })
          .eq("id", c.id);
        if (updErr) { errors.push(`${c.ticket_number}: ${updErr.message}`); continue; }

        const trackingUrl = c.public_token
          ? `https://nivra-telecom.ca/plainte/suivi/${c.public_token}`
          : `https://nivra-telecom.ca/plainte/suivi`;

        // Client email
        await supabase.from("email_queue").insert({
          event_key: eventKey,
          to_email: c.submitted_by_email,
          template_key: "complaint_ccts_escalation",
          template_vars: {
            first_name: (c.submitted_by_name || "Client").split(" ")[0],
            client_name: c.submitted_by_name || "Client",
            ticket_number: c.ticket_number,
            tracking_url: trackingUrl,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 3,
        });

        // Admin alert
        await supabase.from("email_queue").insert({
          event_key: `${eventKey}_admin`,
          to_email: ADMIN_EMAIL,
          template_key: "complaint_ccts_admin_alert",
          template_vars: {
            ticket_number: c.ticket_number,
            client_name: c.submitted_by_name || "—",
            submitted_by_email: c.submitted_by_email,
            subject: c.subject,
            core_complaint_url: `https://nivra-telecom.ca/core/complaints`,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 3,
        });

        escalated++;
        console.log(`[complaint-escalate-crtc] Escalated ${c.ticket_number} (${c.submitted_by_email})`);
      } catch (err) {
        const msg = `${c.ticket_number}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        console.error(`[complaint-escalate-crtc] ${msg}`);
      }
    }

    // Heartbeat
    await supabase.from("billing_system_alerts").insert({
      alert_type: "cron_heartbeat",
      entity_type: "cron",
      entity_id: "complaint-escalate-crtc",
      severity: escalated > 0 ? "warning" : "info",
      message: `CCTS escalation OK — escalated: ${escalated}, skipped: ${skipped}, errors: ${errors.length}`,
      details: { cutoff, escalated, skipped, errors: errors.slice(0, 5) },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, escalated, skipped, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[complaint-escalate-crtc] Fatal:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
