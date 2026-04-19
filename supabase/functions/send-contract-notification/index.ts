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
    const { email, name, contractName, contractNumber, portalUrl } = await req.json();

    console.log(`[${requestId}] Queuing contract notification to ${email?.substring(0, 3)}***`);

    const eventKey = `contract_signed_${contractNumber}_${email}`;

    const result = await queueRenderedEmail({
      eventKey,
      templateKey: "contract_ready",
      toEmail: email,
      templateVars: {
        client_name: name || "Client",
        contract_name: contractName || "Contrat de service",
        contract_number: contractNumber || "",
        portal_path: "/portal/contracts",
      },
    });

    console.log(`[${requestId}] Email ${result.alreadyQueued ? "already queued" : "queued"}`);

    return new Response(JSON.stringify({ success: true, queued: true }), { 
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  } catch (error: any) {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    console.error(`[${errorId}] Error:`, error);
    return new Response(JSON.stringify({ error: error?.message || "Erreur inconnue", errorId }), { 
      status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } 
    });
  }
};

serve(handler);
