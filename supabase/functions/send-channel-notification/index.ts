import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const { email, name, type, channels, totalPrice, notes, ticketNumber } = await req.json();

    console.log(`[${requestId}] Queuing ${type} channel notification to ${email?.substring(0, 3)}***`);

    const eventKey = `channels_${type}_${ticketNumber || Date.now()}_${email}`;
    const channelNames = (channels || []).map((ch: any) => ch.name).join(", ");
    const templateKey = type === "confirmed" ? "channels_change_requested" : "order_cancelled";

    const result = await queueRenderedEmail({
      eventKey,
      templateKey,
      toEmail: email,
      templateVars: {
        client_name: name || "Client",
        order_number: ticketNumber || "",
        service_type: "Chaînes TV",
        channels_list: channelNames || "Chaînes sélectionnées",
        channels_count: String(channels?.length || 0),
        total_amount: totalPrice || 0,
        notes: notes || "",
        portal_path: "/portal/chaines",
      },
    });

    console.log(`[${requestId}] Email ${result.alreadyQueued ? "already queued" : "queued"} template: ${templateKey}`);

    return new Response(JSON.stringify({ success: true, queued: true, template: templateKey }), { 
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } 
    });
  }
};

serve(handler);
