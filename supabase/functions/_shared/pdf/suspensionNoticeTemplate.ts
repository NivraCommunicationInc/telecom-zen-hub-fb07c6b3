/**
 * Suspension Notice - Avis de suspension du service.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, fmtCAD, ORANGE, RED } from "./_baseTemplate.ts";

export interface SuspensionNoticeData {
  notice_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
  service_name: string;
  reason: string;
  suspension_date: string;
  amount_due?: number;
  invoice_numbers?: string[];
  reactivation_fee?: number;
  reactivation_instructions?: string;
}

export function generateSuspensionNoticePDF(data: SuspensionNoticeData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "AVIS DE SUSPENSION", data.notice_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone,
      address: data.client_address, city: data.client_city, province: data.client_province, postal: data.client_postal,
      account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    doc.text(`Date de suspension: ${fmtDate(data.suspension_date)}`, 110, y);
    y += 10;

    y = drawBoxedText(
      doc,
      `Votre service ${data.service_name} a ete suspendu pour le motif indique ci-dessous. Aucune nouvelle utilisation n'est possible jusqu'a regularisation.`,
      y,
      { fillColor: [254, 242, 242], borderColor: RED, textColor: RED }
    );

    y = drawSectionTitle(doc, "Motif de la suspension", y);
    y = drawBoxedText(doc, data.reason, y);

    if (data.amount_due && data.amount_due > 0) {
      y = drawSectionTitle(doc, "Montant a regulariser", y);
      y = drawKeyValue(doc, "Solde du", fmtCAD(data.amount_due), y);
      if (data.invoice_numbers && data.invoice_numbers.length > 0) {
        y = drawKeyValue(doc, "Factures concernees", data.invoice_numbers.join(", "), y);
      }
      if (data.reactivation_fee && data.reactivation_fee > 0) {
        y = drawKeyValue(doc, "Frais de reactivation", fmtCAD(data.reactivation_fee), y);
      }
      y += 4;
    }

    y = drawSectionTitle(doc, "Reactivation du service", y);
    y = drawBoxedText(
      doc,
      data.reactivation_instructions ||
      "Pour reactiver votre service : (1) reglez le solde total via votre portail client, (2) contactez notre equipe par courriel pour confirmer la reactivation. Le delai standard est de 1 a 2 jours ouvrables.",
      y,
      { fillColor: [255, 251, 235], borderColor: ORANGE }
    );

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Avis_Suspension_${data.notice_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateSuspensionNoticePDF;
