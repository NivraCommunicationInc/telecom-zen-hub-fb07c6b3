/**
 * Complaint Acknowledgment - v2 layout (accent NAVY).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawInfoBox,
  fmtDate, NAVY, BLUE, BLUE_LIGHT, GREEN, GREEN_LIGHT,
} from "./_baseTemplate.ts";

export interface ComplaintAcknowledgmentData {
  acknowledgment_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
  complaint_received_date: string;
  complaint_summary: string;
  case_number: string;
  assigned_agent?: string;
  expected_resolution_date: string;
  next_step?: string;
}

export function generateComplaintAcknowledgmentPDF(data: ComplaintAcknowledgmentData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "ACCUSÉ DE RÉCEPTION",
      subtitle: "Plainte enregistrée - dossier ouvert",
      docNumber: data.acknowledgment_number,
      docDate: fmtDate(data.issue_date),
      accent: NAVY,
    });

    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name],
      ["N° de compte", data.account_number],
      ["N° de dossier", data.case_number],
      ["Reçue le", fmtDate(data.complaint_received_date)],
      ["Agent assigné", data.assigned_agent || "En attribution"],
      ["Résolution prévue", fmtDate(data.expected_resolution_date)],
    ]);

    y = drawInfoBox(doc, y, {
      title: "Dossier reçu et pris en charge",
      body: `Nous confirmons la réception de votre plainte. Elle est traitée avec attention par notre équipe. Le numéro de suivi de votre dossier est ${data.case_number}.`,
      bg: GREEN_LIGHT, border: GREEN, accent: GREEN,
    });

    y = drawSectionTitle(doc, "Résumé de votre plainte", y, NAVY);
    y = drawInfoBox(doc, y, {
      title: "Contenu enregistré",
      body: data.complaint_summary,
      bg: BLUE_LIGHT, border: NAVY, accent: NAVY,
    });

    if (data.next_step) {
      y = drawSectionTitle(doc, "Prochaine étape", y, NAVY);
      y = drawInfoBox(doc, y, {
        title: "Action de notre part",
        body: data.next_step,
        bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
      });
    }

    y = drawSectionTitle(doc, "Recours externe - CCTS", y, NAVY);
    y = drawInfoBox(doc, y, {
      title: "Commission des plaintes relatives aux services de télécom-télévision",
      body:
        "Si la résolution proposée par Nivra Telecom ne vous satisfait pas, vous pouvez transmettre votre plainte à la CCTS, l'organisme indépendant reconnu par le CRTC.\n" +
        "Site web : www.ccts-cprst.ca  -  Téléphone : 1-888-221-1687",
      bg: BLUE_LIGHT, border: NAVY, accent: NAVY,
    });

    drawFooterV2(doc);
    return { success: true, blob: doc.output("blob"), filename: `Accuse_Plainte_${data.acknowledgment_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateComplaintAcknowledgmentPDF;
