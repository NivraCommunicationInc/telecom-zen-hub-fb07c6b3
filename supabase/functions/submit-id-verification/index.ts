/**
 * Edge Function: submit-id-verification
 * Mobile page submits ID documents via this endpoint.
 * Validates token, checks expiration, uploads docs, marks session as submitted.
 * No auth required (anon access via public_token).
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role for storage operations (since anon can't upload to private buckets easily)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const formData = await req.formData();
    const publicToken = formData.get("public_token") as string;
    const idType = formData.get("id_type") as string;
    const idProvince = formData.get("id_province") as string;
    const consentGiven = formData.get("consent") as string;
    const documentFront = formData.get("document_front") as File | null;
    const documentBack = formData.get("document_back") as File | null;
    const idempotencyKey = formData.get("idempotency_key") as string;

    if (!publicToken) {
      return new Response(
        JSON.stringify({ error: "Missing public_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (consentGiven !== "true") {
      return new Response(
        JSON.stringify({ error: "Consent is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!documentFront) {
      return new Response(
        JSON.stringify({ error: "At least front document image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency check
    if (idempotencyKey) {
      const { data: existingEvent } = await supabase
        .from("identity_verification_events")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingEvent) {
        return new Response(
          JSON.stringify({ message: "Already processed", status: "submitted" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Look up session by token
    const { data: session, error: sessionError } = await supabase
      .from("identity_verification_sessions")
      .select("*")
      .eq("public_token", publicToken)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from("identity_verification_sessions")
        .update({ status: "expired" })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({ error: "Verification link has expired. Please regenerate QR code." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check session isn't already submitted/approved/rejected
    if (session.status !== "created") {
      return new Response(
        JSON.stringify({ error: `Session already in status: ${session.status}`, status: session.status }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload front document
    const frontPath = `${session.id}/front_${Date.now()}.${documentFront.name.split(".").pop() || "jpg"}`;
    const frontBuffer = await documentFront.arrayBuffer();
    const { error: frontUploadError } = await supabase.storage
      .from("id-documents")
      .upload(frontPath, frontBuffer, { contentType: documentFront.type });

    if (frontUploadError) {
      console.error("Front upload error:", frontUploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload front document" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload back document if provided
    let backPath: string | null = null;
    if (documentBack) {
      backPath = `${session.id}/back_${Date.now()}.${documentBack.name.split(".").pop() || "jpg"}`;
      const backBuffer = await documentBack.arrayBuffer();
      const { error: backUploadError } = await supabase.storage
        .from("id-documents")
        .upload(backPath, backBuffer, { contentType: documentBack.type });

      if (backUploadError) {
        console.error("Back upload error:", backUploadError);
      }
    }

    // Update session to submitted
    const { error: updateError } = await supabase
      .from("identity_verification_sessions")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        id_type: idType || null,
        id_province: idProvince || null,
        document_front_path: frontPath,
        document_back_path: backPath,
      })
      .eq("id", session.id);

    if (updateError) {
      console.error("Session update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log event
    await supabase.from("identity_verification_events").insert({
      session_id: session.id,
      event_type: "documents_submitted",
      actor_id: session.user_id,
      actor_role: "client",
      details: {
        id_type: idType,
        id_province: idProvince,
        has_front: true,
        has_back: !!documentBack,
        consent_given: true,
      },
      idempotency_key: idempotencyKey || null,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    return new Response(
      JSON.stringify({ message: "Documents submitted successfully", status: "submitted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Submit ID verification error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
