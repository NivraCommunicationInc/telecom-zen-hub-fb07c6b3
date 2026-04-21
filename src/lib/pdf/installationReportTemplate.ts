/**
 * Technician Installation Report — Rapport d'installation par technicien.
 */
import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, GREEN, GREY_BG } from "./_baseTemplate";

export interface InstallationReportData {
  report_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  service_address: string;
  service_city?: string;
  service_province?: string;
  service_postal?: string;
  technician_name: string;
  technician_id?: string;
  appointment_date: string;
  start_time?: string;
  end_time?: string;
  service_installed: string;
  equipment_installed: Array<{ description: string; serial_number?: string; }>;
  outcome: "success" | "partial" | "failed";
  notes?: string;
  client_signature_required?: boolean;
}

const outcomeLabel = (o: string): { text: string; color: [number, number, number] } => {
  switch (o) {
    case "success": return { text: "INSTALLATION REUSSIE", color: [22, 163, 74] };
    case "partial": return { text: "INSTALLATION PARTIELLE — Suivi requis", color: [217, 119, 6] };
    case "failed": return { text: "INSTALLATION ECHOUEE", color: [220, 50, 50] };
    default: return { text: "—", color: [100, 100, 100] };
  }
};

export function generateInstallationReportPDF(data: InstallationReportData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "RAPPORT D'INSTALLATION", data.report_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone,
      address: data.service_address, city: data.service_city, province: data.service_province, postal: data.service_postal,
      account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'intervention: ${fmtDate(data.appointment_date)}`, 15, y);
    if (data.start_time && data.end_time) {
      doc.text(`Heures: ${data.start_time} - ${data.end_time}`, 110, y);
    }
    y += 10;

    // Outcome banner
    const out = outcomeLabel(data.outcome);
    doc.setFillColor(out.color[0], out.color[1], out.color[2]);
    doc.rect(15, y, 170, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(out.text, 105, y + 8, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 18;

    y = drawSectionTitle(doc, "Technicien", y);
    y = drawKeyValue(doc, "Nom", data.technician_name, y);
    if (data.technician_id) y = drawKeyValue(doc, "ID", data.technician_id, y);
    y += 4;

    y = drawSectionTitle(doc, "Service installe", y);
    y = drawBoxedText(doc, data.service_installed, y, { fillColor: GREY_BG });

    y = drawSectionTitle(doc, "Equipement installe", y);
    if (data.equipment_installed.length === 0) {
      y = drawBoxedText(doc, "Aucun equipement installe.", y);
    } else {
      const list = data.equipment_installed.map((e, i) =>
        `${i + 1}. ${e.description}${e.serial_number ? ` (S/N: ${e.serial_number})` : ""}`
      ).join("\n");
      y = drawBoxedText(doc, list, y);
    }

    if (data.notes) {
      y = drawSectionTitle(doc, "Notes du technicien", y);
      y = drawBoxedText(doc, data.notes, y);
    }

    if (data.client_signature_required) {
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Signature du client (acceptation de l'installation) :", 15, y);
      y += 6;
      doc.setDrawColor(150, 150, 150);
      doc.line(15, y + 8, 110, y + 8);
      doc.text("Date :", 120, y + 8);
      doc.line(135, y + 8, 185, y + 8);
    }

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Rapport_Installation_${data.report_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateInstallationReportPDF;
