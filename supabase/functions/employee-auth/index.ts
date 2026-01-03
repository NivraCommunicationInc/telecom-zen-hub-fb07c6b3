import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Simple JWT-like token signing (HMAC-SHA256)
async function signToken(payload: object, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + 8 * 60 * 60 }; // 8 hour expiry
  
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(tokenPayload)).replace(/=/g, '');
  const data = `${headerB64}.${payloadB64}`;
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${data}.${signatureB64}`;
}


const PIN_SALT = "nivra_employee_salt_2025";

// Simple hash function for PIN verification
async function hashPin(pin: string, salt = ""): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { email, pin } = await req.json();
    
    if (!email || !pin) {
      console.log("[employee-auth] Missing email or PIN");
      return new Response(
        JSON.stringify({ ok: false, step: "validate_input", reason: "Email et code PIN requis" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[employee-auth] Login attempt for: ${normalizedEmail}`);

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Find profile by email (normalized)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.error("[employee-auth] Profile lookup error:", profileError);
      return new Response(
        JSON.stringify({ ok: false, step: "profile_lookup", reason: "Erreur de connexion" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile) {
      console.log("[employee-auth] No profile found for email:", normalizedEmail);
      return new Response(
        JSON.stringify({ ok: false, step: "profile_not_found", reason: "Aucun compte trouvé pour ce courriel" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check user_roles for employee role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, is_active")
      .eq("user_id", profile.user_id)
      .eq("role", "employee")
      .maybeSingle();

    if (roleError) {
      console.error("[employee-auth] Role lookup error:", roleError);
      return new Response(
        JSON.stringify({ ok: false, step: "role_lookup", reason: "Erreur de vérification du rôle" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roleData) {
      console.log("[employee-auth] No employee role for user:", profile.user_id);
      return new Response(
        JSON.stringify({ ok: false, step: "wrong_role", reason: "Ce compte n'est pas un compte employé. Utilisez le portail approprié." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (roleData.is_active === false) {
      console.log("[employee-auth] Employee role is disabled for user:", profile.user_id);
      return new Response(
        JSON.stringify({ ok: false, step: "role_disabled", reason: "Accès employé désactivé. Contactez l'administrateur." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Find employee record by email for PIN and lockout info
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (empError) {
      console.error("[employee-auth] Employee lookup error:", empError);
      return new Response(
        JSON.stringify({ ok: false, step: "employee_lookup", reason: "Erreur de connexion" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!employee) {
      console.log("[employee-auth] No employee record for email:", normalizedEmail);
      return new Response(
        JSON.stringify({ ok: false, step: "employee_not_found", reason: "Profil employé non configuré. Contactez l'administrateur." }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check lockout
    if (employee.lockout_until) {
      const lockoutEnd = new Date(employee.lockout_until);
      if (lockoutEnd > new Date()) {
        const minutesRemaining = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
        console.log("[employee-auth] Account locked for:", minutesRemaining, "minutes");
        return new Response(
          JSON.stringify({ ok: false, step: "account_locked", reason: `Compte temporairement verrouillé. Réessayez dans ${minutesRemaining} minute(s).` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if employee is active
    if (!employee.is_active) {
      console.log("[employee-auth] Employee account inactive");
      return new Response(
        JSON.stringify({ ok: false, step: "employee_disabled", reason: "Accès bloqué: compte désactivé. Contactez l'administrateur." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify PIN against hash
    const inputPinHash = await hashPin(pin, PIN_SALT);
    const legacyInputPinHash = await hashPin(pin);

    if (employee.pin_hash !== inputPinHash && employee.pin_hash !== legacyInputPinHash) {
      const newAttempts = (employee.failed_login_attempts || 0) + 1;
      const MAX_ATTEMPTS = 5;
      const LOCKOUT_MINUTES = 15;

      const updates: { failed_login_attempts: number; lockout_until?: string } = {
        failed_login_attempts: newAttempts,
      };

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutTime = new Date();
        lockoutTime.setMinutes(lockoutTime.getMinutes() + LOCKOUT_MINUTES);
        updates.lockout_until = lockoutTime.toISOString();

        await supabase.from("employees").update(updates).eq("id", employee.id);

        console.log("[employee-auth] Account locked after", MAX_ATTEMPTS, "attempts");
        return new Response(
          JSON.stringify({ ok: false, step: "pin_lockout", reason: `Trop de tentatives. Compte verrouillé pour ${LOCKOUT_MINUTES} minutes.` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from("employees").update(updates).eq("id", employee.id);

      const remaining = MAX_ATTEMPTS - newAttempts;
      console.log("[employee-auth] Invalid PIN. Remaining attempts:", remaining);
      return new Response(
        JSON.stringify({ ok: false, step: "pin_invalid", reason: `Code PIN invalide. ${remaining} tentative(s) restante(s).` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - reset failed attempts
    await supabase.from("employees").update({ 
      failed_login_attempts: 0, 
      lockout_until: null 
    }).eq("id", employee.id);

    // Update last_login_at in user_roles
    await supabase.from("user_roles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("user_id", profile.user_id)
      .eq("role", "employee");

    // Log the login
    await supabase.from("employee_audit_logs").insert({
      actor_role: "employee",
      actor_id: employee.id,
      actor_email: employee.email,
      actor_name: employee.full_name,
      action: "LOGIN",
      target_employee_id: employee.id,
      target_employee_email: employee.email,
      details_json: { ip: req.headers.get("x-forwarded-for") || "unknown" },
    });

    // Sign session token
    const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sessionToken = await signToken({
      employeeId: employee.id,
      userId: profile.user_id,
      email: employee.email,
      fullName: employee.full_name,
      role: "employee",
      permissions: employee.permissions_json,
    }, tokenSecret);

    console.log("[employee-auth] Login successful for:", employee.full_name);

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        token: sessionToken,
        employee: {
          id: employee.id,
          user_id: profile.user_id,
          email: employee.email,
          full_name: employee.full_name,
          phone: employee.phone,
          permissions: employee.permissions_json,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[employee-auth] Unexpected error:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ ok: false, step: "unexpected_error", reason: "Erreur inattendue. Veuillez réessayer." }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});