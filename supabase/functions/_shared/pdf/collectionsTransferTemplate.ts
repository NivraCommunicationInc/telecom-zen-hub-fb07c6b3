/**
 * Collections Transfer Notice — Avis de transfert au recouvrement externe.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, fmtCAD, RED, ORANGE } from "./_baseTemplate.ts";

export interface CollectionsTransferData {
  notice_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  total_transferred: number;
  collection_agency_name: string;
  collection_agency_phone?: string;
  collection_agency_email?: string;
  collection_agency_reference?: string;
  transfer_effective_date: string;
  credit_bureau_reported?: boolean;
}

export function generateCollectionsTransferPDF(data: CollectionsTransferData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "TRANSFERT AU RECOUVREMENT", data.notice_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone, account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    doc.text(`Date d'effet: ${fmtDate(data.transfer_effective_date)}`, 110, y);
    y += 10;

    y = drawBoxedText(
      doc,
      `Faute de paiement, votre dossier a ete transfere a une agence de recouvrement externe a compter du ${fmtDate(data.transfer_effective_date)}. Toute communication concernant ce solde doit desormais etre adressee directement a l'agence indiquee ci-dessous.`,
      y,
      { fillColor: [254, 242, 242], borderColor: RED, textColor: RED }
    );

    y = drawSectionTitle(doc, "Montant transfere", y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text(fmtCAD(data.total_transferred), 105, y + 6, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 14;

    y = drawSectionTitle(doc, "Coordonnees de l'agence de recouvrement", y);
    y = drawKeyValue(doc, "Agence", data.collection_agency_name, y);
    if (data.collection_agency_phone) y = drawKeyValue(doc, "Telephone", data.collection_agency_phone, y);
    if (data.collection_agency_email) y = drawKeyValue(doc, "Courriel", data.collection_agency_email, y);
    if (data.collection_agency_reference) y = drawKeyValue(doc, "Reference dossier", data.collection_agency_reference, y);
    y += 4;

    if (data.credit_bureau_reported) {
      y = drawBoxedText(
        doc,
        "Ce dossier a egalement ete signale aux bureaux de credit Equifax et TransUnion. Cela peut affecter votre cote de credit pour une duree maximale de 6 ans selon la legislation en vigueur.",
        y,
        { fillColor: [255, 251, 235], borderColor: ORANGE }
      );
    }

    y = drawBoxedText(
      doc,
      "Une fois le solde regle aupres de l'agence, votre dossier sera ferme et vous recevrez une confirmation de paiement officielle. Nivra Telecom n'accepte plus de paiements directs pour ce solde.",
      y,
      { fillColor: [248, 250, 252], borderColor: [200, 200, 200] }
    );

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Transfert_Recouvrement_${data.notice_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateCollectionsTransferPDF;
