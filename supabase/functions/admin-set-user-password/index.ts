import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SetPasswordRequest {
  action: "set_password" | "send_reset_link";
  target_user_id: string;
  password?: string;
  force_change?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[admin-set-user-password-${requestId}] started`);

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error(`[admin-set-user-password-${requestId}] No authorization header`);
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user (admin)
    const { data: { user: adminUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !adminUser) {
      console.error(`[admin-set-user-password-${requestId}] User error:`, userError);
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
      .eq("user_id", adminUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error(`[admin-set-user-password-${requestId}] Not admin:`, roleError);
      return new Response(
        JSON.stringify({ error: "Accès réservé aux administrateurs" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { action, target_user_id, password, force_change = true }: SetPasswordRequest = await req.json();

    console.log(`[admin-set-user-password-${requestId}] action=${action} target=${target_user_id}`);

    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: "ID utilisateur cible requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user info
    const { data: targetUserData, error: targetUserError } = await adminClient.auth.admin.getUserById(target_user_id);
    if (targetUserError || !targetUserData?.user) {
      console.error(`[admin-set-user-password-${requestId}] Target user not found:`, targetUserError);
      return new Response(
        JSON.stringify({ error: "Utilisateur introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUser = targetUserData.user;
    const targetEmail = targetUser.email;

    if (action === "set_password") {
      // Validate password
      if (!password || password.length < 8) {
        return new Response(
          JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!/\d/.test(password)) {
        return new Response(
          JSON.stringify({ error: "Le mot de passe doit contenir au moins un chiffre" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update password using admin API
      const { error: updateError } = await adminClient.auth.admin.updateUserById(target_user_id, {
        password: password,
      });

      if (updateError) {
        console.error(`[admin-set-user-password-${requestId}] Update failed:`, updateError);
        
        // Handle weak/pwned password error
        if (updateError.code === "weak_password" || updateError.message?.includes("weak")) {
          return new Response(
            JSON.stringify({ 
              error: "Ce mot de passe est trop commun ou a été compromis. Choisissez un mot de passe plus unique (évitez les mots courants comme 'Canada', 'Password', etc.)." 
            }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Erreur lors du changement de mot de passe" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If force_change is true, mark user to require password change
      if (force_change) {
        await adminClient
          .from("user_roles")
          .update({ require_password_change: true })
          .eq("user_id", target_user_id);
      }

      // Log audit
      await adminClient.from("admin_audit_log").insert({
        admin_user_id: adminUser.id,
        admin_email: adminUser.email,
        action: "set_user_password",
        details: { force_change, target_role: "field_sales" },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown",
        target_type: "user",
        target_id: target_user_id,
        target_email: targetEmail,
      });

      console.log(`[admin-set-user-password-${requestId}] Password set successfully for ${targetEmail}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Mot de passe défini avec succès",
          email: targetEmail 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "send_reset_link") {
      // Generate password reset link
      const { data: resetData, error: resetError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: targetEmail!,
        options: {
          redirectTo: `${Deno.env.get("APP_BASE_URL") || "https://nivra-telecom.ca"}/field-sales/reset-password`,
        },
      });

      if (resetError) {
        console.error(`[admin-set-user-password-${requestId}] Reset link generation failed:`, resetError);
        return new Response(
          JSON.stringify({ error: "Erreur lors de la génération du lien" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Queue email to be sent
      const resetLink = resetData.properties?.action_link;
      
      if (resetLink) {
        // Queue the password reset email
        await adminClient.from("email_queue").insert({
          to_email: targetEmail,
          to_name: targetUser.user_metadata?.full_name || targetEmail,
          subject: "Réinitialisation de votre mot de passe - Nivra Telecom",
          template_key: "password_reset_request",
          template_vars: {
            name: targetUser.user_metadata?.full_name || "Agent",
            resetLink: resetLink,
          },
          status: "queued",
          priority: "high",
        });

        console.log(`[admin-set-user-password-${requestId}] Reset email queued for ${targetEmail}`);
      }

      // Log audit
      await adminClient.from("admin_audit_log").insert({
        admin_user_id: adminUser.id,
        admin_email: adminUser.email,
        action: "send_password_reset_link",
        details: { email_queued: !!resetLink },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown",
        target_type: "user",
        target_id: target_user_id,
        target_email: targetEmail,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Lien de réinitialisation envoyé par courriel",
          email: targetEmail 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Action invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error(`[admin-set-user-password-${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: "Erreur inattendue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
