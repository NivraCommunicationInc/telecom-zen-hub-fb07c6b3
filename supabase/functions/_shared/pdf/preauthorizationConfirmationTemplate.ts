/**
 * Preauthorization Confirmation - Confirmation de pre-autorisation de paiement.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, fmtCAD, NAVY, GREEN } from "./_baseTemplate.ts";

export interface PreauthorizationConfirmationData {
  confirmation_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
  authorized_amount: number;
  payment_method: string;             // "Carte de credit ****1234"
  capture_deadline: string;
  related_order?: string;
  related_invoice?: string;
  purpose: string;                    // "Garantie d'equipement", "Pre-autorisation commande"
  notes?: string;
}

export function generatePreauthorizationConfirmationPDF(data: PreauthorizationConfirmationData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "CONFIRMATION PRE-AUTORISATION", data.confirmation_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone,
      address: data.client_address, city: data.client_city, province: data.client_province, postal: data.client_postal,
      account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    doc.text(`Capture avant: ${fmtDate(data.capture_deadline)}`, 110, y);
    y += 10;

    y = drawBoxedText(
      doc,
      "Une pre-autorisation a ete placee sur votre mode de paiement. Aucun montant n'a encore ete preleve : il s'agit d'un blocage temporaire qui sera capture (preleve) ou libere selon le resultat de votre commande.",
      y,
      { fillColor: [240, 248, 255], borderColor: NAVY, textColor: NAVY }
    );

    y = drawSectionTitle(doc, "Montant pre-autorise", y);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.roundedRect(15, y, 170, 18, 1, 1, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.text(fmtCAD(data.authorized_amount), 105, y + 12, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 24;

    y = drawSectionTitle(doc, "Details", y);
    y = drawKeyValue(doc, "Mode de paiement", data.payment_method, y);
    y = drawKeyValue(doc, "Objet", data.purpose, y);
    if (data.related_order) y = drawKeyValue(doc, "Commande liee", data.related_order, y);
    if (data.related_invoice) y = drawKeyValue(doc, "Facture liee", data.related_invoice, y);
    y = drawKeyValue(doc, "Date limite de capture", fmtDate(data.capture_deadline), y);
    y += 4;

    y = drawSectionTitle(doc, "Que se passe-t-il ensuite ?", y);
    y = drawBoxedText(
      doc,
      "Si la commande est confirmee, le montant sera preleve et un recu officiel vous sera envoye. Si la commande est annulee ou expire avant la date limite de capture, le blocage sera automatiquement libere par votre institution financiere (delai standard : 5 a 7 jours ouvrables).",
      y
    );

    if (data.notes) y = drawBoxedText(doc, data.notes, y);

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Preautorisation_${data.confirmation_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generatePreauthorizationConfirmationPDF;
