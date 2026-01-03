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

const PIN_SALT = "nivra_technician_salt_2025";

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
    const { email, accessCode } = await req.json();
    
    if (!email || !accessCode) {
      console.log("[technician-auth] Missing email or accessCode");
      return new Response(
        JSON.stringify({ ok: false, step: "validate_input", reason: "Email et code d'accès requis" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[technician-auth] Login attempt for: ${normalizedEmail}`);

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
      console.error("[technician-auth] Profile lookup error:", profileError);
      return new Response(
        JSON.stringify({ ok: false, step: "profile_lookup", reason: "Erreur de connexion" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile) {
      console.log("[technician-auth] No profile found for email:", normalizedEmail);
      return new Response(
        JSON.stringify({ ok: false, step: "profile_not_found", reason: "Aucun compte trouvé pour ce courriel" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check user_roles for technician role and status
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, is_active, status")
      .eq("user_id", profile.user_id)
      .eq("role", "technician")
      .maybeSingle();

    if (roleError) {
      console.error("[technician-auth] Role lookup error:", roleError);
      return new Response(
        JSON.stringify({ ok: false, step: "role_lookup", reason: "Erreur de vérification du rôle" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roleData) {
      console.log("[technician-auth] No technician role for user:", profile.user_id);
      return new Response(
        JSON.stringify({ ok: false, step: "wrong_role", reason: "Ce compte n'est pas un compte technicien. Utilisez le portail approprié." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check status field (new system)
    const userStatus = roleData.status || "active";
    if (userStatus !== "active") {
      const statusMessages: Record<string, string> = {
        disabled: "Votre compte technicien est désactivé. Contactez l'administrateur.",
        hold: "Votre compte technicien est en attente. Contactez l'administrateur.",
      };
      console.log("[technician-auth] Technician status is not active:", userStatus);
      return new Response(
        JSON.stringify({ ok: false, step: "status_not_active", reason: statusMessages[userStatus] || "Accès refusé.", status: userStatus }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Legacy: check is_active (backwards compatibility)
    if (roleData.is_active === false) {
      console.log("[technician-auth] Technician role is disabled for user:", profile.user_id);
      return new Response(
        JSON.stringify({ ok: false, step: "role_disabled", reason: "Accès technicien désactivé. Contactez l'administrateur." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Find technician record by email for access code and lockout info
    const { data: technician, error: techError } = await supabase
      .from("technicians")
      .select("id, full_name, email, status, user_id, access_code, pin_hash, failed_login_attempts, lockout_until, specializations, phone")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (techError) {
      console.error("[technician-auth] Technician lookup error:", techError);
      return new Response(
        JSON.stringify({ ok: false, step: "technician_lookup", reason: "Erreur de connexion" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!technician) {
      console.log("[technician-auth] No technician record for email:", normalizedEmail);
      return new Response(
        JSON.stringify({ ok: false, step: "technician_not_found", reason: "Profil technicien non configuré. Contactez l'administrateur." }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check lockout
    if (technician.lockout_until) {
      const lockoutEnd = new Date(technician.lockout_until);
      if (lockoutEnd > new Date()) {
        const minutesRemaining = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
        console.log("[technician-auth] Account locked for:", minutesRemaining, "minutes");
        return new Response(
          JSON.stringify({ ok: false, step: "account_locked", reason: `Compte temporairement verrouillé. Réessayez dans ${minutesRemaining} minute(s).` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if technician is active
    if (technician.status !== "active") {
      console.log("[technician-auth] Technician account inactive:", technician.status);
      return new Response(
        JSON.stringify({ ok: false, step: "technician_disabled", reason: "Accès bloqué: compte désactivé." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify access code - support both plaintext (legacy) and hashed
    let codeValid = false;
    
    // Check if using hashed PIN
    if (technician.pin_hash) {
      const inputPinHash = await hashPin(accessCode, PIN_SALT);
      const legacyInputPinHash = await hashPin(accessCode);
      codeValid = technician.pin_hash === inputPinHash || technician.pin_hash === legacyInputPinHash;
    } else if (technician.access_code) {
      // Legacy: plaintext access_code comparison
      codeValid = technician.access_code === accessCode;
    }

    if (!codeValid) {
      const newAttempts = (technician.failed_login_attempts || 0) + 1;
      const MAX_ATTEMPTS = 5;
      const LOCKOUT_MINUTES = 15;

      const updates: { failed_login_attempts: number; lockout_until?: string } = {
        failed_login_attempts: newAttempts,
      };

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutTime = new Date();
        lockoutTime.setMinutes(lockoutTime.getMinutes() + LOCKOUT_MINUTES);
        updates.lockout_until = lockoutTime.toISOString();
        
        await supabase.from("technicians").update(updates).eq("id", technician.id);
        
        console.log("[technician-auth] Account locked after", MAX_ATTEMPTS, "attempts");
        return new Response(
          JSON.stringify({ ok: false, step: "code_lockout", reason: `Trop de tentatives. Compte verrouillé pour ${LOCKOUT_MINUTES} minutes.` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from("technicians").update(updates).eq("id", technician.id);
      
      const remaining = MAX_ATTEMPTS - newAttempts;
      console.log("[technician-auth] Invalid access code. Remaining attempts:", remaining);
      return new Response(
        JSON.stringify({ ok: false, step: "code_invalid", reason: `Code d'accès invalide. ${remaining} tentative(s) restante(s).` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - reset failed attempts
    await supabase.from("technicians").update({ 
      failed_login_attempts: 0, 
      lockout_until: null 
    }).eq("id", technician.id);

    // Update last_login_at in user_roles
    await supabase.from("user_roles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("user_id", profile.user_id)
      .eq("role", "technician");

    // Sign session token
    const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sessionToken = await signToken({
      technicianId: technician.id,
      userId: profile.user_id,
      email: technician.email,
      fullName: technician.full_name,
      role: "technician",
    }, tokenSecret);

    console.log("[technician-auth] Login successful for:", technician.full_name);

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        token: sessionToken,
        technician: {
          id: technician.id,
          user_id: profile.user_id,
          email: technician.email,
          full_name: technician.full_name,
          phone: technician.phone,
          specializations: technician.specializations,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[technician-auth] Unexpected error:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ ok: false, step: "unexpected_error", reason: "Erreur inattendue. Veuillez réessayer." }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});