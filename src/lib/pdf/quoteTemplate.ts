/**
 * Professional Quote PDF — Nivra-branded soumission document.
 * Premium design with clean typography, structured layout, and professional finishing.
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

const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " $";

function drawHeader(doc: jsPDF, W: number, margin: number, data: QuotePDFData) {
  // Full-width navy header bar
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, W, 44, "F");

  // Teal accent line
  doc.setFillColor(...C.teal);
  doc.rect(0, 44, W, 2, "F");

  // Company name
  doc.setTextColor(...C.white);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(NIVRA.tradeName.toUpperCase(), margin, 18);

  // Tagline
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Fournisseur de services de télécommunications", margin, 26);
  doc.text("Province de Québec", margin, 32);

  // Quote badge — right side
  doc.setFillColor(...C.teal);
  doc.roundedRect(W - margin - 62, 8, 62, 28, 3, 3, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("SOUMISSION", W - margin - 31, 17, { align: "center" });
  doc.setFontSize(10);
  doc.text(data.quoteNumber, W - margin - 31, 27, { align: "center" });
}

function drawMetaBlock(doc: jsPDF, W: number, margin: number, contentW: number, data: QuotePDFData): number {
  let y = 54;

  // Date and validity in a clean row
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.textMuted);

  const createdDate = new Date(data.createdAt).toLocaleDateString("fr-CA", {
    year: "numeric", month: "long", day: "numeric",
  });
  doc.text(`Émise le ${createdDate}`, margin, y);

  if (data.validUntil) {
    const validDate = new Date(data.validUntil).toLocaleDateString("fr-CA", {
      year: "numeric", month: "long", day: "numeric",
    });
    doc.setTextColor(...C.teal);
    doc.setFont("helvetica", "bold");
    doc.text(`Valide jusqu'au ${validDate}`, W - margin, y, { align: "right" });
  }

  y += 10;

  // Client info card
  doc.setFillColor(...C.lightBg);
  doc.roundedRect(margin, y, contentW, 28, 3, 3, "F");
  doc.setDrawColor(...C.teal);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin, y + 28);

  doc.setTextColor(...C.textMuted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(data.isProspect ? "PROSPECT" : "CLIENT", margin + 6, y + 7);

  doc.setTextColor(...C.text);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.clientName, margin + 6, y + 15);

  const contactParts = [data.clientEmail, data.clientPhone].filter(Boolean);
  if (contactParts.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.textMuted);
    doc.text(contactParts.join("  ·  "), margin + 6, y + 22);
  }

  return y + 36;
}

function drawServicesTable(doc: jsPDF, margin: number, contentW: number, data: QuotePDFData, startY: number): number {
  let y = startY;

  // Section title
  doc.setTextColor(...C.navy);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Détail des services et frais", margin, y);
  y += 7;

  // Table header
  doc.setFillColor(...C.navy);
  doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");

  const col = {
    desc: margin + 4,
    qty: margin + 95,
    price: margin + 115,
    freq: margin + 142,
    total: margin + contentW - 4,
  };

  doc.text("Description", col.desc, y + 5.5);
  doc.text("Qté", col.qty, y + 5.5, { align: "center" });
  doc.text("Prix unit.", col.price, y + 5.5, { align: "center" });
  doc.text("Fréquence", col.freq, y + 5.5, { align: "center" });
  doc.text("Total", col.total, y + 5.5, { align: "right" });
  y += 8;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const monthlyLines = data.lines.filter(l => l.billingFrequency === "monthly");
  const oneTimeLines = data.lines.filter(l => l.billingFrequency === "one_time");

  const drawSection = (lines: typeof data.lines, sectionLabel: string) => {
    if (lines.length === 0) return;

    // Section sub-header
    doc.setFillColor(240, 245, 250);
    doc.rect(margin, y, contentW, 6, "F");
    doc.setTextColor(...C.teal);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(sectionLabel.toUpperCase(), col.desc, y + 4.2);
    y += 6;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTotal = line.unitPrice * line.quantity;

      if (i % 2 === 0) {
        doc.setFillColor(252, 253, 254);
        doc.rect(margin, y, contentW, 7.5, "F");
      }

      doc.setTextColor(...C.text);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(line.label.substring(0, 45), col.desc, y + 5.2);

      doc.setTextColor(...C.textMuted);
      doc.text(String(line.quantity), col.qty, y + 5.2, { align: "center" });
      doc.text(fmt(line.unitPrice), col.price, y + 5.2, { align: "center" });

      doc.setFontSize(7);
      doc.text(line.billingFrequency === "monthly" ? "Mensuel" : "Unique", col.freq, y + 5.2, { align: "center" });

      doc.setTextColor(...C.text);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(fmt(lineTotal), col.total, y + 5.2, { align: "right" });

      y += 7.5;
    }
  };

  drawSection(monthlyLines, "Services mensuels récurrents");
  drawSection(oneTimeLines, "Frais uniques");

  // Bottom border
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentW, y);

  return y + 4;
}

function drawAdjustments(doc: jsPDF, margin: number, contentW: number, data: QuotePDFData, startY: number): number {
  if (data.adjustments.length === 0) return startY;

  let y = startY;

  doc.setTextColor(...C.textMuted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("AJUSTEMENTS", margin + 4, y + 4);
  y += 7;

  for (const adj of data.adjustments) {
    doc.setTextColor(...C.textMuted);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(adj.label, margin + 4, y + 4);
    doc.setTextColor(220, 38, 38);
    doc.setFont("helvetica", "bold");
    doc.text(`-${fmt(adj.amount)}`, margin + contentW - 4, y + 4, { align: "right" });
    y += 7;
  }

  doc.setDrawColor(...C.border);
  doc.line(margin, y, margin + contentW, y);
  return y + 4;
}

function drawTotals(doc: jsPDF, margin: number, contentW: number, data: QuotePDFData, startY: number): number {
  let y = startY;
  const boxW = contentW * 0.48;
  const boxX = margin + contentW - boxW;

  // Totals card with rounded border
  doc.setFillColor(...C.lightBg);
  doc.roundedRect(boxX, y, boxW, 52, 3, 3, "F");
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, y, boxW, 52, 3, 3, "S");

  const tx = boxX + 8;
  const tw = boxW - 16;

  // Subtotal
  doc.setTextColor(...C.text);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Sous-total", tx, y + 8);
  doc.text(fmt(data.subtotal), tx + tw, y + 8, { align: "right" });

  let dy = 14;

  // Discounts
  if (data.discountsTotal > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text("Rabais", tx, y + dy);
    doc.setFont("helvetica", "bold");
    doc.text(`-${fmt(data.discountsTotal)}`, tx + tw, y + dy, { align: "right" });
    dy += 6;
  }

  // Taxes
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.textMuted);
  doc.setFontSize(7.5);

  const taxableBase = Math.max(0, data.subtotal - data.discountsTotal - data.creditsTotal);
  const tps = taxableBase * TAX.GST_RATE;
  const tvq = taxableBase * TAX.QST_RATE;

  doc.text("TPS (5 %)", tx, y + dy);
  doc.text(fmt(tps), tx + tw, y + dy, { align: "right" });
  dy += 5.5;

  doc.text("TVQ (9,975 %)", tx, y + dy);
  doc.text(fmt(tvq), tx + tw, y + dy, { align: "right" });
  dy += 6;

  // Separator
  doc.setDrawColor(...C.navy);
  doc.setLineWidth(0.5);
  doc.line(tx, y + dy, tx + tw, y + dy);
  dy += 5;

  // Total due now — prominent
  doc.setTextColor(...C.navy);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Total dû maintenant", tx, y + dy);
  doc.text(fmt(data.totalDueNow), tx + tw, y + dy, { align: "right" });

  // Monthly recurring — teal accent below totals box
  const monthlyY = y + 56;
  doc.setFillColor(240, 253, 250);
  doc.roundedRect(boxX, monthlyY, boxW, 12, 3, 3, "F");
  doc.setDrawColor(...C.teal);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, monthlyY, boxW, 12, 3, 3, "S");

  doc.setTextColor(...C.teal);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Mensuel récurrent", tx, monthlyY + 8);
  doc.text(`${fmt(data.totalMonthly)} /mois`, tx + tw, monthlyY + 8, { align: "right" });

  return monthlyY + 18;
}

function drawClientNote(doc: jsPDF, margin: number, contentW: number, note: string, startY: number): number {
  let y = startY;

  doc.setFillColor(255, 250, 240);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.4);

  doc.setTextColor(...C.navy);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Message au client", margin, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  const noteLines = doc.splitTextToSize(note, contentW - 14);

  doc.roundedRect(margin, y, contentW, noteLines.length * 4.5 + 8, 2, 2, "FD");
  doc.text(noteLines, margin + 6, y + 6);

  return y + noteLines.length * 4.5 + 14;
}

function drawFooter(doc: jsPDF, W: number, margin: number, contentW: number) {
  const footerY = 265;

  // Footer separator
  doc.setDrawColor(...C.teal);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY, margin + contentW, footerY);

  doc.setTextColor(...C.textMuted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  doc.text(NIVRA.legalName, margin, footerY + 5);
  doc.text(NIVRA.address, margin, footerY + 9);
  doc.text(`${NIVRA.tpsLabel}  |  ${NIVRA.tvqLabel}`, margin, footerY + 13);

  doc.setTextColor(...C.teal);
  doc.setFont("helvetica", "bold");
  doc.text(NIVRA.website, W - margin, footerY + 5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.textMuted);
  doc.text(NIVRA.email, W - margin, footerY + 9, { align: "right" });

  // Legal disclaimer
  doc.setFontSize(6);
  doc.setTextColor(...C.textMuted);
  doc.text(
    "Ce document est une soumission et ne constitue pas une facture. Les prix sont sujets à changement selon la date de validité indiquée.",
    W / 2, footerY + 18,
    { align: "center" }
  );
}

export function generateQuotePDF(data: QuotePDFData): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 15;
  const contentW = W - margin * 2;

  drawHeader(doc, W, margin, data);
  let y = drawMetaBlock(doc, W, margin, contentW, data);
  y = drawServicesTable(doc, margin, contentW, data, y);
  y = drawAdjustments(doc, margin, contentW, data, y);
  y = drawTotals(doc, margin, contentW, data, y);

  if (data.clientNote) {
    y = drawClientNote(doc, margin, contentW, data.clientNote, y);
  }

  drawFooter(doc, W, margin, contentW);

  return doc.output("blob");
}
