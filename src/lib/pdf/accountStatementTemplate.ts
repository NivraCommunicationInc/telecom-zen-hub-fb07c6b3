/**
 * Nivra Account Statement Template V1.0 — PRODUCTION
 *
 * Multi-page support: pagination automatique avec re-dessin header/footer.
 * Canonical layout (matches LOCKED_TEMPLATES.md V4.0 standard):
 * ┌─────────────────────────────────────────────┐
 * │ NAVY HEADER: NIVRA TELECOM   No XXXXXXX    │
 * │ ETAT DE COMPTE                              │
 * ├─────────────────────────────────────────────┤
 * │ Client info          Adresse de service     │
 * │ Compte / Periode du - au                    │
 * ├─────────────────────────────────────────────┤
 * │ Resume (encadre): Solde anterieur, factures, │
 * │   paiements, credits, solde actuel           │
 * ├─────────────────────────────────────────────┤
 * │ Date | Reference | Description | Debit | Credit | Solde │
 * │   ... transactions ... (multi-pages OK)      │
 * ├─────────────────────────────────────────────┤
 * │ Solde a payer (encadre)                     │
 * │ Footer canonique sur chaque page            │
 * │ "Page X de Y"                               │
 * └─────────────────────────────────────────────┘
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA } from "./companyInfo";

export interface StatementTransaction {
  date: string;
  reference: string;
  description: string;
  debit?: number;  // invoices, fees
  credit?: number; // payments, credits, refunds
  // running balance computed at render time
}

export interface AccountStatementData {
  statement_number: string;
  issue_date: string;

  // Statement period
  period_start: string;
  period_end: string;

  // Client
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;

  // Balances
  opening_balance: number;
  closing_balance: number;

  // Aggregates (already computed)
  total_invoiced: number;
  total_paid: number;
  total_credits?: number;

  // Transactions in chronological order
  transactions: StatementTransaction[];
}

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

const fmtDateShort = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  const ymd = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  return "—";
};

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  const ymd = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return `${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
  }
  return "—";
};

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
  doc.text("ETAT DE COMPTE", 15, 28);
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

function drawTransactionTableHeader(doc: jsPDF, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, 180, 7, "F");
  doc.setTextColor(0, 0, 0);
  doc.text("Date", 17, y + 5);
  doc.text("Reference", 38, y + 5);
  doc.text("Description", 70, y + 5);
  doc.text("Debit", 142, y + 5, { align: "right" });
  doc.text("Credit", 165, y + 5, { align: "right" });
  doc.text("Solde", 193, y + 5, { align: "right" });
  return y + 8;
}

export function generateAccountStatementPDF(data: AccountStatementData): PDFGenerationResult {
  try {
    if (!data.statement_number) return { success: false, error: "Numero d'etat de compte manquant" };
    if (!data.client_name || !data.client_email) return { success: false, error: "Informations client incompletes" };
    if (!data.account_number) return { success: false, error: "Numero de compte manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const ph = doc.internal.pageSize.getHeight();

    const FOOTER_TOP = ph - 30; // y coordinate where rendering must stop

    // PAGE 1 SETUP
    drawHeader(doc, data.statement_number);

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
    doc.text(`Compte: ${data.account_number}  |  Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    y += 6;
    doc.text(`Periode: du ${fmtDate(data.period_start)} au ${fmtDate(data.period_end)}`, 15, y);
    y += 10;

    // SUMMARY BOX
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Resume du compte", 15, y);
    y += 5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(30, 64, 120);
    doc.setLineWidth(0.4);
    doc.roundedRect(15, y, 180, 32, 2, 2, "FD");
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    // 4 columns inside box
    doc.text("Solde anterieur", 22, y + 8);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(data.opening_balance), 22, y + 14);

    doc.setFont("helvetica", "normal");
    doc.text("Total facture", 70, y + 8);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(data.total_invoiced), 70, y + 14);

    doc.setFont("helvetica", "normal");
    doc.text("Total paye", 115, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 128, 0);
    doc.text(fmt(data.total_paid), 115, y + 14);
    doc.setTextColor(0, 0, 0);

    doc.setFont("helvetica", "normal");
    doc.text("Credits/remboursements", 22, y + 22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 128, 0);
    doc.text(fmt(data.total_credits || 0), 22, y + 28);
    doc.setTextColor(0, 0, 0);

    // Closing balance prominent on right
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Solde actuel", 195, y + 8, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    if (data.closing_balance > 0) doc.setTextColor(180, 50, 50);
    else if (data.closing_balance < 0) doc.setTextColor(0, 128, 0);
    else doc.setTextColor(0, 0, 0);
    doc.text(fmt(data.closing_balance), 195, y + 18, { align: "right" });
    doc.setTextColor(0, 0, 0);

    y += 40;

    // TRANSACTIONS TABLE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Detail des transactions", 15, y);
    y += 6;

    y = drawTransactionTableHeader(doc, y);

    // Render transactions with running balance and pagination
    let runningBalance = data.opening_balance;
    let pageNum = 1;
    const pageBuffers: number[] = []; // store y where each page ends, not used currently

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    if (data.transactions.length === 0) {
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "italic");
      doc.text("Aucune transaction durant cette periode.", 17, y + 4);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      y += 10;
    }

    for (const tx of data.transactions) {
      const debit = tx.debit || 0;
      const credit = tx.credit || 0;
      runningBalance += debit - credit;

      // Wrap description if too long
      const descLines = doc.splitTextToSize(tx.description, 68) as string[];
      const rowHeight = Math.max(6, descLines.length * 4 + 2);

      // Pagination check
      if (y + rowHeight > FOOTER_TOP) {
        // Note: draw footer with placeholder totals; we'll fix totalPages at the end
        doc.addPage();
        pageNum++;
        drawHeader(doc, data.statement_number);
        y = 50;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(`${data.client_name}  |  Compte: ${data.account_number}  |  ${fmtDate(data.period_start)} au ${fmtDate(data.period_end)}`, 15, y);
        y += 6;
        doc.text("Suite des transactions", 15, y);
        y += 5;
        y = drawTransactionTableHeader(doc, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      doc.setTextColor(0, 0, 0);
      doc.text(fmtDateShort(tx.date), 17, y + 4);
      doc.text(tx.reference || "—", 38, y + 4);

      let descY = y + 4;
      for (const dl of descLines) {
        doc.text(dl, 70, descY);
        descY += 4;
      }

      if (debit > 0) {
        doc.text(fmt(debit), 142, y + 4, { align: "right" });
      }
      if (credit > 0) {
        doc.setTextColor(0, 128, 0);
        doc.text(fmt(credit), 165, y + 4, { align: "right" });
        doc.setTextColor(0, 0, 0);
      }

      doc.setFont("helvetica", "bold");
      doc.text(fmt(runningBalance), 193, y + 4, { align: "right" });
      doc.setFont("helvetica", "normal");

      doc.setDrawColor(230, 230, 230);
      doc.line(15, y + rowHeight, 195, y + rowHeight);
      y += rowHeight;
    }

    y += 4;

    // CLOSING BALANCE BOX
    if (y + 25 > FOOTER_TOP) {
      doc.addPage();
      pageNum++;
      drawHeader(doc, data.statement_number);
      y = 50;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Solde a payer", 15, y);
    y += 5;

    const balanceColor: [number, number, number] = data.closing_balance > 0
      ? [180, 50, 50]
      : data.closing_balance < 0
        ? [0, 128, 0]
        : [30, 64, 120];

    doc.setFillColor(balanceColor[0] === 180 ? 255 : balanceColor[0] === 0 ? 220 : 240,
                     balanceColor[0] === 180 ? 240 : balanceColor[0] === 0 ? 245 : 248,
                     balanceColor[0] === 180 ? 240 : balanceColor[0] === 0 ? 225 : 255);
    doc.setDrawColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, y, 180, 14, 2, 2, "FD");
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    const label = data.closing_balance > 0
      ? "MONTANT DU"
      : data.closing_balance < 0
        ? "CREDIT EN VOTRE FAVEUR"
        : "COMPTE A JOUR";
    doc.text(`${label}: ${fmt(Math.abs(data.closing_balance))}`, 105, y + 9, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // FOOTER on every page (need to know total pages)
    const totalPages = pageNum;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(doc, p, totalPages);
    }

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Etat_de_compte_${data.statement_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[AccountStatement] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateAccountStatementPDF;
