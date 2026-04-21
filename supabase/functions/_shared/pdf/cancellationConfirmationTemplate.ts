/**
 * Cancellation Confirmation — Confirmation d'annulation de service.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, fmtCAD, NAVY, GREEN } from "./_baseTemplate.ts";

export interface CancellationConfirmationData {
  confirmation_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  service_name: string;
  cancellation_date: string;
  effective_date: string;
  reason?: string;
  final_balance: number;          // can be 0, positive (owed) or negative (refund)
  equipment_to_return?: string[];
  refund_pending?: number;
  notes?: string;
}

export function generateCancellationConfirmationPDF(data: CancellationConfirmationData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "CONFIRMATION D'ANNULATION", data.confirmation_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone, account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date de la demande: ${fmtDate(data.cancellation_date)}`, 15, y);
    doc.text(`Date d'effet: ${fmtDate(data.effective_date)}`, 110, y);
    y += 10;

    y = drawBoxedText(
      doc,
      `Nous confirmons l'annulation de votre service ${data.service_name}. Le service prendra fin a la date d'effet indiquee ci-dessus. Aucune facturation supplementaire ne sera emise apres cette date.`,
      y,
      { fillColor: [240, 253, 244], borderColor: GREEN }
    );

    if (data.reason) {
      y = drawSectionTitle(doc, "Motif de l'annulation", y);
      y = drawBoxedText(doc, data.reason, y);
    }

    y = drawSectionTitle(doc, "Solde final", y);
    if (data.final_balance > 0) {
      y = drawKeyValue(doc, "Montant restant du", fmtCAD(data.final_balance), y);
    } else if (data.final_balance < 0) {
      y = drawKeyValue(doc, "Credit en votre faveur", fmtCAD(Math.abs(data.final_balance)), y);
    } else {
      y = drawKeyValue(doc, "Solde", "0,00 $ — Aucun montant du", y);
    }
    if (data.refund_pending && data.refund_pending > 0) {
      y = drawKeyValue(doc, "Remboursement a venir", fmtCAD(data.refund_pending), y);
    }
    y += 4;

    if (data.equipment_to_return && data.equipment_to_return.length > 0) {
      y = drawSectionTitle(doc, "Equipement a retourner", y);
      const list = data.equipment_to_return.map((e, i) => `${i + 1}. ${e}`).join("\n");
      y = drawBoxedText(doc, list, y, { fillColor: [255, 251, 235], borderColor: [217, 119, 6] });
    }

    if (data.notes) {
      y = drawSectionTitle(doc, "Notes", y);
      y = drawBoxedText(doc, data.notes, y);
    }

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Confirmation_Annulation_${data.confirmation_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateCancellationConfirmationPDF;
