/**
 * Nivra Refund Notice Template V1.0 — PRODUCTION
 *
 * Canonical layout (matches LOCKED_TEMPLATES.md V4.0 standard):
 * ┌─────────────────────────────────────────────┐
 * │ GREEN HEADER: NIVRA TELECOM   No XXXXXXX   │
 * │ AVIS DE REMBOURSEMENT                       │
 * ├─────────────────────────────────────────────┤
 * │ Client info          Adresse de service     │
 * │ Compte / Facture / Note credit              │
 * ├─────────────────────────────────────────────┤
 * │ Resume du remboursement (encadre vert)      │
 * │   Montant rembourse: XXX,XX $               │
 * │   Methode: ...                              │
 * │   Reference: ...                            │
 * │   Date traitee: ...                         │
 * ├─────────────────────────────────────────────┤
 * │ Delai de reception (encadre info)           │
 * ├─────────────────────────────────────────────┤
 * │ Footer canonique                            │
 * └─────────────────────────────────────────────┘
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA } from "./companyInfo";

export interface RefundNoticeData {
  refund_number: string;
  processed_date: string;

  // Source documents
  invoice_number?: string;
  credit_note_number?: string;

  // Client
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;

  // Refund details
  amount: number;
  method: string; // "card", "interac", "paypal", "manual"
  reference?: string;
  expected_arrival_days?: number; // typical: 3-10 business days
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

const fmtMethod = (m: string): string => {
  const map: Record<string, string> = {
    card: "Carte de credit",
    paypal: "PayPal",
    interac: "Virement Interac",
    e_transfer: "Virement Interac",
    manual: "Traitement manuel",
    cash: "Comptant",
  };
  return map[m] || m;
};

function drawHeader(doc: jsPDF, docNumber: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(34, 120, 60);
  doc.rect(0, 0, pw, 40, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("AVIS DE REMBOURSEMENT", 15, 28);
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

export function generateRefundNoticePDF(data: RefundNoticeData): PDFGenerationResult {
  try {
    if (!data.refund_number) return { success: false, error: "Numero de remboursement manquant" };
    if (!data.client_name || !data.client_email) return { success: false, error: "Informations client incompletes" };
    if (!data.amount || data.amount <= 0) return { success: false, error: "Montant de remboursement invalide" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    drawHeader(doc, data.refund_number);

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
    let idLine = `Compte: ${data.account_number}`;
    if (data.invoice_number) idLine += `  |  Facture: ${data.invoice_number}`;
    if (data.credit_note_number) idLine += `  |  Note de credit: ${data.credit_note_number}`;
    doc.text(idLine, 15, y);
    y += 12;

    // REFUND BOX (large, prominent, green)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Resume du remboursement", 15, y);
    y += 5;

    doc.setFillColor(220, 245, 225);
    doc.setDrawColor(34, 120, 60);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, y, 170, 42, 2, 2, "FD");
    doc.setLineWidth(0.2);

    // Amount centered, large
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(34, 120, 60);
    doc.text(fmt(data.amount), 100, y + 14, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Montant rembourse", 100, y + 21, { align: "center" });

    // Details inside box
    doc.setFontSize(9);
    doc.text(`Methode: ${fmtMethod(data.method)}`, 22, y + 30);
    doc.text(`Date traitee: ${fmtDate(data.processed_date)}`, 110, y + 30);
    if (data.reference) {
      doc.text(`Reference de transaction: ${data.reference}`, 22, y + 37);
    }

    y += 50;

    // ARRIVAL DELAY INFO BOX
    const days = data.expected_arrival_days ?? (data.method === "card" ? 10 : data.method === "interac" ? 3 : 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Delai de reception estime", 15, y);
    y += 5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, 170, 18, 1, 1, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(
      `Le montant sera credite sur votre methode de paiement dans un delai de ${days} jours ouvrables.`,
      105, y + 7, { align: "center" }
    );
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Pour toute question, contactez-nous a ${NIVRA.email}`,
      105, y + 13, { align: "center" }
    );

    drawFooter(doc);

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Avis_remboursement_${data.refund_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[RefundNotice] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateRefundNoticePDF;
