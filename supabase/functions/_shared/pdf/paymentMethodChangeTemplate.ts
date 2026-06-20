/**
 * Payment Method Change - Confirmation de changement de mode de paiement.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, NAVY, GREEN } from "./_baseTemplate.ts";

export interface PaymentMethodChangeData {
  notice_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  account_number: string;
  old_method: string;             // "Carte de credit ****1234"
  new_method: string;             // "PayPal - exemple@email.com"
  effective_date: string;
  autopay_enabled: boolean;
  next_billing_date?: string;
  notes?: string;
}

export function generatePaymentMethodChangePDF(data: PaymentMethodChangeData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "CHANGEMENT MODE DE PAIEMENT", data.notice_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date de modification: ${fmtDate(data.issue_date)}`, 15, y);
    doc.text(`Date d'effet: ${fmtDate(data.effective_date)}`, 110, y);
    y += 10;

    y = drawSectionTitle(doc, "Ancien mode de paiement", y);
    y = drawBoxedText(doc, data.old_method, y, { fillColor: [254, 242, 242], borderColor: [220, 80, 80] });

    y = drawSectionTitle(doc, "Nouveau mode de paiement", y);
    y = drawBoxedText(doc, data.new_method, y, { fillColor: [240, 253, 244], borderColor: GREEN });

    y = drawSectionTitle(doc, "Configuration", y);
    y = drawKeyValue(doc, "Paiement automatique", data.autopay_enabled ? "Active" : "Desactive", y);
    if (data.next_billing_date) y = drawKeyValue(doc, "Prochaine facturation", fmtDate(data.next_billing_date), y);
    y += 4;

    y = drawBoxedText(
      doc,
      "Si vous n'avez pas demande ce changement, contactez immediatement notre equipe par courriel a Support@nivra-telecom.ca.",
      y,
      { fillColor: [255, 251, 235], borderColor: [217, 119, 6] }
    );

    if (data.notes) y = drawBoxedText(doc, data.notes, y);

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Changement_Paiement_${data.notice_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generatePaymentMethodChangePDF;
