/**
 * Nivra Order Summary Template - PRODUCTION STANDARD
 * Matches the approved server-side pdfGenerator.ts style exactly.
 * 
 * 1-page clean layout with:
 * - Navy header bar + "SOMMAIRE DE COMMANDE"
 * - Blue accent order info banner
 * - Client info block
 * - Services table (SERVICE | TYPE | PRIX)
 * - Totals with taxes
 * - Navy footer with legal info
 */

import jsPDF from "jspdf";
import type { OrderSummaryData, PDFGenerationResult } from "./types";

// ============================================================================
// COMPANY & COLORS (matching pdfGenerator.ts exactly)
// ============================================================================

const COMPANY = {
  name: "Nivra Telecom",
  legalName: "9477-4922 Québec inc. (Nivra Telecom)",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  email: "Support@nivra-telecom.ca",
  gstNumber: "713971764RT0001",
  qstNumber: "1232379195TQ0001",
};

const COLORS = {
  primary: [15, 23, 42] as [number, number, number],
  accent: [0, 102, 204] as [number, number, number],
  text: [51, 65, 85] as [number, number, number],
  textLight: [100, 116, 139] as [number, number, number],
  lightGray: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
};

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrencyCAD = (amount: number): string => {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);
};

const formatDateFR = (dateStr: string | undefined | null): string => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const drawHeader = (doc: jsPDF, title: string) => {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pw, 22, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("NIVRA TELECOM", 15, 11);
  doc.setFontSize(12);
  doc.text(title, pw - 15, 11, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(COMPANY.email, 15, 18);
};

const drawFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, ph - 18, pw, 18, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(7);
  doc.text(COMPANY.legalName, pw / 2, ph - 12, { align: "center" });
  doc.text(`${COMPANY.address} | TPS: ${COMPANY.gstNumber} | TVQ: ${COMPANY.qstNumber}`, pw / 2, ph - 7, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} / ${totalPages}`, pw - 15, ph - 9, { align: "right" });
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateOrderSummaryPDF(data: OrderSummaryData): PDFGenerationResult {
  try {
    if (!data.order_number) {
      return { success: false, error: "Numéro de commande manquant" };
    }
    if (!data.client_name || !data.client_email) {
      return { success: false, error: "Informations client incomplètes" };
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // Force white background
    doc.setFillColor(...COLORS.white);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    drawHeader(doc, "SOMMAIRE DE COMMANDE");

    let y = 32;

    // Order info banner
    doc.setFillColor(...COLORS.accent);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 3, 3, "F");
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Commande #${data.order_number}`, margin + 5, y + 9);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${formatDateFR(data.order_date)}`, margin + 5, y + 16);
    doc.text(`Statut: ${data.payment_status === "paid" ? "Commande confirmée" : "En attente"}`, pageWidth / 2, y + 16);
    y += 32;

    // Client section
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Informations client", margin, y);
    y += 8;

    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, "F");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.text(`Nom: ${data.client_name}`, margin + 5, y + 8);
    doc.text(`Courriel: ${data.client_email}`, margin + 5, y + 15);
    doc.text(`Téléphone: ${data.client_phone || "N/A"}`, margin + 5, y + 22);
    doc.text(`Adresse: ${data.service_address || "N/A"}`, pageWidth / 2, y + 8);

    if (data.estimated_activation) {
      doc.setFont("helvetica", "bold");
      doc.text(`Installation: ${formatDateFR(data.estimated_activation)}`, pageWidth / 2, y + 22);
    }
    y += 38;

    // Services table
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Services commandés", margin, y);
    y += 8;

    // Table header
    doc.setFillColor(...COLORS.primary);
    doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("SERVICE", margin + 5, y + 5.5);
    doc.text("TYPE", pageWidth / 2, y + 5.5);
    doc.text("PRIX", pageWidth - margin - 5, y + 5.5, { align: "right" });
    y += 10;

    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "normal");

    // Recurring services
    const services = data.services || [];
    services.forEach((svc, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(...COLORS.lightGray);
        doc.rect(margin, y - 2, pageWidth - margin * 2, 8, "F");
      }
      doc.text(svc.service_type || svc.service_description || "", margin + 5, y + 4);
      doc.text("Mensuel", pageWidth / 2, y + 4);
      doc.text(formatCurrencyCAD(svc.service_total || svc.service_price), pageWidth - margin - 5, y + 4, { align: "right" });
      y += 8;
    });

    // One-time items (equipment)
    const items = data.items || [];
    items.forEach((item, i) => {
      const rowIndex = services.length + i;
      if (rowIndex % 2 === 0) {
        doc.setFillColor(...COLORS.lightGray);
        doc.rect(margin, y - 2, pageWidth - margin * 2, 8, "F");
      }
      doc.text(item.item_name || "", margin + 5, y + 4);
      doc.text("Une fois", pageWidth / 2, y + 4);
      doc.text(formatCurrencyCAD(item.line_total || item.unit_price), pageWidth - margin - 5, y + 4, { align: "right" });
      y += 8;
    });

    y += 10;

    // Totals
    const totals = [
      { label: "Mensuel récurrent:", value: formatCurrencyCAD(data.subtotal_services || 0) },
      { label: "Frais uniques:", value: formatCurrencyCAD(data.subtotal_equipment || 0) },
      { label: "TPS (5%):", value: formatCurrencyCAD(data.tax_gst || 0) },
      { label: "TVQ (9.975%):", value: formatCurrencyCAD(data.tax_qst || 0) },
    ];

    totals.forEach((item) => {
      doc.text(item.label, pageWidth / 2 + 10, y);
      doc.text(item.value, pageWidth - margin - 5, y, { align: "right" });
      y += 6;
    });

    y += 5;

    // Total box
    doc.setFillColor(...COLORS.success);
    doc.roundedRect(pageWidth / 2, y, pageWidth / 2 - margin, 12, 2, 2, "F");
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", pageWidth / 2 + 8, y + 8);
    doc.text(formatCurrencyCAD(data.total_due || 0), pageWidth - margin - 5, y + 8, { align: "right" });

    drawFooter(doc, 1, 1);

    // Generate blob
    const blob = doc.output("blob");
    const filename = `Sommaire-${data.order_number}.pdf`;

    return { success: true, blob, filename };
  } catch (error) {
    console.error("[OrderSummaryPDF] Generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

export default generateOrderSummaryPDF;
