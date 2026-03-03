/**
 * Edge Function: generate-verification-qr
 * Creates an identity_verification_session + returns QR code as PNG
 * SECURITY: Token is hashed (SHA-256) before storage. Only hash is persisted.
 * Rate-limited: max 5 sessions per user per hour
 * QR points to: https://nivra-telecom.ca/verify-id?t=<public_token>
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "npm:qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** SHA-256 hash a string and return hex */
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Use service role for DB operations (anon RLS is locked down)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { checkout_type, order_context, regenerate_session_id } = body;

    // Rate limiting: max 5 sessions per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("identity_verification_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo);

    if ((recentCount || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Max 5 verification sessions per hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If regenerating, expire the old session (invalidates old token)
    if (regenerate_session_id) {
      const { data: oldSession } = await supabase
        .from("identity_verification_sessions")
        .select("id, qr_regeneration_count")
        .eq("id", regenerate_session_id)
        .eq("user_id", userId)
        .single();

      if (oldSession) {
        if (oldSession.qr_regeneration_count >= 3) {
          return new Response(
            JSON.stringify({ error: "Maximum QR regenerations reached. Please restart checkout." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Expire old session — this invalidates the old token
        await supabase
          .from("identity_verification_sessions")
          .update({ status: "expired" })
          .eq("id", regenerate_session_id);

        await supabase.from("identity_verification_events").insert({
          session_id: regenerate_session_id,
          event_type: "expired_by_regeneration",
          actor_id: userId,
          actor_role: "client",
        });
      }
    }

    // Generate secure public token
    const publicToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const publicTokenHash = await hashToken(publicToken);
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes

    // Create session — store HASH only, never the raw token
    const { data: session, error: sessionError } = await supabase
      .from("identity_verification_sessions")
      .insert({
        public_token: "REDACTED", // Never store raw token
        public_token_hash: publicTokenHash,
        user_id: userId,
        checkout_type: checkout_type || "mobile",
        order_context: order_context || {},
        status: "created",
        expires_at: expiresAt.toISOString(),
        qr_regeneration_count: regenerate_session_id ? 1 : 0,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log creation event
    await supabase.from("identity_verification_events").insert({
      session_id: session.id,
      event_type: "session_created",
      actor_id: userId,
      actor_role: "client",
      details: { checkout_type, regenerated_from: regenerate_session_id || null },
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    // Generate QR code as data URL
    const verifyUrl = `https://nivra-telecom.ca/verify-id?t=${publicToken}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    });

    return new Response(
      JSON.stringify({
        session_id: session.id,
        qr_data_url: qrDataUrl,
        verify_url: verifyUrl,
        expires_at: expiresAt.toISOString(),
        status: "created",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("QR generation error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
