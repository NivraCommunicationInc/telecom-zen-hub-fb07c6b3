/**
 * Activation Confirmation - Corporate blue Lot1 layout.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawHeroBox, drawInfoBox, fmtDate, fmtCAD,
  GREEN, BLUE, BLUE_LIGHT,
} from "./_baseTemplate.ts";

export interface ActivationConfirmationData {
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
  service_type: "mobile" | "internet" | "tv" | "other";
  activation_date: string;
  phone_number?: string;
  sim_iccid?: string;
  internet_speed?: string;
  static_ip?: string;
  monthly_amount: number;
  first_billing_cycle?: string;
  notes?: string;
  technician_name?: string;
  order_number?: string;
}

export function generateActivationConfirmationPDF(data: ActivationConfirmationData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "Activation",
      subtitle: "Confirmation d'activation de service",
      docNumber: data.confirmation_number,
      docDate: fmtDate(data.issue_date),
    });

    const addr = [data.client_address, data.client_city, data.client_province].filter(Boolean).join(", ");
    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name || "--"],
      ["N° de compte", data.account_number || "--"],
      ["Adresse de service", addr || "--"],
      ["Technicien", data.technician_name || "--"],
      ["Date d'activation", fmtDate(data.activation_date)],
      ["Réf. commande", data.order_number || "--"],
    ]);

    y = drawHeroBox(doc, y, {
      label: "Service activé avec succès",
      value: "OPÉRATIONNEL",
      sublabel: "Tous les tests de connectivité ont réussi",
      bg: GREEN,
    });

    y = drawSectionTitle(doc, "Services activés", y);
    const rows: Array<Array<string>> = [
      [data.service_name || "Service principal", data.phone_number || data.sim_iccid || data.static_ip || "--", data.internet_speed || "--", "OK"],
    ];
    y = drawZebraTable(doc, y,
      ["Service", "Identifiant technique", "Vitesse/Détail", "Statut"],
      rows,
      [50, 55, 45, 30],
    );

    y = drawInfoBox(doc, y, {
      title: "Prochaine étape - Facturation",
      body: `Votre première facture mensuelle sera émise le ${data.first_billing_cycle || "cycle mensuel suivant"}. Facturation mensuelle: ${fmtCAD(data.monthly_amount)}. Consultez toutes vos factures sur nivra-telecom.ca/client/factures.`,
      bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
    });

    if (data.notes) {
      y = drawInfoBox(doc, y, { title: "Notes", body: data.notes });
    }

    drawFooterV2(doc, 1, 1);
    return { success: true, blob: doc.output("blob"), filename: `Activation_${(data.client_name || "").replace(/\s+/g,"-")}_${data.confirmation_number}.pdf` };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || "Erreur de génération" };
  }
}

export default generateActivationConfirmationPDF;
