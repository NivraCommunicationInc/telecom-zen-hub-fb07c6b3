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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, pin } = await req.json();

    if (!email || !pin) {
      return new Response(
        JSON.stringify({ error: "Email and PIN are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "PIN must be exactly 6 digits", valid: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[client-pin-verify] Verifying PIN for email: ${email}`);

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
      console.error("[client-pin-verify] Error fetching PIN record:", fetchError);
      return new Response(
        JSON.stringify({ error: "Database error", valid: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pinRecords || pinRecords.length === 0) {
      console.log(`[client-pin-verify] No valid PIN found for ${email}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "No valid PIN found. Please request a new one." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pinRecord = pinRecords[0];

    // Check if too many attempts
    if (pinRecord.attempts >= 5) {
      console.log(`[client-pin-verify] Too many attempts for ${email}`);
      // Invalidate the PIN
      await supabase
        .from("client_login_pins")
        .update({ used: true })
        .eq("id", pinRecord.id);

      return new Response(
        JSON.stringify({ valid: false, reason: "Too many failed attempts. Please request a new PIN." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the provided PIN and compare
    const providedHash = await hashPin(pin);
    
    if (providedHash !== pinRecord.pin_hash) {
      console.log(`[client-pin-verify] Invalid PIN for ${email}, attempt ${pinRecord.attempts + 1}`);
      // Increment attempts
      await supabase
        .from("client_login_pins")
        .update({ attempts: pinRecord.attempts + 1 })
        .eq("id", pinRecord.id);

      const attemptsLeft = 5 - (pinRecord.attempts + 1);
      return new Response(
        JSON.stringify({ 
          valid: false,
          reason: `Invalid PIN. ${attemptsLeft} attempts remaining.`,
          attempts_left: attemptsLeft
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PIN is valid - mark as used
    console.log(`[client-pin-verify] PIN verified successfully for ${email}`);
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
      JSON.stringify({ valid: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[client-pin-verify] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage, valid: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
