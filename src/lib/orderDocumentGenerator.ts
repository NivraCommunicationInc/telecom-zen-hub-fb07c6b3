import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { BUSINESS_INFO, CONTRACT_TERMS } from "./contractPolicies";
import { safePDFDownload, safePDFOpen } from "./pdfUtils";

// =====================================================================
// TYPES & INTERFACES
// =====================================================================

export interface OrderSnapshotData {
  // Client Info
  client: {
    legalName: string;
    firstName: string;
    lastName: string;
    type: "Individual" | "Business";
    email: string;
    phone: string;
    billingAddress: string;
    serviceAddress: string;
    serviceCity: string;
    serviceProvince: string;
    servicePostalCode: string;
    authorizedUser?: string;
  };
  // Services
  services: Array<{
    type: string;
    planName: string;
    inclusions?: string;
    termMonths?: number;
    monthlyPrice: number;
  }>;
  // Equipment
  equipment: Array<{
    name: string;
    quantity: number;
    serialOrId?: string;
    warrantyTerm?: string;
    priceType: "One-Time" | "Monthly";
    amount: number;
  }>;
  // Fees
  fees: {
    activationFee: number;
    deliveryFee: number;
    installationFee: number;
    installationCredit: number;
    routerFee: number;
    terminalFee: number;
  };
  // Billing Totals
  billing: {
    mrc: number; // Monthly Recurring
    otc: number; // One-Time Charges
    subtotal: number;
    gst: number;
    qst: number;
    totalDueToday: number;
    estimatedNextMonth: number;
    billingCycleStart?: string;
    billingCycleEnd?: string;
  };
  // Acceptance
  acceptedAt: string;
  acceptedMethod: "electronic" | "manual";
}

export interface FulfillmentSnapshotData {
  deliveryMethod: string;
  deliveryFee: number;
  trackingNumber?: string;
  trackingUrl?: string;
  installationSelected: boolean;
  installationFee: number;
  technicianETA?: string;
  technicianName?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
  paymentStatus: "unpaid" | "paid";
  paymentReference?: string;
  equipmentIds: Array<{
    type: string;
    serialNumber?: string;
    imei?: string;
    simNumber?: string;
  }>;
}

export interface OrderDocumentData {
  // Order Info
  orderConfirmationNumber: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  category?: string;
  
  // Agreement Info
  contractNumber: string;
  agreementVersion: number;
  issueDate: string;
  effectiveDate: string;
  orderChannel: "Client Portal" | "Admin Assisted";
  
  // Snapshots
  orderSnapshot: OrderSnapshotData;
  fulfillmentSnapshot?: FulfillmentSnapshotData;
  
  // Document Type
  docType: "order_confirmation_agreement" | "final_service_agreement";
}

// =====================================================================
// STATUS GATING VALIDATION
// =====================================================================

export interface StatusGatingResult {
  valid: boolean;
  missingFields: string[];
  allowedStatus: boolean;
}

export const STATUS_REQUIRED_FIELDS: Record<string, string[]> = {
  pending: [], // No additional fields required
  verification: [],
  processed: [
    "deliveryMethod",
    "deliveryFee", // Can be 0 but must be explicit
    "paymentStatus",
  ],
  installation_scheduled: [
    "deliveryMethod",
    "deliveryFee",
    "paymentStatus",
    "installationSelected", // Must be true
    "installationFee", // Can be 0 but must be explicit
    "technicianETA", // Required for scheduled installation
  ],
  shipped: [
    "deliveryMethod",
    "deliveryFee",
    "paymentStatus",
    "trackingNumber", // Required when shipped
  ],
  completed: [
    "deliveryMethod",
    "deliveryFee",
    "paymentStatus",
    "trackingNumber",
  ],
  completed_installation: [
    "deliveryMethod",
    "deliveryFee",
    "paymentStatus",
    "installationSelected",
    "installationFee",
    "technicianETA",
  ],
};

export const CONDITIONAL_REQUIRED_FIELDS: Record<string, { condition: string; field: string }[]> = {
  processed: [
    { condition: "paymentStatus === 'paid'", field: "paymentReference" },
  ],
  shipped: [
    { condition: "paymentStatus === 'paid'", field: "paymentReference" },
    { condition: "hasEquipment === true", field: "equipmentIds" },
  ],
};

export function validateStatusChange(
  targetStatus: string,
  currentData: {
    deliveryMethod?: string;
    deliveryFee?: number;
    trackingNumber?: string;
    installationSelected?: boolean;
    installationFee?: number;
    technicianETA?: string;
    paymentStatus?: string;
    paymentReference?: string;
    equipmentIds?: any[];
    hasEquipment?: boolean;
  }
): StatusGatingResult {
  const requiredFields = STATUS_REQUIRED_FIELDS[targetStatus] || [];
  const missingFields: string[] = [];
  
  // Check basic required fields
  for (const field of requiredFields) {
    const value = currentData[field as keyof typeof currentData];
    
    if (field === "installationSelected" && value !== true) {
      missingFields.push("Installation must be selected for this status");
    } else if (field === "deliveryFee" || field === "installationFee") {
      // These can be 0 but must be explicitly set (not undefined/null)
      if (value === undefined || value === null) {
        missingFields.push(field);
      }
    } else if (!value && value !== 0) {
      missingFields.push(field);
    }
  }
  
  // Check conditional fields
  const conditionalFields = CONDITIONAL_REQUIRED_FIELDS[targetStatus] || [];
  for (const { condition, field } of conditionalFields) {
    // Simple condition evaluation
    if (condition === "paymentStatus === 'paid'" && currentData.paymentStatus === "paid") {
      if (!currentData.paymentReference) {
        missingFields.push("paymentReference (required when payment is confirmed)");
      }
    }
    if (condition === "hasEquipment === true" && currentData.hasEquipment) {
      if (!currentData.equipmentIds || currentData.equipmentIds.length === 0) {
        missingFields.push("equipmentIds (serial/SIM numbers required for shipped equipment)");
      }
    }
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields,
    allowedStatus: true,
  };
}

// =====================================================================
// PDF GENERATION - DOCUMENT A (Order Confirmation Agreement)
// =====================================================================

export function generateOrderConfirmationPDF(data: OrderDocumentData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 15;
  let pageNumber = 1;
  
  // Color palette
  const primaryNavy: [number, number, number] = [15, 23, 42];
  const accentTeal: [number, number, number] = [20, 184, 166];
  const textDark: [number, number, number] = [30, 41, 59];
  const textMuted: [number, number, number] = [100, 116, 139];
  const borderLight: [number, number, number] = [203, 213, 225];
  const bgLight: [number, number, number] = [248, 250, 252];
  const white: [number, number, number] = [255, 255, 255];
  
  // ========== HELPER FUNCTIONS ==========
  
  const addFooter = () => {
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 18, pageWidth - marginRight, pageHeight - 18);
    
    doc.setFontSize(5);
    doc.setTextColor(...textMuted);
    doc.text(
      `${BUSINESS_INFO.legalName} — ${BUSINESS_INFO.address} — ${BUSINESS_INFO.serviceTerritory}`,
      pageWidth / 2,
      pageHeight - 13,
      { align: "center" }
    );
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${pageNumber}`, pageWidth - marginRight, pageHeight - 8, { align: "right" });
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
      doc.text("NIVRA COMMUNICATIONS INC. — Order Confirmation Agreement", marginLeft, 9);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(`Order: ${data.orderConfirmationNumber}`, pageWidth - marginRight, 9, { align: "right" });
      
      currentY = 18;
    }
  };
  
  const addNewPage = () => {
    addFooter();
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
  
  const addSectionDivider = (letter: string, title: string) => {
    checkPageBreak(12);
    currentY += 4;
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 4;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryNavy);
    doc.text(`${letter}) ${title.toUpperCase()}`, marginLeft, currentY);
    currentY += 2;
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 6;
  };
  
  const addLabelValue = (label: string, value: string, labelWidth: number = 60) => {
    checkPageBreak(5);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text((label + ":").padEnd(35, " "), marginLeft, currentY);
    doc.setTextColor(...textDark);
    doc.text(value || "N/A", marginLeft + labelWidth, currentY);
    currentY += 4.5;
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
  
  const addTableRow = (cols: string[], widths: number[], isHeader: boolean = false) => {
    const rowHeight = 5;
    checkPageBreak(rowHeight + 2);
    
    if (isHeader) {
      doc.setFillColor(...primaryNavy);
      doc.rect(marginLeft, currentY - 3.5, contentWidth, rowHeight, "F");
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
    } else {
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textDark);
    }
    
    let xPos = marginLeft + 2;
    cols.forEach((col, i) => {
      const maxWidth = widths[i] - 4;
      const truncated = col.length > maxWidth / 2 ? col.substring(0, Math.floor(maxWidth / 2)) + "..." : col;
      doc.text(truncated, xPos, currentY);
      xPos += widths[i];
    });
    
    currentY += rowHeight;
  };
  
  // ========== PAGE 1: HEADER ==========
  
  // Top accent line
  doc.setFillColor(...accentTeal);
  doc.rect(0, 0, pageWidth, 3, "F");
  
  // Header band
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 3, pageWidth, 28, "F");
  
  // Company name
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("NIVRA COMMUNICATIONS INC.", pageWidth / 2, 15, { align: "center" });
  
  // Subtitle - Document A
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...accentTeal);
  doc.text("Order Confirmation Agreement — Client Copy", pageWidth / 2, 23, { align: "center" });
  
  currentY = 36;
  
  // Head Office info box
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, currentY, contentWidth, 18, 1, 1, "FD");
  
  doc.setFontSize(6);
  doc.setTextColor(...textDark);
  doc.text(`Head Office: ${BUSINESS_INFO.address}`, marginLeft + 3, currentY + 5);
  doc.text(`Support: ${BUSINESS_INFO.email} | ${BUSINESS_INFO.phone}`, marginLeft + 3, currentY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(`Service Territory: ${BUSINESS_INFO.serviceTerritory}`, marginLeft + 3, currentY + 15);
  
  currentY += 24;
  
  const snapshot = data.orderSnapshot;
  
  // ========== A) AGREEMENT IDENTIFICATION ==========
  addSectionDivider("A", "Agreement Identification");
  
  addLabelValue("Order Confirmation Number", data.orderConfirmationNumber);
  addLabelValue("Order Reference", data.orderNumber);
  addLabelValue("Agreement Version", `${data.agreementVersion}`);
  addLabelValue("Issue Date", data.issueDate);
  addLabelValue("Agreement Effective Date", data.effectiveDate);
  addLabelValue("Order Channel", data.orderChannel);
  addLabelValue("Status", data.status);
  
  // ========== B) CUSTOMER INFORMATION ==========
  addSectionDivider("B", "Customer Information");
  
  addLabelValue("Account Holder / Legal Name", snapshot.client.legalName);
  addLabelValue("Client Type", snapshot.client.type);
  addLabelValue("Billing Address", snapshot.client.billingAddress || snapshot.client.serviceAddress);
  
  const fullServiceAddr = [
    snapshot.client.serviceAddress,
    snapshot.client.serviceCity,
    snapshot.client.serviceProvince || "QC",
    snapshot.client.servicePostalCode
  ].filter(Boolean).join(", ");
  addLabelValue("Service Address", fullServiceAddr);
  addLabelValue("Email", snapshot.client.email);
  addLabelValue("Phone", snapshot.client.phone);
  addLabelValue("Authorized User (if any)", snapshot.client.authorizedUser || "N/A");
  
  addFooter();
  
  // ========== PAGE 2: SERVICES & EQUIPMENT ==========
  addNewPage();
  
  addSectionDivider("C", "Services Subscribed");
  
  const serviceColWidths = [30, 45, 45, 25, 30];
  addTableRow(["SERVICE TYPE", "PLAN NAME", "INCLUDED FEATURES", "TERM", "MONTHLY (CAD)"], serviceColWidths, true);
  
  if (snapshot.services.length > 0) {
    snapshot.services.forEach(svc => {
      addTableRow([
        svc.type,
        svc.planName,
        svc.inclusions || "Standard features",
        svc.termMonths ? `${svc.termMonths} mo` : "Monthly",
        `$${svc.monthlyPrice.toFixed(2)}`
      ], serviceColWidths);
    });
  } else {
    addTableRow(["N/A", "No services selected", "—", "—", "—"], serviceColWidths);
  }
  
  currentY += 6;
  
  addSectionDivider("D", "Equipment");
  
  const equipColWidths = [50, 15, 40, 25, 25, 25];
  addTableRow(["ITEM", "QTY", "SERIAL/ID", "WARRANTY", "TYPE", "AMOUNT"], equipColWidths, true);
  
  if (snapshot.equipment.length > 0) {
    snapshot.equipment.forEach(eq => {
      addTableRow([
        eq.name,
        String(eq.quantity),
        eq.serialOrId || "Pending (assigned later)",
        eq.warrantyTerm || "1 Year",
        eq.priceType,
        `$${eq.amount.toFixed(2)}`
      ], equipColWidths);
    });
  } else {
    addTableRow(["No equipment", "—", "—", "—", "—", "—"], equipColWidths);
  }
  
  currentY += 6;
  
  // ========== E) ONE-TIME FEES ==========
  addSectionDivider("E", "One-Time Fees & Delivery");
  
  const feeColWidths = [60, 60, 55];
  addTableRow(["FEE TYPE", "DESCRIPTION", "AMOUNT (CAD)"], feeColWidths, true);
  
  if (snapshot.fees.activationFee > 0) {
    addTableRow(["Activation", "Service activation fee", `$${snapshot.fees.activationFee.toFixed(2)}`], feeColWidths);
  }
  if (snapshot.fees.deliveryFee > 0) {
    addTableRow(["Delivery", "Standard Québec Delivery", `$${snapshot.fees.deliveryFee.toFixed(2)}`], feeColWidths);
  }
  if (snapshot.fees.installationFee > 0) {
    const netInstall = Math.max(0, snapshot.fees.installationFee - (snapshot.fees.installationCredit || 0));
    addTableRow(["Installation", "Technician installation", `$${netInstall.toFixed(2)}`], feeColWidths);
  }
  if (snapshot.fees.routerFee > 0) {
    addTableRow(["Router", "Nivra Born WiFi Router", `$${snapshot.fees.routerFee.toFixed(2)}`], feeColWidths);
  }
  if (snapshot.fees.terminalFee > 0) {
    addTableRow(["TV Terminal(s)", "Nivra 4K Smart Terminal", `$${snapshot.fees.terminalFee.toFixed(2)}`], feeColWidths);
  }
  
  currentY += 4;
  
  // Fulfillment placeholders (Document A)
  addParagraph("Fulfillment Details (assigned upon processing):");
  addLabelValue("Tracking Number", "Pending (assigned upon shipment)");
  addLabelValue("Technician ETA", "Pending (assigned upon scheduling)");
  addLabelValue("Invoice Number", "Pending (assigned upon billing)");
  addLabelValue("Payment Reference", "Pending (assigned after payment)");
  
  addFooter();
  
  // ========== PAGE 3: BILLING SUMMARY ==========
  addNewPage();
  
  addSectionDivider("F", "Billing Summary");
  
  addLabelValue("Monthly Recurring Charges (MRC)", `$${snapshot.billing.mrc.toFixed(2)}`);
  addLabelValue("One-Time Charges (OTC)", `$${snapshot.billing.otc.toFixed(2)}`);
  addLabelValue("Subtotal Before Taxes", `$${snapshot.billing.subtotal.toFixed(2)}`);
  addLabelValue("GST (5%)", `$${snapshot.billing.gst.toFixed(2)}`);
  addLabelValue("QST (9.975%)", `$${snapshot.billing.qst.toFixed(2)}`);
  
  currentY += 2;
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(marginLeft, currentY - 2, contentWidth, 8, 1, 1, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("TOTAL DUE TODAY:", marginLeft + 5, currentY + 3);
  doc.text(`$${snapshot.billing.totalDueToday.toFixed(2)} CAD`, pageWidth - marginRight - 5, currentY + 3, { align: "right" });
  currentY += 12;
  
  addLabelValue("Next Estimated Monthly Total", `$${snapshot.billing.estimatedNextMonth.toFixed(2)}`);
  addLabelValue("Billing Cycle", snapshot.billing.billingCycleStart && snapshot.billing.billingCycleEnd 
    ? `${snapshot.billing.billingCycleStart} to ${snapshot.billing.billingCycleEnd}` 
    : "Monthly");
  
  // ========== G) PAYMENT TERMS ==========
  addSectionDivider("G", "Payment Terms");
  
  addParagraph("Accepted payment methods: Credit Card (processed internally) and Secure E-Transfer.");
  addParagraph("Payment must be completed before order confirmation or equipment shipment.");
  
  addLabelValue("Payment Status", "Unpaid");
  addLabelValue("Payment Due Date", "Upon order confirmation");
  addLabelValue("Payment Reference", "Pending (assigned after payment)");
  
  // ========== H) POLICIES ==========
  addSectionDivider("H", "Terms & Policies");
  
  addParagraph(`Late Payment: Any payment not received within 30 days is subject to ${CONTRACT_TERMS.paymentTerms.lateInterestRate}% monthly interest.`);
  addParagraph(`Cancellation: Client cancellation requires ${CONTRACT_TERMS.cancellation.noticeDays} days notice.`);
  addParagraph("Privacy: Client data is protected under Québec Law 25 and used only for service delivery.");
  addParagraph("Governing Law: This Agreement is governed by Québec law and applicable federal laws of Canada.");
  
  // ========== I) ACCEPTANCE ==========
  addSectionDivider("I", "Client Acceptance");
  
  addParagraph("By placing this order, you agree to the terms and conditions outlined in this agreement.");
  
  currentY += 4;
  addLabelValue("Accepted At", format(new Date(snapshot.acceptedAt), "d MMMM yyyy 'at' HH:mm", { locale: fr }));
  addLabelValue("Acceptance Method", snapshot.acceptedMethod === "electronic" ? "Electronic (Online Checkout)" : "Manual");
  
  currentY += 8;
  
  // Status banner
  doc.setFillColor(254, 249, 195);
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(1.5);
  doc.roundedRect(marginLeft, currentY, contentWidth, 12, 3, 3, "FD");
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(161, 98, 7);
  doc.text("ORDER CONFIRMATION — AWAITING PROCESSING", pageWidth / 2, currentY + 8, { align: "center" });
  
  currentY += 20;
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("— END OF ORDER CONFIRMATION AGREEMENT —", pageWidth / 2, currentY, { align: "center" });
  
  addFooter();
  
  return doc;
}

// =====================================================================
// PDF GENERATION - DOCUMENT B (Final Service Agreement)
// =====================================================================

export function generateFinalServiceAgreementPDF(data: OrderDocumentData): jsPDF {
  if (!data.fulfillmentSnapshot) {
    throw new Error("Fulfillment snapshot is required for Final Service Agreement");
  }
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 15;
  let pageNumber = 1;
  
  // Color palette
  const primaryNavy: [number, number, number] = [15, 23, 42];
  const accentTeal: [number, number, number] = [20, 184, 166];
  const textDark: [number, number, number] = [30, 41, 59];
  const textMuted: [number, number, number] = [100, 116, 139];
  const borderLight: [number, number, number] = [203, 213, 225];
  const bgLight: [number, number, number] = [248, 250, 252];
  const white: [number, number, number] = [255, 255, 255];
  
  const snapshot = data.orderSnapshot;
  const fulfillment = data.fulfillmentSnapshot;
  
  // ========== HELPER FUNCTIONS ==========
  
  const addFooter = () => {
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 18, pageWidth - marginRight, pageHeight - 18);
    
    doc.setFontSize(5);
    doc.setTextColor(...textMuted);
    doc.text(
      `${BUSINESS_INFO.legalName} — ${BUSINESS_INFO.address} — ${BUSINESS_INFO.serviceTerritory}`,
      pageWidth / 2,
      pageHeight - 13,
      { align: "center" }
    );
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${pageNumber}`, pageWidth - marginRight, pageHeight - 8, { align: "right" });
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
      doc.text("NIVRA COMMUNICATIONS INC. — Final Service Agreement", marginLeft, 9);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(`Contract: ${data.contractNumber} | v${data.agreementVersion}`, pageWidth - marginRight, 9, { align: "right" });
      
      currentY = 18;
    }
  };
  
  const addNewPage = () => {
    addFooter();
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
  
  const addSectionDivider = (letter: string, title: string) => {
    checkPageBreak(12);
    currentY += 4;
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 4;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryNavy);
    doc.text(`${letter}) ${title.toUpperCase()}`, marginLeft, currentY);
    currentY += 2;
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 6;
  };
  
  const addLabelValue = (label: string, value: string, labelWidth: number = 60) => {
    checkPageBreak(5);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text((label + ":").padEnd(35, " "), marginLeft, currentY);
    doc.setTextColor(...textDark);
    doc.text(value || "N/A", marginLeft + labelWidth, currentY);
    currentY += 4.5;
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
  
  const addTableRow = (cols: string[], widths: number[], isHeader: boolean = false) => {
    const rowHeight = 5;
    checkPageBreak(rowHeight + 2);
    
    if (isHeader) {
      doc.setFillColor(...primaryNavy);
      doc.rect(marginLeft, currentY - 3.5, contentWidth, rowHeight, "F");
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
    } else {
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textDark);
    }
    
    let xPos = marginLeft + 2;
    cols.forEach((col, i) => {
      const maxWidth = widths[i] - 4;
      const truncated = col.length > maxWidth / 2 ? col.substring(0, Math.floor(maxWidth / 2)) + "..." : col;
      doc.text(truncated, xPos, currentY);
      xPos += widths[i];
    });
    
    currentY += rowHeight;
  };
  
  // ========== PAGE 1: HEADER ==========
  
  // Top accent line
  doc.setFillColor(...accentTeal);
  doc.rect(0, 0, pageWidth, 3, "F");
  
  // Header band
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 3, pageWidth, 28, "F");
  
  // Company name
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("NIVRA COMMUNICATIONS INC.", pageWidth / 2, 15, { align: "center" });
  
  // Subtitle - Document B
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...accentTeal);
  doc.text("Final Service Agreement — Client Copy", pageWidth / 2, 23, { align: "center" });
  
  currentY = 36;
  
  // Agreement details box (right-aligned style)
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageWidth - marginRight - 70, currentY, 70, 30, 1, 1, "FD");
  
  doc.setFontSize(5);
  doc.setTextColor(...textMuted);
  const boxX = pageWidth - marginRight - 68;
  doc.text("AGREEMENT DETAILS", boxX, currentY + 5);
  doc.setFontSize(6);
  doc.setTextColor(...textDark);
  doc.text(`Contract #: ${data.contractNumber}`, boxX, currentY + 10);
  doc.text(`Order #: ${data.orderConfirmationNumber}`, boxX, currentY + 15);
  doc.text(`Issue Date: ${data.issueDate}`, boxX, currentY + 20);
  doc.text(`Version: ${data.agreementVersion}`, boxX, currentY + 25);
  
  // Head Office info (left side)
  doc.setFontSize(6);
  doc.setTextColor(...textDark);
  doc.text(`Head Office: ${BUSINESS_INFO.address}`, marginLeft, currentY + 5);
  doc.text(`Support: ${BUSINESS_INFO.email} | ${BUSINESS_INFO.phone}`, marginLeft, currentY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(`Service Territory: ${BUSINESS_INFO.serviceTerritory}`, marginLeft, currentY + 15);
  
  currentY += 36;
  
  // ========== A) AGREEMENT IDENTIFICATION ==========
  addSectionDivider("A", "Agreement Identification");
  
  addLabelValue("Contract Number", data.contractNumber);
  addLabelValue("Order Confirmation Number", data.orderConfirmationNumber);
  addLabelValue("Order Reference", data.orderNumber);
  addLabelValue("Agreement Version", `${data.agreementVersion}`);
  addLabelValue("Issue Date", data.issueDate);
  addLabelValue("Agreement Effective Date", data.effectiveDate);
  addLabelValue("Order Channel", data.orderChannel);
  addLabelValue("Status", data.status);
  
  // ========== B) CUSTOMER INFORMATION ==========
  addSectionDivider("B", "Customer Information");
  
  addLabelValue("Account Holder / Legal Name", snapshot.client.legalName);
  addLabelValue("Client Type", snapshot.client.type);
  addLabelValue("Billing Address", snapshot.client.billingAddress || snapshot.client.serviceAddress);
  
  const fullServiceAddr = [
    snapshot.client.serviceAddress,
    snapshot.client.serviceCity,
    snapshot.client.serviceProvince || "QC",
    snapshot.client.servicePostalCode
  ].filter(Boolean).join(", ");
  addLabelValue("Service Address", fullServiceAddr);
  addLabelValue("Email", snapshot.client.email);
  addLabelValue("Phone", snapshot.client.phone);
  addLabelValue("Authorized User", snapshot.client.authorizedUser || "N/A");
  
  addFooter();
  
  // ========== PAGE 2: SERVICES & EQUIPMENT ==========
  addNewPage();
  
  addSectionDivider("C", "Services Subscribed");
  
  const serviceColWidths = [30, 45, 45, 25, 30];
  addTableRow(["SERVICE TYPE", "PLAN NAME", "INCLUDED FEATURES", "TERM", "MONTHLY (CAD)"], serviceColWidths, true);
  
  if (snapshot.services.length > 0) {
    snapshot.services.forEach(svc => {
      addTableRow([
        svc.type,
        svc.planName,
        svc.inclusions || "Standard features",
        svc.termMonths ? `${svc.termMonths} mo` : "Monthly",
        `$${svc.monthlyPrice.toFixed(2)}`
      ], serviceColWidths);
    });
  } else {
    addTableRow(["N/A", "No services selected", "—", "—", "—"], serviceColWidths);
  }
  
  currentY += 6;
  
  addSectionDivider("D", "Equipment & Device Details");
  
  const equipColWidths = [45, 12, 45, 20, 20, 25];
  addTableRow(["ITEM", "QTY", "SERIAL/ID", "WARRANTY", "TYPE", "AMOUNT"], equipColWidths, true);
  
  // Merge equipment from snapshot with fulfillment IDs
  if (snapshot.equipment.length > 0) {
    snapshot.equipment.forEach((eq, idx) => {
      const eqId = fulfillment.equipmentIds[idx];
      const serialDisplay = eqId?.serialNumber || eqId?.imei || eqId?.simNumber || eq.serialOrId || "N/A";
      
      addTableRow([
        eq.name,
        String(eq.quantity),
        serialDisplay,
        eq.warrantyTerm || "1 Year",
        eq.priceType,
        `$${eq.amount.toFixed(2)}`
      ], equipColWidths);
    });
  } else {
    addTableRow(["No equipment", "—", "—", "—", "—", "—"], equipColWidths);
  }
  
  currentY += 6;
  
  // ========== E) DELIVERY & INSTALLATION ==========
  addSectionDivider("E", "Delivery & Installation");
  
  addLabelValue("Delivery Method", fulfillment.deliveryMethod || "Standard Québec Delivery");
  addLabelValue("Delivery Fee", `$${(fulfillment.deliveryFee || 0).toFixed(2)}`);
  addLabelValue("Tracking Number", fulfillment.trackingNumber || "N/A");
  if (fulfillment.trackingUrl) {
    addLabelValue("Tracking URL", fulfillment.trackingUrl);
  }
  
  currentY += 2;
  addLabelValue("Installation Selected", fulfillment.installationSelected ? "Yes" : "No");
  addLabelValue("Installation Fee", fulfillment.installationSelected ? `$${fulfillment.installationFee.toFixed(2)}` : "$0.00 (N/A)");
  addLabelValue("Technician ETA", fulfillment.installationSelected 
    ? (fulfillment.technicianETA || "To be scheduled") 
    : "N/A (installation not selected)");
  if (fulfillment.technicianName) {
    addLabelValue("Assigned Technician", fulfillment.technicianName);
  }
  
  addFooter();
  
  // ========== PAGE 3: BILLING & PAYMENT ==========
  addNewPage();
  
  addSectionDivider("F", "Billing Summary");
  
  addLabelValue("Monthly Recurring Charges (MRC)", `$${snapshot.billing.mrc.toFixed(2)}`);
  addLabelValue("One-Time Charges (OTC)", `$${snapshot.billing.otc.toFixed(2)}`);
  addLabelValue("Subtotal Before Taxes", `$${snapshot.billing.subtotal.toFixed(2)}`);
  addLabelValue("GST (5%)", `$${snapshot.billing.gst.toFixed(2)}`);
  addLabelValue("QST (9.975%)", `$${snapshot.billing.qst.toFixed(2)}`);
  
  currentY += 2;
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(marginLeft, currentY - 2, contentWidth, 8, 1, 1, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("TOTAL AMOUNT:", marginLeft + 5, currentY + 3);
  doc.text(`$${snapshot.billing.totalDueToday.toFixed(2)} CAD`, pageWidth - marginRight - 5, currentY + 3, { align: "right" });
  currentY += 12;
  
  addLabelValue("Invoice Number", fulfillment.invoiceNumber || "N/A");
  addLabelValue("Next Estimated Monthly Total", `$${snapshot.billing.estimatedNextMonth.toFixed(2)}`);
  
  // ========== G) PAYMENT CONFIRMATION ==========
  addSectionDivider("G", "Payment Confirmation");
  
  addLabelValue("Payment Method", fulfillment.paymentMethod || "N/A");
  addLabelValue("Payment Status", fulfillment.paymentStatus === "paid" ? "PAID" : "Unpaid");
  addLabelValue("Payment Reference", fulfillment.paymentReference || "N/A");
  
  if (fulfillment.paymentStatus === "paid") {
    currentY += 4;
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);
    doc.roundedRect(marginLeft, currentY, contentWidth, 10, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("✓ PAYMENT CONFIRMED", pageWidth / 2, currentY + 6, { align: "center" });
    currentY += 14;
  }
  
  // ========== H) POLICIES ==========
  addSectionDivider("H", "Terms & Policies");
  
  addParagraph(`Late Payment: Any payment not received within 30 days is subject to ${CONTRACT_TERMS.paymentTerms.lateInterestRate}% monthly interest.`);
  addParagraph(`Cancellation: Client cancellation requires ${CONTRACT_TERMS.cancellation.noticeDays} days notice.`);
  addParagraph("Privacy: Client data is protected under Québec Law 25 and used only for service delivery.");
  addParagraph("Governing Law: This Agreement is governed by Québec law and applicable federal laws of Canada.");
  addParagraph("Equipment Replacement: Any replacement request may result in a billable replacement order. Replacement shipments are released only after payment confirmation. Warranty exclusions apply; Admin may approve exceptions and this is logged internally.");
  
  addFooter();
  
  // ========== PAGE 4: SIGNATURES ==========
  addNewPage();
  
  addSectionDivider("I", "Signatures");
  
  currentY += 4;
  
  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 40;
  
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
  doc.text("CLIENT", marginLeft + 8, currentY + 8);
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(`Name: ${snapshot.client.legalName}`, marginLeft + 8, currentY + 16);
  doc.text("Signature: ____________________", marginLeft + 8, currentY + 24);
  doc.text(`Date: ${format(new Date(snapshot.acceptedAt), "d MMM yyyy")}`, marginLeft + 8, currentY + 32);
  
  // Provider signature box (RIGHT)
  const provSigX = marginLeft + sigBoxWidth + 10;
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(provSigX, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentTeal);
  doc.text("PROVIDER", provSigX + 5, currentY + 8);
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...white);
  doc.text("Rep: Nivra Communications Inc.", provSigX + 5, currentY + 16);
  doc.text("Signature: ____________________", provSigX + 5, currentY + 24);
  doc.text(`Date: ${data.issueDate}`, provSigX + 5, currentY + 32);
  
  currentY += sigBoxHeight + 12;
  
  // Status banner
  const isComplete = data.status === "completed" || data.status === "completed_installation";
  
  if (isComplete) {
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1.5);
    doc.roundedRect(marginLeft, currentY, contentWidth, 15, 3, 3, "FD");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("✓ AGREEMENT EXECUTED", pageWidth / 2, currentY + 7, { align: "center" });
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Effective: ${data.effectiveDate}`, pageWidth / 2, currentY + 12, { align: "center" });
  } else {
    doc.setFillColor(219, 234, 254);
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(1.5);
    doc.roundedRect(marginLeft, currentY, contentWidth, 12, 3, 3, "FD");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(`STATUS: ${data.status.toUpperCase().replace(/_/g, " ")}`, pageWidth / 2, currentY + 8, { align: "center" });
  }
  
  currentY += 24;
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("— END OF FINAL SERVICE AGREEMENT —", pageWidth / 2, currentY, { align: "center" });
  
  addFooter();
  
  return doc;
}

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

export function downloadOrderConfirmationPDF(data: OrderDocumentData): void {
  try {
    const doc = generateOrderConfirmationPDF(data);
    const blob = doc.output("blob");
    const filename = `Order-Confirmation-${data.orderConfirmationNumber}.pdf`;
    safePDFDownload(blob, filename);
  } catch (error) {
    console.error("Error generating Order Confirmation PDF:", error);
    throw new Error("Failed to generate Order Confirmation Agreement");
  }
}

export function downloadFinalServiceAgreementPDF(data: OrderDocumentData): void {
  try {
    const doc = generateFinalServiceAgreementPDF(data);
    const blob = doc.output("blob");
    const filename = `Final-Service-Agreement-${data.contractNumber}-v${data.agreementVersion}.pdf`;
    safePDFDownload(blob, filename);
  } catch (error) {
    console.error("Error generating Final Service Agreement PDF:", error);
    throw new Error("Failed to generate Final Service Agreement");
  }
}

export function viewOrderConfirmationPDF(data: OrderDocumentData): void {
  try {
    const doc = generateOrderConfirmationPDF(data);
    const blob = doc.output("blob");
    safePDFOpen(blob, `Order-Confirmation-${data.orderConfirmationNumber}.pdf`);
  } catch (error) {
    console.error("Error viewing PDF:", error);
    throw new Error("Failed to open Order Confirmation Agreement");
  }
}

export function viewFinalServiceAgreementPDF(data: OrderDocumentData): void {
  try {
    const doc = generateFinalServiceAgreementPDF(data);
    const blob = doc.output("blob");
    safePDFOpen(blob, `Final-Service-Agreement-${data.contractNumber}.pdf`);
  } catch (error) {
    console.error("Error viewing PDF:", error);
    throw new Error("Failed to open Final Service Agreement");
  }
}

export function getOrderConfirmationBlob(data: OrderDocumentData): Blob {
  const doc = generateOrderConfirmationPDF(data);
  return doc.output("blob");
}

export function getFinalServiceAgreementBlob(data: OrderDocumentData): Blob {
  const doc = generateFinalServiceAgreementPDF(data);
  return doc.output("blob");
}
