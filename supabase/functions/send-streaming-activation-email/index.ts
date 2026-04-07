import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_TEMPLATE_MAP: Record<string, { templateKey: string; label: string }> = {
  link_sent: { templateKey: "order_processed", label: "Lien d'activation envoyé" },
  link_reissued: { templateKey: "order_processed", label: "Lien réémis" },
  activated: { templateKey: "order_completed", label: "Service activé" },
  expired: { templateKey: "order_cancelled", label: "Lien expiré" },
};

interface StreamingActivationEmailRequest {
  client_id: string;
  client_email: string;
  client_first_name?: string;
  client_phone?: string;
  token_id: string;
  service_name: string;
  status: string;
  activation_link?: string;
  promo_code?: string;
  expires_at?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: StreamingActivationEmailRequest = await req.json();
    const { client_id, client_email, client_first_name, client_phone, token_id, service_name, status, activation_link, promo_code } = body;

    console.log(`[${requestId}] Streaming activation: service=${service_name}, status=${status}`);

    if (!client_id || !client_email || !token_id || !service_name || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusConfig = STATUS_TEMPLATE_MAP[status];
    if (!statusConfig) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Status not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventKey = `streaming_activation_${token_id}_${status}`;

    const result = await queueRenderedEmail({
      eventKey,
      templateKey: statusConfig.templateKey,
      toEmail: client_email,
      templateVars: {
        client_name: client_first_name || "Client",
        service_name,
        status_label: statusConfig.label,
        activation_link: activation_link || "",
        promo_code: promo_code || "",
        portal_path: "/portal/streaming",
      },
    });

    console.log(`[${requestId}] Email ${result.alreadyQueued ? "already queued" : "queued"} template: ${statusConfig.templateKey}`);

    // SMS for activated
    let phoneForSms = client_phone;
    if (!phoneForSms) {
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, client_email, client_id);
      phoneForSms = phoneResult.phone || undefined;
    }

    if (phoneForSms && toE164(phoneForSms) && status === "activated") {
      const smsResult = await sendSmsNotification({
        to: phoneForSms, message: SMS_TEMPLATES.streamingActivated({ clientName: client_first_name || "Client", serviceName: service_name }),
        clientId: client_id, eventType: "streaming_activated", eventKey: `streaming_${token_id}_activated`,
      });
      console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
    }

    return new Response(JSON.stringify({ success: true, queued: true, template: statusConfig.templateKey }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
