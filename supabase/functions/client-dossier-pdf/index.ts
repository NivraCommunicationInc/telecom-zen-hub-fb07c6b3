/**
 * client-dossier-pdf
 *
 * Génère un dossier_client_[nom]_[date].pdf fusionné contenant :
 *   1. Page de couverture (générée via jsPDF)
 *   2. Contrat le plus récent du client
 *   3. 3 dernières factures émises
 *   4. Sommaire de commande / confirmation d'activation (dernière commande)
 *
 * Auth : JWT portail client (même que client-pdf-download)
 *
 * POST body (optionnel) : {}
 * Returns : binary PDF — Content-Type: application/pdf
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import jsPDFModule from "npm:jspdf@2.5.2";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;

import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  buildInvoicePdfAttachment,
  buildContractPdfAttachment,
  buildSummaryPdfAttachment,
} from "../_shared/pdfFromDb.ts";
import { mergePdfs, addWatermarkToPdf, b64ToBytes } from "../_shared/pdfMerge.ts";
import { NIVRA } from "../_shared/locked-pdf/companyInfo.ts";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;

// ── Cover page ─────────────────────────────────────────────────────────────
function buildCoverPagePdf(clientName: string, dateLabel: string): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;

  // Navy header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 55, "F");

  // Logo area
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("NIVRA TELECOM", 15, 22);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(NIVRA.tagline, 15, 31);
  doc.text(NIVRA.address, 15, 38);
  doc.text(`Support : ${NIVRA.email}  |  ${NIVRA.website}`, 15, 45);

  // Teal accent bar
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 55, W, 3, "F");

  // Title block
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("DOSSIER CLIENT", W / 2, 100, { align: "center" });

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Ensemble des documents contractuels et financiers", W / 2, 112, { align: "center" });

  // Client info box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(25, 130, 160, 50, 4, 4, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Client", 35, 147);
  doc.setFont("helvetica", "normal");
  doc.text(clientName, 35, 156);

  doc.setFont("helvetica", "bold");
  doc.text("Date de génération", 120, 147);
  doc.setFont("helvetica", "normal");
  doc.text(dateLabel, 120, 156);

  // Contents section
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Contenu de ce dossier", 25, 205);

  const items = [
    "Contrat de service le plus récent",
    "3 dernières factures émises",
    "Sommaire de commande / Confirmation d'activation",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  items.forEach((item, i) => {
    doc.setFillColor(20, 184, 166);
    doc.circle(28, 218 + i * 12, 1.5, "F");
    doc.text(item, 34, 220 + i * 12);
  });

  // Confidentiality notice
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(239, 68, 68);
  doc.roundedRect(25, 258, 160, 22, 3, 3, "FD");
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DOCUMENT CONFIDENTIEL", W / 2, 266, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Réservé au client désigné. Ne pas distribuer.", W / 2, 273, { align: "center" });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Généré le ${dateLabel} — ${NIVRA.legalName} — NEQ ${NIVRA.neq}`, W / 2, H - 8, { align: "center" });

  const blob = doc.output("arraybuffer");
  return new Uint8Array(blob);
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req.headers.get("origin"));

  /* 1. Auth */
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Token invalide ou expiré" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  /* 2. Fetch client profile */
  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name, full_name, email, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  const clientName =
    (profile as any)?.full_name ||
    [(profile as any)?.first_name, (profile as any)?.last_name].filter(Boolean).join(" ") ||
    (profile as any)?.email ||
    user.email ||
    "Client";

  const dateLabel = new Date().toLocaleDateString("fr-CA", {
    year: "numeric", month: "long", day: "numeric",
  });
  const dateSlug = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  /* 3. Find most recent order → contract + summary */
  const { data: latestOrder } = await admin
    .from("orders")
    .select("id, order_number")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderId = (latestOrder as any)?.id as string | null;

  /* 4. Find 3 most recent billing_invoices */
  const { data: billingCustomer } = await admin
    .from("billing_customers")
    .select("id")
    .or(`user_id.eq.${user.id},email.eq.${profile?.email || "NULL"}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bcId = (billingCustomer as any)?.id as string | null;

  let invoiceIds: string[] = [];
  if (bcId) {
    const { data: invoices } = await admin
      .from("billing_invoices")
      .select("id")
      .eq("customer_id", bcId)
      .order("created_at", { ascending: false })
      .limit(3);
    invoiceIds = ((invoices as any[]) || []).map((i) => i.id);
  }
  // Also try user_id directly on orders if billing_customers misses it
  if (invoiceIds.length === 0 && orderId) {
    const { data: inv } = await admin
      .from("billing_invoices")
      .select("id")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(3);
    invoiceIds = ((inv as any[]) || []).map((i) => i.id);
  }

  /* 5. Generate PDFs in parallel — gracefully skip unavailable ones */
  const [invoicePdfs, contractPdf, summaryPdf] = await Promise.all([
    Promise.all(invoiceIds.map((id) => buildInvoicePdfAttachment(id).catch(() => null))),
    orderId ? buildContractPdfAttachment(orderId).catch(() => null) : null,
    orderId ? buildSummaryPdfAttachment(orderId).catch(() => null) : null,
  ]);

  /* 6. Assemble sources: cover + contract + invoices + summary */
  const coverBytes = buildCoverPagePdf(clientName, dateLabel);

  const sources: Uint8Array[] = [coverBytes];

  if (contractPdf?.content) sources.push(b64ToBytes(contractPdf.content));
  for (const inv of invoicePdfs) {
    if (inv?.content) sources.push(b64ToBytes(inv.content));
  }
  if (summaryPdf?.content) sources.push(b64ToBytes(summaryPdf.content));

  if (sources.length === 1) {
    // Only cover page — no documents found yet
    return new Response(
      JSON.stringify({ error: "Aucun document disponible pour ce compte." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  /* 7. Merge */
  const merged = await mergePdfs(sources);

  /* 8. Filename */
  const safeClientName = clientName.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const filename = `dossier_client_${safeClientName}_${dateSlug}.pdf`;

  return new Response(merged.buffer, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Content-Length": merged.length.toString(),
      "Cache-Control": "private, no-store",
    },
  });
});
