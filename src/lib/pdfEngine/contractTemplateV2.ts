/**
 * Nivra Contract Template V2 - PROFESSIONAL MULTI-PAGE CONTRACT
 * Enterprise-grade telecom service agreement (Rogers-style)
 * 
 * Structure (8+ pages):
 * - Page 1: Cover page with contract summary
 * - Page 2: Client information & service address details
 * - Page 3: Complete service breakdown with line-by-line pricing
 * - Page 4: Equipment details & installation terms
 * - Page 5-7: Complete legal terms (Annexes A-E integrated)
 * - Page 8+: Signature pages with full legal acknowledgment
 * 
 * Features:
 * - Professional header/footer on every page
 * - Dual signature blocks with witness fields
 * - Complete legal annexes inline
 * - Barcode/QR reference area
 * - Detailed payment breakdown
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
// CONSTANTS
// =============================================================================

const COLORS = {
  // Primary brand colors
  primary: [0, 51, 102] as [number, number, number],        // #003366 - Deep Navy
  primaryLight: [0, 102, 204] as [number, number, number],  // #0066CC - Brand Blue
  accent: [20, 184, 166] as [number, number, number],       // #14B8A6 - Teal
  accentDark: [13, 148, 136] as [number, number, number],   // #0D9488
  
  // Text colors
  text: [30, 41, 59] as [number, number, number],           // #1E293B - Slate 800
  textLight: [100, 116, 139] as [number, number, number],   // #64748B - Slate 500
  textMuted: [148, 163, 184] as [number, number, number],   // #94A3B8 - Slate 400
  
  // UI colors
  white: [255, 255, 255] as [number, number, number],
  background: [248, 250, 252] as [number, number, number],  // #F8FAFC
  border: [226, 232, 240] as [number, number, number],      // #E2E8F0
  borderDark: [203, 213, 225] as [number, number, number],  // #CBD5E1
  
  // Status colors
  success: [34, 197, 94] as [number, number, number],       // #22C55E
  warning: [245, 158, 11] as [number, number, number],      // #F59E0B
  error: [239, 68, 68] as [number, number, number],         // #EF4444
  
  // Special
  highlight: [254, 243, 199] as [number, number, number],   // #FEF3C7 - Amber 100
  infoLight: [219, 234, 254] as [number, number, number],   // #DBEAFE - Blue 100
};

const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 15,
  marginRight: 15,
  marginTop: 25,
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

function formatDateShort(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: fr });
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
// PDF GENERATOR CLASS
// =============================================================================

class ContractPDFBuilder {
  private doc: jsPDF;
  private y: number;
  private pageNum: number;
  private totalPages: number;
  private data: ContractV2Data;
  
  constructor(data: ContractV2Data) {
    this.doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    this.data = data;
    this.y = PAGE.marginTop;
    this.pageNum = 1;
    this.totalPages = 1;
    
    // Set default font
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
    this.totalPages = Math.max(this.totalPages, this.pageNum);
    
    // White background
    this.doc.setFillColor(...COLORS.white);
    this.doc.rect(0, 0, PAGE.width, PAGE.height, "F");
    
    // Top accent bar
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(0, 0, PAGE.width, 3, "F");
    
    // Header
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("NIVRA TELECOM", PAGE.marginLeft, 12);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(`ENTENTE DE SERVICE — ${this.data.contractNumber}`, PAGE.width / 2, 12, { align: "center" });
    this.doc.text(`Page ${this.pageNum}`, PAGE.width - PAGE.marginRight, 12, { align: "right" });
    
    // Header line
    this.doc.setDrawColor(...COLORS.border);
    this.doc.line(PAGE.marginLeft, 16, PAGE.width - PAGE.marginRight, 16);
    
    this.y = 22;
  }
  
  private addFooters(): void {
    const totalPages = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      
      const footerY = PAGE.height - 18;
      
      // Footer separator
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(PAGE.marginLeft, footerY - 3, PAGE.width - PAGE.marginRight, footerY - 3);
      
      // Company info
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
      
      // Contract reference
      this.doc.text(
        `Contrat: ${this.data.contractNumber} | Compte: ${this.data.accountNumber}`,
        PAGE.width / 2,
        footerY + 4,
        { align: "center" }
      );
      
      // Page number
      this.doc.setFont("helvetica", "bold");
      this.doc.text(
        `Page ${i} de ${totalPages}`,
        PAGE.width - PAGE.marginRight,
        footerY,
        { align: "right" }
      );
      
      // Confidentiality notice
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(5);
      this.doc.text(
        "Document confidentiel — Usage interne et client uniquement",
        PAGE.width - PAGE.marginRight,
        footerY + 4,
        { align: "right" }
      );
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1: COVER PAGE
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildCoverPage(): void {
    const { data } = this;
    
    // Top accent bar
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(0, 0, PAGE.width, 4, "F");
    
    // Main header block
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(0, 4, PAGE.width, 45, "F");
    
    // Company name
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(28);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("NIVRA TELECOM", PAGE.marginLeft, 25);
    
    // Tagline
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(11);
    this.doc.text("Services de télécommunications prépayés au Québec", PAGE.marginLeft, 34);
    
    // Document type
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.text("ENTENTE DE SERVICE", PAGE.width - PAGE.marginRight, 28, { align: "right" });
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.text("Contrat légal et conditions", PAGE.width - PAGE.marginRight, 36, { align: "right" });
    
    this.y = 55;
    
    // === DOCUMENT REFERENCE BOX ===
    this.doc.setFillColor(...COLORS.background);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 22, 2, 2, "FD");
    
    const refY = this.y + 7;
    const colWidth = PAGE.contentWidth / 5;
    
    const refs = [
      { label: "N° CONTRAT", value: data.contractNumber },
      { label: "N° COMPTE", value: data.accountNumber },
      { label: "DATE", value: formatDateShort(data.contractDate) },
      { label: "ACTIVATION", value: data.activationDate ? formatDateShort(data.activationDate) : "À confirmer" },
      { label: "COMMANDE", value: data.orderNumber || "—" },
    ];
    
    refs.forEach((ref, i) => {
      const x = PAGE.marginLeft + 5 + (i * colWidth);
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(6);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text(ref.label, x, refY);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(ref.value, x, refY + 6);
    });
    
    this.y += 28;
    
    // === CLIENT SUMMARY ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("TITULAIRE DU COMPTE", PAGE.marginLeft, this.y);
    
    this.y += 5;
    
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 28, 2, 2, "FD");
    
    // Left side - Client name and contact
    const clientY = this.y + 7;
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.clientName, PAGE.marginLeft + 5, clientY);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.textLight);
    this.doc.text(`Courriel: ${data.clientEmail}`, PAGE.marginLeft + 5, clientY + 7);
    this.doc.text(`Téléphone: ${data.clientPhone || "Non fourni"}`, PAGE.marginLeft + 5, clientY + 13);
    
    if (data.clientDateOfBirth) {
      this.doc.text(`Date de naissance: ${formatDate(data.clientDateOfBirth)}`, PAGE.marginLeft + 5, clientY + 19);
    }
    
    // Right side - Address
    const addrX = PAGE.marginLeft + PAGE.contentWidth / 2 + 5;
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("ADRESSE DE SERVICE", addrX, clientY);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.serviceAddress, addrX, clientY + 6);
    this.doc.text(`${data.serviceCity}, ${data.serviceProvince} ${data.servicePostalCode}`, addrX, clientY + 12);
    
    this.y += 34;
    
    // === SERVICES SUMMARY ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("RÉSUMÉ DES SERVICES", PAGE.marginLeft, this.y);
    
    this.y += 5;
    
    // Services table header
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 8, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("TYPE", PAGE.marginLeft + 3, this.y + 5.5);
    this.doc.text("SERVICE", PAGE.marginLeft + 30, this.y + 5.5);
    this.doc.text("DESCRIPTION", PAGE.marginLeft + 90, this.y + 5.5);
    this.doc.text("PRIX/MOIS", PAGE.width - PAGE.marginRight - 3, this.y + 5.5, { align: "right" });
    
    this.y += 8;
    
    // Service rows
    data.services.forEach((service, idx) => {
      const rowH = 12;
      const rowY = this.y;
      
      // Alternating background
      if (idx % 2 === 0) {
        this.doc.setFillColor(...COLORS.background);
        this.doc.rect(PAGE.marginLeft, rowY, PAGE.contentWidth, rowH, "F");
      }
      
      // Type badge
      this.doc.setFillColor(...COLORS.accent);
      this.doc.roundedRect(PAGE.marginLeft + 3, rowY + 3, 24, 6, 1, 1, "F");
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(5);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text(service.type.toUpperCase(), PAGE.marginLeft + 15, rowY + 7, { align: "center" });
      
      // Service name
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(service.name, PAGE.marginLeft + 30, rowY + 7);
      
      // Description
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textLight);
      const desc = service.description || "";
      const truncDesc = desc.length > 40 ? desc.substring(0, 37) + "..." : desc;
      this.doc.text(truncDesc, PAGE.marginLeft + 90, rowY + 7);
      
      // Price
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(formatCurrency(service.monthlyPrice), PAGE.width - PAGE.marginRight - 3, rowY + 7, { align: "right" });
      
      // Border
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(PAGE.marginLeft, rowY + rowH, PAGE.width - PAGE.marginRight, rowY + rowH);
      
      this.y += rowH;
    });
    
    this.y += 8;
    
    // === TOTALS BOX ===
    const totalsW = 90;
    const totalsX = PAGE.width - PAGE.marginRight - totalsW;
    
    this.doc.setFillColor(...COLORS.background);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(totalsX, this.y, totalsW, 55, 2, 2, "FD");
    
    let tY = this.y + 8;
    const labelX = totalsX + 5;
    const valueX = totalsX + totalsW - 5;
    
    const addTotalRow = (label: string, value: number, opts: { bold?: boolean; highlight?: boolean; negative?: boolean } = {}) => {
      this.doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      this.doc.setFontSize(opts.bold ? 9 : 8);
      this.doc.setTextColor(...(opts.highlight ? COLORS.primary : opts.negative ? COLORS.success : COLORS.text));
      this.doc.text(label, labelX, tY);
      this.doc.text((opts.negative ? "-" : "") + formatCurrency(Math.abs(value)), valueX, tY, { align: "right" });
      tY += 7;
    };
    
    addTotalRow("Services mensuels", data.monthlySubtotal);
    
    if (data.oneTimeSubtotal && data.oneTimeSubtotal > 0) {
      addTotalRow("Frais uniques", data.oneTimeSubtotal);
    }
    
    if (data.discounts && data.discounts.length > 0) {
      const discTotal = data.discounts.reduce((sum, d) => sum + d.amount, 0);
      addTotalRow("Rabais", discTotal, { negative: true });
    }
    
    addTotalRow("TPS (5%)", data.tps);
    addTotalRow("TVQ (9.975%)", data.tvq);
    
    // Separator
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.line(labelX, tY - 3, valueX, tY - 3);
    tY += 2;
    
    // Total
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("PREMIER PAIEMENT", labelX, tY);
    this.doc.setFontSize(14);
    this.doc.text(formatCurrency(data.totalFirstPayment), valueX, tY, { align: "right" });
    
    tY += 8;
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(`Mensuel récurrent: ${formatCurrency(data.monthlyTotal)}`, labelX, tY);
    
    this.y += 62;
    
    // === PAYMENT NOTICE ===
    this.doc.setFillColor(...COLORS.highlight);
    this.doc.setDrawColor(...COLORS.warning);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 22, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("💳 MODALITÉS DE PAIEMENT — VIREMENT INTERAC UNIQUEMENT", PAGE.marginLeft + 5, this.y + 7);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.text(`Envoyer le paiement à: ${COMPANY_CONTACT.supportEmailDisplay}`, PAGE.marginLeft + 5, this.y + 13);
    this.doc.text("Le cycle de facturation de 30 jours débute uniquement après confirmation du paiement.", PAGE.marginLeft + 5, this.y + 18);
    
    this.y += 28;
    
    // === DOCUMENT LIST ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("CE CONTRAT COMPREND", PAGE.marginLeft, this.y);
    
    this.y += 5;
    
    const docList = [
      "1. Résumé du contrat et informations client (cette page)",
      "2. Détails complets des services et équipements",
      "3. Annexe A — Termes et conditions générales",
      "4. Annexe B — Conditions spécifiques par service",
      "5. Annexe C — Politique d'installation et rendez-vous",
      "6. Annexe D — Modalités de paiement",
      "7. Annexe E — Support, tickets et SLA",
      "8. Page de signatures et reconnaissance légale",
    ];
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textLight);
    
    const halfLen = Math.ceil(docList.length / 2);
    docList.forEach((item, i) => {
      const x = i < halfLen ? PAGE.marginLeft + 5 : PAGE.marginLeft + PAGE.contentWidth / 2;
      const row = i < halfLen ? i : i - halfLen;
      this.doc.text(item, x, this.y + (row * 5));
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 2: DETAILED CLIENT & ADDRESS INFO
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildClientDetailsPage(): void {
    this.addNewPage();
    
    const { data } = this;
    
    // Section title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("INFORMATIONS DÉTAILLÉES DU CLIENT", PAGE.marginLeft, this.y);
    
    this.y += 10;
    
    // Client info box
    this.doc.setFillColor(...COLORS.infoLight);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 45, 2, 2, "FD");
    
    let infoY = this.y + 8;
    const col1 = PAGE.marginLeft + 5;
    const col2 = PAGE.marginLeft + PAGE.contentWidth / 2;
    
    const addInfoRow = (label: string, value: string, x: number) => {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text(label, x, infoY);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(value || "—", x, infoY + 6);
    };
    
    addInfoRow("NOM COMPLET", data.clientName, col1);
    addInfoRow("NUMÉRO DE COMPTE", data.accountNumber, col2);
    infoY += 14;
    
    addInfoRow("COURRIEL", data.clientEmail, col1);
    addInfoRow("TÉLÉPHONE", data.clientPhone || "Non fourni", col2);
    infoY += 14;
    
    addInfoRow("DATE DE NAISSANCE", data.clientDateOfBirth ? formatDate(data.clientDateOfBirth) : "Non fournie", col1);
    addInfoRow("DATE DU CONTRAT", formatDate(data.contractDate), col2);
    
    this.y += 52;
    
    // Addresses section
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("ADRESSES", PAGE.marginLeft, this.y);
    
    this.y += 8;
    
    // Two address boxes side by side
    const boxW = (PAGE.contentWidth - 10) / 2;
    
    // Service address
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.accent);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(PAGE.marginLeft, this.y, boxW, 35, 2, 2, "FD");
    this.doc.setLineWidth(0.2);
    
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(PAGE.marginLeft, this.y, boxW, 8, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("📍 ADRESSE DE SERVICE", PAGE.marginLeft + 5, this.y + 5.5);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(data.serviceAddress, PAGE.marginLeft + 5, this.y + 16);
    this.doc.text(`${data.serviceCity}, ${data.serviceProvince}`, PAGE.marginLeft + 5, this.y + 22);
    this.doc.text(data.servicePostalCode, PAGE.marginLeft + 5, this.y + 28);
    
    // Billing address
    const billX = PAGE.marginLeft + boxW + 10;
    
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(billX, this.y, boxW, 35, 2, 2, "FD");
    this.doc.setLineWidth(0.2);
    
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(billX, this.y, boxW, 8, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("📬 ADRESSE DE FACTURATION", billX + 5, this.y + 5.5);
    
    const billAddr = data.billingAddress || data.serviceAddress;
    const billCity = data.billingCity || data.serviceCity;
    const billProv = data.billingProvince || data.serviceProvince;
    const billPostal = data.billingPostalCode || data.servicePostalCode;
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(billAddr, billX + 5, this.y + 16);
    this.doc.text(`${billCity}, ${billProv}`, billX + 5, this.y + 22);
    this.doc.text(billPostal, billX + 5, this.y + 28);
    
    this.y += 42;
    
    // Equipment section (if applicable)
    if (data.equipment && data.equipment.length > 0) {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(12);
      this.doc.setTextColor(...COLORS.primary);
      this.doc.text("ÉQUIPEMENT INCLUS", PAGE.marginLeft, this.y);
      
      this.y += 6;
      
      // Equipment table header
      this.doc.setFillColor(...COLORS.primary);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 7, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("ÉQUIPEMENT", PAGE.marginLeft + 5, this.y + 5);
      this.doc.text("NUMÉRO DE SÉRIE", PAGE.marginLeft + 80, this.y + 5);
      this.doc.text("STATUT", PAGE.marginLeft + 140, this.y + 5);
      
      this.y += 7;
      
      data.equipment.forEach((eq, idx) => {
        const rowH = 8;
        
        if (idx % 2 === 0) {
          this.doc.setFillColor(...COLORS.background);
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(eq.name, PAGE.marginLeft + 5, this.y + 5.5);
        this.doc.text(eq.serialNumber || "—", PAGE.marginLeft + 80, this.y + 5.5);
        
        const statusLabel = eq.status === "owned" ? "Vendu" : eq.status === "rented" ? "Location" : "Inclus";
        this.doc.text(statusLabel, PAGE.marginLeft + 140, this.y + 5.5);
        
        this.doc.setDrawColor(...COLORS.border);
        this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
        
        this.y += rowH;
      });
      
      this.y += 10;
    }
    
    // Special conditions (if any)
    if (data.specialConditions && data.specialConditions.length > 0) {
      this.checkPageBreak(30);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.setTextColor(...COLORS.warning);
      this.doc.text("⚠️ CONDITIONS SPÉCIALES", PAGE.marginLeft, this.y);
      
      this.y += 6;
      
      this.doc.setFillColor(255, 251, 235); // amber-50
      this.doc.setDrawColor(...COLORS.warning);
      this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 6 + data.specialConditions.length * 5, 2, 2, "FD");
      
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.text);
      
      data.specialConditions.forEach((cond, i) => {
        this.doc.text(`• ${cond}`, PAGE.marginLeft + 5, this.y + 5 + (i * 5));
      });
      
      this.y += 10 + data.specialConditions.length * 5;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 3+: DETAILED SERVICE BREAKDOWN
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildServiceDetailsPage(): void {
    this.addNewPage();
    
    const { data } = this;
    
    // Section title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("DÉTAIL COMPLET DES SERVICES", PAGE.marginLeft, this.y);
    
    this.y += 10;
    
    // Group by service type
    const serviceTypes = [...new Set(data.services.map(s => s.type))];
    
    serviceTypes.forEach(type => {
      this.checkPageBreak(35);
      
      const typeServices = data.services.filter(s => s.type === type);
      const typeTotal = typeServices.reduce((sum, s) => sum + (s.monthlyPrice * (s.quantity || 1)), 0);
      
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
      this.doc.text(formatCurrency(typeTotal) + " /mois", PAGE.width - PAGE.marginRight - 5, this.y + 7, { align: "right" });
      
      this.y += 12;
      
      // Service rows with full details
      typeServices.forEach((service, idx) => {
        const hasDetails = service.details && service.details.length > 0;
        const rowH = hasDetails ? 20 + (service.details!.length * 4) : 18;
        
        this.checkPageBreak(rowH + 5);
        
        // Background
        const bgColor = idx % 2 === 0 ? COLORS.background : COLORS.white;
        this.doc.setFillColor(...bgColor);
        this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        
        // Service name
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(10);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(service.name, PAGE.marginLeft + 5, this.y + 7);
        
    // Quantity badge
    if (service.quantity && service.quantity > 1) {
      const nameWidth = this.doc.getStringUnitWidth(service.name) * 10 / this.doc.internal.scaleFactor;
      this.doc.setFillColor(...COLORS.accent);
      this.doc.roundedRect(PAGE.marginLeft + 5 + nameWidth + 5, this.y + 2, 15, 6, 1, 1, "F");
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(6);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text(`x${service.quantity}`, PAGE.marginLeft + 5 + nameWidth + 12, this.y + 6, { align: "center" });
    }
        

        // Description
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.textLight);
        if (service.description) {
          this.doc.text(service.description, PAGE.marginLeft + 5, this.y + 13);
        }
        
        // Price
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(11);
        this.doc.setTextColor(...COLORS.primary);
        const price = service.monthlyPrice * (service.quantity || 1);
        this.doc.text(formatCurrency(price), PAGE.width - PAGE.marginRight - 5, this.y + 7, { align: "right" });
        
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(7);
        this.doc.setTextColor(...COLORS.textMuted);
        this.doc.text(service.period || "/mois", PAGE.width - PAGE.marginRight - 5, this.y + 13, { align: "right" });
        
        // Details list
        if (hasDetails) {
          let detailY = this.y + 18;
          this.doc.setFont("helvetica", "normal");
          this.doc.setFontSize(7);
          this.doc.setTextColor(...COLORS.textLight);
          
          service.details!.forEach(detail => {
            this.doc.text(`  • ${detail}`, PAGE.marginLeft + 10, detailY);
            detailY += 4;
          });
        }
        
        // Border
        this.doc.setDrawColor(...COLORS.border);
        this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
        
        this.y += rowH;
      });
      
      this.y += 10;
    });
    
    // === ONE-TIME FEES ===
    if (data.oneTimeFees && data.oneTimeFees.length > 0) {
      this.checkPageBreak(30);
      
      this.doc.setFillColor(...COLORS.warning);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 8, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("💰 FRAIS UNIQUES (PREMIER PAIEMENT SEULEMENT)", PAGE.marginLeft + 5, this.y + 5.5);
      
      const onetimeTotal = data.oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
      this.doc.text(formatCurrency(onetimeTotal), PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
      
      this.y += 10;
      
      data.oneTimeFees.forEach((fee, idx) => {
        const rowH = 8;
        
        if (idx % 2 === 0) {
          this.doc.setFillColor(...COLORS.background);
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(fee.label, PAGE.marginLeft + 5, this.y + 5.5);
        
        if (fee.description) {
          this.doc.setFontSize(7);
          this.doc.setTextColor(...COLORS.textMuted);
          this.doc.text(fee.description, PAGE.marginLeft + 80, this.y + 5.5);
        }
        
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(formatCurrency(fee.amount), PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
        
        this.doc.setDrawColor(...COLORS.border);
        this.doc.line(PAGE.marginLeft, this.y + rowH, PAGE.width - PAGE.marginRight, this.y + rowH);
        
        this.y += rowH;
      });
      
      this.y += 10;
    }
    
    // === DISCOUNTS ===
    if (data.discounts && data.discounts.length > 0) {
      this.checkPageBreak(25);
      
      this.doc.setFillColor(...COLORS.success);
      this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 8, "F");
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text("🎉 RABAIS ET PROMOTIONS", PAGE.marginLeft + 5, this.y + 5.5);
      
      const discTotal = data.discounts.reduce((sum, d) => sum + d.amount, 0);
      this.doc.text(`-${formatCurrency(discTotal)}`, PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
      
      this.y += 10;
      
      data.discounts.forEach((disc, idx) => {
        const rowH = 8;
        
        if (idx % 2 === 0) {
          this.doc.setFillColor(220, 252, 231); // green-100
          this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, rowH, "F");
        }
        
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(8);
        this.doc.setTextColor(...COLORS.success);
        this.doc.text(disc.label, PAGE.marginLeft + 5, this.y + 5.5);
        
        this.doc.setFont("helvetica", "bold");
        this.doc.text(`-${formatCurrency(disc.amount)}`, PAGE.width - PAGE.marginRight - 5, this.y + 5.5, { align: "right" });
        
        this.y += rowH;
      });
      
      this.y += 10;
    }
    
    // === GRAND TOTAL ===
    this.checkPageBreak(50);
    
    const totalBoxW = 100;
    const totalBoxX = PAGE.width - PAGE.marginRight - totalBoxW;
    
    this.doc.setFillColor(...COLORS.primary);
    this.doc.roundedRect(totalBoxX, this.y, totalBoxW, 45, 3, 3, "F");
    
    let totY = this.y + 10;
    
    const addFinalRow = (label: string, value: number, isMain = false) => {
      this.doc.setFont("helvetica", isMain ? "bold" : "normal");
      this.doc.setFontSize(isMain ? 10 : 8);
      this.doc.setTextColor(...COLORS.white);
      this.doc.text(label, totalBoxX + 5, totY);
      this.doc.text(formatCurrency(value), totalBoxX + totalBoxW - 5, totY, { align: "right" });
      totY += isMain ? 10 : 6;
    };
    
    addFinalRow("Sous-total", data.monthlySubtotal + (data.oneTimeSubtotal || 0));
    addFinalRow("TPS", data.tps);
    addFinalRow("TVQ", data.tvq);
    
    this.doc.setDrawColor(...COLORS.accent);
    this.doc.line(totalBoxX + 5, totY - 3, totalBoxX + totalBoxW - 5, totY - 3);
    totY += 3;
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(...COLORS.accent);
    this.doc.text("TOTAL DÛ", totalBoxX + 5, totY);
    this.doc.setFontSize(16);
    this.doc.text(formatCurrency(data.totalFirstPayment), totalBoxX + totalBoxW - 5, totY, { align: "right" });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PAGES 4+: LEGAL ANNEXES
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildAnnexes(): void {
    ALL_ANNEXES.forEach(annexe => {
      this.addNewPage();
      this.renderAnnexe(annexe);
    });
  }
  
  private renderAnnexe(annexe: AnnexeSection): void {
    // Annexe header
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(PAGE.marginLeft, this.y, PAGE.contentWidth, 12, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text(annexe.title, PAGE.marginLeft + 5, this.y + 8);
    
    this.y += 16;
    
    // Sections
    annexe.sections.forEach(section => {
      this.checkPageBreak(25);
      
      // Section title
      const sectionTitle = section.number 
        ? `${section.number}. ${section.title}` 
        : section.title;
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...COLORS.primary);
      this.doc.text(sectionTitle, PAGE.marginLeft, this.y);
      
      this.y += 5;
      
      // Paragraphs
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...COLORS.text);
      
      section.paragraphs.forEach(para => {
        const lines = this.doc.splitTextToSize(para, PAGE.contentWidth - 8);
        const lineHeight = 3.5;
        const neededSpace = lines.length * lineHeight + 3;
        
        this.checkPageBreak(neededSpace);
        
        this.doc.text(lines, PAGE.marginLeft + 4, this.y);
        this.y += neededSpace;
      });
      
      this.y += 4;
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // FINAL PAGE: SIGNATURES
  // ─────────────────────────────────────────────────────────────────────────
  
  private buildSignaturePage(): void {
    this.addNewPage();
    
    // Title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text("SIGNATURES ET RECONNAISSANCE LÉGALE", PAGE.marginLeft, this.y);
    
    this.y += 8;
    
    // Legal acknowledgment text
    this.doc.setFillColor(...COLORS.infoLight);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 35, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    
    const ackText = [
      "En signant ce document, je reconnais avoir lu et compris l'entente de service complète, incluant:",
      "",
      "• Les termes et conditions générales (Annexe A)",
      "• Les conditions spécifiques aux services souscrits (Annexe B)",
      "• La politique d'installation et de rendez-vous (Annexe C)",
      "• Les modalités de paiement, incluant les paiements par Interac uniquement (Annexe D)",
      "• Les engagements de support et de service (Annexe E)",
      "",
      "Je comprends que les services sont prépayés et que le cycle de 30 jours débute après confirmation du paiement.",
    ];
    
    let ackY = this.y + 6;
    ackText.forEach(line => {
      this.doc.text(line, PAGE.marginLeft + 5, ackY);
      ackY += 4;
    });
    
    this.y += 42;
    
    // Signature boxes
    const sigBoxW = (PAGE.contentWidth - 15) / 2;
    const sigBoxH = 70;
    
    // === CLIENT SIGNATURE ===
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(PAGE.marginLeft, this.y, sigBoxW, sigBoxH, 3, 3, "FD");
    this.doc.setLineWidth(0.2);
    
    // Header
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(PAGE.marginLeft, this.y, sigBoxW, 10, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("✍️ SIGNATURE DU CLIENT", PAGE.marginLeft + 5, this.y + 7);
    
    // Signature area
    const clientSigY = this.y + 15;
    
    if (this.data.clientSignature) {
      if (this.data.clientSignatureType === "canvas") {
        try {
          this.doc.addImage(this.data.clientSignature, "PNG", PAGE.marginLeft + 10, clientSigY, sigBoxW - 20, 25);
        } catch {
          this.doc.setFont("helvetica", "italic");
          this.doc.setFontSize(16);
          this.doc.setTextColor(...COLORS.text);
          this.doc.text(this.data.clientName, PAGE.marginLeft + sigBoxW / 2, clientSigY + 12, { align: "center" });
        }
      } else {
        this.doc.setFont("helvetica", "italic");
        this.doc.setFontSize(16);
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(this.data.clientSignature, PAGE.marginLeft + sigBoxW / 2, clientSigY + 12, { align: "center" });
      }
    } else {
      // Empty signature line
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(PAGE.marginLeft + 10, clientSigY + 25, PAGE.marginLeft + sigBoxW - 10, clientSigY + 25);
      
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("Signature du client", PAGE.marginLeft + sigBoxW / 2, clientSigY + 30, { align: "center" });
    }
    
    // Client info
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`Nom: ${this.data.clientName}`, PAGE.marginLeft + 5, this.y + sigBoxH - 18);
    this.doc.text(`Date: ${this.data.clientSignedAt ? formatDate(this.data.clientSignedAt) : "____/____/________"}`, PAGE.marginLeft + 5, this.y + sigBoxH - 12);
    
    // Initials box
    this.doc.setDrawColor(...COLORS.border);
    this.doc.rect(PAGE.marginLeft + sigBoxW - 25, this.y + sigBoxH - 20, 20, 15, "S");
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(6);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("Initiales", PAGE.marginLeft + sigBoxW - 15, this.y + sigBoxH - 7, { align: "center" });
    
    if (this.data.clientInitials) {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(12);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(this.data.clientInitials, PAGE.marginLeft + sigBoxW - 15, this.y + sigBoxH - 12, { align: "center" });
    }
    
    // === AGENT SIGNATURE ===
    const agentX = PAGE.marginLeft + sigBoxW + 15;
    
    this.doc.setFillColor(...COLORS.white);
    this.doc.setDrawColor(...COLORS.accent);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(agentX, this.y, sigBoxW, sigBoxH, 3, 3, "FD");
    this.doc.setLineWidth(0.2);
    
    // Header
    this.doc.setFillColor(...COLORS.accent);
    this.doc.rect(agentX, this.y, sigBoxW, 10, "F");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.white);
    this.doc.text("🏢 REPRÉSENTANT NIVRA", agentX + 5, this.y + 7);
    
    // Signature area
    const agentSigY = this.y + 15;
    
    if (this.data.agentSignature) {
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(16);
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(this.data.agentSignature, agentX + sigBoxW / 2, agentSigY + 12, { align: "center" });
    } else {
      this.doc.setDrawColor(...COLORS.border);
      this.doc.line(agentX + 10, agentSigY + 25, agentX + sigBoxW - 10, agentSigY + 25);
      
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...COLORS.textMuted);
      this.doc.text("Signature du représentant", agentX + sigBoxW / 2, agentSigY + 30, { align: "center" });
    }
    
    // Agent info
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`Nom: ${this.data.agentName || "____________________"}`, agentX + 5, this.y + sigBoxH - 18);
    this.doc.text(`ID: ${this.data.agentEmployeeId || "________"}`, agentX + 5, this.y + sigBoxH - 12);
    this.doc.text(`Date: ${this.data.agentSignedAt ? formatDate(this.data.agentSignedAt) : "____/____/________"}`, agentX + sigBoxW / 2, this.y + sigBoxH - 12);
    
    this.y += sigBoxH + 15;
    
    // === WITNESS (Optional) ===
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text("TÉMOIN (optionnel)", PAGE.marginLeft, this.y);
    
    this.y += 5;
    
    this.doc.setFillColor(...COLORS.background);
    this.doc.setDrawColor(...COLORS.border);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 20, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(`Nom du témoin: ${this.data.witnessName || "____________________________"}`, PAGE.marginLeft + 5, this.y + 8);
    this.doc.text("Signature: _______________________________", PAGE.marginLeft + 5, this.y + 15);
    this.doc.text("Date: ____/____/________", PAGE.marginLeft + PAGE.contentWidth / 2, this.y + 15);
    
    this.y += 28;
    
    // === FINAL LEGAL NOTICE ===
    this.doc.setFillColor(...COLORS.highlight);
    this.doc.setDrawColor(...COLORS.warning);
    this.doc.roundedRect(PAGE.marginLeft, this.y, PAGE.contentWidth, 30, 2, 2, "FD");
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.text);
    this.doc.text("📋 AVIS IMPORTANT", PAGE.marginLeft + 5, this.y + 7);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(7);
    const noticeText = `Ce contrat, incluant les Annexes A à E, constitue l'entente complète entre les parties. ` +
      `Conservez ce document pour vos dossiers. En cas de question, contactez-nous à ${COMPANY_CONTACT.supportEmailDisplay}. ` +
      `Si vous n'êtes pas satisfait de la résolution de votre problème, vous pouvez déposer une plainte auprès de la CPRST (ccts-cprst.ca).`;
    
    const noticeLines = this.doc.splitTextToSize(noticeText, PAGE.contentWidth - 10);
    this.doc.text(noticeLines, PAGE.marginLeft + 5, this.y + 13);
    
    this.y += 35;
    
    // Contract reference footer
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.textMuted);
    this.doc.text(`Contrat: ${this.data.contractNumber}`, PAGE.marginLeft, this.y);
    this.doc.text(`Compte: ${this.data.accountNumber}`, PAGE.marginLeft + 60, this.y);
    this.doc.text(`Émis le: ${formatDate(this.data.contractDate)}`, PAGE.width - PAGE.marginRight, this.y, { align: "right" });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────
  
  public build(): jsPDF {
    // Page 1: Cover/Summary
    this.buildCoverPage();
    
    // Page 2: Client details
    this.buildClientDetailsPage();
    
    // Page 3: Service breakdown
    this.buildServiceDetailsPage();
    
    // Pages 4+: Legal annexes
    this.buildAnnexes();
    
    // Final page: Signatures
    this.buildSignaturePage();
    
    // Add footers to all pages
    this.addFooters();
    
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
