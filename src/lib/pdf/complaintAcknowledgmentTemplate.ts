/**
 * Complaint Acknowledgment — Accuse de reception d'une plainte client (CCTS-compliant).
 */
import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, NAVY, GREEN } from "./_baseTemplate";

export interface ComplaintAcknowledgmentData {
  acknowledgment_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  complaint_received_date: string;
  complaint_summary: string;
  case_number: string;
  assigned_agent?: string;
  expected_resolution_date: string;     // typically 10 business days
  next_step?: string;
}

export function generateComplaintAcknowledgmentPDF(data: ComplaintAcknowledgmentData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "ACCUSE DE RECEPTION — PLAINTE", data.acknowledgment_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone, account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date de reception: ${fmtDate(data.complaint_received_date)}`, 15, y);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 110, y);
    y += 10;

    y = drawBoxedText(
      doc,
      `Nous accusons reception de votre plainte. Votre dossier porte le numero ${data.case_number} et est traite avec attention par notre equipe.`,
      y,
      { fillColor: [240, 253, 244], borderColor: GREEN, textColor: GREEN }
    );

    y = drawSectionTitle(doc, "Resume de la plainte", y);
    y = drawBoxedText(doc, data.complaint_summary, y);

    y = drawSectionTitle(doc, "Suivi de votre dossier", y);
    y = drawKeyValue(doc, "Numero de dossier", data.case_number, y);
    if (data.assigned_agent) y = drawKeyValue(doc, "Agent assigne", data.assigned_agent, y);
    y = drawKeyValue(doc, "Resolution prevue le", fmtDate(data.expected_resolution_date), y);
    y += 4;

    if (data.next_step) {
      y = drawSectionTitle(doc, "Prochaine etape", y);
      y = drawBoxedText(doc, data.next_step, y);
    }

    y = drawSectionTitle(doc, "Recours externe", y);
    y = drawBoxedText(
      doc,
      "Si la resolution proposee ne vous satisfait pas, vous pouvez transmettre votre plainte a la Commission des plaintes relatives aux services de telecom-television (CCTS) au www.ccts-cprst.ca ou par telephone au 1-888-221-1687.",
      y,
      { fillColor: [240, 248, 255], borderColor: NAVY, textColor: NAVY }
    );

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Accuse_Plainte_${data.acknowledgment_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateComplaintAcknowledgmentPDF;
