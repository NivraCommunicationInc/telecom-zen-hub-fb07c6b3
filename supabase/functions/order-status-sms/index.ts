// ============================================================
// order-status-sms — Fire-and-forget SMS dispatcher
// Called by DB trigger trigger_order_email via pg_net.
// Sends short FR SMS via OpenPhone + logs to telephony_logs.
// Idempotent via event_key.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSmsNotification, toE164 } from "../_shared/smsHelper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  order_id?: string;
  phone?: string;
  status?: string;
  status_label?: string;
  order_number?: string;
  tracking_number?: string;
  event_key?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as Body;
    const { phone, status, status_label, order_number, tracking_number, event_key } = body;

    if (!phone || !status || !order_number) {
      return new Response(JSON.stringify({ skipped: true, reason: "missing_fields" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const e164 = toE164(phone);
    if (!e164) {
      return new Response(JSON.stringify({ skipped: true, reason: "invalid_phone" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: check telephony_logs for event_key
    if (event_key) {
      const { data: dup } = await supabase
        .from("telephony_logs")
        .select("id")
        .eq("event_key", event_key + "_sms")
        .maybeSingle();
      if (dup) {
        return new Response(JSON.stringify({ skipped: true, reason: "already_sent" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let msg = `Nivra: Commande #${order_number} - ${status_label || status}.`;
    if (status === "shipped" && tracking_number) {
      msg += ` Suivi: ${tracking_number}`;
    }
    msg += ` Détails: https://nivra-telecom.ca/portail`;
    if (msg.length > 160) msg = msg.slice(0, 157) + "...";

    const result = await sendSmsNotification({
      to: e164,
      message: msg,
      eventType: `order_status_${status}`,
      eventKey: (event_key || `order_${body.order_id}_${status}`) + "_sms",
    });

    return new Response(JSON.stringify({ success: true, sms: result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[order-status-sms] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
