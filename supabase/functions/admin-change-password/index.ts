import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit: 5 password changes per 15 min per IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = await checkRateLimit({ key: `change_pwd:${clientIp}`, ...RATE_LIMITS.LOGIN });
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders, "fr");
    }

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[admin-change-password] No authorization header");
      return new Response(
        JSON.stringify({ error: "Non autorisÃ©" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("[admin-change-password] User error:", userError);
      return new Response(
        JSON.stringify({ error: "Session invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("[admin-change-password] Not admin:", roleError);
      return new Response(
        JSON.stringify({ error: "AccÃ¨s rÃ©servÃ© aux administrateurs" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { currentPassword, newPassword }: ChangePasswordRequest = await req.json();

    // Validate new password requirements
    if (!newPassword || newPassword.length < 12) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins 12 caractÃ¨res" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/\d/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins un chiffre" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins un caractÃ¨re spÃ©cial" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await adminClient.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      console.error("[admin-change-password] Current password verification failed:", signInError.message);
      
      // Log failed attempt
      await adminClient.from("admin_audit_log").insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: "password_change_failed",
        details: { reason: "invalid_current_password" },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown",
        target_type: "user",
        target_id: user.id,
        target_email: user.email,
      });

      return new Response(
        JSON.stringify({ error: "Mot de passe actuel incorrect" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update password using admin client
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("[admin-change-password] Update failed:", updateError);
      
      await adminClient.from("admin_audit_log").insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: "password_change_error",
        details: { error: updateError.message },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown",
        target_type: "user",
        target_id: user.id,
        target_email: user.email,
      });

      return new Response(
        JSON.stringify({ error: "Erreur lors du changement de mot de passe" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await adminClient.from("admin_audit_log").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: "password_changed",
      details: { success: true },
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown",
      target_type: "user",
      target_id: user.id,
      target_email: user.email,
    });

    console.log("[admin-change-password] Password changed successfully for:", user.email);

    return new Response(
      JSON.stringify({ success: true, message: "Mot de passe changÃ© avec succÃ¨s" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[admin-change-password] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur inattendue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
