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

    // ========== PIN-ONLY LOGIN (Email + PIN) ==========
    if (action === "pin_login") {
      const { email, pin } = body;
      
      if (!email || !pin) {
        console.log("[technician-auth] pin_login: Missing email or PIN");
        return new Response(
          JSON.stringify({ ok: false, reason: "not_found", message: "Email et PIN requis" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!/^\d{4}$/.test(pin)) {
        return new Response(
          JSON.stringify({ ok: false, reason: "invalid_pin", message: "Le PIN doit être exactement 4 chiffres" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      console.log(`[technician-auth] pin_login attempt for: ${normalizedEmail}`);

      // Step 1: Find technician record by email (access_code is the PIN field for technicians)
      const { data: technician, error: techError } = await supabase
        .from("technicians")
        .select("id, full_name, email, status, user_id, access_code, password_hash, failed_login_attempts, lockout_until, specializations, phone")
        .ilike("email", normalizedEmail)
        .maybeSingle();
      
      console.log(`[technician-auth] pin_login: Found technician:`, technician ? { id: technician.id, has_access_code: !!technician.access_code } : "null");

      if (techError) {
        console.error("[technician-auth] pin_login: Technician lookup error:", techError);
        return new Response(
          JSON.stringify({ ok: false, reason: "not_found", message: "Erreur de connexion" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!technician) {
        console.log("[technician-auth] pin_login: No technician record for email:", normalizedEmail);
        
        // Log failed attempt
        await supabase.from("admin_audit_log").insert({
          action: "staff_pin_login_failed",
          admin_user_id: "00000000-0000-0000-0000-000000000000",
          admin_email: normalizedEmail,
          target_email: normalizedEmail,
          target_type: "technician",
          details: { reason: "not_found", ip: req.headers.get("x-forwarded-for") || "unknown" },
        });
        
        return new Response(
          JSON.stringify({ ok: false, reason: "not_found", message: "Aucun compte technicien trouvé." }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check lockout
      if (technician.lockout_until) {
        const lockoutEnd = new Date(technician.lockout_until);
        if (lockoutEnd > new Date()) {
          const minutesRemaining = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
          return new Response(
            JSON.stringify({ ok: false, reason: "account_locked", message: `Compte verrouillé. Réessayez dans ${minutesRemaining} minute(s).` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check if technician is active
      if (technician.status !== "active") {
        await supabase.from("admin_audit_log").insert({
          action: "staff_pin_login_failed",
          admin_user_id: technician.id,
          admin_email: technician.email,
          target_email: technician.email,
          target_type: "technician",
          details: { reason: "status_disabled", ip: req.headers.get("x-forwarded-for") || "unknown" },
        });
        
        return new Response(
          JSON.stringify({ ok: false, reason: "status_disabled", message: "Compte désactivé." }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check user_roles status
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (profile?.user_id) {
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("status")
          .eq("user_id", profile.user_id)
          .eq("role", "technician")
          .maybeSingle();

        if (userRole?.status === "hold") {
          await supabase.from("admin_audit_log").insert({
            action: "staff_pin_login_failed",
            admin_user_id: technician.id,
            admin_email: technician.email,
            target_email: technician.email,
            target_type: "technician",
            details: { reason: "status_hold", ip: req.headers.get("x-forwarded-for") || "unknown" },
          });
          
          return new Response(
            JSON.stringify({ ok: false, reason: "status_hold", message: "Compte suspendu." }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (userRole?.status === "disabled") {
          await supabase.from("admin_audit_log").insert({
            action: "staff_pin_login_failed",
            admin_user_id: technician.id,
            admin_email: technician.email,
            target_email: technician.email,
            target_type: "technician",
            details: { reason: "status_disabled", ip: req.headers.get("x-forwarded-for") || "unknown" },
          });
          
          return new Response(
            JSON.stringify({ ok: false, reason: "status_disabled", message: "Compte désactivé." }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check if PIN is set (access_code is the PIN field for technicians)
      if (!technician.access_code) {
        await supabase.from("admin_audit_log").insert({
          action: "staff_pin_login_failed",
          admin_user_id: technician.id,
          admin_email: technician.email,
          target_email: technician.email,
          target_type: "technician",
          details: { reason: "pin_not_set", ip: req.headers.get("x-forwarded-for") || "unknown" },
        });
        
        return new Response(
          JSON.stringify({ ok: false, reason: "pin_not_set", message: "PIN non configuré. Contactez l'administrateur." }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify PIN - access_code stores the plaintext PIN for technicians
      // Compare directly (for simplicity and compatibility with existing data)
      const pinValid = technician.access_code === pin;
      console.log(`[technician-auth] pin_login: PIN validation result:`, pinValid);

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
          
          await supabase.from("admin_audit_log").insert({
            action: "staff_pin_login_failed",
            admin_user_id: technician.id,
            admin_email: technician.email,
            target_email: technician.email,
            target_type: "technician",
            details: { reason: "account_locked", attempts: newAttempts, ip: req.headers.get("x-forwarded-for") || "unknown" },
          });
          
          return new Response(
            JSON.stringify({ ok: false, reason: "account_locked", message: `Trop de tentatives. Compte verrouillé pour ${LOCKOUT_MINUTES} minutes.` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.from("technicians").update(updates).eq("id", technician.id);
        
        await supabase.from("admin_audit_log").insert({
          action: "staff_pin_login_failed",
          admin_user_id: technician.id,
          admin_email: technician.email,
          target_email: technician.email,
          target_type: "technician",
          details: { reason: "invalid_pin", attempts: newAttempts, ip: req.headers.get("x-forwarded-for") || "unknown" },
        });
        
        return new Response(
          JSON.stringify({ ok: false, reason: "invalid_pin", message: `PIN invalide. ${MAX_ATTEMPTS - newAttempts} tentative(s) restante(s).` }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Success - reset failed attempts
      await supabase.from("technicians").update({ 
        failed_login_attempts: 0, 
        lockout_until: null 
      }).eq("id", technician.id);

      // Get permissions from user_roles table (SINGLE SOURCE OF TRUTH)
      let resolvedPermissions: Record<string, boolean> = {};
      if (profile?.user_id) {
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("permissions, status")
          .eq("user_id", profile.user_id)
          .maybeSingle();
        
        if (userRole?.permissions && typeof userRole.permissions === 'object') {
          // Normalize permissions: add both view_* and can_view_* formats
          const rawPerms = userRole.permissions as Record<string, boolean>;
          for (const [key, value] of Object.entries(rawPerms)) {
            if (value === true) {
              resolvedPermissions[key] = true;
              // Add can_ prefix if not present
              if (!key.startsWith('can_')) {
                resolvedPermissions[`can_${key}`] = true;
              }
              // Remove can_ prefix to add normalized version
              if (key.startsWith('can_')) {
                resolvedPermissions[key.replace('can_', '')] = true;
              }
            }
          }
        }
        console.log("[technician-auth] user_roles permissions loaded:", JSON.stringify(resolvedPermissions));
        
        // Update last_login_at
        await supabase.from("user_roles")
          .update({ last_login_at: new Date().toISOString() })
          .eq("user_id", profile.user_id);
      }

      // Log successful login
      await supabase.from("admin_audit_log").insert({
        action: "staff_pin_login_success",
        admin_user_id: technician.id,
        admin_email: technician.email,
        target_email: technician.email,
        target_type: "technician",
        details: { ip: req.headers.get("x-forwarded-for") || "unknown", permissions: Object.keys(resolvedPermissions) },
      });

      // Sign session token with permissions
      const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sessionToken = await signToken({
        technicianId: technician.id,
        userId: profile?.user_id,
        email: technician.email,
        fullName: technician.full_name,
        role: "technician",
        permissions: resolvedPermissions,
      }, tokenSecret);

      console.log("[technician-auth] pin_login successful for:", technician.full_name, "with permissions:", Object.keys(resolvedPermissions));

      return new Response(
        JSON.stringify({
          ok: true,
          user_id: profile?.user_id || technician.id,
          technician_id: technician.id,
          email: technician.email,
          full_name: technician.full_name,
          phone: technician.phone,
          specializations: technician.specializations,
          role: "technician",
          permissions: resolvedPermissions,
          status: "active",
          token: sessionToken,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Legacy login with password + PIN (kept for backwards compatibility, but not used by new UI)
    if (action === "login_with_password") {
      const { email, password, accessCode } = body;
      
      if (!email || !password || !accessCode) {
        console.log("[technician-auth] login_with_password: Missing email, password or PIN");
        return new Response(
          JSON.stringify({ ok: false, step: "validate_input", reason: "Email, mot de passe et code PIN requis" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Redirect to pin_login since we no longer use password for technicians
      console.log("[technician-auth] login_with_password: Redirecting to pin_login");
      return new Response(
        JSON.stringify({ ok: false, reason: "Le portail technicien utilise maintenant uniquement email et PIN." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: Unknown action
    console.log("[technician-auth] Unknown action:", action);
    return new Response(
      JSON.stringify({ ok: false, error: "Action non reconnue" }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[technician-auth] Unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
