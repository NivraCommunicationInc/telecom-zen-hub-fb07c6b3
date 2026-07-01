/**
 * Address Change Notice - Corporate blue Lot1 layout.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawInfoBox, fmtDate,
  BLUE, BLUE_LIGHT,
} from "./_baseTemplate.ts";

export interface AddressChangeData {
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
  old_address: string;
  old_city?: string;
  old_province?: string;
  old_postal?: string;
  new_address: string;
  new_city?: string;
  new_province?: string;
  new_postal?: string;
  effective_date: string;
  service_continuity: "no_interruption" | "scheduled_interruption" | "reinstall_required";
  notes?: string;
  request_date?: string;
  appointment_window?: string;
}

const continuityText = (t: string): string => {
  switch (t) {
    case "no_interruption": return "Aucune interruption prévue pendant le transfert.";
    case "scheduled_interruption": return "Interruption planifiée pendant le transfert - voir notes.";
    case "reinstall_required": return "Réinstallation par technicien requise à la nouvelle adresse.";
    default: return "-";
  }
};

export function generateAddressChangePDF(data: AddressChangeData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "Changement",
      subtitle: "Confirmation de changement d'adresse",
      docNumber: data.notice_number,
      docDate: fmtDate(data.issue_date),
    });

    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name || "--"],
      ["N° de compte", data.account_number || "--"],
      ["Date de la demande", fmtDate(data.request_date || data.issue_date)],
      ["Date effective", fmtDate(data.effective_date)],
    ]);

    y = drawSectionTitle(doc, "Détails du transfert", y);
    y = drawZebraTable(doc, y,
      ["", "Ancienne adresse", "Nouvelle adresse"],
      [
        ["Rue", data.old_address || "--", data.new_address || "--"],
        ["Ville", `${data.old_city || ""} ${data.old_province || ""}`.trim() || "--", `${data.new_city || ""} ${data.new_province || ""}`.trim() || "--"],
        ["Code postal", data.old_postal || "--", data.new_postal || "--"],
      ],
      [35, 72, 73],
    );

    y = drawSectionTitle(doc, "Impact sur vos services", y);
    y = drawZebraTable(doc, y,
      ["Élément", "Détail", "Statut"],
      [
        ["Continuité de service", continuityText(data.service_continuity), "Planifié"],
        ["Rendez-vous technicien", data.appointment_window || "À planifier", "Confirmé"],
        ["Frais de transfert", "0.00 $ (offert)", "OK"],
      ],
      [55, 80, 45],
    );

    y = drawInfoBox(doc, y, {
      title: "À faire avant le déménagement",
      body: "1. Débranchez et laissez tout équipement propriété Nivra en place. 2. Emportez uniquement les équipements que vous avez achetés. 3. Soyez présent(e) à la fenêtre de rendez-vous. 4. Aucune interruption facturée n'est appliquée durant le transfert." + (data.notes ? "\n\nNotes: " + data.notes : ""),
      bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
    });

    drawFooterV2(doc, 1, 1);
    return { success: true, blob: doc.output("blob"), filename: `Changement_Adresse_${(data.client_name || "").replace(/\s+/g,"-")}_${data.notice_number}.pdf` };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || "Erreur de génération" };
  }
}

export default generateAddressChangePDF;
