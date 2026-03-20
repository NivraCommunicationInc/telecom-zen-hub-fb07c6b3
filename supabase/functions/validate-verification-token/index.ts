/**
 * Edge Function: validate-verification-token
 * Public endpoint for mobile /verify-id page to validate a token WITHOUT direct DB access.
 * SECURITY: Hashes token, looks up by hash. No anon SELECT on sessions table.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { public_token } = body;
    const normalizedToken = typeof public_token === "string" ? public_token.trim() : "";

    if (!normalizedToken || normalizedToken.length < 10) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenHash = await hashToken(normalizedToken);

    const { data: session, error } = await supabase
      .from("identity_verification_sessions")
      .select("id, status, expires_at, submission_attempts, max_attempts")
      .eq("public_token_hash", tokenHash)
      .single();

    if (error || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification link", valid: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expired = new Date(session.expires_at) < new Date();
    if (expired && session.status === "created") {
      await supabase
        .from("identity_verification_sessions")
        .update({ status: "expired" })
        .eq("id", session.id);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        status: expired ? "expired" : session.status,
        expires_at: session.expires_at,
        submission_attempts: session.submission_attempts,
        max_attempts: session.max_attempts,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Token validation error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
