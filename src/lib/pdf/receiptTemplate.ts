/**
 * Nivra Receipt Template V4.0 — LOCKED PRODUCTION (2026-03-20)
 * 
 * Approved canonical layout:
 * ┌─────────────────────────────────────────────┐
 * │ GREEN HEADER: NIVRA TELECOM   No XXXXXXX   │
 * │ RECU DE PAIEMENT                            │
 * ├─────────────────────────────────────────────┤
 * │ "P A Y E" watermark (light green, bottom)   │
 * │ Client info + Adresse de service             │
 * │ Payment details (date, method, ref)          │
 * │ Resume des services factures (line items)    │
 * │ Sous-total / TPS / TVQ                       │
 * │ TOTAL PAYE: XX.XX $ (green box)              │
 * ├─────────────────────────────────────────────┤
 * │ Footer                                       │
 * └─────────────────────────────────────────────┘
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA } from "./companyInfo";

// ============================================================================
// DATA INTERFACE
// ============================================================================

export interface ReceiptData {
  receipt_number: string;
  payment_date: string;
  payment_method: string;
  amount_paid: number;

  invoice_number: string;
  invoice_total: number;
  order_number?: string;

  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  account_number: string;

  billed_items?: Array<{
    description: string;
    amount: number;
  }>;

  transaction_reference?: string;
  balance_remaining?: number;
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

const fmtMethod = (m: string): string => {
  const map: Record<string, string> = {
    card: "Carte de credit (Stripe)", "Credit Card": "Carte de credit (Stripe)",
    paypal: "PayPal", PayPal: "PayPal",
    interac: "Virement Interac", e_transfer: "Virement Interac",
    cash: "Comptant",
  };
  return map[m] || m;
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateReceiptPDF(data: ReceiptData): PDFGenerationResult {
  try {
    if (!data.receipt_number) return { success: false, error: "Numero de recu manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();

    // GREEN HEADER
    doc.setFillColor(34, 120, 60);
    doc.rect(0, 0, pw, 40, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("NIVRA TELECOM", 15, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("RECU DE PAIEMENT", 15, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`No ${data.invoice_number}`, pw - 15, 18, { align: "right" });

    // WATERMARK (bottom area, light green)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(60);
    doc.setTextColor(200, 240, 200);
    doc.text("P A Y E", 55, 240);
    doc.setTextColor(0, 0, 0);

    // CLIENT BLOCK
    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Client", 15, y);
    doc.text("Adresse de service", 110, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(data.client_name, 15, y);
    if (data.client_address) {
      // Parse address if it contains comma-separated parts
      const parts = data.client_address.split(",").map(s => s.trim());
      doc.text(parts[0] || "", 110, y);
      if (parts.length > 1) {
        doc.text(parts.slice(1).join(", "), 110, y + 5);
      }
    }
    y += 5;
    doc.text(data.client_email, 15, y);
    y += 5;
    if (data.client_phone) { doc.text(data.client_phone, 15, y); y += 5; }

    doc.setFontSize(8);
    let idLine = `Compte: ${data.account_number}`;
    if (data.order_number) idLine += `  |  Commande: ${data.order_number}`;
    doc.text(idLine, 15, y);
    y += 10;

    // PAYMENT DETAILS
    doc.setFontSize(9);
    const payDetails = [
      `Date du paiement: ${fmtDate(data.payment_date)}`,
      `No paiement: ${data.receipt_number}`,
      `Methode: ${fmtMethod(data.payment_method)}`,
      ...(data.transaction_reference ? [`Reference: ${data.transaction_reference}`] : []),
      `Facture liee: ${data.invoice_number}`,
    ];
    for (const line of payDetails) {
      doc.text(line, 15, y);
      y += 5;
    }
    y += 5;

    // BILLED ITEMS SUMMARY
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Resume des services factures", 15, y);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, y + 1.5, 185, y + 1.5);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (data.billed_items && data.billed_items.length > 0) {
      for (const item of data.billed_items) {
        const isDiscount = item.amount < 0;
        doc.setTextColor(isDiscount ? 0 : 0, isDiscount ? 128 : 0, isDiscount ? 0 : 0);
        doc.text(item.description, 15, y);
        doc.text(fmt(item.amount), 185, y, { align: "right" });
        y += 5;
      }
    }
    doc.setTextColor(0, 0, 0);
    y += 5;

    // TOTALS
    const tx = 120;
    // Calculate taxes from total if we have them
    const subtotal = data.invoice_total / 1.14975;
    const tps = subtotal * 0.05;
    const tvq = subtotal * 0.09975;

    doc.text("Sous-total", tx, y); doc.text(fmt(subtotal), 185, y, { align: "right" }); y += 6;
    doc.text("TPS (5%)", tx, y); doc.text(fmt(tps), 185, y, { align: "right" }); y += 6;
    doc.text("TVQ (9,975%)", tx, y); doc.text(fmt(tvq), 185, y, { align: "right" }); y += 8;

    // TOTAL PAID BOX
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setFillColor(220, 255, 220);
    doc.rect(tx, y, 65, 9, "F");
    doc.setTextColor(0, 0, 0);
    doc.text(`TOTAL PAYE: ${fmt(data.amount_paid)}`, tx + 32.5, y + 6.5, { align: "center" });

    // FOOTER
    const ph = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${NIVRA.tradeName} Inc. | ${NIVRA.email} | ${NIVRA.website}`,
      pw / 2, ph - 15, { align: "center" }
    );

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Recu_${data.invoice_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[ReceiptV4] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateReceiptPDF;
