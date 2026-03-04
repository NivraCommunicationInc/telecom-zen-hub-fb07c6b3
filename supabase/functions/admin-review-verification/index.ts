/**
 * Edge Function: admin-review-verification
 * Admin approves/rejects identity verification session with mandatory reason.
 * Also supports generating signed URLs for viewing private documents.
 * Supports required_docs for resubmission requests.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await adminClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return { error: "Unauthorized", status: 401 };
  }
  const adminUserId = claimsData.claims.sub;

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminUser } = await serviceClient
    .from("admin_users")
    .select("id, is_active")
    .eq("user_id", adminUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (!adminUser) {
    return { error: "Admin access required", status: 403 };
  }

  return { adminUserId, serviceClient };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await verifyAdmin(req);
    if ("error" in auth) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { adminUserId, serviceClient } = auth;
    const body = await req.json();
    const { action } = body;

    // Action: get signed URLs for documents
    if (action === "get_signed_urls") {
      const { session_id } = body;
      if (!session_id) {
        return new Response(
          JSON.stringify({ error: "session_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await serviceClient
        .from("identity_verification_sessions")
        .select("document_front_path, document_back_path, selfie_path")
        .eq("id", session_id)
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: "Session not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const urls: Record<string, string | null> = { front: null, back: null, selfie: null };
      const expiresIn = 300;

      for (const [key, path] of [
        ["front", session.document_front_path],
        ["back", session.document_back_path],
        ["selfie", session.selfie_path],
      ] as const) {
        if (path) {
          const { data } = await serviceClient.storage
            .from("id-documents")
            .createSignedUrl(path, expiresIn);
          urls[key] = data?.signedUrl || null;
        }
      }

      await serviceClient.from("identity_verification_events").insert({
        session_id,
        event_type: "admin_viewed_documents",
        actor_id: adminUserId,
        actor_role: "admin",
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        user_agent: req.headers.get("user-agent"),
      });

      return new Response(
        JSON.stringify({ urls }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default action: review decision
    const { session_id, decision, reason, required_docs, idempotency_key } = body;

    if (!session_id || !decision || !reason?.trim()) {
      return new Response(
        JSON.stringify({ error: "session_id, decision, and reason are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["approved", "rejected", "manual_review", "resubmission_required"].includes(decision)) {
      return new Response(
        JSON.stringify({ error: "decision must be approved, rejected, manual_review, or resubmission_required" }),
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
    const updatePayload: Record<string, any> = {
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      review_reason: reason,
      result_payload: { decision, reason, reviewed_by_admin: adminUserId },
    };

    // Store required_docs for resubmission
    if (decision === "resubmission_required" && required_docs && Array.isArray(required_docs)) {
      updatePayload.required_docs = required_docs;
      updatePayload.additional_docs = null; // Reset previous additional uploads
    }

    const { error: updateError } = await serviceClient
      .from("identity_verification_sessions")
      .update(updatePayload)
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
      details: { decision, reason, required_docs: required_docs || null },
      idempotency_key: idempotency_key || null,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    // On approval: update linked orders to confirmed
    if (decision === "approved") {
      const { data: linkedOrders } = await serviceClient
        .from("orders")
        .select("id, status")
        .eq("identity_verification_session_id", session_id)
        .in("status", ["pending_verification", "pending"]);

      if (linkedOrders && linkedOrders.length > 0) {
        for (const order of linkedOrders) {
          await serviceClient
            .from("orders")
            .update({ status: "confirmed" })
            .eq("id", order.id);

          await serviceClient.from("identity_verification_events").insert({
            session_id,
            event_type: "order_activated_on_approval",
            actor_id: adminUserId,
            actor_role: "admin",
            details: { order_id: order.id },
          });
        }
      }

      await serviceClient.from("admin_notification_logs").insert({
        event_type: "kyc_approved",
        event_id: session_id,
        client_email: null,
        priority: "normal",
      });
    }

    // On rejection: cancel linked orders
    if (decision === "rejected") {
      const { data: linkedOrders } = await serviceClient
        .from("orders")
        .select("id, status")
        .eq("identity_verification_session_id", session_id)
        .in("status", ["pending_verification", "pending"]);

      if (linkedOrders && linkedOrders.length > 0) {
        for (const order of linkedOrders) {
          await serviceClient
            .from("orders")
            .update({ status: "verification_failed", cancellation_reason: `KYC rejected: ${reason}` })
            .eq("id", order.id);
        }
      }

      await serviceClient.from("admin_notification_logs").insert({
        event_type: "kyc_rejected",
        event_id: session_id,
        priority: "normal",
      });
    }

    // On resubmission_required: reset for new upload, notify client
    if (decision === "resubmission_required") {
      await serviceClient
        .from("identity_verification_sessions")
        .update({
          submission_attempts: 0,
          document_front_path: null,
          document_back_path: null,
          selfie_path: null,
          submitted_at: null,
          extracted_fields: null,
          match_result: null,
        })
        .eq("id", session_id);

      await serviceClient.from("admin_notification_logs").insert({
        event_type: "kyc_resubmission_required",
        event_id: session_id,
        priority: "normal",
      });
    }

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
