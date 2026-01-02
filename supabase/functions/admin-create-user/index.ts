import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password?: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  date_of_birth?: string;
  service_address?: string;
  service_city?: string;
  service_postal_code?: string;
  service_province?: string;
  generate_password?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get anon key for user verification
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Non autorisé - Aucun jeton fourni" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      console.error("Failed to get calling user:", userError);
      return new Response(
        JSON.stringify({ error: "Non autorisé - Session invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      console.error("User is not admin:", callingUser.email, roleData?.role);
      return new Response(
        JSON.stringify({ error: "Accès refusé - Rôle administrateur requis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${callingUser.email} creating new user`);

    // Parse request body
    const body: CreateUserRequest = await req.json();
    
    // Validate required fields
    if (!body.email || !body.full_name) {
      return new Response(
        JSON.stringify({ error: "Email et nom complet requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Generate or use provided password
    const password = body.generate_password 
      ? Math.random().toString(36).slice(-12) + "Aa1!"
      : body.password;

    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Mot de passe requis (minimum 8 caractères)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user with admin API (bypasses email confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: { full_name: body.full_name },
    });

    if (authError) {
      console.error("Failed to create auth user:", authError);
      
      // Check for duplicate email
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

    console.log(`User created: ${authData.user.id}`);

    // Update profile with additional info
    const profileUpdate: Record<string, any> = {
      phone: body.phone || null,
      first_name: body.first_name || null,
      last_name: body.last_name || null,
      full_name: body.full_name,
      date_of_birth: body.date_of_birth || null,
      service_address: body.service_address || null,
      service_city: body.service_city || null,
      service_postal_code: body.service_postal_code || null,
      service_province: body.service_province || "QC",
    };

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", authData.user.id);

    if (profileError) {
      console.error("Failed to update profile:", profileError);
      // Don't fail the request, user is created
    }

    // Log the activity
    await supabaseAdmin.from("activity_logs").insert({
      user_id: callingUser.id,
      entity_type: "client",
      entity_id: authData.user.id,
      action: "create",
      new_value: JSON.stringify({ 
        email: body.email, 
        full_name: body.full_name,
        created_via: "admin_edge_function"
      }),
      reason: "Nouveau client créé par admin (server-side)",
      actor_email: callingUser.email,
      actor_role: "admin",
    });

    console.log(`User creation completed successfully for ${body.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur inattendue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
