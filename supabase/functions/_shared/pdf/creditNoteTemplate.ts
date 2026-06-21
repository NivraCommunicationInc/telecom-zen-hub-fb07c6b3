/**
 * Credit Note (Note de crédit) — auto-document template (Deno/server-side).
 * Triggered when an admin adds a credit via account_adjustments.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeader, drawFooter, drawClientBlock,
  drawSectionTitle, drawBoxedText, drawKeyValue,
  fmtDate, fmtCAD, GREEN, GREY_BG,
} from "./_baseTemplate.ts";

export interface CreditNoteAutoData {
  credit_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
  description: string;
  amount: number;
  credit_type: string;
  months_total?: number;
  is_permanent?: boolean;
}

export function generateCreditNoteAutoPDF(data: CreditNoteAutoData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "NOTE DE CREDIT", data.credit_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name,
      email: data.client_email,
      phone: data.client_phone,
      address: data.client_address,
      city: data.client_city,
      province: data.client_province,
      postal: data.client_postal,
      account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission : ${fmtDate(data.issue_date)}`, 15, y);
    y += 10;

    y = drawBoxedText(
      doc,
      "Un credit a ete applique a votre compte. Ce montant sera deduit automatiquement de vos prochaines factures.",
      y,
      { fillColor: [240, 253, 244], borderColor: GREEN, textColor: [22, 101, 52] },
    );

    y = drawSectionTitle(doc, "Detail du credit", y);
    y = drawKeyValue(doc, "Description", data.description, y);
    y = drawKeyValue(doc, "Montant credite", fmtCAD(data.amount), y);

    const typeLabel =
      data.credit_type === "first_month_free" ? "Premier mois gratuit" :
      data.credit_type === "one_time"         ? "Credit unique" : "Credit mensuel";
    y = drawKeyValue(doc, "Type de credit", typeLabel, y);

    if (data.is_permanent) {
      y = drawKeyValue(doc, "Duree", "Credit permanent", y);
    } else if (data.months_total && data.months_total > 0) {
      y = drawKeyValue(doc, "Duree", `${data.months_total} mois`, y);
    }
    y += 4;

    y = drawBoxedText(
      doc,
      "Ce credit sera applique automatiquement lors de votre prochain cycle de facturation. Aucune action n'est requise de votre part. Pour toute question, contactez notre equipe de support a support@nivra-telecom.ca.",
      y,
      { fillColor: GREY_BG },
    );

    drawFooter(doc);
    return {
      success: true,
      blob: doc.output("blob"),
      filename: `Note_Credit_${data.credit_number}_Nivra.pdf`,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateCreditNoteAutoPDF;
