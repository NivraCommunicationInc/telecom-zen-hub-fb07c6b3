import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// PIN hashing with PBKDF2 (must match staff-complete-onboarding)
const PBKDF2_ITERATIONS = 100000;
async function hashPinPBKDF2(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  const saltData = encoder.encode(salt);
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    pinData,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltData,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = crypto.randomUUID();

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { ok: false, message: "Non autorisé" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json(401, { ok: false, message: "Session invalide" });
    }

    const { pin, client_user_id, reason } = await req.json();

    if (!pin || !/^\d{4}$/.test(pin)) {
      return json(400, { ok: false, message: "NIP invalide (4 chiffres requis)" });
    }

    if (!client_user_id) {
      return json(400, { ok: false, message: "ID client requis" });
    }

    if (!reason || reason.length < 3) {
      return json(400, { ok: false, message: "Raison d'accès requise" });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get staff user's PIN data
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role, staff_pin_hash, staff_pin_salt, staff_pin_failed_attempts, staff_pin_lockout_until")
      .eq("user_id", user.id)
      .in("role", ["employee", "technician"])
      .maybeSingle();

    if (roleError || !roleData) {
      return json(403, { ok: false, message: "Accès non autorisé" });
    }

    // Check lockout
    if (roleData.staff_pin_lockout_until && new Date(roleData.staff_pin_lockout_until) > new Date()) {
      const lockoutEnd = new Date(roleData.staff_pin_lockout_until);
      const minutesLeft = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
      return json(429, { 
        ok: false, 
        message: `Compte verrouillé. Réessayez dans ${minutesLeft} minute(s).`,
        locked: true,
        lockout_until: roleData.staff_pin_lockout_until,
      });
    }

    // Check if PIN is configured
    if (!roleData.staff_pin_hash || !roleData.staff_pin_salt) {
      return json(400, { ok: false, message: "NIP non configuré. Veuillez compléter votre configuration." });
    }

    // Verify PIN
    const computedHash = await hashPinPBKDF2(pin, roleData.staff_pin_salt);
    const isValid = computedHash === roleData.staff_pin_hash;

    if (isValid) {
      // Reset failed attempts
      await adminClient
        .from("user_roles")
        .update({ 
          staff_pin_failed_attempts: 0, 
          staff_pin_lockout_until: null 
        })
        .eq("user_id", user.id);

      // Create access session (15 minutes)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      await adminClient.from("staff_client_access_sessions").insert({
        staff_user_id: user.id,
        client_user_id,
        reason,
        verification_method: "pin",
        expires_at: expiresAt.toISOString(),
      });

      // Log successful access
      await adminClient.from("account_access_logs").insert({
        staff_user_id: user.id,
        client_user_id,
        method: "pin",
        reason,
        access_granted: true,
        portal: "staff",
      });

      return json(200, {
        ok: true,
        message: "Accès accordé",
        expires_at: expiresAt.toISOString(),
      });
    } else {
      // Increment failed attempts
      const newAttempts = (roleData.staff_pin_failed_attempts || 0) + 1;
      const updateData: Record<string, unknown> = { staff_pin_failed_attempts: newAttempts };

      if (newAttempts >= 5) {
        // Lock for 10 minutes
        const lockoutUntil = new Date(Date.now() + 10 * 60 * 1000);
        updateData.staff_pin_lockout_until = lockoutUntil.toISOString();
      }

      await adminClient
        .from("user_roles")
        .update(updateData)
        .eq("user_id", user.id);

      // Log failed access
      await adminClient.from("account_access_logs").insert({
        staff_user_id: user.id,
        client_user_id,
        method: "pin",
        reason,
        access_granted: false,
        portal: "staff",
      });

      if (newAttempts >= 5) {
        return json(429, {
          ok: false,
          message: "Trop de tentatives. Compte verrouillé pour 10 minutes.",
          locked: true,
          attempts_remaining: 0,
        });
      }

      return json(401, {
        ok: false,
        message: "NIP incorrect",
        attempts_remaining: 5 - newAttempts,
      });
    }
  } catch (error) {
    console.error("[staff-verify-pin] Error:", error);
    return json(500, { ok: false, message: "Erreur serveur" });
  }
});
