import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { email, name, contractName, contractNumber, portalUrl } = await req.json();

    console.log(`[${requestId}] Queuing contract notification to ${email?.substring(0, 3)}***`);

    // Create unique event key for idempotency
    const eventKey = `contract_signed_${contractNumber}_${email}`;

    // Check if already queued/sent
    const { data: existingEmail } = await supabase
      .from("email_queue")
      .select("id")
      .eq("event_key", eventKey)
      .in("status", ["sent", "queued", "processing"])
      .maybeSingle();

    if (existingEmail) {
      console.log(`[${requestId}] Email already queued/sent for this contract`);
      return new Response(JSON.stringify({ success: true, already_queued: true }), { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivra-telecom.ca";

    // Queue email for processing by process-email-queue
    const { error: queueError } = await supabase.from("email_queue").insert({
      event_key: eventKey,
      template_key: "contract_ready",
      to_email: email,
      status: "queued",
      attempts: 0,
      max_attempts: 5,
      template_vars: {
        client_name: name || "Client",
        contract_name: contractName || "Contrat de service",
        contract_number: contractNumber || "",
        portal_path: "/portal/contrats",
      },
    });

    if (queueError) {
      console.error(`[${requestId}] Failed to queue email:`, queueError);
      throw new Error(`Failed to queue email: ${queueError.message}`);
    }

    console.log(`[${requestId}] Email queued successfully`);

    return new Response(JSON.stringify({ success: true, queued: true }), { 
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
