/**
 * Professional Quote PDF — Nivra-branded soumission document.
 * Uses the same design system as other canonical PDFs.
 */
import jsPDF from "jspdf";
import { NIVRA, TAX, PDF_THEME } from "./companyInfo";

const C = PDF_THEME;

export interface QuotePDFData {
  quoteNumber: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  isProspect: boolean;
  validUntil?: string;
  clientNote?: string;
  lines: Array<{
    label: string;
    quantity: number;
    unitPrice: number;
    billingFrequency: "one_time" | "monthly";
    lineType: string;
  }>;
  adjustments: Array<{
    label: string;
    amount: number;
    adjustmentType: string;
  }>;
  subtotal: number;
  discountsTotal: number;
  creditsTotal: number;
  taxesTotal: number;
  totalDueNow: number;
  totalMonthly: number;
  createdAt: string;
  status: string;
}

export function generateQuotePDF(data: QuotePDFData): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 15;
  const contentW = W - margin * 2;
  let y = 0;

  // ─── Header ────────────────────────────────────────────────────────
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, W, 42, "F");

  doc.setTextColor(...C.white);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(NIVRA.tradeName.toUpperCase(), margin, 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(NIVRA.tagline, margin, 25);

  // Quote number badge
  doc.setFillColor(...C.teal);
  doc.roundedRect(W - margin - 60, 10, 60, 22, 3, 3, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("SOUMISSION", W - margin - 55, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.quoteNumber, W - margin - 55, 27);

  y = 50;

  // ─── Date & Validity ──────────────────────────────────────────────
  doc.setTextColor(...C.text);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const createdDate = new Date(data.createdAt).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
  doc.text(`Date : ${createdDate}`, margin, y);

  if (data.validUntil) {
    const validDate = new Date(data.validUntil).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
    doc.text(`Valide jusqu'au : ${validDate}`, W - margin - 60, y);
  }

  y += 10;

  // ─── Client Section ────────────────────────────────────────────────
  doc.setFillColor(...C.lightBg);
  doc.roundedRect(margin, y, contentW, 24, 2, 2, "F");

  doc.setTextColor(...C.textMuted);
  doc.setFontSize(7);
  doc.text(data.isProspect ? "PROSPECT" : "CLIENT", margin + 5, y + 6);

  doc.setTextColor(...C.text);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(data.clientName, margin + 5, y + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const contactParts = [data.clientEmail, data.clientPhone].filter(Boolean);
  if (contactParts.length) {
    doc.setTextColor(...C.textMuted);
    doc.text(contactParts.join(" · "), margin + 5, y + 19);
  }

  y += 32;

  // ─── Services Table ────────────────────────────────────────────────
  doc.setTextColor(...C.navy);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Détail des services et frais", margin, y);
  y += 6;

  // Table header
  doc.setFillColor(...C.navy);
  doc.rect(margin, y, contentW, 7, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 3, y + 5);
  doc.text("Qté", margin + 100, y + 5, { align: "center" });
  doc.text("Prix unit.", margin + 120, y + 5, { align: "center" });
  doc.text("Fréquence", margin + 145, y + 5, { align: "center" });
  doc.text("Total", margin + contentW - 3, y + 5, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (let i = 0; i < data.lines.length; i++) {
    const line = data.lines[i];
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, 7, "F");
    }
    doc.setTextColor(...C.text);
    doc.text(line.label.substring(0, 50), margin + 3, y + 5);
    doc.text(String(line.quantity), margin + 100, y + 5, { align: "center" });
    doc.text(`${line.unitPrice.toFixed(2)} $`, margin + 120, y + 5, { align: "center" });
    doc.setTextColor(...C.textMuted);
    doc.text(line.billingFrequency === "monthly" ? "Mensuel" : "Unique", margin + 145, y + 5, { align: "center" });
    doc.setTextColor(...C.text);
    doc.text(`${(line.unitPrice * line.quantity).toFixed(2)} $`, margin + contentW - 3, y + 5, { align: "right" });
    y += 7;
  }

  y += 3;

  // ─── Adjustments ───────────────────────────────────────────────────
  if (data.adjustments.length > 0) {
    doc.setDrawColor(...C.border);
    doc.line(margin, y, margin + contentW, y);
    y += 5;

    for (const adj of data.adjustments) {
      doc.setTextColor(...C.textMuted);
      doc.setFontSize(8);
      doc.text(adj.label, margin + 3, y + 4);
      doc.setTextColor(220, 38, 38); // red
      doc.text(`-${adj.amount.toFixed(2)} $`, margin + contentW - 3, y + 4, { align: "right" });
      y += 7;
    }
    y += 3;
  }

  // ─── Totals Box ────────────────────────────────────────────────────
  doc.setFillColor(...C.lightBg);
  doc.roundedRect(margin + contentW / 2, y, contentW / 2, 42, 2, 2, "F");

  const tx = margin + contentW / 2 + 5;
  const tw = contentW / 2 - 10;

  doc.setTextColor(...C.text);
  doc.setFontSize(8);

  doc.text("Sous-total", tx, y + 7);
  doc.text(`${data.subtotal.toFixed(2)} $`, tx + tw, y + 7, { align: "right" });

  if (data.discountsTotal > 0) {
    y += 6;
    doc.setTextColor(220, 38, 38);
    doc.text("Rabais", tx, y + 7);
    doc.text(`-${data.discountsTotal.toFixed(2)} $`, tx + tw, y + 7, { align: "right" });
  }

  y += 6;
  doc.setTextColor(...C.textMuted);
  doc.text(`TPS (5%)`, tx, y + 7);
  const tpsAmount = Math.max(0, data.subtotal - data.discountsTotal - data.creditsTotal) * TAX.GST_RATE;
  doc.text(`${tpsAmount.toFixed(2)} $`, tx + tw, y + 7, { align: "right" });

  y += 6;
  doc.text(`TVQ (9,975%)`, tx, y + 7);
  const tvqAmount = Math.max(0, data.subtotal - data.discountsTotal - data.creditsTotal) * TAX.QST_RATE;
  doc.text(`${tvqAmount.toFixed(2)} $`, tx + tw, y + 7, { align: "right" });

  y += 8;
  doc.setDrawColor(...C.navy);
  doc.line(tx, y + 2, tx + tw, y + 2);
  y += 4;

  doc.setTextColor(...C.navy);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Total dû maintenant", tx, y + 6);
  doc.text(`${data.totalDueNow.toFixed(2)} $`, tx + tw, y + 6, { align: "right" });

  y += 10;
  doc.setTextColor(...C.teal);
  doc.setFontSize(9);
  doc.text("Mensuel récurrent", tx, y + 5);
  doc.text(`${data.totalMonthly.toFixed(2)} $ /mois`, tx + tw, y + 5, { align: "right" });

  y += 20;

  // ─── Client Note ───────────────────────────────────────────────────
  if (data.clientNote) {
    doc.setTextColor(...C.navy);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Note", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.text);
    const noteLines = doc.splitTextToSize(data.clientNote, contentW - 10);
    doc.text(noteLines, margin + 3, y);
    y += noteLines.length * 4 + 5;
  }

  // ─── Footer ────────────────────────────────────────────────────────
  const footerY = 270;
  doc.setDrawColor(...C.border);
  doc.line(margin, footerY, margin + contentW, footerY);

  doc.setTextColor(...C.textMuted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(NIVRA.legalName, margin, footerY + 5);
  doc.text(NIVRA.address, margin, footerY + 9);
  doc.text(`${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`, margin, footerY + 13);
  doc.text(NIVRA.website, W - margin, footerY + 5, { align: "right" });
  doc.text(NIVRA.email, W - margin, footerY + 9, { align: "right" });

  doc.setTextColor(...C.textMuted);
  doc.setFontSize(6);
  doc.text("Ce document est une soumission et ne constitue pas une facture.", margin, footerY + 18);
  doc.text("Les prix sont sujets à changement et valides selon la date d'expiration indiquée.", margin, footerY + 22);

  return doc.output("blob");
}
