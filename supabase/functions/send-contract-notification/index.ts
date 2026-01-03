import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { email, name, contractName, contractNumber, portalUrl } = await req.json();

    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <support@nivratelecom.ca>",
      reply_to: "support@nivratelecom.ca",
      to: [email],
      subject: `Contrat à signer - ${contractName}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 40px 30px; text-align: center;"><h1 style="color: white; margin: 0;">NIVRA</h1><p style="color: rgba(255,255,255,0.9);">Courtier Télécom Indépendant</p></div><div style="padding: 40px 30px;"><h2>Bonjour ${name},</h2><p>Un nouveau contrat a été préparé pour vous.</p><div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;"><p><strong>Nom:</strong> ${contractName}</p><p><strong>Numéro:</strong> ${contractNumber}</p></div><p><a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px;">Voir le contrat</a></p></div><div style="padding: 25px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;"><p style="color: #64748b; font-size: 12px;">Nivra Télécom | Montréal, QC | 438-544-2233</p></div></div>`,
    });

    return new Response(JSON.stringify(emailResponse), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-contract-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } });
  }
};

serve(handler);
