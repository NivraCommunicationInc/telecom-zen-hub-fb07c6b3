/**
 * Activation Confirmation - Confirmation d'activation de service (mobile/internet/tv).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawKeyValue, drawBoxedText, fmtDate, fmtCAD, GREEN, NAVY } from "./_baseTemplate.ts";

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
  // Optional - depends on type
  phone_number?: string;
  sim_iccid?: string;
  internet_speed?: string;
  static_ip?: string;
  monthly_amount: number;
  first_billing_cycle?: string;   // ex: "21 nov 2026 - 20 dec 2026"
  notes?: string;
}

export function generateActivationConfirmationPDF(data: ActivationConfirmationData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "CONFIRMATION D'ACTIVATION", data.confirmation_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone,
      address: data.client_address, city: data.client_city, province: data.client_province, postal: data.client_postal,
      account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'activation: ${fmtDate(data.activation_date)}`, 15, y);
    y += 10;

    y = drawBoxedText(
      doc,
      `Votre service ${data.service_name} est actif depuis le ${fmtDate(data.activation_date)}. Vous pouvez maintenant l'utiliser sans restriction.`,
      y,
      { fillColor: [240, 253, 244], borderColor: GREEN, textColor: GREEN }
    );

    y = drawSectionTitle(doc, "Details du service", y);
    y = drawKeyValue(doc, "Service", data.service_name, y);
    if (data.phone_number) y = drawKeyValue(doc, "Numero de telephone", data.phone_number, y);
    if (data.sim_iccid) y = drawKeyValue(doc, "ICCID SIM", data.sim_iccid, y);
    if (data.internet_speed) y = drawKeyValue(doc, "Vitesse Internet", data.internet_speed, y);
    if (data.static_ip) y = drawKeyValue(doc, "IP statique", data.static_ip, y);
    y = drawKeyValue(doc, "Frais mensuels", fmtCAD(data.monthly_amount), y);
    if (data.first_billing_cycle) y = drawKeyValue(doc, "Premier cycle de facturation", data.first_billing_cycle, y);
    y += 4;

    if (data.notes) {
      y = drawSectionTitle(doc, "Notes", y);
      y = drawBoxedText(doc, data.notes, y);
    }

    y = drawBoxedText(
      doc,
      "Pour toute question concernant votre service, contactez notre equipe par courriel a Support@nivra-telecom.ca.",
      y,
      { fillColor: [240, 248, 255], borderColor: NAVY, textColor: NAVY }
    );

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Confirmation_Activation_${data.confirmation_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateActivationConfirmationPDF;
