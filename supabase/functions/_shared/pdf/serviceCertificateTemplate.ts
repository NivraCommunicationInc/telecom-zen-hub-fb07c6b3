/**
 * Service Certificate - Attestation de service actif (souvent demandée pour preuves d'adresse).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawKeyValue, drawBoxedText, fmtDate, fmtCAD, NAVY } from "./_baseTemplate.ts";

export interface ServiceCertificateData {
  certificate_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  service_address: string;
  service_city?: string;
  service_province?: string;
  service_postal?: string;
  service_name: string;
  activation_date: string;
  status: string;             // "Actif"
  monthly_amount: number;
  purpose?: string;           // optional reason ex: "Preuve d'adresse"
}

export function generateServiceCertificatePDF(data: ServiceCertificateData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "ATTESTATION DE SERVICE ACTIF", data.certificate_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone,
      address: data.service_address, city: data.service_city, province: data.service_province, postal: data.service_postal,
      account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    y += 10;

    // Statement
    y = drawBoxedText(
      doc,
      `Nivra Telecom (Nivra Communications Inc.) atteste par la presente que ${data.client_name} est actuellement client actif a l'adresse de service indiquee ci-dessus.`,
      y,
      { fillColor: [240, 248, 255], borderColor: NAVY, textColor: NAVY }
    );

    // Details
    y = drawSectionTitle(doc, "Details du service", y);
    y = drawKeyValue(doc, "Service", data.service_name, y);
    y = drawKeyValue(doc, "Statut", data.status, y);
    y = drawKeyValue(doc, "Date d'activation", fmtDate(data.activation_date), y);
    y = drawKeyValue(doc, "Numero de compte", data.account_number, y);
    y = drawKeyValue(doc, "Frais mensuels", fmtCAD(data.monthly_amount), y);
    if (data.purpose) y = drawKeyValue(doc, "Objet de l'attestation", data.purpose, y);
    y += 6;

    // Signature placeholder
    y = drawSectionTitle(doc, "Authentification", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Document genere electroniquement et certifie conforme.", 15, y); y += 5;
    doc.text("Service a la clientele - Nivra Telecom", 15, y); y += 5;
    doc.text(`Reference: ${data.certificate_number}`, 15, y);

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Attestation_Service_${data.certificate_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateServiceCertificatePDF;
