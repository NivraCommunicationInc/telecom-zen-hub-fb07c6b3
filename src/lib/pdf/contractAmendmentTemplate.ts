/**
 * Contract Amendment — Avenant au contrat de service.
 */
import { jsPDF } from "jspdf";
import type { PDFGenerationResult } from "./types";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, fmtCAD, NAVY } from "./_baseTemplate";

export interface ContractAmendmentData {
  amendment_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  account_number: string;
  original_contract_number: string;
  original_contract_date: string;
  effective_date: string;
  changes: Array<{ field: string; old_value: string; new_value: string; }>;
  reason?: string;
  new_monthly_amount?: number;
  notes?: string;
}

export function generateContractAmendmentPDF(data: ContractAmendmentData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "AVENANT AU CONTRAT", data.amendment_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    doc.text(`Date d'effet: ${fmtDate(data.effective_date)}`, 110, y);
    y += 10;

    y = drawBoxedText(
      doc,
      `Le present avenant modifie le contrat de service No ${data.original_contract_number} signe le ${fmtDate(data.original_contract_date)}. Toutes les autres dispositions du contrat original demeurent en vigueur.`,
      y,
      { fillColor: [240, 248, 255], borderColor: NAVY, textColor: NAVY }
    );

    if (data.reason) {
      y = drawSectionTitle(doc, "Motif de la modification", y);
      y = drawBoxedText(doc, data.reason, y);
    }

    // Changes table
    y = drawSectionTitle(doc, "Modifications apportees", y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 170, 7, "F");
    doc.setTextColor(0, 0, 0);
    doc.text("Element", 17, y + 5);
    doc.text("Avant", 80, y + 5);
    doc.text("Apres", 135, y + 5);
    y += 8;

    doc.setFont("helvetica", "normal");
    for (const c of data.changes) {
      const fieldLines = doc.splitTextToSize(c.field, 60) as string[];
      const oldLines = doc.splitTextToSize(c.old_value, 50) as string[];
      const newLines = doc.splitTextToSize(c.new_value, 50) as string[];
      const maxLines = Math.max(fieldLines.length, oldLines.length, newLines.length);
      const h = Math.max(7, maxLines * 4.5 + 2);
      let dy = y + 4;
      for (const l of fieldLines) { doc.text(l, 17, dy); dy += 4.5; }
      dy = y + 4;
      doc.setTextColor(180, 50, 50);
      for (const l of oldLines) { doc.text(l, 80, dy); dy += 4.5; }
      dy = y + 4;
      doc.setTextColor(22, 163, 74);
      for (const l of newLines) { doc.text(l, 135, dy); dy += 4.5; }
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(230, 230, 230);
      doc.line(15, y + h, 185, y + h);
      y += h;
    }
    y += 6;

    if (data.new_monthly_amount !== undefined) {
      y = drawSectionTitle(doc, "Nouveau montant mensuel", y);
      y = drawKeyValue(doc, "A compter du", `${fmtDate(data.effective_date)} : ${fmtCAD(data.new_monthly_amount)}`, y);
      y += 4;
    }

    if (data.notes) y = drawBoxedText(doc, data.notes, y);

    // Signature
    y = Math.max(y, 240);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Signature du client :", 15, y);
    doc.setDrawColor(150, 150, 150);
    doc.line(60, y, 120, y);
    doc.text("Date :", 130, y);
    doc.line(145, y, 185, y);

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Avenant_Contrat_${data.amendment_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateContractAmendmentPDF;
