/**
 * Formal Demand (Mise en demeure) — Document juridique formel avant transfert au recouvrement.
 */
import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, fmtCAD, RED } from "./_baseTemplate";

export interface FormalDemandData {
  demand_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
  total_due: number;
  invoices: Array<{ invoice_number: string; invoice_date: string; amount: number; days_overdue: number; }>;
  response_deadline: string;       // typically 10 days
  legal_basis?: string;            // ex: "C.c.Q. art. 1594"
}

export function generateFormalDemandPDF(data: FormalDemandData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "MISE EN DEMEURE", data.demand_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone,
      address: data.client_address, city: data.client_city, province: data.client_province, postal: data.client_postal,
      account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date: ${fmtDate(data.issue_date)}`, 15, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("OBJET : Mise en demeure de payer", 15, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const intro = `Madame, Monsieur,\n\nMalgre nos rappels precedents, votre compte presente actuellement un solde impaye de ${fmtCAD(data.total_due)}. Par la presente, nous vous mettons formellement en demeure de regulariser ce solde dans un delai de DIX (10) JOURS a compter de la reception de la presente, soit au plus tard le ${fmtDate(data.response_deadline)}.`;
    const introLines = doc.splitTextToSize(intro, 170) as string[];
    for (const l of introLines) { doc.text(l, 15, y); y += 5; }
    y += 4;

    // Invoices table
    y = drawSectionTitle(doc, "Detail des factures impayees", y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 170, 7, "F");
    doc.setTextColor(0, 0, 0);
    doc.text("Facture", 17, y + 5);
    doc.text("Date", 70, y + 5);
    doc.text("Jours retard", 120, y + 5);
    doc.text("Montant", 180, y + 5, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "normal");
    for (const inv of data.invoices) {
      doc.text(inv.invoice_number, 17, y + 4);
      doc.text(fmtDate(inv.invoice_date), 70, y + 4);
      doc.setTextColor(RED[0], RED[1], RED[2]);
      doc.text(String(inv.days_overdue), 120, y + 4);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtCAD(inv.amount), 180, y + 4, { align: "right" });
      doc.setDrawColor(230, 230, 230);
      doc.line(15, y + 7, 185, y + 7);
      y += 7;
    }
    y += 4;

    // Total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text("TOTAL DU", 120, y);
    doc.text(fmtCAD(data.total_due), 180, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Consequences
    y = drawSectionTitle(doc, "Consequences en cas de non-paiement", y);
    y = drawBoxedText(
      doc,
      `Sans paiement integral dans le delai imparti, nous procederons sans autre avis : (1) au transfert de votre dossier a une agence de recouvrement, (2) au signalement aux bureaux de credit (Equifax, TransUnion), (3) a l'introduction d'une action en justice avec interets et frais. ${data.legal_basis ? `Reference legale : ${data.legal_basis}.` : ""}`,
      y,
      { fillColor: [254, 242, 242], borderColor: RED, textColor: RED }
    );

    y = drawBoxedText(
      doc,
      "Pour eviter ces consequences, regulariser votre compte immediatement via votre portail client ou contactez notre equipe par courriel pour discuter d'une entente.",
      y,
      { fillColor: [255, 251, 235], borderColor: [217, 119, 6] }
    );

    // Closing
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nivra Communications Inc.", 15, y); y += 5;
    doc.text("Service du recouvrement", 15, y);

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Mise_En_Demeure_${data.demand_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateFormalDemandPDF;
