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
    const { email, name, contractName, contractNumber, portalUrl, orderId } = await req.json();

    console.log(`[${requestId}] Queuing contract notification to ${email?.substring(0, 3)}***`);

    const eventKey = `contract_signed_${contractNumber}_${email}`;

    // Generate contract PDF (non-blocking)
    let attachments: Array<{ filename: string; content: string; contentType: string }> | undefined;
    if (orderId) {
      try {
        const { buildContractPdfAttachment } = await import("../_shared/pdfFromDb.ts");
        const pdf = await buildContractPdfAttachment(orderId, { contractNumber, filenamePrefix: "contrat-service" });
        if (pdf) attachments = [pdf];
      } catch (e) {
        console.warn(`[${requestId}] Contract PDF generation failed:`, e);
      }
    }

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
      attachments,
    });

    console.log(`[${requestId}] Email ${result.alreadyQueued ? "already queued" : "queued"}${attachments ? " (with PDF)" : ""}`);

    return new Response(JSON.stringify({ success: true, queued: true, hasPdf: !!attachments }), { 
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  } catch (error) {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    console.error(`[${errorId}] Error:`, error);
    return new Response(JSON.stringify({ error: error?.message || "Erreur inconnue", errorId }), { 
      status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } 
    });
  }
};

serve(handler);
