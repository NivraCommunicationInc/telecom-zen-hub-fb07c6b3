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
} from "./types";
import {
  addDocumentHeader,
  addPageHeaderCompact,
  addDocumentFooter,
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
import { ACTIVE_CONTRACT_TEMPLATE, getContractEngineFooterLine } from "../contractTemplate";

const { marginLeft, marginRight, contentWidth, colors, fontSize } = PDF_LAYOUT;

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
  const footerText = `${companyName} — ${data.company.address} — ${data.company.email} — ${data.company.phone}`;

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

  // Company info box
  addInfoBox(state, [
    `Adresse : ${data.company.address}`,
    `Courriel : ${data.company.email} | Tél : ${data.company.phone}`,
    `Territoire : Province de Québec uniquement`,
  ], { addHeader });

  // ========== DOCUMENT IDENTIFICATION ==========
  addSectionTitle(state, "Identification du document", { addHeader });
  
  addLabelValue(state, "Numéro de document", data.metadata.documentNumber, { addHeader });
  if (data.metadata.orderNumber) {
    addLabelValue(state, "Référence commande", data.metadata.orderNumber, { addHeader });
  }
  addLabelValue(state, "Date d'émission", formatDate(data.metadata.date), { addHeader });
  if (data.metadata.effectiveDate) {
    addLabelValue(state, "Date d'effet", formatDate(data.metadata.effectiveDate), { addHeader });
  }
  if (data.docType === "contract") {
    addLabelValue(state, "Version template", data.metadata.version || ACTIVE_CONTRACT_TEMPLATE.version, { addHeader });
  }

  // ========== CLIENT INFORMATION ==========
  addSectionTitle(state, "Informations client", { addHeader });
  
  addLabelValue(state, "Nom complet", data.client.fullName, { addHeader });
  addLabelValue(state, "Courriel", data.client.email, { addHeader });
  if (data.client.phone) {
    addLabelValue(state, "Téléphone", data.client.phone, { addHeader });
  }
  if (data.client.accountNumber) {
    addLabelValue(state, "N° de compte", data.client.accountNumber, { addHeader });
  }
  
  // Service address
  if (data.client.serviceAddress) {
    const fullAddress = [
      data.client.serviceAddress,
      data.client.serviceCity,
      data.client.serviceProvince || "QC",
      data.client.servicePostalCode,
    ].filter(Boolean).join(", ");
    addLabelValue(state, "Adresse de service", fullAddress, { addHeader });
  }
  
  // Billing address if different
  if (data.client.billingAddress && data.client.billingAddress !== data.client.serviceAddress) {
    addLabelValue(state, "Adresse facturation", data.client.billingAddress, { addHeader });
  }

  // Agent info
  if (data.agent) {
    addLabelValue(state, "Traité par", `${data.agent.name}${data.agent.role ? ` (${data.agent.role})` : ""}`, { addHeader });
  } else {
    addLabelValue(state, "Traité par", "Nivra Telecom", { addHeader });
  }

  // ========== SERVICES (DYNAMIC) ==========
  if (data.services.length > 0) {
    addSectionTitle(state, "Services inclus", { addHeader });
    
    const serviceWidths = [35, 70, 35, 30];
    addTableHeader(state, ["TYPE", "SERVICE / FORFAIT", "QTÉ", "MENSUEL"], serviceWidths, { addHeader });
    
    data.services.forEach((service, index) => {
      const qty = service.quantity ? String(service.quantity) : "1";
      addTableRow(
        state,
        [
          service.type,
          service.name + (service.description ? ` — ${service.description}` : ""),
          qty,
          formatCurrency(service.monthlyPrice),
        ],
        serviceWidths,
        index,
        { addHeader, rightAlignLast: true }
      );
    });

    state.currentY += 4;
  }

  // ========== TV CHANNELS SUMMARY (if applicable) ==========
  if (data.tvSummary) {
    addSubHeader(state, "Résumé chaînes TV", { addHeader });
    
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
    
    if (tvLines.length > 0) {
      addInfoBox(state, tvLines, { addHeader, bgColor: "background", accentColor: "primary" });
    }
  }

  // ========== EQUIPMENT (DYNAMIC) ==========
  if (data.equipment.length > 0) {
    addSectionTitle(state, "Équipement", { addHeader });
    
    const equipWidths = [55, 15, 45, 30, 30];
    addTableHeader(state, ["ÉQUIPEMENT", "QTÉ", "N° SÉRIE / ID", "GARANTIE", "PRIX"], equipWidths, { addHeader });
    
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

    state.currentY += 4;
  }

  // ========== ONE-TIME FEES (DYNAMIC) ==========
  if (data.oneTimeFees.length > 0) {
    addSectionTitle(state, "Frais uniques", { addHeader });
    
    const feeWidths = [90, 85];
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

    state.currentY += 4;
  }

  // ========== DISCOUNTS (DYNAMIC) ==========
  if (data.discounts.length > 0) {
    addSectionTitle(state, "Rabais / Promotions", { addHeader });
    
    const discountWidths = [90, 85];
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

    state.currentY += 4;
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
    // New page for terms
    addNewPage(state, addHeader);
    
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
    
    // Signature section
    addSectionTitle(state, "Signatures", { addHeader });
    
    const pageWidth = getPageWidth(doc);
    const sigBoxWidth = (contentWidth - 10) / 2;
    const sigBoxHeight = 40;
    
    if (checkPageBreak(state, sigBoxHeight + 20)) {
      addNewPage(state, addHeader);
    }
    
    // Provider signature box
    setColor(doc, "primary", "fill");
    doc.roundedRect(marginLeft, state.currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(doc, "white");
    doc.text("POUR NIVRA TELECOM", marginLeft + sigBoxWidth / 2, state.currentY + 10, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Signature: ___________________", marginLeft + 8, state.currentY + 24);
    doc.text("Date: ___________________", marginLeft + 8, state.currentY + 32);
    
    // Client signature box
    const clientSigX = marginLeft + sigBoxWidth + 10;
    setColor(doc, "background", "fill");
    setColor(doc, "border", "draw");
    doc.roundedRect(clientSigX, state.currentY, sigBoxWidth, sigBoxHeight, 2, 2, "FD");
    
    setColor(doc, "accent", "draw");
    doc.setLineWidth(1.5);
    doc.line(clientSigX, state.currentY + 2, clientSigX, state.currentY + sigBoxHeight - 2);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(doc, "primary");
    doc.text("POUR LE CLIENT", clientSigX + sigBoxWidth / 2, state.currentY + 10, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(doc, "text");
    doc.text(`Nom: ${data.client.fullName}`, clientSigX + 8, state.currentY + 18);
    doc.text("Signature: ___________________", clientSigX + 8, state.currentY + 26);
    doc.text("Date: ___________________", clientSigX + 8, state.currentY + 34);
    
    state.currentY += sigBoxHeight + 8;
    
    // Signed status
    if (data.isSigned && data.signedAt) {
      setColor(doc, "success", "fill");
      doc.roundedRect(marginLeft, state.currentY, contentWidth, 16, 2, 2, "F");
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      setColor(doc, "white");
      doc.text("✓ SIGNÉ ÉLECTRONIQUEMENT", pageWidth / 2, state.currentY + 7, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`Signé le ${formatDateTime(data.signedAt)}${data.signatureMethod ? ` (${data.signatureMethod})` : ""}`, pageWidth / 2, state.currentY + 13, { align: "center" });
      
      state.currentY += 20;
    }
  }

  // ========== NOTES ==========
  if (data.notes) {
    if (checkPageBreak(state, 30)) {
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
