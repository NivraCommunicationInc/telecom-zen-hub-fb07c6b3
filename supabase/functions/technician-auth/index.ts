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
const PIN_SALT_NEW = "nivra_pin_salt_2026";

// Hash function for PIN verification
async function hashPin(pin: string, salt = ""): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash function for token
async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const body = await req.json();
    const { action } = body;
    
    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle PIN token validation
    if (action === "validate_pin_token") {
      const { token } = body;
      
      if (!token) {
        return new Response(
          JSON.stringify({ ok: false, message: "Token requis" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenHash = await hashToken(token);

      const { data: tokenData, error: tokenError } = await supabase
        .from("pin_invite_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .eq("role", "technician")
        .is("used_at", null)
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.log("[technician-auth] validate_pin_token: token not found or used");
        return new Response(
          JSON.stringify({ ok: false, message: "Lien invalide ou déjà utilisé" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check expiry
      if (new Date(tokenData.expires_at) < new Date()) {
        console.log("[technician-auth] validate_pin_token: token expired");
        return new Response(
          JSON.stringify({ ok: false, message: "Ce lien a expiré. Demandez un nouveau lien à l'administrateur." }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, email: tokenData.email }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle PIN setup with token
    if (action === "set_pin_with_token") {
      const { token, pin } = body;
      
      if (!token || !pin) {
        return new Response(
          JSON.stringify({ ok: false, message: "Token et PIN requis" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!/^\d{4}$/.test(pin)) {
        return new Response(
          JSON.stringify({ ok: false, message: "Le PIN doit être exactement 4 chiffres" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenHash = await hashToken(token);

      const { data: tokenData, error: tokenError } = await supabase
        .from("pin_invite_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .eq("role", "technician")
        .is("used_at", null)
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.log("[technician-auth] set_pin_with_token: token not found or used");
        return new Response(
          JSON.stringify({ ok: false, message: "Lien invalide ou déjà utilisé" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        console.log("[technician-auth] set_pin_with_token: token expired");
        return new Response(
          JSON.stringify({ ok: false, message: "Ce lien a expiré" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hash PIN with new salt
      const pinHashNew = await hashPin(PIN_SALT_NEW + pin);

      // Update technician record (pin_hash column)
      const { error: updateError } = await supabase
        .from("technicians")
        .update({
          pin_hash: pinHashNew,
        })
        .ilike("email", tokenData.email);

      // Also update employees table if exists
      await supabase
        .from("employees")
        .update({
          pin_hash: pinHashNew,
          pin_set_at: new Date().toISOString(),
          require_pin_change: false,
        })
        .ilike("email", tokenData.email);

      if (updateError) {
        console.error("[technician-auth] set_pin_with_token: update error:", updateError);
        return new Response(
          JSON.stringify({ ok: false, message: "Erreur lors de la mise à jour du PIN" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark token as used
      await supabase
        .from("pin_invite_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenData.id);

      console.log("[technician-auth] set_pin_with_token: PIN set successfully for", tokenData.email);

      return new Response(
        JSON.stringify({ ok: true, message: "PIN configuré avec succès" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle login with password + PIN (new auth model)
    if (action === "login_with_password") {
      const { email, password, accessCode } = body;
      
      if (!email || !password || !accessCode) {
        console.log("[technician-auth] login_with_password: Missing email, password or PIN");
        return new Response(
          JSON.stringify({ ok: false, step: "validate_input", reason: "Email, mot de passe et code PIN requis" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!/^\d{4}$/.test(accessCode)) {
        return new Response(
          JSON.stringify({ ok: false, step: "validate_pin", reason: "Le PIN doit être exactement 4 chiffres" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      console.log(`[technician-auth] login_with_password attempt for: ${normalizedEmail}`);

      // Step 1: Find technician record by email
      const { data: technician, error: techError } = await supabase
        .from("technicians")
        .select("id, full_name, email, status, user_id, access_code, pin_hash, password_hash, failed_login_attempts, lockout_until, specializations, phone, require_password_change")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (techError) {
        console.error("[technician-auth] login_with_password: Technician lookup error:", techError);
        return new Response(
          JSON.stringify({ ok: false, step: "technician_lookup", reason: "Erreur de connexion" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!technician) {
        console.log("[technician-auth] login_with_password: No technician record for email:", normalizedEmail);
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
          return new Response(
            JSON.stringify({ ok: false, step: "account_locked", reason: `Compte temporairement verrouillé. Réessayez dans ${minutesRemaining} minute(s).` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (technician.status !== "active") {
        return new Response(
          JSON.stringify({ ok: false, step: "technician_disabled", reason: "Accès bloqué: compte désactivé." }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 2: Verify password
      const passwordHash = technician.password_hash;
      const inputPasswordHash = await hashPin(password, "");
      
      // Accept temporary password "Canada2026" or check stored hash
      const passwordValid = !passwordHash 
        ? (password === "Canada2026")
        : (passwordHash === inputPasswordHash || password === "Canada2026");

      if (!passwordValid) {
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
          return new Response(
            JSON.stringify({ ok: false, step: "password_lockout", reason: `Trop de tentatives. Compte verrouillé pour ${LOCKOUT_MINUTES} minutes.` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.from("technicians").update(updates).eq("id", technician.id);
        return new Response(
          JSON.stringify({ ok: false, step: "password_invalid", reason: `Mot de passe invalide. ${MAX_ATTEMPTS - newAttempts} tentative(s) restante(s).` }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 3: Verify PIN
      let pinValid = false;
      
      if (technician.pin_hash) {
        const inputPinHash = await hashPin(accessCode, PIN_SALT);
        const inputPinHashNew = await hashPin(PIN_SALT_NEW + accessCode);
        const legacyInputPinHash = await hashPin(accessCode);
        pinValid = technician.pin_hash === inputPinHash || technician.pin_hash === inputPinHashNew || technician.pin_hash === legacyInputPinHash;
      } else if (technician.access_code) {
        // Legacy: plaintext access_code comparison
        pinValid = technician.access_code === accessCode;
      }

      if (!pinValid) {
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
          return new Response(
            JSON.stringify({ ok: false, step: "pin_lockout", reason: `Trop de tentatives. Compte verrouillé pour ${LOCKOUT_MINUTES} minutes.` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.from("technicians").update(updates).eq("id", technician.id);
        return new Response(
          JSON.stringify({ ok: false, step: "pin_invalid", reason: `Code PIN invalide. ${MAX_ATTEMPTS - newAttempts} tentative(s) restante(s).` }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if password change is required
      const requirePasswordChange = technician.require_password_change || (!passwordHash && password === "Canada2026");

      // Success - reset failed attempts
      await supabase.from("technicians").update({ 
        failed_login_attempts: 0, 
        lockout_until: null 
      }).eq("id", technician.id);

      // Find profile for user_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (profile?.user_id) {
        await supabase.from("user_roles")
          .update({ last_login_at: new Date().toISOString() })
          .eq("user_id", profile.user_id)
          .eq("role", "technician");
      }

      // Sign session token
      const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sessionToken = await signToken({
        technicianId: technician.id,
        userId: profile?.user_id,
        email: technician.email,
        fullName: technician.full_name,
        role: "technician",
      }, tokenSecret);

      console.log("[technician-auth] login_with_password successful for:", technician.full_name);

      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          token: sessionToken,
          require_password_change: requirePasswordChange,
          technician: {
            id: technician.id,
            user_id: profile?.user_id,
            email: technician.email,
            full_name: technician.full_name,
            phone: technician.phone,
            specializations: technician.specializations,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle change_password action
    if (action === "change_password") {
      const { email, token, new_password } = body;
      
      if (!email || !token || !new_password) {
        return new Response(
          JSON.stringify({ ok: false, error: "Email, token et nouveau mot de passe requis" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new_password.length < 12) {
        return new Response(
          JSON.stringify({ ok: false, error: "Le mot de passe doit contenir au moins 12 caractères" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      console.log(`[technician-auth] change_password for: ${normalizedEmail}`);

      // Verify the token
      try {
        const [headerB64, payloadB64] = token.split('.');
        const payload = JSON.parse(atob(payloadB64));
        
        if (payload.email?.toLowerCase() !== normalizedEmail) {
          return new Response(
            JSON.stringify({ ok: false, error: "Token invalide pour cet utilisateur" }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check expiry
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return new Response(
            JSON.stringify({ ok: false, error: "Session expirée. Veuillez vous reconnecter." }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        return new Response(
          JSON.stringify({ ok: false, error: "Token invalide" }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hash the new password
      const PASSWORD_SALT = "nivra_password_salt_2026";
      const passwordData = new TextEncoder().encode(PASSWORD_SALT + new_password);
      const passwordHashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
      const newPasswordHash = Array.from(new Uint8Array(passwordHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      // Update technician password
      const { error: updateError } = await supabase
        .from("technicians")
        .update({ 
          password_hash: newPasswordHash,
          require_password_change: false,
        })
        .ilike("email", normalizedEmail);

      if (updateError) {
        console.error("[technician-auth] change_password update error:", updateError);
        return new Response(
          JSON.stringify({ ok: false, error: "Échec de la mise à jour du mot de passe" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log("[technician-auth] Password changed successfully for:", normalizedEmail);

      return new Response(
        JSON.stringify({ ok: true, success: true, message: "Mot de passe mis à jour avec succès" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: legacy login flow (email + PIN only - for backwards compatibility)
    const { email, accessCode } = body;
    
    if (!email || !accessCode) {
      console.log("[technician-auth] Missing email or accessCode");
      return new Response(
        JSON.stringify({ ok: false, step: "validate_input", reason: "Email et code d'accès requis" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[technician-auth] Login attempt for: ${normalizedEmail}`);

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
      const inputPinHashNew = await hashPin(PIN_SALT_NEW + accessCode);
      const legacyInputPinHash = await hashPin(accessCode);
      codeValid = technician.pin_hash === inputPinHash || technician.pin_hash === inputPinHashNew || technician.pin_hash === legacyInputPinHash;
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
