/**
 * Cancellation Confirmation - v2 layout (accent GREEN).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawHeroBox, drawInfoBox, drawZebraTable,
  fmtDate, fmtCAD, GREEN, GREEN_LIGHT, AMBER, AMBER_BG, BLUE, BLUE_LIGHT,
} from "./_baseTemplate.ts";

export interface CancellationConfirmationData {
  confirmation_number: string;
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
  cancellation_date: string;
  effective_date: string;
  reason?: string;
  final_balance: number;
  equipment_to_return?: string[];
  refund_pending?: number;
  notes?: string;
}

export function generateCancellationConfirmationPDF(data: CancellationConfirmationData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "CONFIRMATION D'ANNULATION",
      subtitle: "Résiliation enregistrée - service à échéance",
      docNumber: data.confirmation_number,
      docDate: fmtDate(data.issue_date),
      accent: GREEN,
    });

    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name],
      ["N° de compte", data.account_number],
      ["Service annulé", data.service_name],
      ["Date de la demande", fmtDate(data.cancellation_date)],
      ["Date d'effet", fmtDate(data.effective_date)],
      ["Courriel", data.client_email || "--"],
    ]);

    if (data.final_balance > 0) {
      y = drawHeroBox(doc, y, {
        label: "Solde final à régler",
        value: fmtCAD(data.final_balance),
        sublabel: "Dernier montant dû avant la fermeture du dossier",
        bg: AMBER,
      });
    } else if (data.final_balance < 0) {
      y = drawHeroBox(doc, y, {
        label: "Crédit en votre faveur",
        value: fmtCAD(Math.abs(data.final_balance)),
        sublabel: "Sera remboursé selon les modalités indiquées ci-dessous",
        bg: GREEN,
      });
    } else {
      y = drawHeroBox(doc, y, {
        label: "Solde final",
        value: "0,00 $",
        sublabel: "Aucun montant dû - dossier réglé",
        bg: GREEN,
      });
    }

    y = drawInfoBox(doc, y, {
      title: "Résiliation confirmée",
      body: `Nous confirmons l'annulation de votre service ${data.service_name}. Le service prendra fin à la date d'effet ci-dessus. Aucune facturation supplémentaire ne sera émise après cette date.`,
      bg: GREEN_LIGHT, border: GREEN, accent: GREEN,
    });

    if (data.reason) {
      y = drawSectionTitle(doc, "Motif de l'annulation", y, GREEN);
      y = drawInfoBox(doc, y, {
        title: "Raison indiquée",
        body: data.reason,
        bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
      });
    }

    if (data.refund_pending && data.refund_pending > 0) {
      y = drawSectionTitle(doc, "Remboursement à venir", y, GREEN);
      y = drawInfoBox(doc, y, {
        title: `Montant à rembourser : ${fmtCAD(data.refund_pending)}`,
        body: "Le remboursement sera émis via Interac ou sur votre mode de paiement enregistré dans un délai de 5 à 10 jours ouvrables. Un reçu final vous sera envoyé par courriel.",
        bg: GREEN_LIGHT, border: GREEN, accent: GREEN,
      });
    }

    if (data.equipment_to_return && data.equipment_to_return.length > 0) {
      y = drawSectionTitle(doc, "Équipement à retourner", y, AMBER);
      const rows = data.equipment_to_return.map((e, i) => [String(i + 1), e]);
      y = drawZebraTable(doc, y, ["#", "Équipement"], rows, [15, 165], AMBER);
      y = drawInfoBox(doc, y, {
        title: "Délai de retour",
        body: "Un document séparé « Instructions de retour » vous sera transmis avec l'adresse et la procédure à suivre. Tout équipement non retourné pourra être facturé.",
        bg: AMBER_BG, border: AMBER, accent: AMBER,
      });
    }

    if (data.notes) {
      y = drawSectionTitle(doc, "Notes", y, GREEN);
      y = drawInfoBox(doc, y, {
        title: "Renseignements complémentaires",
        body: data.notes,
        bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
      });
    }

    drawFooterV2(doc);
    return { success: true, blob: doc.output("blob"), filename: `Confirmation_Annulation_${data.confirmation_number}_Nivra.pdf` };
  } catch (e: any) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateCancellationConfirmationPDF;
