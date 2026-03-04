/**
 * Nivra Contract Summary (RRE) — 1-page "Critical Information Summary"
 * 
 * Equivalent to Canadian telecom "Résumé des renseignements essentiels".
 * Single-page document with all key contract facts.
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA, TAX, PDF_THEME } from "./companyInfo";

const C = PDF_THEME;

// ============================================================================
// DATA INTERFACE
// ============================================================================

export interface ContractSummaryData {
  contract_number: string;
  order_number: string;
  account_number: string;
  contract_date: string;
  terms_version: string;

  // Client
  client_name: string;
  client_email: string;
  client_phone: string;
  service_address: string;

  // Services (line by line)
  services: Array<{
    type: string;
    name: string;
    monthly_price: number;
  }>;

  // Fees
  one_time_fees: Array<{
    label: string;
    amount: number;
  }>;

  // Totals
  subtotal_monthly: number;
  subtotal_one_time: number;
  discount_amount: number;
  tax_gst: number;
  tax_qst: number;
  total_due_today: number;

  // Payment
  payment_method: string; // actual provider used
  
  // Billing cycle
  bill_cycle_day?: number;
  activation_date?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

const fmtDate = (dateStr: string | undefined): string => {
  if (!dateStr) return "Non fourni par le client";
  try { return new Date(dateStr).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return dateStr; }
};

const critical = (value: string | undefined | null, fieldName: string): string => {
  if (!value || value === "—" || value === "N/A" || value.trim() === "") {
    console.warn(`[ContractSummary] Champ critique manquant: ${fieldName}`);
    return "Non fourni par le client";
  }
  return value;
};

const fmtPayMethod = (m: string | undefined): string => {
  if (!m) return "Non fourni par le client";
  const map: Record<string, string> = {
    PayPal: "PayPal", paypal: "PayPal", Interac: "Virement Interac",
    interac: "Virement Interac", e_transfer: "Virement Interac",
    card: "Carte de crédit",
  };
  return map[m] || m;
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateContractSummaryPDF(data: ContractSummaryData): PDFGenerationResult {
  try {
    if (!data.contract_number) return { success: false, error: "Numéro de contrat manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;
    const cw = pw - m * 2;

    doc.setFillColor(...C.white);
    doc.rect(0, 0, pw, ph, "F");

    // === HEADER ===
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(...C.teal);
    doc.rect(0, 28, pw, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...C.white);
    doc.text(NIVRA.legalName, 15, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180, 190, 210);
    doc.text(NIVRA.address, 15, 18);
    doc.text(`${NIVRA.email} | ${NIVRA.website}`, 15, 23);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.teal);
    doc.text("RÉSUMÉ DU CONTRAT", pw - 15, 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(160, 170, 190);
    doc.text("Renseignements essentiels (RRE)", pw - 15, 20, { align: "right" });

    let y = 36;

    // === CONTRACT ID BANNER ===
    doc.setFillColor(...C.blue);
    doc.roundedRect(m, y, cw, 14, 2, 2, "F");
    doc.setTextColor(...C.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Contrat: ${critical(data.contract_number, "contract_number")}`, m + 5, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Commande: ${critical(data.order_number, "order_number")} | Compte: ${critical(data.account_number, "account_number")}`, m + 5, y + 11);
    doc.text(fmtDate(data.contract_date), pw - m - 5, y + 6, { align: "right" });
    y += 20;

    // === CLIENT INFO (compact) ===
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(m, y, cw, 24, 2, 2, "F");
    doc.setFillColor(...C.teal);
    doc.rect(m, y, 3, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.navy);
    doc.text("CLIENT", m + 7, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.text);
    doc.text(`${critical(data.client_name, "client_name")} | ${critical(data.client_email, "client_email")} | ${critical(data.client_phone, "client_phone")}`, m + 7, y + 12);
    doc.text(`Adresse de service: ${critical(data.service_address, "service_address")}`, m + 7, y + 18);
    y += 30;

    // === SERVICES ===
    doc.setFillColor(...C.lightBg);
    doc.rect(m, y, cw, 7, "F");
    doc.setFillColor(...C.teal);
    doc.rect(m, y, 3, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text("SERVICES SOUSCRITS", m + 7, y + 5);
    y += 10;

    // Table header
    doc.setFillColor(...C.navy);
    doc.rect(m, y, cw, 6, "F");
    doc.setTextColor(...C.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("TYPE", m + 3, y + 4);
    doc.text("DESCRIPTION", m + 30, y + 4);
    doc.text("MENSUEL", pw - m - 3, y + 4, { align: "right" });
    y += 8;

    data.services.forEach((svc, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(m, y - 1, cw, 6, "F");
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.teal);
      doc.text(svc.type.toUpperCase(), m + 3, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.text);
      doc.text(svc.name.substring(0, 45), m + 30, y + 3);
      doc.setFont("helvetica", "bold");
      doc.text(fmt(svc.monthly_price), pw - m - 3, y + 3, { align: "right" });
      y += 6;
    });

    // Monthly total
    doc.setDrawColor(...C.border);
    doc.line(m, y, m + cw, y);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.navy);
    doc.text("Total mensuel récurrent:", m + 30, y + 3);
    doc.text(fmt(data.subtotal_monthly), pw - m - 3, y + 3, { align: "right" });
    y += 8;

    // === ONE-TIME FEES ===
    if (data.one_time_fees.length > 0) {
      doc.setFillColor(...C.lightBg);
      doc.rect(m, y, cw, 7, "F");
      doc.setFillColor(...C.teal);
      doc.rect(m, y, 3, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C.navy);
      doc.text("FRAIS UNIQUES", m + 7, y + 5);
      y += 10;

      data.one_time_fees.forEach((fee) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.text);
        doc.text(fee.label, m + 5, y + 3);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(fee.amount), pw - m - 3, y + 3, { align: "right" });
        y += 6;
      });
      y += 3;
    }

    // === TOTALS BOX ===
    const totX = pw / 2;
    const totBoxW = pw / 2 - m;
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(totX, y, totBoxW, 36, 2, 2, "F");

    let ty = y + 6;
    const drawTot = (label: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text);
      doc.text(label, totX + 5, ty);
      doc.text(value, pw - m - 5, ty, { align: "right" });
      ty += 5;
    };

    if (data.subtotal_one_time > 0) drawTot("Frais uniques:", fmt(data.subtotal_one_time));
    if (data.discount_amount > 0) drawTot("Rabais:", `- ${fmt(data.discount_amount)}`);
    drawTot(`${TAX.GST_LABEL}:`, fmt(data.tax_gst));
    drawTot(`${TAX.QST_LABEL}:`, fmt(data.tax_qst));

    // Total due box
    doc.setFillColor(...C.navy);
    doc.roundedRect(totX, ty - 1, totBoxW, 8, 1, 1, "F");
    doc.setTextColor(...C.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("TOTAL DÛ AUJOURD'HUI", totX + 5, ty + 4);
    doc.text(fmt(data.total_due_today), pw - m - 5, ty + 4, { align: "right" });

    y += 42;

    // === PAYMENT & BILLING CYCLE ===
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(m, y, cw, 28, 2, 2, "F");
    doc.setFillColor(...C.blue);
    doc.rect(m, y, 3, 28, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.navy);
    doc.text("PAIEMENT ET CYCLE DE FACTURATION", m + 7, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.text);

    const payLabel = fmtPayMethod(data.payment_method);
    doc.text(`Mode de paiement sélectionné : ${payLabel}`, m + 7, y + 13);

    // Cycle info based on actual payment provider
    const cycleText = data.payment_method?.toLowerCase()?.includes("paypal")
      ? "Le cycle de facturation commence après confirmation du paiement PayPal."
      : data.payment_method?.toLowerCase()?.includes("interac") || data.payment_method?.toLowerCase()?.includes("e_transfer")
        ? "Le cycle de facturation commence après confirmation du virement Interac."
        : "Le cycle de facturation commence après confirmation du paiement.";
    doc.text(cycleText, m + 7, y + 19);

    if (data.bill_cycle_day) {
      doc.text(`Jour de cycle : ${data.bill_cycle_day} de chaque mois`, m + 7, y + 25);
    } else if (data.activation_date) {
      doc.text(`Date d'activation prévue : ${fmtDate(data.activation_date)}`, m + 7, y + 25);
    }

    y += 34;

    // === TERMS REFERENCE ===
    doc.setFillColor(...C.lightBg);
    doc.setDrawColor(...C.teal);
    doc.setLineWidth(0.5);
    doc.roundedRect(m, y, cw, 14, 1, 1, "FD");
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.navy);
    doc.text("MODALITÉS DE SERVICE", m + 5, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    doc.text(`Version ${data.terms_version} — disponibles sur le portail client (www.nivra-telecom.ca)`, m + 5, y + 10);

    // === FOOTER ===
    doc.setFillColor(...C.navy);
    doc.rect(0, ph - 14, pw, 14, "F");
    doc.setFillColor(...C.teal);
    doc.rect(0, ph - 14, pw, 1.5, "F");
    doc.setTextColor(...C.white);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 9, { align: "center" });
    doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`, pw / 2, ph - 5, { align: "center" });

    const blob = doc.output("blob");
    const filename = `Resume_Contrat_${data.contract_number}.pdf`;
    return { success: true, blob, filename };
  } catch (error) {
    console.error("[ContractSummary] Generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

export default generateContractSummaryPDF;
