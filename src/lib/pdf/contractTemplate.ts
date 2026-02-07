/**
 * Nivra Contract Template - COMPLETE (8+ pages)
 * Full prepaid telecommunications service agreement
 * 
 * Includes:
 * - Executive Summary (Page 1)
 * - Client & Order Details
 * - Services & Equipment Summary
 * - Fees Schedule
 * - Annexe A: Terms & Conditions
 * - Annexe B: Service-Specific Conditions
 * - Annexe C: Installation & Appointments
 * - Annexe D: Payment Terms
 * - Annexe E: Support, SLA, Advanced Clauses
 * - Signature Block (electronic)
 * 
 * Based on Rogers-style multi-page professional standard
 */

import jsPDF from "jspdf";
import {
  createPDFContext,
  renderCenteredHeader,
  renderSectionHeader,
  renderTableHeader,
  renderTableRow,
  renderTotalsSection,
  renderLegalFooter,
  formatCurrency,
  formatDate,
  formatShortDate,
  checkPageBreak,
  PDF_COLORS,
  PAGE_CONFIG,
  type PDFContext,
} from "./pdfHelpers";
import type { InvoiceLine, OneTimeItem, PDFGenerationResult } from "./types";
import { 
  ANNEXE_A, 
  ANNEXE_B, 
  ANNEXE_C, 
  ANNEXE_D, 
  ANNEXE_E,
  ANNEXE_TITLES,
  type AnnexeSection,
} from "./annexes";
import {
  CONTRACT_TERMS,
  BUSINESS_INFO,
  PREPAID_BILLING_SUMMARY,
  PREPAID_BILLING_CYCLE,
  LATE_PAYMENT_POLICY,
  REGULATORY_NOTICES,
  WARRANTY_POLICY,
  CANCELLATION_POLICY,
  NO_CREDIT_CHECK_POLICY,
  FEES_SUMMARY,
  CLIENT_ACKNOWLEDGEMENT,
} from "@/lib/contractPolicies";

// ============================================================================
// CONTRACT DATA INTERFACE
// ============================================================================

export interface ContractData {
  // All fields optional for backward compatibility with legacy code
  contract_number?: string;
  contractNumber?: string;
  contractId?: string;
  templateId?: string;
  templateVersion?: string;
  contract_date?: string;
  contract_version?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_dob?: string;
  service_address?: string;
  billing_address?: string;
  account_number?: string;
  order_number?: string;
  order_date?: string;
  services?: InvoiceLine[];
  equipment?: OneTimeItem[];
  one_time_fees?: { label: string; amount: number; }[];
  subtotal_monthly?: number;
  subtotal_equipment?: number;
  subtotal_one_time_fees?: number;
  total_discounts?: number;
  subtotal_before_tax?: number;
  tax_gst?: number;
  tax_qst?: number;
  total_due_today?: number;
  monthly_recurring?: number;
  promo_code?: string;
  promo_description?: string;
  installation_date?: string;
  installation_time_slot?: string;
  installation_type?: "standard" | "complex";
  activation_date?: string;
  first_billing_date?: string;
  bill_cycle_day?: number;
  payment_method?: string;
  payment_reference?: string;
  signature_name?: string;
  signature_date?: string;
  signature_ip?: string;
  is_signed?: boolean;
  [key: string]: any;
}

// ============================================================================
// HELPER: Render Annexe
// ============================================================================

const renderAnnexe = (ctx: PDFContext, annexe: AnnexeSection): void => {
  const { doc, margin, contentWidth } = ctx;
  
  // Force new page for each annexe
  doc.addPage();
  ctx.currentY = PAGE_CONFIG.topMargin;
  
  // Annexe title header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, ctx.pageWidth, 25, "F");
  
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(0, 25, ctx.pageWidth, 3, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(annexe.title, ctx.pageWidth / 2, 16, { align: "center" });
  
  ctx.currentY = 35;
  
  // Render each section
  for (const section of annexe.sections) {
    checkPageBreak(ctx, 40);
    
    // Section number and title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.navy);
    
    const sectionTitle = section.number 
      ? `${section.number}. ${section.title}` 
      : section.title;
    doc.text(sectionTitle, margin, ctx.currentY);
    ctx.currentY += 6;
    
    // Paragraphs
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    
    for (const paragraph of section.paragraphs) {
      checkPageBreak(ctx, 20);
      
      const lines = doc.splitTextToSize(paragraph, contentWidth);
      for (const line of lines) {
        checkPageBreak(ctx, 5);
        doc.text(line, margin, ctx.currentY);
        ctx.currentY += 4;
      }
      ctx.currentY += 3;
    }
    
    ctx.currentY += 5;
  }
};

// ============================================================================
// HELPER: Render Policy Section
// ============================================================================

const renderPolicySection = (
  ctx: PDFContext, 
  title: string, 
  content: string
): void => {
  const { doc, margin, contentWidth } = ctx;
  
  checkPageBreak(ctx, 40);
  
  // Section title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text(title, margin, ctx.currentY);
  ctx.currentY += 6;
  
  // Content
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.dark);
  
  const lines = doc.splitTextToSize(content, contentWidth);
  for (const line of lines) {
    checkPageBreak(ctx, 5);
    doc.text(line, margin, ctx.currentY);
    ctx.currentY += 4;
  }
  
  ctx.currentY += 5;
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateContractPDF(data: ContractData): PDFGenerationResult {
  try {
    // Validate required fields
    if (!data.contract_number) {
      return { success: false, error: "Numéro de contrat manquant" };
    }
    if (!data.client_name || !data.client_email) {
      return { success: false, error: "Informations client incomplètes" };
    }

    const ctx = createPDFContext();
    const { doc, margin, contentWidth, pageWidth } = ctx;

    // ========================================================================
    // PAGE 1: EXECUTIVE SUMMARY
    // ========================================================================
    renderCenteredHeader(ctx, "CONTRAT DE SERVICE", `#${data.contract_number}`);
    
    // Contract status badge
    if (data.is_signed) {
      doc.setFillColor(220, 252, 231); // green-100
      doc.rect(margin, ctx.currentY, contentWidth, 14, "F");
      
      doc.setFillColor(...PDF_COLORS.success);
      doc.rect(margin, ctx.currentY, 4, 14, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...PDF_COLORS.success);
      doc.text("✓ CONTRAT SIGNÉ ÉLECTRONIQUEMENT", margin + 8, ctx.currentY + 9);
      
      ctx.currentY += 18;
    } else {
      ctx.currentY += 5;
    }
    
    // Agreement type
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text("ENTENTE DE SERVICE DE TÉLÉCOMMUNICATIONS PRÉPAYÉ", pageWidth / 2, ctx.currentY, { align: "center" });
    ctx.currentY += 5;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text(`Version ${data.contract_version || CONTRACT_TERMS.version} — ${BUSINESS_INFO.serviceTerritory}`, pageWidth / 2, ctx.currentY, { align: "center" });
    ctx.currentY += 10;
    
    // Parties box
    doc.setDrawColor(...PDF_COLORS.lightGray);
    doc.setLineWidth(0.3);
    doc.rect(margin, ctx.currentY, contentWidth, 35);
    
    doc.setFillColor(...PDF_COLORS.teal);
    doc.rect(margin, ctx.currentY, 4, 35, "F");
    
    // Provider (left)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text("FOURNISSEUR", margin + 8, ctx.currentY + 6);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(BUSINESS_INFO.legalName, margin + 8, ctx.currentY + 12);
    doc.text(BUSINESS_INFO.address, margin + 8, ctx.currentY + 17);
    doc.text(BUSINESS_INFO.email, margin + 8, ctx.currentY + 22);
    doc.text(`NEQ: ${CONTRACT_TERMS.version}`, margin + 8, ctx.currentY + 27);
    
    // Client (right)
    const rightX = margin + contentWidth / 2 + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text("CLIENT", rightX, ctx.currentY + 6);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(data.client_name, rightX, ctx.currentY + 12);
    doc.text(data.client_email, rightX, ctx.currentY + 17);
    if (data.client_phone) {
      doc.text(data.client_phone, rightX, ctx.currentY + 22);
    }
    doc.text(`Compte: ${data.account_number}`, rightX, ctx.currentY + 27);
    
    ctx.currentY += 40;
    
    // Address block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text("Adresse de service:", margin, ctx.currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(data.service_address, margin + 35, ctx.currentY);
    ctx.currentY += 5;
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text("Adresse de facturation:", margin, ctx.currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(data.billing_address || data.service_address, margin + 42, ctx.currentY);
    ctx.currentY += 10;
    
    // ========================================================================
    // SERVICES SUBSCRIBED
    // ========================================================================
    if (data.services && data.services.length > 0) {
      renderSectionHeader(ctx, "Services Souscrits (Récurrents)");
      
      const columns = [
        { label: "Service", width: 40, align: "left" as const },
        { label: "Description", width: 70, align: "left" as const },
        { label: "Mensuel", width: 30, align: "right" as const },
        { label: "Total", width: 25, align: "right" as const },
      ];
      
      renderTableHeader(ctx, columns);
      
      data.services.forEach((service, index) => {
        renderTableRow(
          ctx,
          [
            service.service_type,
            service.service_description || "",
            formatCurrency(service.service_price),
            formatCurrency(service.service_total),
          ],
          columns.map(c => ({ width: c.width, align: c.align })),
          index % 2 === 1
        );
      });
      
      ctx.currentY += 5;
    }
    
    // ========================================================================
    // EQUIPMENT
    // ========================================================================
    if (data.equipment && data.equipment.length > 0) {
      renderSectionHeader(ctx, "Équipements (Achat)");
      
      const columns = [
        { label: "Équipement", width: 50, align: "left" as const },
        { label: "Description", width: 50, align: "left" as const },
        { label: "Qté", width: 15, align: "center" as const },
        { label: "Prix unit.", width: 25, align: "right" as const },
        { label: "Total", width: 25, align: "right" as const },
      ];
      
      renderTableHeader(ctx, columns);
      
      data.equipment.forEach((item, index) => {
        renderTableRow(
          ctx,
          [
            item.item_name,
            item.item_description || "",
            String(item.qty),
            formatCurrency(item.unit_price),
            formatCurrency(item.line_total),
          ],
          columns.map(c => ({ width: c.width, align: c.align })),
          index % 2 === 1
        );
        
        if (item.serial_number) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(...PDF_COLORS.gray);
          doc.text(`   N° Série: ${item.serial_number}`, margin + 5, ctx.currentY + 3);
          ctx.currentY += 5;
        }
      });
      
      ctx.currentY += 5;
    }
    
    // ========================================================================
    // ONE-TIME FEES
    // ========================================================================
    if (data.one_time_fees && data.one_time_fees.length > 0) {
      renderSectionHeader(ctx, "Frais Uniques");
      
      for (const fee of data.one_time_fees) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.dark);
        doc.text(`• ${fee.label}`, margin + 5, ctx.currentY);
        doc.text(formatCurrency(fee.amount), margin + contentWidth - 30, ctx.currentY, { align: "right" });
        ctx.currentY += 5;
      }
      
      ctx.currentY += 5;
    }
    
    // ========================================================================
    // TOTALS
    // ========================================================================
    ctx.currentY += 5;
    
    const totals = [];
    
    if (data.subtotal_monthly > 0) {
      totals.push({ label: "Services mensuels:", value: formatCurrency(data.subtotal_monthly) });
    }
    if (data.subtotal_equipment > 0) {
      totals.push({ label: "Équipements:", value: formatCurrency(data.subtotal_equipment) });
    }
    if (data.subtotal_one_time_fees > 0) {
      totals.push({ label: "Frais uniques:", value: formatCurrency(data.subtotal_one_time_fees) });
    }
    if (data.total_discounts > 0) {
      totals.push({ label: "Rabais appliqués:", value: `-${formatCurrency(data.total_discounts)}` });
    }
    
    totals.push(
      { label: "Sous-total:", value: formatCurrency(data.subtotal_before_tax), isBold: true } as any,
      { label: "TPS (5%):", value: formatCurrency(data.tax_gst) },
      { label: "TVQ (9.975%):", value: formatCurrency(data.tax_qst) },
      { label: "TOTAL À PAYER AUJOURD'HUI:", value: formatCurrency(data.total_due_today), isHighlight: true } as any
    );
    
    if (data.monthly_recurring > 0) {
      totals.push({ label: "Récurrent mensuel:", value: formatCurrency(data.monthly_recurring), isBold: true } as any);
    }
    
    renderTotalsSection(ctx, totals);
    
    // ========================================================================
    // KEY DATES
    // ========================================================================
    ctx.currentY += 10;
    checkPageBreak(ctx, 40);
    
    renderSectionHeader(ctx, "Dates Clés");
    
    const dates = [
      { label: "Date du contrat:", value: formatDate(data.contract_date) },
      { label: "Date de commande:", value: formatDate(data.order_date) },
    ];
    
    if (data.installation_date) {
      dates.push({ label: "Installation prévue:", value: `${formatDate(data.installation_date)} ${data.installation_time_slot || ""}` });
    }
    if (data.activation_date) {
      dates.push({ label: "Activation prévue:", value: formatDate(data.activation_date) });
    }
    if (data.first_billing_date) {
      dates.push({ label: "Première facture:", value: formatDate(data.first_billing_date) });
    }
    if (data.bill_cycle_day) {
      dates.push({ label: "Jour du cycle:", value: `Le ${data.bill_cycle_day} de chaque mois` });
    }
    
    for (const d of dates) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.gray);
      doc.text(d.label, margin + 5, ctx.currentY);
      doc.setTextColor(...PDF_COLORS.dark);
      doc.text(d.value, margin + 45, ctx.currentY);
      ctx.currentY += 5;
    }
    
    // ========================================================================
    // TABLE OF CONTENTS (Annexes)
    // ========================================================================
    ctx.currentY += 10;
    checkPageBreak(ctx, 50);
    
    renderSectionHeader(ctx, "Annexes Incluses dans ce Contrat");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    
    for (const [key, title] of Object.entries(ANNEXE_TITLES)) {
      doc.text(`• Annexe ${key}: ${title}`, margin + 5, ctx.currentY);
      ctx.currentY += 5;
    }
    
    // Additional sections
    ctx.currentY += 2;
    doc.text("• Politique de facturation prépayée et cycle de renouvellement", margin + 5, ctx.currentY);
    ctx.currentY += 5;
    doc.text("• Politique de garantie (1 an)", margin + 5, ctx.currentY);
    ctx.currentY += 5;
    doc.text("• Politique d'annulation", margin + 5, ctx.currentY);
    ctx.currentY += 5;
    doc.text("• Politique sans vérification de crédit", margin + 5, ctx.currentY);
    ctx.currentY += 5;
    doc.text("• Avis réglementaires (CRTC/CCTS)", margin + 5, ctx.currentY);
    ctx.currentY += 5;
    doc.text("• Grille tarifaire des frais", margin + 5, ctx.currentY);
    
    // ========================================================================
    // PAGE 2+: PREPAID BILLING POLICIES
    // ========================================================================
    doc.addPage();
    ctx.currentY = PAGE_CONFIG.topMargin;
    
    // Header for policy pages
    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setFillColor(...PDF_COLORS.teal);
    doc.rect(0, 20, pageWidth, 2, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text("POLITIQUES ET CONDITIONS GÉNÉRALES", pageWidth / 2, 13, { align: "center" });
    
    ctx.currentY = 30;
    
    // Prepaid Billing Summary
    renderPolicySection(ctx, "FACTURATION PRÉPAYÉE ET ANNULATION", PREPAID_BILLING_SUMMARY.fr);
    
    // Prepaid Billing Cycle
    renderPolicySection(ctx, "CYCLE DE FACTURATION PRÉPAYÉ", PREPAID_BILLING_CYCLE.fr);
    
    // Late Payment Policy
    renderPolicySection(ctx, "NON-RENOUVELLEMENT ET PÉNALITÉS", LATE_PAYMENT_POLICY.fr);
    
    // Warranty
    renderPolicySection(ctx, "POLITIQUE DE GARANTIE", WARRANTY_POLICY.fr);
    
    // Cancellation
    renderPolicySection(ctx, "POLITIQUE D'ANNULATION", CANCELLATION_POLICY.fr);
    
    // No Credit Check
    renderPolicySection(ctx, "POLITIQUE SANS VÉRIFICATION DE CRÉDIT", NO_CREDIT_CHECK_POLICY.fr);
    
    // Regulatory
    renderPolicySection(ctx, "AVIS RÉGLEMENTAIRES", REGULATORY_NOTICES.fr);
    
    // ========================================================================
    // FEES SCHEDULE
    // ========================================================================
    checkPageBreak(ctx, 60);
    
    renderSectionHeader(ctx, "Grille Tarifaire des Frais");
    
    const feeColumns = [
      { label: "Description", width: 100, align: "left" as const },
      { label: "Montant", width: 40, align: "right" as const },
    ];
    
    renderTableHeader(ctx, feeColumns);
    
    const fees = [
      { desc: "Frais d'activation (1 service)", amount: formatCurrency(FEES_SUMMARY.activationSingle.amount) },
      { desc: "Frais d'activation (2+ services bundle)", amount: formatCurrency(FEES_SUMMARY.activationMultiple.amount) },
      { desc: "Frais de livraison standard", amount: formatCurrency(FEES_SUMMARY.delivery.amount) },
      { desc: "Terminal TV 4K Nivra (achat)", amount: formatCurrency(FEES_SUMMARY.terminal.amount) },
      { desc: "Routeur Wi-Fi Nivra (achat)", amount: formatCurrency(FEES_SUMMARY.router.amount) },
      { desc: "Frais de réactivation (chargeback uniquement)", amount: formatCurrency(FEES_SUMMARY.reactivation.amount) },
      { desc: "Intérêt mensuel (contestation/chargeback)", amount: `${FEES_SUMMARY.disputeInterest.percent}%` },
    ];
    
    fees.forEach((fee, index) => {
      renderTableRow(
        ctx,
        [fee.desc, fee.amount],
        feeColumns.map(c => ({ width: c.width, align: c.align })),
        index % 2 === 1
      );
    });
    
    ctx.currentY += 10;
    
    // ========================================================================
    // CLIENT ACKNOWLEDGEMENTS
    // ========================================================================
    checkPageBreak(ctx, 60);
    
    renderSectionHeader(ctx, "Reconnaissance du Client");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    
    doc.text("En signant ce contrat, le client reconnaît que :", margin, ctx.currentY);
    ctx.currentY += 6;
    
    for (const ack of CLIENT_ACKNOWLEDGEMENT) {
      checkPageBreak(ctx, 10);
      const lines = doc.splitTextToSize(`• ${ack}`, contentWidth - 5);
      for (const line of lines) {
        doc.text(line, margin + 5, ctx.currentY);
        ctx.currentY += 4;
      }
      ctx.currentY += 2;
    }
    
    // ========================================================================
    // ANNEXE A - E (Full Legal Text)
    // ========================================================================
    renderAnnexe(ctx, ANNEXE_A);
    renderAnnexe(ctx, ANNEXE_B);
    renderAnnexe(ctx, ANNEXE_C);
    renderAnnexe(ctx, ANNEXE_D);
    renderAnnexe(ctx, ANNEXE_E);
    
    // ========================================================================
    // SIGNATURE PAGE
    // ========================================================================
    doc.addPage();
    ctx.currentY = PAGE_CONFIG.topMargin;
    
    // Signature header
    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(0, 0, pageWidth, 25, "F");
    doc.setFillColor(...PDF_COLORS.teal);
    doc.rect(0, 25, pageWidth, 3, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text("SIGNATURE ÉLECTRONIQUE", pageWidth / 2, 16, { align: "center" });
    
    ctx.currentY = 40;
    
    // Legal notice
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    
    const legalNotice = `En apposant ma signature électronique ci-dessous, je reconnais avoir lu, compris et accepté l'ensemble des termes et conditions de ce contrat de service de télécommunications prépayé, incluant toutes les annexes (A à E). Je confirme que les informations fournies sont exactes et que j'accepte de recevoir les communications par voie électronique.`;
    
    const noticeLines = doc.splitTextToSize(legalNotice, contentWidth);
    for (const line of noticeLines) {
      doc.text(line, margin, ctx.currentY);
      ctx.currentY += 4;
    }
    
    ctx.currentY += 15;
    
    // Signature box
    doc.setDrawColor(...PDF_COLORS.navy);
    doc.setLineWidth(1);
    doc.rect(margin, ctx.currentY, contentWidth, 50);
    
    if (data.is_signed && data.signature_name) {
      // Signed - show signature in blue cursive
      doc.setFillColor(240, 253, 244);
      doc.rect(margin + 0.5, ctx.currentY + 0.5, contentWidth - 1, 49, "F");
      
      // Signature (blue, italic to simulate cursive)
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(24);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text(data.signature_name, margin + contentWidth / 2, ctx.currentY + 25, { align: "center" });
      
      // Signed badge
      doc.setFillColor(...PDF_COLORS.success);
      doc.roundedRect(margin + contentWidth / 2 - 40, ctx.currentY + 35, 80, 8, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.white);
      doc.text("CONTRAT SIGNÉ ÉLECTRONIQUEMENT", margin + contentWidth / 2, ctx.currentY + 40, { align: "center" });
    } else {
      // Unsigned
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(...PDF_COLORS.gray);
      doc.text("Signature du client", margin + contentWidth / 2, ctx.currentY + 25, { align: "center" });
      doc.text("(En attente de signature)", margin + contentWidth / 2, ctx.currentY + 35, { align: "center" });
    }
    
    ctx.currentY += 55;
    
    // Signature details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray);
    
    doc.text(`Nom du signataire: ${data.signature_name || data.client_name}`, margin, ctx.currentY);
    ctx.currentY += 5;
    doc.text(`Date de signature: ${data.signature_date ? formatDate(data.signature_date) : "—"}`, margin, ctx.currentY);
    ctx.currentY += 5;
    if (data.signature_ip) {
      doc.text(`Adresse IP: ${data.signature_ip}`, margin, ctx.currentY);
      ctx.currentY += 5;
    }
    doc.text(`Numéro de contrat: ${data.contract_number}`, margin, ctx.currentY);
    ctx.currentY += 5;
    doc.text(`Numéro de commande: ${data.order_number}`, margin, ctx.currentY);
    
    ctx.currentY += 15;
    
    // Legal compliance notice
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, ctx.currentY, contentWidth, 30, "F");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.gray);
    
    const complianceText = `Cette signature électronique est conforme à la Loi concernant le cadre juridique des technologies de l'information (L.R.Q., c. C-1.1) du Québec et à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) du Canada. Le document signé électroniquement a la même valeur juridique qu'un document signé de façon manuscrite.`;
    
    const compLines = doc.splitTextToSize(complianceText, contentWidth - 10);
    let compY = ctx.currentY + 5;
    for (const line of compLines) {
      doc.text(line, margin + 5, compY);
      compY += 3.5;
    }
    
    // ========================================================================
    // FINAL LEGAL FOOTER
    // ========================================================================
    renderLegalFooter(ctx);
    
    // ========================================================================
    // ADD PAGE NUMBERS TO ALL PAGES
    // ========================================================================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.gray);
      doc.text(
        `Page ${i} de ${totalPages}`,
        pageWidth / 2,
        ctx.pageHeight - 10,
        { align: "center" }
      );
      doc.text(
        `Contrat #${data.contract_number}`,
        pageWidth - margin,
        ctx.pageHeight - 10,
        { align: "right" }
      );
    }

    // ========================================================================
    // GENERATE BLOB
    // ========================================================================
    const blob = doc.output("blob");
    const filename = `Contrat_${data.contract_number}_${data.client_name.replace(/\s+/g, "_")}.pdf`;

    return {
      success: true,
      blob,
      filename,
    };
  } catch (error) {
    console.error("[ContractPDF] Generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

// ============================================================================
// CONVENIENCE EXPORT
// ============================================================================

export default generateContractPDF;
