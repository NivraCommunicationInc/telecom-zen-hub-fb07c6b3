/**
 * Delivery Slip - Corporate blue Lot1 layout.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawInfoBox, fmtDate,
  BLUE, BLUE_LIGHT, AMBER, AMBER_BG,
} from "./_baseTemplate.ts";

export interface DeliverySlipData {
  slip_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  delivery_address: string;
  delivery_city?: string;
  delivery_province?: string;
  delivery_postal?: string;
  order_number?: string;
  carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  items: Array<{ description: string; serial_number?: string; quantity: number; }>;
}

export function generateDeliverySlipPDF(data: DeliverySlipData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "Livraison",
      subtitle: "Bordereau de livraison équipement",
      docNumber: data.slip_number,
      docDate: fmtDate(data.issue_date),
    });

    const addr = [data.delivery_address, data.delivery_city, data.delivery_province, data.delivery_postal].filter(Boolean).join(", ");
    y = drawMetaGrid(doc, y, [
      ["Destinataire", data.client_name || "--"],
      ["N° de compte", data.account_number || "--"],
      ["Adresse de livraison", addr || "--"],
      ["Téléphone", data.client_phone || "--"],
      ["Transporteur", data.carrier || "Purolator"],
      ["N° de suivi", data.tracking_number || "--"],
    ]);

    y = drawSectionTitle(doc, "Contenu du colis", y);
    const rows = (data.items || []).map(it => [
      String(it.quantity ?? 1),
      it.description,
      it.serial_number || "-",
      "Neuf scellé",
    ]);
    y = drawZebraTable(doc, y,
      ["Qté", "Article", "N° de série", "État"],
      rows.length ? rows : [["1", "Colis Nivra Telecom", "-", "Neuf"]],
      [15, 90, 45, 30],
    );

    y = drawInfoBox(doc, y, {
      title: "Signature à la réception requise",
      body: `${data.carrier || "Le transporteur"} exigera votre signature à la livraison. En cas d'absence, un avis sera laissé et vous pourrez récupérer le colis au point relais indiqué. Merci de vérifier l'intégrité du colis avant signature.`,
      bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
    });

    y = drawInfoBox(doc, y, {
      title: "Retour en cas de résiliation",
      body: "En cas d'annulation, tout équipement loué doit être retourné dans les 15 jours suivant la fin du service. Une étiquette de retour prépayée vous sera envoyée sur demande à support@nivra-telecom.ca. Frais de non-retour applicables selon le contrat.",
      bg: AMBER_BG, border: AMBER, accent: AMBER,
    });

    drawFooterV2(doc, 1, 1);
    return { success: true, blob: doc.output("blob"), filename: `Bordereau_Livraison_${(data.client_name || "").replace(/\s+/g,"-")}_${data.slip_number}.pdf` };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || "Erreur de génération" };
  }
}

export default generateDeliverySlipPDF;
