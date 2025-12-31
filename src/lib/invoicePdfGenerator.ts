import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { BUSINESS_INFO } from "./contractPolicies";

interface InvoiceData {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  amount: number;
  fees?: number;
  credits?: number;
  dueDate?: string;
  createdAt: string;
  status: string;
  paidAt?: string;
  notes?: string;
}

export const generateInvoicePDF = (data: InvoiceData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  const primaryColor: [number, number, number] = [0, 188, 212];
  const darkColor: [number, number, number] = [30, 30, 30];
  const grayColor: [number, number, number] = [100, 100, 100];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, "F");

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.name.toUpperCase(), pageWidth / 2, 22, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Courtier Télécom Indépendant", pageWidth / 2, 32, { align: "center" });
  doc.text(`${BUSINESS_INFO.phone} | ${BUSINESS_INFO.email}`, pageWidth / 2, 40, { align: "center" });

  currentY = 60;

  // Invoice title
  doc.setFontSize(20);
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
  doc.roundedRect(pageWidth - margin - 45, currentY - 12, 45, 16, 3, 3, "F");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(statusLabel, pageWidth - margin - 22.5, currentY - 2, { align: "center" });

  currentY += 15;

  // Invoice info box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, currentY, contentWidth, 30, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text(`Facture N° : ${data.invoiceNumber}`, margin + 8, currentY + 10);
  doc.text(`Date d'émission : ${format(new Date(data.createdAt), "d MMMM yyyy", { locale: fr })}`, margin + 8, currentY + 18);

  if (data.dueDate) {
    doc.text(`Date d'échéance : ${format(new Date(data.dueDate), "d MMMM yyyy", { locale: fr })}`, pageWidth - margin - 8, currentY + 10, { align: "right" });
  }
  if (data.paidAt) {
    doc.setTextColor(34, 197, 94);
    doc.text(`Payé le : ${format(new Date(data.paidAt), "d MMMM yyyy", { locale: fr })}`, pageWidth - margin - 8, currentY + 18, { align: "right" });
  }

  currentY += 45;

  // Parties
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("DE :", margin, currentY);
  doc.text("À :", margin + contentWidth / 2, currentY);

  currentY += 8;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);
  doc.setFontSize(9);

  // From
  doc.text(BUSINESS_INFO.legalName, margin, currentY);
  doc.text(BUSINESS_INFO.address, margin, currentY + 5);
  doc.text(BUSINESS_INFO.phone, margin, currentY + 10);
  doc.text(BUSINESS_INFO.email, margin, currentY + 15);

  // To
  doc.text(data.clientName, margin + contentWidth / 2, currentY);
  doc.text(data.clientEmail, margin + contentWidth / 2, currentY + 5);
  if (data.clientPhone) {
    doc.text(data.clientPhone, margin + contentWidth / 2, currentY + 10);
  }

  currentY += 35;

  // Line items table header
  doc.setFillColor(...primaryColor);
  doc.rect(margin, currentY, contentWidth, 10, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Description", margin + 5, currentY + 7);
  doc.text("Montant", pageWidth - margin - 5, currentY + 7, { align: "right" });

  currentY += 15;

  // Line items
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);

  // Base amount
  doc.text("Services de courtage télécom", margin + 5, currentY);
  doc.text(`${data.amount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
  currentY += 8;

  // Fees if any
  if (data.fees && data.fees > 0) {
    doc.text("Frais additionnels", margin + 5, currentY);
    doc.text(`${data.fees.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
    currentY += 8;
  }

  // Credits if any
  if (data.credits && data.credits > 0) {
    doc.setTextColor(34, 197, 94);
    doc.text("Crédits appliqués", margin + 5, currentY);
    doc.text(`-${data.credits.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
    doc.setTextColor(...darkColor);
    currentY += 8;
  }

  currentY += 5;

  // Separator
  doc.setDrawColor(...grayColor);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 12;

  // Total
  const total = data.amount + (data.fees || 0) - (data.credits || 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL À PAYER", margin + 5, currentY);
  doc.setTextColor(...primaryColor);
  doc.text(`${total.toFixed(2)} $ CAD`, pageWidth - margin - 5, currentY, { align: "right" });

  currentY += 25;

  // Payment info
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, currentY, contentWidth, 40, 3, 3, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text("Informations de paiement", margin + 8, currentY + 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Virement Interac :", margin + 8, currentY + 20);
  doc.setFont("helvetica", "bold");
  doc.text("NivraTelecom@gmail.com", margin + 50, currentY + 20);

  doc.setFont("helvetica", "normal");
  doc.text("Question de sécurité : Nom du client ou nom de l'entreprise", margin + 8, currentY + 28);
  doc.text("Réponse : Votre nom complet ou le nom de votre entreprise", margin + 8, currentY + 35);

  currentY += 55;

  // Notes
  if (data.notes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Notes :", margin, currentY);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(noteLines, margin, currentY + 6);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text(`${BUSINESS_INFO.legalName} - ${BUSINESS_INFO.address}`, pageWidth / 2, pageHeight - 15, { align: "center" });
  doc.text("Merci pour votre confiance!", pageWidth / 2, pageHeight - 10, { align: "center" });

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
