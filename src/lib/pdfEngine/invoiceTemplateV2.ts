/**
 * Nivra Invoice Template V2 - PROFESSIONAL MULTI-PAGE INVOICE
 * Inspired by Rogers invoice layout with clean tables, clear totals, and proper signatures
 * 
 * Structure:
 * - Page 1: Summary page (account overview, total due, payment slip)
 * - Page 2+: Detailed breakdown by service category
 * - Payment history and notes (if applicable)
 * 
 * Features:
 * - Multi-page support for long service lists
 * - Rogers-style horizontal header bar
 * - Two-column summary layout
 * - Detailed itemized breakdown
 * - Payment slip at bottom
 * - Visible signature fields
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
  period?: string;
  detailsPage?: number;
}

export interface InvoiceV2Data {
  // Document identifiers
  invoiceNumber: string;
  accountNumber: string;
  paymentBankNumber?: string;
  billingDate: string;
  dueDate: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  
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
  oneTimeFees?: { label: string; amount: number; description?: string }[];
  
  // Discounts/Credits
  discounts?: { label: string; amount: number; description?: string }[];
  credits?: number;
  
  // Calculated totals
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
  
  // Payment status
  isPaid?: boolean;
  paidAt?: string;
  paymentMethod?: "etransfer" | "card" | "cash";
  paymentReference?: string;
  
  // Signatures
  clientSignature?: string;
  clientSignatureType?: "canvas" | "text";
  clientSignedAt?: string;
  agentSignature?: string;
  agentName?: string;
  agentSignedAt?: string;
  
  // Messages
  welcomeMessage?: string;
  importantNotice?: string;
  notes?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLORS = {
  primary: [15, 23, 42] as [number, number, number],        // Navy
  primaryLight: [30, 58, 138] as [number, number, number],  // Lighter navy
  accent: [20, 184, 166] as [number, number, number],       // Teal
  accentDark: [13, 148, 136] as [number, number, number],
  
  text: [30, 41, 59] as [number, number, number],
  textMuted: [100, 116, 139] as [number, number, number],
  textLight: [148, 163, 184] as [number, number, number],
  
  white: [255, 255, 255] as [number, number, number],
  bgLight: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  borderDark: [203, 213, 225] as [number, number, number],
  
  success: [34, 197, 94] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
  error: [239, 68, 68] as [number, number, number],
};

const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 15,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 25,
  get contentWidth() { return this.width - this.marginLeft - this.marginRight; },
  get safeBottom() { return this.height - this.marginBottom; },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-CA", { 
    style: "currency", 
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatDateLong(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// PDF BUILDER CLASS
// =============================================================================

class InvoicePDFBuilder {
  private doc: jsPDF;
  private y: number;
  private pageNum: number;
  private data: InvoiceV2Data;
  
  constructor(data: InvoiceV2Data) {
    this.doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    this.data = data;
    this.y = PAGE.marginTop;
    this.pageNum = 1;
    
    // White background
    this.doc.setFillColor(...COLORS.white);
    this.doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  }
  
  private checkPageBreak(neededSpace: number): void {
    if (this.y + neededSpace > PAGE.safeBottom) {
      this.addNewPage();
    }
  }
  
  private addNewPage(): void {
    this.doc.addPage();
    this.pageNum++;
    
    // White background
    this.doc.setFillColor(...COLORS.white);
    this.doc.rect(0, 0, PAGE.width, PAGE.height, "F");
    
    // Top accent
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(0, 0, PAGE.width, 2, "F");
    
    // Continuation header
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(`FACTURE — ${this.data.invoiceNumber}`, PAGE.marginLeft, 10);
    this.doc.text(`Page ${this.pageNum}`, PAGE.width - PAGE.marginRight, 10, { align: "right" });
    
    this.y = 18;
  }
  
  private addFooters(): void {
    const totalPages = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      
      const footerY = PAGE.height - 12;
      
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(PAGE.marginLeft, footerY - 3, PAGE.width - PAGE.marginRight, footerY - 3);
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(6);
      this.doc.setTextColor(...COLORS.textMuted);
      
      this.doc.text(
        `${COMPANY_CONTACT.legalName} — ${COMPANY_CONTACT.fullAddress}`,
        PAGE.width / 2,
        footerY,
        { align: "center" }
      );
      this.doc.text(
        `${COMPANY_CONTACT.supportEmailDisplay} — nivra-telecom.ca`,
        PAGE.width / 2,
        footerY + 4,
        { align: "center" }
      );
      
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${i} / ${totalPages}`, PAGE.width - PAGE.marginRight, footerY + 2, { align: "right" });
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1: SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildPage1Summary(): void {
    const { data } = this;
    
    // === TOP ACCENT ===
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(0, 0, PAGE.width, 3, "F");
    
    // === HEADER INFO BAR ===
    this.doc.setFillColor(...COLORS.bgLight);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.rect(0, 3, PAGE.width, 18, "FD");
    
    const headerY = 10;
    const headerY2 = 16;
    
    this.doc.setFontSize(6);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    
    // Column 1
    this.doc.text("Numéro de compte", PAGE.marginLeft, headerY);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.accountNumber || "—", PAGE.marginLeft, headerY2);
    
    // Column 2
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Numéro de facture", PAGE.marginLeft + 40, headerY);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.invoiceNumber || "—", PAGE.marginLeft + 40, headerY2);
    
    // Column 3
    if (data.paymentBankNumber) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("Nº paiement Interac", PAGE.marginLeft + 80, headerY);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(data.paymentBankNumber, PAGE.marginLeft + 80, headerY2);
    }
    
    // Column 4
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Date de facturation", PAGE.marginLeft + 120, headerY);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(formatDate(data.billingDate), PAGE.marginLeft + 120, headerY2);
    
    // Page + Logo
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Page", PAGE.marginLeft + 155, headerY);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`1`, PAGE.marginLeft + 155, headerY2);
    
    // NIVRA Logo
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.accent);
    this.doc.text("NIVRA", PAGE.width - PAGE.marginRight - 5, 14, { align: "right" });
    
    this.y = 28;
    
    // === WELCOME MESSAGE ===
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    
    const welcomeText = data.welcomeMessage || `Bonjour ${data.clientName.toUpperCase()}, voici votre facture Nivra.`;
    this.doc.text(welcomeText, PAGE.marginLeft, this.y);
    
    this.y += 6;
    
    // Billing period
    if (data.billingPeriodStart && data.billingPeriodEnd) {
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text(
        `Période de facturation: ${formatDate(data.billingPeriodStart)} au ${formatDate(data.billingPeriodEnd)}`,
        PAGE.marginLeft,
        this.y
      );
      this.y += 5;
    }
    
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Vous trouverez le détail des frais et crédits (le cas échéant) aux pages suivantes.", PAGE.marginLeft, this.y);
    
    this.y += 10;
    
    // === TWO-COLUMN SUMMARY ===
    const leftColW = 85;
    const rightColW = 85;
    const gutter = 10;
    const boxStartY = this.y;
    
    // LEFT: Total Summary
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, boxStartY, leftColW, 55, 2, 2, "FD");
    
    // Accent bar
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(PAGE.marginLeft, boxStartY, 3, 55, "F");
    
    // Title
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("Quels sont les frais totaux?", PAGE.marginLeft + 8, boxStartY + 8);
    
    // Total amount
    this.doc.setFontSize(22);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text(formatCurrency(data.total), PAGE.marginLeft + 8, boxStartY + 24);
    
    // Payment status
    if (data.isPaid) {
      this.doc.setFillColor(...COLORS.success);
      this.doc.roundedRect(PAGE.marginLeft + 8, boxStartY + 30, 22, 6, 1, 1, "F");
      this.doc.setFontSize(6);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("PAYÉ", PAGE.marginLeft + 12, boxStartY + 34);
      
      if (data.paidAt) {
        this.doc.setFontSize(7);
        this.doc.setFont("helvetica", "normal");
        this.doc.setTextColor(...COLORS.textMuted);
        this.doc.text(`Payé le: ${formatDate(data.paidAt)}`, PAGE.marginLeft + 8, boxStartY + 42);
      }
    } else {
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text(`Date d'exigibilité: ${formatDateLong(data.dueDate)}`, PAGE.marginLeft + 8, boxStartY + 34);
    }
    
    // Savings
    const totalDiscounts = (data.discounts || []).reduce((sum, d) => sum + d.amount, 0) + (data.credits || 0);
    if (totalDiscounts > 0) {
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(...COLORS.success);
      this.doc.text(`✓ Économisé: ${formatCurrency(totalDiscounts)}`, PAGE.marginLeft + 8, boxStartY + 50);
    }
    
    // RIGHT: Account Summary
    const rightX = PAGE.marginLeft + leftColW + gutter;
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(rightX, boxStartY, rightColW, 55, 2, 2, "FD");
    
    // Title
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("Sommaire du compte", rightX + 5, boxStartY + 8);
    
    // Summary table header
    this.doc.setFillColor(...COLORS.bgLight);
    this.doc.rect(rightX + 2, boxStartY + 11, rightColW - 4, 6, "F");
    this.doc.setFontSize(6);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Description", rightX + 5, boxStartY + 15);
    this.doc.text("Montant", rightX + rightColW - 10, boxStartY + 15, { align: "right" });
    
    let summaryY = boxStartY + 22;
    const addSummaryRow = (label: string, amount: number, isBold = false) => {
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", isBold ? "bold" : "normal");
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(label, rightX + 5, summaryY);
      this.doc.text(formatCurrency(amount), rightX + rightColW - 10, summaryY, { align: "right" });
      summaryY += 5;
    };
    
    // Previous balance
    if (data.previousBalance !== undefined && data.previousBalance !== 0) {
      addSummaryRow("Solde précédent", data.previousBalance);
    }
    
    // Service totals by type
    const serviceTypes = [...new Set(data.services.map(s => s.type))];
    serviceTypes.forEach(type => {
      const typeTotal = data.services
        .filter(s => s.type === type)
        .reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);
      const label = type === "Mobile" ? "Sans-fil" : type;
      addSummaryRow(label, typeTotal);
    });
    
    // One-time fees total
    if (data.oneTimeFees && data.oneTimeFees.length > 0) {
      const onetimeTotal = data.oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
      addSummaryRow("Frais uniques", onetimeTotal);
    }
    
    // Discounts
    if (data.discounts && data.discounts.length > 0) {
      const discTotal = data.discounts.reduce((sum, d) => sum + d.amount, 0);
      this.doc.setTextColor(...COLORS.success);
      addSummaryRow("Rabais", -discTotal);
      this.doc.setTextColor(...COLORS.text);
    }
    
    // Separator + Total
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(rightX + 5, summaryY - 2, rightX + rightColW - 5, summaryY - 2);
    summaryY += 2;
    
    this.doc.setFontSize(6);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(`TPS: ${formatCurrency(data.tps)} | TVQ: ${formatCurrency(data.tvq)}`, rightX + 5, summaryY);
    summaryY += 4;
    
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("TOTAL À PAYER", rightX + 5, summaryY);
    this.doc.text(formatCurrency(data.total), rightX + rightColW - 10, summaryY, { align: "right" });
    
    this.y = boxStartY + 62;
    
    // === IMPORTANT NOTICE ===
    if (data.importantNotice) {
      this.doc.setFillColor(...COLORS.bgLight);
      this.doc.setDrawColor(...COLORS.border);
      this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 15, 2, 2, "FD");
      
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(...COLORS.primary);
      this.doc.text("ℹ️ Avis", PAGE.marginLeft + 5, this.y + 6);
      
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(...COLORS.text);
      const noticeLines = this.doc.splitTextToSize(data.importantNotice, PAGE.contentWidth - 20);
      this.doc.text(noticeLines, PAGE.marginLeft + 18, this.y + 6);
      
      this.y += 20;
    }
    
    // === PAYMENT SLIP ===
    this.y += 5;
    
    // Dashed separator
    this.doc.setDrawColor(...COLORS.textMuted);
    this.doc.setLineDashPattern([2, 2], 0);
    this.doc.line(PAGE.marginLeft, this.y, PAGE.width - PAGE.marginRight, this.y);
    this.doc.setLineDashPattern([], 0);
    
    this.y += 8;
    
    // Payment instructions
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.accent);
    this.doc.text("TALON DE PAIEMENT", PAGE.marginLeft, this.y);
    
    this.y += 6;
    
    const paymentInstructions = data.isPaid 
      ? "✓ Votre compte a été réglé. Merci!"
      : `Paiement par virement Interac à: ${COMPANY_CONTACT.supportEmailDisplay}`;
    
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(paymentInstructions, PAGE.marginLeft, this.y);
    
    this.y += 5;
    
    if (!data.isPaid) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("Utilisez votre numéro de compte comme référence. Le cycle démarre après confirmation du paiement.", PAGE.marginLeft, this.y);
    }
    
    // Payment summary box (right)
    const payBoxX = PAGE.width - PAGE.marginRight - 65;
    this.doc.setFillColor(...COLORS.bgLight);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(payBoxX, this.y - 10, 65, 28, 2, 2, "FD");
    
    this.doc.setFontSize(6);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Compte:", payBoxX + 3, this.y - 5);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.accountNumber, payBoxX + 22, this.y - 5);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Total dû:", payBoxX + 3, this.y + 2);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text(formatCurrency(data.total), payBoxX + 22, this.y + 3);
    
    this.doc.setFontSize(6);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Échéance:", payBoxX + 3, this.y + 12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(formatDate(data.dueDate), payBoxX + 22, this.y + 12);
    
    this.y += 25;
    
    // Client address block
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft + 40, this.y, 70, 22, 1, 1, "FD");
    
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.clientName, PAGE.marginLeft + 45, this.y + 6);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.text(data.clientAddress, PAGE.marginLeft + 45, this.y + 11);
    this.doc.text(`${data.clientCity}, ${data.clientProvince} ${data.clientPostalCode}`, PAGE.marginLeft + 45, this.y + 16);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 2+: DETAILED BREAKDOWN
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildDetailedBreakdown(): void {
    this.addNewPage();
    
    const { data } = this;
    
    // === HEADER ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("DÉTAIL DE LA FACTURE", PAGE.marginLeft, this.y);
    
    this.y += 8;
    
    // Group services by type
    const servicesByType = data.services.reduce((acc, s) => {
      if (!acc[s.type]) acc[s.type] = [];
      acc[s.type].push(s);
      return acc;
    }, {} as Record<string, InvoiceV2ServiceItem[]>);
    
    // Render each service category
    Object.entries(servicesByType).forEach(([type, services]) => {
      this.checkPageBreak(30);
      
      // Category header
      this.doc.setFillColor(...COLORS.primary);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 8, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.white);
      
      const typeLabel = type === "Mobile" ? "SERVICES SANS-FIL" : `SERVICES ${type.toUpperCase()}`;
      this.doc.text(typeLabel, PAGE.marginLeft + 5, this.y + 5.5);
      
      const typeTotal = services.reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);
      this.doc.text(formatCurrency(typeTotal), PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
      
      this.y += 10;
      
      // Services table
      services.forEach((service, idx) => {
        this.checkPageBreak(15);
        
        const rowH = 12;
        
        if (idx % 2 === 0) {
          this.doc.setFillColor(...COLORS.bgLight);
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        // Service name
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(9);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(service.name, PAGE.marginLeft + 5, this.y + 5);
        
        // Description
        if (service.description) {
          this.doc.setFont("helvetica", "normal");
          this.doc.setFontSize(7);
          this.doc.setTextColor(...COLORS.textMuted);
          const desc = service.description.length > 60 ? service.description.substring(0, 57) + "..." : service.description;
          this.doc.text(desc, PAGE.marginLeft + 5, this.y + 10);
        }
        
        // Quantity
        if (service.quantity && service.quantity > 1) {
          this.doc.setFontSize(7);
          this.doc.setTextColor(...COLORS.textMuted);
          this.doc.text(`x${service.quantity}`, PAGE.marginLeft + 130, this.y + 5);
        }
        
        // Price
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(9);
        this.doc.setTextColor(...COLORS.text);
        const price = service.monthlyPrice * (service.quantity || 1);
        this.doc.text(formatCurrency(price), PAGE.width - PAGE.marginRight - 5, this.y + 5, { align: "right" });
        
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(6);
        this.doc.setTextColor(...COLORS.textMuted);
        this.doc.text(service.period || "/mois", PAGE.width - PAGE.marginRight - 5, this.y + 10, { align: "right" });
        
        // Border
        this.doc.setDrawColor(...COLORS.border);
        this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
        
        this.y += rowH;
      });
      
      this.y += 8;
    });
    
    // === ONE-TIME FEES ===
    if (data.oneTimeFees && data.oneTimeFees.length > 0) {
      this.checkPageBreak(25);
      
      this.doc.setFillColor(...COLORS.warning);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 8, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("FRAIS UNIQUES", PAGE.marginLeft + 5, this.y + 5.5);
      
      const onetimeTotal = data.oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
      this.doc.text(formatCurrency(onetimeTotal), PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
      
      this.y += 10;
      
      data.oneTimeFees.forEach((fee, idx) => {
        const rowH = 8;
        
        if (idx % 2 === 0) {
          this.doc.setFillColor(...COLORS.bgLight);
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(fee.label, PAGE.marginLeft + 5, this.y + 5);
        
        if (fee.description) {
          this.doc.setFontSize(6);
          this.doc.setTextColor(...COLORS.textMuted);
          this.doc.text(fee.description, PAGE.marginLeft + 80, this.y + 5);
        }
        
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(formatCurrency(fee.amount), PAGE.width - PAGE.marginRight - 5, this.y + 5, { align: "right" });
        
        this.doc.setDrawColor(...COLORS.border);
        this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
        
        this.y += rowH;
      });
      
      this.y += 8;
    }
    
    // === DISCOUNTS ===
    if (data.discounts && data.discounts.length > 0) {
      this.checkPageBreak(25);
      
      this.doc.setFillColor(...COLORS.success);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 8, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("RABAIS ET CRÉDITS", PAGE.marginLeft + 5, this.y + 5.5);
      
      const discTotal = data.discounts.reduce((sum, d) => sum + d.amount, 0);
      this.doc.text(`-${formatCurrency(discTotal)}`, PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
      
      this.y += 10;
      
      data.discounts.forEach((disc, idx) => {
        const rowH = 8;
        
        if (idx % 2 === 0) {
          this.doc.setFillColor(...COLORS.bgLight);
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.success);
        this.doc.text(disc.label, PAGE.marginLeft + 5, this.y + 5);
        
        this.doc.setFont("helvetica", "bold");
        this.doc.text(`-${formatCurrency(disc.amount)}`, PAGE.width - PAGE.marginRight - 5, this.y + 5, { align: "right" });
        
        this.doc.setDrawColor(...COLORS.border);
        this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
        
        this.y += rowH;
      });
      
      this.y += 8;
    }
    
    // === TAXES & GRAND TOTAL ===
    this.checkPageBreak(35);
    
    this.y += 5;
    
    const totalsX = PAGE.width - PAGE.marginRight - 80;
    
    this.doc.setFillColor(...COLORS.bgLight);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(totalsX, this.y, 80, 35, 2, 2, "FD");
    
    let tY = this.y + 7;
    
    // Subtotal
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Sous-total", totalsX + 5, tY);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(formatCurrency(data.subtotal), totalsX + 75, tY, { align: "right" });
    tY += 6;
    
    // TPS
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("TPS (5%)", totalsX + 5, tY);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(formatCurrency(data.tps), totalsX + 75, tY, { align: "right" });
    tY += 6;
    
    // TVQ
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("TVQ (9.975%)", totalsX + 5, tY);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(formatCurrency(data.tvq), totalsX + 75, tY, { align: "right" });
    tY += 4;
    
    // Separator
    this.doc.setDrawColor(...COLORS.accent);
    this.doc.line(totalsX + 5, tY, totalsX + 75, tY);
    tY += 5;
    
    // Grand total
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("TOTAL", totalsX + 5, tY);
    this.doc.setFontSize(12);
    this.doc.text(formatCurrency(data.total), totalsX + 75, tY, { align: "right" });
    
    this.y += 45;
    
    // === NOTES ===
    if (data.notes) {
      this.checkPageBreak(25);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.primary);
      this.doc.text("NOTES", PAGE.marginLeft, this.y);
      
      this.y += 5;
      
      this.doc.setFillColor(...COLORS.bgLight);
      this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 20, 2, 2, "F");
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.text);
      const noteLines = this.doc.splitTextToSize(data.notes, PAGE.contentWidth - 10);
      this.doc.text(noteLines, PAGE.marginLeft + 5, this.y + 6);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────
  
  public build(): jsPDF {
    // Page 1: Summary
    this.buildPage1Summary();
    
    // Page 2+: Detailed breakdown
    this.buildDetailedBreakdown();
    
    // Add footers
    this.addFooters();
    
    return this.doc;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export function generateInvoiceV2PDF(data: InvoiceV2Data): jsPDF {
  const builder = new InvoicePDFBuilder(data);
  return builder.build();
}

export function downloadInvoiceV2PDF(data: InvoiceV2Data): void {
  const doc = generateInvoiceV2PDF(data);
  const fileName = `Facture_${data.invoiceNumber}_${data.clientName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

export default generateInvoiceV2PDF;
