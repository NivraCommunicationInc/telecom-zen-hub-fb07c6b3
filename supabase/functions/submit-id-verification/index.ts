/**
 * Edge Function: submit-id-verification
 * Mobile page submits ID documents via this endpoint.
 * SECURITY: Token lookup via SHA-256 hash (never stored in plaintext).
 * Validates token, checks expiration, uploads docs to PRIVATE bucket, marks session as submitted.
 * Includes: rate limiting, selfie support, IP/UA logging, atomic identity_documents persistence.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function uploadDocument(
  supabase: any,
  sessionId: string,
  docType: string,
  file: File
): Promise<{ path: string; size: number; contentType: string } | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${sessionId}/${docType}_${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from("id-documents")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) {
    console.error(`${docType} upload error:`, error);
    return null;
  }
  return { path, size: file.size, contentType: file.type };
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

    // IP throttle
    if (clientIp !== "unknown") {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: ipCount } = await supabase
        .from("identity_verification_sessions")
        .select("id", { count: "exact", head: true })
        .eq("client_ip", clientIp)
        .gte("submitted_at", oneHourAgo);
      if ((ipCount || 0) >= 10) {
        return errorResponse("Too many submissions from this device. Please try again later.", 429);
      }
    }

    if (!publicToken) return errorResponse("Missing public_token", 400);
    if (consentGiven !== "true") return errorResponse("Consent is required", 400);
    if (!documentFront) return errorResponse("At least front document image is required", 400);

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024;
    for (const [name, file] of [["front", documentFront], ["back", documentBack], ["selfie", selfieFile]] as const) {
      if (file && file.size > maxSize) {
        return errorResponse(`File ${name} exceeds 10MB limit`, 400);
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

    // SECURITY: Hash token lookup
    const tokenHash = await hashToken(publicToken);
    const { data: session, error: sessionError } = await supabase
      .from("identity_verification_sessions")
      .select("*")
      .eq("public_token_hash", tokenHash)
      .single();

    if (sessionError || !session) return errorResponse("Invalid or expired verification link", 404);

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from("identity_verification_sessions").update({ status: "expired" }).eq("id", session.id);
      return errorResponse("Verification link has expired. Please regenerate QR code.", 410);
    }

    // Check session status
    if (session.status !== "created" && session.status !== "resubmission_required") {
      return errorResponse(`Session already in status: ${session.status}`, 409);
    }

    // Rate limit: max 3 attempts
    if (session.submission_attempts >= (session.max_attempts || 3)) {
      return errorResponse("Maximum submission attempts reached. Please regenerate QR code.", 429);
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

    // Upload documents
    const frontResult = await uploadDocument(supabase, session.id, "front", documentFront);
    if (!frontResult) return errorResponse("Failed to upload front document", 500);

    const backResult = documentBack ? await uploadDocument(supabase, session.id, "back", documentBack) : null;
    const selfieResult = selfieFile ? await uploadDocument(supabase, session.id, "selfie", selfieFile) : null;

    // FIX #2: Persist documents atomically to identity_documents table
    const docRows = [
      { kyc_session_id: session.id, doc_type: "front", storage_bucket: "id-documents", object_path: frontResult.path, file_size: frontResult.size, content_type: frontResult.contentType },
      ...(backResult ? [{ kyc_session_id: session.id, doc_type: "back", storage_bucket: "id-documents", object_path: backResult.path, file_size: backResult.size, content_type: backResult.contentType }] : []),
      ...(selfieResult ? [{ kyc_session_id: session.id, doc_type: "selfie", storage_bucket: "id-documents", object_path: selfieResult.path, file_size: selfieResult.size, content_type: selfieResult.contentType }] : []),
    ];

    const { error: docInsertError } = await supabase
      .from("identity_documents")
      .upsert(docRows, { onConflict: "kyc_session_id,doc_type" });

    if (docInsertError) {
      console.error("identity_documents insert error:", docInsertError);
      // Non-fatal: legacy paths on session still work as fallback
    }

    // Update session status + legacy paths
    const now = new Date().toISOString();
    const { error: submitError } = await supabase
      .from("identity_verification_sessions")
      .update({
        status: "manual_review",
        submitted_at: now,
        id_type: idType || null,
        id_province: idProvince || null,
        document_front_path: frontResult.path,
        document_back_path: backResult?.path || null,
        selfie_path: selfieResult?.path || null,
      })
      .eq("id", session.id);

    if (submitError) {
      console.error("Session submit error:", submitError);
      return errorResponse("Failed to update session", 500);
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
        has_selfie: !!selfieFile,
        consent_given: true,
        docs_persisted: !docInsertError,
      },
      idempotency_key: idempotencyKey || null,
      ip_address: clientIp,
      user_agent: clientUa,
    });

    // Fire-and-forget OCR
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
    }

    return new Response(
      JSON.stringify({ message: "Documents submitted", status: "manual_review" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Submit ID verification error:", err);
    return errorResponse("Internal server error", 500);
  }
});
