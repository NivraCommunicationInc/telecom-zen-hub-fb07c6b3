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
        console.log("[employee-auth] pin_login: Missing email or PIN");
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
      console.log(`[employee-auth] pin_login attempt for: ${normalizedEmail}`);

      // Step 1: Find employee record by email
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("*")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (empError) {
        console.error("[employee-auth] pin_login: Employee lookup error:", empError);
        return new Response(
          JSON.stringify({ ok: false, reason: "not_found", message: "Erreur de connexion" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!employee) {
        console.log("[employee-auth] pin_login: No employee record for email:", normalizedEmail);
        
        // Log failed attempt
        await supabase.from("admin_audit_log").insert({
          action: "staff_pin_login_failed",
          admin_user_id: "00000000-0000-0000-0000-000000000000",
          admin_email: normalizedEmail,
          target_email: normalizedEmail,
          target_type: "employee",
          details: { reason: "not_found", ip: req.headers.get("x-forwarded-for") || "unknown" },
        });
        
        return new Response(
          JSON.stringify({ ok: false, reason: "not_found", message: "Aucun compte employé trouvé." }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check lockout
      if (employee.lockout_until) {
        const lockoutEnd = new Date(employee.lockout_until);
        if (lockoutEnd > new Date()) {
          const minutesRemaining = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
          return new Response(
            JSON.stringify({ ok: false, reason: "account_locked", message: `Compte verrouillé. Réessayez dans ${minutesRemaining} minute(s).` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check if employee is active
      if (!employee.is_active) {
        await supabase.from("admin_audit_log").insert({
          action: "staff_pin_login_failed",
          admin_user_id: employee.id,
          admin_email: employee.email,
          target_email: employee.email,
          target_type: "employee",
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
          .eq("role", "employee")
          .maybeSingle();

        if (userRole?.status === "hold") {
          await supabase.from("admin_audit_log").insert({
            action: "staff_pin_login_failed",
            admin_user_id: employee.id,
            admin_email: employee.email,
            target_email: employee.email,
            target_type: "employee",
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
            admin_user_id: employee.id,
            admin_email: employee.email,
            target_email: employee.email,
            target_type: "employee",
            details: { reason: "status_disabled", ip: req.headers.get("x-forwarded-for") || "unknown" },
          });
          
          return new Response(
            JSON.stringify({ ok: false, reason: "status_disabled", message: "Compte désactivé." }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check if PIN is set
      if (!employee.pin_hash) {
        await supabase.from("admin_audit_log").insert({
          action: "staff_pin_login_failed",
          admin_user_id: employee.id,
          admin_email: employee.email,
          target_email: employee.email,
          target_type: "employee",
          details: { reason: "pin_not_set", ip: req.headers.get("x-forwarded-for") || "unknown" },
        });
        
        return new Response(
          JSON.stringify({ ok: false, reason: "pin_not_set", message: "PIN non configuré. Contactez l'administrateur." }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify PIN - try multiple hash formats for compatibility
      const inputPinHash = await hashPin(pin, PIN_SALT);
      const inputPinHashNew = await hashPin(PIN_SALT_NEW + pin);
      const legacyInputPinHash = await hashPin(pin);

      const pinValid = 
        employee.pin_hash === inputPinHash || 
        employee.pin_hash === inputPinHashNew ||
        employee.pin_hash === legacyInputPinHash;

      if (!pinValid) {
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
          
          await supabase.from("admin_audit_log").insert({
            action: "staff_pin_login_failed",
            admin_user_id: employee.id,
            admin_email: employee.email,
            target_email: employee.email,
            target_type: "employee",
            details: { reason: "account_locked", attempts: newAttempts, ip: req.headers.get("x-forwarded-for") || "unknown" },
          });
          
          return new Response(
            JSON.stringify({ ok: false, reason: "account_locked", message: `Trop de tentatives. Compte verrouillé pour ${LOCKOUT_MINUTES} minutes.` }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.from("employees").update(updates).eq("id", employee.id);
        
        await supabase.from("admin_audit_log").insert({
          action: "staff_pin_login_failed",
          admin_user_id: employee.id,
          admin_email: employee.email,
          target_email: employee.email,
          target_type: "employee",
          details: { reason: "invalid_pin", attempts: newAttempts, ip: req.headers.get("x-forwarded-for") || "unknown" },
        });
        
        return new Response(
          JSON.stringify({ ok: false, reason: "invalid_pin", message: `PIN invalide. ${MAX_ATTEMPTS - newAttempts} tentative(s) restante(s).` }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Success - reset failed attempts
      await supabase.from("employees").update({ 
        failed_login_attempts: 0, 
        lockout_until: null 
      }).eq("id", employee.id);

      // Update last_login_at in user_roles
      if (profile?.user_id) {
        await supabase.from("user_roles")
          .update({ last_login_at: new Date().toISOString() })
          .eq("user_id", profile.user_id)
          .eq("role", "employee");
      }

      // Log successful login
      await supabase.from("admin_audit_log").insert({
        action: "staff_pin_login_success",
        admin_user_id: employee.id,
        admin_email: employee.email,
        target_email: employee.email,
        target_type: "employee",
        details: { ip: req.headers.get("x-forwarded-for") || "unknown" },
      });

      // Ensure permissions_json is an object (handle null/undefined)
      const resolvedPermissions = employee.permissions_json || {};
      console.log("[employee-auth] pin_login: resolved permissions:", resolvedPermissions);

      // Sign session token
      const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sessionToken = await signToken({
        employeeId: employee.id,
        userId: profile?.user_id || employee.id,
        email: employee.email,
        fullName: employee.full_name,
        role: "employee",
        permissions: resolvedPermissions,
      }, tokenSecret);

      console.log("[employee-auth] pin_login successful for:", employee.full_name, "with permissions:", Object.keys(resolvedPermissions));

      return new Response(
        JSON.stringify({
          ok: true,
          user_id: profile?.user_id || employee.id,
          employee_id: employee.id,
          email: employee.email,
          full_name: employee.full_name,
          role: "employee",
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
        .eq("role", "employee")
        .is("used_at", null)
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.log("[employee-auth] validate_pin_token: token not found or used");
        return new Response(
          JSON.stringify({ ok: false, message: "Lien invalide ou déjà utilisé" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check expiry
      if (new Date(tokenData.expires_at) < new Date()) {
        console.log("[employee-auth] validate_pin_token: token expired");
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
        .eq("role", "employee")
        .is("used_at", null)
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.log("[employee-auth] set_pin_with_token: token not found or used");
        return new Response(
          JSON.stringify({ ok: false, message: "Lien invalide ou déjà utilisé" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        console.log("[employee-auth] set_pin_with_token: token expired");
        return new Response(
          JSON.stringify({ ok: false, message: "Ce lien a expiré" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hash PIN with new salt
      const pinHashNew = await hashPin(PIN_SALT_NEW + pin);

      // Update employee record
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          pin_hash: pinHashNew,
          pin_set_at: new Date().toISOString(),
          require_pin_change: false,
        })
        .ilike("email", tokenData.email);

      if (updateError) {
        console.error("[employee-auth] set_pin_with_token: update error:", updateError);
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

      // Log action
      await supabase.from("employee_audit_logs").insert({
        actor_role: "employee",
        actor_id: tokenData.user_id,
        actor_email: tokenData.email,
        action: "PIN_SET_VIA_INVITE",
        target_employee_email: tokenData.email,
        details_json: { invite_id: tokenData.id },
      });

      console.log("[employee-auth] set_pin_with_token: PIN set successfully for", tokenData.email);

      return new Response(
        JSON.stringify({ ok: true, message: "PIN configuré avec succès" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Legacy login with password + PIN (kept for backwards compatibility, but not used by new UI)
    if (action === "login_with_password") {
      const { email, password, pin } = body;
      
      if (!email || !password || !pin) {
        console.log("[employee-auth] login_with_password: Missing email, password or PIN");
        return new Response(
          JSON.stringify({ ok: false, step: "validate_input", reason: "Email, mot de passe et code PIN requis" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Redirect to pin_login since we no longer use password for employees
      console.log("[employee-auth] login_with_password: Redirecting to pin_login");
      return new Response(
        JSON.stringify({ ok: false, reason: "Le portail employé utilise maintenant uniquement email et PIN." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: Unknown action
    console.log("[employee-auth] Unknown action:", action);
    return new Response(
      JSON.stringify({ ok: false, error: "Action non reconnue" }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[employee-auth] Unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
