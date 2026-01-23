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
    const { email, name, type, channels, totalPrice, notes, ticketNumber } = await req.json();

    console.log(`[${requestId}] Queuing ${type} channel notification to ${email?.substring(0, 3)}***`);

    // Create unique event key for idempotency
    const eventKey = `channels_${type}_${ticketNumber || Date.now()}_${email}`;

    // Check if already queued/sent
    const { data: existingEmail } = await supabase
      .from("email_queue")
      .select("id")
      .eq("event_key", eventKey)
      .in("status", ["sent", "queued", "processing"])
      .maybeSingle();

    if (existingEmail) {
      console.log(`[${requestId}] Email already queued/sent for this channel update`);
      return new Response(JSON.stringify({ success: true, already_queued: true }), { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    // Build channels list
    const channelNames = (channels || []).map((ch: any) => ch.name).join(", ");

    // Determine template based on type
    const templateKey = type === "confirmed" ? "order_completed" : "order_cancelled";

    // Queue email for processing by process-email-queue
    const { error: queueError } = await supabase.from("email_queue").insert({
      event_key: eventKey,
      template_key: templateKey,
      to_email: email,
      status: "queued",
      attempts: 0,
      max_attempts: 5,
      template_vars: {
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

    if (queueError) {
      console.error(`[${requestId}] Failed to queue email:`, queueError);
      throw new Error(`Failed to queue email: ${queueError.message}`);
    }

    console.log(`[${requestId}] Email queued with template: ${templateKey}`);

    return new Response(JSON.stringify({ success: true, queued: true, template: templateKey }), { 
      status: 200, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error in send-channel-notification:`, error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } 
    });
  }
};

serve(handler);
