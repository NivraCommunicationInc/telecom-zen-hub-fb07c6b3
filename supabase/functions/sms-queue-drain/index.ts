/**
 * sms-queue-drain — processes pending SMS in public.sms_queue.
 * Triggered every 2 minutes by pg_cron. Sends up to 10 messages per run
 * via OpenPhone using the shared smsHelper, then updates row status.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSmsNotification } from "../_shared/smsHelper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(url, serviceKey);

  // Atomically claim up to BATCH rows: queued -> sending
  const { data: claimed, error: claimErr } = await supabase
    .from("sms_queue")
    .select("id, to_phone, to_user_id, message, event_key, attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (claimErr) {
    console.error("[sms-queue-drain] claim error", claimErr);
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ids = (claimed ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  await supabase.from("sms_queue").update({ status: "sending" }).in("id", ids);

  let sent = 0;
  let failed = 0;

  for (const row of claimed ?? []) {
    try {
      const result = await sendSmsNotification({
        to: row.to_phone,
        message: row.message,
        clientId: row.to_user_id ?? undefined,
        eventType: "transactional_sms",
        eventKey: row.event_key,
      });

      if (result.success) {
        sent++;
        await supabase
          .from("sms_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: (row.attempts ?? 0) + 1,
          })
          .eq("id", row.id);
      } else if (result.skipped) {
        // treat skipped (e.g. already-sent idempotent) as success
        await supabase
          .from("sms_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            error_message: result.reason ?? null,
            attempts: (row.attempts ?? 0) + 1,
          })
          .eq("id", row.id);
      } else {
        failed++;
        const attempts = (row.attempts ?? 0) + 1;
        await supabase
          .from("sms_queue")
          .update({
            status: attempts >= 5 ? "failed" : "queued",
            error_message: result.error ?? "unknown",
            attempts,
          })
          .eq("id", row.id);
      }
    } catch (err) {
      console.error("[sms-queue-drain] send error", err);
      failed++;
      const attempts = (row.attempts ?? 0) + 1;
      await supabase
        .from("sms_queue")
        .update({
          status: attempts >= 5 ? "failed" : "queued",
          error_message: (err as Error)?.message ?? "exception",
          attempts,
        })
        .eq("id", row.id);
    }
  }

  return new Response(
    JSON.stringify({ processed: ids.length, sent, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
