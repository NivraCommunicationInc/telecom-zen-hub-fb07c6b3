/**
 * Return Instructions - v2 layout (accent ORANGE/AMBER).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawHeroBox, drawInfoBox, drawZebraTable,
  fmtDate, fmtCAD, AMBER, AMBER_BG, NAVY, BLUE_LIGHT, BLUE,
} from "./_baseTemplate.ts";

export interface ReturnInstructionsData {
  instruction_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
  return_deadline: string;
  return_address: string;
  return_city: string;
  return_province: string;
  return_postal: string;
  items: Array<{ description: string; serial_number?: string; }>;
  non_return_fee: number;
  return_method?: string;
  rma_number?: string;
}

export function generateReturnInstructionsPDF(data: ReturnInstructionsData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "INSTRUCTIONS DE RETOUR",
      subtitle: "Retour de l'équipement Nivra Telecom",
      docNumber: data.instruction_number,
      docDate: fmtDate(data.issue_date),
      accent: AMBER,
    });

    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name],
      ["N° de compte", data.account_number],
      ["N° RMA", data.rma_number || "--"],
      ["Date limite de retour", fmtDate(data.return_deadline)],
      ["Mode de retour", data.return_method || "Postes Canada avec suivi"],
      ["Frais / article non retourné", fmtCAD(data.non_return_fee)],
    ]);

    y = drawHeroBox(doc, y, {
      label: "Date limite de retour",
      value: fmtDate(data.return_deadline),
      sublabel: `Passé cette date : ${fmtCAD(data.non_return_fee)} facturé par article non retourné`,
      bg: AMBER,
    });

    y = drawSectionTitle(doc, "Équipement à retourner", y, AMBER);
    const rows = data.items.map((it, i) => [
      String(i + 1),
      it.description,
      it.serial_number || "--",
    ]);
    y = drawZebraTable(doc, y, ["#", "Description", "Numéro de série"], rows, [12, 108, 60], AMBER);

    y = drawSectionTitle(doc, "Adresse de retour", y, NAVY);
    y = drawInfoBox(doc, y, {
      title: "Expédier à",
      body: `Nivra Telecom - Service Retours\n${data.return_address}\n${data.return_city}, ${data.return_province} ${data.return_postal}`,
      bg: BLUE_LIGHT, border: NAVY, accent: NAVY,
    });

    y = drawSectionTitle(doc, "Procédure à suivre", y, AMBER);
    y = drawInfoBox(doc, y, {
      title: "5 étapes",
      body:
        "1. Emballez l'équipement dans son emballage d'origine ou un carton résistant.\n" +
        "2. Insérez tous les accessoires : câbles, alimentation, support, télécommande.\n" +
        "3. Joignez ce document à l'intérieur du colis (visible dès l'ouverture).\n" +
        "4. Expédiez avec un service qui offre un numéro de suivi et conservez la preuve d'envoi.\n" +
        "5. Confirmez l'expédition par courriel à Support@nivra-telecom.ca avec le numéro de suivi.",
      bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
    });

    y = drawSectionTitle(doc, "Frais en cas de non-retour", y, AMBER);
    y = drawInfoBox(doc, y, {
      title: `${fmtCAD(data.non_return_fee)} par article manquant ou endommagé`,
      body: `Tout équipement non retourné ou retourné endommagé avant le ${fmtDate(data.return_deadline)} sera facturé au montant indiqué par article. Les frais sont automatiquement prélevés sur le mode de paiement enregistré au dossier.`,
      bg: AMBER_BG, border: AMBER, accent: AMBER,
    });

    drawFooterV2(doc);
    return { success: true, blob: doc.output("blob"), filename: `Instructions_Retour_${data.instruction_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateReturnInstructionsPDF;
