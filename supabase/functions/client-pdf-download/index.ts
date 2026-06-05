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
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  buildInvoicePdfAttachment,
  buildReceiptPdfAttachment,
  buildContractPdfAttachment,
  buildSummaryPdfAttachment,
} from "../_shared/pdfFromDb.ts";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY            = Deno.env.get("SUPABASE_ANON_KEY")!;

type DocType = "invoice" | "receipt" | "contract" | "summary";

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
  } catch {
    return new Response(JSON.stringify({ error: "Paramètres manquants: type et id requis" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!["invoice","receipt","contract","summary"].includes(type)) {
    return new Response(JSON.stringify({ error: "Type invalide" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  /* ── 3. Verify ownership with service role ─────────────────────── */
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let ownerUserId: string | null = null;
  let orderId: string | null = null;
  let filename = `Nivra_Document_${id.slice(0, 8)}.pdf`;

  try {
    if (type === "invoice" || type === "receipt") {
      const { data: inv } = await admin
        .from("billing_invoices")
        .select("id, invoice_number, order_id, customer:billing_customers(user_id)")
        .eq("id", id)
        .maybeSingle();

      ownerUserId = (inv as any)?.customer?.user_id ?? null;
      orderId     = (inv as any)?.order_id ?? null;
      const num   = (inv as any)?.invoice_number ?? id.slice(0, 8);
      filename    = type === "receipt" ? `Recu_Nivra_${num}.pdf` : `Facture_Nivra_${num}.pdf`;

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

  return new Response(bytes.buffer, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Content-Length": bytes.length.toString(),
      "Cache-Control": "private, no-store",
    },
  });
});
