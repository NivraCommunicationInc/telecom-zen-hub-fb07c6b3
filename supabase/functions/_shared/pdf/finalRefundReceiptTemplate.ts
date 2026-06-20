/**
 * Final Refund Receipt - Recu de remboursement final (apres annulation/cloture).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawKeyValue, drawBoxedText, fmtDate, fmtCAD, GREEN, NAVY } from "./_baseTemplate.ts";

export interface FinalRefundReceiptData {
  receipt_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  account_number: string;
  related_account_number?: string;
  refund_amount: number;
  refund_method: string;          // "Virement Interac", "PayPal", etc.
  reference_number?: string;
  processed_date: string;
  related_invoice?: string;
  reason: string;
  account_closed?: boolean;
}

export function generateFinalRefundReceiptPDF(data: FinalRefundReceiptData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "RECU DE REMBOURSEMENT FINAL", data.receipt_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    doc.text(`Date de traitement: ${fmtDate(data.processed_date)}`, 110, y);
    y += 10;

    // Big amount
    y = drawSectionTitle(doc, "Montant rembourse", y);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.roundedRect(15, y, 170, 20, 1, 1, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.text(fmtCAD(data.refund_amount), 105, y + 13, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 26;

    y = drawSectionTitle(doc, "Details du remboursement", y);
    y = drawKeyValue(doc, "Methode", data.refund_method, y);
    if (data.reference_number) y = drawKeyValue(doc, "Reference de transaction", data.reference_number, y);
    if (data.related_invoice) y = drawKeyValue(doc, "Facture liee", data.related_invoice, y);
    y = drawKeyValue(doc, "Date de traitement", fmtDate(data.processed_date), y);
    y += 4;

    y = drawSectionTitle(doc, "Motif", y);
    y = drawBoxedText(doc, data.reason, y);

    if (data.account_closed) {
      y = drawBoxedText(
        doc,
        "Ce remboursement constitue le reglement final de votre compte. Votre compte est desormais ferme. Aucune autre transaction ne sera traitee.",
        y,
        { fillColor: [240, 248, 255], borderColor: NAVY, textColor: NAVY }
      );
    }

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Remboursement_Final_${data.receipt_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateFinalRefundReceiptPDF;
