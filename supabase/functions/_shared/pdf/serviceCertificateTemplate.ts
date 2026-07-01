/**
 * Service Certificate - Corporate blue Lot1 layout with official stamp.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, wrapText, fmtDate, fmtCAD,
  NAVY, BLUE, MUTED,
} from "./_baseTemplate.ts";

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
  status: string;
  monthly_amount: number;
  purpose?: string;
}

export function generateServiceCertificatePDF(data: ServiceCertificateData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    let y = drawHeaderV2(doc, {
      title: "Certificat",
      subtitle: "Attestation de service actif",
      docNumber: data.certificate_number,
      docDate: fmtDate(data.issue_date),
    });

    const addr = [data.service_address, data.service_city, data.service_province, data.service_postal].filter(Boolean).join(", ");
    y = drawMetaGrid(doc, y, [
      ["Émis à", data.client_name || "--"],
      ["N° de compte", data.account_number || "--"],
      ["Adresse du service", addr || "--"],
      ["Date d'émission", fmtDate(data.issue_date)],
    ]);

    y = drawSectionTitle(doc, "Attestation", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const txt = `Nivra Communications Inc., fournisseur de services de télécommunications enregistré au Québec, atteste par la présente que ${data.client_name} détient un compte client actif (N° ${data.account_number}) et bénéficie des services listés ci-dessous à l'adresse indiquée.\n\nCette attestation est délivrée à la demande du client aux fins qu'il jugera utiles${data.purpose ? ` (${data.purpose})` : " (location, hypothèque, permis de travail, aide sociale, etc.)"}.`;
    const lines = wrapText(doc, txt, 180);
    for (const l of lines) { doc.text(l, 15, y); y += 4.5; }
    y += 3;

    y = drawSectionTitle(doc, "Services actifs à ce jour", y);
    y = drawZebraTable(doc, y,
      ["Service", "Actif depuis", "Statut", "Facturation mensuelle"],
      [[data.service_name, fmtDate(data.activation_date), data.status || "Actif", fmtCAD(data.monthly_amount)]],
      [65, 40, 30, 45],
    );

    // Stamp (right) + signature (left)
    y += 10;
    const stampX = pw - 30;
    doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setLineWidth(0.6);
    doc.circle(stampX, y + 12, 15, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text("NIVRA", stampX, y + 8, { align: "center" });
    doc.setFontSize(6.5);
    doc.text("TELECOM INC.", stampX, y + 11, { align: "center" });
    doc.text("OFFICIEL", stampX, y + 15, { align: "center" });
    doc.text(String(new Date().getFullYear()), stampX, y + 18, { align: "center" });

    doc.setFont("helvetica", "italic");
    doc.setFontSize(15);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("Nivra Telecom", 15, y + 10);
    doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.line(15, y + 14, 15 + 70, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Signature autorisée - Service à la clientèle", 15, y + 18);
    doc.text(`Émis le ${fmtDate(data.issue_date)}`, 15, y + 22);

    drawFooterV2(doc, 1, 1);
    return { success: true, blob: doc.output("blob"), filename: `Certificat_${(data.client_name || "").replace(/\s+/g,"-")}_${data.certificate_number}.pdf` };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || "Erreur de génération" };
  }
}

export default generateServiceCertificatePDF;
