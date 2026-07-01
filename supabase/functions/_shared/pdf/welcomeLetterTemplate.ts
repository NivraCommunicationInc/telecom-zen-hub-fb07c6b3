/**
 * Welcome Letter - Corporate blue Lot1 layout.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawInfoBox, wrapText, fmtDate, fmtCAD,
  NAVY, BLUE_LIGHT, BLUE, AMBER_BG, AMBER,
} from "./_baseTemplate.ts";

export interface WelcomeLetterData {
  letter_number: string;
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
  activation_date: string;
  monthly_amount: number;
  next_billing_date?: string;
  portal_url?: string;
}

export function generateWelcomeLetterPDF(data: WelcomeLetterData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "Bienvenue",
      subtitle: "Lettre de bienvenue - Activation confirmée",
      docNumber: data.letter_number,
      docDate: fmtDate(data.issue_date),
    });

    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name || "--"],
      ["N° de compte", data.account_number || "--"],
      ["Date d'activation", fmtDate(data.activation_date)],
      ["Forfait principal", data.service_name || "--"],
    ]);

    y = drawSectionTitle(doc, "Message de bienvenue", y);
    const first = (data.client_name || "").split(" ")[0] || "client";
    const msg = [
      `Cher ${first},`,
      "",
      "Toute l'équipe de Nivra Telecom vous souhaite la bienvenue. Vos services sont maintenant activés et prêts à être utilisés. Votre compte client est accessible en tout temps sur nivra-telecom.ca/client - vous y trouverez vos factures, votre méthode de paiement, l'état de vos services et notre centre d'aide.",
      "",
      "Notre équipe support est disponible par courriel à support@nivra-telecom.ca. Nous répondons sous 24 heures ouvrables.",
    ].join("\n");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const lines = wrapText(doc, msg, 180);
    for (const line of lines) { doc.text(line, 15, y); y += 4.5; }
    y += 4;

    y = drawSectionTitle(doc, "Vos services actifs", y);
    y = drawZebraTable(doc, y,
      ["Service", "Détails", "Statut", "Mensuel"],
      [[data.service_name, "Voir contrat", "Actif", fmtCAD(data.monthly_amount)]],
      [70, 60, 25, 25],
    );

    if (data.next_billing_date) {
      y = drawInfoBox(doc, y, {
        title: "Prochaine facturation",
        body: `Votre prochaine facture mensuelle sera émise le ${fmtDate(data.next_billing_date)}. Activez l'autopay depuis votre portail client pour ne jamais manquer un paiement.`,
        bg: AMBER_BG, border: AMBER, accent: AMBER,
      });
    }

    drawFooterV2(doc, 1, 1);
    return { success: true, blob: doc.output("blob"), filename: `Bienvenue_${(data.client_name || "").replace(/\s+/g,"-")}_${data.letter_number}.pdf` };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || "Erreur de génération" };
  }
}

export default generateWelcomeLetterPDF;
