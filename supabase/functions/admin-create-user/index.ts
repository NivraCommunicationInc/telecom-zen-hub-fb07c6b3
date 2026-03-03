import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

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
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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

    // Verify the caller has staff access (admin OR employee)
    const { data: allowedRoles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .in("role", ["admin", "employee"])
      .limit(1);

    if (roleError) {
      console.error("Role check error:", roleError);
    }

    let callerRole = allowedRoles?.[0]?.role ?? null;
    let hasStaffAccess = Array.isArray(allowedRoles) && allowedRoles.length > 0;

    // Fallback for projects using admin_users as staff source
    if (!hasStaffAccess) {
      const { data: activeAdminRows, error: adminAccessError } = await supabaseAdmin
        .from("admin_users")
        .select("id")
        .eq("user_id", callingUser.id)
        .eq("is_active", true)
        .limit(1);

      if (adminAccessError) {
        console.error("admin_users fallback check error:", adminAccessError);
      }

      if (Array.isArray(activeAdminRows) && activeAdminRows.length > 0) {
        hasStaffAccess = true;
        callerRole = "admin";
      }
    }

    if (!hasStaffAccess) {
      console.error("User is not authorized staff:", callingUser.email);
      return new Response(
        JSON.stringify({ error: "Accès refusé - rôle staff requis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Staff ${callingUser.email} creating new user (role: ${callerRole})`);

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

    // Generate cryptographically secure password
    const generateSecurePassword = (length = 16): string => {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < length; i++) {
        password += chars[array[i] % chars.length];
      }
      return password;
    };

    const password = body.generate_password 
      ? generateSecurePassword(16)
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
      actor_role: callerRole || "admin",
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
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: "Erreur serveur inattendue" }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
