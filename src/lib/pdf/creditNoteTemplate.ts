/**
 * Nivra Credit Note Template V1.0 — PRODUCTION
 *
 * Canonical layout (matches LOCKED_TEMPLATES.md V4.0 standard):
 * ┌─────────────────────────────────────────────┐
 * │ NAVY HEADER: NIVRA TELECOM   No XXXXXXX    │
 * │ NOTE DE CREDIT                              │
 * ├─────────────────────────────────────────────┤
 * │ Client info          Adresse de service     │
 * │ Compte / Facture liee                       │
 * │ Date emission                               │
 * ├─────────────────────────────────────────────┤
 * │ Motif du credit (encadre)                   │
 * ├─────────────────────────────────────────────┤
 * │ Description | Montant (table)               │
 * ├─────────────────────────────────────────────┤
 * │ Sous-total / TPS / TVQ / TOTAL CREDITE      │
 * │ Application: porte au compte / rembourse    │
 * ├─────────────────────────────────────────────┤
 * │ Footer canonique                            │
 * └─────────────────────────────────────────────┘
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA, TAX } from "./companyInfo";

// ============================================================================
// DATA INTERFACE
// ============================================================================

export interface CreditNoteData {
  credit_note_number: string;
  issue_date: string;

  // Reference invoice
  invoice_number: string;
  invoice_date?: string;

  // Client
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;

  // Reason (free text, max ~500 chars recommended)
  reason: string;

  // Credited line items
  items: Array<{
    description: string;
    amount: number; // positive value (the credit amount)
  }>;

  // Canonical totals (already computed upstream)
  subtotal: number;
  tps_amount: number;
  tvq_amount: number;
  total: number;

  // Application
  application_type: "account_credit" | "refund_pending" | "refund_processed";
  refund_method?: string; // if refund: "Carte de credit", "Virement Interac", etc.
}

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  const ymd = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return `${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
  }
  return "—";
};

const applicationLabel = (type: string, method?: string): string => {
  switch (type) {
    case "account_credit": return "Credit porte au compte client";
    case "refund_pending": return `Remboursement a venir${method ? ` (${method})` : ""}`;
    case "refund_processed": return `Remboursement effectue${method ? ` (${method})` : ""}`;
    default: return "—";
  }
};

// Wrap text into multiple lines fitting maxWidth (mm)
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

// ============================================================================
// HEADER & FOOTER
// ============================================================================

function drawHeader(doc: jsPDF, docNumber: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 64, 120);
  doc.rect(0, 0, pw, 40, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("NOTE DE CREDIT", 15, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`No ${docNumber}`, pw - 15, 18, { align: "right" });
}

function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${NIVRA.tradeName} Inc. | ${NIVRA.email} | ${NIVRA.website}`,
    pw / 2, ph - 18, { align: "center" }
  );
  doc.text(
    `${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`,
    pw / 2, ph - 13, { align: "center" }
  );
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateCreditNotePDF(data: CreditNoteData): PDFGenerationResult {
  try {
    if (!data.credit_note_number) return { success: false, error: "Numero de note de credit manquant" };
    if (!data.client_name || !data.client_email) return { success: false, error: "Informations client incompletes" };
    if (!data.items || data.items.length === 0) return { success: false, error: "Aucun item credite" };
    if (!data.invoice_number) return { success: false, error: "Facture liee manquante" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // HEADER
    drawHeader(doc, data.credit_note_number);

    // CLIENT BLOCK
    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Client", 15, y);
    doc.text("Adresse de service", 110, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(data.client_name, 15, y);
    if (data.client_address) doc.text(data.client_address, 110, y);
    y += 5;
    doc.text(data.client_email, 15, y);
    if (data.client_city) {
      doc.text(`${data.client_city}, ${data.client_province || "QC"} ${data.client_postal || ""}`, 110, y);
    }
    y += 5;
    if (data.client_phone) { doc.text(data.client_phone, 15, y); y += 5; }

    doc.setFontSize(8);
    doc.text(`Compte: ${data.account_number}  |  Facture liee: ${data.invoice_number}`, 15, y);
    y += 8;

    // DATES
    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    if (data.invoice_date) doc.text(`Date de la facture: ${fmtDate(data.invoice_date)}`, 110, y);
    y += 10;

    // REASON BOX
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Motif du credit", 15, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const reasonLines = wrapText(doc, data.reason, 165);
    const reasonBoxHeight = Math.max(8, reasonLines.length * 4.5 + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, 170, reasonBoxHeight, 1, 1, "FD");
    doc.setTextColor(40, 40, 40);
    let ry = y + 5;
    for (const line of reasonLines) {
      doc.text(line, 17, ry);
      ry += 4.5;
    }
    y += reasonBoxHeight + 8;

    // ITEMS TABLE HEADER
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 170, 7, "F");
    doc.setTextColor(0, 0, 0);
    doc.text("Description", 17, y + 5);
    doc.text("Montant credite", 180, y + 5, { align: "right" });
    y += 8;

    // ITEMS
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const item of data.items) {
      const descLines = wrapText(doc, item.description, 155);
      doc.setTextColor(0, 0, 0);
      let dy = y + 4;
      for (const dl of descLines) {
        doc.text(dl, 17, dy);
        dy += 4.5;
      }
      doc.setTextColor(180, 50, 50);
      doc.text(`-${fmt(item.amount)}`, 180, y + 4, { align: "right" });
      const rowHeight = Math.max(7, descLines.length * 4.5 + 2);
      doc.setDrawColor(230, 230, 230);
      doc.line(15, y + rowHeight, 185, y + rowHeight);
      y += rowHeight;
    }

    doc.setTextColor(0, 0, 0);
    y += 6;

    // TOTALS
    const tx = 120;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Sous-total credite", tx, y);
    doc.text(`-${fmt(data.subtotal)}`, 180, y, { align: "right" });
    y += 6;
    doc.text(TAX.GST_LABEL, tx, y);
    doc.text(`-${fmt(data.tps_amount)}`, 180, y, { align: "right" });
    y += 6;
    doc.text(TAX.QST_LABEL, tx, y);
    doc.text(`-${fmt(data.tvq_amount)}`, 180, y, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(180, 50, 50);
    doc.text("TOTAL CREDITE", tx, y);
    doc.text(`-${fmt(data.total)}`, 180, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 12;

    // APPLICATION BOX
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Application du credit", 15, y);
    y += 5;
    doc.setFillColor(240, 248, 255);
    doc.setDrawColor(30, 64, 120);
    doc.roundedRect(15, y, 170, 10, 1, 1, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 64, 120);
    doc.text(applicationLabel(data.application_type, data.refund_method), 105, y + 6.5, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // FOOTER
    drawFooter(doc);

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Note_de_credit_${data.credit_note_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[CreditNote] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateCreditNotePDF;
