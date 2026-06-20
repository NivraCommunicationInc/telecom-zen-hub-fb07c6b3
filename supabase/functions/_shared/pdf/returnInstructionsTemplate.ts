/**
 * Return Instructions - Instructions de retour d'equipement.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, fmtCAD, ORANGE, NAVY } from "./_baseTemplate.ts";

export interface ReturnInstructionsData {
  instruction_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  return_deadline: string;
  return_address: string;
  return_city: string;
  return_province: string;
  return_postal: string;
  items: Array<{ description: string; serial_number?: string; }>;
  non_return_fee: number;         // ex: 60$ par borne, 50$ par terminal, 30$ SIM
  return_method?: string;         // "Postes Canada - etiquette prepayee fournie"
  rma_number?: string;
}

export function generateReturnInstructionsPDF(data: ReturnInstructionsData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "INSTRUCTIONS DE RETOUR", data.instruction_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone, account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    doc.text(`Date limite de retour: ${fmtDate(data.return_deadline)}`, 110, y);
    y += 10;

    if (data.rma_number) {
      y = drawKeyValue(doc, "Numero RMA", data.rma_number, y);
      y += 2;
    }

    y = drawSectionTitle(doc, "Equipement a retourner", y);
    const list = data.items.map((it, i) =>
      `${i + 1}. ${it.description}${it.serial_number ? ` (S/N: ${it.serial_number})` : ""}`
    ).join("\n");
    y = drawBoxedText(doc, list, y);

    y = drawSectionTitle(doc, "Adresse de retour", y);
    const addr = `${data.return_address}\n${data.return_city}, ${data.return_province} ${data.return_postal}`;
    y = drawBoxedText(doc, addr, y, { fillColor: [240, 248, 255], borderColor: NAVY });

    if (data.return_method) {
      y = drawSectionTitle(doc, "Mode de retour", y);
      y = drawBoxedText(doc, data.return_method, y);
    }

    y = drawSectionTitle(doc, "Procedure", y);
    y = drawBoxedText(
      doc,
      "1. Emballez l'equipement dans son emballage d'origine ou un carton resistant.\n2. Inserez tous les accessoires (cables, alimentation, support).\n3. Joignez ce document a l'interieur du colis.\n4. Expediez avec un suivi : conservez la preuve d'envoi.\n5. Confirmez l'expedition par courriel a Support@nivra-telecom.ca.",
      y
    );

    y = drawSectionTitle(doc, "Frais en cas de non-retour", y);
    y = drawBoxedText(
      doc,
      `Tout equipement non retourne ou retourne endommage avant le ${fmtDate(data.return_deadline)} sera facture au montant de ${fmtCAD(data.non_return_fee)} par article. Les frais sont automatiquement preleves sur votre mode de paiement enregistre.`,
      y,
      { fillColor: [255, 251, 235], borderColor: ORANGE }
    );

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Instructions_Retour_${data.instruction_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateReturnInstructionsPDF;
