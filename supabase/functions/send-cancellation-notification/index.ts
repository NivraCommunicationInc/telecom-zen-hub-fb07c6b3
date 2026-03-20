import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Service type labels
const serviceTypeLabels: Record<string, string> = {
  mobile: "Mobile",
  internet: "Internet",
  tv: "Télévision",
  security: "Sécurité",
  streaming: "Streaming",
  bundle: "Forfait combiné",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const data: CancellationEmailData = await req.json();
    const serviceLabel = serviceTypeLabels[data.service_type] || data.service_type;

    console.log(`[${requestId}] Queuing ${data.template} to ${data.to_email?.substring(0, 3)}***`);

    // Create unique event key for idempotency
    const eventKey = `${data.template}_${data.request_number}_${data.to_email}`;

    // Check if already queued/sent
    const { data: existingEmail } = await supabase
      .from("email_queue")
      .select("id")
      .eq("event_key", eventKey)
      .in("status", ["sent", "queued", "processing"])
      .maybeSingle();

    if (existingEmail) {
      console.log(`[${requestId}] Email already queued/sent for this cancellation`);
      return new Response(JSON.stringify({ success: true, already_queued: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Queue email for processing by process-email-queue (template key matches the template name)
    const { error: queueError } = await supabase.from("email_queue").insert({
      event_key: eventKey,
      template_key: data.template,
      to_email: data.to_email,
      status: "queued",
      attempts: 0,
      max_attempts: 5,
      template_vars: {
        client_name: data.client_name || "Client",
        request_number: data.request_number,
        service_type: serviceLabel,
        effective_date: data.effective_date || "",
        decline_reason: data.decline_reason || "",
        public_message: data.public_message || "",
        portal_path: "/portal/cancellations",
      },
    });

    if (queueError) {
      console.error(`[${requestId}] Failed to queue email:`, queueError);
      throw new Error(`Failed to queue email: ${queueError.message}`);
    }

    console.log(`[${requestId}] Email queued with template: ${data.template}`);

    return new Response(JSON.stringify({ success: true, queued: true, template: data.template }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error in send-cancellation-notification:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
