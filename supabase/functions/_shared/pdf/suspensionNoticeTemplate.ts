/**
 * Suspension Notice - v2 layout (accent RED).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawHeroBox, drawInfoBox, drawZebraTable,
  fmtDate, fmtCAD, RED, RED_LIGHT, AMBER, AMBER_BG,
} from "./_baseTemplate.ts";

export interface SuspensionNoticeData {
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
  reason: string;
  suspension_date: string;
  amount_due?: number;
  invoice_numbers?: string[];
  reactivation_fee?: number;
  reactivation_instructions?: string;
}

export function generateSuspensionNoticePDF(data: SuspensionNoticeData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "AVIS DE SUSPENSION",
      subtitle: "Interruption du service - action requise",
      docNumber: data.notice_number,
      docDate: fmtDate(data.issue_date),
      accent: RED,
    });

    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name],
      ["N° de compte", data.account_number],
      ["Courriel", data.client_email || "--"],
      ["Téléphone", data.client_phone || "--"],
      ["Service suspendu", data.service_name],
      ["Date de suspension", fmtDate(data.suspension_date)],
    ]);

    if (typeof data.amount_due === "number" && data.amount_due > 0) {
      y = drawHeroBox(doc, y, {
        label: "Solde à régulariser",
        value: fmtCAD(data.amount_due),
        sublabel: "Aucune utilisation possible jusqu'au paiement complet",
        bg: RED,
      });
    }

    y = drawSectionTitle(doc, "Motif de la suspension", y, RED);
    y = drawInfoBox(doc, y, {
      title: "Raison invoquée",
      body: data.reason,
      bg: RED_LIGHT, border: RED, accent: RED,
    });

    if (data.invoice_numbers?.length || (data.reactivation_fee ?? 0) > 0) {
      y = drawSectionTitle(doc, "Détail des montants", y, RED);
      const rows: Array<Array<string>> = [];
      if (data.invoice_numbers?.length) {
        rows.push(["Factures concernées", data.invoice_numbers.join(", "), ""]);
      }
      if (typeof data.amount_due === "number" && data.amount_due > 0) {
        rows.push(["Solde dû", "", fmtCAD(data.amount_due)]);
      }
      if ((data.reactivation_fee ?? 0) > 0) {
        rows.push(["Frais de réactivation", "", fmtCAD(data.reactivation_fee!)]);
      }
      y = drawZebraTable(doc, y, ["Élément", "Référence", "Montant"], rows, [70, 60, 50], RED);
    }

    y = drawSectionTitle(doc, "Réactivation du service", y, RED);
    y = drawInfoBox(doc, y, {
      title: "Comment rétablir le service",
      body: data.reactivation_instructions ||
        "1. Réglez le solde total via votre portail client (paiement Interac ou carte de crédit).\n2. Contactez notre équipe par courriel à Support@nivra-telecom.ca pour confirmer la réactivation.\n3. Le service est rétabli sous 1 à 2 jours ouvrables après confirmation du paiement.",
      bg: AMBER_BG, border: AMBER, accent: AMBER,
    });

    drawFooterV2(doc);
    return { success: true, blob: doc.output("blob"), filename: `Avis_Suspension_${data.notice_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateSuspensionNoticePDF;
