import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user is an admin
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Check if user is admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .eq("status", "active")
      .maybeSingle();

    if (roleError || !roleData) {
      console.log("[toggle-lockdown] User is not admin:", userId);
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { enabled, message_fr, message_en } = await req.json();

    // Get current lockdown status
    const { data: currentData } = await supabaseAdmin
      .from("site_settings")
      .select("value_json")
      .eq("key", "total_lockdown")
      .maybeSingle();

    const currentConfig = currentData?.value_json || {};

    // Update lockdown status
    const nextEnabled = enabled ?? !currentConfig.enabled;

    // IMPORTANT: This config must be readable publicly so the LockdownGuard can block the site.
    // Do NOT expose admin user ids publicly.
    const newConfig = {
      ...currentConfig,
      enabled: nextEnabled,
      activated_at: nextEnabled ? new Date().toISOString() : null,
      activated_by: null,
      message_fr: message_fr || currentConfig.message_fr || "Site temporairement verrouillé.",
      message_en: message_en || currentConfig.message_en || "Site temporarily locked.",
    };

    const { error: updateError } = await supabaseAdmin
      .from("site_settings")
      .upsert({ 
        key: "total_lockdown", 
        value_json: newConfig,
        is_public: true 
      }, { onConflict: "key" });

    if (updateError) {
      console.error("[toggle-lockdown] Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update lockdown status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_user_id: userId,
      action: newConfig.enabled ? "lockdown_activated" : "lockdown_deactivated",
      target_type: "security",
      details: { lockdown_config: newConfig },
    });

    console.log(`[toggle-lockdown] Lockdown ${newConfig.enabled ? "ACTIVATED" : "DEACTIVATED"} by admin ${userId}`);

    return new Response(
      JSON.stringify({ success: true, lockdown: newConfig }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[toggle-lockdown] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
