import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const PBKDF2_ITERATIONS = 100000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_MINUTES = 15;

async function hashPinPBKDF2(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const requestId = crypto.randomUUID();

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { ok: false, message: "Non autorisé" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json(401, { ok: false, message: "Session invalide" });

    // Verify employee access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role, can_access_employee")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!roleData?.can_access_employee) {
      return json(403, { ok: false, message: "Accès employé requis" });
    }

    const { action, customer_id, pin } = await req.json();

    if (!customer_id) return json(400, { ok: false, message: "ID client requis" });

    // ACTION: check-session — check if active session exists
    if (action === "check-session") {
      const { data: session } = await adminClient
        .from("customer_access_sessions")
        .select("id, expires_at")
        .eq("employee_id", user.id)
        .eq("customer_id", customer_id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return json(200, { ok: true, has_session: !!session, expires_at: session?.expires_at ?? null });
    }

    // ACTION: verify-pin
    if (!pin || !/^\d{4}$/.test(pin)) {
      return json(400, { ok: false, message: "NIP invalide (4 chiffres requis)" });
    }

    // Get customer security record
    const { data: security } = await adminClient
      .from("customer_security")
      .select("*")
      .eq("customer_id", customer_id)
      .maybeSingle();

    if (!security) {
      return json(404, { ok: false, message: "Aucun NIP configuré pour ce client" });
    }

    // Check lockout
    if (security.lock_until && new Date(security.lock_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(security.lock_until).getTime() - Date.now()) / 60000);
      // Audit failed attempt during lockout
      await adminClient.from("internal_audit_log").insert({
        user_id: user.id,
        action: "customer_pin_locked",
        category: "security",
        portal: "employee",
        target_type: "customer",
        target_id: customer_id,
        details: { minutes_left: minutesLeft },
      });
      return json(429, { ok: false, message: `Compte verrouillé. Réessayez dans ${minutesLeft} minute(s).`, locked: true });
    }

    // Verify PIN
    const computedHash = await hashPinPBKDF2(pin, security.pin_salt);
    const isValid = computedHash === security.pin_hash;

    if (isValid) {
      // Reset attempts, update last_verified_at
      await adminClient.from("customer_security").update({
        pin_attempts: 0,
        lock_until: null,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("customer_id", customer_id);

      // Create access session
      const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60 * 1000);
      await adminClient.from("customer_access_sessions").insert({
        employee_id: user.id,
        customer_id,
        expires_at: expiresAt.toISOString(),
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        user_agent: req.headers.get("user-agent") || null,
      });

      // Audit success
      await adminClient.from("internal_audit_log").insert({
        user_id: user.id,
        action: "customer_pin_verified",
        category: "security",
        portal: "employee",
        target_type: "customer",
        target_id: customer_id,
        details: { session_minutes: SESSION_MINUTES },
      });

      return json(200, { ok: true, message: "Accès accordé", expires_at: expiresAt.toISOString() });
    } else {
      // Increment attempts
      const newAttempts = (security.pin_attempts || 0) + 1;
      const updateData: Record<string, unknown> = {
        pin_attempts: newAttempts,
        updated_at: new Date().toISOString(),
      };

      if (newAttempts >= MAX_ATTEMPTS) {
        updateData.lock_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      }

      await adminClient.from("customer_security").update(updateData).eq("customer_id", customer_id);

      // Audit failure
      await adminClient.from("internal_audit_log").insert({
        user_id: user.id,
        action: "customer_pin_failed",
        category: "security",
        portal: "employee",
        target_type: "customer",
        target_id: customer_id,
        details: { attempts: newAttempts, locked: newAttempts >= MAX_ATTEMPTS },
      });

      if (newAttempts >= MAX_ATTEMPTS) {
        return json(429, {
          ok: false,
          message: `Trop de tentatives. Compte verrouillé pour ${LOCKOUT_MINUTES} minutes.`,
          locked: true, attempts_remaining: 0,
        });
      }

      return json(401, {
        ok: false,
        message: "NIP incorrect",
        attempts_remaining: MAX_ATTEMPTS - newAttempts,
      });
    }
  } catch (error) {
    console.error("[employee-verify-customer-pin] Error:", error);
    return json(500, { ok: false, message: "Erreur serveur" });
  }
});
