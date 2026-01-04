/**
 * Nivra Document Engine - Main Generator
 * Unified PDF generation for Contract, Invoice, and Estimate
 */

import jsPDF from "jspdf";
import { 
  type UnifiedDocumentData, 
  PDF_LAYOUT 
} from "./types";
import type { PDFState } from "./helpers";
import {
  addDocumentHeader,
  addPageHeaderCompact,
  addSectionTitle,
  addSubHeader,
  addLabelValue,
  addParagraph,
  addTableHeader,
  addTableRow,
  addInfoBox,
  addTotalBox,
  addNewPage,
  checkPageBreak,
  formatCurrency,
  formatDate,
  formatDateTime,
  setColor,
  getPageWidth,
  getPageHeight,
} from "./helpers";
import { BUSINESS_INFO, CONTRACT_TERMS, LATE_PAYMENT_POLICY, CANCELLATION_POLICY } from "../contractPolicies";
import { getContractEngineFooterLine } from "../contractTemplate";

const { marginLeft, marginRight, contentWidth, fontSize } = PDF_LAYOUT;

// ============= DOCUMENT TITLES =============

const DOC_TITLES = {
  contract: "Contrat de services / Service Agreement",
  invoice: "Facture / Invoice",
  estimate: "Estimation / Estimate",
};

const DOC_SUBTITLES = {
  contract: "Prépayé — Province de Québec",
  invoice: "Télécommunications — Province de Québec",
  estimate: "Valide 30 jours — Province de Québec",
};

// ============= MAIN GENERATOR =============

export function generateUnifiedPDF(data: UnifiedDocumentData): jsPDF {
  const doc = new jsPDF();
  const companyName = data.company.legalName || BUSINESS_INFO.legalName;
  
  const state: PDFState = {
    doc,
    currentY: 18,
    pageNumber: 1,
  };

  // Footer text for all pages
  const footerText = `${companyName} — ${data.company.email} — ${data.company.phone}`;

  // Helper to add header on new pages
  const addHeader = () => {
    addPageHeaderCompact(
      state, 
      companyName,
      `${DOC_TITLES[data.docType].split("/")[0].trim()} #${data.metadata.documentNumber}`
    );
  };

  // ========== PAGE 1: HEADER ==========
  addDocumentHeader(
    state,
    companyName,
    DOC_TITLES[data.docType],
    DOC_SUBTITLES[data.docType]
  );

  // Company info box - compact
  const companyLines = [
    `Courriel : ${data.company.email} | Tél : ${data.company.phone}`,
  ];
  // Only add city if available
  if (data.client.serviceCity) {
    companyLines.unshift(`Ville : ${data.client.serviceCity}, QC`);
  }
  addInfoBox(state, companyLines, { addHeader, height: companyLines.length * 5 + 6 });

  // ========== DOCUMENT IDENTIFICATION ==========
  addSectionTitle(state, "Identification du document", { addHeader });
  
  addLabelValue(state, "Numéro de document", data.metadata.documentNumber, { addHeader });
  if (data.metadata.orderNumber) {
    addLabelValue(state, "Référence commande", data.metadata.orderNumber, { addHeader });
  }
  addLabelValue(state, "Date d'émission", formatDate(data.metadata.date), { addHeader });
  
  // Only show effective date if different from issue date
  if (data.metadata.effectiveDate && data.metadata.effectiveDate !== data.metadata.date) {
    addLabelValue(state, "Date d'effet", formatDate(data.metadata.effectiveDate), { addHeader });
  }

  // ========== CLIENT INFORMATION ==========
  addSectionTitle(state, "Informations client", { addHeader });
  
  addLabelValue(state, "Nom complet", data.client.fullName, { addHeader });
  
  // Account number - show prominently if available
  if (data.client.accountNumber) {
    addLabelValue(state, "Numéro de compte client", data.client.accountNumber, { addHeader });
  }
  
  addLabelValue(state, "Courriel", data.client.email, { addHeader });
  if (data.client.phone) {
    addLabelValue(state, "Téléphone", data.client.phone, { addHeader });
  }
  
  // Service address - only if present
  if (data.client.serviceAddress) {
    const addressParts = [
      data.client.serviceAddress,
      data.client.serviceCity,
      data.client.serviceProvince || "QC",
      data.client.servicePostalCode,
    ].filter(Boolean);
    if (addressParts.length > 0) {
      addLabelValue(state, "Adresse de service", addressParts.join(", "), { addHeader });
    }
  }
  
  // Billing address only if different
  if (data.client.billingAddress && data.client.billingAddress !== data.client.serviceAddress) {
    addLabelValue(state, "Adresse facturation", data.client.billingAddress, { addHeader });
  }

  // Agent info - always show
  const agentText = data.agent?.name 
    ? `${data.agent.name}${data.agent.role ? ` (${data.agent.role})` : ""}`
    : "Nivra Telecom";
  addLabelValue(state, "Traité par", agentText, { addHeader });

  // ========== SERVICES (ONLY IF PRESENT) ==========
  if (data.services.length > 0) {
    addSectionTitle(state, "Services inclus", { addHeader });
    
    // Enhanced table with price label column
    const serviceWidths = [28, 70, 15, 25, 30];
    addTableHeader(state, ["TYPE", "SERVICE / FORFAIT", "QTÉ", "PRIX", "PÉRIODE"], serviceWidths, { addHeader });
    
    data.services.forEach((service, index) => {
      const qty = service.quantity ? String(service.quantity) : "1";
      const serviceName = service.description 
        ? `${service.name} — ${service.description}` 
        : service.name;
      
      // Determine price label
      let priceLabel = service.priceLabel || "/mois";
      if (service.isOneTime) {
        priceLabel = "Frais unique";
      } else if (service.type === "Mobile") {
        priceLabel = service.priceLabel || "/30 jours";
      }
      
      addTableRow(
        state,
        [service.type, serviceName, qty, formatCurrency(service.monthlyPrice), priceLabel],
        serviceWidths,
        index,
        { addHeader, rightAlignLast: false }
      );
    });
    state.currentY += 2; // Minimal spacing
  }

  // ========== TV CHANNELS SUMMARY (ONLY IF TV SERVICE PRESENT) ==========
  // Rule: Never list channels individually, only show counts
  const hasTVService = data.services.some(s => s.type === "TV");
  if (hasTVService && data.tvSummary) {
    const tvLines: string[] = [];
    if (data.tvSummary.baseChannels > 0) {
      tvLines.push(`Chaînes de base : ${data.tvSummary.baseChannels}`);
    }
    if (data.tvSummary.optionalChannels > 0) {
      tvLines.push(`Chaînes au choix : ${data.tvSummary.optionalChannels}`);
    }
    if (data.tvSummary.premiumChannels > 0) {
      const premiumText = data.tvSummary.premiumTotal 
        ? `Chaînes premium : ${data.tvSummary.premiumChannels} (${formatCurrency(data.tvSummary.premiumTotal)}/mois)`
        : `Chaînes premium : ${data.tvSummary.premiumChannels}`;
      tvLines.push(premiumText);
    }
    
    // Only render if there's something to show
    if (tvLines.length > 0) {
      addSubHeader(state, "Résumé chaînes TV", { addHeader });
      addInfoBox(state, tvLines, { 
        addHeader, 
        bgColor: "background", 
        accentColor: "primary",
        height: tvLines.length * 5 + 6,
      });
    }
  }

  // ========== EQUIPMENT (ONLY IF PRESENT) ==========
  if (data.equipment.length > 0) {
    addSectionTitle(state, "Équipement", { addHeader });
    
    const equipWidths = [60, 15, 40, 25, 28];
    addTableHeader(state, ["ÉQUIPEMENT", "QTÉ", "N° SÉRIE", "GARANTIE", "PRIX"], equipWidths, { addHeader });
    
    data.equipment.forEach((item, index) => {
      addTableRow(
        state,
        [
          item.name,
          String(item.quantity),
          item.serial || "À assigner",
          item.warranty || "1 an",
          formatCurrency(item.unitPrice * item.quantity),
        ],
        equipWidths,
        index,
        { addHeader, rightAlignLast: true }
      );
    });
    state.currentY += 2;
  }

  // ========== ONE-TIME FEES (ONLY IF PRESENT) ==========
  if (data.oneTimeFees.length > 0) {
    addSectionTitle(state, "Frais uniques", { addHeader });
    
    const feeWidths = [100, 68];
    addTableHeader(state, ["DESCRIPTION", "MONTANT"], feeWidths, { addHeader });
    
    data.oneTimeFees.forEach((fee, index) => {
      const desc = fee.description ? `${fee.label} — ${fee.description}` : fee.label;
      addTableRow(
        state,
        [desc, formatCurrency(fee.amount)],
        feeWidths,
        index,
        { addHeader, rightAlignLast: true }
      );
    });
    state.currentY += 2;
  }

  // ========== DISCOUNTS (ONLY IF PRESENT) ==========
  if (data.discounts.length > 0) {
    addSectionTitle(state, "Rabais / Promotions", { addHeader });
    
    const discountWidths = [100, 68];
    addTableHeader(state, ["DESCRIPTION", "RABAIS"], discountWidths, { addHeader });
    
    data.discounts.forEach((discount, index) => {
      const desc = discount.promoCode 
        ? `${discount.label} (Code: ${discount.promoCode})`
        : discount.label;
      addTableRow(
        state,
        [desc, `-${formatCurrency(discount.amount)}`],
        discountWidths,
        index,
        { addHeader, rightAlignLast: true }
      );
    });
    state.currentY += 2;
  }

  // ========== BILLING SUMMARY ==========
  addSectionTitle(state, "Sommaire de facturation", { addHeader });

  // Summary rows - right aligned in a column
  const addSummaryRow = (label: string, amount: string, isNegative = false) => {
    if (checkPageBreak(state, 6)) {
      addNewPage(state, addHeader);
    }
    
    doc.setFontSize(fontSize.small);
    doc.setFont("helvetica", "normal");
    setColor(doc, "muted");
    doc.text(label, marginLeft + 80, state.currentY);
    
    if (isNegative) {
      setColor(doc, "success");
    } else {
      setColor(doc, "text");
    }
    doc.text(amount, marginLeft + contentWidth - 5, state.currentY, { align: "right" });
    state.currentY += 5;
  };

  addSummaryRow("Sous-total services", formatCurrency(data.billing.subtotal));
  
  if (data.billing.oneTimeTotal > 0) {
    addSummaryRow("Frais uniques", formatCurrency(data.billing.oneTimeTotal));
  }
  
  if (data.billing.discountTotal > 0) {
    addSummaryRow("Rabais appliqués", `-${formatCurrency(data.billing.discountTotal)}`, true);
  }
  
  addSummaryRow(`TPS (5%)`, formatCurrency(data.billing.tps));
  addSummaryRow(`TVQ (9.975%)`, formatCurrency(data.billing.tvq));

  state.currentY += 4;

  // Total box
  addTotalBox(state, "TOTAL", `${formatCurrency(data.billing.total)} CAD`, { addHeader });

  // ========== PAYMENT STATUS (Invoice/Estimate only) ==========
  if (data.docType !== "contract") {
    addSectionTitle(state, "Statut de paiement", { addHeader });
    
    const statusLabels: Record<string, string> = {
      pending: "En attente",
      paid: "Payé",
      overdue: "En retard",
      cancelled: "Annulé",
    };
    
    addLabelValue(state, "Statut", statusLabels[data.payment.status] || data.payment.status, { addHeader });
    
    if (data.payment.dueDate) {
      addLabelValue(state, "Échéance", formatDate(data.payment.dueDate), { addHeader });
    }
    
    if (data.payment.reference) {
      addLabelValue(state, "Référence paiement", data.payment.reference, { addHeader });
    }
    
    if (data.payment.paidAt) {
      addLabelValue(state, "Payé le", formatDateTime(data.payment.paidAt), { addHeader });
    }

    // E-Transfer info (only if applicable)
    if (data.payment.method === "etransfer" || data.payment.status === "pending") {
      state.currentY += 4;
      addSubHeader(state, "Paiement par Virement Interac", { addHeader });
      addInfoBox(state, [
        `Courriel : ${BUSINESS_INFO.paymentEmail}`,
        `Question de sécurité : ${CONTRACT_TERMS.etransfer.securityQuestion}`,
        `Réponse : ${CONTRACT_TERMS.etransfer.securityAnswer}`,
      ], { addHeader });
    }
  }

  // ========== CONTRACT-SPECIFIC: TERMS & SIGNATURE ==========
  if (data.docType === "contract") {
    // Check if terms can fit on current page, otherwise start new page
    const termsEstimatedHeight = 120; // Approximate height for all terms
    if (checkPageBreak(state, termsEstimatedHeight)) {
      addNewPage(state, addHeader);
    }
    
    addSectionTitle(state, "Termes et conditions", { addHeader });
    
    // Prepaid terms
    addSubHeader(state, "Services prépayés", { addHeader });
    addParagraph(state, CONTRACT_TERMS.prepaidBilling, { addHeader, fontSize: fontSize.tiny });
    
    // Cancellation
    addSubHeader(state, "Annulation", { addHeader });
    addParagraph(state, CANCELLATION_POLICY.fr, { addHeader, fontSize: fontSize.tiny });
    
    // Late payment
    addSubHeader(state, "Paiement en retard", { addHeader });
    addParagraph(state, LATE_PAYMENT_POLICY.fr, { addHeader, fontSize: fontSize.tiny });
    
    // Liability
    addSubHeader(state, "Responsabilité", { addHeader });
    addParagraph(state, CONTRACT_TERMS.liability, { addHeader, fontSize: fontSize.tiny });
    
    // Jurisdiction
    addSubHeader(state, "Juridiction", { addHeader });
    addParagraph(state, CONTRACT_TERMS.jurisdiction, { addHeader, fontSize: fontSize.tiny });
    
    // Signature section - flows naturally
    const sigBoxWidth = (contentWidth - 10) / 2;
    const sigBoxHeight = 35;
    const signedStatusHeight = data.isSigned ? 18 : 0;
    const totalSigHeight = sigBoxHeight + signedStatusHeight + 16;
    
    // Check if signatures fit on current page
    if (checkPageBreak(state, totalSigHeight)) {
      addNewPage(state, addHeader);
    }
    
    addSectionTitle(state, "Signatures", { addHeader });
    
    const pageWidth = getPageWidth(doc);
    
    // Provider signature box
    setColor(doc, "primary", "fill");
    doc.roundedRect(marginLeft, state.currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(doc, "white");
    doc.text("POUR NIVRA TELECOM", marginLeft + sigBoxWidth / 2, state.currentY + 8, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text("Signature: _________________", marginLeft + 6, state.currentY + 20);
    doc.text("Date: _________________", marginLeft + 6, state.currentY + 28);
    
    // Client signature box
    const clientSigX = marginLeft + sigBoxWidth + 10;
    setColor(doc, "background", "fill");
    setColor(doc, "border", "draw");
    doc.setLineWidth(0.5);
    doc.roundedRect(clientSigX, state.currentY, sigBoxWidth, sigBoxHeight, 2, 2, "FD");
    
    setColor(doc, "accent", "draw");
    doc.setLineWidth(1.2);
    doc.line(clientSigX, state.currentY + 2, clientSigX, state.currentY + sigBoxHeight - 2);
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(doc, "primary");
    doc.text("POUR LE CLIENT", clientSigX + sigBoxWidth / 2, state.currentY + 8, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    setColor(doc, "text");
    doc.text(`Nom: ${data.client.fullName}`, clientSigX + 6, state.currentY + 16);
    doc.text("Signature: _________________", clientSigX + 6, state.currentY + 24);
    doc.text("Date: _________________", clientSigX + 6, state.currentY + 32);
    
    state.currentY += sigBoxHeight + 6;
    
    // Signed status banner
    if (data.isSigned && data.signedAt) {
      setColor(doc, "success", "fill");
      doc.roundedRect(marginLeft, state.currentY, contentWidth, 14, 2, 2, "F");
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      setColor(doc, "white");
      doc.text("✓ SIGNÉ ÉLECTRONIQUEMENT", pageWidth / 2, state.currentY + 6, { align: "center" });
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(`Signé le ${formatDateTime(data.signedAt)}${data.signatureMethod ? ` (${data.signatureMethod})` : ""}`, pageWidth / 2, state.currentY + 11, { align: "center" });
      
      state.currentY += 16;
    }
  }

  // ========== NOTES (ONLY IF PRESENT) ==========
  if (data.notes && data.notes.trim()) {
    if (checkPageBreak(state, 20)) {
      addNewPage(state, addHeader);
    }
    addSectionTitle(state, "Notes", { addHeader });
    addParagraph(state, data.notes, { addHeader });
  }

  // ========== ADD FOOTER TO ALL PAGES ==========
  const totalPages = state.pageNumber;
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    const pageHeight = getPageHeight(doc);
    const pageWidth = getPageWidth(doc);
    
    // Divider line
    setColor(doc, "border", "draw");
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 16, pageWidth - marginRight, pageHeight - 16);
    
    // Footer text
    doc.setFontSize(5);
    setColor(doc, "muted");
    
    // Engine line for contracts
    if (data.docType === "contract") {
      const engineLine = getContractEngineFooterLine({
        contractId: data.metadata.documentNumber,
        templateVersion: data.metadata.version,
      });
      doc.text(engineLine, pageWidth / 2, pageHeight - 11, { align: "center" });
    } else {
      doc.text(footerText, pageWidth / 2, pageHeight - 11, { align: "center" });
    }
    
    // Page number
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${i} / ${totalPages}`, pageWidth - marginRight, pageHeight - 6, { align: "right" });
  }

  return doc;
}

// ============= CONVENIENCE FUNCTIONS =============

export function generateContractPDF(data: UnifiedDocumentData): jsPDF {
  return generateUnifiedPDF({ ...data, docType: "contract" });
}

export function generateInvoicePDF(data: UnifiedDocumentData): jsPDF {
  return generateUnifiedPDF({ ...data, docType: "invoice" });
}

export function generateEstimatePDF(data: UnifiedDocumentData): jsPDF {
  return generateUnifiedPDF({ ...data, docType: "estimate" });
}

// ============= BLOB & DOWNLOAD HELPERS =============

export function getUnifiedPDFBlob(data: UnifiedDocumentData): Blob {
  const doc = generateUnifiedPDF(data);
  return doc.output("blob");
}

export function downloadUnifiedPDF(data: UnifiedDocumentData, filename?: string): void {
  const doc = generateUnifiedPDF(data);
  const blob = doc.output("blob");
  
  const defaultFilenames = {
    contract: `Contrat_${data.metadata.documentNumber}`,
    invoice: `Facture_${data.metadata.documentNumber}`,
    estimate: `Estimation_${data.metadata.documentNumber}`,
  };
  
  const finalFilename = filename || `${defaultFilenames[data.docType]}.pdf`;
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function viewUnifiedPDF(data: UnifiedDocumentData): void {
  const doc = generateUnifiedPDF(data);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
