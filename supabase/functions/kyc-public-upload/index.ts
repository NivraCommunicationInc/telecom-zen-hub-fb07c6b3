/**
 * kyc-public-upload â€” Anonymous endpoint to upload KYC ID documents.
 *
 * Phase 2 (3-step wizard): accepts THREE files via multipart/form-data
 *   - front   : recto of the ID document
 *   - back    : verso of the ID document
 *   - selfie  : selfie holding the document
 * Plus a `document_type` discriminator (passport, driver_license, â€¦).
 *
 * Behaviour:
 *   1. Validate the public token via RPC.
 *   2. Upload all three files to the `id-documents` bucket under
 *      kyc-requests/<requestId>/<slot>-<rand>.<ext>.
 *   3. Mark the kyc_requests row as completed (RPC, idempotent).
 *   4. Update the matching identity_verification_sessions row for the same
 *      order with document_front_path / document_back_path / selfie_path /
 *      document_type / status='submitted' so the agent KycStep displays them.
 *   5. Notify the admin team by email (best-effort).
 *
 * Backwards compatibility: a legacy `file` field (single upload) is still
 * accepted and treated as the front of an "other_government" document.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const VALID_DOC_TYPES = new Set(["passport", "driver_license", "provincial_id", "permanent_resident", "other_government"]);

function jsonResp(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateFile(file: File | null, label: string): string | null {
  if (!file) return `Missing ${label}`;
  if (!ALLOWED_TYPES.includes(file.type)) return `Type de fichier non autorisé (${label})`;
  if (file.size > MAX_SIZE) return `Fichier trop volumineux (${label}, max 10 Mo)`;
  return null;
}

async function uploadOne(supabase: any, requestId: string, slot: string, file: File): Promise<{ path?: string; error?: string }> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const safeName = `${slot}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `kyc-requests/${requestId}/${safeName}`;
  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from("id-documents").upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };
  return { path };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const form = await req.formData();
    const token = String(form.get("token") || "");
    if (!token) return jsonResp({ error: "Missing token" }, 400, corsHeaders);

    const docType = String(form.get("document_type") || "other_government");
    if (!VALID_DOC_TYPES.has(docType)) return jsonResp({ error: "document_type invalide" }, 400, corsHeaders);

    // Accept either the 3-file payload (preferred) or the legacy single `file`
    const front = (form.get("front") as File | null) ?? (form.get("file") as File | null);
    const back = form.get("back") as File | null;
    const selfie = form.get("selfie") as File | null;

    const isThreeFile = !!form.get("front") || !!back || !!selfie;

    const fErr = validateFile(front, "recto");
    if (fErr) return jsonResp({ error: fErr }, 400, corsHeaders);
    if (isThreeFile) {
      const bErr = validateFile(back, "verso");
      if (bErr) return jsonResp({ error: bErr }, 400, corsHeaders);
      const sErr = validateFile(selfie, "selfie");
      if (sErr) return jsonResp({ error: sErr }, 400, corsHeaders);
    }

    // Resolve token via RPC
    const { data: rows, error: rpcErr } = await supabase.rpc("get_kyc_request_by_token", { p_token: token });
    if (rpcErr) return jsonResp({ error: rpcErr.message }, 500, corsHeaders);
    const reqRow = rows?.[0];
    if (!reqRow) return jsonResp({ error: "Lien invalide" }, 404, corsHeaders);
    if (new Date(reqRow.expires_at).getTime() < Date.now()) return jsonResp({ error: "Lien expiré" }, 410, corsHeaders);
    if (reqRow.status !== "pending") return jsonResp({ error: "Demande déjÃ  traitée", status: reqRow.status }, 409, corsHeaders);

    // Upload all files
    const uploadedPaths: string[] = [];
    const cleanup = async () => {
      if (uploadedPaths.length) {
        await supabase.storage.from("id-documents").remove(uploadedPaths).catch(() => {});
      }
    };

    const upFront = await uploadOne(supabase, reqRow.id, "front", front!);
    if (upFront.error) return jsonResp({ error: upFront.error }, 500, corsHeaders);
    uploadedPaths.push(upFront.path!);

    let backPath: string | null = null;
    let selfiePath: string | null = null;

    if (isThreeFile) {
      const upBack = await uploadOne(supabase, reqRow.id, "back", back!);
      if (upBack.error) { await cleanup(); return jsonResp({ error: upBack.error }, 500, corsHeaders); }
      uploadedPaths.push(upBack.path!);
      backPath = upBack.path!;

      const upSelf = await uploadOne(supabase, reqRow.id, "selfie", selfie!);
      if (upSelf.error) { await cleanup(); return jsonResp({ error: upSelf.error }, 500, corsHeaders); }
      uploadedPaths.push(upSelf.path!);
      selfiePath = upSelf.path!;
    }

    // Mark kyc_requests as completed via RPC (idempotent + sets orders.kyc_status)
    const { data: completeRes, error: completeErr } = await supabase.rpc("complete_kyc_request_by_token", {
      p_token: token,
      p_document_path: upFront.path!,
    });
    if (completeErr || !(completeRes as any)?.success) {
      await cleanup();
      return jsonResp({ error: completeErr?.message || (completeRes as any)?.error || "Échec" }, 500, corsHeaders);
    }

    // Mirror onto identity_verification_sessions for the same order so the
    // agent-side KycStep shows all 3 photos. Best-effort: if no session row
    // exists yet for this order, we skip silently â€” the admin can still
    // open the document via the kyc_requests row.
    if (reqRow.order_id) {
      try {
        const { data: ivsRows } = await supabase
          .from("identity_verification_sessions")
          .select("id")
          .eq("order_id", reqRow.order_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const ivsId = ivsRows?.[0]?.id;
        if (ivsId) {
          await supabase
            .from("identity_verification_sessions")
            .update({
              document_front_path: upFront.path!,
              document_back_path: backPath,
              selfie_path: selfiePath,
              document_type: docType,
              status: "submitted",
              submitted_at: new Date().toISOString(),
            } as any)
            .eq("id", ivsId);
        }
      } catch (e) {
        console.warn("[kyc-public-upload] IVS mirror failed:", e);
      }
    }

    // Notify admin team
    try {
      await enqueueEmail({
        to: "support@nivra-telecom.ca",
        subject: `KYC complété â€” Commande #${reqRow.order_number || reqRow.order_id?.slice(0, 8)} en attente d'approbation`,
        html: `<p>Une vérification d'identité vient d'être complétée par <strong>${reqRow.client_email}</strong>.</p>
<p>Commande: <strong>#${reqRow.order_number || reqRow.order_id}</strong></p>
<p>Type de document: <strong>${docType}</strong></p>
<p>Le document est en attente de revue dans Nivra Core â†’ Commandes.</p>`,
        messageType: "kyc_completed_admin",
        entityType: "kyc_request",
        entityId: reqRow.id,
        eventKey: `kyc_completed_admin_${reqRow.id}`,
      });
    } catch (e) {
      console.warn("[kyc-public-upload] Admin notify failed:", e);
    }

    return jsonResp({ success: true }, 200, corsHeaders);
  } catch (err) {
    console.error("[kyc-public-upload] Error:", err);
    return jsonResp({ error: err?.message || "Unknown error" }, 500, corsHeaders);
  }
});
