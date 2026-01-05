import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same hash function as in send - must match exactly
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")); // salt with service key
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generate unique request ID for logging
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Mask email for logging
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const maskedLocal = local.length > 2 ? local[0] + "***" + local[local.length - 1] : "***";
  return `${maskedLocal}@${domain}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  console.log(`[client-pin-verify][${requestId}] Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error(`[client-pin-verify][${requestId}] Invalid JSON body:`, parseErr);
      return new Response(
        JSON.stringify({ valid: false, reason: "invalid_request", error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, pin } = body;

    if (!email || !pin) {
      console.error(`[client-pin-verify][${requestId}] Missing email or pin`);
      return new Response(
        JSON.stringify({ valid: false, reason: "missing_params", error: "Email and PIN are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      console.log(`[client-pin-verify][${requestId}] Invalid PIN format`);
      return new Response(
        JSON.stringify({ valid: false, reason: "invalid_format", error: "PIN must be exactly 6 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maskedEmail = maskEmail(email);
    console.log(`[client-pin-verify][${requestId}] Verifying for: ${maskedEmail}`);

    // Fetch the latest non-expired, unused PIN record for this email
    const now = new Date().toISOString();
    const { data: pinRecords, error: fetchError } = await supabase
      .from("client_login_pins")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error(`[client-pin-verify][${requestId}] DB fetch error:`, fetchError);
      return new Response(
        JSON.stringify({ valid: false, reason: "db_error", error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pinRecords || pinRecords.length === 0) {
      console.log(`[client-pin-verify][${requestId}] No valid PIN found for: ${maskedEmail}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "no_valid_pin", error: "Aucun code valide trouvé. Veuillez demander un nouveau code." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pinRecord = pinRecords[0];

    // Check if too many attempts (max 5)
    if (pinRecord.attempts >= 5) {
      console.log(`[client-pin-verify][${requestId}] Too many attempts for: ${maskedEmail}`);
      // Invalidate the PIN
      await supabase
        .from("client_login_pins")
        .update({ used: true })
        .eq("id", pinRecord.id);

      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: "too_many_attempts", 
          error: "Trop de tentatives échouées. Veuillez demander un nouveau code." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the provided PIN and compare
    const providedHash = await hashPin(pin);
    
    if (providedHash !== pinRecord.pin_hash) {
      const newAttempts = pinRecord.attempts + 1;
      console.log(`[client-pin-verify][${requestId}] Invalid PIN, attempt ${newAttempts}`);
      
      // Increment attempts
      await supabase
        .from("client_login_pins")
        .update({ attempts: newAttempts })
        .eq("id", pinRecord.id);

      const attemptsLeft = 5 - newAttempts;
      return new Response(
        JSON.stringify({ 
          valid: false,
          reason: "invalid_pin",
          error: `Code invalide. ${attemptsLeft} tentative${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''}.`,
          attempts_left: attemptsLeft
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PIN is valid - mark as used
    console.log(`[client-pin-verify][${requestId}] SUCCESS - PIN verified for: ${maskedEmail}`);
    await supabase
      .from("client_login_pins")
      .update({ used: true })
      .eq("id", pinRecord.id);

    // Also clean up old expired PINs for this user (housekeeping)
    await supabase
      .from("client_login_pins")
      .delete()
      .eq("email", email.toLowerCase())
      .lt("expires_at", now);

    return new Response(
      JSON.stringify({ valid: true, request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[client-pin-verify][${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ valid: false, reason: "server_error", error: errorMessage, request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
