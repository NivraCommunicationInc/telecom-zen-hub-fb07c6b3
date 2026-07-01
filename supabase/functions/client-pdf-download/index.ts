/**
 * client-pdf-download
 *
 * Secure server-side PDF generation for authenticated portal clients.
 * Uses the service role key to bypass all RLS issues, then verifies
 * the requesting user actually owns the document before generating.
 *
 * POST body: { type: "invoice" | "receipt" | "contract" | "summary", id: string }
 * Authorization: Bearer <portal client JWT>
 *
 * Returns: binary PDF with Content-Type: application/pdf
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import jsPDFModule from "npm:jspdf@2.5.2";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;

import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  buildInvoicePdfAttachment,
  buildReceiptPdfAttachment,
  buildContractPdfAttachment,
  buildSummaryPdfAttachment,
} from "../_shared/pdfFromDb.ts";
import { b64ToBytes, addWatermarkToPdf } from "../_shared/pdfMerge.ts";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY            = Deno.env.get("SUPABASE_ANON_KEY")!;

// ── type "dossier" is handled by the standalone client-dossier-pdf function ──
// ── type "kyc-watermarked" wraps an id-documents image as a stamped PDF ──
type DocType = "invoice" | "receipt" | "contract" | "summary" | "kyc-watermarked";

// ── Generate a watermarked PDF wrapper around a KYC image ──────────────────
async function buildKycWatermarkedPdf(
  admin: ReturnType<typeof createClient>,
  storagePath: string,
  watermarkText: string,
): Promise<Uint8Array | null> {
  // Download image from id-documents bucket
  const { data: fileData, error } = await admin.storage
    .from("id-documents")
    .download(storagePath);
  if (error || !fileData) {
    console.warn("[client-pdf-download] KYC image not found:", storagePath, error?.message);
    return null;
  }

  const buf = await fileData.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // Build a jsPDF page with the image
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297;

  // Determine image type from extension
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const imgFormat = ext === "png" ? "PNG" : "JPEG";

  // Convert Uint8Array to data URL
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  }
  const dataUrl = `data:image/${ext === "png" ? "png" : "jpeg"};base64,${btoa(binary)}`;

  // Embed image centered on page with margins
  doc.addImage(dataUrl, imgFormat, 10, 20, W - 20, H - 50);

  // Footer metadata
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Source: ${storagePath}`, 10, H - 8);

  const pdfBytes = new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);

  // Apply watermark using pdf-lib
  return addWatermarkToPdf(pdfBytes, watermarkText);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req.headers.get("origin"));

  /* ── 1. Authenticate the portal client ─────────────────────────── */
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Verify the JWT against Supabase auth
  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Token invalide ou expiré" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  /* ── 2. Parse request body ─────────────────────────────────────── */
  let type: DocType;
  let id: string;
  try {
    const body = await req.json();
    type = body.type;
    id   = body.id;
    if (!type || !id) throw new Error("missing type or id");
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Paramètres manquants: type et id requis" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // "dossier" is served by client-dossier-pdf — forward with same auth
  if (type === ("dossier" as DocType)) {
    const dossierId = `${SUPABASE_URL}/functions/v1/client-dossier-pdf`;
    const fwd = await fetch(dossierId, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const fwdBody = await fwd.arrayBuffer();
    return new Response(fwdBody, {
      status: fwd.status,
      headers: {
        ...cors,
        "Content-Type": fwd.headers.get("Content-Type") ?? "application/pdf",
        "Content-Disposition": fwd.headers.get("Content-Disposition") ?? "",
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (!["invoice","receipt","contract","summary","kyc-watermarked"].includes(type)) {
    return new Response(JSON.stringify({ error: "Type invalide" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  /* ── 3. Verify ownership with service role ─────────────────────── */
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  /* ── 3b. kyc-watermarked: verify the session belongs to this user ──── */
  if (type === "kyc-watermarked") {
    // id = identity_verification_sessions.id OR direct storage path
    let storagePath: string | null = null;
    let sessionUserId: string | null = null;

    // Try to look up the session
    const { data: session } = await admin
      .from("identity_verification_sessions")
      .select("user_id, document_paths")
      .eq("id", id)
      .maybeSingle();

    if (session) {
      sessionUserId = (session as any).user_id ?? null;
      const paths = (session as any).document_paths;
      storagePath = Array.isArray(paths) && paths.length > 0 ? paths[0] : null;
    }

    if (!sessionUserId || sessionUserId !== user.id) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!storagePath) {
      return new Response(JSON.stringify({ error: "Document KYC introuvable" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const dateStamp = new Date().toLocaleDateString("fr-CA");
    const watermarkText = `COPIE — Nivra Telecom — ${dateStamp}`;
    const kycPdf = await buildKycWatermarkedPdf(admin, storagePath, watermarkText);

    if (!kycPdf) {
      return new Response(JSON.stringify({ error: "Impossible de générer le PDF KYC" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(kycPdf.buffer, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="KYC_Watermarked_${id.slice(0, 8)}.pdf"`,
        "Content-Length": kycPdf.length.toString(),
        "Cache-Control": "private, no-store",
      },
    });
  }

  let ownerUserId: string | null = null;
  let orderId: string | null = null;
  let filename = `Nivra_Document_${id.slice(0, 8)}.pdf`;

  try {
    if (type === "invoice" || type === "receipt") {
      const { data: inv } = await admin
        .from("billing_invoices")
        .select("id, invoice_number, order_id, customer:billing_customers(id, user_id)")
        .eq("id", id)
        .maybeSingle();

      ownerUserId = (inv as any)?.customer?.user_id ?? null;
      orderId     = (inv as any)?.order_id ?? null;
      const num   = (inv as any)?.invoice_number ?? id.slice(0, 8);
      filename    = type === "receipt" ? `Recu_Nivra_${num}.pdf` : `Facture_Nivra_${num}.pdf`;

      // Fallback: billing_customers.user_id is sometimes null — look up via the order
      if (!ownerUserId && orderId) {
        const { data: ord } = await admin.from("orders").select("user_id").eq("id", orderId).maybeSingle();
        ownerUserId = (ord as any)?.user_id ?? null;
      }
      // Last resort: look up via accounts linked to billing_customer
      if (!ownerUserId) {
        const custId = (inv as any)?.customer?.id;
        if (custId) {
          const { data: acct } = await admin.from("accounts").select("client_id").eq("billing_customer_id", custId).maybeSingle();
          ownerUserId = (acct as any)?.client_id ?? null;
        }
      }

    } else if (type === "contract") {
      // id can be a contract id OR an order id
      const { data: ct } = await admin
        .from("contracts")
        .select("id, contract_number, order_id, orders(user_id, order_number)")
        .eq("id", id)
        .maybeSingle();

      if (ct) {
        ownerUserId = (ct as any).orders?.user_id ?? null;
        orderId     = (ct as any).order_id ?? null;
        filename    = `Contrat_Nivra_${(ct as any).contract_number ?? id.slice(0,8)}.pdf`;
      } else {
        // Maybe it's an order id
        const { data: ord } = await admin
          .from("orders")
          .select("id, user_id, order_number")
          .eq("id", id)
          .maybeSingle();
        ownerUserId = (ord as any)?.user_id ?? null;
        orderId     = id;
        filename    = `Contrat_Nivra_${(ord as any)?.order_number ?? id.slice(0,8)}.pdf`;
      }

    } else if (type === "summary") {
      const { data: ord } = await admin
        .from("orders")
        .select("id, user_id, order_number")
        .eq("id", id)
        .maybeSingle();
      ownerUserId = (ord as any)?.user_id ?? null;
      orderId     = id;
      filename    = `Sommaire_Nivra_${(ord as any)?.order_number ?? id.slice(0,8)}.pdf`;
    }
  } catch (e) {
    console.error("[client-pdf-download] ownership check failed:", e);
    return new Response(JSON.stringify({ error: "Erreur de vérification" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!ownerUserId || ownerUserId !== user.id) {
    console.warn(`[client-pdf-download] access denied: doc owner=${ownerUserId}, requester=${user.id}`);
    return new Response(JSON.stringify({ error: "Accès refusé" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  /* ── 4. Generate the PDF ───────────────────────────────────────── */
  let attachment: { filename: string; content: string; contentType: string } | null = null;

  try {
    switch (type) {
      case "invoice":
        attachment = await buildInvoicePdfAttachment(id);
        break;
      case "receipt":
        attachment = await buildReceiptPdfAttachment(id);
        break;
      case "contract":
        attachment = await buildContractPdfAttachment(orderId ?? id);
        break;
      case "summary":
        attachment = await buildSummaryPdfAttachment(orderId ?? id);
        break;
    }
  } catch (e) {
    console.error("[client-pdf-download] PDF generation error:", e);
    return new Response(JSON.stringify({ error: "Erreur de génération du PDF" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!attachment || !attachment.content) {
    return new Response(JSON.stringify({ error: "Document non disponible. Vérifiez que la commande est complète." }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  /* ── 5. Return binary PDF ──────────────────────────────────────── */
  const binaryStr = atob(attachment.content);
  const bytes     = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const finalFilename = attachment.filename || filename;
  return new Response(bytes.buffer, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(finalFilename)}"`,
      "Content-Length": bytes.length.toString(),
      "Cache-Control": "private, no-store",
    },
  });
});
