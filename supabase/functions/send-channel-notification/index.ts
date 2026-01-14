import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { sendTemplateEmail, formatCurrencyForTemplate } from "../_shared/resendTemplates.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const { email, name, type, channels, totalPrice, notes, ticketNumber } = await req.json();

    console.log(`[send-channel-notification] Sending ${type} notification to ${email?.substring(0, 3)}***`);

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivratelecom.ca";

    // Build channels list for template
    const channelNames = (channels || []).map((ch: any) => ch.name).join(", ");

    // Use the channels_change_requested template
    const emailResult = await sendTemplateEmail({
      resendApiKey,
      templateKey: "channels_change_requested",
      to: email,
      variables: {
        CLIENT_FIRST_NAME: name || "Client",
        CHANNELS_LIST: channelNames || "Chaînes sélectionnées",
        CHANNELS_COUNT: String(channels?.length || 0),
        TOTAL_PRICE: formatCurrencyForTemplate(totalPrice || 0),
        TICKET_NUMBER: ticketNumber || "",
        NOTES: notes || "",
        PORTAL_LINK: `${siteBaseUrl}/portal/chaines`,
        STATUS: type === "confirmed" ? "confirmée" : "annulée",
      },
      subject: type === "confirmed" 
        ? "Sélection de chaînes confirmée - Nivra" 
        : "Sélection de chaînes annulée - Nivra",
    });

    if (!emailResult.success) {
      console.error("[send-channel-notification] Email failed:", emailResult.error);
      throw new Error(emailResult.error);
    }

    console.log(`[send-channel-notification] Email sent: ${emailResult.id}`);

    return new Response(JSON.stringify({ success: true, result: { id: emailResult.id } }), { 
      status: 200, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  } catch (error: any) {
    console.error("[send-channel-notification] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } 
    });
  }
};

serve(handler);
