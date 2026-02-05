/**
 * Nivra Contract Template V2 - Professional Design
 * Inspired by Rogers service agreement layout
 * 
 * Features:
 * - Clean header with contract identifiers
 * - Client and service information boxes
 * - Detailed service table with pricing
 * - Terms and conditions section
 * - Dual signature fields (client + agent)
 * - Professional footer with contact info
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { COMPANY_CONTACT } from "@/config/company";

// =============================================================================
// TYPES
// =============================================================================

export interface ContractV2ServiceItem {
  type: "Internet" | "Mobile" | "TV" | "Streaming" | "Security" | "Other";
  name: string;
  description?: string;
  quantity?: number;
  monthlyPrice: number;
  period?: string;
}

export interface ContractV2Data {
  // Document identifiers
  contractNumber: string;
  orderNumber?: string;
  accountNumber: string;
  contractDate: string;
  activationDate?: string;
  
  // Client info
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientDateOfBirth?: string;
  serviceAddress: string;
  serviceCity: string;
  serviceProvince: string;
  servicePostalCode: string;
  billingAddress?: string;
  billingCity?: string;
  billingProvince?: string;
  billingPostalCode?: string;
  
  // Services
  services: ContractV2ServiceItem[];
  
  // One-time fees
  oneTimeFees?: { label: string; amount: number }[];
  
  // Discounts
  discounts?: { label: string; amount: number }[];
  
  // Totals
  monthlySubtotal: number;
  oneTimeSubtotal?: number;
  tps: number;
  tvq: number;
  totalFirstPayment: number;
  monthlyTotal: number;
  
  // Payment terms
  paymentMethod?: string;
  billingCycleStart?: string;
  
  // Signatures
  clientSignature?: string;
  clientSignatureType?: "canvas" | "text";
  clientSignedAt?: string;
  agentSignature?: string;
  agentName?: string;
  agentSignedAt?: string;
  
  // Additional terms
  additionalTerms?: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLORS = {
  primary: [0, 102, 204] as [number, number, number],      // #0066CC - Nivra blue
  secondary: [0, 51, 102] as [number, number, number],     // #003366 - Dark blue
  accent: [52, 211, 153] as [number, number, number],      // #34D399 - Teal accent
  text: [33, 33, 33] as [number, number, number],          // #212121
  textLight: [117, 117, 117] as [number, number, number],  // #757575
  border: [224, 224, 224] as [number, number, number],     // #E0E0E0
  background: [250, 250, 250] as [number, number, number], // #FAFAFA
  white: [255, 255, 255] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],     // #10B981
};

const PAGE_CONFIG = {
  marginLeft: 15,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 20,
  pageWidth: 210,
  pageHeight: 297,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} $`;
}

function drawRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: "S" | "F" | "FD" = "S"
): void {
  doc.roundedRect(x, y, w, h, r, r, style);
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

export function generateContractV2PDF(data: ContractV2Data): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { marginLeft, marginRight, marginTop, pageWidth, pageHeight } = PAGE_CONFIG;
  const contentWidth = pageWidth - marginLeft - marginRight;
  
  let y = marginTop;

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER BAR
  // ─────────────────────────────────────────────────────────────────────────
  
  // Top accent line
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageWidth, 3, "F");
  
  // Header background
  doc.setFillColor(...COLORS.primary);
  doc.rect(marginLeft, y, contentWidth, 25, "F");
  
  // Logo/Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.white);
  doc.text("NIVRA TELECOM", marginLeft + 8, y + 12);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Télécom prépayée au Québec", marginLeft + 8, y + 18);
  
  // Contract number on right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ENTENTE DE SERVICE", pageWidth - marginRight - 8, y + 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(data.contractNumber, pageWidth - marginRight - 8, y + 16, { align: "right" });
  
  y += 30;
  
  // ─────────────────────────────────────────────────────────────────────────
  // DOCUMENT INFO BAR
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFillColor(...COLORS.background);
  doc.rect(marginLeft, y, contentWidth, 12, "F");
  doc.setDrawColor(...COLORS.border);
  doc.rect(marginLeft, y, contentWidth, 12, "S");
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  
  const infoY = y + 5;
  doc.text("Numéro de compte", marginLeft + 5, infoY);
  doc.text("Date du contrat", marginLeft + 55, infoY);
  doc.text("Date d'activation", marginLeft + 105, infoY);
  if (data.orderNumber) {
    doc.text("Numéro de commande", marginLeft + 150, infoY);
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  
  doc.text(data.accountNumber, marginLeft + 5, infoY + 5);
  doc.text(formatDate(data.contractDate), marginLeft + 55, infoY + 5);
  doc.text(data.activationDate ? formatDate(data.activationDate) : "À confirmer", marginLeft + 105, infoY + 5);
  if (data.orderNumber) {
    doc.text(data.orderNumber, marginLeft + 150, infoY + 5);
  }
  
  y += 18;
  
  // ─────────────────────────────────────────────────────────────────────────
  // CLIENT INFORMATION
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.text("INFORMATIONS DU CLIENT", marginLeft, y);
  
  y += 5;
  
  // Client info box
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  drawRoundedRect(doc, marginLeft, y, contentWidth, 28, 2, "FD");
  
  const clientBoxY = y + 5;
  const col1X = marginLeft + 5;
  const col2X = marginLeft + contentWidth / 2 + 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text("Nom complet", col1X, clientBoxY);
  doc.text("Adresse de service", col2X, clientBoxY);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text(data.clientName, col1X, clientBoxY + 5);
  doc.text(`${data.serviceAddress}`, col2X, clientBoxY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${data.serviceCity}, ${data.serviceProvince} ${data.servicePostalCode}`, col2X, clientBoxY + 10);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text("Courriel / Téléphone", col1X, clientBoxY + 14);
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  const contactLine = [data.clientEmail, data.clientPhone].filter(Boolean).join(" • ");
  doc.text(contactLine, col1X, clientBoxY + 19);
  
  y += 35;
  
  // ─────────────────────────────────────────────────────────────────────────
  // SERVICES TABLE
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.text("SERVICES SOUSCRITS", marginLeft, y);
  
  y += 5;
  
  // Table header
  doc.setFillColor(...COLORS.primary);
  doc.rect(marginLeft, y, contentWidth, 8, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.white);
  
  const colType = marginLeft + 3;
  const colName = marginLeft + 28;
  const colDesc = marginLeft + 90;
  const colPrice = pageWidth - marginRight - 25;
  
  doc.text("TYPE", colType, y + 5.5);
  doc.text("SERVICE", colName, y + 5.5);
  doc.text("DESCRIPTION", colDesc, y + 5.5);
  doc.text("PRIX/MOIS", colPrice, y + 5.5, { align: "right" });
  
  y += 8;
  
  // Service rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  
  data.services.forEach((service, index) => {
    const isEven = index % 2 === 0;
    
    if (isEven) {
      doc.setFillColor(...COLORS.background);
      doc.rect(marginLeft, y, contentWidth, 10, "F");
    }
    
    doc.setDrawColor(...COLORS.border);
    doc.line(marginLeft, y + 10, pageWidth - marginRight, y + 10);
    
    // Type badge
    doc.setFillColor(...COLORS.accent);
    doc.roundedRect(colType, y + 2, 22, 6, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.white);
    doc.text(service.type.toUpperCase(), colType + 11, y + 6, { align: "center" });
    
    // Service name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(service.name, colName, y + 6);
    
    // Description
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textLight);
    const desc = service.description || "";
    const truncDesc = desc.length > 40 ? desc.substring(0, 37) + "..." : desc;
    doc.text(truncDesc, colDesc, y + 6);
    
    // Price
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(formatCurrency(service.monthlyPrice), colPrice, y + 6, { align: "right" });
    
    y += 10;
  });
  
  // One-time fees
  if (data.oneTimeFees && data.oneTimeFees.length > 0) {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textLight);
    doc.text("FRAIS UNIQUES", marginLeft, y);
    y += 5;
    
    data.oneTimeFees.forEach((fee) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      doc.text(fee.label, colName, y);
      doc.text(formatCurrency(fee.amount), colPrice, y, { align: "right" });
      y += 5;
    });
  }
  
  // Discounts
  if (data.discounts && data.discounts.length > 0) {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.success);
    doc.text("RABAIS APPLIQUÉS", marginLeft, y);
    y += 5;
    
    data.discounts.forEach((discount) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.success);
      doc.text(discount.label, colName, y);
      doc.text(`-${formatCurrency(discount.amount)}`, colPrice, y, { align: "right" });
      y += 5;
    });
  }
  
  y += 5;
  
  // ─────────────────────────────────────────────────────────────────────────
  // TOTALS BOX
  // ─────────────────────────────────────────────────────────────────────────
  
  const totalsBoxWidth = 80;
  const totalsBoxX = pageWidth - marginRight - totalsBoxWidth;
  
  doc.setFillColor(...COLORS.background);
  doc.setDrawColor(...COLORS.border);
  drawRoundedRect(doc, totalsBoxX, y, totalsBoxWidth, 40, 2, "FD");
  
  const totalsY = y + 6;
  const labelX = totalsBoxX + 5;
  const valueX = totalsBoxX + totalsBoxWidth - 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  
  doc.text("Sous-total mensuel", labelX, totalsY);
  doc.setTextColor(...COLORS.text);
  doc.text(formatCurrency(data.monthlySubtotal), valueX, totalsY, { align: "right" });
  
  if (data.oneTimeSubtotal && data.oneTimeSubtotal > 0) {
    doc.setTextColor(...COLORS.textLight);
    doc.text("Frais uniques", labelX, totalsY + 6);
    doc.setTextColor(...COLORS.text);
    doc.text(formatCurrency(data.oneTimeSubtotal), valueX, totalsY + 6, { align: "right" });
  }
  
  doc.setTextColor(...COLORS.textLight);
  doc.text("TPS (5%)", labelX, totalsY + 12);
  doc.setTextColor(...COLORS.text);
  doc.text(formatCurrency(data.tps), valueX, totalsY + 12, { align: "right" });
  
  doc.setTextColor(...COLORS.textLight);
  doc.text("TVQ (9.975%)", labelX, totalsY + 18);
  doc.setTextColor(...COLORS.text);
  doc.text(formatCurrency(data.tvq), valueX, totalsY + 18, { align: "right" });
  
  // Total line
  doc.setDrawColor(...COLORS.primary);
  doc.line(labelX, totalsY + 23, valueX, totalsY + 23);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text("Premier paiement", labelX, totalsY + 30);
  doc.setFontSize(12);
  doc.text(formatCurrency(data.totalFirstPayment), valueX, totalsY + 30, { align: "right" });
  
  y += 48;
  
  // Monthly total note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text(
    `Paiement mensuel récurrent: ${formatCurrency(data.monthlyTotal)} (taxes incluses)`,
    totalsBoxX,
    y
  );
  
  y += 10;
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENT TERMS
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.text("MODALITÉS DE PAIEMENT", marginLeft, y);
  
  y += 5;
  
  doc.setFillColor(255, 248, 225); // Light yellow
  doc.setDrawColor(255, 193, 7);   // Yellow border
  drawRoundedRect(doc, marginLeft, y, contentWidth, 18, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text("Paiement par Interac uniquement", marginLeft + 5, y + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Envoyer à: ${COMPANY_CONTACT.supportEmailDisplay}`, marginLeft + 5, y + 11);
  doc.text("Le cycle de facturation débute uniquement après confirmation du paiement.", marginLeft + 5, y + 15);
  
  y += 25;
  
  // ─────────────────────────────────────────────────────────────────────────
  // TERMS & CONDITIONS (brief)
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.text("CONDITIONS GÉNÉRALES", marginLeft, y);
  
  y += 5;
  
  const terms = [
    "Le client reconnaît avoir pris connaissance des modalités de service de Nivra Telecom.",
    "Les services sont prépayés et sans engagement. Le cycle de 30 jours débute après paiement.",
    "Le client est responsable de l'équipement fourni jusqu'à sa restitution.",
    "Des frais peuvent s'appliquer en cas de non-retour d'équipement (voir Modalités).",
    "Le client consent à recevoir des communications par courriel concernant son compte.",
  ];
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  
  terms.forEach((term) => {
    doc.text(`• ${term}`, marginLeft, y, { maxWidth: contentWidth - 5 });
    y += 6;
  });
  
  y += 5;
  
  // ─────────────────────────────────────────────────────────────────────────
  // SIGNATURES
  // ─────────────────────────────────────────────────────────────────────────
  
  // Check if we need a new page
  if (y > pageHeight - 70) {
    doc.addPage();
    y = marginTop;
    
    // Re-add header accent on new page
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, 0, pageWidth, 3, "F");
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.text("SIGNATURES", marginLeft, y);
  
  y += 5;
  
  const signatureWidth = (contentWidth - 10) / 2;
  
  // Client signature box
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  drawRoundedRect(doc, marginLeft, y, signatureWidth, 35, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text("Signature du client", marginLeft + 5, y + 6);
  
  if (data.clientSignature) {
    if (data.clientSignatureType === "canvas") {
      // Draw canvas signature image
      try {
        doc.addImage(data.clientSignature, "PNG", marginLeft + 5, y + 10, signatureWidth - 10, 15);
      } catch {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(12);
        doc.text(data.clientName, marginLeft + 10, y + 20);
      }
    } else {
      // Text signature
      doc.setFont("helvetica", "italic");
      doc.setFontSize(14);
      doc.setTextColor(...COLORS.text);
      doc.text(data.clientSignature, marginLeft + 10, y + 22);
    }
    
    if (data.clientSignedAt) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textLight);
      doc.text(`Signé le ${formatDate(data.clientSignedAt)}`, marginLeft + 5, y + 32);
    }
  } else {
    // Empty signature line
    doc.setDrawColor(...COLORS.textLight);
    doc.line(marginLeft + 10, y + 25, marginLeft + signatureWidth - 10, y + 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);
    doc.text("Signature requise", marginLeft + 5, y + 32);
  }
  
  // Agent signature box
  const agentBoxX = marginLeft + signatureWidth + 10;
  doc.setFillColor(...COLORS.primary);
  drawRoundedRect(doc, agentBoxX, y, signatureWidth, 35, 2, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text("Signature Nivra Telecom", agentBoxX + 5, y + 6);
  
  if (data.agentSignature || data.agentName) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(14);
    doc.text(data.agentSignature || data.agentName || "", agentBoxX + 10, y + 22);
    
    if (data.agentSignedAt) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Signé le ${formatDate(data.agentSignedAt)}`, agentBoxX + 5, y + 32);
    }
  } else {
    doc.setDrawColor(...COLORS.white);
    doc.line(agentBoxX + 10, y + 25, agentBoxX + signatureWidth - 10, y + 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Signature agent", agentBoxX + 5, y + 32);
  }
  
  y += 45;
  
  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────
  
  const footerY = pageHeight - 15;
  
  doc.setDrawColor(...COLORS.border);
  doc.line(marginLeft, footerY - 5, pageWidth - marginRight, footerY - 5);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textLight);
  
  doc.text(
    `${COMPANY_CONTACT.legalName} — ${COMPANY_CONTACT.fullAddress}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );
  doc.text(
    `${COMPANY_CONTACT.supportEmailDisplay} — 438-544-2233 — nivra-telecom.ca`,
    pageWidth / 2,
    footerY + 4,
    { align: "center" }
  );
  
  // Document ID
  doc.setFont("helvetica", "bold");
  doc.text(data.contractNumber, pageWidth - marginRight, footerY + 2, { align: "right" });

  return doc;
}

/**
 * Generate and download the contract PDF
 */
export function downloadContractV2PDF(data: ContractV2Data): void {
  const doc = generateContractV2PDF(data);
  const fileName = `Entente_${data.contractNumber}_${data.clientName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

export default generateContractV2PDF;
