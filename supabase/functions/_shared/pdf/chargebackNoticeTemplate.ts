/**
 * Chargeback Notice - v2 layout (accent RED).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawHeroBox, drawInfoBox, drawZebraTable,
  fmtDate, fmtCAD, RED, RED_LIGHT, AMBER, AMBER_BG,
} from "./_baseTemplate.ts";

export interface ChargebackNoticeData {
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
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number;
  chargeback_amount: number;
  chargeback_date: string;
  bank_reference?: string;
  reason_code?: string;
  reactivation_fee: number;
  total_due: number;
  response_deadline: string;
}

export function generateChargebackNoticePDF(data: ChargebackNoticeData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "AVIS DE RÉTROFACTURATION",
      subtitle: "Paiement contesté par l'institution financière",
      docNumber: data.notice_number,
      docDate: fmtDate(data.issue_date),
      accent: RED,
    });

    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name],
      ["N° de compte", data.account_number],
      ["Facture liée", data.invoice_number],
      ["Date de la facture", fmtDate(data.invoice_date)],
      ["Date du chargeback", fmtDate(data.chargeback_date)],
      ["Échéance de réponse", fmtDate(data.response_deadline)],
    ]);

    y = drawHeroBox(doc, y, {
      label: "Total dû immédiatement",
      value: fmtCAD(data.total_due),
      sublabel: `À régulariser avant le ${fmtDate(data.response_deadline)} - compte suspendu`,
      bg: RED,
    });

    y = drawSectionTitle(doc, "Paiement contesté", y, RED);
    const rows: Array<Array<string>> = [
      ["Montant initial de la facture", "", fmtCAD(data.invoice_amount)],
      ["Montant rétrofacturé", "", fmtCAD(data.chargeback_amount)],
      ["Frais de réactivation", "", fmtCAD(data.reactivation_fee)],
    ];
    if (data.bank_reference) rows.splice(2, 0, ["Référence bancaire", data.bank_reference, ""]);
    if (data.reason_code) rows.splice(3, 0, ["Code de motif", data.reason_code, ""]);
    y = drawZebraTable(doc, y, ["Élément", "Référence", "Montant"], rows, [80, 55, 45], RED);

    y = drawSectionTitle(doc, "Action requise", y, RED);
    y = drawInfoBox(doc, y, {
      title: "Contester ou régulariser",
      body:
        `Si cette rétrofacturation est une erreur, transmettez immédiatement une preuve de paiement (relevé bancaire ou courriel de confirmation) à Support@nivra-telecom.ca avant le ${fmtDate(data.response_deadline)}. ` +
        "Sans réponse ni règlement dans le délai, le dossier sera transféré à une agence de recouvrement externe et pourra être signalé aux bureaux de crédit.",
      bg: AMBER_BG, border: AMBER, accent: AMBER,
    });

    y = drawInfoBox(doc, y, {
      title: "Suspension immédiate",
      body: "Votre compte est suspendu depuis la réception de l'avis bancaire. Aucune nouvelle utilisation du service n'est possible jusqu'au règlement complet.",
      bg: RED_LIGHT, border: RED, accent: RED,
    });

    drawFooterV2(doc);
    return { success: true, blob: doc.output("blob"), filename: `Avis_Chargeback_${data.notice_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateChargebackNoticePDF;
