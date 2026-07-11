/**
 * send-nps-survey
 *
 * Sends an NPS survey email to a client via email_queue.
 * Guards against re-sending within 90 days.
 *
 * Payload: { account_id, order_id, client_email, first_name, days_since_activation }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth gate: service role only
  const auth = req.headers.get("Authorization") ?? "";
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (auth !== `Bearer ${svcKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json() as {
      account_id?: string;
      order_id?: string;
      client_email: string;
      first_name: string;
      days_since_activation?: number;
    };

    const { account_id, order_id, client_email, first_name } = body;

    if (!client_email) {
      return new Response(
        JSON.stringify({ error: "client_email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check: has this client already received an NPS in the last 90 days?
    const cutoff90 = new Date(Date.now() - 90 * 86400_000).toISOString();
    const { data: recent, error: checkError } = await supabase
      .from("nps_surveys_sent")
      .select("id, sent_at")
      .eq("client_email", client_email.toLowerCase())
      .gte("sent_at", cutoff90)
      .limit(1);

    if (checkError) {
      console.error("[send-nps-survey] Check error:", checkError);
      throw new Error(`DB check failed: ${checkError.message}`);
    }

    if (recent && recent.length > 0) {
      console.log(`[send-nps-survey] Skipped - already sent to ${client_email} within 90 days`);
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: "nps_sent_within_90_days" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate unique token
    const token = crypto.randomUUID();
    const npsLink = `https://nivra-telecom.ca/feedback?token=${token}`;

    // Insert into email_queue
    const { error: queueError } = await enqueueCommunication(supabase, {
      channel: "email",
      recipient: client_email.toLowerCase(),
      templateKey: "nps_survey",
      idempotencyKey: `nps-survey:${token}`,
      templateVars: {
    first_name,
    nps_link: npsLink,
    order_id: order_id ?? null,
  },
    });

    if (queueError) {
      console.error("[send-nps-survey] email_queue insert error:", queueError);
      throw new Error(`email_queue insert failed: ${queueError.message}`);
    }

    // Record in nps_surveys_sent
    const { error: trackError } = await supabase.from("nps_surveys_sent").insert({
      account_id: account_id ?? null,
      order_id: order_id ?? null,
      client_email: client_email.toLowerCase(),
      token,
      sent_at: new Date().toISOString(),
    });

    if (trackError) {
      console.error("[send-nps-survey] nps_surveys_sent insert error:", trackError);
      // Not fatal - email is already queued; log and continue.
    }

    console.log(`[send-nps-survey] Queued NPS for ${client_email}, token=${token}`);

    return new Response(
      JSON.stringify({ success: true, token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[send-nps-survey] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
