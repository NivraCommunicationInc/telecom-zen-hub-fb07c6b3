/**
 * Edge Function: admin-review-verification
 * Admin approves/rejects identity verification session with mandatory reason.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Verify admin JWT
    const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await adminClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminUserId = claimsData.claims.sub;

    // Verify admin role
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: adminUser } = await serviceClient
      .from("admin_users")
      .select("id, is_active")
      .eq("user_id", adminUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { session_id, decision, reason, idempotency_key } = body;

    if (!session_id || !decision || !reason?.trim()) {
      return new Response(
        JSON.stringify({ error: "session_id, decision, and reason are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["approved", "rejected", "manual_review"].includes(decision)) {
      return new Response(
        JSON.stringify({ error: "decision must be approved, rejected, or manual_review" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency check
    if (idempotency_key) {
      const { data: existingEvent } = await serviceClient
        .from("identity_verification_events")
        .select("id")
        .eq("idempotency_key", idempotency_key)
        .maybeSingle();

      if (existingEvent) {
        return new Response(
          JSON.stringify({ message: "Already processed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get session
    const { data: session, error: sessionError } = await serviceClient
      .from("identity_verification_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session
    const { error: updateError } = await serviceClient
      .from("identity_verification_sessions")
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId,
        review_reason: reason,
        result_payload: { decision, reason, reviewed_by_admin: adminUserId },
      })
      .eq("id", session_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log event
    await serviceClient.from("identity_verification_events").insert({
      session_id,
      event_type: `admin_${decision}`,
      actor_id: adminUserId,
      actor_role: "admin",
      details: { decision, reason },
      idempotency_key: idempotency_key || null,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    return new Response(
      JSON.stringify({ message: `Session ${decision}`, session_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Admin review error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
