import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Token hash function
async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate cryptographically secure salt
function generateSalt(): string {
  const saltBytes = new Uint8Array(32);
  crypto.getRandomValues(saltBytes);
  return Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// PIN hashing with PBKDF2
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
    const { token, password, pin, terms_accepted, terms_version } = await req.json();

    // Validate inputs
    if (!token || !password || !pin) {
      return json(400, { ok: false, message: "Token, mot de passe et NIP requis" });
    }

    if (password.length < 8) {
      return json(400, { ok: false, message: "Mot de passe trop court (min 8 caractères)" });
    }

    if (!/^\d{4}$/.test(pin)) {
      return json(400, { ok: false, message: "Le NIP doit être exactement 4 chiffres" });
    }

    if (!terms_accepted) {
      return json(400, { ok: false, message: "Vous devez accepter les termes et conditions" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token
    const tokenHash = await hashToken(token);
    
    const { data: tokenRecord, error: tokenError } = await adminClient
      .from("staff_onboarding_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenError || !tokenRecord) {
      console.error("[staff-complete-onboarding] Token lookup error:", tokenError);
      return json(400, { ok: false, message: "Token invalide" });
    }

    if (tokenRecord.used_at) {
      return json(200, { ok: false, code: "ALREADY_CONFIGURED", message: "Ce lien a déjà été utilisé" });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return json(400, { ok: false, message: "Ce lien a expiré" });
    }

    const userId = tokenRecord.user_id;
    const userEmail = tokenRecord.email;
    const userRole = tokenRecord.role;

    console.log(`[staff-complete-onboarding] Processing for user ${userId} (${userEmail}), role=${userRole}`);

    // 1. Update password via Supabase Auth
    const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, {
      password,
      user_metadata: {
        require_password_change: false,
        onboarding_completed: true,
      },
    });

    if (pwError) {
      console.error("[staff-complete-onboarding] Password update error:", pwError);
      return json(500, { ok: false, message: "Erreur lors de la mise à jour du mot de passe" });
    }

    // 2. Hash and store PIN
    const pinSalt = generateSalt();
    const pinHash = await hashPinPBKDF2(pin, pinSalt);

    // 3. Update user_roles with PIN and onboarding status
    const { error: roleError } = await adminClient
      .from("user_roles")
      .update({
        staff_pin_hash: pinHash,
        staff_pin_salt: pinSalt,
        staff_pin_set_at: new Date().toISOString(),
        staff_pin_failed_attempts: 0,
        staff_pin_lockout_until: null,
        terms_accepted_at: new Date().toISOString(),
        terms_version: terms_version || "1.0",
        onboarding_completed_at: new Date().toISOString(),
        require_onboarding: false,
        require_terms_acceptance: false,
        is_active: true,
        status: "active",
      })
      .eq("user_id", userId);

    if (roleError) {
      console.error("[staff-complete-onboarding] Role update error:", roleError);
      return json(500, { ok: false, message: "Erreur lors de la configuration du compte" });
    }

    // 4. Mark token as used
    await adminClient
      .from("staff_onboarding_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    // 5. Log the successful onboarding
    await adminClient.from("admin_audit_log").insert({
      admin_user_id: tokenRecord.created_by_admin_id || userId,
      admin_email: "system",
      action: "staff_onboarding_completed",
      details: {
        request_id: requestId,
        user_id: userId,
        email: userEmail,
        role: userRole,
        terms_version: terms_version || "1.0",
      },
      target_type: "staff_user",
      target_id: userId,
      target_email: userEmail,
    });

    console.log(`[staff-complete-onboarding] SUCCESS for ${userEmail}`);

    return json(200, {
      ok: true,
      message: "Compte configuré avec succès",
      data: { email: userEmail, role: userRole },
    });
  } catch (error) {
    console.error("[staff-complete-onboarding] Unexpected error:", error);
    return json(500, { ok: false, message: "Erreur inattendue" });
  }
});
