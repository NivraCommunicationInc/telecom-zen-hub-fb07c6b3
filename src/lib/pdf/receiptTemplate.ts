/**
 * Nivra Receipt Template V3.0 — LOCKED PRODUCTION (2026-03-18)
 * 
 * Standalone payment proof with full customer identity.
 * Approved as the only production receipt template.
 * 
 * Layout:
 * ┌─────────────────────────────────────────────┐
 * │ GREEN HEADER: NIVRA — REÇU DE PAIEMENT     │
 * ├─────────────────────────────────────────────┤
 * │ Large "PAYÉ" watermark                       │
 * │ Full client identity (name, address, etc.)   │
 * │ Payment details (amount, method, date)       │
 * │ Invoice & order reference                    │
 * │ Brief billed items summary                   │
 * ├─────────────────────────────────────────────┤
 * │ Compact footer                               │
 * └─────────────────────────────────────────────┘
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA, PDF_THEME } from "./companyInfo";

const C = PDF_THEME;

// ============================================================================
// DATA INTERFACE — Full customer identity (approved 2026-03-18)
// ============================================================================

export interface ReceiptData {
  receipt_number: string;
  payment_date: string;
  payment_method: string;
  amount_paid: number;

  // Invoice / order reference
  invoice_number: string;
  invoice_total: number;
  order_number?: string;

  // Full client identity
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  account_number: string;

  // Billed items summary (brief, not full invoice duplication)
  billed_items?: Array<{
    description: string;
    amount: number;
  }>;

  // Optional
  transaction_reference?: string;
  balance_remaining?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  try { return new Date(dateStr).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return dateStr || "—"; }
};

const fmtPayMethod = (m: string): string => {
  const map: Record<string, string> = {
    PayPal: "PayPal", paypal: "PayPal", Interac: "Virement Interac",
    interac: "Virement Interac", e_transfer: "Virement Interac",
    "Credit Card": "Carte de crédit", card: "Carte de crédit",
    cash: "Comptant", Manual: "Manuel", stripe: "Carte de crédit",
  };
  return map[m] || m;
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateReceiptPDF(data: ReceiptData): PDFGenerationResult {
  try {
    if (!data.receipt_number) return { success: false, error: "Numéro de reçu manquant" };
    if (!data.client_name) return { success: false, error: "Nom du client manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 20;
    const cw = pw - m * 2;

    // White background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, ph, "F");

    // ========================================================================
    // GREEN HEADER — distinct from invoice navy header
    // ========================================================================
    doc.setFillColor(...C.success);
    doc.rect(0, 0, pw, 36, "F");

    // Lighter green accent
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 36, pw, 2, "F");

    // Company name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(NIVRA.legalName, m, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(220, 252, 231);
    doc.text(NIVRA.address, m, 21);
    doc.text(`${NIVRA.email} | ${NIVRA.website}`, m, 27);

    // Document type
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("REÇU DE PAIEMENT", pw - m, 16, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(220, 252, 231);
    doc.text(`NEQ: ${NIVRA.neq}`, pw - m, 24, { align: "right" });

    let y = 48;

    // ========================================================================
    // LARGE "PAYÉ" WATERMARK STAMP
    // ========================================================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(72);
    doc.setTextColor(22, 163, 74, 0.08);
    // @ts-ignore - jspdf supports alpha via GState
    const gState = new (doc as any).GState({ opacity: 0.06 });
    (doc as any).setGState(gState);
    doc.text("PAYÉ", pw / 2, 140, { align: "center", angle: -25 });
    const gStateNormal = new (doc as any).GState({ opacity: 1 });
    (doc as any).setGState(gStateNormal);

    // ========================================================================
    // RECEIPT DETAILS — centered card
    // ========================================================================
    const cardW = 140;
    const cardX = (pw - cardW) / 2;

    // Receipt number banner
    doc.setFillColor(22, 163, 74);
    doc.roundedRect(cardX, y, cardW, 14, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`Reçu Nº ${data.receipt_number}`, pw / 2, y + 9, { align: "center" });
    y += 22;

    // Payment info card
    doc.setFillColor(240, 253, 244); // very light green
    doc.setDrawColor(187, 247, 208);
    doc.setLineWidth(0.5);
    doc.roundedRect(cardX, y, cardW, 62, 3, 3, "FD");
    doc.setLineWidth(0.2);

    let fy = y + 10;
    const drawReceiptField = (label: string, value: string, isBold = false) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(label, cardX + 12, fy);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(isBold ? 10 : 9);
      doc.setTextColor(15, 23, 42);
      doc.text(value, cardX + cardW - 12, fy, { align: "right" });
      fy += 9;
    };

    drawReceiptField("Date de paiement", fmtDate(data.payment_date));
    drawReceiptField("Mode de paiement", fmtPayMethod(data.payment_method));
    drawReceiptField("Montant payé", fmt(data.amount_paid), true);

    // Separator
    doc.setDrawColor(187, 247, 208);
    doc.line(cardX + 12, fy - 3, cardX + cardW - 12, fy - 3);
    fy += 3;

    drawReceiptField("Facture Nº", data.invoice_number);
    drawReceiptField("Total facture", fmt(data.invoice_total));

    if (data.balance_remaining !== undefined && data.balance_remaining > 0) {
      drawReceiptField("Solde restant", fmt(data.balance_remaining));
    }

    y += 70;

    // ========================================================================
    // CLIENT REFERENCE — compact
    // ========================================================================
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(cardX, y, cardW, 32, 3, 3, "F");

    fy = y + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.navy);
    doc.text("CLIENT", cardX + 12, fy);
    fy += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text);
    doc.text(data.client_name, cardX + 12, fy);
    fy += 5;
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textMuted);
    doc.text(`${data.client_email} | Compte: ${data.account_number}`, cardX + 12, fy);
    fy += 5;
    if (data.transaction_reference) {
      doc.text(`Réf. transaction: ${data.transaction_reference}`, cardX + 12, fy);
    }

    y += 42;

    // ========================================================================
    // LEGAL NOTE — minimal
    // ========================================================================
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    const legalNote = "Ce reçu confirme la réception du paiement indiqué ci-dessus. Il ne remplace pas la facture officielle. " +
      "Conservez ce document pour vos dossiers. Pour toute question, contactez-nous à " + NIVRA.email + ".";
    const legalLines = doc.splitTextToSize(legalNote, cardW);
    doc.text(legalLines, cardX, y);

    // ========================================================================
    // COMPACT GREEN FOOTER
    // ========================================================================
    doc.setFillColor(...C.success);
    doc.rect(0, ph - 16, pw, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 10, { align: "center" });
    doc.text(`${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`, pw / 2, ph - 5.5, { align: "center" });

    const blob = doc.output("blob");
    const filename = `Recu_${data.receipt_number}.pdf`;
    return { success: true, blob, filename };
  } catch (error) {
    console.error("[ReceiptTemplate] Generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

export default generateReceiptPDF;
