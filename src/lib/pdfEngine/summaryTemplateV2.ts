/**
 * Nivra Summary Template V2 - Professional Design
 * Sommaire des renseignements essentiels
 * Inspired by Rogers "Sommaire des renseignements essentiels" layout
 * 
 * Features:
 * - Quick reference summary box
 * - Clear service and pricing breakdown
 * - Important dates and terms
 * - Customer rights and obligations
 * - Clean, scannable layout
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { COMPANY_CONTACT } from "@/config/company";

// =============================================================================
// TYPES
// =============================================================================

export interface SummaryV2ServiceItem {
  type: "Internet" | "Mobile" | "TV" | "Streaming" | "Security" | "Other";
  name: string;
  monthlyPrice: number;
  details?: string[];
}

export interface SummaryV2Data {
  // Document identifiers
  summaryNumber: string;
  contractNumber?: string;
  orderNumber?: string;
  accountNumber: string;
  issueDate: string;
  
  // Client info
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  serviceAddress: string;
  serviceCity: string;
  serviceProvince: string;
  servicePostalCode: string;
  
  // Services
  services: SummaryV2ServiceItem[];
  
  // Key dates
  activationDate?: string;
  firstBillingDate?: string;
  
  // Pricing summary
  monthlyTotal: number;
  setupFees?: number;
  firstPayment: number;
  
  // Terms
  contractDuration?: string; // e.g., "Sans engagement" or "12 mois"
  cancellationPolicy?: string;
  trialPeriod?: string;
  
  // Equipment
  equipment?: { name: string; status: string }[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLORS = {
  primary: [0, 102, 204] as [number, number, number],
  secondary: [0, 51, 102] as [number, number, number],
  accent: [52, 211, 153] as [number, number, number],
  text: [33, 33, 33] as [number, number, number],
  textLight: [117, 117, 117] as [number, number, number],
  border: [224, 224, 224] as [number, number, number],
  background: [250, 250, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  highlight: [232, 245, 253] as [number, number, number], // Light blue
  warning: [255, 243, 224] as [number, number, number],   // Light orange
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

export function generateSummaryV2PDF(data: SummaryV2Data): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { marginLeft, marginRight, marginTop, pageWidth, pageHeight } = PAGE_CONFIG;
  const contentWidth = pageWidth - marginLeft - marginRight;
  
  let y = marginTop;

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER
  // ─────────────────────────────────────────────────────────────────────────
  
  // Top accent line
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageWidth, 3, "F");
  
  // Header area
  doc.setFillColor(...COLORS.primary);
  doc.rect(marginLeft, y, contentWidth, 20, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.text("SOMMAIRE DES RENSEIGNEMENTS ESSENTIELS", marginLeft + 8, y + 13);
  
  y += 25;
  
  // Quick reference bar
  doc.setFillColor(...COLORS.highlight);
  doc.rect(marginLeft, y, contentWidth, 15, "F");
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  
  const refY = y + 5;
  doc.text("Numéro de compte", marginLeft + 5, refY);
  doc.text("Numéro de sommaire", marginLeft + 50, refY);
  doc.text("Date d'émission", marginLeft + 110, refY);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(data.accountNumber, marginLeft + 5, refY + 6);
  doc.text(data.summaryNumber, marginLeft + 50, refY + 6);
  doc.text(formatDate(data.issueDate), marginLeft + 110, refY + 6);
  
  // Logo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  doc.text("NIVRA", pageWidth - marginRight - 8, refY + 3, { align: "right" });
  
  y += 20;
  
  // ─────────────────────────────────────────────────────────────────────────
  // CLIENT INFO
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text("TITULAIRE DU COMPTE", marginLeft, y);
  
  y += 5;
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  drawRoundedRect(doc, marginLeft, y, contentWidth, 20, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.text(data.clientName, marginLeft + 5, y + 7);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textLight);
  doc.text(
    `${data.serviceAddress}, ${data.serviceCity}, ${data.serviceProvince} ${data.servicePostalCode}`,
    marginLeft + 5,
    y + 13
  );
  doc.text(`${data.clientEmail} • ${data.clientPhone || ""}`, marginLeft + 5, y + 18);
  
  y += 27;
  
  // ─────────────────────────────────────────────────────────────────────────
  // QUICK SUMMARY BOX
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text("EN UN COUP D'ŒIL", marginLeft, y);
  
  y += 5;
  
  // Large summary box with 3 columns
  doc.setFillColor(...COLORS.primary);
  drawRoundedRect(doc, marginLeft, y, contentWidth, 30, 3, "F");
  
  const colWidth = contentWidth / 3;
  const summaryY = y + 8;
  
  // Column 1: Monthly total
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.white);
  doc.text("Paiement mensuel", marginLeft + colWidth / 2, summaryY, { align: "center" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(formatCurrency(data.monthlyTotal), marginLeft + colWidth / 2, summaryY + 12, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("taxes incluses", marginLeft + colWidth / 2, summaryY + 18, { align: "center" });
  
  // Column 2: First payment
  doc.setFontSize(8);
  doc.text("Premier paiement", marginLeft + colWidth + colWidth / 2, summaryY, { align: "center" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(formatCurrency(data.firstPayment), marginLeft + colWidth + colWidth / 2, summaryY + 12, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("dû maintenant", marginLeft + colWidth + colWidth / 2, summaryY + 18, { align: "center" });
  
  // Column 3: Contract type
  doc.setFontSize(8);
  doc.text("Type d'engagement", marginLeft + 2 * colWidth + colWidth / 2, summaryY, { align: "center" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.contractDuration || "Sans engagement", marginLeft + 2 * colWidth + colWidth / 2, summaryY + 12, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("prépayé", marginLeft + 2 * colWidth + colWidth / 2, summaryY + 18, { align: "center" });
  
  y += 38;
  
  // ─────────────────────────────────────────────────────────────────────────
  // SERVICES LIST
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text("VOS SERVICES", marginLeft, y);
  
  y += 6;
  
  data.services.forEach((service, index) => {
    const boxHeight = 20 + (service.details?.length || 0) * 4;
    
    const bgColor = index % 2 === 0 ? COLORS.white : COLORS.background;
    doc.setFillColor(...bgColor);
    doc.setDrawColor(...COLORS.border);
    drawRoundedRect(doc, marginLeft, y, contentWidth, boxHeight, 2, "FD");
    
    // Service type badge
    doc.setFillColor(...COLORS.accent);
    doc.roundedRect(marginLeft + 5, y + 4, 22, 6, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.white);
    doc.text(service.type.toUpperCase(), marginLeft + 16, y + 8, { align: "center" });
    
    // Service name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    doc.text(service.name, marginLeft + 32, y + 9);
    
    // Price
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text(formatCurrency(service.monthlyPrice), pageWidth - marginRight - 5, y + 9, { align: "right" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);
    doc.text("/mois", pageWidth - marginRight - 5, y + 14, { align: "right" });
    
    // Details
    if (service.details && service.details.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textLight);
      
      let detailY = y + 15;
      service.details.forEach((detail) => {
        doc.text(`• ${detail}`, marginLeft + 32, detailY);
        detailY += 4;
      });
    }
    
    y += boxHeight + 2;
  });
  
  y += 5;
  
  // ─────────────────────────────────────────────────────────────────────────
  // KEY DATES
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text("DATES IMPORTANTES", marginLeft, y);
  
  y += 6;
  
  doc.setFillColor(...COLORS.warning);
  drawRoundedRect(doc, marginLeft, y, contentWidth, 18, 2, "F");
  
  const dateColWidth = contentWidth / 3;
  const dateY = y + 5;
  
  // Activation date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text("Date d'activation", marginLeft + 5, dateY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(data.activationDate ? formatDate(data.activationDate) : "À confirmer", marginLeft + 5, dateY + 6);
  
  // First billing date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text("Première facturation", marginLeft + dateColWidth + 5, dateY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(data.firstBillingDate ? formatDate(data.firstBillingDate) : "Après paiement", marginLeft + dateColWidth + 5, dateY + 6);
  
  // Trial period
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text("Période d'essai", marginLeft + 2 * dateColWidth + 5, dateY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(data.trialPeriod || "Aucune", marginLeft + 2 * dateColWidth + 5, dateY + 6);
  
  y += 25;
  
  // ─────────────────────────────────────────────────────────────────────────
  // EQUIPMENT (if any)
  // ─────────────────────────────────────────────────────────────────────────
  
  if (data.equipment && data.equipment.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.primary);
    doc.text("ÉQUIPEMENT", marginLeft, y);
    
    y += 6;
    
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.border);
    drawRoundedRect(doc, marginLeft, y, contentWidth, 6 + data.equipment.length * 6, 2, "FD");
    
    let eqY = y + 5;
    data.equipment.forEach((eq) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      doc.text(eq.name, marginLeft + 5, eqY);
      
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textLight);
      doc.text(eq.status, pageWidth - marginRight - 5, eqY, { align: "right" });
      
      eqY += 6;
    });
    
    y += 10 + data.equipment.length * 6;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // YOUR RIGHTS
  // ─────────────────────────────────────────────────────────────────────────
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text("VOS DROITS", marginLeft, y);
  
  y += 6;
  
  const rights = [
    "Vous pouvez annuler sans frais dans les 15 jours suivant l'activation si les services ne sont pas utilisés.",
    "Vous avez le droit de contester une facture dans les 30 jours suivant sa réception.",
    "Vous pouvez déposer une plainte auprès de la CPRST (ccts-cprst.ca) si votre problème n'est pas résolu.",
    "Vous pouvez modifier ou annuler vos services en tout temps via le portail client ou par courriel.",
  ];
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  
  rights.forEach((right) => {
    const lines = doc.splitTextToSize(`• ${right}`, contentWidth - 10);
    doc.text(lines, marginLeft + 5, y);
    y += lines.length * 4 + 2;
  });
  
  y += 5;
  
  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────
  
  const footerY = pageHeight - 20;
  
  doc.setDrawColor(...COLORS.border);
  doc.line(marginLeft, footerY - 5, pageWidth - marginRight, footerY - 5);
  
  // Important notice
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.primary);
  doc.text("CONSERVEZ CE DOCUMENT", marginLeft, footerY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textLight);
  doc.text(
    "Ce sommaire résume les renseignements essentiels de votre entente. Consultez les Modalités de service pour les détails complets.",
    marginLeft,
    footerY + 4
  );
  
  doc.text(
    `${COMPANY_CONTACT.legalName} — ${COMPANY_CONTACT.supportEmailDisplay} — 438-544-2233`,
    pageWidth / 2,
    footerY + 10,
    { align: "center" }
  );
  
  // Document ID
  doc.setFont("helvetica", "bold");
  doc.text(data.summaryNumber, pageWidth - marginRight, footerY + 10, { align: "right" });

  return doc;
}

/**
 * Generate and download the summary PDF
 */
export function downloadSummaryV2PDF(data: SummaryV2Data): void {
  const doc = generateSummaryV2PDF(data);
  const fileName = `Sommaire_${data.summaryNumber}_${data.clientName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

export default generateSummaryV2PDF;
