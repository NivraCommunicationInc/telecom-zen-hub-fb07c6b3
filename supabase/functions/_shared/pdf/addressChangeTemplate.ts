/**
 * Address Change Notice — Confirmation de changement d'adresse de service.
 */
import { jsPDF } from "jspdf";
import type { PDFGenerationResult } from "./types";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, GREY_BG, NAVY } from "./_baseTemplate";

export interface AddressChangeData {
  notice_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  old_address: string;
  old_city?: string;
  old_province?: string;
  old_postal?: string;
  new_address: string;
  new_city?: string;
  new_province?: string;
  new_postal?: string;
  effective_date: string;
  service_continuity: "no_interruption" | "scheduled_interruption" | "reinstall_required";
  notes?: string;
}

const continuityLabel = (t: string): string => {
  switch (t) {
    case "no_interruption": return "Aucune interruption de service prevue";
    case "scheduled_interruption": return "Interruption planifiee — voir notes";
    case "reinstall_required": return "Reinstallation requise par technicien";
    default: return "—";
  }
};

export function generateAddressChangePDF(data: AddressChangeData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    drawHeader(doc, "CHANGEMENT D'ADRESSE", data.notice_number);
    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone,
      account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date de la demande: ${fmtDate(data.issue_date)}`, 15, y);
    doc.text(`Date d'effet: ${fmtDate(data.effective_date)}`, 110, y);
    y += 10;

    // Old address
    y = drawSectionTitle(doc, "Ancienne adresse de service", y);
    const oldFull = `${data.old_address}\n${data.old_city || ""}, ${data.old_province || "QC"} ${data.old_postal || ""}`;
    y = drawBoxedText(doc, oldFull, y, { fillColor: [254, 242, 242], borderColor: [220, 80, 80] });

    // New address
    y = drawSectionTitle(doc, "Nouvelle adresse de service", y);
    const newFull = `${data.new_address}\n${data.new_city || ""}, ${data.new_province || "QC"} ${data.new_postal || ""}`;
    y = drawBoxedText(doc, newFull, y, { fillColor: [240, 253, 244], borderColor: [22, 163, 74] });

    // Continuity
    y = drawSectionTitle(doc, "Continuite du service", y);
    y = drawBoxedText(doc, continuityLabel(data.service_continuity), y, { fillColor: GREY_BG, borderColor: NAVY });

    if (data.notes) {
      y = drawSectionTitle(doc, "Notes", y);
      y = drawBoxedText(doc, data.notes, y);
    }

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Changement_Adresse_${data.notice_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateAddressChangePDF;
