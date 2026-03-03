/**
 * Edge Function: submit-id-verification
 * Mobile page submits ID documents via this endpoint.
 * SECURITY: Token lookup via SHA-256 hash (never stored in plaintext).
 * Validates token, checks expiration, uploads docs to PRIVATE bucket, marks session as submitted.
 * Includes: rate limiting (max 3 attempts), selfie support, IP/UA logging.
 * No auth required (anon access via public_token → hash lookup).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const formData = await req.formData();
    const publicToken = formData.get("public_token") as string;
    const idType = formData.get("id_type") as string;
    const idProvince = formData.get("id_province") as string;
    const consentGiven = formData.get("consent") as string;
    const documentFront = formData.get("document_front") as File | null;
    const documentBack = formData.get("document_back") as File | null;
    const selfieFile = formData.get("selfie") as File | null;
    const idempotencyKey = formData.get("idempotency_key") as string;

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const clientUa = req.headers.get("user-agent") || "unknown";

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

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024;
    for (const [name, file] of [["front", documentFront], ["back", documentBack], ["selfie", selfieFile]] as const) {
      if (file && file.size > maxSize) {
        return new Response(
          JSON.stringify({ error: `File ${name} exceeds 10MB limit` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // SECURITY: Hash the token and lookup by hash (token is NEVER stored in DB)
    const tokenHash = await hashToken(publicToken);

    const { data: session, error: sessionError } = await supabase
      .from("identity_verification_sessions")
      .select("*")
      .eq("public_token_hash", tokenHash)
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

    // Rate limit: max 3 submission attempts
    if (session.submission_attempts >= (session.max_attempts || 3)) {
      return new Response(
        JSON.stringify({ error: "Maximum submission attempts reached. Please regenerate QR code." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment attempt count
    await supabase
      .from("identity_verification_sessions")
      .update({
        submission_attempts: (session.submission_attempts || 0) + 1,
        client_ip: clientIp,
        client_user_agent: clientUa,
      })
      .eq("id", session.id);

    // Upload front document to private bucket
    const frontExt = documentFront.name.split(".").pop() || "jpg";
    const frontPath = `${session.id}/front_${Date.now()}.${frontExt}`;
    const frontBuffer = await documentFront.arrayBuffer();
    const { error: frontUploadError } = await supabase.storage
      .from("id-documents")
      .upload(frontPath, frontBuffer, { contentType: documentFront.type, upsert: false });

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
      const backExt = documentBack.name.split(".").pop() || "jpg";
      backPath = `${session.id}/back_${Date.now()}.${backExt}`;
      const backBuffer = await documentBack.arrayBuffer();
      const { error: backUploadError } = await supabase.storage
        .from("id-documents")
        .upload(backPath, backBuffer, { contentType: documentBack.type, upsert: false });

      if (backUploadError) {
        console.error("Back upload error:", backUploadError);
      }
    }

    // Upload selfie if provided
    let selfiePath: string | null = null;
    if (selfieFile) {
      const selfieExt = selfieFile.name.split(".").pop() || "jpg";
      selfiePath = `${session.id}/selfie_${Date.now()}.${selfieExt}`;
      const selfieBuffer = await selfieFile.arrayBuffer();
      const { error: selfieUploadError } = await supabase.storage
        .from("id-documents")
        .upload(selfiePath, selfieBuffer, { contentType: selfieFile.type, upsert: false });

      if (selfieUploadError) {
        console.error("Selfie upload error:", selfieUploadError);
      }
    }

    // Step 1: Mark session as "submitted" (documents received, awaiting OCR)
    const { error: submitError } = await supabase
      .from("identity_verification_sessions")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        id_type: idType || null,
        id_province: idProvince || null,
        document_front_path: frontPath,
        document_back_path: backPath,
        selfie_path: selfiePath,
      })
      .eq("id", session.id);

    if (submitError) {
      console.error("Session submit error:", submitError);
      return new Response(
        JSON.stringify({ error: "Failed to update session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log submission event
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
        has_selfie: !!selfieFile,
        consent_given: true,
      },
      idempotency_key: idempotencyKey || null,
      ip_address: clientIp,
      user_agent: clientUa,
    });

    // Step 2: Trigger OCR processing asynchronously
    // OCR will transition session from "submitted" → "manual_review" when complete
    try {
      const ocrUrl = `${supabaseUrl}/functions/v1/process-id-ocr`;
      fetch(ocrUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ session_id: session.id }),
      }).catch(err => console.error("OCR trigger error:", err));
    } catch (ocrErr) {
      console.error("OCR trigger exception:", ocrErr);
      // If OCR fails to trigger, still move to manual_review so admin can review
      await supabase.from("identity_verification_sessions")
        .update({ status: "manual_review" })
        .eq("id", session.id);
    }

    return new Response(
      JSON.stringify({ message: "Documents submitted", status: "submitted" }),
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
