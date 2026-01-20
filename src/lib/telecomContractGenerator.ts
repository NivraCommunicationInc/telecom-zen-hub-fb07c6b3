import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BUSINESS_INFO,
  CONTRACT_TERMS,
  ACCESS_PERMISSIONS,
  CLIENT_ACKNOWLEDGEMENT,
  PRIVACY_ACCESS_TERMS,
  PREPAID_BILLING_SUMMARY,
  LATE_PAYMENT_POLICY,
  REGULATORY_NOTICES,
  WARRANTY_POLICY,
  CANCELLATION_POLICY,
} from "./contractPolicies";
import { ACTIVE_CONTRACT_TEMPLATE, getContractEngineFooterLine } from "./contractTemplate";

export interface ServiceItem {
  type: string;
  planName: string;
  inclusions?: string;
  termMonths?: number;
  monthlyPrice: number;
}

export interface CreditItem {
  description: string;
  startDate?: string;
  endDate?: string;
  amount: number;
}

export interface EquipmentItem {
  name: string;
  quantity: number;
  serialOrId?: string;
  warrantyTerm?: string;
  priceType: string; // "One-Time" | "Monthly"
  amount: number;
}

export interface OneTimeFeeItem {
  type: string;
  description: string;
  amount: number;
}

export interface TelecomContractData {
  // Template metadata (for versioning + anti-cache proof)
  contractId?: string;
  templateId?: string;
  templateVersion?: string;

  // A) Agreement Identification
  contractNumber: string;
  orderReference?: string;
  accountKey?: string;
  contractVersion?: string;
  issueDate?: string;
  effectiveDate?: string;
  orderChannel?: string; // "Client Portal" | "Admin Assisted"
  contractStatus?: string; // "Pending" | "Active" | "Cancelled"
  
  // B) Customer Information
  clientName: string;
  clientFirstName: string;
  clientLastName: string;
  clientType?: string; // "Individual" | "Business"
  billingAddress?: string;
  serviceAddress?: string;
  serviceCity?: string;
  serviceProvince?: string;
  servicePostalCode?: string;
  clientEmail: string;
  clientPhone?: string;
  authorizedUser?: string;
  
  // C) Services Subscribed
  services?: ServiceItem[];
  credits?: CreditItem[];
  
  // Legacy service fields for backwards compatibility
  internetPlan?: string;
  tvBundle?: string;
  mobilePlan?: string;
  securityPlan?: string;
  streamingPlan?: string;
  accessories?: string;
  servicePlan: string;
  bundleName?: string;
  category?: string;
  
  // D) Equipment & Device Financing
  equipment?: EquipmentItem[];
  deviceFinancing?: {
    deviceName?: string;
    financeTermMonths?: number;
    monthlyPayment?: number;
    gst?: number;
    qst?: number;
  };
  
  // Legacy equipment fields
  routerSerial?: string;
  terminalSerial?: string;
  terminalCount?: number;
  simSerial?: string;
  simType?: string;
  imeiNumber?: string;
  warrantyStatus?: string;
  
  // E) One-Time Fees, Delivery & Installation
  oneTimeFees?: OneTimeFeeItem[];
  deliveryMethod?: string;
  deliveryFee?: number;
  trackingNumber?: string;
  fulfillmentTimeline?: string;
  installationSelected?: boolean;
  installationFee?: number;
  technicianETA?: string;
  
  // Legacy fee fields
  simFee?: number;
  routerFee?: number;
  terminalFee?: number;
  uberExpressFee?: number;
  activationFee?: number;
  equipmentFee?: number;
  
  // F) Billing Summary
  mrc?: number; // Monthly Recurring Charges
  otc?: number; // One-Time Charges
  subtotal: number;
  tpsAmount: number;
  tvqAmount: number;
  totalDueToday?: number;
  totalAmount: number;
  estimatedNextMonthTotal?: number;
  billingCycleStart?: string;
  billingCycleEnd?: string;
  invoiceNumber?: string;
  discountAmount?: number;
  lateFee?: number;
  
  // G) Payment Terms
  paymentStatus?: string; // "Unpaid" | "Pre-Authorized" | "Paid"
  paymentDueDate?: string;
  paymentReference?: string;
  
  // H) Security Deposit
  depositAmount?: number;
  depositReason?: string;
  
  // Status & Signatures
  isSigned: boolean;
  signedAt?: string;
  signTime?: string;
  signatureMethod?: string; // "Electronic" | "Manual"
  
  // Provider Representatives
  providerRepName?: string;
  providerRepSignature?: string;
  
  // Legacy processor fields
  employeeName?: string;
  employeeRole?: string;
  employeeEmail?: string;
  adminName?: string;
  adminEmail?: string;
  technicianName?: string;
  technicianEmail?: string;
  
  // Legacy fields
  orderNumber?: string;
  orderDate: string;
  clientDOB?: string;
  clientAccountNumber?: string;
  idType?: string;
  idNumber?: string;
  idProvince?: string;
  idExpiration?: string;
  internalStatus?: string;
}

export const generateTelecomContractPDF = (data: TelecomContractData): jsPDF => {
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
  
  const addPageHeader = () => {
    if (pageNumber > 1) {
      doc.setFillColor(...accentTeal);
      doc.rect(0, 0, pageWidth, 2, "F");
      
      doc.setFillColor(...primaryNavy);
      doc.rect(0, 2, pageWidth, 10, "F");
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      doc.text("NIVRA COMMUNICATIONS INC. — Telecommunications Service Agreement", marginLeft, 9);
      
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(`Contract: ${data.contractNumber}`, pageWidth - marginRight, 9, { align: "right" });
      
      currentY = 18;
    }
  };
  
  const addFooter = () => {
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 18, pageWidth - marginRight, pageHeight - 18);

    const engineLine = getContractEngineFooterLine({
      contractId: data.contractId || data.contractNumber,
      templateVersion: data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version,
    });

    doc.setFontSize(5);
    doc.setTextColor(...textMuted);
    doc.text(
      `${BUSINESS_INFO.legalName} — Head Office: ${BUSINESS_INFO.address} — Service Territory: ${BUSINESS_INFO.serviceTerritory}`,
      pageWidth / 2,
      pageHeight - 13,
      { align: "center" }
    );

    doc.text(engineLine, pageWidth / 2, pageHeight - 9, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.text(`Page ${pageNumber}`, pageWidth - marginRight, pageHeight - 8, { align: "right" });
  };
  
  const addSectionDivider = (letter: string, title: string) => {
    checkPageBreak(12);
    currentY += 4;
    
    // Divider line
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 4;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryNavy);
    doc.text(`${letter}) ${title.toUpperCase()}`, marginLeft, currentY);
    
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
    
    // Pad label to fixed width
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
  
  // Subtitle - Updated to Prepaid Agreement
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...accentTeal);
  doc.text("Prepaid Telecommunications Service Agreement — Client Copy", pageWidth / 2, 23, { align: "center" });
  
  currentY = 36;
  
  // Head Office info box
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, currentY, contentWidth, 18, 1, 1, "FD");
  
  doc.setFontSize(6);
  doc.setTextColor(...textDark);
  doc.text(`Head Office: 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5`, marginLeft + 3, currentY + 5);
  doc.text(`Support: ${BUSINESS_INFO.email} | ${BUSINESS_INFO.phone}`, marginLeft + 3, currentY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(`Service Territory: ${BUSINESS_INFO.serviceTerritory}`, marginLeft + 3, currentY + 15);
  
  currentY += 24;
  
  // ========== A) AGREEMENT IDENTIFICATION ==========
  addSectionDivider("A", "Agreement Identification (System-Generated)");
  
  const contractNum = data.contractNumber || `CTR-QC-${data.orderReference || data.orderNumber || "N/A"}`;
  addLabelValue("Contract Number", contractNum);
  addLabelValue("Order Reference Number", data.orderReference || data.orderNumber || "—");
  addLabelValue("Account Key (internal)", data.accountKey || data.clientAccountNumber || "—");
  addLabelValue("Agreement Version", data.contractVersion || CONTRACT_TERMS.version);
  addLabelValue("Issue Date", data.issueDate || format(new Date(data.orderDate), "d MMMM yyyy", { locale: fr }));
  addLabelValue("Agreement Effective Date", data.effectiveDate || format(new Date(data.orderDate), "d MMMM yyyy", { locale: fr }));
  addLabelValue("Order Channel", data.orderChannel || "Client Portal");
  addLabelValue("Status", data.contractStatus || data.internalStatus || "Pending");
  
  // ========== B) CUSTOMER INFORMATION ==========
  addSectionDivider("B", "Customer Information (From Checkout)");
  
  addLabelValue("Account Holder / Legal Name", data.clientName || `${data.clientFirstName} ${data.clientLastName}`);
  addLabelValue("Client Type", data.clientType || "Individual");
  addLabelValue("Billing Address", data.billingAddress || data.serviceAddress || "—");
  
  const fullServiceAddr = [data.serviceAddress, data.serviceCity, data.serviceProvince || "QC", data.servicePostalCode]
    .filter(Boolean)
    .join(", ");
  addLabelValue("Service Address", fullServiceAddr || "—");
  addLabelValue("Email", data.clientEmail);
  addLabelValue("Phone", data.clientPhone || "—");
  addLabelValue("Authorized User (if any)", data.authorizedUser || "—");
  
  addFooter();
  
  // ========== PAGE 2: SERVICES SUBSCRIBED ==========
  addNewPage();
  
  addSectionDivider("C", "Services Subscribed (From Checkout) — \"What You Bought\"");
  
  addParagraph("This section is system-generated from checkout selections. No plan name, pricing, or features are inserted manually outside client-selected placeholders.");
  
  addSubHeader("C.1 Subscribed Services & Monthly Charges (MRC)");
  
  // Build service rows
  const serviceColWidths = [30, 40, 50, 25, 30];
  addTableRow(["SERVICE TYPE", "PLAN NAME", "INCLUDED FEATURES", "TERM", "MONTHLY (CAD)"], serviceColWidths, true);
  
  if (data.services && data.services.length > 0) {
    data.services.forEach(svc => {
      addTableRow([
        svc.type,
        svc.planName,
        svc.inclusions || "—",
        svc.termMonths ? `${svc.termMonths} months` : "—",
        `$${svc.monthlyPrice.toFixed(2)}`
      ], serviceColWidths);
    });
  } else {
    // Legacy fallback
    const legacyServices: [string, string][] = [];
    if (data.internetPlan || data.servicePlan) legacyServices.push(["Internet", data.internetPlan || data.servicePlan]);
    if (data.tvBundle || data.bundleName) legacyServices.push(["TV + Internet", data.tvBundle || data.bundleName || "—"]);
    if (data.mobilePlan) legacyServices.push(["Mobile", data.mobilePlan]);
    if (data.streamingPlan) legacyServices.push(["Streaming", data.streamingPlan]);
    if (data.accessories) legacyServices.push(["Accessories", data.accessories]);
    
    if (legacyServices.length === 0) {
      legacyServices.push([data.category || "Service", data.servicePlan]);
    }
    
    legacyServices.forEach(([type, plan]) => {
      addTableRow([type, plan, "—", "—", "—"], serviceColWidths);
    });
  }
  
  currentY += 4;
  
  addSubHeader("C.2 Promotions / Credits (if applicable)");
  
  const creditColWidths = [60, 35, 35, 40];
  addTableRow(["DESCRIPTION", "START", "END", "MONTHLY CREDIT"], creditColWidths, true);
  
  if (data.credits && data.credits.length > 0) {
    data.credits.forEach(credit => {
      addTableRow([
        credit.description,
        credit.startDate || "—",
        credit.endDate || "—",
        `-$${credit.amount.toFixed(2)}`
      ], creditColWidths);
    });
  } else if (data.discountAmount && data.discountAmount > 0) {
    addTableRow(["Promotional Discount", "—", "—", `-$${data.discountAmount.toFixed(2)}`], creditColWidths);
  } else {
    addTableRow(["No promotions applied", "—", "—", "—"], creditColWidths);
  }
  
  currentY += 4;
  
  addSubHeader("C.3 Pay-Per-Use / Usage-Based Charges (if applicable)");
  addParagraph("Rates may apply for roaming, overages, add-ons, and pay-per-use services where selected or triggered by usage. Usage charges appear on invoices for the applicable billing cycle.");
  
  addFooter();
  
  // ========== PAGE 3: EQUIPMENT & DEVICE FINANCING ==========
  addNewPage();
  
  addSectionDivider("D", "Equipment & Device Financing (From Checkout)");
  
  addSubHeader("D.1 Equipment Bound to Services (One-Time or Monthly)");
  
  const equipColWidths = [45, 15, 35, 25, 25, 30];
  addTableRow(["ITEM", "QTY", "SERIAL/ID", "WARRANTY", "PRICE TYPE", "AMOUNT (CAD)"], equipColWidths, true);
  
  if (data.equipment && data.equipment.length > 0) {
    data.equipment.forEach(eq => {
      addTableRow([
        eq.name,
        String(eq.quantity),
        eq.serialOrId || "—",
        eq.warrantyTerm || "1 Year",
        eq.priceType,
        `$${eq.amount.toFixed(2)}`
      ], equipColWidths);
    });
  } else {
    // Legacy equipment
    if (data.routerSerial) {
      addTableRow(["Nivra Born WiFi Router", "1", data.routerSerial, "1 Year", "One-Time", data.routerFee ? `$${data.routerFee.toFixed(2)}` : "—"], equipColWidths);
    }
    if (data.terminalSerial) {
      addTableRow(["Nivra 4K Smart Terminal", String(data.terminalCount || 1), data.terminalSerial, "1 Year", "One-Time", data.terminalFee ? `$${data.terminalFee.toFixed(2)}` : "—"], equipColWidths);
    }
    if (data.simSerial || data.simType) {
      addTableRow([`SIM (${data.simType || "Physical"})`, "1", data.simSerial || "At activation", "N/A", "One-Time", data.simFee ? `$${data.simFee.toFixed(2)}` : "—"], equipColWidths);
    }
    if (!data.routerSerial && !data.terminalSerial && !data.simSerial && !data.simType) {
      addTableRow(["No equipment", "—", "—", "—", "—", "—"], equipColWidths);
    }
  }
  
  currentY += 4;
  
  addSubHeader("D.2 Device Financing (if selected)");
  
  if (data.deviceFinancing && data.deviceFinancing.deviceName) {
    addLabelValue("Device", data.deviceFinancing.deviceName);
    addLabelValue("Financing Term", `${data.deviceFinancing.financeTermMonths || 24} months`);
    addLabelValue("Monthly Device Payment", data.deviceFinancing.monthlyPayment ? `$${data.deviceFinancing.monthlyPayment.toFixed(2)}` : "—");
    addLabelValue("Applicable Taxes on Financing", `GST $${(data.deviceFinancing.gst || 0).toFixed(2)} | QST $${(data.deviceFinancing.qst || 0).toFixed(2)}`);
  } else {
    addParagraph("No device financing selected.");
  }
  
  currentY += 2;
  addParagraph("Warranty is manufacturer-based for 12 months from activation; exclusions include client damage, loss/theft, liquid damage, physical impact.");
  
  addFooter();
  
  // ========== PAGE 4: ONE-TIME FEES, DELIVERY & INSTALLATION ==========
  addNewPage();
  
  addSectionDivider("E", "One-Time Fees, Delivery & Installation (From Checkout)");
  
  addSubHeader("E.1 One-Time Fees (OTC)");
  
  const feeColWidths = [50, 70, 55];
  addTableRow(["FEE TYPE", "DESCRIPTION", "AMOUNT (CAD)"], feeColWidths, true);
  
  if (data.oneTimeFees && data.oneTimeFees.length > 0) {
    data.oneTimeFees.forEach(fee => {
      addTableRow([fee.type, fee.description, `$${fee.amount.toFixed(2)}`], feeColWidths);
    });
  } else {
    // Legacy fees
    if (data.activationFee && data.activationFee > 0) addTableRow(["Activation", "Service activation fee", `$${data.activationFee.toFixed(2)}`], feeColWidths);
    if (data.simFee && data.simFee > 0) addTableRow(["SIM Fee", data.simType === "eSIM" ? "eSIM activation" : "Physical SIM card", `$${data.simFee.toFixed(2)}`], feeColWidths);
    if (data.routerFee && data.routerFee > 0) addTableRow(["Router", "Nivra Born WiFi Router", `$${data.routerFee.toFixed(2)}`], feeColWidths);
    if (data.terminalFee && data.terminalFee > 0) addTableRow(["TV Terminal", `Nivra 4K Smart Terminal (×${data.terminalCount || 1})`, `$${data.terminalFee.toFixed(2)}`], feeColWidths);
    if (data.equipmentFee && data.equipmentFee > 0) addTableRow(["Equipment", "Equipment fee", `$${data.equipmentFee.toFixed(2)}`], feeColWidths);
  }
  
  currentY += 4;
  
  addSubHeader("E.2 Delivery / Fulfillment");
  addLabelValue("Delivery Method", data.deliveryMethod || "Standard Québec Delivery");
  addLabelValue("Delivery Fee", data.deliveryFee ? `$${data.deliveryFee.toFixed(2)}` : "—");
  addLabelValue("Tracking Number", data.trackingNumber || "(assigned upon shipment)");
  addLabelValue("Fulfillment Timeline", data.fulfillmentTimeline || CONTRACT_TERMS.delivery.standardDays);
  
  currentY += 2;
  
  addSubHeader("E.3 Installation (if selected)");
  addLabelValue("Installation Selected", data.installationSelected ? "Yes" : "No");
  addLabelValue("Installation Fee", data.installationFee ? `$${data.installationFee.toFixed(2)}` : "—");
  addLabelValue("Technician ETA", data.technicianETA || "—");
  
  addFooter();
  
  // ========== PAGE 5: BILLING SUMMARY & PAYMENT TERMS ==========
  addNewPage();
  
  addSectionDivider("F", "Billing Summary (System-Calculated)");
  
  const mrc = data.mrc || data.subtotal || 0;
  const otc = data.otc || ((data.deliveryFee || 0) + (data.activationFee || 0) + (data.installationFee || 0));
  const subtotalBeforeTax = data.subtotal || (mrc + otc);
  const totalDue = data.totalDueToday || data.totalAmount;
  const nextMonth = data.estimatedNextMonthTotal || mrc;
  
  addLabelValue("Monthly Recurring Charges (MRC)", `$${mrc.toFixed(2)}`);
  addLabelValue("One-Time Charges (OTC)", `$${otc.toFixed(2)}`);
  addLabelValue("Subtotal Before Taxes", `$${subtotalBeforeTax.toFixed(2)}`);
  addLabelValue("GST (5%)", `$${data.tpsAmount.toFixed(2)}`);
  addLabelValue("QST (9.975%)", `$${data.tvqAmount.toFixed(2)}`);
  
  currentY += 2;
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(marginLeft, currentY - 2, contentWidth, 8, 1, 1, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("TOTAL DUE TODAY:", marginLeft + 5, currentY + 3);
  doc.text(`$${totalDue.toFixed(2)} CAD`, pageWidth - marginRight - 5, currentY + 3, { align: "right" });
  currentY += 12;
  
  addLabelValue("Next Estimated Monthly Total", `$${nextMonth.toFixed(2)}`);
  addLabelValue("Billing Cycle", data.billingCycleStart && data.billingCycleEnd ? `${data.billingCycleStart} to ${data.billingCycleEnd}` : "Monthly");
  addLabelValue("Invoice Number (when issued)", data.invoiceNumber || "(to be assigned)");
  
  // ========== G) PAYMENT TERMS ==========
  addSectionDivider("G", "Payment Terms");
  
  addParagraph("Accepted payment methods include Credit Card (processed internally) and Secure E-Transfer.");
  addParagraph("Payment must be completed before an order requiring equipment fees, delivery charges, or first-month service can be confirmed or processed.");
  
  currentY += 2;
  addLabelValue("Payment Status", data.paymentStatus || "Unpaid");
  addLabelValue("Payment Due Date", data.paymentDueDate || "Upon order confirmation");
  addLabelValue("Payment Reference (if applicable)", data.paymentReference || "—");
  
  // ========== H) SECURITY DEPOSIT ==========
  addSectionDivider("H", "Security Deposit (If Applicable)");
  
  addLabelValue("Deposit Required Today", data.depositAmount ? `$${data.depositAmount.toFixed(2)}` : "$0.00");
  addLabelValue("Deposit Reason", data.depositReason || "N/A");
  addParagraph("Deposits may be applied to overdue amounts where permitted and returned according to deposit rules shown in the client portal.");
  
  addFooter();
  
  // ========== PAGE 6: POLICIES ==========
  addNewPage();
  
  // ========== I) PREPAID BILLING & LATE PAYMENT ==========
  addSectionDivider("I", "Prepaid Billing & Late Payment");

  // Fixed fee schedule (must always appear for audits / regressions)
  addParagraph(
    `Standard fees (CAD): Activation $${CONTRACT_TERMS.fees.activationSingle.toFixed(2)} (1 service) / $${CONTRACT_TERMS.fees.activationMultiple.toFixed(2)} (2+ services), Delivery $${CONTRACT_TERMS.fees.delivery.toFixed(2)}, Nivra 4K Terminal $${CONTRACT_TERMS.fees.tvTerminal.toFixed(2)}, Nivra Born WiFi Router $${CONTRACT_TERMS.fees.router.toFixed(2)}. Reactivation fee $${CONTRACT_TERMS.disputeChargeback.reactivationFee.toFixed(2)} applies ONLY for bank disputes/chargebacks.`
  );
  addParagraph(`Règle: Le forfait TV nécessite un forfait Internet actif.`);

  addParagraph(PREPAID_BILLING_SUMMARY.en);
  currentY += 4;
  addParagraph(LATE_PAYMENT_POLICY.en);

  // ========== J) CANCELLATION / TERMINATION ==========
  addSectionDivider("J", "Cancellation (No Financing)");
  
  addParagraph(CANCELLATION_POLICY.en);
  
  // ========== K) WARRANTY ==========
  addSectionDivider("K", "Equipment Warranty (Limited)");
  
  addParagraph(WARRANTY_POLICY.en);
  
  // ========== L) PRIVACY & DATA PROTECTION ==========
  addSectionDivider("L", "Privacy & Data Protection");
  
  addParagraph(CONTRACT_TERMS.dataProtection);
  
  // ========== M) REGULATORY NOTICES ==========
  addSectionDivider("M", "Regulatory Notices (CRTC / CCTS)");
  
  addParagraph(REGULATORY_NOTICES.en);
  
  // ========== N) LIMITATION OF LIABILITY ==========
  addSectionDivider("N", "Limitation of Liability");
  
  addParagraph(CONTRACT_TERMS.liability);
  
  addFooter();
  
  // ========== PAGE 7: JURISDICTION & SIGNATURES ==========
  addNewPage();
  
  // ========== O) GOVERNING LAW & JURISDICTION ==========
  addSectionDivider("O", "Governing Law & Jurisdiction");
  
  addParagraph(CONTRACT_TERMS.jurisdiction);
  
  // ========== P) ELECTRONIC SIGNATURE & ACCEPTANCE ==========
  addSectionDivider("P", "Electronic Signature & Acceptance");
  
  addParagraph("By signing electronically, Client confirms:");
  
  // Client acknowledgement list
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  CLIENT_ACKNOWLEDGEMENT.forEach((ack, index) => {
    checkPageBreak(5);
    const bullet = `${index + 1}. ${ack}`;
    const lines = doc.splitTextToSize(bullet, contentWidth - 10);
    doc.text(lines, marginLeft + 5, currentY);
    currentY += lines.length * 3.5;
  });
  
  currentY += 6;
  
  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 45;
  
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
  doc.text(`Client Name: ${data.clientName || `${data.clientFirstName} ${data.clientLastName}`}`, marginLeft + 8, currentY + 16);
  doc.text(`Client Signature: ____________________`, marginLeft + 8, currentY + 24);
  
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
  doc.text(`Provider Rep: ${data.providerRepName || data.employeeName || data.adminName || "____________________"}`, provSigX + 5, currentY + 16);
  doc.text(`Provider Signature: ____________________`, provSigX + 5, currentY + 24);
  
  currentY += sigBoxHeight + 8;
  
  // Signature details
  const signDate = data.signedAt ? format(new Date(data.signedAt), "d MMMM yyyy", { locale: fr }) : "____________________";
  const signTime = data.signTime || (data.signedAt ? format(new Date(data.signedAt), "HH:mm") : "____:____");
  
  addLabelValue("Signed On", `${signDate} at ${signTime}`);
  addLabelValue("Execution Method", data.signatureMethod || "Electronic");
  
  currentY += 8;
  
  // Status banner
  if (data.isSigned && data.signedAt) {
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
    doc.text(format(new Date(data.signedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr }), pageWidth / 2, currentY + 12, { align: "center" });
  } else {
    doc.setFillColor(254, 249, 195);
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1.5);
    doc.roundedRect(marginLeft, currentY, contentWidth, 12, 3, 3, "FD");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(161, 98, 7);
    doc.text("⏳ AWAITING CLIENT SIGNATURE", pageWidth / 2, currentY + 8, { align: "center" });
  }
  
  currentY += 20;
  
  // End of Agreement
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("— END OF AGREEMENT —", pageWidth / 2, currentY, { align: "center" });
  
  addFooter();
  
  return doc;
};

import { safePDFDownload, safePDFOpen } from "./pdfUtils";

export const downloadTelecomContractPDF = (data: TelecomContractData): void => {
  try {
    const doc = generateTelecomContractPDF(data);
    const blob = doc.output("blob");
    const version = data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version;
    const idPart = data.contractId || data.contractNumber;
    const filename = `TSA-${idPart}-${version}.pdf`;
    safePDFDownload(blob, filename);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate contract PDF");
  }
};

export const viewTelecomContractPDF = (data: TelecomContractData): void => {
  try {
    const doc = generateTelecomContractPDF(data);
    const blob = doc.output("blob");
    const version = data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version;
    const idPart = data.contractId || data.contractNumber;
    const filename = `TSA-${idPart}-${version}.pdf`;
    safePDFOpen(blob, filename);
  } catch (error) {
    console.error("Error viewing PDF:", error);
    throw new Error("Failed to open contract PDF");
  }
};

export const getTelecomContractBlob = (data: TelecomContractData): Blob => {
  try {
    const doc = generateTelecomContractPDF(data);
    return doc.output("blob");
  } catch (error) {
    console.error("Error creating PDF blob:", error);
    throw new Error("Failed to create contract PDF");
  }
};
