/**
 * paymentConfirmationTemplate — Avis de paiement officiel Nivra (RH).
 * Document remis à l'employé confirmant le versement de sa paie nette.
 * Distinct du talon de paie : confirme uniquement le décaissement.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtCAD, fmtDate, NAVY, GREEN, GREY_BG, GREY_BORDER } from "./_baseTemplate.ts";

export interface PaymentConfirmationData {
  confirmation_number: string;
  payroll_number?: string | null;
  pay_date: string;
  period_start?: string | null;
  period_end?: string | null;
  employee_name: string;
  employee_email?: string | null;
  employee_phone?: string | null;
  employee_address?: string | null;
  employee_city?: string | null;
  employee_province?: string | null;
  employee_postal?: string | null;
  agent_number?: string | null;
  employee_role?: string | null;
  payment_method: string;
  payment_status: string;
  payment_reference?: string | null;
  payment_date: string;
  net_amount: number;
  total_gross?: number;
  total_deductions?: number;
  notes?: string | null;
  processed_by?: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  interac: "Virement Interac e-Transfer",
  direct_deposit: "Dépôt direct bancaire",
  paypal: "PayPal",
  cheque: "Chèque papier",
  cash: "Comptant",
  other: "Autre",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Payé",
  sent: "Envoyé",
  pending: "En attente",
  failed: "Échec",
  cancelled: "Annulé",
  processing: "En traitement",
};

export function buildPaymentConfirmationPdf(d: PaymentConfirmationData): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(doc, "Avis de paiement", d.confirmation_number);

  let y = 52;
  // Employee block (reuses client block helper)
  y = drawClientBlock(doc, y, {
    name: d.employee_name,
    email: d.employee_email || undefined,
    phone: d.employee_phone || undefined,
    address: d.employee_address || undefined,
    city: d.employee_city || undefined,
    province: d.employee_province || undefined,
    postal: d.employee_postal || undefined,
    account_number: d.agent_number ? `Agent ${d.agent_number}` : undefined,
  });

  // Status banner
  const statusLabel = STATUS_LABEL[String(d.payment_status).toLowerCase()] || d.payment_status;
  const isPaid = ["paid", "sent"].includes(String(d.payment_status).toLowerCase());
  const bannerColor: [number, number, number] = isPaid ? [220, 252, 231] : [254, 243, 199];
  const borderColor: [number, number, number] = isPaid ? GREEN : [217, 119, 6];
  doc.setFillColor(bannerColor[0], bannerColor[1], bannerColor[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(15, y, 180, 16, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.text(`Statut du paiement : ${statusLabel.toUpperCase()}`, 20, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Versement effectué le ${fmtDate(d.payment_date)} via ${METHOD_LABEL[d.payment_method] || d.payment_method}`, 20, y + 12);
  y += 22;

  // Payment details
  y = drawSectionTitle(doc, "Détails du versement", y);
  y = drawKeyValue(doc, "N° avis de paiement", d.confirmation_number, y);
  if (d.payroll_number) y = drawKeyValue(doc, "Talon associé", d.payroll_number, y);
  if (d.period_start && d.period_end) y = drawKeyValue(doc, "Période de paie", `${fmtDate(d.period_start)} au ${fmtDate(d.period_end)}`, y);
  y = drawKeyValue(doc, "Date de paie", fmtDate(d.pay_date), y);
  y = drawKeyValue(doc, "Date du versement", fmtDate(d.payment_date), y);
  y = drawKeyValue(doc, "Méthode de paiement", METHOD_LABEL[d.payment_method] || d.payment_method, y);
  if (d.payment_reference) y = drawKeyValue(doc, "Référence transaction", d.payment_reference, y);
  if (d.processed_by) y = drawKeyValue(doc, "Traité par", d.processed_by, y);
  y += 4;

  // Amount box
  doc.setFillColor(GREY_BG[0], GREY_BG[1], GREY_BG[2]);
  doc.setDrawColor(GREY_BORDER[0], GREY_BORDER[1], GREY_BORDER[2]);
  doc.roundedRect(15, y, 180, 38, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (typeof d.total_gross === "number") {
    doc.text("Salaire brut", 20, y + 8);
    doc.text(fmtCAD(d.total_gross), 195, y + 8, { align: "right" });
  }
  if (typeof d.total_deductions === "number") {
    doc.text("Déductions totales", 20, y + 16);
    doc.setTextColor(180, 50, 50);
    doc.text(`- ${fmtCAD(d.total_deductions)}`, 195, y + 16, { align: "right" });
    doc.setTextColor(80, 80, 80);
  }
  doc.setDrawColor(GREY_BORDER[0], GREY_BORDER[1], GREY_BORDER[2]);
  doc.line(20, y + 22, 195, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("MONTANT VERSÉ (NET)", 20, y + 31);
  doc.setFontSize(15);
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text(fmtCAD(d.net_amount), 195, y + 31, { align: "right" });
  y += 44;

  if (d.notes && d.notes.trim()) {
    y = drawSectionTitle(doc, "Notes", y);
    y = drawBoxedText(doc, d.notes.trim(), y);
  }

  // Legal note
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(
    "Cet avis confirme uniquement le décaissement de votre paie nette. Le détail des gains, retenues et cotisations\nfigure sur votre talon de paie correspondant.",
    15, y + 4
  );

  drawFooter(doc);
  return new Uint8Array(doc.output("arraybuffer"));
}
