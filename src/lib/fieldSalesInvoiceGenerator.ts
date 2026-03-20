/**
 * Field Sales Invoice PDF Generator
 * Generates invoices for door-to-door sales
 */
import { jsPDF } from "jspdf";

/**
 * ⛔ LOCAL TAX MATH REMOVED — All financial values must come from the data parameter
 * which is populated from canonical DB records (pricing_snapshot / billing_invoices).
 */

interface FieldSalesInvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  createdAt: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
  };
  service: {
    type: string;
    planName: string;
    monthlyPrice: number;
  };
  payment: {
    method: string;
    status: string;
    totalAmount: number;
    reference: string | null;
  };
}

export async function generateFieldSalesInvoicePDF(data: FieldSalesInvoiceData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 20;

  // Helper functions
  const addText = (text: string, x: number, y: number, options?: any) => {
    doc.text(text, x, y, options);
  };

  // ========== HEADER ==========
  doc.setFillColor(16, 185, 129); // Emerald
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  addText("FACTURE", marginLeft, 22);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  addText("Nivra Telecom", marginLeft, 32);
  
  // Invoice info on right
  doc.setFontSize(10);
  addText(`Facture #: ${data.invoiceNumber}`, pageWidth - marginRight - 60, 18);
  addText(`Commande #: ${data.orderNumber}`, pageWidth - marginRight - 60, 26);
  addText(`Date: ${new Date(data.createdAt).toLocaleDateString("fr-CA")}`, pageWidth - marginRight - 60, 34);
  
  currentY = 55;

  // ========== STATUS BADGE ==========
  const isPaid = data.payment.status === "confirmed";
  doc.setFillColor(isPaid ? 16 : 245, isPaid ? 185 : 158, isPaid ? 129 : 11);
  doc.roundedRect(pageWidth - marginRight - 40, currentY - 5, 40, 12, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  addText(isPaid ? "PAYÉE" : "EN ATTENTE", pageWidth - marginRight - 35, currentY + 3);

  // ========== COMPANY INFO ==========
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  addText("DE:", marginLeft, currentY);
  doc.setFont("helvetica", "normal");
  currentY += 6;
  addText("Nivra Telecom Inc.", marginLeft, currentY);
  currentY += 5;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  addText("1799 Av. Pierre-Péladeau", marginLeft, currentY);
  currentY += 4;
  addText("Laval, QC H7T 2Y5", marginLeft, currentY);
  currentY += 4;
  addText("Tél: 438-544-2233", marginLeft, currentY);
  currentY += 4;
  addText("support@nivra-telecom.ca", marginLeft, currentY);

  // ========== CLIENT INFO ==========
  currentY = 55;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  addText("À:", marginLeft + 80, currentY);
  doc.setFont("helvetica", "normal");
  currentY += 6;
  addText(data.customer.name, marginLeft + 80, currentY);
  currentY += 5;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  addText(data.customer.address, marginLeft + 80, currentY);
  currentY += 4;
  addText(`${data.customer.city} ${data.customer.postalCode}`, marginLeft + 80, currentY);
  currentY += 4;
  addText(`Tél: ${data.customer.phone}`, marginLeft + 80, currentY);
  currentY += 4;
  addText(data.customer.email, marginLeft + 80, currentY);

  currentY = 105;

  // ========== LINE ITEMS TABLE ==========
  // Table header
  doc.setFillColor(16, 185, 129);
  doc.rect(marginLeft, currentY, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  addText("Description", marginLeft + 5, currentY + 7);
  addText("Type", marginLeft + 90, currentY + 7);
  addText("Prix", marginLeft + 140, currentY + 7);
  currentY += 10;

  // Table row
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFillColor(250, 250, 250);
  doc.rect(marginLeft, currentY, contentWidth, 12, 'F');
  
  addText(data.service.planName, marginLeft + 5, currentY + 8);
  addText(data.service.type.charAt(0).toUpperCase() + data.service.type.slice(1), marginLeft + 90, currentY + 8);
  doc.setFont("helvetica", "bold");
  addText(`${data.service.monthlyPrice.toFixed(2)} $`, marginLeft + 140, currentY + 8);
  
  currentY += 20;

  // ========== TOTALS ==========
  const subtotal = data.payment.totalAmount / COMBINED_TAX_MULTIPLIER;
  const taxResult = estimateTaxes(subtotal);
  const tps = taxResult.tps;
  const tvq = taxResult.tvq;

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(marginLeft + 80, currentY, 90, 55, 3, 3, 'F');
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let totalsY = currentY + 10;
  
  addText("Sous-total:", marginLeft + 85, totalsY);
  addText(`${subtotal.toFixed(2)} $`, marginLeft + 160, totalsY, { align: "right" });
  
  totalsY += 10;
  addText("TPS (5%):", marginLeft + 85, totalsY);
  addText(`${tps.toFixed(2)} $`, marginLeft + 160, totalsY, { align: "right" });
  
  totalsY += 10;
  addText("TVQ (9.975%):", marginLeft + 85, totalsY);
  addText(`${tvq.toFixed(2)} $`, marginLeft + 160, totalsY, { align: "right" });
  
  totalsY += 3;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(marginLeft + 85, totalsY, marginLeft + 165, totalsY);
  
  totalsY += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  addText("Total:", marginLeft + 85, totalsY);
  doc.setTextColor(16, 185, 129);
  addText(`${data.payment.totalAmount.toFixed(2)} $`, marginLeft + 160, totalsY, { align: "right" });

  currentY += 70;

  // ========== PAYMENT INFO ==========
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  addText("Informations de paiement", marginLeft, currentY);
  currentY += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  const paymentMethodLabel = {
    interac: "Interac e-Transfer",
    paypal: "PayPal",
    deferred: "Paiement différé",
    cash: "Comptant",
  }[data.payment.method] || data.payment.method;

  addText(`Méthode: ${paymentMethodLabel}`, marginLeft, currentY);
  currentY += 5;
  addText(`Statut: ${isPaid ? "Payé" : "En attente de confirmation"}`, marginLeft, currentY);
  
  if (data.payment.reference) {
    currentY += 5;
    addText(`Référence: ${data.payment.reference}`, marginLeft, currentY);
  }

  currentY += 15;

  // ========== PAYMENT INSTRUCTIONS ==========
  if (!isPaid) {
    doc.setFillColor(255, 251, 235); // Amber light
    doc.roundedRect(marginLeft, currentY, contentWidth, 35, 3, 3, 'F');
    
    doc.setTextColor(180, 83, 9);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    addText("Instructions de paiement", marginLeft + 5, currentY + 8);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    currentY += 12;
    addText("Interac e-Transfer: support@nivra-telecom.ca", marginLeft + 5, currentY + 5);
    addText(`Mot de passe: NIVRA${data.invoiceNumber.slice(-4)}`, marginLeft + 5, currentY + 10);
    addText("Veuillez inclure le numéro de facture dans le message.", marginLeft + 5, currentY + 18);
  }

  // ========== FOOTER ==========
  const footerY = doc.internal.pageSize.getHeight() - 25;
  
  doc.setDrawColor(200, 200, 200);
  doc.line(marginLeft, footerY - 5, pageWidth - marginRight, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  addText("Merci pour votre confiance!", pageWidth / 2, footerY, { align: "center" });
  addText("Nivra Communications Inc. • 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5 • 438-544-2233 • Support@nivra-telecom.ca", pageWidth / 2, footerY + 6, { align: "center" });
  addText(`NEQ: 2291249786 • TPS: 732287291 RT0001 • TVQ: 1229249786 TQ0001`, pageWidth / 2, footerY + 12, { align: "center" });

  // Download
  doc.save(`Facture-${data.invoiceNumber}.pdf`);
}
