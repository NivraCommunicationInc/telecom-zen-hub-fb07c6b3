/**
 * Nivra Invoice Template V2 - Professional Design
 * Inspired by Rogers invoice layout with clean tables, clear totals, and proper signatures
 * 
 * Key improvements over V1:
 * - Clear horizontal header bar with account info
 * - "Bienvenue" personalized greeting
 * - Summary boxes with colored accents
 * - Clean table layouts with proper spacing
 * - Visible signature fields (canvas or text)
 * - Proper French Canadian formatting
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { COMPANY_CONTACT } from "@/config/company";

// =============================================================================
// TYPES
// =============================================================================

export interface InvoiceV2ServiceItem {
  type: "Internet" | "Mobile" | "TV" | "Streaming" | "Security" | "Other";
  name: string;
  description?: string;
  quantity?: number;
  monthlyPrice: number;
  period?: string; // "/mois" or "/30 jours"
  detailsPage?: number; // "Voir page X"
}

export interface InvoiceV2Data {
  // Document identifiers
  invoiceNumber: string;
  accountNumber: string;
  paymentBankNumber?: string; // For bank payment reference
  billingDate: string;
  dueDate: string;
  
  // Client info
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress: string;
  clientCity: string;
  clientProvince: string;
  clientPostalCode: string;
  
  // Previous balance
  previousBalance?: number;
  carriedBalance?: number;
  
  // Services (recurring)
  services: InvoiceV2ServiceItem[];
  
  // One-time fees
  oneTimeFees?: { label: string; amount: number }[];
  
  // Discounts/Credits
  discounts?: { label: string; amount: number }[];
  credits?: number;
  
  // Calculated totals (from billingCalculator)
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
  
  // Payment status
  isPaid?: boolean;
  paidAt?: string;
  paymentMethod?: "etransfer" | "card" | "cash";
  paymentReference?: string;
  
  // Signatures (optional)
  clientSignature?: string; // base64 image or typed name
  clientSignatureType?: "canvas" | "text";
  clientSignedAt?: string;
  agentSignature?: string;
  agentName?: string;
  agentSignedAt?: string;
  
  // Messages/Notes
  welcomeMessage?: string;
  importantNotice?: string;
  notes?: string;
}

// =============================================================================
// DESIGN CONSTANTS - Nivra branded (inspired by Rogers clean layout)
// =============================================================================

const COLORS = {
  // Nivra brand colors
  primary: [15, 23, 42] as [number, number, number],      // Navy
  accent: [20, 184, 166] as [number, number, number],     // Teal
  accentDark: [13, 148, 136] as [number, number, number], // Darker teal
  
  // Text colors
  textDark: [30, 41, 59] as [number, number, number],
  textMuted: [100, 116, 139] as [number, number, number],
  textLight: [148, 163, 184] as [number, number, number],
  
  // UI colors
  white: [255, 255, 255] as [number, number, number],
  bgLight: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  borderDark: [203, 213, 225] as [number, number, number],
  
  // Status colors
  success: [34, 197, 94] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
  error: [239, 68, 68] as [number, number, number],
};

const LAYOUT = {
  pageWidth: 210,
  pageHeight: 297,
  marginLeft: 15,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 20,
  contentWidth: 180, // 210 - 15 - 15
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("fr-CA", { 
    style: "currency", 
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

const formatDateLong = (dateStr: string): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

// =============================================================================
// MAIN GENERATOR
// =============================================================================

export function generateInvoiceV2PDF(data: InvoiceV2Data): jsPDF {
  const doc = new jsPDF();
  const { marginLeft, marginRight, contentWidth } = LAYOUT;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  let currentY = LAYOUT.marginTop;
  let pageNumber = 1;
  const totalPages = 1; // Will calculate later if multi-page

  // ==========================================================================
  // HEADER BAR - Rogers-style horizontal info bar
  // ==========================================================================
  
  // Top accent line
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageWidth, 3, "F");
  
  // Header info bar background
  doc.setFillColor(...COLORS.bgLight);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.rect(0, 3, pageWidth, 18, "FD");
  
  // Header info - left side labels
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  
  const headerY = 10;
  const headerY2 = 16;
  
  // Column 1: Account number
  doc.text("Numéro de compte", marginLeft, headerY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text(data.accountNumber || "—", marginLeft, headerY2);
  
  // Column 2: Invoice number
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Numéro de facture", marginLeft + 40, headerY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text(data.invoiceNumber || "—", marginLeft + 40, headerY2);
  
  // Column 3: Bank payment number (if applicable)
  if (data.paymentBankNumber) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textMuted);
    doc.text("Nº paiement Interac", marginLeft + 75, headerY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.textDark);
    doc.text(data.paymentBankNumber, marginLeft + 75, headerY2);
  }
  
  // Column 4: Billing date
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Date de facturation", marginLeft + 115, headerY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text(formatDate(data.billingDate), marginLeft + 115, headerY2);
  
  // Column 5: Page + Logo
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Page", marginLeft + 150, headerY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text(`${pageNumber} de ${totalPages}`, marginLeft + 150, headerY2);
  
  // NIVRA Logo (text version - could be replaced with image)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.accent);
  doc.text("NIVRA", pageWidth - marginRight - 5, 13, { align: "right" });
  
  currentY = 28;

  // ==========================================================================
  // WELCOME MESSAGE - Personalized greeting like Rogers
  // ==========================================================================
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  
  const firstName = data.clientName.split(" ")[0];
  const welcomeText = data.welcomeMessage || `Bonjour ${data.clientName.toUpperCase()}, voici votre facture Nivra.`;
  doc.text(welcomeText, marginLeft, currentY);
  
  currentY += 6;
  
  // Subtitle explanation
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Vous trouverez le détail des frais et crédits (le cas échéant) aux sections suivantes.", marginLeft, currentY);
  
  currentY += 10;

  // ==========================================================================
  // TWO-COLUMN LAYOUT: Total Summary (left) | Account Summary (right)
  // ==========================================================================
  
  const leftColWidth = 85;
  const rightColWidth = 85;
  const gutter = 10;
  const boxStartY = currentY;
  
  // ---------- LEFT COLUMN: "Quels sont les frais totaux?" ----------
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, boxStartY, leftColWidth, 50, 2, 2, "FD");
  
  // Left accent bar
  doc.setFillColor(...COLORS.accent);
  doc.rect(marginLeft, boxStartY, 3, 50, "F");
  
  // Title
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text("Quels sont les frais totaux?", marginLeft + 8, boxStartY + 8);
  
  // Total amount - large
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(formatCurrency(data.total), marginLeft + 8, boxStartY + 22);
  
  // Payment status indicator
  if (data.isPaid) {
    doc.setFillColor(...COLORS.success);
    doc.roundedRect(marginLeft + 8, boxStartY + 28, 25, 6, 1, 1, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.white);
    doc.text("PAYÉ", marginLeft + 12, boxStartY + 32);
  } else {
    // Due date
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`Date d'exigibilité : ${formatDateLong(data.dueDate)}`, marginLeft + 8, boxStartY + 32);
  }
  
  // Savings indicator (if discounts)
  const totalDiscounts = (data.discounts || []).reduce((sum, d) => sum + d.amount, 0) + (data.credits || 0);
  if (totalDiscounts > 0) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.success);
    doc.text(`✓ Vous avez économisé ${formatCurrency(totalDiscounts)} sur cette facture`, marginLeft + 8, boxStartY + 44);
  }
  
  // ---------- RIGHT COLUMN: "Que comprend mon total?" ----------
  const rightColX = marginLeft + leftColWidth + gutter;
  
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(rightColX, boxStartY, rightColWidth, 50, 2, 2, "FD");
  
  // Title
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text("Que comprend mon total?", rightColX + 5, boxStartY + 8);
  
  // Account summary table header
  doc.setFillColor(...COLORS.bgLight);
  doc.rect(rightColX + 2, boxStartY + 11, rightColWidth - 4, 6, "F");
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Sommaire du compte", rightColX + 5, boxStartY + 15);
  doc.text("$", rightColX + rightColWidth - 10, boxStartY + 15, { align: "right" });
  
  // Summary rows
  let summaryY = boxStartY + 21;
  const rowHeight = 5;
  
  const addSummaryRow = (label: string, amount: number, isBold = false, isTotal = false) => {
    doc.setFontSize(6);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(...(isTotal ? COLORS.primary : COLORS.textDark));
    doc.text(label, rightColX + 5, summaryY);
    doc.text(formatCurrency(amount), rightColX + rightColWidth - 10, summaryY, { align: "right" });
    
    if (isTotal) {
      // Underline for total
      doc.setDrawColor(...COLORS.accent);
      doc.setLineWidth(0.5);
      doc.line(rightColX + 5, summaryY + 1, rightColX + rightColWidth - 5, summaryY + 1);
    }
    
    summaryY += rowHeight;
  };
  
  // Previous balance
  if (data.previousBalance !== undefined && data.previousBalance !== 0) {
    addSummaryRow("Solde facture précédente", data.previousBalance);
  }
  if (data.carriedBalance !== undefined && data.carriedBalance !== 0) {
    addSummaryRow("Solde reporté", data.carriedBalance);
  }
  
  // Current charges (by service type)
  const serviceTypes = [...new Set(data.services.map(s => s.type))];
  for (const type of serviceTypes) {
    const typeServices = data.services.filter(s => s.type === type);
    const typeTotal = typeServices.reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);
    const typeLabel = type === "Mobile" ? "Sans-fil" : type;
    addSummaryRow(typeLabel, typeTotal);
  }
  
  // Total row with taxes breakdown
  doc.setDrawColor(...COLORS.border);
  doc.line(rightColX + 5, summaryY - 1, rightColX + rightColWidth - 5, summaryY - 1);
  summaryY += 2;
  
  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Total (Inclut ${formatCurrency(data.tps)} TPS et ${formatCurrency(data.tvq)} TVQ)`, rightColX + 5, summaryY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text(formatCurrency(data.total), rightColX + rightColWidth - 10, summaryY, { align: "right" });
  
  currentY = boxStartY + 58;

  // ==========================================================================
  // IMPORTANT NOTICE BOX (if applicable)
  // ==========================================================================
  
  if (data.importantNotice) {
    doc.setFillColor(...COLORS.bgLight);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(marginLeft, currentY, contentWidth, 15, 2, 2, "FD");
    
    // Warning icon
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("ℹ️", marginLeft + 5, currentY + 9);
    
    // Notice text
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textDark);
    const noticeLines = doc.splitTextToSize(data.importantNotice, contentWidth - 20);
    doc.text(noticeLines, marginLeft + 15, currentY + 6);
    
    currentY += 20;
  }

  // ==========================================================================
  // PAYMENT SLIP / TALON DE PAIEMENT (bottom section)
  // ==========================================================================
  
  // Dashed separator line
  doc.setDrawColor(...COLORS.textMuted);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
  doc.setLineDashPattern([], 0); // Reset
  
  currentY += 8;
  
  // Payment info left side
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.accent);
  doc.text("NIVRA", marginLeft, currentY);
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textDark);
  doc.text("Merci!", marginLeft, currentY + 6);
  
  // Payment instructions
  const paymentInstructions = data.isPaid 
    ? "Votre compte a été réglé. Merci!"
    : "Paiement par virement Interac à support@nivra-telecom.ca";
  
  doc.setFont("helvetica", "bold");
  doc.text(paymentInstructions, marginLeft, currentY + 12);
  
  if (!data.isPaid) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textMuted);
    doc.text("Vous n'avez pas besoin d'envoyer ce coupon si vous payez en ligne.", marginLeft, currentY + 18);
  }
  
  // Right side - payment summary box
  const paymentBoxX = pageWidth - marginRight - 60;
  doc.setFillColor(...COLORS.bgLight);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(paymentBoxX, currentY - 4, 60, 28, 2, 2, "FD");
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Votre numéro de compte :", paymentBoxX + 3, currentY + 2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text(data.accountNumber, paymentBoxX + 40, currentY + 2);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Total dû :", paymentBoxX + 3, currentY + 10);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(formatCurrency(data.total), paymentBoxX + 40, currentY + 11);
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text("Date d'exigibilité :", paymentBoxX + 3, currentY + 18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text(formatDate(data.dueDate), paymentBoxX + 40, currentY + 18);
  
  currentY += 32;
  
  // Client address block
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(marginLeft + 40, currentY, 70, 20, 1, 1, "FD");
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.textDark);
  doc.text(data.clientName.toUpperCase(), marginLeft + 43, currentY + 6);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientAddress, marginLeft + 43, currentY + 11);
  doc.text(`${data.clientCity} ${data.clientProvince} ${data.clientPostalCode}`, marginLeft + 43, currentY + 16);
  
  currentY += 28;

  // ==========================================================================
  // PAGE 2+ : SERVICE DETAILS (if needed)
  // ==========================================================================
  
  // For now, add a simple services table on the same page if space allows
  if (currentY < pageHeight - 80) {
    currentY += 5;
    
    // Section title
    doc.setFillColor(...COLORS.primary);
    doc.rect(marginLeft, currentY, contentWidth, 7, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.white);
    doc.text("DÉTAIL DES SERVICES", marginLeft + 3, currentY + 5);
    
    currentY += 12;
    
    // Table header
    doc.setFillColor(...COLORS.bgLight);
    doc.rect(marginLeft, currentY, contentWidth, 6, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.textMuted);
    doc.text("TYPE", marginLeft + 3, currentY + 4);
    doc.text("SERVICE / FORFAIT", marginLeft + 25, currentY + 4);
    doc.text("QTÉ", marginLeft + 120, currentY + 4);
    doc.text("PRIX UNIT.", marginLeft + 135, currentY + 4);
    doc.text("PÉRIODE", marginLeft + 160, currentY + 4);
    
    currentY += 8;
    
    // Service rows
    data.services.forEach((service, index) => {
      // Alternating row background
      if (index % 2 === 0) {
        doc.setFillColor(...COLORS.bgLight);
        doc.rect(marginLeft, currentY - 3, contentWidth, 6, "F");
      }
      
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textDark);
      
      doc.text(service.type, marginLeft + 3, currentY);
      doc.text(service.name.substring(0, 50), marginLeft + 25, currentY);
      doc.text(String(service.quantity || 1), marginLeft + 120, currentY);
      doc.text(formatCurrency(service.monthlyPrice), marginLeft + 135, currentY);
      doc.text(service.period || "/mois", marginLeft + 160, currentY);
      
      currentY += 6;
    });
    
    // Subtotals
    currentY += 4;
    doc.setDrawColor(...COLORS.border);
    doc.line(marginLeft + 100, currentY, pageWidth - marginRight, currentY);
    currentY += 4;
    
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textMuted);
    doc.text("Sous-total mensuel", marginLeft + 100, currentY);
    doc.setTextColor(...COLORS.textDark);
    doc.text(formatCurrency(data.subtotal), marginLeft + 160, currentY);
    
    currentY += 5;
    doc.setTextColor(...COLORS.textMuted);
    doc.text("TPS (5%)", marginLeft + 100, currentY);
    doc.setTextColor(...COLORS.textDark);
    doc.text(formatCurrency(data.tps), marginLeft + 160, currentY);
    
    currentY += 5;
    doc.setTextColor(...COLORS.textMuted);
    doc.text("TVQ (9.975%)", marginLeft + 100, currentY);
    doc.setTextColor(...COLORS.textDark);
    doc.text(formatCurrency(data.tvq), marginLeft + 160, currentY);
    
    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("TOTAL", marginLeft + 100, currentY);
    doc.setFontSize(8);
    doc.text(formatCurrency(data.total), marginLeft + 160, currentY);
  }

  // ==========================================================================
  // SIGNATURE SECTION (if signatures provided)
  // ==========================================================================
  
  if (data.clientSignature || data.agentSignature) {
    currentY = Math.max(currentY + 15, pageHeight - 60);
    
    doc.setDrawColor(...COLORS.border);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 8;
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("SIGNATURES", marginLeft, currentY);
    currentY += 8;
    
    const sigBoxWidth = (contentWidth - 20) / 2;
    const sigBoxHeight = 25;
    
    // Client signature box
    doc.setFillColor(...COLORS.bgLight);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(marginLeft, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "FD");
    
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.textMuted);
    doc.text("Signature Client", marginLeft + 3, currentY + 5);
    
    if (data.clientSignature) {
      if (data.clientSignatureType === "canvas") {
        // Add signature image
        try {
          doc.addImage(data.clientSignature, "PNG", marginLeft + 3, currentY + 8, sigBoxWidth - 6, 12);
        } catch (e) {
          // Fallback to text if image fails
          doc.setFont("helvetica", "italic");
          doc.setTextColor(...COLORS.textDark);
          doc.text("[Signature numérique]", marginLeft + 3, currentY + 15);
        }
      } else {
        // Text signature
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.textDark);
        doc.text(data.clientSignature, marginLeft + 3, currentY + 15);
      }
      
      if (data.clientSignedAt) {
        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textMuted);
        doc.text(`Signé le ${formatDateLong(data.clientSignedAt)}`, marginLeft + 3, currentY + 22);
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textLight);
      doc.text("_______________________________", marginLeft + 3, currentY + 15);
      doc.text("Date: ___/___/______", marginLeft + 3, currentY + 22);
    }
    
    // Agent/Nivra signature box
    const agentBoxX = marginLeft + sigBoxWidth + 20;
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(agentBoxX, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");
    
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.white);
    doc.text("Signature Nivra", agentBoxX + 3, currentY + 5);
    
    if (data.agentSignature) {
      if (data.agentSignature.startsWith("data:")) {
        try {
          doc.addImage(data.agentSignature, "PNG", agentBoxX + 3, currentY + 8, sigBoxWidth - 6, 12);
        } catch (e) {
          doc.setFont("helvetica", "italic");
          doc.text(data.agentName || "[Signature]", agentBoxX + 3, currentY + 15);
        }
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text(data.agentSignature, agentBoxX + 3, currentY + 15);
      }
      
      if (data.agentSignedAt) {
        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text(`Signé le ${formatDateLong(data.agentSignedAt)}`, agentBoxX + 3, currentY + 22);
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.accent);
      doc.text("_______________________________", agentBoxX + 3, currentY + 15);
      doc.text("Date: ___/___/______", agentBoxX + 3, currentY + 22);
    }
  }

  // ==========================================================================
  // FOOTER - Company info (always at bottom)
  // ==========================================================================
  
  const footerY = pageHeight - 15;
  
  doc.setDrawColor(...COLORS.border);
  doc.line(marginLeft, footerY - 5, pageWidth - marginRight, footerY - 5);
  
  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textMuted);
  doc.text(
    `${COMPANY_CONTACT.legalName} — ${COMPANY_CONTACT.fullAddress}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );
  doc.text(
    `${COMPANY_CONTACT.supportEmailDisplay} — nivra-telecom.ca`,
    pageWidth / 2,
    footerY + 4,
    { align: "center" }
  );
  
  // Page number
  doc.setFont("helvetica", "bold");
  doc.text(`Page ${pageNumber}`, pageWidth - marginRight, footerY + 2, { align: "right" });

  return doc;
}

/**
 * Generate and download the invoice PDF
 */
export function downloadInvoiceV2PDF(data: InvoiceV2Data): void {
  const doc = generateInvoiceV2PDF(data);
  const fileName = `Facture_${data.invoiceNumber}_${data.clientName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

export default generateInvoiceV2PDF;
