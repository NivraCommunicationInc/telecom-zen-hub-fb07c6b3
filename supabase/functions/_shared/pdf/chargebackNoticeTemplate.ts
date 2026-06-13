/**
 * Chargeback Notice â€” Avis de retrofacturation (chargeback).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, fmtCAD, RED, ORANGE } from "./_baseTemplate.ts";

export interface ChargebackNoticeData {
  notice_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number;
  chargeback_amount: number;
  chargeback_date: string;
  bank_reference?: string;
  reason_code?: string;
  reactivation_fee: number;       // typically $25
  total_due: number;              // chargeback_amount + reactivation_fee + interest
  response_deadline: string;
}

export function generateChargebackNoticePDF(data: ChargebackNoticeData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "AVIS DE RETROFACTURATION", data.notice_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone, account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    doc.text(`Date du chargeback: ${fmtDate(data.chargeback_date)}`, 110, y);
    y += 10;

    y = drawBoxedText(
      doc,
      "Nous avons recu un avis de retrofacturation (chargeback) de votre institution financiere concernant le paiement ci-dessous. Cette procedure entraine la suspension immediate de votre compte et l'application de frais.",
      y,
      { fillColor: [254, 242, 242], borderColor: RED, textColor: RED }
    );

    y = drawSectionTitle(doc, "Paiement conteste", y);
    y = drawKeyValue(doc, "Facture liee", `${data.invoice_number} (${fmtDate(data.invoice_date)})`, y);
    y = drawKeyValue(doc, "Montant initial", fmtCAD(data.invoice_amount), y);
    y = drawKeyValue(doc, "Montant retrofacture", fmtCAD(data.chargeback_amount), y);
    if (data.bank_reference) y = drawKeyValue(doc, "Reference bancaire", data.bank_reference, y);
    if (data.reason_code) y = drawKeyValue(doc, "Code de motif", data.reason_code, y);
    y += 4;

    y = drawSectionTitle(doc, "Montants exigibles", y);
    y = drawKeyValue(doc, "Montant retrofacture", fmtCAD(data.chargeback_amount), y);
    y = drawKeyValue(doc, "Frais de reactivation", fmtCAD(data.reactivation_fee), y);
    y += 2;
    doc.setDrawColor(150, 150, 150);
    doc.line(15, y, 185, y); y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text("TOTAL DU", 15, y);
    doc.text(fmtCAD(data.total_due), 180, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 10;

    y = drawSectionTitle(doc, "Action requise", y);
    y = drawBoxedText(
      doc,
      `Vous devez regulariser ce solde avant le ${fmtDate(data.response_deadline)}. Si vous croyez que cette retrofacturation est une erreur, contactez immediatement notre equipe par courriel avec une preuve de paiement (releve bancaire, courriel de confirmation). Sans reponse, le dossier sera transfere en recouvrement.`,
      y,
      { fillColor: [255, 251, 235], borderColor: ORANGE }
    );

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Avis_Chargeback_${data.notice_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateChargebackNoticePDF;
