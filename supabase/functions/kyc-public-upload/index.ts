/**
 * kyc-public-upload — Anonymous endpoint to upload an ID document for a KYC request.
 *
 * Validates the public token, accepts a file via multipart/form-data,
 * uploads it to the `id-documents` bucket under `kyc-requests/<requestId>/<file>`,
 * marks the request as completed via RPC, and notifies the admin team.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const form = await req.formData();
    const token = String(form.get("token") || "");
    const file = form.get("file") as File | null;

    if (!token) return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!file) return new Response(JSON.stringify({ error: "Missing file" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!ALLOWED_TYPES.includes(file.type)) return new Response(JSON.stringify({ error: "Type de fichier non autorisé" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (file.size > MAX_SIZE) return new Response(JSON.stringify({ error: "Fichier trop volumineux (max 10 Mo)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Resolve token via RPC
    const { data: rows, error: rpcErr } = await supabase.rpc("get_kyc_request_by_token", { p_token: token });
    if (rpcErr) return new Response(JSON.stringify({ error: rpcErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const reqRow = rows?.[0];
    if (!reqRow) return new Response(JSON.stringify({ error: "Lien invalide" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (new Date(reqRow.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({ error: "Lien expiré" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (reqRow.status !== "pending") return new Response(JSON.stringify({ error: "Demande déjà traitée", status: reqRow.status }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Upload
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `kyc-requests/${reqRow.id}/${safeName}`;
    const buffer = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage.from("id-documents").upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Mark completed via RPC
    const { data: completeRes, error: completeErr } = await supabase.rpc("complete_kyc_request_by_token", {
      p_token: token,
      p_document_path: path,
    });
    if (completeErr || !(completeRes as any)?.success) {
      // Best-effort cleanup
      await supabase.storage.from("id-documents").remove([path]).catch(() => {});
      return new Response(JSON.stringify({ error: completeErr?.message || (completeRes as any)?.error || "Échec" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Notify admin team
    try {
      await enqueueEmail({
        to: "support@nivra-telecom.ca",
        subject: `KYC complété — Commande #${reqRow.order_number || reqRow.order_id?.slice(0, 8)} en attente d'approbation`,
        html: `<p>Une vérification d'identité vient d'être complétée par <strong>${reqRow.client_email}</strong>.</p>
<p>Commande: <strong>#${reqRow.order_number || reqRow.order_id}</strong></p>
<p>Le document est en attente de revue dans Nivra Core → Commandes.</p>`,
        messageType: "kyc_completed_admin",
        entityType: "kyc_request",
        entityId: reqRow.id,
        eventKey: `kyc_completed_admin_${reqRow.id}`,
      });
    } catch (e) {
      console.warn("[kyc-public-upload] Admin notify failed:", e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[kyc-public-upload] Error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
