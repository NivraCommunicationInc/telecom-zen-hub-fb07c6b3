/**
 * Nivra Annual Tax Summary Template V1.0 — PRODUCTION
 *
 * Multi-page support: pagination automatique avec re-dessin header/footer.
 * Canonical layout (matches LOCKED_TEMPLATES.md V4.0 standard):
 * ┌─────────────────────────────────────────────┐
 * │ NAVY HEADER: NIVRA TELECOM   No XXXXXXX    │
 * │ SOMMAIRE FISCAL ANNUEL - YYYY               │
 * ├─────────────────────────────────────────────┤
 * │ Client info          Adresse de service     │
 * │ Compte / Annee fiscale                      │
 * ├─────────────────────────────────────────────┤
 * │ Resume annuel (encadre):                    │
 * │   Sous-total / TPS payee / TVQ payee /      │
 * │   TOTAL PAYE                                │
 * ├─────────────────────────────────────────────┤
 * │ Detail mensuel (table):                     │
 * │ Mois | Factures | Sous-total | TPS | TVQ | Total │
 * ├─────────────────────────────────────────────┤
 * │ Mention fiscale (encadre info)              │
 * │ Footer canonique sur chaque page            │
 * └─────────────────────────────────────────────┘
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA } from "./companyInfo";

export interface MonthlyTaxBreakdown {
  month: number; // 1-12
  invoice_count: number;
  subtotal: number;
  tps_amount: number;
  tvq_amount: number;
  total: number;
}

export interface AnnualTaxSummaryData {
  summary_number: string;
  issue_date: string;
  fiscal_year: number;

  // Client
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;

  // Annual aggregates
  total_subtotal: number;
  total_tps: number;
  total_tvq: number;
  total_paid: number;
  total_invoice_count: number;

  // Monthly breakdown (12 entries, even if zero)
  monthly: MonthlyTaxBreakdown[];
}

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

const MONTH_NAMES = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"
];

function drawHeader(doc: jsPDF, docNumber: string, year: number) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 64, 120);
  doc.rect(0, 0, pw, 40, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`SOMMAIRE FISCAL ANNUEL - ${year}`, 15, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`No ${docNumber}`, pw - 15, 18, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
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
  doc.setTextColor(80, 80, 80);
  doc.text(`Page ${pageNum} de ${totalPages}`, pw - 15, ph - 8, { align: "right" });
}

function drawMonthlyTableHeader(doc: jsPDF, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, 180, 7, "F");
  doc.setTextColor(0, 0, 0);
  doc.text("Mois", 17, y + 5);
  doc.text("Nb factures", 50, y + 5, { align: "center" });
  doc.text("Sous-total", 95, y + 5, { align: "right" });
  doc.text("TPS (5%)", 130, y + 5, { align: "right" });
  doc.text("TVQ (9,975%)", 160, y + 5, { align: "right" });
  doc.text("Total", 193, y + 5, { align: "right" });
  return y + 8;
}

export function generateAnnualTaxSummaryPDF(data: AnnualTaxSummaryData): PDFGenerationResult {
  try {
    if (!data.summary_number) return { success: false, error: "Numero de sommaire manquant" };
    if (!data.client_name || !data.client_email) return { success: false, error: "Informations client incompletes" };
    if (!data.fiscal_year) return { success: false, error: "Annee fiscale manquante" };
    if (!data.monthly || data.monthly.length !== 12) return { success: false, error: "Detail mensuel doit contenir 12 entrees" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const ph = doc.internal.pageSize.getHeight();
    const FOOTER_TOP = ph - 30;

    drawHeader(doc, data.summary_number, data.fiscal_year);

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
    doc.text(`Compte: ${data.account_number}  |  Annee fiscale: ${data.fiscal_year}  |  Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    y += 12;

    // ANNUAL SUMMARY BOX
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Resume annuel ${data.fiscal_year}`, 15, y);
    y += 5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(30, 64, 120);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, y, 180, 36, 2, 2, "FD");
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    // Left side: breakdown
    doc.text("Sous-total annuel", 22, y + 8);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(data.total_subtotal), 95, y + 8, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.text("TPS payee (5%)", 22, y + 16);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(data.total_tps), 95, y + 16, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.text("TVQ payee (9,975%)", 22, y + 24);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(data.total_tvq), 95, y + 24, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.text(`Nombre de factures: ${data.total_invoice_count}`, 22, y + 32);

    // Right side: total
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("TOTAL PAYE", 195, y + 10, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 64, 120);
    doc.text(fmt(data.total_paid), 195, y + 22, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(`Annee ${data.fiscal_year}`, 195, y + 30, { align: "right" });

    y += 44;

    // MONTHLY BREAKDOWN
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Detail mensuel", 15, y);
    y += 6;

    y = drawMonthlyTableHeader(doc, y);

    let pageNum = 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    for (const m of data.monthly) {
      const rowHeight = 6;

      if (y + rowHeight > FOOTER_TOP) {
        doc.addPage();
        pageNum++;
        drawHeader(doc, data.summary_number, data.fiscal_year);
        y = 50;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(`${data.client_name}  |  Compte: ${data.account_number}  |  Annee ${data.fiscal_year}`, 15, y);
        y += 6;
        doc.text("Suite du detail mensuel", 15, y);
        y += 5;
        y = drawMonthlyTableHeader(doc, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      const isEmpty = m.invoice_count === 0 && m.total === 0;
      doc.setTextColor(isEmpty ? 160 : 0, isEmpty ? 160 : 0, isEmpty ? 160 : 0);
      doc.text(MONTH_NAMES[m.month - 1] || `Mois ${m.month}`, 17, y + 4);
      doc.text(String(m.invoice_count), 50, y + 4, { align: "center" });
      doc.text(fmt(m.subtotal), 95, y + 4, { align: "right" });
      doc.text(fmt(m.tps_amount), 130, y + 4, { align: "right" });
      doc.text(fmt(m.tvq_amount), 160, y + 4, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(fmt(m.total), 193, y + 4, { align: "right" });
      doc.setFont("helvetica", "normal");

      doc.setDrawColor(230, 230, 230);
      doc.line(15, y + rowHeight, 195, y + rowHeight);
      y += rowHeight;
    }

    // ANNUAL TOTAL ROW
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(30, 64, 120);
    doc.rect(15, y, 180, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL ${data.fiscal_year}`, 17, y + 5.5);
    doc.text(String(data.total_invoice_count), 50, y + 5.5, { align: "center" });
    doc.text(fmt(data.total_subtotal), 95, y + 5.5, { align: "right" });
    doc.text(fmt(data.total_tps), 130, y + 5.5, { align: "right" });
    doc.text(fmt(data.total_tvq), 160, y + 5.5, { align: "right" });
    doc.text(fmt(data.total_paid), 193, y + 5.5, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 14;

    // FISCAL DISCLAIMER
    if (y + 22 > FOOTER_TOP) {
      doc.addPage();
      pageNum++;
      drawHeader(doc, data.summary_number, data.fiscal_year);
      y = 50;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Mention fiscale", 15, y);
    y += 5;

    doc.setFillColor(255, 252, 240);
    doc.setDrawColor(200, 180, 100);
    doc.roundedRect(15, y, 180, 18, 1, 1, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const disclaimer = `Ce sommaire est fourni a titre informatif. Les montants ci-dessus reflechissent les paiements traites durant l'annee fiscale ${data.fiscal_year}. Pour toute reclamation aux fins fiscales, consultez vos factures originales et un professionnel comptable. Numeros de taxe Nivra : ${NIVRA.tps} (TPS) | ${NIVRA.tvq} (TVQ).`;
    const lines = doc.splitTextToSize(disclaimer, 174) as string[];
    let dy = y + 5;
    for (const line of lines) {
      doc.text(line, 18, dy);
      dy += 3.5;
    }

    // FOOTER on every page
    const totalPages = pageNum;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(doc, p, totalPages);
    }

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Sommaire_fiscal_${data.fiscal_year}_${data.summary_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[AnnualTaxSummary] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateAnnualTaxSummaryPDF;
