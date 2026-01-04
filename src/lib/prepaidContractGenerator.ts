import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BUSINESS_INFO,
  CONTRACT_TERMS,
  CLIENT_ACKNOWLEDGEMENT,
  PREPAID_BILLING_SUMMARY,
  LATE_PAYMENT_POLICY,
  REGULATORY_NOTICES,
  WARRANTY_POLICY,
  CANCELLATION_POLICY,
} from "./contractPolicies";
import { ACTIVE_CONTRACT_TEMPLATE, getContractEngineFooterLine } from "./contractTemplate";
import { safePDFDownload, safePDFOpen } from "./pdfUtils";

// ========== INTERFACES ==========

export interface PrepaidServiceItem {
  type: "Mobile" | "Internet" | "TV" | "Streaming+";
  planName: string;
  cyclePrice: number;
  inclusions?: string;
}

export interface PrepaidStreamingAddon {
  id: string;
  name: string;
  priceMonthly: number;
  category?: string;
}

export interface PrepaidOneTimeFee {
  item: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface PrepaidContractData {
  // Template metadata
  contractId?: string;
  templateId?: string;
  templateVersion?: string;

  // Page 1 — Critical Information Summary
  providerLegalName?: string;
  providerAddress?: string;
  supportPhone?: string;
  supportEmail?: string;

  orderId: string;
  orderReference: string; // MUST NOT BE BLANK
  issueDate: string;
  effectiveDate: string;

  // Client info
  clientFullName: string;
  clientEmail: string;
  clientPhone?: string;

  // Addresses
  serviceAddressFull?: string;
  billingAddressFull?: string;

  // Services (prepaid/cycle)
  mobilePlan?: { name: string; cyclePrice: number };
  internetPlan?: { name: string; cyclePrice: number };
  tvPlan?: { name: string; cyclePrice: number };
  streamingAddons?: PrepaidStreamingAddon[];

  // Billing summary
  recurringSubtotal: number;
  discountsTotal?: number;
  taxTotal: number;
  recurringTotal: number;

  // One-time charges
  activationQty?: number;
  activationTotal?: number;
  deliveryQty?: number;
  deliveryTotal?: number;
  terminalQty?: number;
  terminalTotal?: number;
  routerQty?: number;
  routerTotal?: number;
  reactivationQty?: number;
  reactivationTotal?: number;

  oneTimeSubtotal: number;
  oneTimeTax: number;
  oneTimeTotal: number;

  // Amount due today
  totalDueToday: number;
  paymentMethod?: string;
  paymentStatus?: string; // Pending | Verified | Completed | Declined | Fraud

  // Signatures
  clientSignature?: string;
  clientSignedDatetime?: string;
  clientIp?: string;
  repNameTitle?: string;
  repSignature?: string;
  repSignedDatetime?: string;

  // Snapshot for appendix
  snapshotTimestamp?: string;
  snapshotHash?: string;

  // Legacy compatibility
  isSigned?: boolean;
  signedAt?: string;
  
  // Reactivation scope
  reactivationScope?: string;
  returnWindowDays?: number;
  installationDetails?: string;
  liabilityCap?: string;
  privacyPolicyUrl?: string;
}

// ========== GENERATOR ==========

export const generatePrepaidContractPDF = (data: PrepaidContractData): jsPDF => {
  // VALIDATION: order_reference must not be blank
  if (!data.orderReference || data.orderReference.trim() === "") {
    throw new Error("Contract generation refused: order_reference is blank");
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 15;
  let pageNumber = 1;
  let totalPages = 7; // Will be updated at the end

  // Color palette
  const primaryNavy: [number, number, number] = [15, 23, 42];
  const accentTeal: [number, number, number] = [20, 184, 166];
  const textDark: [number, number, number] = [30, 41, 59];
  const textMuted: [number, number, number] = [100, 116, 139];
  const borderLight: [number, number, number] = [203, 213, 225];
  const bgLight: [number, number, number] = [248, 250, 252];
  const white: [number, number, number] = [255, 255, 255];

  // ========== HELPER FUNCTIONS ==========

  const addNewPage = () => {
    doc.addPage();
    pageNumber++;
    currentY = 20;
    addPageHeader();
  };

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 25) {
      addNewPage();
    }
  };

  const addPageHeader = () => {
    if (pageNumber > 1) {
      doc.setFillColor(...accentTeal);
      doc.rect(0, 0, pageWidth, 2, "F");

      doc.setFillColor(...primaryNavy);
      doc.rect(0, 2, pageWidth, 10, "F");

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      doc.text("NIVRA TELECOM — Contrat de services prépayés", marginLeft, 9);

      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(`Réf: ${data.orderReference}`, pageWidth - marginRight, 9, { align: "right" });

      currentY = 18;
    }
  };

  const addFooter = (pageNum: number) => {
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 18, pageWidth - marginRight, pageHeight - 18);

    const engineLine = getContractEngineFooterLine({
      contractId: data.contractId || data.orderReference,
      templateVersion: data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version,
    });

    doc.setFontSize(5);
    doc.setTextColor(...textMuted);
    doc.text(
      `${BUSINESS_INFO.legalName} — ${BUSINESS_INFO.address} — ${BUSINESS_INFO.serviceTerritory}`,
      pageWidth / 2,
      pageHeight - 13,
      { align: "center" }
    );

    doc.text(engineLine, pageWidth / 2, pageHeight - 9, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - marginRight, pageHeight - 8, { align: "right" });
  };

  const addAnnexeHeader = (letter: string, title: string) => {
    doc.setFillColor(...primaryNavy);
    doc.rect(0, 0, pageWidth, 25, "F");

    doc.setFillColor(...accentTeal);
    doc.rect(0, 25, pageWidth, 3, "F");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(`Annexe ${letter}`, pageWidth / 2, 12, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...accentTeal);
    doc.text(title, pageWidth / 2, 20, { align: "center" });

    currentY = 35;
  };

  const addSectionHeader = (number: string, title: string) => {
    checkPageBreak(12);
    currentY += 4;

    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 4;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryNavy);
    doc.text(`${number}. ${title}`, marginLeft, currentY);

    currentY += 2;
    doc.setDrawColor(...borderLight);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 6;
  };

  const addLabelValue = (label: string, value: string, labelWidth: number = 60) => {
    checkPageBreak(5);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);

    const paddedLabel = (label + ":").padEnd(35, " ");
    doc.text(paddedLabel, marginLeft, currentY);

    doc.setTextColor(...textDark);
    doc.text(value || "—", marginLeft + labelWidth, currentY);
    currentY += 4.5;
  };

  const addSubHeader = (text: string) => {
    checkPageBreak(8);
    currentY += 2;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryNavy);
    doc.text(text, marginLeft, currentY);
    currentY += 5;
  };

  const addParagraph = (text: string, fontSize: number = 6.5) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);

    const lines = doc.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * 3.5 + 2);
    doc.text(lines, marginLeft, currentY);
    currentY += lines.length * 3.5 + 2;
  };

  const addTableHeader = (cols: string[], widths: number[]) => {
    const rowHeight = 5;
    checkPageBreak(rowHeight + 2);

    doc.setFillColor(...primaryNavy);
    doc.rect(marginLeft, currentY - 3.5, contentWidth, rowHeight, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);

    let xPos = marginLeft + 2;
    cols.forEach((col, i) => {
      doc.text(col, xPos, currentY);
      xPos += widths[i];
    });

    currentY += rowHeight;
  };

  const addTableRow = (cols: string[], widths: number[]) => {
    const rowHeight = 5;
    checkPageBreak(rowHeight + 2);

    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);

    let xPos = marginLeft + 2;
    cols.forEach((col, i) => {
      const maxChars = Math.floor(widths[i] / 2);
      const truncated = col.length > maxChars ? col.substring(0, maxChars - 2) + ".." : col;
      doc.text(truncated, xPos, currentY);
      xPos += widths[i];
    });

    currentY += rowHeight;
  };

  // ========== PAGE 1: RÉSUMÉ DU CONTRAT ==========

  // Top accent
  doc.setFillColor(...accentTeal);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Header band
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 3, pageWidth, 28, "F");

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("Nivra Telecom — Contrat de services prépayés", pageWidth / 2, 15, { align: "center" });

  // Subtitle
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...accentTeal);
  doc.text("RÉSUMÉ DU CONTRAT", pageWidth / 2, 23, { align: "center" });

  currentY = 38;

  // Page label
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("Page 1 — Résumé et acceptation du contrat", marginLeft, currentY);
  currentY += 8;

  // Provider info box
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, currentY, contentWidth, 16, 1, 1, "FD");

  doc.setFontSize(6);
  doc.setTextColor(...textDark);
  doc.text(`Fournisseur: ${data.providerLegalName || BUSINESS_INFO.legalName}`, marginLeft + 3, currentY + 5);
  doc.text(`Adresse: ${data.providerAddress || BUSINESS_INFO.address}`, marginLeft + 3, currentY + 9);
  doc.text(`Support: ${data.supportPhone || BUSINESS_INFO.phone} | ${data.supportEmail || BUSINESS_INFO.email}`, marginLeft + 3, currentY + 13);

  currentY += 22;

  // Contract/Order info
  addLabelValue("Numéro de contrat", data.contractId || `CTR-PREP-${data.orderReference}`);
  addLabelValue("Numéro de commande", data.orderId);
  addLabelValue("Référence", data.orderReference);
  addLabelValue("Date d'émission", data.issueDate);
  addLabelValue("Date d'entrée en vigueur", data.effectiveDate);

  currentY += 4;

  // Client info
  addSubHeader("INFORMATIONS CLIENT");
  addLabelValue("Nom complet", data.clientFullName);
  addLabelValue("Courriel", data.clientEmail);
  addLabelValue("Téléphone", data.clientPhone || "—");
  addLabelValue("Adresse de service", data.serviceAddressFull || "—");
  addLabelValue("Adresse de facturation", data.billingAddressFull || data.serviceAddressFull || "—");

  currentY += 4;

  // Services summary
  addSubHeader("SERVICES SOUSCRITS");

  const serviceColWidths = [35, 70, 50];
  addTableHeader(["Service", "Forfait", "Prix/cycle"], serviceColWidths);

  if (data.mobilePlan) {
    addTableRow(["Mobile", data.mobilePlan.name, `${data.mobilePlan.cyclePrice.toFixed(2)} $`], serviceColWidths);
  }
  if (data.internetPlan) {
    addTableRow(["Internet", data.internetPlan.name, `${data.internetPlan.cyclePrice.toFixed(2)} $`], serviceColWidths);
  }
  if (data.tvPlan) {
    addTableRow(["TV", data.tvPlan.name, `${data.tvPlan.cyclePrice.toFixed(2)} $`], serviceColWidths);
  }
  if (data.streamingAddons && data.streamingAddons.length > 0) {
    const streamingList = data.streamingAddons.map(s => s.name).join(", ");
    const streamingTotal = data.streamingAddons.reduce((sum, s) => sum + s.priceMonthly, 0);
    addTableRow(["Streaming+", streamingList, `${streamingTotal.toFixed(2)} $`], serviceColWidths);
  }

  currentY += 6;

  // Totals box
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(marginLeft, currentY, contentWidth, 22, 1, 1, "FD");

  doc.setFontSize(6.5);
  doc.setTextColor(...textDark);
  let boxY = currentY + 5;
  doc.text(`Sous-total récurrent: ${data.recurringSubtotal.toFixed(2)} $`, marginLeft + 5, boxY);
  if (data.discountsTotal && data.discountsTotal > 0) {
    boxY += 4;
    doc.text(`Rabais: -${data.discountsTotal.toFixed(2)} $`, marginLeft + 5, boxY);
  }
  boxY += 4;
  doc.text(`Taxes (TPS/TVQ): ${data.taxTotal.toFixed(2)} $`, marginLeft + 5, boxY);
  boxY += 4;
  doc.setFont("helvetica", "bold");
  doc.text(`Total récurrent par cycle: ${data.recurringTotal.toFixed(2)} $`, marginLeft + 5, boxY);

  // One-time on right side
  doc.setFont("helvetica", "normal");
  boxY = currentY + 5;
  doc.text(`Frais uniques: ${data.oneTimeSubtotal.toFixed(2)} $`, marginLeft + 100, boxY);
  boxY += 4;
  doc.text(`Taxes frais uniques: ${data.oneTimeTax.toFixed(2)} $`, marginLeft + 100, boxY);
  boxY += 4;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text(`TOTAL DÛ AUJOURD'HUI: ${data.totalDueToday.toFixed(2)} $ CAD`, marginLeft + 100, boxY);

  currentY += 28;

  // Acceptation des annexes
  addSubHeader("ACCEPTATION DES ANNEXES");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  const annexeText = "En signant ce contrat, le client reconnaît avoir lu et accepté les termes et conditions décrits dans les annexes suivantes:";
  doc.text(annexeText, marginLeft, currentY);
  currentY += 5;

  const annexeList = [
    "Annexe A — Services prépayés et tarification",
    "Annexe B — Équipement et livraison",
    "Annexe C — Annulation et remboursement",
    "Annexe D — Responsabilité et confidentialité",
    "Annexe E — Instantané de commande (Snapshot)"
  ];

  annexeList.forEach(annexe => {
    doc.setFontSize(6);
    doc.text(`• ${annexe}`, marginLeft + 5, currentY);
    currentY += 4;
  });

  currentY += 6;

  // Signatures section
  addSubHeader("SIGNATURES");

  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 35;

  // Client signature box (LEFT)
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "FD");

  doc.setFillColor(...accentTeal);
  doc.rect(marginLeft, currentY, 3, sigBoxHeight, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("CLIENT", marginLeft + 8, currentY + 7);

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(`Nom: ${data.clientFullName}`, marginLeft + 8, currentY + 13);
  doc.text(`Signature: ${data.clientSignature || "____________________"}`, marginLeft + 8, currentY + 19);
  doc.text(`Date: ${data.clientSignedDatetime || "____________________"}`, marginLeft + 8, currentY + 25);
  doc.text(`IP: ${data.clientIp || "—"}`, marginLeft + 8, currentY + 31);

  // Provider signature box (RIGHT)
  const provSigX = marginLeft + sigBoxWidth + 10;
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(provSigX, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentTeal);
  doc.text("NIVRA TELECOM", provSigX + 5, currentY + 7);

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...white);
  doc.text(`Représentant: ${data.repNameTitle || "____________________"}`, provSigX + 5, currentY + 13);
  doc.text(`Signature: ${data.repSignature || "____________________"}`, provSigX + 5, currentY + 19);
  doc.text(`Date: ${data.repSignedDatetime || "____________________"}`, provSigX + 5, currentY + 25);

  currentY += sigBoxHeight + 8;

  // Signature status banner
  if (data.isSigned && data.signedAt) {
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1.5);
    doc.roundedRect(marginLeft, currentY, contentWidth, 12, 3, 3, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("CONTRAT SIGNÉ", pageWidth / 2, currentY + 7, { align: "center" });
  } else {
    doc.setFillColor(254, 249, 195);
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1.5);
    doc.roundedRect(marginLeft, currentY, contentWidth, 10, 3, 3, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(161, 98, 7);
    doc.text("EN ATTENTE DE SIGNATURE", pageWidth / 2, currentY + 6, { align: "center" });
  }

  addFooter(1);

  // ========== ANNEXE A: SERVICES PRÉPAYÉS ET TARIFICATION ==========
  addNewPage();
  addAnnexeHeader("A", "Services prépayés et tarification");

  addSectionHeader("1", "Prepaid & Cancellation");
  addParagraph("Prepaid service: recurring service fees are billed in advance for each service cycle.");
  addParagraph("Cancel anytime: you may cancel at any time. No device financing under this Agreement.");
  addParagraph("If you cancel, service typically remains active until the end of the already-paid period unless otherwise required by law.");

  addSectionHeader("2", "Services Provided");

  if (data.mobilePlan) {
    addSubHeader("2.1 Mobile (Prepaid)");
    addLabelValue("Plan", data.mobilePlan.name);
    addLabelValue("Price", `$${data.mobilePlan.cyclePrice.toFixed(2)} billed in advance`);
  }

  if (data.internetPlan) {
    addSubHeader("2.2 Internet (Prepaid)");
    addLabelValue("Plan", data.internetPlan.name);
    addLabelValue("Price", `$${data.internetPlan.cyclePrice.toFixed(2)} billed in advance`);
  }

  if (data.tvPlan) {
    addSubHeader("2.3 TV Bundle (Internet Required)");
    addParagraph("TV cannot be subscribed without an active Nivra Internet plan.");
    addLabelValue("TV Plan", data.tvPlan.name);
    addLabelValue("Price", `$${data.tvPlan.cyclePrice.toFixed(2)} billed in advance`);
  }

  if (data.streamingAddons && data.streamingAddons.length > 0) {
    addSubHeader("2.4 Streaming+ Add-ons");
    addParagraph("Streaming+ includes optional subscriptions such as: Amazon Prime Video, Apple TV+, Crave + HBO, Disney+ Standard, Netflix Premium, Spotify Premium");
    const streamingList = data.streamingAddons.map(s => s.name).join(", ");
    const streamingTotal = data.streamingAddons.reduce((sum, s) => sum + s.priceMonthly, 0);
    addLabelValue("Selected", streamingList);
    addLabelValue("Cycle total", `$${streamingTotal.toFixed(2)}`);
    addParagraph("Important: Streaming content availability, libraries, device compatibility, and platform features are provided by third parties and may change. Nivra provides billing/provisioning support as applicable.");
  }

  addSectionHeader("3", "Pricing, Billing, and Taxes");
  addParagraph("3.1 Prepaid billing: recurring charges are billed in advance for each cycle.");
  addParagraph("3.2 Invoices/Receipts: available in Client Portal.");
  addParagraph("3.3 Taxes: GST/QST apply where required.");

  addSectionHeader("4", "Late Payment, Unpaid Invoices, Suspension");
  addParagraph("4.1 If an invoice is overdue, Nivra may apply a 5% late fee on the overdue balance.");
  addParagraph("4.2 If payment remains overdue for 30 days, Nivra may suspend impacted services until payment is received.");
  addParagraph("4.3 Suspension does not remove the obligation to pay outstanding balances.");

  addSectionHeader("5", "Reactivation");
  addParagraph(`If service is suspended due to non-payment, a $15 reactivation fee applies to restore service (per account/order as configured: ${data.reactivationScope || "per account"}).`);

  addFooter(2);

  // ========== ANNEXE B: ÉQUIPEMENT ET LIVRAISON ==========
  addNewPage();
  addAnnexeHeader("B", "Équipement et livraison");

  addSectionHeader("1", "Equipment (Purchase vs Provider-Owned)");

  addSubHeader("1.1 Purchased Equipment (your order)");
  addParagraph("Purchased items (if any):");
  if (data.terminalQty && data.terminalQty > 0) {
    addParagraph(`  - Nivra 4K Smart Terminal: ${data.terminalQty} at $50 each`);
  }
  if (data.routerQty && data.routerQty > 0) {
    addParagraph(`  - Nivra Born WiFi Router: ${data.routerQty} at $60 each`);
  }
  addParagraph("Purchased equipment is owned by the Client after payment, unless otherwise stated on the invoice.");

  addSubHeader("1.2 Provider-Owned / Rental Equipment (if any)");
  addParagraph(`If Nivra provides loaned or rental equipment, it remains Nivra property and must be returned upon cancellation within ${data.returnWindowDays || 14} days, where applicable. (If you do not offer rentals, set this section to "Not applicable".)`);

  addSectionHeader("2", "One-Time Charges");

  const feeColWidths = [60, 25, 35, 35];
  addTableHeader(["Item", "Qty", "Unit Price", "Total"], feeColWidths);

  if (data.activationQty && data.activationQty > 0) {
    addTableRow(["Activation", String(data.activationQty), "$25.00", `$${(data.activationTotal || 25).toFixed(2)}`], feeColWidths);
  }
  if (data.deliveryQty && data.deliveryQty > 0) {
    addTableRow(["Delivery", String(data.deliveryQty), "$30.00", `$${(data.deliveryTotal || 30).toFixed(2)}`], feeColWidths);
  }
  if (data.terminalQty && data.terminalQty > 0) {
    addTableRow(["Nivra 4K Smart Terminal (purchase)", String(data.terminalQty), "$50.00", `$${(data.terminalTotal || 50).toFixed(2)}`], feeColWidths);
  }
  if (data.routerQty && data.routerQty > 0) {
    addTableRow(["Nivra Born WiFi Router (purchase)", String(data.routerQty), "$60.00", `$${(data.routerTotal || 60).toFixed(2)}`], feeColWidths);
  }
  if (data.reactivationQty && data.reactivationQty > 0) {
    addTableRow(["Reactivation (only if applicable)", String(data.reactivationQty), "$15.00", `$${(data.reactivationTotal || 15).toFixed(2)}`], feeColWidths);
  }

  currentY += 6;

  addLabelValue("One-time subtotal", `$${data.oneTimeSubtotal.toFixed(2)}`);
  addLabelValue("Taxes", `$${data.oneTimeTax.toFixed(2)}`);
  addLabelValue("One-time total", `$${data.oneTimeTotal.toFixed(2)}`);

  addSectionHeader("3", "Delivery, Activation, Installation");
  addParagraph("Activation fee: $25 (if applicable to your order)");
  addParagraph("Delivery fee: $30 (if applicable)");
  addParagraph(`Installation details (if any): ${data.installationDetails || "—"}`);

  addFooter(3);

  // ========== ANNEXE C: ANNULATION ET REMBOURSEMENT ==========
  addNewPage();
  addAnnexeHeader("C", "Annulation et remboursement");

  addSectionHeader("1", "Cancellation (Cancel Anytime)");
  addParagraph("Client may cancel at any time through portal or support.");
  addParagraph("Because services are prepaid, cancellation typically takes effect at the end of the already-paid period unless otherwise required by law. No device financing applies under this Agreement.");

  addSectionHeader("2", "Amount Due Today");

  // Total due box
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(marginLeft, currentY - 2, contentWidth, 10, 1, 1, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("Total due today:", marginLeft + 5, currentY + 4);
  doc.text(`$${data.totalDueToday.toFixed(2)} CAD`, pageWidth - marginRight - 5, currentY + 4, { align: "right" });
  currentY += 14;

  addLabelValue("Payment method", data.paymentMethod || "—");
  addLabelValue("Payment status", data.paymentStatus || "Pending");

  addSectionHeader("3", "Complaints and Escalation (CCTS/CRTC)");
  addParagraph("If you cannot resolve an issue with Nivra support, you may escalate a complaint to the CCTS (Commission for Complaints for Telecom-television Services).");
  addParagraph("CRTC also provides consumer information and complaint channels.");

  addFooter(4);

  // ========== ANNEXE D: RESPONSABILITÉ ET CONFIDENTIALITÉ ==========
  addNewPage();
  addAnnexeHeader("D", "Responsabilité et confidentialité");

  addSectionHeader("1", "Acceptable Use and Fraud Prevention");
  addParagraph("Client agrees not to use the Services for illegal purposes, fraud, abuse, or activities that materially degrade networks. Nivra may suspend services for suspected fraud or security risk, consistent with applicable law and fair process.");

  addSectionHeader("2", "Privacy and Confidentiality");
  addParagraph("Nivra collects and uses personal information to provide services, billing, support, and fraud prevention.");
  addParagraph(`Nivra handles personal information in accordance with applicable privacy laws. Privacy policy: ${data.privacyPolicyUrl || "www.nivra.ca/privacy"}.`);

  addSectionHeader("3", "Limitation of Liability");
  addParagraph(`To the maximum extent permitted by law, Nivra is not liable for indirect or consequential damages. Any direct liability is limited to ${data.liabilityCap || "fees paid in the 12 months preceding the claim"}.`);

  addSectionHeader("4", "Governing Law");
  addParagraph("This Agreement is governed by the laws of Quebec and the applicable laws of Canada.");

  addFooter(5);

  // ========== ANNEXE E: INSTANTANÉ DE COMMANDE (SNAPSHOT) ==========
  addNewPage();
  addAnnexeHeader("E", "Instantané de commande (Snapshot)");

  addSectionHeader("1", "Order Processing and Contract Generation");
  addParagraph("This contract is automatically generated when an order is marked Processed by Admin or Customer Service. The contract must reflect the order snapshot at that moment: plan names, prices, fees, taxes, totals, payment status.");
  addParagraph("If the contract data differs from the processed order snapshot, the processed order snapshot prevails and the contract must be regenerated.");

  currentY += 4;

  addLabelValue("Order ID", data.orderId);
  addLabelValue("Reference", data.orderReference);
  addLabelValue("Snapshot Timestamp", data.snapshotTimestamp || format(new Date(), "yyyy-MM-dd HH:mm:ss"));
  addLabelValue("Snapshot Hash", data.snapshotHash || "—");

  currentY += 6;

  // Repeat services table for audit
  addSubHeader("Services (Snapshot)");
  addTableHeader(["Service", "Plan", "Cycle Price"], serviceColWidths);

  if (data.mobilePlan) {
    addTableRow(["Mobile", data.mobilePlan.name, `$${data.mobilePlan.cyclePrice.toFixed(2)}`], serviceColWidths);
  }
  if (data.internetPlan) {
    addTableRow(["Internet", data.internetPlan.name, `$${data.internetPlan.cyclePrice.toFixed(2)}`], serviceColWidths);
  }
  if (data.tvPlan) {
    addTableRow(["TV (requires Internet)", data.tvPlan.name, `$${data.tvPlan.cyclePrice.toFixed(2)}`], serviceColWidths);
  }
  if (data.streamingAddons && data.streamingAddons.length > 0) {
    const streamingList = data.streamingAddons.map(s => s.name).join(", ");
    const streamingTotal = data.streamingAddons.reduce((sum, s) => sum + s.priceMonthly, 0);
    addTableRow(["Streaming+ Add-ons", streamingList, `$${streamingTotal.toFixed(2)}`], serviceColWidths);
  }

  currentY += 6;

  addSubHeader("One-Time Charges (Snapshot)");
  addTableHeader(["Item", "Qty", "Unit Price", "Total"], feeColWidths);

  if (data.activationQty && data.activationQty > 0) {
    addTableRow(["Activation", String(data.activationQty), "$25.00", `$${(data.activationTotal || 25).toFixed(2)}`], feeColWidths);
  }
  if (data.deliveryQty && data.deliveryQty > 0) {
    addTableRow(["Delivery", String(data.deliveryQty), "$30.00", `$${(data.deliveryTotal || 30).toFixed(2)}`], feeColWidths);
  }
  if (data.terminalQty && data.terminalQty > 0) {
    addTableRow(["Nivra 4K Smart Terminal", String(data.terminalQty), "$50.00", `$${(data.terminalTotal || 50).toFixed(2)}`], feeColWidths);
  }
  if (data.routerQty && data.routerQty > 0) {
    addTableRow(["Nivra Born WiFi Router", String(data.routerQty), "$60.00", `$${(data.routerTotal || 60).toFixed(2)}`], feeColWidths);
  }

  currentY += 6;

  addLabelValue("Total Due Today (Snapshot)", `$${data.totalDueToday.toFixed(2)} CAD`);
  addLabelValue("Payment Status (Snapshot)", data.paymentStatus || "Pending");

  currentY += 10;

  // End of Agreement
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("— FIN DU CONTRAT —", pageWidth / 2, currentY, { align: "center" });

  addFooter(6);

  // Update total pages - use pages array length
  totalPages = (doc.internal as any).pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Clear old footer area
    doc.setFillColor(255, 255, 255);
    doc.rect(0, pageHeight - 20, pageWidth, 20, "F");
    addFooter(i);
  }

  return doc;
};

// ========== UTILITY FUNCTIONS ==========

export const downloadPrepaidContractPDF = (data: PrepaidContractData): void => {
  try {
    const doc = generatePrepaidContractPDF(data);
    const blob = doc.output("blob");
    const version = data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version;
    const idPart = data.contractId || data.orderReference;
    const filename = `PSA-${idPart}-${version}.pdf`;
    safePDFDownload(blob, filename);
  } catch (error) {
    console.error("Error generating Prepaid PDF:", error);
    throw new Error("Failed to generate prepaid contract PDF");
  }
};

export const viewPrepaidContractPDF = (data: PrepaidContractData): void => {
  try {
    const doc = generatePrepaidContractPDF(data);
    const blob = doc.output("blob");
    const version = data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version;
    const idPart = data.contractId || data.orderReference;
    const filename = `PSA-${idPart}-${version}.pdf`;
    safePDFOpen(blob, filename);
  } catch (error) {
    console.error("Error viewing Prepaid PDF:", error);
    throw new Error("Failed to open prepaid contract PDF");
  }
};

export const getPrepaidContractBlob = (data: PrepaidContractData): Blob => {
  try {
    const doc = generatePrepaidContractPDF(data);
    return doc.output("blob");
  } catch (error) {
    console.error("Error creating Prepaid PDF blob:", error);
    throw new Error("Failed to create prepaid contract PDF");
  }
};
