import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface BootstrapRequest {
  email: string;
  password: string;
  full_name: string;
  bootstrap_token: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bootstrapToken = Deno.env.get("BOOTSTRAP_TOKEN");

    // Verify bootstrap token is configured
    if (!bootstrapToken) {
      console.error("BOOTSTRAP_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Bootstrap non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if any admin already exists
    const { data: existingAdmins, error: checkError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (checkError) {
      console.error("Error checking existing admins:", checkError);
      return new Response(
        JSON.stringify({ error: "Erreur de vérification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If admin already exists, disable bootstrap
    if (existingAdmins && existingAdmins.length > 0) {
      console.log("Bootstrap disabled - admin already exists");
      return new Response(
        JSON.stringify({ error: "Bootstrap désactivé - Un administrateur existe déjà", disabled: true }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: BootstrapRequest = await req.json();
    
    // Validate required fields
    if (!body.email || !body.password || !body.full_name || !body.bootstrap_token) {
      return new Response(
        JSON.stringify({ error: "Tous les champs sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify bootstrap token
    if (body.bootstrap_token !== bootstrapToken) {
      console.error("Invalid bootstrap token attempt");
      return new Response(
        JSON.stringify({ error: "Jeton bootstrap invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: "Format d'email invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password
    if (body.password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Bootstrap: Creating first admin user ${body.email}`);

    // Create the admin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });

    if (authError) {
      console.error("Failed to create admin user:", authError);
      
      if (authError.message?.includes("already registered") || authError.message?.includes("duplicate")) {
        return new Response(
          JSON.stringify({ error: "Un utilisateur avec cet email existe déjà" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: "Création utilisateur échouée" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin user created: ${authData.user.id}`);

    // Update user role to admin (the trigger creates with 'client' role by default)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", authData.user.id);

    if (roleError) {
      console.error("Failed to set admin role:", roleError);
      // Try to delete the user if role update fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: "Échec de l'attribution du rôle admin" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the bootstrap action
    await supabaseAdmin.from("activity_logs").insert({
      user_id: authData.user.id,
      entity_type: "admin",
      entity_id: authData.user.id,
      action: "bootstrap",
      new_value: JSON.stringify({ 
        email: body.email, 
        full_name: body.full_name,
        created_via: "admin_bootstrap"
      }),
      reason: "Premier administrateur créé via bootstrap",
      actor_email: body.email,
      actor_role: "system",
    });

    console.log(`Admin bootstrap completed successfully for ${body.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Administrateur créé avec succès",
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: "Erreur serveur inattendue" }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
