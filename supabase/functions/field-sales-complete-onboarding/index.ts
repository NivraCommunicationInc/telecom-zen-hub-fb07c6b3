import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

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
    const { pin, terms_accepted, terms_version } = await req.json();

    // Validate inputs
    if (!pin) {
      return json(400, { ok: false, message: "NIP requis" });
    }

    if (!/^\d{6}$/.test(pin)) {
      return json(400, { ok: false, message: "Le NIP doit être exactement 6 chiffres" });
    }

    if (!terms_accepted) {
      return json(400, { ok: false, message: "Vous devez accepter les termes et conditions" });
    }

    // Get user from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { ok: false, message: "Non autorisé" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const accessToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminClient.auth.getUser(accessToken);

    if (authError || !user) {
      console.error("[field-sales-complete-onboarding] Auth error:", authError);
      return json(401, { ok: false, message: "Session invalide" });
    }

    // Verify user has field_sales role
    const { data: roleData, error: roleCheckError } = await adminClient
      .from("user_roles")
      .select("role, is_active, status, onboarding_completed_at")
      .eq("user_id", user.id)
      .eq("role", "field_sales")
      .maybeSingle();

    if (roleCheckError || !roleData) {
      console.error("[field-sales-complete-onboarding] Role check error:", roleCheckError);
      return json(403, { ok: false, message: "Rôle vendeur terrain non trouvé" });
    }

    if (roleData.onboarding_completed_at) {
      return json(200, { ok: false, code: "ALREADY_CONFIGURED", message: "Compte déjà configuré" });
    }

    const userId = user.id;
    const userEmail = user.email || "";

    console.log(`[field-sales-complete-onboarding] Processing for ${userEmail}`);

    // Hash and store PIN
    const pinSalt = generateSalt();
    const pinHash = await hashPinPBKDF2(pin, pinSalt);

    // Update user_roles with PIN and onboarding status
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
      .eq("user_id", userId)
      .eq("role", "field_sales");

    if (roleError) {
      console.error("[field-sales-complete-onboarding] Role update error:", roleError);
      return json(500, { ok: false, message: "Erreur lors de la configuration du compte" });
    }

    // Log the successful onboarding
    await adminClient.from("admin_audit_log").insert({
      admin_user_id: userId,
      admin_email: "system",
      action: "field_sales_onboarding_completed",
      details: {
        request_id: requestId,
        user_id: userId,
        email: userEmail,
        role: "field_sales",
        terms_version: terms_version || "1.0",
      },
      target_type: "field_sales_user",
      target_id: userId,
      target_email: userEmail,
    });

    console.log(`[field-sales-complete-onboarding] SUCCESS for ${userEmail}`);

    return json(200, {
      ok: true,
      message: "Compte configuré avec succès",
      data: { email: userEmail, role: "field_sales" },
    });
  } catch (error) {
    console.error("[field-sales-complete-onboarding] Unexpected error:", error);
    return json(500, { ok: false, message: "Erreur inattendue" });
  }
});
