import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const { email, name, type, channels, totalPrice, notes, ticketNumber } = await req.json();
    const formatCurrency = (value: number) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(value);

    const typeConfigs: Record<string, any> = {
      confirmed: { subject: "Sélection de chaînes confirmée - Nivra", heading: "Votre sélection a été confirmée! 🎉", color: "#10b981", icon: "✅" },
      cancelled: { subject: "Sélection de chaînes annulée - Nivra", heading: "Votre sélection a été annulée", color: "#ef4444", icon: "❌" },
    };

    const config = typeConfigs[type];
    const channelsListHtml = channels.map((ch: any) => `<tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${ch.name}</td><td style="padding: 8px; text-align: right;">${ch.price === 0 ? 'Inclus' : formatCurrency(ch.price)}</td></tr>`).join('');

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: "Nivra Telecom <support@nivratelecom.ca>",
        reply_to: "support@nivratelecom.ca",
        to: [email],
        subject: config.subject,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;"><h1 style="color: white;">📺 Nivra TV</h1></div><div style="padding: 30px; background: #f8fafc;"><h2>Bonjour ${name || "cher client"},</h2><div style="background: ${config.color}20; border-left: 4px solid ${config.color}; padding: 15px; margin: 20px 0;"><h3 style="color: ${config.color};">${config.icon} ${config.heading}</h3></div>${ticketNumber ? `<p><strong>Ticket:</strong> ${ticketNumber}</p>` : ''}<div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;"><h4>Chaînes (${channels.length})</h4><table style="width: 100%;">${channelsListHtml}<tr style="background: #0891b210;"><td style="padding: 12px; font-weight: bold;">Total</td><td style="padding: 12px; text-align: right; font-weight: bold;">${formatCurrency(totalPrice)}/mois</td></tr></table></div>${notes ? `<p style="background: #fef3c7; padding: 15px; border-radius: 8px;">${notes}</p>` : ''}<p>L'équipe Nivra</p></div></div>`,
      }),
    });

    const result = await emailResponse.json();
    if (!emailResponse.ok) throw new Error(result.message);

    return new Response(JSON.stringify({ success: true, result }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } });
  }
};

serve(handler);
