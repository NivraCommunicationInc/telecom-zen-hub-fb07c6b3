/**
 * Nivra Contract Template V2 - PROFESSIONAL MULTI-PAGE CONTRACT
 * Inspired by Rogers service agreement layout
 * 
 * Structure:
 * - Page 1: Executive Summary (Client info, Services, Totals, First payment)
 * - Pages 2+: Full Legal Annexes A-E (from annexes.ts)
 * - Final Page: Dual Signature Block (Client + Agent)
 * 
 * Features:
 * - Multi-page support with proper page breaks
 * - Complete legal annexes (A → E)
 * - Professional header/footer on every page
 * - Visible dual signature fields
 * - Rogers-style clean tables and layout
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { COMPANY_CONTACT } from "@/config/company";
import { ALL_ANNEXES, AnnexeSection } from "./annexes";

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
  primary: [0, 51, 102] as [number, number, number],        // #003366 - Navy
  primaryLight: [0, 102, 204] as [number, number, number],  // #0066CC - Blue
  accent: [52, 211, 153] as [number, number, number],       // #34D399 - Teal
  text: [33, 33, 33] as [number, number, number],           // #212121
  textLight: [100, 100, 100] as [number, number, number],   // #646464
  textMuted: [150, 150, 150] as [number, number, number],   // #969696
  border: [200, 200, 200] as [number, number, number],      // #C8C8C8
  borderLight: [230, 230, 230] as [number, number, number], // #E6E6E6
  background: [248, 248, 248] as [number, number, number],  // #F8F8F8
  white: [255, 255, 255] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],      // #10B981
  warning: [245, 158, 11] as [number, number, number],      // #F59E0B
};

const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 15,
  marginRight: 15,
  marginTop: 20,
  marginBottom: 25,
  get contentWidth() { return this.width - this.marginLeft - this.marginRight; },
  get safeBottom() { return this.height - this.marginBottom; },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-CA", { 
    style: "currency", 
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}

// =============================================================================
// PDF GENERATOR CLASS (for multi-page state management)
// =============================================================================

class ContractPDFBuilder {
  private doc: jsPDF;
  private y: number;
  private pageNum: number;
  private data: ContractV2Data;
  
  constructor(data: ContractV2Data) {
    this.doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    this.data = data;
    this.y = PAGE.marginTop;
    this.pageNum = 1;
    
    // White background for all pages
    this.doc.setFillColor(...COLORS.white);
    this.doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  }
  
  // Check if we need a page break and add new page if needed
  private checkPageBreak(neededSpace: number): void {
    if (this.y + neededSpace > PAGE.safeBottom) {
      this.addNewPage();
    }
  }
  
  // Add a new page with header
  private addNewPage(): void {
    this.doc.addPage();
    this.pageNum++;
    
    // White background
    this.doc.setFillColor(...COLORS.white);
    this.doc.rect(0, 0, PAGE.width, PAGE.height, "F");
    
    // Top accent line
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(0, 0, PAGE.width, 2, "F");
    
    // Continuation header
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(`ENTENTE DE SERVICE — ${this.data.contractNumber}`, PAGE.marginLeft, 10);
    this.doc.text(`Page ${this.pageNum}`, PAGE.width - PAGE.marginRight, 10, { align: "right" });
    
    this.y = 18;
  }
  
  // Add footer to all pages at the end
  private addFooters(): void {
    const totalPages = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      
      const footerY = PAGE.height - 15;
      
      // Footer line
      this.doc.setDrawColor(...COLORS.borderLight);
      this.doc.line(PAGE.marginLeft, footerY - 3, PAGE.width - PAGE.marginRight, footerY - 3);
      
      // Footer text
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
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
      
      // Page number (except page 1 which has it in header)
      if (i > 1) {
        this.doc.text(`${i} / ${totalPages}`, PAGE.width - PAGE.marginRight, footerY + 4, { align: "right" });
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1: EXECUTIVE SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildPage1Summary(): void {
    const { data } = this;
    
    // === TOP HEADER BAR ===
    // Accent line
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(0, 0, PAGE.width, 3, "F");
    
    // Navy header
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 28, "F");
    
    // Company name
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(20);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("NIVRA TELECOM", PAGE.marginLeft + 8, this.y + 12);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.text("Télécom prépayée au Québec", PAGE.marginLeft + 8, this.y + 18);
    
    // Contract title (right side)
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text("ENTENTE DE SERVICE", PAGE.width - PAGE.marginRight - 8, this.y + 10, { align: "right" });
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.text(data.contractNumber, PAGE.width - PAGE.marginRight - 8, this.y + 16, { align: "right" });
    this.doc.setFontSize(8);
    this.doc.text(`Page 1`, PAGE.width - PAGE.marginRight - 8, this.y + 22, { align: "right" });
    
    this.y += 33;
    
    // === DOCUMENT INFO BAR ===
    this.doc.setFillColor(...COLORS.background);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 14, "FD");
    
    const infoY = this.y + 5;
    const cols = [
      { label: "Numéro de compte", value: data.accountNumber, x: PAGE.marginLeft + 5 },
      { label: "Date du contrat", value: formatDate(data.contractDate), x: PAGE.marginLeft + 50 },
      { label: "Date d'activation", value: data.activationDate ? formatDate(data.activationDate) : "À confirmer", x: PAGE.marginLeft + 100 },
    ];
    
    if (data.orderNumber) {
      cols.push({ label: "Commande", value: data.orderNumber, x: PAGE.marginLeft + 145 });
    }
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    cols.forEach(col => {
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text(col.label, col.x, infoY);
      this.doc.setTextColor(...COLORS.text);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(col.value, col.x, infoY + 5);
      this.doc.setFont("helvetica", "normal");
    });
    
    this.y += 20;
    
    // === CLIENT INFORMATION ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.primaryLight);
    this.doc.text("INFORMATIONS DU CLIENT", PAGE.marginLeft, this.y);
    
    this.y += 5;
    
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 28, 2, 2, "FD");
    
    const clientY = this.y + 6;
    const halfWidth = PAGE.contentWidth / 2;
    
    // Left column
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Nom complet", PAGE.marginLeft + 5, clientY);
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.clientName, PAGE.marginLeft + 5, clientY + 5);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Courriel / Téléphone", PAGE.marginLeft + 5, clientY + 12);
    
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    const contact = [data.clientEmail, data.clientPhone].filter(Boolean).join(" • ");
    this.doc.text(contact, PAGE.marginLeft + 5, clientY + 17);
    
    // Right column
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Adresse de service", PAGE.marginLeft + halfWidth + 5, clientY);
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.serviceAddress, PAGE.marginLeft + halfWidth + 5, clientY + 5);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.text(
      `${data.serviceCity}, ${data.serviceProvince} ${data.servicePostalCode}`,
      PAGE.marginLeft + halfWidth + 5,
      clientY + 10
    );
    
    if (data.clientDateOfBirth) {
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("Date de naissance", PAGE.marginLeft + halfWidth + 5, clientY + 16);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(formatDate(data.clientDateOfBirth), PAGE.marginLeft + halfWidth + 50, clientY + 16);
    }
    
    this.y += 34;
    
    // === SERVICES TABLE ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.primaryLight);
    this.doc.text("SERVICES SOUSCRITS", PAGE.marginLeft, this.y);
    
    this.y += 5;
    
    // Table header
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 8, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.white);
    
    const colType = PAGE.marginLeft + 3;
    const colName = PAGE.marginLeft + 28;
    const colDesc = PAGE.marginLeft + 95;
    const colPrice = PAGE.width - PAGE.marginRight - 5;
    
    this.doc.text("TYPE", colType, this.y + 5.5);
    this.doc.text("SERVICE", colName, this.y + 5.5);
    this.doc.text("DESCRIPTION", colDesc, this.y + 5.5);
    this.doc.text("PRIX/MOIS", colPrice, this.y + 5.5, { align: "right" });
    
    this.y += 8;
    
    // Service rows
    data.services.forEach((service, idx) => {
      const rowH = 10;
      
      if (idx % 2 === 0) {
        this.doc.setFillColor(...COLORS.background);
        this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
      }
      
      this.doc.setDrawColor(...COLORS.borderLight);
      this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
      
      // Type badge
      this.doc.setFillColor(...COLORS.accent);
      this.doc.roundedRect(colType, this.y + 2, 22, 6, 1, 1, "F");
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(6);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text(service.type.toUpperCase(), colType + 11, this.y + 6, { align: "center" });
      
      // Service name
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(service.name, colName, this.y + 6);
      
      // Description
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textLight);
      const desc = service.description || "";
      const truncDesc = desc.length > 45 ? desc.substring(0, 42) + "..." : desc;
      this.doc.text(truncDesc, colDesc, this.y + 6);
      
      // Price
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(formatCurrency(service.monthlyPrice), colPrice, this.y + 6, { align: "right" });
      
      this.y += rowH;
    });
    
    // One-time fees
    if (data.oneTimeFees && data.oneTimeFees.length > 0) {
      this.y += 3;
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("FRAIS UNIQUES", PAGE.marginLeft, this.y);
      this.y += 5;
      
      data.oneTimeFees.forEach(fee => {
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(fee.label, colName, this.y);
        this.doc.text(formatCurrency(fee.amount), colPrice, this.y, { align: "right" });
        this.y += 5;
      });
    }
    
    // Discounts
    if (data.discounts && data.discounts.length > 0) {
      this.y += 2;
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.success);
      this.doc.text("RABAIS APPLIQUÉS", PAGE.marginLeft, this.y);
      this.y += 5;
      
      data.discounts.forEach(d => {
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.success);
        this.doc.text(d.label, colName, this.y);
        this.doc.text(`-${formatCurrency(d.amount)}`, colPrice, this.y, { align: "right" });
        this.y += 5;
      });
    }
    
    this.y += 8;
    
    // === TOTALS BOX ===
    const totalsW = 85;
    const totalsX = PAGE.width - PAGE.marginRight - totalsW;
    
    this.doc.setFillColor(...COLORS.background);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(totalsX, this.y, totalsW, 45, 2, 2, "FD");
    
    let tY = this.y + 7;
    const labelX = totalsX + 5;
    const valueX = totalsX + totalsW - 5;
    
    const addTotalRow = (label: string, value: number, isBold = false, isHighlight = false) => {
      this.doc.setFont("helvetica", isBold ? "bold" : "normal");
      this.doc.setFontSize(isBold ? 9 : 8);
      this.doc.setTextColor(...(isHighlight ? COLORS.primaryLight : COLORS.text));
      this.doc.text(label, labelX, tY);
      this.doc.text(formatCurrency(value), valueX, tY, { align: "right" });
      tY += 6;
    };
    
    addTotalRow("Sous-total mensuel", data.monthlySubtotal);
    if (data.oneTimeSubtotal && data.oneTimeSubtotal > 0) {
      addTotalRow("Frais uniques", data.oneTimeSubtotal);
    }
    addTotalRow("TPS (5%)", data.tps);
    addTotalRow("TVQ (9.975%)", data.tvq);
    
    // Separator line
    this.doc.setDrawColor(...COLORS.primaryLight);
    this.doc.line(labelX, tY - 2, valueX, tY - 2);
    tY += 3;
    
    // First payment (highlighted)
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.primaryLight);
    this.doc.text("Premier paiement", labelX, tY);
    this.doc.setFontSize(12);
    this.doc.text(formatCurrency(data.totalFirstPayment), valueX, tY, { align: "right" });
    
    this.y += 52;
    
    // Monthly note
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textLight);
    this.doc.text(
      `Paiement mensuel récurrent: ${formatCurrency(data.monthlyTotal)} (taxes incluses)`,
      totalsX,
      this.y
    );
    
    this.y += 10;
    
    // === PAYMENT TERMS BOX ===
    this.doc.setFillColor(255, 248, 225);
    this.doc.setDrawColor(255, 193, 7);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 20, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("MODALITÉS DE PAIEMENT — INTERAC UNIQUEMENT", PAGE.marginLeft + 5, this.y + 7);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.text(`Envoyer le paiement à: ${COMPANY_CONTACT.supportEmailDisplay}`, PAGE.marginLeft + 5, this.y + 12);
    this.doc.text("Le cycle de facturation de 30 jours débute uniquement après confirmation du paiement.", PAGE.marginLeft + 5, this.y + 17);
    
    this.y += 28;
    
    // === ANNEXES REFERENCE ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.primaryLight);
    this.doc.text("DOCUMENTS INCLUS", PAGE.marginLeft, this.y);
    
    this.y += 5;
    
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 28, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    
    const annexeList = [
      "Annexe A — Termes et conditions générales",
      "Annexe B — Conditions spécifiques par service",
      "Annexe C — Politique d'installation et rendez-vous",
      "Annexe D — Modalités de paiement (incluant e-Transfer)",
      "Annexe E — Support, tickets, SLA et clauses avancées",
    ];
    
    let aY = this.y + 5;
    const half = Math.ceil(annexeList.length / 2);
    annexeList.forEach((ann, i) => {
      const xPos = i < half ? PAGE.marginLeft + 5 : PAGE.marginLeft + PAGE.contentWidth / 2 + 5;
      const yPos = aY + (i % half) * 5;
      this.doc.text(`• ${ann}`, xPos, yPos);
    });
    
    this.y += 35;
    
    // === ACCEPTANCE NOTE ===
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textLight);
    const acceptText = "En signant ce contrat, le client reconnaît avoir lu et accepté les termes et conditions " +
      "incluant les Annexes A à E ci-jointes. Les signatures apparaissent à la dernière page du document.";
    const acceptLines = this.doc.splitTextToSize(acceptText, PAGE.contentWidth - 10);
    this.doc.text(acceptLines, PAGE.marginLeft + 5, this.y);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGES 2+: LEGAL ANNEXES
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildAnnexes(): void {
    ALL_ANNEXES.forEach(annexe => {
      this.addNewPage();
      this.renderAnnexe(annexe);
    });
  }
  
  private renderAnnexe(annexe: AnnexeSection): void {
    // Annexe title header
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 10, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text(annexe.title, PAGE.marginLeft + 5, this.y + 7);
    
    this.y += 15;
    
    // Render each section
    annexe.sections.forEach(section => {
      this.checkPageBreak(20);
      
      // Section number + title
      const sectionTitle = section.number 
        ? `${section.number}. ${section.title}` 
        : section.title;
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.primaryLight);
      this.doc.text(sectionTitle, PAGE.marginLeft, this.y);
      
      this.y += 5;
      
      // Paragraphs
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.text);
      
      section.paragraphs.forEach(para => {
        const lines = this.doc.splitTextToSize(para, PAGE.contentWidth - 5);
        const lineHeight = 3.5;
        const neededSpace = lines.length * lineHeight + 3;
        
        this.checkPageBreak(neededSpace);
        
        this.doc.text(lines, PAGE.marginLeft + 3, this.y);
        this.y += neededSpace;
      });
      
      this.y += 3;
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // FINAL PAGE: SIGNATURES
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildSignaturePage(): void {
    // Ensure we have enough space, otherwise new page
    this.checkPageBreak(100);
    
    // If we're near top of a new page, that's fine
    // If not, add separator
    if (this.y > 50) {
      this.y += 10;
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(PAGE.marginLeft, this.y, PAGE.width - PAGE.marginRight, this.y);
      this.y += 10;
    }
    
    // Signature section header
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("SIGNATURES", PAGE.marginLeft, this.y);
    
    this.y += 3;
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textLight);
    this.doc.text(
      "Les parties ci-dessous reconnaissent avoir lu et accepté les termes de la présente entente de service.",
      PAGE.marginLeft,
      this.y + 5
    );
    
    this.y += 15;
    
    const sigBoxW = (PAGE.contentWidth - 10) / 2;
    const sigBoxH = 55;
    const leftX = PAGE.marginLeft;
    const rightX = PAGE.marginLeft + sigBoxW + 10;
    
    // === CLIENT SIGNATURE BOX ===
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(leftX, this.y, sigBoxW, sigBoxH, 3, 3, "FD");
    
    // Header
    this.doc.setFillColor(...COLORS.primaryLight);
    this.doc.roundedRect(leftX, this.y, sigBoxW, 10, 3, 3, "F");
    this.doc.rect(leftX, this.y + 5, sigBoxW, 5, "F"); // square off bottom corners
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("SIGNATURE DU CLIENT", leftX + 5, this.y + 7);
    
    // Signature area
    const clientSigY = this.y + 15;
    
    if (this.data.clientSignature) {
      if (this.data.clientSignatureType === "canvas") {
        try {
          this.doc.addImage(this.data.clientSignature, "PNG", leftX + 10, clientSigY, sigBoxW - 20, 20);
        } catch {
          // Fallback to text
          this.doc.setFont("helvetica", "italic");
          this.doc.setFontSize(14);
          this.doc.setTextColor(...COLORS.text);
          this.doc.text(this.data.clientName, leftX + sigBoxW / 2, clientSigY + 10, { align: "center" });
        }
      } else {
        this.doc.setFont("helvetica", "italic");
        this.doc.setFontSize(14);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(this.data.clientSignature, leftX + sigBoxW / 2, clientSigY + 10, { align: "center" });
      }
    } else {
      // Empty signature line
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(leftX + 10, clientSigY + 20, leftX + sigBoxW - 10, clientSigY + 20);
      
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("Signature du client", leftX + sigBoxW / 2, clientSigY + 25, { align: "center" });
    }
    
    // Client info below signature
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`Nom: ${this.data.clientName}`, leftX + 5, this.y + sigBoxH - 10);
    this.doc.text(`Date: ${this.data.clientSignedAt ? formatDate(this.data.clientSignedAt) : "____/____/________"}`, leftX + 5, this.y + sigBoxH - 5);
    
    // === AGENT SIGNATURE BOX ===
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(rightX, this.y, sigBoxW, sigBoxH, 3, 3, "FD");
    
    // Header
    this.doc.setFillColor(...COLORS.accent);
    this.doc.roundedRect(rightX, this.y, sigBoxW, 10, 3, 3, "F");
    this.doc.rect(rightX, this.y + 5, sigBoxW, 5, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("REPRÉSENTANT NIVRA", rightX + 5, this.y + 7);
    
    // Agent signature area
    const agentSigY = this.y + 15;
    
    if (this.data.agentSignature) {
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(14);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(this.data.agentSignature, rightX + sigBoxW / 2, agentSigY + 10, { align: "center" });
    } else {
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(rightX + 10, agentSigY + 20, rightX + sigBoxW - 10, agentSigY + 20);
      
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("Signature du représentant", rightX + sigBoxW / 2, agentSigY + 25, { align: "center" });
    }
    
    // Agent info
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`Nom: ${this.data.agentName || "____________________"}`, rightX + 5, this.y + sigBoxH - 10);
    this.doc.text(`Date: ${this.data.agentSignedAt ? formatDate(this.data.agentSignedAt) : "____/____/________"}`, rightX + 5, this.y + sigBoxH - 5);
    
    this.y += sigBoxH + 15;
    
    // === LEGAL NOTICE ===
    this.checkPageBreak(25);
    
    this.doc.setFillColor(248, 250, 252);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 22, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("AVIS IMPORTANT", PAGE.marginLeft + 5, this.y + 6);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textLight);
    
    const notice = "Ce contrat, incluant les Annexes A à E, constitue l'entente complète entre les parties. " +
      "Conservez ce document pour vos dossiers. Pour toute question, contactez-nous à " + 
      COMPANY_CONTACT.supportEmailDisplay + " ou 438-544-2233.";
    const noticeLines = this.doc.splitTextToSize(notice, PAGE.contentWidth - 10);
    this.doc.text(noticeLines, PAGE.marginLeft + 5, this.y + 11);
    
    this.y += 30;
    
    // Contract reference at bottom
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(`Contrat: ${this.data.contractNumber}`, PAGE.marginLeft, this.y);
    this.doc.text(`Compte: ${this.data.accountNumber}`, PAGE.marginLeft + 80, this.y);
    this.doc.text(`Émis le: ${formatDate(this.data.contractDate)}`, PAGE.width - PAGE.marginRight, this.y, { align: "right" });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // BUILD & RETURN
  // ─────────────────────────────────────────────────────────────────────────
  
  public build(): jsPDF {
    // Page 1: Summary
    this.buildPage1Summary();
    
    // Pages 2+: Annexes A-E
    this.buildAnnexes();
    
    // Final section: Signatures
    this.buildSignaturePage();
    
    // Add footers to all pages
    this.addFooters();
    
    return this.doc;
  }
}

// =============================================================================
// EXPORT FUNCTION
// =============================================================================

export function generateContractV2PDF(data: ContractV2Data): jsPDF {
  const builder = new ContractPDFBuilder(data);
  return builder.build();
}

/**
 * Generate and download the contract PDF
 */
export function downloadContractV2PDF(data: ContractV2Data): void {
  const doc = generateContractV2PDF(data);
  const fileName = `Contrat_${data.contractNumber}_${data.clientName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

export default generateContractV2PDF;
