import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancellationEmailData {
  template: "cancellation_received" | "cancellation_scheduled" | "cancellation_completed" | "cancellation_declined";
  to_email: string;
  client_name: string;
  request_number: string;
  service_type: string;
  effective_date?: string;
  decline_reason?: string;
  public_message?: string;
  language?: "fr" | "en";
}

const serviceTypeLabels: Record<string, string> = {
  mobile: "Mobile", internet: "Internet", tv: "Télévision",
  security: "sécurité", streaming: "Streaming", bundle: "Forfait combiné",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const data: CancellationEmailData = await req.json();
    const serviceLabel = serviceTypeLabels[data.service_type] || data.service_type;

    console.log(`[${requestId}] Queuing ${data.template} to ${data.to_email?.substring(0, 3)}***`);

    const eventKey = `${data.template}_${data.request_number}_${data.to_email}`;

    const result = await queueRenderedEmail({
      eventKey,
      templateKey: data.template,
      toEmail: data.to_email,
      templateVars: {
        client_name: data.client_name || "Client",
        request_number: data.request_number,
        service_type: serviceLabel,
        effective_date: data.effective_date || "",
        decline_reason: data.decline_reason || "",
        public_message: data.public_message || "",
        portal_path: "/portal/cancellations",
      },
    });

    console.log(`[${requestId}] Result: ${result.success ? "queued" : "failed"} (already=${result.alreadyQueued})`);

    return new Response(JSON.stringify({ success: true, queued: true, template: data.template }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
