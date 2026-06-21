/**
 * Reactivation Notice (Lettre de réactivation) — auto-document template (Deno/server-side).
 * Triggered when a suspended subscription is reactivated.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeader, drawFooter, drawClientBlock,
  drawSectionTitle, drawBoxedText, drawKeyValue,
  fmtDate, fmtCAD, GREEN,
} from "./_baseTemplate.ts";

export interface ReactivationNoticeData {
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
  service_name: string;
  reactivation_date: string;
  monthly_amount?: number;
  next_billing_date?: string;
}

export function generateReactivationNoticePDF(data: ReactivationNoticeData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "AVIS DE REACTIVATION", data.notice_number);

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
    doc.text(`Date de reactivation : ${fmtDate(data.reactivation_date)}`, 110, y);
    y += 10;

    y = drawBoxedText(
      doc,
      `Votre service ${data.service_name} a ete reactive avec succes. Vous pouvez maintenant utiliser votre service normalement.`,
      y,
      { fillColor: [240, 253, 244], borderColor: GREEN, textColor: [22, 101, 52] },
    );

    y = drawSectionTitle(doc, "Detail du service", y);
    y = drawKeyValue(doc, "Service", data.service_name, y);
    y = drawKeyValue(doc, "Date de reactivation", fmtDate(data.reactivation_date), y);
    if (data.monthly_amount && data.monthly_amount > 0) {
      y = drawKeyValue(doc, "Tarif mensuel", fmtCAD(data.monthly_amount), y);
    }
    if (data.next_billing_date) {
      y = drawKeyValue(doc, "Prochain renouvellement", fmtDate(data.next_billing_date), y);
    }
    y += 4;

    y = drawBoxedText(
      doc,
      "Merci de votre confiance. Pour eviter toute interruption de service future, nous vous recommandons d'activer le paiement automatique depuis votre portail client. Notre equipe reste disponible pour toute question a support@nivra-telecom.ca.",
      y,
      { fillColor: [239, 246, 255], borderColor: [147, 197, 253] },
    );

    drawFooter(doc);
    return {
      success: true,
      blob: doc.output("blob"),
      filename: `Avis_Reactivation_${data.notice_number}_Nivra.pdf`,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateReactivationNoticePDF;
