/**
 * Paystub PDF — TALON DE PAIE / PAY STUB (Nivra)
 * Professional carrier-grade layout (Bell/Telus class).
 * - Company identity block (NIVRA address + tax registrations)
 * - Employee block with email, role, agent number, payment method
 * - Full breakdown of commissions (per line) + adjustments (per line)
 * - Hours × rate detail
 * - Deductions split with annualized totals
 * - YTD section
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import {
  NAVY, GREEN, GREY_BG, GREY_BORDER,
  fmtCAD, fmtDate, drawFooter,
} from "./_baseTemplate.ts";
import { NIVRA } from "./companyInfo.ts";

export interface PaystubLineItem {
  label: string;
  detail?: string | null;     // e.g. "Cmd a1b2c3 — 15 mai 2026"
  amount: number;
}

export interface PaystubData {
  paystub_number: string;
  pay_date: string;          // YYYY-MM-DD
  period_start: string;
  period_end: string;
  employee_name: string;
  employee_email?: string | null;
  agent_number: string | null;
  employee_role?: string | null;
  payment_method: string;

  // Earnings — totals (rolled up)
  commission_gross: number;
  regular_hours_pay?: number;
  overtime_hours_pay?: number;
  hours_regular?: number;
  hours_overtime?: number;
  hourly_rate?: number;
  allocation_total?: number;
  bonus_amount: number;
  total_gross: number;

  // Optional detail lists (when present, rendered as line items)
  commission_lines?: PaystubLineItem[];
  adjustment_lines?: PaystubLineItem[];

  // Deductions
  federal_tax: number;
  quebec_tax: number;
  rrq: number;
  ae: number;
  rqap: number;
  disability_insurance: number;
  manual_deductions?: number;
  total_deductions: number;

  net_pay: number;

  // YTD
  ytd_gross: number;
  ytd_deductions: number;
  ytd_net: number;
}

const PAY_METHOD_LABEL: Record<string, string> = {
  interac: "Virement Interac",
  direct_deposit: "Dépôt direct",
  paypal: "PayPal",
};

const ROLE_LABEL: Record<string, string> = {
  field_sales: "Représentant terrain",
  employee: "Employé",
  technician: "Technicien",
  admin: "Administrateur",
  hr: "Ressources humaines",
};

export function buildPaystubPdf(data: PaystubData): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ───────── Header (navy band) ─────────
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pw, 42, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(NIVRA.legalName, 15, 22);
  doc.setFontSize(8);
  doc.text(NIVRA.address, 15, 27);
  doc.text(`${NIVRA.tpsLabel}   ·   ${NIVRA.tvqLabel}`, 15, 31);
  doc.text(`${NIVRA.email}   ·   ${NIVRA.website}`, 15, 35);

  // Right-side title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TALON DE PAIE", pw - 15, 14, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("PAY STUB", pw - 15, 19, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`No ${data.paystub_number}`, pw - 15, 26, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Date de paie : ${fmtDate(data.pay_date)}`, pw - 15, 31, { align: "right" });

  let y = 50;

  // ───────── Employee + Period info card ─────────
  doc.setFillColor(GREY_BG[0], GREY_BG[1], GREY_BG[2]);
  doc.setDrawColor(GREY_BORDER[0], GREY_BORDER[1], GREY_BORDER[2]);
  doc.roundedRect(15, y, pw - 30, 36, 1.5, 1.5, "FD");

  const midX = pw / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("EMPLOYÉ", 18, y + 5);
  doc.text("PÉRIODE DE PAIE", midX + 2, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  let yL = y + 10;
  doc.text(`Nom : ${data.employee_name}`, 18, yL); yL += 4.5;
  if (data.employee_email) { doc.text(`Courriel : ${data.employee_email}`, 18, yL); yL += 4.5; }
  if (data.agent_number) { doc.text(`N° agent : ${data.agent_number}`, 18, yL); yL += 4.5; }
  if (data.employee_role) {
    const lbl = ROLE_LABEL[data.employee_role] || data.employee_role;
    doc.text(`Rôle : ${lbl}`, 18, yL); yL += 4.5;
  }
  doc.text(`Méthode : ${PAY_METHOD_LABEL[data.payment_method] || data.payment_method}`, 18, yL);

  let yR = y + 10;
  doc.text(`Du : ${fmtDate(data.period_start)}`, midX + 2, yR); yR += 4.5;
  doc.text(`Au : ${fmtDate(data.period_end)}`, midX + 2, yR); yR += 4.5;
  doc.text(`Date de paie : ${fmtDate(data.pay_date)}`, midX + 2, yR); yR += 4.5;
  doc.text(`N° talon : ${data.paystub_number}`, midX + 2, yR);

  y += 42;

  // ───────── REVENUS ─────────
  y = drawSection(doc, "REVENUS", y);

  // Hours (with rate detail)
  if ((data.regular_hours_pay ?? 0) > 0) {
    const hrs = data.hours_regular ?? 0;
    const rate = data.hourly_rate ?? 0;
    const detail = hrs > 0 && rate > 0 ? `${hrs.toFixed(2)} h × ${fmtCAD(rate)}/h` : null;
    y = drawDetailedRow(doc, "Heures régulières", detail, fmtCAD(data.regular_hours_pay!), y);
  }
  if ((data.overtime_hours_pay ?? 0) > 0) {
    const oth = data.hours_overtime ?? 0;
    const rate = data.hourly_rate ?? 0;
    const detail = oth > 0 && rate > 0 ? `${oth.toFixed(2)} h × ${fmtCAD(rate * 1.5)}/h (1,5×)` : null;
    y = drawDetailedRow(doc, "Heures supplémentaires", detail, fmtCAD(data.overtime_hours_pay!), y);
  }

  // Commissions — show per-line breakdown if available
  if (data.commission_gross > 0) {
    if (data.commission_lines && data.commission_lines.length > 0) {
      y = drawSubheader(doc, `Commissions (${data.commission_lines.length})`, y);
      for (const line of data.commission_lines) {
        y = ensurePage(doc, y, 6);
        y = drawDetailedRow(doc, `  • ${line.label}`, line.detail ?? null, fmtCAD(line.amount), y, true);
      }
      y = drawSubtotalRow(doc, "Sous-total commissions", fmtCAD(data.commission_gross), y);
    } else {
      y = drawDetailedRow(doc, "Commissions", null, fmtCAD(data.commission_gross), y);
    }
  }

  // Bonus
  if (data.bonus_amount > 0) {
    y = drawDetailedRow(doc, "Bonus mensuel", "Versé le dernier vendredi du mois", fmtCAD(data.bonus_amount), y);
  }

  // Adjustments — show per-line
  if ((data.allocation_total ?? 0) !== 0) {
    if (data.adjustment_lines && data.adjustment_lines.length > 0) {
      y = drawSubheader(doc, `Allocations & ajustements (${data.adjustment_lines.length})`, y);
      for (const line of data.adjustment_lines) {
        y = ensurePage(doc, y, 6);
        const sign = line.amount < 0 ? "- " : "";
        y = drawDetailedRow(doc, `  • ${line.label}`, line.detail ?? null, `${sign}${fmtCAD(Math.abs(line.amount))}`, y, true);
      }
      y = drawSubtotalRow(doc, "Sous-total allocations", fmtCAD(data.allocation_total!), y);
    } else {
      y = drawDetailedRow(doc, "Allocations / ajustements", null, fmtCAD(data.allocation_total!), y);
    }
  }

  y = drawTotalRow(doc, "TOTAL BRUT", fmtCAD(data.total_gross), y, NAVY);
  y += 4;

  // ───────── DÉDUCTIONS ─────────
  y = ensurePage(doc, y, 60);
  y = drawSection(doc, "DÉDUCTIONS", y);
  y = drawRow(doc, "Impôt fédéral", `- ${fmtCAD(data.federal_tax)}`, y);
  y = drawRow(doc, "Impôt provincial (Québec)", `- ${fmtCAD(data.quebec_tax)}`, y);
  y = drawRow(doc, "RRQ (Régime de rentes du Québec)", `- ${fmtCAD(data.rrq)}`, y);
  y = drawRow(doc, "Assurance-emploi (AE)", `- ${fmtCAD(data.ae)}`, y);
  y = drawRow(doc, "RQAP (Assurance parentale)", `- ${fmtCAD(data.rqap)}`, y);
  y = drawRow(doc, "Assurance invalidité", `- ${fmtCAD(data.disability_insurance)}`, y);
  if ((data.manual_deductions ?? 0) > 0) {
    y = drawRow(doc, "Avances / déductions manuelles", `- ${fmtCAD(data.manual_deductions!)}`, y);
  }
  y = drawTotalRow(doc, "TOTAL DÉDUCTIONS", `- ${fmtCAD(data.total_deductions)}`, y, [180, 50, 50]);
  y += 6;

  // ───────── NET À PAYER ─────────
  y = ensurePage(doc, y, 28);
  doc.setFillColor(232, 248, 240);
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, y, pw - 30, 20, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text("NET À PAYER", 18, y + 12.5);
  doc.setFontSize(18);
  doc.text(fmtCAD(data.net_pay), pw - 18, y + 12.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 26;

  // ───────── YTD ─────────
  y = ensurePage(doc, y, 25);
  y = drawSection(doc, "CUMUL ANNUEL (Year-to-date)", y);
  y = drawRow(doc, "Brut YTD", fmtCAD(data.ytd_gross), y);
  y = drawRow(doc, "Déductions YTD", `- ${fmtCAD(data.ytd_deductions)}`, y);
  y = drawRow(doc, "Net YTD", fmtCAD(data.ytd_net), y);

  // Disclosure
  y += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(
    "Document confidentiel généré automatiquement par Nivra Communications Inc.",
    pw / 2, Math.min(y, ph - 25), { align: "center" },
  );

  drawFooter(doc);

  const ab = doc.output("arraybuffer");
  return new Uint8Array(ab);
}

// ──────── Layout helpers ────────
function ensurePage(doc: jsPDF, y: number, needed: number): number {
  const ph = doc.internal.pageSize.getHeight();
  if (y + needed > ph - 25) {
    doc.addPage();
    drawFooter(doc);
    return 20;
  }
  return y;
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

function drawSubheader(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(title.toUpperCase(), 15, y);
  doc.setTextColor(0, 0, 0);
  return y + 4.5;
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

function drawDetailedRow(
  doc: jsPDF,
  label: string,
  detail: string | null,
  value: string,
  y: number,
  small = false,
): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(small ? 8.5 : 9);
  doc.setTextColor(40, 40, 40);
  doc.text(label, 15, y);
  doc.setTextColor(0, 0, 0);
  doc.text(value, pw - 15, y, { align: "right" });
  if (detail) {
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(detail, 17, y + 3.5);
    doc.setTextColor(0, 0, 0);
    return y + 8;
  }
  return y + (small ? 4.5 : 5);
}

function drawSubtotalRow(doc: jsPDF, label: string, value: string, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.15);
  doc.line(15, y - 0.5, pw - 15, y - 0.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(label, 15, y + 2.5);
  doc.text(value, pw - 15, y + 2.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  return y + 7;
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
