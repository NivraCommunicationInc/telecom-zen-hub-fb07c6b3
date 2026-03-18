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
  try {
    const raw = String(dateStr).trim();

    // Robust parsing for Postgres timestamps (e.g. "2026-03-18 14:19:49.142036+00")
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
      const year = Number(ymd[1]);
      const monthIdx = Number(ymd[2]) - 1;
      const day = Number(ymd[3]);
      const safeDate = new Date(year, monthIdx, day);
      const month = safeDate.toLocaleString("fr-CA", { month: "long" });
      return `${day} ${month} ${year}`;
    }

    const normalized = raw
      .replace(" ", "T")
      .replace(/([+-]\d{2})$/, "$1:00");

    const date = new Date(normalized);
    if (isNaN(date.getTime())) return "—";

    const year = date.getFullYear();
    const month = date.toLocaleString("fr-CA", { month: "long" });
    const day = date.getDate();
    return `${day} ${month} ${year}`;
  } catch {
    return "—";
  }
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

/** Format address with proper casing and postal code spacing */
const fmtAddress = (addr: string | undefined): string => {
  if (!addr) return "";

  let result = addr.trim().replace(/\s+/g, " ");
  const cityFixes: Record<string, string> = {
    "saint jerome": "Saint-Jérôme",
    "saint-jerome": "Saint-Jérôme",
    "saint-j erome": "Saint-Jérôme",
    "st jerome": "Saint-Jérôme",
    "st-jerome": "Saint-Jérôme",
  };

  for (const [key, val] of Object.entries(cityFixes)) {
    result = result.replace(new RegExp(key, "gi"), val);
  }

  // Fix Canadian postal code spacing: J7Z6Z3 -> J7Z 6Z3
  result = result.replace(/([A-Z]\d[A-Z])\s*(\d[A-Z]\d)/gi, "$1 $2");
  return result;
};
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
    // GREEN HEADER
    // ========================================================================
    doc.setFillColor(...C.success);
    doc.rect(0, 0, pw, 36, "F");
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 36, pw, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(NIVRA.legalName, m, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(220, 252, 231);
    doc.text(NIVRA.address, m, 21);
    doc.text(`${NIVRA.email} | ${NIVRA.website}`, m, 27);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("RECU DE PAIEMENT", pw - m, 16, { align: "right" });
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
    const gState = new (doc as any).GState({ opacity: 0.06 });
    (doc as any).setGState(gState);
    doc.text("PAYE", pw / 2, 160, { align: "center", angle: -25 });
    const gStateNormal = new (doc as any).GState({ opacity: 1 });
    (doc as any).setGState(gStateNormal);

    // ========================================================================
    // CLIENT IDENTITY — Full (approved 2026-03-18)
    // ========================================================================
    const halfW = (cw - 6) / 2;

    // Left: Client info
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(m, y, halfW, 48, 2, 2, "F");

    let ly = y + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.navy);
    doc.text("CLIENT", m + 8, ly);
    ly += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text(data.client_name, m + 8, ly);
    ly += 5.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textMuted);
    if (data.client_address) {
      const addrLines = doc.splitTextToSize(fmtAddress(data.client_address), halfW - 16);
      doc.text(addrLines, m + 8, ly);
      ly += addrLines.length * 4;
    }
    if (data.client_phone) {
      doc.text(data.client_phone, m + 8, ly);
      ly += 4;
    }
    doc.text(data.client_email, m + 8, ly);

    // Right: Reference numbers
    const rx = m + halfW + 6;
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(rx, y, halfW, 48, 2, 2, "F");

    let ry = y + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.navy);
    doc.text("REFERENCES", rx + 8, ry);
    ry += 7;

    const drawRefField = (label: string, value: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMuted);
      doc.text(label, rx + 8, ry);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.text(value, rx + halfW - 8, ry, { align: "right" });
      ry += 6;
    };

    drawRefField("Compte", data.account_number);
    drawRefField("Facture", data.invoice_number);
    if (data.order_number) drawRefField("Commande", data.order_number);
    drawRefField("Recu", data.receipt_number);

    y += 56;

    // ========================================================================
    // PAYMENT DETAILS — Green card
    // ========================================================================
    const cardW = cw;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.setLineWidth(0.5);
    doc.roundedRect(m, y, cardW, 50, 3, 3, "FD");
    doc.setLineWidth(0.2);

    let fy = y + 10;
    const drawReceiptField = (label: string, value: string, isBold = false) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(label, m + 12, fy);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(isBold ? 10 : 9);
      doc.setTextColor(15, 23, 42);
      doc.text(value, m + cardW - 12, fy, { align: "right" });
      fy += 9;
    };

    drawReceiptField("Date de paiement", fmtDate(data.payment_date));
    drawReceiptField("Mode de paiement", fmtPayMethod(data.payment_method));
    drawReceiptField("Montant paye", fmt(data.amount_paid), true);

    doc.setDrawColor(187, 247, 208);
    doc.line(m + 12, fy - 3, m + cardW - 12, fy - 3);
    fy += 3;

    drawReceiptField("Total facture", fmt(data.invoice_total));
    if (data.balance_remaining !== undefined && data.balance_remaining > 0) {
      drawReceiptField("Solde restant", fmt(data.balance_remaining));
    }

    if (data.transaction_reference) {
      fy += 1;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(`Ref. transaction: ${data.transaction_reference}`, m + 12, fy);
    }

    y += 58;

    // ========================================================================
    // BILLED ITEMS SUMMARY (brief — not a duplicate invoice)
    // ========================================================================
    if (data.billed_items && data.billed_items.length > 0) {
      doc.setFillColor(...C.lightBg);
      const itemsH = 12 + data.billed_items.length * 6;
      doc.roundedRect(m, y, cardW, itemsH, 2, 2, "F");

      let iy = y + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...C.navy);
      doc.text("SERVICES FACTURES", m + 8, iy);
      iy += 7;

      for (const item of data.billed_items) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.text);
        doc.text(item.description, m + 8, iy);
        doc.text(fmt(item.amount), m + cardW - 8, iy, { align: "right" });
        iy += 6;
      }

      y += itemsH + 6;
    }

    // ========================================================================
    // LEGAL NOTE
    // ========================================================================
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    const legalNote = "Ce recu confirme la reception du paiement indique ci-dessus. Il ne remplace pas la facture officielle. " +
      "Conservez ce document pour vos dossiers. Pour toute question, contactez-nous a " + NIVRA.email + ".";
    const legalLines = doc.splitTextToSize(legalNote, cardW);
    doc.text(legalLines, m, y);

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
    console.error("[ReceiptTemplate V3] Generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

export default generateReceiptPDF;
