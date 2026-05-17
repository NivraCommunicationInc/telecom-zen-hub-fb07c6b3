/**
 * Paystub PDF — TALON DE PAIE / PAY STUB (Nivra)
 * Built on the standard base template (navy header + canonical footer).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import {
  NAVY, GREEN, GREY_BG, GREY_BORDER,
  fmtCAD, fmtDate, drawHeader, drawFooter,
} from "./_baseTemplate.ts";

export interface PaystubData {
  paystub_number: string;
  pay_date: string;          // YYYY-MM-DD
  period_start: string;
  period_end: string;
  employee_name: string;
  agent_number: string | null;
  payment_method: string;

  commission_gross: number;
  bonus_amount: number;
  total_gross: number;

  federal_tax: number;
  quebec_tax: number;
  rrq: number;
  ae: number;
  rqap: number;
  disability_insurance: number;
  total_deductions: number;

  net_pay: number;

  ytd_gross: number;
  ytd_deductions: number;
  ytd_net: number;
}

const PAY_METHOD_LABEL: Record<string, string> = {
  interac: "Virement Interac",
  direct_deposit: "Dépôt direct",
  paypal: "PayPal",
};

export function buildPaystubPdf(data: PaystubData): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  // Header
  drawHeader(doc, "Talon de paie / Pay stub", data.paystub_number);

  let y = 52;

  // Period + pay date band
  doc.setFillColor(GREY_BG[0], GREY_BG[1], GREY_BG[2]);
  doc.setDrawColor(GREY_BORDER[0], GREY_BORDER[1], GREY_BORDER[2]);
  doc.roundedRect(15, y, pw - 30, 14, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Période de paie", 18, y + 5.5);
  doc.text("Date de paie", pw - 18, y + 5.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Du ${fmtDate(data.period_start)} au ${fmtDate(data.period_end)}`, 18, y + 11);
  doc.text(fmtDate(data.pay_date), pw - 18, y + 11, { align: "right" });
  y += 20;

  // Employee block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("Employé", 15, y);
  doc.setTextColor(0, 0, 0);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(data.employee_name, 15, y);
  y += 4.5;
  if (data.agent_number) {
    doc.text(`Numéro d'agent : ${data.agent_number}`, 15, y);
    y += 4.5;
  }
  doc.text(`Méthode de paiement : ${PAY_METHOD_LABEL[data.payment_method] || data.payment_method}`, 15, y);
  y += 8;

  // Earnings table
  y = drawSection(doc, "Gains (Earnings)", y);
  y = drawRow(doc, "Commissions", fmtCAD(data.commission_gross), y);
  if (data.bonus_amount > 0) y = drawRow(doc, "Bonus mensuel", fmtCAD(data.bonus_amount), y);
  y = drawTotalRow(doc, "TOTAL BRUT", fmtCAD(data.total_gross), y, NAVY);
  y += 4;

  // Deductions
  y = drawSection(doc, "Déductions", y);
  y = drawRow(doc, "Impôt fédéral", `- ${fmtCAD(data.federal_tax)}`, y);
  y = drawRow(doc, "Impôt provincial (Québec)", `- ${fmtCAD(data.quebec_tax)}`, y);
  y = drawRow(doc, "RRQ (Régime de rentes du Québec)", `- ${fmtCAD(data.rrq)}`, y);
  y = drawRow(doc, "Assurance-emploi (AE)", `- ${fmtCAD(data.ae)}`, y);
  y = drawRow(doc, "RQAP (Assurance parentale)", `- ${fmtCAD(data.rqap)}`, y);
  y = drawRow(doc, "Assurance invalidité", `- ${fmtCAD(data.disability_insurance)}`, y);
  y = drawTotalRow(doc, "TOTAL DÉDUCTIONS", `- ${fmtCAD(data.total_deductions)}`, y, [180, 50, 50]);
  y += 6;

  // NET PAY block — large green
  doc.setFillColor(232, 248, 240);
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.roundedRect(15, y, pw - 30, 18, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text("NET À PAYER", 18, y + 11.5);
  doc.setFontSize(16);
  doc.text(fmtCAD(data.net_pay), pw - 18, y + 11.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 24;

  // YTD section
  y = drawSection(doc, "Cumul annuel (Year-to-date)", y);
  y = drawRow(doc, "Cumul brut", fmtCAD(data.ytd_gross), y);
  y = drawRow(doc, "Cumul déductions", fmtCAD(data.ytd_deductions), y);
  y = drawRow(doc, "Cumul net", fmtCAD(data.ytd_net), y);

  // Disclosure
  y += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(
    "Ce talon de paie est généré automatiquement par Nivra Communication Inc.",
    pw / 2, y, { align: "center" }
  );

  drawFooter(doc);

  const ab = doc.output("arraybuffer");
  return new Uint8Array(ab);
}

function drawSection(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title, 15, y);
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.3);
  doc.line(15, y + 1.5, doc.internal.pageSize.getWidth() - 15, y + 1.5);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

function drawRow(doc: jsPDF, label: string, value: string, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(label, 15, y);
  doc.setTextColor(0, 0, 0);
  doc.text(value, pw - 15, y, { align: "right" });
  return y + 5;
}

function drawTotalRow(doc: jsPDF, label: string, value: string, y: number, color: [number, number, number]): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(15, y - 1, pw - 15, y - 1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(label, 15, y + 3);
  doc.text(value, pw - 15, y + 3, { align: "right" });
  doc.setTextColor(0, 0, 0);
  return y + 8;
}
