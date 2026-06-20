/**
 * Delivery Slip - Bon de livraison d'equipement.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawKeyValue, drawBoxedText, fmtDate, NAVY, GREY_BG, GREY_BORDER } from "./_baseTemplate.ts";

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
  items: Array<{
    description: string;
    serial_number?: string;
    quantity: number;
  }>;
}

export function generateDeliverySlipPDF(data: DeliverySlipData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawHeader(doc, "BON DE LIVRAISON", data.slip_number);

    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone,
      address: data.delivery_address, city: data.delivery_city, province: data.delivery_province, postal: data.delivery_postal,
      account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'expedition: ${fmtDate(data.issue_date)}`, 15, y);
    if (data.estimated_delivery) doc.text(`Livraison estimee: ${fmtDate(data.estimated_delivery)}`, 110, y);
    y += 10;

    if (data.order_number || data.carrier || data.tracking_number) {
      y = drawSectionTitle(doc, "Informations de livraison", y);
      if (data.order_number) y = drawKeyValue(doc, "Commande liee", data.order_number, y);
      if (data.carrier) y = drawKeyValue(doc, "Transporteur", data.carrier, y);
      if (data.tracking_number) y = drawKeyValue(doc, "Numero de suivi", data.tracking_number, y);
      y += 2;
    }

    // Items table
    y = drawSectionTitle(doc, "Equipement expedie", y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 170, 7, "F");
    doc.setTextColor(0, 0, 0);
    doc.text("Description", 17, y + 5);
    doc.text("No de serie", 110, y + 5);
    doc.text("Qte", 180, y + 5, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "normal");
    for (const it of data.items) {
      const lines = doc.splitTextToSize(it.description, 90) as string[];
      let dy = y + 4;
      for (const l of lines) { doc.text(l, 17, dy); dy += 4.5; }
      doc.text(it.serial_number || "-", 110, y + 4);
      doc.text(String(it.quantity), 180, y + 4, { align: "right" });
      const h = Math.max(7, lines.length * 4.5 + 2);
      doc.setDrawColor(230, 230, 230);
      doc.line(15, y + h, 185, y + h);
      y += h;
    }
    y += 6;

    // Reception
    y = drawSectionTitle(doc, "Reception du colis", y);
    y = drawBoxedText(
      doc,
      "Verifiez l'etat de l'emballage a la reception. En cas de dommage visible, refusez le colis ou notez-le sur le bordereau du transporteur. Conservez ce document : il vous sera demande pour toute reclamation ou retour eventuel.",
      y,
      { fillColor: GREY_BG, borderColor: GREY_BORDER }
    );

    // Signature block
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Signature du destinataire :", 15, y);
    doc.setDrawColor(150, 150, 150);
    doc.line(70, y, 185, y);
    y += 8;
    doc.text("Date :", 15, y);
    doc.line(70, y, 185, y);

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Bon_Livraison_${data.slip_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateDeliverySlipPDF;
