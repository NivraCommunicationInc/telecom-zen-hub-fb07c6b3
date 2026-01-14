import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { sendTemplateEmail } from "../_shared/resendTemplates.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const { email, name, contractName, contractNumber, portalUrl } = await req.json();

    console.log(`[send-contract-notification] Sending contract_signed template to ${email?.substring(0, 3)}***`);

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivratelecom.ca";

    // Send email using Resend template
    const emailResult = await sendTemplateEmail({
      resendApiKey,
      templateKey: "contract_signed",
      to: email,
      variables: {
        CLIENT_FIRST_NAME: name || "Client",
        CONTRACT_NAME: contractName || "Contrat de service",
        CONTRACT_NUMBER: contractNumber || "",
        PORTAL_LINK: portalUrl || `${siteBaseUrl}/portal/contrats`,
      },
      subject: `Contrat à signer - ${contractName}`,
    });

    if (!emailResult.success) {
      console.error("[send-contract-notification] Email failed:", emailResult.error);
      throw new Error(emailResult.error);
    }

    console.log(`[send-contract-notification] Email sent: ${emailResult.id}`);

    return new Response(JSON.stringify({ success: true, id: emailResult.id }), { 
      status: 200, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  } catch (error: any) {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().substring(0, 4).toUpperCase()}`;
    console.error(`[${errorId}] Error in send-contract-notification:`, error);
    
    const isProd = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
    const safeMessage = isProd 
      ? `Erreur d'envoi. (Réf: ${errorId})`
      : (error?.message || "Erreur inconnue");
    
    return new Response(JSON.stringify({ error: safeMessage, errorId }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } 
    });
  }
};

serve(handler);
