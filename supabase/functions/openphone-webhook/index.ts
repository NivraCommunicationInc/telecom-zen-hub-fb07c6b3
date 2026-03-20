import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-openphone-signature",
};

// OpenPhone webhook events we care about
type OpenPhoneEvent = {
  type: string;
  data: {
    object: {
      id: string;
      createdAt: string;
      direction: "incoming" | "outgoing";
      from: string;
      to: string[];
      body?: string; // For SMS
      content?: string; // Alternative for SMS
      status?: string;
      phoneNumberId?: string;
      userId?: string;
      duration?: number; // For calls
      answeredAt?: string;
      completedAt?: string;
    };
  };
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the webhook payload
    const payload: OpenPhoneEvent = await req.json();
    console.log("OpenPhone webhook received:", JSON.stringify(payload, null, 2));

    const eventType = payload.type;
    const data = payload.data?.object;

    if (!data) {
      console.log("No data in webhook payload");
      return new Response(
        JSON.stringify({ success: true, message: "No data to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle message events (incoming SMS)
    if (eventType === "message.received" || eventType === "message.created") {
      const isIncoming = data.direction === "incoming";
      const phoneNumber = isIncoming ? data.from : (data.to?.[0] || data.from);
      const messageContent = data.body || data.content || "";

      // Check if we already have this message logged
      const { data: existing } = await supabase
        .from("telephony_logs")
        .select("id")
        .eq("openphone_message_id", data.id)
        .maybeSingle();

      if (existing) {
        console.log("Message already logged:", data.id);
        return new Response(
          JSON.stringify({ success: true, message: "Already processed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try to find the client by phone number
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phoneNumber)
        .maybeSingle();

      // Insert the message log
      const { error: insertError } = await supabase.from("telephony_logs").insert({
        client_id: profile?.id || null,
        phone_number: phoneNumber,
        action: "sms",
        direction: isIncoming ? "inbound" : "outbound",
        openphone_message_id: data.id,
        message_preview: messageContent.substring(0, 500),
        status: data.status || (isIncoming ? "received" : "sent"),
        raw_payload: payload,
        created_at: data.createdAt || new Date().toISOString(),
      });

      if (insertError) {
        console.error("Failed to insert message log:", insertError);
      } else {
        console.log("Message logged successfully:", data.id, isIncoming ? "incoming" : "outgoing");
      }
    }

    // Handle call events
    if (eventType === "call.completed" || eventType === "call.ringing" || eventType === "call.recording.completed") {
      const isIncoming = data.direction === "incoming";
      const phoneNumber = isIncoming ? data.from : (data.to?.[0] || data.from);

      // Check if we already have this call logged
      const { data: existing } = await supabase
        .from("telephony_logs")
        .select("id")
        .eq("openphone_call_id", data.id)
        .maybeSingle();

      if (existing) {
        // Update the existing call log
        await supabase
          .from("telephony_logs")
          .update({
            status: data.status || "completed",
            duration_seconds: data.duration || null,
            raw_payload: payload,
          })
          .eq("openphone_call_id", data.id);
          
        console.log("Call updated:", data.id);
      } else {
        // Try to find the client by phone number
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", phoneNumber)
          .maybeSingle();

        // Insert new call log
        const { error: insertError } = await supabase.from("telephony_logs").insert({
          client_id: profile?.id || null,
          phone_number: phoneNumber,
          action: "call",
          direction: isIncoming ? "inbound" : "outbound",
          openphone_call_id: data.id,
          status: data.status || "ringing",
          duration_seconds: data.duration || null,
          raw_payload: payload,
          created_at: data.createdAt || new Date().toISOString(),
        });

        if (insertError) {
          console.error("Failed to insert call log:", insertError);
        } else {
          console.log("Call logged successfully:", data.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
