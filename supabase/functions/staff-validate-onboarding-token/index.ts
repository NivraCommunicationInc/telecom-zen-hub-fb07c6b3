import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Token hash function
async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return json(200, { valid: false, reason: "no_token" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the token for lookup
    const tokenHash = await hashToken(token);

    // Find the token
    const { data: tokenRecord, error } = await adminClient
      .from("staff_onboarding_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      console.error("[staff-validate-onboarding-token] DB error:", error);
      return json(200, { valid: false, reason: "server_error" });
    }

    if (!tokenRecord) {
      return json(200, { valid: false, reason: "invalid_token" });
    }

    // Check if already used
    if (tokenRecord.used_at) {
      return json(200, { valid: false, reason: "used" });
    }

    // Check if expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return json(200, { valid: false, reason: "expired" });
    }

    // Get user details
    const { data: userRole } = await adminClient
      .from("user_roles")
      .select("role, status")
      .eq("user_id", tokenRecord.user_id)
      .maybeSingle();

    // Get profile for full name
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", tokenRecord.user_id)
      .maybeSingle();

    return json(200, {
      valid: true,
      data: {
        user_id: tokenRecord.user_id,
        email: tokenRecord.email,
        role: tokenRecord.role,
        full_name: profile?.full_name || null,
      },
    });
  } catch (error) {
    console.error("[staff-validate-onboarding-token] Error:", error);
    return json(500, { valid: false, reason: "server_error" });
  }
});
