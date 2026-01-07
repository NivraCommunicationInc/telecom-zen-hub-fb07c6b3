import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestBody {
  user_id: string;
  code: string;
}

// Same hash function as send
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode("nivra_otp_salt_2026" + otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: RequestBody = await req.json();
    const { user_id, code } = body;

    if (!user_id || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ success: false, error: "Code invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the submitted code
    const codeHash = await hashOTP(code);

    // Find valid OTP for this user
    const { data: otpData, error: otpError } = await supabase
      .from("staff_otp_codes")
      .select("*")
      .eq("user_id", user_id)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("OTP lookup error:", otpError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur de vérification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpData) {
      return new Response(
        JSON.stringify({ success: false, error: "Code expiré ou invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check attempts
    if (otpData.attempts >= 5) {
      // Mark as used to prevent further attempts
      await supabase
        .from("staff_otp_codes")
        .update({ used: true })
        .eq("id", otpData.id);

      return new Response(
        JSON.stringify({ success: false, error: "Trop de tentatives. Demandez un nouveau code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment attempts
    await supabase
      .from("staff_otp_codes")
      .update({ attempts: otpData.attempts + 1 })
      .eq("id", otpData.id);

    // Verify code hash
    if (otpData.code_hash !== codeHash) {
      const remainingAttempts = 5 - (otpData.attempts + 1);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Code incorrect. ${remainingAttempts} tentative(s) restante(s).`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Code is valid - mark as used
    await supabase
      .from("staff_otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    // Update user_roles with otp_verified_at
    const { error: updateError } = await supabase
      .from("user_roles")
      .update({ otp_verified_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .in("role", ["admin", "employee"]);

    if (updateError) {
      console.error("Failed to update otp_verified_at:", updateError);
    }

    // Log successful verification
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(user_id);
      
      await supabase.from("admin_audit_log").insert({
        admin_user_id: user_id,
        admin_email: user?.email,
        action: "2fa_verified",
        target_type: "user",
        target_id: user_id,
        details: { method: "otp_email" },
      });
    } catch (logErr) {
      console.error("Failed to log 2FA verification:", logErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Vérification réussie" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in staff-otp-verify:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
