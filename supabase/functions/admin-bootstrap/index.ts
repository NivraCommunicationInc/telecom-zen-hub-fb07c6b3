import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";
import { generateSalt, hashPbkdf2 } from "../_shared/pinHash.ts";

interface BootstrapRequest {
  action?: "bootstrap" | "recover";
  email: string;
  password: string;
  full_name?: string;
  pin?: string;
  bootstrap_token: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  console.log(`[admin-bootstrap] Request from origin: ${origin}, method: ${req.method}`);
  
  // Log environment check (without exposing values)
  const bootstrapTokenPresent = !!Deno.env.get("BOOTSTRAP_TOKEN");
  const allowedOriginsPresent = !!Deno.env.get("ALLOWED_ORIGINS");
  console.log(`[admin-bootstrap] BOOTSTRAP_TOKEN present: ${bootstrapTokenPresent}`);
  console.log(`[admin-bootstrap] ALLOWED_ORIGINS present: ${allowedOriginsPresent}`);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    console.log(`[admin-bootstrap] Returning preflight response`);
    return preflightResponse;
  }
  
  const corsHeaders = getCorsHeaders(origin);
  console.log(`[admin-bootstrap] CORS headers:`, JSON.stringify(corsHeaders));

  try {
    // Rate limit: 5 bootstrap attempts per 15 min per IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = await checkRateLimit({ key: `bootstrap:${clientIp}`, ...RATE_LIMITS.LOGIN });
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders, "fr");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bootstrapToken = Deno.env.get("BOOTSTRAP_TOKEN");

    // Verify bootstrap token is configured
    if (!bootstrapToken) {
      console.error("[admin-bootstrap] BOOTSTRAP_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Bootstrap non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse request body
    const body: BootstrapRequest = await req.json();
    const action = body.action || "bootstrap";

    // Verify bootstrap token first (applies to all actions)
    if (body.bootstrap_token !== bootstrapToken) {
      console.error("[admin-bootstrap] Invalid bootstrap token attempt");
      return new Response(
        JSON.stringify({ error: "Jeton bootstrap invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RECOVER ACTION - Reset existing admin credentials
    if (action === "recover") {
      console.log(`[admin-bootstrap] RECOVER action received`);
      
      if (!body.email || !body.password || !body.pin) {
        return new Response(
          JSON.stringify({ error: "email, password et pin requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate PIN format (8 digits)
      if (!/^\d{8}$/.test(body.pin)) {
        return new Response(
          JSON.stringify({ error: "Le PIN admin doit être exactement 8 chiffres" }),
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

      const normalizedEmail = body.email.trim().toLowerCase();

      // Find user by email
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (!profile?.user_id) {
        return new Response(
          JSON.stringify({ error: "Utilisateur admin non trouvé" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify admin role exists
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ error: "Ce compte n'est pas un compte administrateur" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update password via auth admin
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
        password: body.password,
      });

      if (passwordError) {
        console.error("[admin-bootstrap] Password update error:", passwordError);
        return new Response(
          JSON.stringify({ error: passwordError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update PIN hash (PBKDF2 + per-user salt) and enforce credential change after next login
      const pinSalt = generateSalt();
      const pinHash = await hashPbkdf2(body.pin, pinSalt);
      const { error: roleUpdateError } = await supabaseAdmin
        .from("user_roles")
        .update({
          admin_pin_hash: pinHash,
          admin_pin_salt: pinSalt,
          require_password_change: true,
          require_pin_change: true,
          status: "active",
        })
        .eq("user_id", profile.user_id)
        .eq("role", "admin");

      if (roleUpdateError) {
        console.error("[admin-bootstrap] Role update error:", roleUpdateError);
        return new Response(
          JSON.stringify({ error: roleUpdateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the recovery action
      await supabaseAdmin.from("admin_audit_log").insert({
        admin_user_id: profile.user_id,
        admin_email: normalizedEmail,
        action: "admin_recovered",
        details: { recovered_via: "bootstrap_token" },
        target_type: "security",
        target_id: profile.user_id,
        target_email: normalizedEmail,
      });

      console.log(`[admin-bootstrap] Admin recovered successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Compte admin récupéré avec succès",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // BOOTSTRAP ACTION - Create first admin (original behavior)
    console.log(`[admin-bootstrap] BOOTSTRAP action for email: ${body.email}`);

    // Check if any admin already exists
    const { data: existingAdmins, error: checkError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (checkError) {
      console.error("[admin-bootstrap] Error checking existing admins:", checkError);
      return new Response(
        JSON.stringify({ error: "Erreur de vérification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If admin already exists, disable bootstrap
    if (existingAdmins && existingAdmins.length > 0) {
      console.log("[admin-bootstrap] Bootstrap disabled - admin already exists");
      return new Response(
        JSON.stringify({ error: "Bootstrap non disponible" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate required fields
    if (!body.email || !body.password || !body.full_name) {
      console.error("[admin-bootstrap] Missing required fields");
      return new Response(
        JSON.stringify({ error: "Tous les champs sont requis" }),
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

    // Validate password
    if (body.password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-bootstrap] Creating first admin user ${body.email}`);

    // Create the admin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });

    if (authError) {
      console.error("[admin-bootstrap] Failed to create admin user:", authError);
      
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

    console.log(`[admin-bootstrap] Admin user created: ${authData.user.id}`);

    // Update user role to admin (the trigger creates with 'client' role by default)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", authData.user.id);

    if (roleError) {
      console.error("[admin-bootstrap] Failed to set admin role:", roleError);
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

    console.log(`[admin-bootstrap] Admin bootstrap completed successfully for ${body.email}`);

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
    console.error("[admin-bootstrap] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur inattendue" }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
