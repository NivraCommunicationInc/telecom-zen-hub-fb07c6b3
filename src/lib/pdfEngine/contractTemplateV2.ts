/**
 * Nivra Contract Template V2 - PROFESSIONAL MULTI-PAGE CONTRACT
 * Design exactement comme les exemples PDF fournis (Rogers-style)
 * 
 * Structure:
 * - Page 1: Résumé du contrat (cover page avec informations clés)
 * - Page 2: Grand Total
 * - Page 3: Acceptation des annexes + Signatures + Badge électronique
 * - Pages 4+: Annexes A → E (texte légal complet)
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
  details?: string[];
}

export interface ContractV2Equipment {
  name: string;
  serialNumber?: string;
  status: "owned" | "rented" | "included";
  value?: number;
}

export interface ContractV2Data {
  // Document identifiers
  contractNumber: string;
  orderNumber?: string;
  accountNumber: string;
  contractDate: string;
  activationDate?: string;
  expirationDate?: string;
  
  // Client info
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientDateOfBirth?: string;
  clientIdType?: string;
  clientIdNumber?: string;
  
  // Addresses
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
  
  // Equipment
  equipment?: ContractV2Equipment[];
  
  // One-time fees
  oneTimeFees?: { label: string; amount: number; description?: string }[];
  
  // Discounts
  discounts?: { label: string; amount: number; description?: string }[];
  
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
  billingCycleDay?: number;
  
  // Signatures
  clientSignature?: string;
  clientSignatureType?: "canvas" | "text";
  clientSignedAt?: string;
  clientInitials?: string;
  agentSignature?: string;
  agentName?: string;
  agentEmployeeId?: string;
  agentSignedAt?: string;
  witnessName?: string;
  witnessSignature?: string;
  
  // Additional terms
  additionalTerms?: string[];
  specialConditions?: string[];
  promotionCode?: string;
  promotionDescription?: string;
}

// =============================================================================
// CONSTANTS - Design matching the provided PDFs
// =============================================================================

const COLORS = {
  // Header colors (matching PDF examples)
  headerBg: [15, 23, 42] as [number, number, number],        // #0F172A - Slate 900
  accentTeal: [20, 184, 166] as [number, number, number],    // #14B8A6 - Teal
  
  // Text colors
  text: [30, 41, 59] as [number, number, number],            // #1E293B - Slate 800
  textLight: [100, 116, 139] as [number, number, number],    // #64748B - Slate 500
  textMuted: [148, 163, 184] as [number, number, number],    // #94A3B8 - Slate 400
  
  // UI colors
  white: [255, 255, 255] as [number, number, number],
  background: [248, 250, 252] as [number, number, number],   // #F8FAFC
  border: [203, 213, 225] as [number, number, number],       // #CBD5E1
  
  // Table header
  tableHeader: [51, 65, 85] as [number, number, number],     // #334155 - Slate 700
};

const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 15,
  marginRight: 15,
  marginTop: 20,
  marginBottom: 20,
  get contentWidth() { return this.width - this.marginLeft - this.marginRight; },
  get safeBottom() { return this.height - this.marginBottom - 15; },
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
  }).format(amount).replace("CA", "").trim();
}

// =============================================================================
// PDF GENERATOR CLASS
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
    
    this.doc.setFont("helvetica");
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  
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
    
    // Top teal bar
    this.doc.setFillColor(...COLORS.accentTeal);
    this.doc.rect(0, 0, PAGE.width, 3, "F");
    
    // Header bar
    this.doc.setFillColor(...COLORS.headerBg);
    this.doc.rect(0, 3, PAGE.width, 12, "F");
    
    // Company name left
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("NIVRA TELECOM", PAGE.marginLeft, 11);
    
    // Contract reference right
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.text(`Contrat de services #${this.data.contractNumber}`, PAGE.width - PAGE.marginRight, 11, { align: "right" });
    
    this.y = 22;
  }
  
  private addFooter(): void {
    const totalPages = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      
      const footerY = PAGE.height - 12;
      
      // Separator line
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(PAGE.marginLeft, footerY - 5, PAGE.width - PAGE.marginRight, footerY - 5);
      
      // Generator info
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(6);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text(
        `Generated by Nivra – Contract Engine – Template v2026.01.02-01 – ContractID: ${this.data.contractNumber}`,
        PAGE.width / 2,
        footerY,
        { align: "center" }
      );
      
      // Page number
      this.doc.text(
        `Page ${i} / ${totalPages}`,
        PAGE.width - PAGE.marginRight,
        footerY,
        { align: "right" }
      );
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // SECTION TITLE HELPER
  // ─────────────────────────────────────────────────────────────────────────
  
  private addSectionTitle(title: string, withAccent = false): void {
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...COLORS.headerBg);
    this.doc.text(title, PAGE.marginLeft, this.y);
    
    // Underline
    this.y += 2;
    this.doc.setDrawColor(...(withAccent ? COLORS.accentTeal : COLORS.border));
    this.doc.setLineWidth(withAccent ? 0.8 : 0.3);
    this.doc.line(PAGE.marginLeft, this.y, PAGE.width - PAGE.marginRight, this.y);
    this.doc.setLineWidth(0.2);
    this.y += 5;
  }
  
  private addLabelValue(label: string, value: string, labelWidth = 50): void {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.textLight);
    this.doc.text(`${label}:`, PAGE.marginLeft, this.y);
    
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(value || "—", PAGE.marginLeft + labelWidth, this.y);
    this.y += 5;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1: RÉSUMÉ DU CONTRAT (Cover Page)
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildCoverPage(): void {
    const { data } = this;
    
    // === HEADER ===
    // Top teal bar
    this.doc.setFillColor(...COLORS.accentTeal);
    this.doc.rect(0, 0, PAGE.width, 3, "F");
    
    // Main header
    this.doc.setFillColor(...COLORS.headerBg);
    this.doc.rect(0, 3, PAGE.width, 30, "F");
    
    // Company name
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(22);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("NIVRA TELECOM", PAGE.width / 2, 18, { align: "center" });
    
    // Document type
    this.doc.setFontSize(12);
    this.doc.setTextColor(...COLORS.accentTeal);
    this.doc.text("Résumé du contrat", PAGE.width / 2, 26, { align: "center" });
    
    // Subtitle
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("Prepaye - Province de Quebec", PAGE.width / 2, 32, { align: "center" });
    
    this.y = 42;
    
    // === COMPANY INFO BOX ===
    this.doc.setFillColor(...COLORS.background);
    this.doc.setDrawColor(...COLORS.accentTeal);
    this.doc.setLineWidth(0.8);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 18, 1, 1, "FD");
    this.doc.setLineWidth(0.2);
    
    // Left accent bar
    this.doc.setFillColor(...COLORS.accentTeal);
    this.doc.rect(PAGE.marginLeft, this.y, 3, 18, "F");
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(COMPANY_CONTACT.legalName, PAGE.marginLeft + 8, this.y + 6);
    this.doc.text(COMPANY_CONTACT.fullAddress, PAGE.marginLeft + 8, this.y + 11);
    this.doc.text(`Courriel : ${COMPANY_CONTACT.supportEmailDisplay} | Tél :`, PAGE.marginLeft + 8, this.y + 16);
    
    this.y += 25;
    
    // === IDENTIFICATION DU DOCUMENT ===
    this.addSectionTitle("IDENTIFICATION DU DOCUMENT", true);
    this.addLabelValue("Numéro de document", data.contractNumber);
    this.addLabelValue("Date d'émission", formatDate(data.contractDate));
    
    this.y += 3;
    
    // === INFORMATIONS CLIENT ===
    this.addSectionTitle("INFORMATIONS CLIENT");
    this.addLabelValue("Nom complet", data.clientName);
    this.addLabelValue("Numéro de compte", data.accountNumber);
    this.addLabelValue("Courriel", data.clientEmail);
    this.addLabelValue("Téléphone", data.clientPhone || "Non fourni");
    this.addLabelValue("Adresse de service", `${data.serviceAddress}, ${data.serviceCity}, ${data.serviceProvince}, ${data.servicePostalCode}`);
    this.addLabelValue("Traité par", data.agentName || "Nivra Telecom");
    
    this.y += 3;
    
    // === BLOC A — TARIFS MENSUELS ===
    this.addSectionTitle("BLOC A — TARIFS MENSUELS (RÉCURRENTS)", true);
    
    // Table header
    this.doc.setFillColor(...COLORS.tableHeader);
    this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 7, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.white);
    
    const colType = PAGE.marginLeft + 3;
    const colService = PAGE.marginLeft + 28;
    const colQty = PAGE.marginLeft + 115;
    const colPrice = PAGE.marginLeft + 135;
    const colPeriod = PAGE.marginLeft + 158;
    
    this.doc.text("TYPE", colType, this.y + 5);
    this.doc.text("SERVICE / FORFAIT", colService, this.y + 5);
    this.doc.text("QTÉ", colQty, this.y + 5);
    this.doc.text("PRIX UNIT.", colPrice, this.y + 5);
    this.doc.text("PÉRIODE", colPeriod, this.y + 5);
    
    this.y += 7;
    
    // Service rows
    data.services.forEach((service, idx) => {
      const rowH = 7;
      
      // Alternating background
      if (idx % 2 === 0) {
        this.doc.setFillColor(...COLORS.background);
        this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
      }
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.text);
      
      this.doc.text(service.type, colType, this.y + 5);
      
      // Truncate long service names
      const maxNameLen = 55;
      const displayName = service.name.length > maxNameLen 
        ? service.name.substring(0, maxNameLen - 3) + "..." 
        : service.name;
      this.doc.text(displayName, colService, this.y + 5);
      
      this.doc.text(String(service.quantity || 1), colQty, this.y + 5);
      this.doc.text(formatCurrency(service.monthlyPrice), colPrice, this.y + 5);
      this.doc.text(service.period || "/mois", colPeriod, this.y + 5);
      
      // Row border
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
      
      this.y += rowH;
    });
    
    this.y += 5;
    
    // === BLOC A TOTALS ===
    this.addSectionTitle("BLOC A — TARIFS MENSUELS (RÉCURRENTS)");
    
    const tps = data.monthlySubtotal * 0.05;
    const tvq = data.monthlySubtotal * 0.09975;
    const totalMonthly = data.monthlySubtotal + tps + tvq;
    
    this.addLabelValue("Sous-total mensuel (récurrent)", formatCurrency(data.monthlySubtotal), 100);
    this.addLabelValue("TPS (5%)", formatCurrency(tps), 100);
    this.addLabelValue("TVQ (9.975%)", formatCurrency(tvq), 100);
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("Total mensuel avec taxes", PAGE.marginLeft, this.y);
    this.doc.text(formatCurrency(totalMonthly), PAGE.marginLeft + 100, this.y);
    this.y += 8;
    
    // === BLOC B — FRAIS UNIQUES ===
    this.addSectionTitle("BLOC B — FRAIS UNIQUES (NON RÉCURRENTS)", true);
    
    const oneTimeTotal = data.oneTimeSubtotal || 0;
    const oneTimeTps = oneTimeTotal * 0.05;
    const oneTimeTvq = oneTimeTotal * 0.09975;
    const oneTimeTotalWithTax = oneTimeTotal + oneTimeTps + oneTimeTvq;
    
    this.addLabelValue("Sous-total unique", formatCurrency(oneTimeTotal), 100);
    this.addLabelValue("TPS (5%)", formatCurrency(oneTimeTps), 100);
    this.addLabelValue("TVQ (9.975%)", formatCurrency(oneTimeTvq), 100);
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("Total frais uniques avec taxes", PAGE.marginLeft, this.y);
    this.doc.text(formatCurrency(oneTimeTotalWithTax), PAGE.marginLeft + 100, this.y);
    this.y += 8;
    
    // === TOTAL À PAYER AUJOURD'HUI ===
    this.addSectionTitle("TOTAL À PAYER AUJOURD'HUI", true);
    
    this.addLabelValue("Mensuel (premier mois)", formatCurrency(totalMonthly), 100);
    this.addLabelValue("Frais uniques", formatCurrency(oneTimeTotalWithTax), 100);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 2: GRAND TOTAL
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildGrandTotalPage(): void {
    this.addNewPage();
    
    const { data } = this;
    
    // Section title
    this.addSectionTitle("GRAND TOTAL", true);
    
    this.y += 10;
    
    // Big total display
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(36);
    this.doc.setTextColor(...COLORS.headerBg);
    this.doc.text(formatCurrency(data.totalFirstPayment) + " CAD", PAGE.width / 2, this.y, { align: "center" });
    
    this.y += 20;
    
    // Breakdown
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.textLight);
    this.doc.text(`Premier paiement : ${formatCurrency(data.totalFirstPayment)}`, PAGE.width / 2, this.y, { align: "center" });
    this.y += 6;
    this.doc.text(`Mensuel récurrent : ${formatCurrency(data.monthlyTotal)} /mois`, PAGE.width / 2, this.y, { align: "center" });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 3: ACCEPTATION + SIGNATURES + BADGE ÉLECTRONIQUE
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildAcceptancePage(): void {
    this.addNewPage();
    
    const { data } = this;
    
    // === ACCEPTATION DES ANNEXES ===
    this.addSectionTitle("ACCEPTATION DES ANNEXES", true);
    
    const annexesList = [
      "Annexe A — Termes et conditions (Nivra Telecom)",
      "Annexe B — Conditions spécifiques par service",
      "Annexe C — Politique d'installation et rendez-vous",
      "Annexe D — Modalités de paiement (incluant e-Transfer)",
      "Annexe E — Support, tickets, SLA (optionnel B2B) et clauses avancées",
    ];
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    
    annexesList.forEach(annexe => {
      this.doc.text(`• ${annexe}`, PAGE.marginLeft + 5, this.y);
      this.y += 6;
    });
    
    this.y += 5;
    
    // Acceptance statement
    const acceptText = "En signant ce contrat, le client confirme avoir lu, compris et accepté les Annexes A à E ci-jointes, qui font partie intégrante du présent contrat.";
    const acceptLines = this.doc.splitTextToSize(acceptText, PAGE.contentWidth);
    this.doc.text(acceptLines, PAGE.marginLeft, this.y);
    this.y += acceptLines.length * 5 + 8;
    
    // === IMPORTANT — FACTURATION PRÉPAYÉE ===
    this.doc.setFillColor(...COLORS.background);
    this.doc.setDrawColor(...COLORS.accentTeal);
    this.doc.setLineWidth(0.8);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 30, 2, 2, "FD");
    this.doc.setLineWidth(0.2);
    
    // Left accent
    this.doc.setFillColor(...COLORS.accentTeal);
    this.doc.rect(PAGE.marginLeft, this.y, 3, 30, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.headerBg);
    this.doc.text("IMPORTANT — FACTURATION PRÉPAYÉE (INTERAC SEULEMENT)", PAGE.marginLeft + 10, this.y + 8);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`Paiement uniquement par virement Interac à ${COMPANY_CONTACT.supportEmailDisplay}.`, PAGE.marginLeft + 10, this.y + 15);
    this.doc.text("Le service est activé dès réception et confirmation du paiement.", PAGE.marginLeft + 10, this.y + 21);
    this.doc.text("Le cycle de facturation commence uniquement à la date de confirmation du paiement Interac et dure 30 jours.", PAGE.marginLeft + 10, this.y + 27);
    
    this.y += 40;
    
    // === SIGNATURES ===
    this.addSectionTitle("SIGNATURES", true);
    
    const sigBoxW = (PAGE.contentWidth - 10) / 2;
    const sigBoxH = 55;
    
    // === POUR NIVRA TELECOM ===
    this.doc.setFillColor(...COLORS.background);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, sigBoxW, sigBoxH, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.headerBg);
    this.doc.text("POUR NIVRA TELECOM", PAGE.marginLeft + sigBoxW / 2, this.y + 10, { align: "center" });
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    
    if (data.agentName) {
      this.doc.text(`Nom: ${data.agentName}`, PAGE.marginLeft + 5, this.y + 25);
    }
    
    this.doc.text("Signature: _______________________", PAGE.marginLeft + 5, this.y + 35);
    this.doc.text("Date: _______________________", PAGE.marginLeft + 5, this.y + 45);
    
    // === POUR LE CLIENT ===
    const clientBoxX = PAGE.marginLeft + sigBoxW + 10;
    
    // Different background if signed
    if (data.clientSignature) {
      this.doc.setFillColor(240, 253, 244); // Light green bg
      this.doc.setDrawColor(34, 197, 94);    // Green border
    } else {
      this.doc.setFillColor(...COLORS.white);
      this.doc.setDrawColor(...COLORS.border);
    }
    this.doc.roundedRect(clientBoxX, this.y, sigBoxW, sigBoxH, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.headerBg);
    this.doc.text("POUR LE CLIENT", clientBoxX + sigBoxW / 2, this.y + 10, { align: "center" });
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`Nom: ${data.clientName}`, clientBoxX + 5, this.y + 20);
    
    // Display signature - either typed (cursive style) or blank line
    if (data.clientSignature) {
      // Typed signature - render in italic style to simulate cursive
      this.doc.setFont("times", "bolditalic");
      this.doc.setFontSize(16);
      this.doc.setTextColor(30, 58, 138); // Dark blue for signature
      
      // Center the signature in the box
      const sigWidth = this.doc.getStringUnitWidth(data.clientSignature) * 16 / this.doc.internal.scaleFactor;
      const sigX = clientBoxX + (sigBoxW - sigWidth) / 2;
      this.doc.text(data.clientSignature, sigX, this.y + 35);
      
      // Signature line underneath
      this.doc.setDrawColor(30, 58, 138);
      this.doc.setLineWidth(0.3);
      this.doc.line(clientBoxX + 10, this.y + 38, clientBoxX + sigBoxW - 10, this.y + 38);
      this.doc.setLineWidth(0.2);
      
      // Reset font
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.text);
      
      // Date of signature
      if (data.clientSignedAt) {
        const signedDate = format(new Date(data.clientSignedAt), "d MMMM yyyy", { locale: fr });
        this.doc.text(`Date: ${signedDate}`, clientBoxX + 5, this.y + 48);
      }
    } else {
      // Blank signature line
      this.doc.text("Signature: _______________________", clientBoxX + 5, this.y + 35);
      this.doc.text("Date: _______________________", clientBoxX + 5, this.y + 45);
    }
    
    this.y += sigBoxH + 15;
    
    // === SIGNÉ ÉLECTRONIQUEMENT ===
    if (data.clientSignedAt && data.clientSignature) {
      this.doc.setFillColor(...COLORS.accentTeal);
      this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 30, 3, 3, "F");
      
      // Checkmark icon area
      this.doc.setFillColor(255, 255, 255);
      this.doc.circle(PAGE.marginLeft + 15, this.y + 15, 8, "F");
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(14);
      this.doc.setTextColor(20, 184, 166);
      this.doc.text("✓", PAGE.marginLeft + 12, this.y + 19);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(12);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("CONTRAT SIGNÉ ÉLECTRONIQUEMENT", PAGE.marginLeft + 30, this.y + 12);
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      const signedDate = format(new Date(data.clientSignedAt), "d MMMM yyyy 'à' HH 'h' mm", { locale: fr });
      this.doc.text(`Signé par ${data.clientName} le ${signedDate}`, PAGE.marginLeft + 30, this.y + 22);
      
      this.y += 35;
      
      // Legal text about electronic signature
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textMuted);
      const legalText = "Cette signature électronique est juridiquement valide conformément à la Loi concernant le cadre juridique des technologies de l'information (L.R.Q., c. C-1.1) du Québec.";
      const legalLines = this.doc.splitTextToSize(legalText, PAGE.contentWidth);
      this.doc.text(legalLines, PAGE.marginLeft, this.y);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGES 4+: ANNEXES A → E
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildAnnexes(): void {
    ALL_ANNEXES.forEach(annexe => {
      this.addNewPage();
      this.renderAnnexe(annexe);
    });
  }
  
  private renderAnnexe(annexe: AnnexeSection): void {
    // Annexe title in teal
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.setTextColor(...COLORS.accentTeal);
    this.doc.text(annexe.title, PAGE.marginLeft, this.y);
    
    // Underline
    this.y += 3;
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(PAGE.marginLeft, this.y, PAGE.width - PAGE.marginRight, this.y);
    this.y += 8;
    
    // Sections
    annexe.sections.forEach(section => {
      this.checkPageBreak(20);
      
      // Section title
      const sectionTitle = section.number 
        ? `(${section.number}) ${section.title}` 
        : section.title;
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(sectionTitle, PAGE.marginLeft, this.y);
      
      this.y += 5;
      
      // Paragraphs
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.text);
      
      section.paragraphs.forEach(para => {
        const lines = this.doc.splitTextToSize(para, PAGE.contentWidth);
        const lineHeight = 3.8;
        const neededSpace = lines.length * lineHeight + 3;
        
        this.checkPageBreak(neededSpace);
        
        this.doc.text(lines, PAGE.marginLeft, this.y);
        this.y += neededSpace;
      });
      
      this.y += 3;
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────
  
  public build(): jsPDF {
    // Page 1: Résumé du contrat
    this.buildCoverPage();
    
    // Page 2: Grand Total
    this.buildGrandTotalPage();
    
    // Page 3: Acceptation + Signatures
    this.buildAcceptancePage();
    
    // Pages 4+: Annexes A → E
    this.buildAnnexes();
    
    // Add footers to all pages
    this.addFooter();
    
    return this.doc;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export function generateContractV2PDF(data: ContractV2Data): jsPDF {
  const builder = new ContractPDFBuilder(data);
  return builder.build();
}

export function downloadContractV2PDF(data: ContractV2Data): void {
  const doc = generateContractV2PDF(data);
  const fileName = `Contrat_${data.contractNumber}_${data.clientName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

export default generateContractV2PDF;
