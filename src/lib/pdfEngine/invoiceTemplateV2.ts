/**
 * Nivra Invoice Template V2 - PROFESSIONAL MULTI-PAGE INVOICE
 * Enterprise-grade telecom invoice (Rogers-style)
 * 
 * Structure (4+ pages):
 * - Page 1: Summary page with total, account overview, payment instructions
 * - Page 2: Detailed breakdown by service category
 * - Page 3: Taxes, adjustments, payment history
 * - Page 4: Terms reminder, payment slip, signature (if applicable)
 * 
 * Features:
 * - Rogers-style horizontal header bar
 * - Two-column summary layout
 * - Detailed itemized breakdown by category
 * - Payment slip with tear-off section
 * - Multi-page support for long invoices
 * - Previous balance and payment history
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
  usageDetails?: { label: string; value: string }[];
}

export interface InvoiceV2PaymentRecord {
  date: string;
  method: string;
  reference?: string;
  amount: number;
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
  billingCycleDay?: number;
  
  // Client info
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress: string;
  clientCity: string;
  clientProvince: string;
  clientPostalCode: string;
  
  // Balance info
  previousBalance?: number;
  previousPayments?: InvoiceV2PaymentRecord[];
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
  paymentMethod?: "etransfer" | "card" | "cash" | "paypal";
  paymentReference?: string;
  amountPaid?: number;
  balanceDue?: number;
  
  // Signatures (for receipts)
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
  
  // Store credit
  storeCredit?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLORS = {
  primary: [15, 23, 42] as [number, number, number],        // Slate 900
  primaryLight: [30, 58, 138] as [number, number, number],  // Blue 800
  accent: [20, 184, 166] as [number, number, number],       // Teal 500
  accentDark: [13, 148, 136] as [number, number, number],   // Teal 600
  
  text: [30, 41, 59] as [number, number, number],           // Slate 800
  textMuted: [100, 116, 139] as [number, number, number],   // Slate 500
  textLight: [148, 163, 184] as [number, number, number],   // Slate 400
  
  white: [255, 255, 255] as [number, number, number],
  bgLight: [248, 250, 252] as [number, number, number],     // Slate 50
  border: [226, 232, 240] as [number, number, number],      // Slate 200
  borderDark: [203, 213, 225] as [number, number, number],  // Slate 300
  
  success: [34, 197, 94] as [number, number, number],       // Green 500
  successLight: [220, 252, 231] as [number, number, number],// Green 100
  warning: [234, 179, 8] as [number, number, number],       // Yellow 500
  warningLight: [254, 243, 199] as [number, number, number],// Yellow 100
  error: [239, 68, 68] as [number, number, number],         // Red 500
  errorLight: [254, 226, 226] as [number, number, number],  // Red 100
  
  info: [59, 130, 246] as [number, number, number],         // Blue 500
  infoLight: [219, 234, 254] as [number, number, number],   // Blue 100
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
    this.doc.rect(0, 0, PAGE.width, 3, "F");
    
    // Header bar
    this.doc.setFillColor(...COLORS.bgLight);
    this.doc.rect(0, 3, PAGE.width, 12, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.accent);
    this.doc.text("NIVRA", PAGE.marginLeft, 10);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(`FACTURE — ${this.data.invoiceNumber}`, PAGE.width / 2, 10, { align: "center" });
    this.doc.text(`Page ${this.pageNum}`, PAGE.width - PAGE.marginRight, 10, { align: "right" });
    
    this.y = 20;
  }
  
  private addFooters(): void {
    const totalPages = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      
      const footerY = PAGE.height - 15;
      
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(PAGE.marginLeft, footerY - 3, PAGE.width - PAGE.marginRight, footerY - 3);
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(6);
      this.doc.setTextColor(...COLORS.textMuted);
      
      this.doc.text(
        `${COMPANY_CONTACT.legalName} | ${COMPANY_CONTACT.fullAddress}`,
        PAGE.marginLeft,
        footerY
      );
      
      this.doc.text(
        `${COMPANY_CONTACT.supportEmailDisplay} | nivra-telecom.ca`,
        PAGE.marginLeft,
        footerY + 4
      );
      
      this.doc.text(
        `Facture: ${this.data.invoiceNumber} | Compte: ${this.data.accountNumber}`,
        PAGE.width / 2,
        footerY + 2,
        { align: "center" }
      );
      
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${i}/${totalPages}`, PAGE.width - PAGE.marginRight, footerY + 2, { align: "right" });
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1: SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildPage1Summary(): void {
    const { data } = this;
    
    // === TOP HEADER ===
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(0, 0, PAGE.width, 4, "F");
    
    // Info bar
    this.doc.setFillColor(...COLORS.bgLight);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.rect(0, 4, PAGE.width, 20, "FD");
    
    const headerY = 11;
    const headerY2 = 18;
    
    // Column data
    const cols = [
      { label: "N° COMPTE", value: data.accountNumber, x: PAGE.marginLeft },
      { label: "N° FACTURE", value: data.invoiceNumber, x: PAGE.marginLeft + 40 },
      { label: "DATE D'ÉMISSION", value: formatDate(data.billingDate), x: PAGE.marginLeft + 85 },
      { label: "DATE D'EXIGIBILITÉ", value: formatDate(data.dueDate), x: PAGE.marginLeft + 130 },
    ];
    
    cols.forEach(col => {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(6);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text(col.label, col.x, headerY);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(col.value, col.x, headerY2);
    });
    
    // Logo
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.setTextColor(...COLORS.accent);
    this.doc.text("NIVRA", PAGE.width - PAGE.marginRight, 16, { align: "right" });
    
    this.y = 30;
    
    // === WELCOME MESSAGE ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(...COLORS.text);
    
    const welcomeText = data.welcomeMessage || `Bonjour ${data.clientName.toUpperCase()}, voici votre facture Nivra.`;
    this.doc.text(welcomeText, PAGE.marginLeft, this.y);
    
    this.y += 6;
    
    if (data.billingPeriodStart && data.billingPeriodEnd) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text(
        `Période de facturation: ${formatDate(data.billingPeriodStart)} au ${formatDate(data.billingPeriodEnd)}`,
        PAGE.marginLeft,
        this.y
      );
      this.y += 5;
    }
    
    this.doc.setFontSize(7);
    this.doc.text("Vous trouverez le détail complet des frais aux pages suivantes.", PAGE.marginLeft, this.y);
    
    this.y += 10;
    
    // === TWO-COLUMN LAYOUT ===
    const leftColW = 90;
    const rightColW = 85;
    const gutter = 5;
    const boxStartY = this.y;
    
    // --- LEFT: TOTAL DUE ---
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, boxStartY, leftColW, 65, 2, 2, "FD");
    
    // Accent bar
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(PAGE.marginLeft, boxStartY, 4, 65, "F");
    
    // Title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("Montant total à payer", PAGE.marginLeft + 10, boxStartY + 10);
    
    // Big total
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(28);
    this.doc.setTextColor(...COLORS.primary);
    
    const balanceDue = data.balanceDue !== undefined ? data.balanceDue : data.total;
    this.doc.text(formatCurrency(balanceDue), PAGE.marginLeft + 10, boxStartY + 28);
    
    // Status badge
    if (data.isPaid) {
      this.doc.setFillColor(...COLORS.success);
      this.doc.roundedRect(PAGE.marginLeft + 10, boxStartY + 33, 30, 8, 2, 2, "F");
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("✓ PAYÉ", PAGE.marginLeft + 25, boxStartY + 38, { align: "center" });
      
      if (data.paidAt) {
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(7);
        this.doc.setTextColor(...COLORS.textMuted);
        this.doc.text(`Payé le ${formatDate(data.paidAt)}`, PAGE.marginLeft + 10, boxStartY + 46);
      }
    } else {
      this.doc.setFillColor(...COLORS.warningLight);
      this.doc.roundedRect(PAGE.marginLeft + 10, boxStartY + 33, 50, 8, 2, 2, "F");
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.warning);
      this.doc.text("⏰ À PAYER", PAGE.marginLeft + 35, boxStartY + 38, { align: "center" });
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(`Avant le ${formatDateLong(data.dueDate)}`, PAGE.marginLeft + 10, boxStartY + 48);
    }
    
    // Savings
    const totalDiscounts = (data.discounts || []).reduce((sum, d) => sum + d.amount, 0) + (data.credits || 0);
    if (totalDiscounts > 0) {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.success);
      this.doc.text(`✓ Économisé ce mois: ${formatCurrency(totalDiscounts)}`, PAGE.marginLeft + 10, boxStartY + 58);
    }
    
    // --- RIGHT: ACCOUNT SUMMARY ---
    const rightX = PAGE.marginLeft + leftColW + gutter;
    
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(rightX, boxStartY, rightColW, 65, 2, 2, "FD");
    
    // Title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("Sommaire du compte", rightX + 5, boxStartY + 8);
    
    // Table header
    this.doc.setFillColor(...COLORS.bgLight);
    this.doc.rect(rightX + 2, boxStartY + 11, rightColW - 4, 7, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(6);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Description", rightX + 5, boxStartY + 15.5);
    this.doc.text("Montant", rightX + rightColW - 10, boxStartY + 15.5, { align: "right" });
    
    let summaryY = boxStartY + 23;
    
    const addSummaryRow = (label: string, amount: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
      this.doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...(opts.color || COLORS.text));
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
    
    // One-time fees
    if (data.oneTimeFees && data.oneTimeFees.length > 0) {
      const onetimeTotal = data.oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
      addSummaryRow("Frais uniques", onetimeTotal);
    }
    
    // Discounts
    if (data.discounts && data.discounts.length > 0) {
      const discTotal = data.discounts.reduce((sum, d) => sum + d.amount, 0);
      addSummaryRow("Rabais", -discTotal, { color: COLORS.success });
    }
    
    // Separator
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(rightX + 5, summaryY - 2, rightX + rightColW - 5, summaryY - 2);
    summaryY += 2;
    
    // Taxes
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(6);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(`TPS: ${formatCurrency(data.tps)} | TVQ: ${formatCurrency(data.tvq)}`, rightX + 5, summaryY);
    summaryY += 5;
    
    // Total
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("TOTAL", rightX + 5, summaryY);
    this.doc.text(formatCurrency(data.total), rightX + rightColW - 10, summaryY, { align: "right" });
    
    this.y = boxStartY + 72;
    
    // === IMPORTANT NOTICE ===
    if (data.importantNotice) {
      this.doc.setFillColor(...COLORS.infoLight);
      this.doc.setDrawColor(...COLORS.info);
      this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 18, 2, 2, "FD");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.info);
      this.doc.text("ℹ️ Avis important", PAGE.marginLeft + 5, this.y + 6);
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.text);
      const noticeLines = this.doc.splitTextToSize(data.importantNotice, PAGE.contentWidth - 30);
      this.doc.text(noticeLines, PAGE.marginLeft + 25, this.y + 6);
      
      this.y += 22;
    }
    
    // === PAYMENT INSTRUCTIONS ===
    this.doc.setFillColor(...COLORS.warningLight);
    this.doc.setDrawColor(...COLORS.warning);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 28, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("💳 COMMENT PAYER — VIREMENT INTERAC UNIQUEMENT", PAGE.marginLeft + 5, this.y + 8);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`1. Envoyez votre paiement par Interac e-Transfer à: ${COMPANY_CONTACT.supportEmailDisplay}`, PAGE.marginLeft + 5, this.y + 15);
    this.doc.text(`2. Utilisez votre numéro de compte (${data.accountNumber}) comme référence.`, PAGE.marginLeft + 5, this.y + 21);
    this.doc.text("3. Votre service sera renouvelé dès réception et confirmation du paiement.", PAGE.marginLeft + 5, this.y + 27);
    
    this.y += 35;
    
    // === CLIENT INFO BLOCK ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("ADRESSE DE FACTURATION", PAGE.marginLeft, this.y);
    
    this.y += 5;
    
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, 90, 22, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.clientName, PAGE.marginLeft + 5, this.y + 7);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.text(data.clientAddress, PAGE.marginLeft + 5, this.y + 13);
    this.doc.text(`${data.clientCity}, ${data.clientProvince} ${data.clientPostalCode}`, PAGE.marginLeft + 5, this.y + 18);
    
    // Contact on the right
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Courriel:", PAGE.marginLeft + 100, this.y + 7);
    this.doc.text("Téléphone:", PAGE.marginLeft + 100, this.y + 13);
    
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.clientEmail, PAGE.marginLeft + 120, this.y + 7);
    this.doc.text(data.clientPhone || "—", PAGE.marginLeft + 120, this.y + 13);
    
    this.y += 28;
    
    // === STORE CREDIT ===
    if (data.storeCredit && data.storeCredit > 0) {
      this.doc.setFillColor(...COLORS.successLight);
      this.doc.setDrawColor(...COLORS.success);
      this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 12, 2, 2, "FD");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.success);
      this.doc.text(`💰 Crédit en magasin disponible: ${formatCurrency(data.storeCredit)}`, PAGE.marginLeft + 5, this.y + 8);
      
      this.y += 18;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 2+: DETAILED BREAKDOWN
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildDetailedBreakdown(): void {
    this.addNewPage();
    
    const { data } = this;
    
    // Title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("DÉTAIL COMPLET DE LA FACTURE", PAGE.marginLeft, this.y);
    
    this.y += 10;
    
    // Group services by type
    const servicesByType = data.services.reduce((acc, s) => {
      if (!acc[s.type]) acc[s.type] = [];
      acc[s.type].push(s);
      return acc;
    }, {} as Record<string, InvoiceV2ServiceItem[]>);
    
    // Render each category
    Object.entries(servicesByType).forEach(([type, services]) => {
      this.checkPageBreak(35);
      
      const typeTotal = services.reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);
      
      // Category header
      this.doc.setFillColor(...COLORS.primary);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 10, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.setTextColor(...COLORS.white);
      
      const typeLabel = type === "Mobile" ? "📱 SERVICES SANS-FIL" :
                        type === "Internet" ? "🌐 SERVICES INTERNET" :
                        type === "TV" ? "📺 SERVICES TÉLÉVISION" :
                        type === "Security" ? "🔒 SERVICES SÉCURITÉ" :
                        type === "Streaming" ? "🎬 SERVICES STREAMING" :
                        `📦 ${type.toUpperCase()}`;
      
      this.doc.text(typeLabel, PAGE.marginLeft + 5, this.y + 7);
      this.doc.text(formatCurrency(typeTotal), PAGE.width - PAGE.marginRight - 5, this.y + 7, { align: "right" });
      
      this.y += 12;
      
      // Table header
      this.doc.setFillColor(...COLORS.bgLight);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 6, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(6);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("SERVICE", PAGE.marginLeft + 3, this.y + 4);
      this.doc.text("DESCRIPTION", PAGE.marginLeft + 70, this.y + 4);
      this.doc.text("QTÉ", PAGE.marginLeft + 140, this.y + 4);
      this.doc.text("PRIX", PAGE.width - PAGE.marginRight - 3, this.y + 4, { align: "right" });
      
      this.y += 6;
      
      // Service rows
      services.forEach((service, idx) => {
        const hasUsage = service.usageDetails && service.usageDetails.length > 0;
        const rowH = hasUsage ? 14 + (service.usageDetails!.length * 4) : 14;
        
        this.checkPageBreak(rowH + 2);
        
        // Background
        if (idx % 2 === 0) {
          this.doc.setFillColor(...COLORS.bgLight);
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        // Service name
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(9);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(service.name, PAGE.marginLeft + 3, this.y + 6);
        
        // Description
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(7);
        this.doc.setTextColor(...COLORS.textMuted);
        const desc = service.description || "";
        const truncDesc = desc.length > 45 ? desc.substring(0, 42) + "..." : desc;
        this.doc.text(truncDesc, PAGE.marginLeft + 70, this.y + 6);
        
        // Quantity
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(String(service.quantity || 1), PAGE.marginLeft + 143, this.y + 6);
        
        // Price
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(9);
        const price = service.monthlyPrice * (service.quantity || 1);
        this.doc.text(formatCurrency(price), PAGE.width - PAGE.marginRight - 3, this.y + 6, { align: "right" });
        
        // Period
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(6);
        this.doc.setTextColor(...COLORS.textMuted);
        this.doc.text(service.period || "/mois", PAGE.width - PAGE.marginRight - 3, this.y + 11, { align: "right" });
        
        // Usage details
        if (hasUsage) {
          let usageY = this.y + 11;
          this.doc.setFont("helvetica", "normal");
          this.doc.setFontSize(6);
          this.doc.setTextColor(...COLORS.textLight);
          
          service.usageDetails!.forEach(usage => {
            this.doc.text(`${usage.label}: ${usage.value}`, PAGE.marginLeft + 8, usageY);
            usageY += 4;
          });
        }
        
        // Row border
        this.doc.setDrawColor(...COLORS.border);
        this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
        
        this.y += rowH;
      });
      
      this.y += 8;
    });
    
    // === ONE-TIME FEES ===
    if (data.oneTimeFees && data.oneTimeFees.length > 0) {
      this.checkPageBreak(30);
      
      this.doc.setFillColor(...COLORS.warning);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 8, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("💰 FRAIS UNIQUES", PAGE.marginLeft + 5, this.y + 5.5);
      
      const onetimeTotal = data.oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
      this.doc.text(formatCurrency(onetimeTotal), PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
      
      this.y += 10;
      
      data.oneTimeFees.forEach((fee, idx) => {
        const rowH = 10;
        
        if (idx % 2 === 0) {
          this.doc.setFillColor(...COLORS.bgLight);
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(fee.label, PAGE.marginLeft + 5, this.y + 6);
        
        if (fee.description) {
          this.doc.setFont("helvetica", "normal");
          this.doc.setFontSize(7);
          this.doc.setTextColor(...COLORS.textMuted);
          this.doc.text(fee.description, PAGE.marginLeft + 80, this.y + 6);
        }
        
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(9);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(formatCurrency(fee.amount), PAGE.width - PAGE.marginRight - 5, this.y + 6, { align: "right" });
        
        this.doc.setDrawColor(...COLORS.border);
        this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
        
        this.y += rowH;
      });
      
      this.y += 8;
    }
    
    // === DISCOUNTS ===
    if (data.discounts && data.discounts.length > 0) {
      this.checkPageBreak(30);
      
      this.doc.setFillColor(...COLORS.success);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 8, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("🎉 RABAIS ET CRÉDITS", PAGE.marginLeft + 5, this.y + 5.5);
      
      const discTotal = data.discounts.reduce((sum, d) => sum + d.amount, 0);
      this.doc.text(`-${formatCurrency(discTotal)}`, PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
      
      this.y += 10;
      
      data.discounts.forEach((disc, idx) => {
        const rowH = 10;
        
        if (idx % 2 === 0) {
          this.doc.setFillColor(...COLORS.successLight);
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.success);
        this.doc.text(disc.label, PAGE.marginLeft + 5, this.y + 6);
        
        this.doc.setFont("helvetica", "bold");
        this.doc.text(`-${formatCurrency(disc.amount)}`, PAGE.width - PAGE.marginRight - 5, this.y + 6, { align: "right" });
        
        this.doc.setDrawColor(...COLORS.border);
        this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
        
        this.y += rowH;
      });
      
      this.y += 8;
    }
    
    // === GRAND TOTAL BOX ===
    this.checkPageBreak(50);
    
    const totalBoxW = 100;
    const totalBoxX = PAGE.width - PAGE.marginRight - totalBoxW;
    
    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(totalBoxX, this.y, totalBoxW, 50, 3, 3, "F");
    
    let totY = this.y + 10;
    
    // Subtotal
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("Sous-total services", totalBoxX + 5, totY);
    this.doc.text(formatCurrency(data.subtotal), totalBoxX + totalBoxW - 5, totY, { align: "right" });
    totY += 7;
    
    // TPS
    this.doc.text("TPS (5%)", totalBoxX + 5, totY);
    this.doc.text(formatCurrency(data.tps), totalBoxX + totalBoxW - 5, totY, { align: "right" });
    totY += 7;
    
    // TVQ
    this.doc.text("TVQ (9.975%)", totalBoxX + 5, totY);
    this.doc.text(formatCurrency(data.tvq), totalBoxX + totalBoxW - 5, totY, { align: "right" });
    totY += 5;
    
    // Separator
    this.doc.setDrawColor(...COLORS.accent);
    this.doc.line(totalBoxX + 5, totY, totalBoxX + totalBoxW - 5, totY);
    totY += 8;
    
    // Grand total
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.accent);
    this.doc.text("TOTAL À PAYER", totalBoxX + 5, totY);
    this.doc.setFontSize(16);
    this.doc.text(formatCurrency(data.total), totalBoxX + totalBoxW - 5, totY, { align: "right" });
    
    this.y += 60;
    
    // === PREVIOUS PAYMENTS ===
    if (data.previousPayments && data.previousPayments.length > 0) {
      this.checkPageBreak(30);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.setTextColor(...COLORS.primary);
      this.doc.text("HISTORIQUE DES PAIEMENTS RÉCENTS", PAGE.marginLeft, this.y);
      
      this.y += 6;
      
      // Table header
      this.doc.setFillColor(...COLORS.bgLight);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 6, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(6);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("DATE", PAGE.marginLeft + 5, this.y + 4);
      this.doc.text("MÉTHODE", PAGE.marginLeft + 40, this.y + 4);
      this.doc.text("RÉFÉRENCE", PAGE.marginLeft + 90, this.y + 4);
      this.doc.text("MONTANT", PAGE.width - PAGE.marginRight - 5, this.y + 4, { align: "right" });
      
      this.y += 6;
      
      data.previousPayments.slice(0, 5).forEach((payment, idx) => {
        const rowH = 8;
        
        if (idx % 2 === 0) {
          this.doc.setFillColor(...COLORS.bgLight);
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(formatDate(payment.date), PAGE.marginLeft + 5, this.y + 5.5);
        this.doc.text(payment.method, PAGE.marginLeft + 40, this.y + 5.5);
        this.doc.text(payment.reference || "—", PAGE.marginLeft + 90, this.y + 5.5);
        
        this.doc.setFont("helvetica", "bold");
        this.doc.setTextColor(...COLORS.success);
        this.doc.text(formatCurrency(payment.amount), PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
        
        this.y += rowH;
      });
    }
    
    // === NOTES ===
    if (data.notes) {
      this.checkPageBreak(25);
      
      this.y += 10;
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.primary);
      this.doc.text("📝 NOTES", PAGE.marginLeft, this.y);
      
      this.y += 5;
      
      this.doc.setFillColor(...COLORS.bgLight);
      this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 18, 2, 2, "F");
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.text);
      const noteLines = this.doc.splitTextToSize(data.notes, PAGE.contentWidth - 10);
      this.doc.text(noteLines, PAGE.marginLeft + 5, this.y + 6);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // FINAL PAGE: PAYMENT SLIP
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildPaymentSlip(): void {
    this.addNewPage();
    
    const { data } = this;
    
    // Title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("TALON DE PAIEMENT", PAGE.marginLeft, this.y);
    
    this.y += 6;
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Conservez ce talon comme preuve de paiement. Détachez-le de la facture si désiré.", PAGE.marginLeft, this.y);
    
    this.y += 8;
    
    // Dashed line (tear-off)
    this.doc.setDrawColor(...COLORS.textMuted);
    this.doc.setLineDashPattern([3, 3], 0);
    this.doc.line(PAGE.marginLeft, this.y, PAGE.width - PAGE.marginRight, this.y);
    this.doc.setLineDashPattern([], 0);
    
    this.y += 10;
    
    // Payment slip content
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 80, 3, 3, "FD");
    this.doc.setLineWidth(0.2);
    
    // Header
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 12, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("NIVRA TELECOM — TALON DE PAIEMENT", PAGE.marginLeft + 5, this.y + 8);
    
    let slipY = this.y + 20;
    
    // Left column
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Numéro de compte", PAGE.marginLeft + 5, slipY);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.accountNumber, PAGE.marginLeft + 5, slipY + 7);
    
    slipY += 16;
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Numéro de facture", PAGE.marginLeft + 5, slipY);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.invoiceNumber, PAGE.marginLeft + 5, slipY + 6);
    
    slipY += 14;
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Nom du client", PAGE.marginLeft + 5, slipY);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.clientName, PAGE.marginLeft + 5, slipY + 6);
    
    // Right column - Total
    const rightX = PAGE.marginLeft + PAGE.contentWidth / 2;
    slipY = this.y + 20;
    
    this.doc.setFillColor(...COLORS.bgLight);
    this.doc.roundedRect(rightX, slipY - 5, PAGE.contentWidth / 2 - 10, 45, 2, 2, "F");
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Date d'exigibilité", rightX + 5, slipY);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(formatDateLong(data.dueDate), rightX + 5, slipY + 6);
    
    slipY += 15;
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Montant à payer", rightX + 5, slipY);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(18);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text(formatCurrency(data.balanceDue || data.total), rightX + 5, slipY + 10);
    
    // Payment method
    slipY = this.y + 62;
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.accent);
    this.doc.text("Paiement par Interac e-Transfer à:", PAGE.marginLeft + 5, slipY);
    this.doc.setFontSize(10);
    this.doc.text(COMPANY_CONTACT.supportEmailDisplay, PAGE.marginLeft + 5, slipY + 7);
    
    this.y += 95;
    
    // Terms reminder
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("RAPPEL DES CONDITIONS", PAGE.marginLeft, this.y);
    
    this.y += 6;
    
    const terms = [
      "• Tous les services sont prépayés. Le renouvellement nécessite le paiement avant la date d'échéance.",
      "• Le cycle de facturation de 30 jours débute uniquement après confirmation du paiement.",
      "• En cas de retard, le service sera suspendu. Des frais de réactivation peuvent s'appliquer.",
      "• Vous pouvez contester une facture dans les 30 jours en contactant support@nivra-telecom.ca",
      "• Pour toute question, visitez le portail client ou contactez-nous à support@nivra-telecom.ca",
    ];
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.text);
    
    terms.forEach(term => {
      const lines = this.doc.splitTextToSize(term, PAGE.contentWidth - 5);
      lines.forEach((line: string) => {
        this.doc.text(line, PAGE.marginLeft + 3, this.y);
        this.y += 4;
      });
    });
    
    // Thank you message
    this.y += 10;
    
    this.doc.setFillColor(...COLORS.accent);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 15, 2, 2, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("Merci d'être client Nivra Telecom!", PAGE.width / 2, this.y + 10, { align: "center" });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────
  
  public build(): jsPDF {
    // Page 1: Summary
    this.buildPage1Summary();
    
    // Page 2+: Detailed breakdown
    this.buildDetailedBreakdown();
    
    // Final page: Payment slip
    this.buildPaymentSlip();
    
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
