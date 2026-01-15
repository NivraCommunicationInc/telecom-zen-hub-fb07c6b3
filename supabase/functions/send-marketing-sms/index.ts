import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  phone: string;
  name: string | null;
  client_id: string | null;
}

interface SendRequest {
  message: string;
  recipients: Recipient[];
}

// Normalize phone number to E.164 format (+1XXXXXXXXXX for North America)
function normalizePhoneToE164(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // Skip invalid numbers
  if (digits.length < 10) return null;
  
  // If already has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  
  // If 10 digits, assume North American number
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If more than 11 digits, might already include + or country code
  if (digits.length > 11) {
    return `+${digits}`;
  }
  
  return null;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[SMS-MARKETING-${requestId}] Starting marketing SMS send`);

  try {
    const OPENPHONE_API_KEY = Deno.env.get("OPENPHONE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENPHONE_API_KEY) {
      console.error(`[SMS-MARKETING-${requestId}] OpenPhone API key not configured`);
      return new Response(
        JSON.stringify({ success: false, error: "OpenPhone non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Supabase non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get auth user for logging
    const authHeader = req.headers.get("Authorization");
    let senderEmail: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      senderEmail = user?.email || null;
    }

    // Parse request
    const body: SendRequest = await req.json();
    const { message, recipients } = body;

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Le message est requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Au moins un destinataire est requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SMS-MARKETING-${requestId}] Sending to ${recipients.length} recipients`);

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabase
      .from("sms_campaigns")
      .insert({
        message: message.trim(),
        recipients_count: recipients.length,
        sent_count: 0,
        failed_count: 0,
        status: "sending",
        sent_by_email: senderEmail,
      })
      .select()
      .single();

    if (campaignError) {
      console.error(`[SMS-MARKETING-${requestId}] Failed to create campaign:`, campaignError);
      // Continue anyway, just won't have history
    }

    // Get OpenPhone phone numbers
    const phoneNumbersRes = await fetch("https://api.openphone.com/v1/phone-numbers", {
      headers: {
        "Authorization": OPENPHONE_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!phoneNumbersRes.ok) {
      const errText = await phoneNumbersRes.text();
      console.error(`[SMS-MARKETING-${requestId}] Failed to get OpenPhone numbers:`, errText);
      return new Response(
        JSON.stringify({ success: false, error: "Impossible de récupérer les numéros OpenPhone" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneNumbersData = await phoneNumbersRes.json();
    const phoneNumbers = phoneNumbersData.data || [];

    if (phoneNumbers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Aucun numéro OpenPhone disponible" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromPhoneNumberId = phoneNumbers[0].id;

    // Send SMS to each recipient individually
    let sentCount = 0;
    let failedCount = 0;
    const results: Array<{ phone: string; success: boolean; error?: string }> = [];

    for (const recipient of recipients) {
      try {
        // Normalize phone number to E.164 format
        const normalizedPhone = normalizePhoneToE164(recipient.phone);
        
        if (!normalizedPhone) {
          console.error(`[SMS-MARKETING-${requestId}] Invalid phone format: ${recipient.phone}`);
          failedCount++;
          results.push({ phone: recipient.phone, success: false, error: "Format de numéro invalide" });
          continue;
        }

        console.log(`[SMS-MARKETING-${requestId}] Sending to ${normalizedPhone} (original: ${recipient.phone})`);

        const smsRes = await fetch("https://api.openphone.com/v1/messages", {
          method: "POST",
          headers: {
            "Authorization": OPENPHONE_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromPhoneNumberId,
            to: [normalizedPhone],
            content: message.trim(),
          }),
        });

        if (!smsRes.ok) {
          const errText = await smsRes.text();
          console.error(`[SMS-MARKETING-${requestId}] Failed to send to ${normalizedPhone}:`, errText);
          failedCount++;
          results.push({ phone: recipient.phone, success: false, error: errText });
        } else {
          const smsData = await smsRes.json();
          const messageId = smsData.data?.id;

          // Log to telephony_logs with normalized phone
          await supabase.from("telephony_logs").insert({
            client_id: recipient.client_id || null,
            phone_number: normalizedPhone,
            action: "sms",
            direction: "outbound",
            agent_user_id: null,
            agent_name: senderEmail || "Marketing SMS",
            openphone_message_id: messageId || null,
            message_preview: message.substring(0, 100),
            status: "sent",
          });

          sentCount++;
          results.push({ phone: recipient.phone, success: true });
        }

        // Rate limit: 100ms between sends
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[SMS-MARKETING-${requestId}] Error sending to ${recipient.phone}:`, error);
        failedCount++;
        results.push({ phone: recipient.phone, success: false, error: (error as Error).message });
      }
    }

    // Update campaign record
    if (campaign) {
      await supabase
        .from("sms_campaigns")
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
          status: failedCount === recipients.length ? "failed" : "completed",
        })
        .eq("id", campaign.id);
    }

    console.log(`[SMS-MARKETING-${requestId}] Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: recipients.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[SMS-MARKETING-${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
