/**
 * Collections Transfer Notice - v2 layout (accent RED).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawHeroBox, drawInfoBox, drawZebraTable,
  fmtDate, fmtCAD, RED, AMBER, AMBER_BG, BLUE_LIGHT, BLUE,
} from "./_baseTemplate.ts";

export interface CollectionsTransferData {
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
    let y = drawHeaderV2(doc, {
      title: "TRANSFERT AU RECOUVREMENT",
      subtitle: "Dossier transmis à une agence externe",
      docNumber: data.notice_number,
      docDate: fmtDate(data.issue_date),
      accent: RED,
    });

    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name],
      ["N° de compte", data.account_number],
      ["Courriel", data.client_email || "--"],
      ["Date d'effet du transfert", fmtDate(data.transfer_effective_date)],
    ]);

    y = drawHeroBox(doc, y, {
      label: "Montant transféré au recouvrement",
      value: fmtCAD(data.total_transferred),
      sublabel: "Nivra Telecom n'accepte plus de paiement direct pour ce solde",
      bg: RED,
    });

    y = drawSectionTitle(doc, "Agence de recouvrement", y, RED);
    const rows: Array<Array<string>> = [
      ["Nom de l'agence", data.collection_agency_name],
    ];
    if (data.collection_agency_phone) rows.push(["Téléphone", data.collection_agency_phone]);
    if (data.collection_agency_email) rows.push(["Courriel", data.collection_agency_email]);
    if (data.collection_agency_reference) rows.push(["Référence du dossier", data.collection_agency_reference]);
    y = drawZebraTable(doc, y, ["Coordonnée", "Valeur"], rows, [70, 110], RED);

    if (data.credit_bureau_reported) {
      y = drawInfoBox(doc, y, {
        title: "Signalement aux bureaux de crédit",
        body: "Ce dossier a été signalé à Equifax et TransUnion. Cette inscription peut affecter votre cote de crédit pour une durée maximale de 6 ans selon la législation en vigueur.",
        bg: AMBER_BG, border: AMBER, accent: AMBER,
      });
    }

    y = drawInfoBox(doc, y, {
      title: "Prochaines étapes",
      body: "Contactez directement l'agence indiquée ci-dessus pour convenir d'un règlement. Une fois le solde payé, votre dossier sera fermé et vous recevrez une confirmation officielle. Toute communication à Nivra Telecom concernant ce solde sera redirigée vers l'agence.",
      bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
    });

    drawFooterV2(doc);
    return { success: true, blob: doc.output("blob"), filename: `Transfert_Recouvrement_${data.notice_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateCollectionsTransferPDF;
