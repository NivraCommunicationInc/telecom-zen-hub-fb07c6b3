import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { BUSINESS_INFO } from "./contractPolicies";

interface InvoiceData {
  invoiceNumber: string;
  orderNumber?: string;
  clientNumber?: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  subtotal: number;
  fees?: number;
  credits?: number;
  deliveryFee?: number;
  activationFee?: number;
  installationFee?: number;
  discountAmount?: number;
  tpsAmount?: number;
  tvqAmount?: number;
  lateFeeAmount?: number;
  dueDate?: string;
  createdAt: string;
  status: string;
  paidAt?: string;
  notes?: string;
  equipmentId?: string;
}

// Quebec tax rates
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

export const generateInvoicePDF = (data: InvoiceData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  const primaryColor: [number, number, number] = [0, 188, 212];
  const navyColor: [number, number, number] = [10, 25, 47];
  const darkColor: [number, number, number] = [30, 30, 30];
  const grayColor: [number, number, number] = [100, 100, 100];

  // Calculate amounts
  const subtotal = data.subtotal || 0;
  const fees = data.fees || 0;
  const deliveryFee = data.deliveryFee || 0;
  const activationFee = data.activationFee || 0;
  const installationFee = data.installationFee || 0;
  const discountAmount = data.discountAmount || 0;
  const credits = data.credits || 0;
  
  const baseAmount = subtotal + fees + deliveryFee + activationFee + installationFee - discountAmount;
  const tpsAmount = data.tpsAmount ?? Math.round(baseAmount * TPS_RATE * 100) / 100;
  const tvqAmount = data.tvqAmount ?? Math.round(baseAmount * TVQ_RATE * 100) / 100;
  const lateFeeAmount = data.lateFeeAmount || 0;
  const total = baseAmount + tpsAmount + tvqAmount + lateFeeAmount - credits;

  // Header
  doc.setFillColor(...navyColor);
  doc.rect(0, 0, pageWidth, 50, "F");
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 4, "F");

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.name.toUpperCase(), pageWidth / 2, 25, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...primaryColor);
  doc.text("Courtier Télécom Indépendant", pageWidth / 2, 35, { align: "center" });
  doc.setTextColor(200, 200, 200);
  doc.text(`${BUSINESS_INFO.phone} | ${BUSINESS_INFO.email}`, pageWidth / 2, 44, { align: "center" });

  currentY = 65;

  // Invoice title and status
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text("FACTURE", margin, currentY);

  // Invoice status badge
  const statusColors: Record<string, [number, number, number]> = {
    paid: [34, 197, 94],
    pending: [234, 179, 8],
    overdue: [239, 68, 68],
  };
  const statusLabels: Record<string, string> = {
    paid: "PAYÉE",
    pending: "EN ATTENTE",
    overdue: "EN RETARD",
  };

  const statusColor = statusColors[data.status] || statusColors.pending;
  const statusLabel = statusLabels[data.status] || data.status.toUpperCase();

  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - margin - 50, currentY - 14, 50, 18, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(statusLabel, pageWidth - margin - 25, currentY - 3, { align: "center" });

  currentY += 15;

  // Invoice info box
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, currentY, contentWidth, 35, 3, 3, "F");
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.8);
  doc.line(margin, currentY, margin, currentY + 35);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayColor);
  doc.text("FACTURE N°", margin + 8, currentY + 8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text(data.invoiceNumber, margin + 8, currentY + 14);

  if (data.orderNumber) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    doc.text("COMMANDE N°", margin + 60, currentY + 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text(data.orderNumber, margin + 60, currentY + 14);
  }

  if (data.clientNumber) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    doc.text("COMPTE CLIENT", margin + 120, currentY + 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text(data.clientNumber, margin + 120, currentY + 14);
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayColor);
  doc.text("DATE D'ÉMISSION", margin + 8, currentY + 22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text(format(new Date(data.createdAt), "d MMMM yyyy", { locale: fr }), margin + 8, currentY + 28);

  if (data.dueDate) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    doc.text("ÉCHÉANCE", margin + 60, currentY + 22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(data.status === "overdue" ? 239 : darkColor[0], data.status === "overdue" ? 68 : darkColor[1], data.status === "overdue" ? 68 : darkColor[2]);
    doc.text(format(new Date(data.dueDate), "d MMMM yyyy", { locale: fr }), margin + 60, currentY + 28);
  }

  if (data.paidAt) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    doc.text("PAYÉ LE", margin + 120, currentY + 22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 197, 94);
    doc.text(format(new Date(data.paidAt), "d MMMM yyyy", { locale: fr }), margin + 120, currentY + 28);
  }

  currentY += 50;

  // Parties
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("FACTURÉ PAR", margin, currentY);
  doc.text("FACTURÉ À", margin + contentWidth / 2, currentY);

  currentY += 8;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);
  doc.setFontSize(9);

  // From
  doc.text(BUSINESS_INFO.legalName, margin, currentY);
  doc.text(BUSINESS_INFO.address, margin, currentY + 5);
  doc.text(`TPS: ${BUSINESS_INFO.neq || "En cours"}`, margin, currentY + 10);
  doc.text(`TVQ: ${BUSINESS_INFO.neq || "En cours"}`, margin, currentY + 15);

  // To
  doc.text(data.clientName, margin + contentWidth / 2, currentY);
  doc.text(data.clientEmail, margin + contentWidth / 2, currentY + 5);
  if (data.clientPhone) {
    doc.text(data.clientPhone, margin + contentWidth / 2, currentY + 10);
  }
  if (data.clientNumber) {
    doc.text(`Compte: ${data.clientNumber}`, margin + contentWidth / 2, currentY + 15);
  }

  currentY += 30;

  // Line items table header
  doc.setFillColor(...navyColor);
  doc.rect(margin, currentY, contentWidth, 10, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("DESCRIPTION", margin + 5, currentY + 7);
  doc.text("MONTANT", pageWidth - margin - 5, currentY + 7, { align: "right" });

  currentY += 15;

  // Line items
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);
  doc.setFontSize(9);

  const addLineItem = (description: string, amount: number, isCredit: boolean = false) => {
    if (amount === 0) return;
    doc.text(description, margin + 5, currentY);
    doc.setTextColor(isCredit ? 34 : darkColor[0], isCredit ? 197 : darkColor[1], isCredit ? 94 : darkColor[2]);
    doc.text(`${isCredit ? "-" : ""}${amount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
    doc.setTextColor(...darkColor);
    currentY += 7;
  };

  // Base services
  if (subtotal > 0) {
    addLineItem("Services de courtage télécom", subtotal);
  }
  if (fees > 0) {
    addLineItem("Frais additionnels", fees);
  }
  if (deliveryFee > 0) {
    addLineItem("Frais de livraison (QC)", deliveryFee);
  }
  if (activationFee > 0) {
    addLineItem("Frais d'activation", activationFee);
  }
  if (installationFee > 0) {
    addLineItem("Frais d'installation", installationFee);
  }
  if (discountAmount > 0) {
    addLineItem("Rabais appliqué", discountAmount, true);
  }

  currentY += 3;
  doc.setDrawColor(...grayColor);
  doc.setLineWidth(0.3);
  doc.line(margin + 5, currentY, pageWidth - margin - 5, currentY);
  currentY += 7;

  // Subtotal before taxes
  doc.setFont("helvetica", "normal");
  doc.text("Sous-total avant taxes", margin + 5, currentY);
  doc.text(`${baseAmount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
  currentY += 7;

  // Taxes
  doc.text(`TPS (5%)`, margin + 5, currentY);
  doc.text(`${tpsAmount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
  currentY += 7;

  doc.text(`TVQ (9.975%)`, margin + 5, currentY);
  doc.text(`${tvqAmount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
  currentY += 7;

  // Late fee if applicable
  if (lateFeeAmount > 0) {
    doc.setTextColor(239, 68, 68);
    doc.text("Frais de retard (5%)", margin + 5, currentY);
    doc.text(`${lateFeeAmount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
    doc.setTextColor(...darkColor);
    currentY += 7;
  }

  // Credits if any
  if (credits > 0) {
    doc.setTextColor(34, 197, 94);
    doc.text("Crédits appliqués", margin + 5, currentY);
    doc.text(`-${credits.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
    doc.setTextColor(...darkColor);
    currentY += 7;
  }

  currentY += 3;

  // Total
  doc.setFillColor(...navyColor);
  doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, "F");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL À PAYER", margin + 8, currentY + 10);
  doc.setTextColor(...primaryColor);
  doc.text(`${total.toFixed(2)} $ CAD`, pageWidth - margin - 8, currentY + 10, { align: "right" });

  currentY += 25;

  // Equipment ID if applicable
  if (data.equipmentId) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    doc.text(`ID Équipement: ${data.equipmentId}`, margin, currentY);
    currentY += 10;
  }

  // Payment info
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, currentY, contentWidth, 40, 3, 3, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text("Informations de paiement", margin + 8, currentY + 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Virement Interac :", margin + 8, currentY + 20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("NivraTelecom@gmail.com", margin + 50, currentY + 20);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);
  doc.text("Question : Nom du client ou nom de l'entreprise", margin + 8, currentY + 28);
  doc.text("Réponse : Votre nom complet ou le nom de votre entreprise", margin + 8, currentY + 35);

  currentY += 50;

  // Notes
  if (data.notes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text("Notes :", margin, currentY);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(noteLines, margin, currentY + 6);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(...primaryColor);
  doc.rect(0, pageHeight - 14, pageWidth, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  doc.text(`${BUSINESS_INFO.legalName} - ${BUSINESS_INFO.address} - Numéros de taxes applicables`, pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.text("Merci pour votre confiance!", pageWidth / 2, pageHeight - 4, { align: "center" });

  return doc;
};

export const downloadInvoicePDF = (data: InvoiceData) => {
  const doc = generateInvoicePDF(data);
  doc.save(`Facture_${data.invoiceNumber}_${data.clientName.replace(/\s+/g, "_")}.pdf`);
};

export const viewInvoicePDF = (data: InvoiceData) => {
  const doc = generateInvoicePDF(data);
  const pdfBlob = doc.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, "_blank");
};
