import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BUSINESS_INFO,
  CONTRACT_TERMS,
  ACCESS_PERMISSIONS,
  CLIENT_ACKNOWLEDGEMENT,
  PRIVACY_ACCESS_TERMS,
} from "./contractPolicies";

export interface TelecomContractData {
  contractNumber: string;
  orderReference?: string;
  paymentReference?: string;
  
  // Client Info
  clientFirstName: string;
  clientLastName: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientDOB?: string;
  clientAccountNumber?: string;
  
  // Service Address
  serviceAddress?: string;
  serviceCity?: string;
  serviceProvince?: string;
  servicePostalCode?: string;
  
  // Identity Validation
  idType?: string;
  idNumber?: string;
  idProvince?: string;
  idExpiration?: string;
  
  // Order Info
  orderNumber?: string;
  orderDate: string;
  
  // Services Subscribed (dynamic bindings)
  internetPlan?: string;
  tvBundle?: string;
  mobilePlan?: string;
  securityPlan?: string;
  streamingPlan?: string;
  accessories?: string;
  servicePlan: string;
  bundleName?: string;
  category?: string;
  
  // Equipment Assigned
  routerSerial?: string;
  terminalSerial?: string;
  terminalCount?: number;
  simSerial?: string;
  simType?: string;
  imeiNumber?: string;
  warrantyStatus?: string;
  
  // Tracking & Delivery
  deliveryMethod?: string;
  trackingNumber?: string;
  
  // Pricing
  subtotal: number;
  simFee?: number;
  routerFee?: number;
  terminalFee?: number;
  deliveryFee?: number;
  uberExpressFee?: number;
  installationFee?: number;
  activationFee?: number;
  equipmentFee?: number;
  discountAmount?: number;
  tpsAmount: number;
  tvqAmount: number;
  totalAmount: number;
  lateFee?: number;
  
  // Status
  internalStatus?: string;
  isSigned: boolean;
  signedAt?: string;
  
  // Employee who processed
  employeeName?: string;
  employeeRole?: string;
  employeeEmail?: string;
  
  // Additional processors
  adminName?: string;
  adminEmail?: string;
  technicianName?: string;
  technicianEmail?: string;
}

export const generateTelecomContractPDF = (data: TelecomContractData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 20;
  let pageNumber = 1;
  
  // Premium color palette
  const primaryNavy: [number, number, number] = [15, 23, 42];
  const accentTeal: [number, number, number] = [20, 184, 166];
  const textDark: [number, number, number] = [30, 41, 59];
  const textMuted: [number, number, number] = [100, 116, 139];
  const borderLight: [number, number, number] = [203, 213, 225];
  const bgLight: [number, number, number] = [248, 250, 252];
  const white: [number, number, number] = [255, 255, 255];
  
  // ========== HELPER FUNCTIONS ==========
  
  const addNewPage = () => {
    addLegalFooter();
    doc.addPage();
    pageNumber++;
    currentY = 25;
    addPageHeader();
  };
  
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 30) {
      addNewPage();
    }
  };
  
  const addPageHeader = () => {
    if (pageNumber > 1) {
      // Top accent line
      doc.setFillColor(...accentTeal);
      doc.rect(0, 0, pageWidth, 2, "F");
      
      // Header bar
      doc.setFillColor(...primaryNavy);
      doc.rect(0, 2, pageWidth, 12, "F");
      
      // Company name
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      doc.text("NIVRA COMMUNICATIONS INC.", marginLeft, 10);
      
      // Contract reference
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`CSA ${data.contractNumber}`, pageWidth - marginRight, 10, { align: "right" });
      
      currentY = 22;
    }
  };
  
  const addLegalFooter = () => {
    // Legal divider line
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, pageHeight - 22, pageWidth - marginRight, pageHeight - 22);
    
    // Footer content
    doc.setFontSize(6);
    doc.setTextColor(...textMuted);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${BUSINESS_INFO.legalName} — ${BUSINESS_INFO.address}`,
      pageWidth / 2,
      pageHeight - 16,
      { align: "center" }
    );
    doc.text(
      `Telecommunications & Digital Services Provider — ${BUSINESS_INFO.serviceTerritory}`,
      pageWidth / 2,
      pageHeight - 12,
      { align: "center" }
    );
    
    // Page number
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${pageNumber}`, pageWidth - marginRight, pageHeight - 8, { align: "right" });
    
    // Initials boxes
    doc.setDrawColor(...textMuted);
    doc.setLineWidth(0.3);
    doc.rect(marginLeft, pageHeight - 18, 12, 6);
    doc.rect(marginLeft + 16, pageHeight - 18, 12, 6);
    doc.setFontSize(5);
    doc.text("CL", marginLeft + 6, pageHeight - 14, { align: "center" });
    doc.text("NV", marginLeft + 22, pageHeight - 14, { align: "center" });
  };
  
  const addSectionHeader = (number: number, title: string) => {
    checkPageBreak(18);
    currentY += 6;
    
    // Section number box
    doc.setFillColor(...primaryNavy);
    doc.roundedRect(marginLeft, currentY - 5, 8, 8, 1, 1, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(String(number), marginLeft + 4, currentY, { align: "center" });
    
    // Section title
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryNavy);
    doc.text(title.toUpperCase(), marginLeft + 12, currentY);
    
    // Underline
    doc.setDrawColor(...accentTeal);
    doc.setLineWidth(0.8);
    doc.line(marginLeft + 12, currentY + 2, pageWidth - marginRight, currentY + 2);
    
    currentY += 10;
  };
  
  const addParagraph = (text: string, indent: number = 0, fontSize: number = 8) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);
    
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    checkPageBreak(lines.length * 4 + 2);
    doc.text(lines, marginLeft + indent, currentY, { align: "justify" });
    currentY += lines.length * 4 + 3;
  };
  
  const addBulletPoint = (text: string, indent: number = 5) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);
    
    const bulletX = marginLeft + indent;
    doc.text("•", bulletX, currentY);
    
    const textX = bulletX + 5;
    const maxWidth = contentWidth - indent - 5;
    const lines = doc.splitTextToSize(text, maxWidth);
    
    checkPageBreak(lines.length * 4 + 2);
    doc.text(lines, textX, currentY);
    currentY += lines.length * 4 + 2;
  };
  
  const addTable = (headers: string[], rows: string[][], columnWidths: number[]) => {
    const rowHeight = 7;
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
    
    checkPageBreak((rows.length + 1) * rowHeight + 5);
    
    // Header row
    doc.setFillColor(...primaryNavy);
    doc.rect(marginLeft, currentY, tableWidth, rowHeight, "F");
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    
    let xPos = marginLeft + 2;
    headers.forEach((header, i) => {
      doc.text(header.toUpperCase(), xPos, currentY + 5);
      xPos += columnWidths[i];
    });
    
    currentY += rowHeight;
    
    // Data rows
    rows.forEach((row, rowIndex) => {
      const bgColor = rowIndex % 2 === 0 ? bgLight : white;
      doc.setFillColor(...bgColor);
      doc.rect(marginLeft, currentY, tableWidth, rowHeight, "F");
      
      // Border
      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.2);
      doc.rect(marginLeft, currentY, tableWidth, rowHeight, "S");
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textDark);
      
      xPos = marginLeft + 2;
      row.forEach((cell, i) => {
        doc.text(cell, xPos, currentY + 5);
        xPos += columnWidths[i];
      });
      
      currentY += rowHeight;
    });
    
    currentY += 4;
  };
  
  const addKeyValue = (key: string, value: string, indent: number = 0) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textMuted);
    doc.text(key + ":", marginLeft + indent, currentY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);
    doc.text(value || "—", marginLeft + indent + 45, currentY);
    currentY += 5;
  };
  
  // ========== PAGE 1: COVER & HEAD OFFICE ==========
  
  // Premium header band
  doc.setFillColor(...accentTeal);
  doc.rect(0, 0, pageWidth, 3, "F");
  
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 3, pageWidth, 40, "F");
  
  // Company name - bold uppercase
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("NIVRA COMMUNICATIONS INC.", pageWidth / 2, 22, { align: "center" });
  
  // Subtitle
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...accentTeal);
  doc.text("CUSTOMER SERVICE AGREEMENT (CSA)", pageWidth / 2, 32, { align: "center" });
  
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(`Telecommunications & Digital Services Provider — ${BUSINESS_INFO.serviceTerritory}`, pageWidth / 2, 40, { align: "center" });
  
  currentY = 52;
  
  // HEAD OFFICE section
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, currentY, contentWidth, 32, 2, 2, "FD");
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("HEAD OFFICE", marginLeft + 5, currentY + 8);
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(BUSINESS_INFO.address, marginLeft + 5, currentY + 14);
  doc.text(`Support Email: ${BUSINESS_INFO.email}`, marginLeft + 5, currentY + 20);
  doc.text(`Service Fulfillment & Delivery Centre: ${BUSINESS_INFO.fulfillmentCentre}`, marginLeft + 5, currentY + 26);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Service Territory: ${BUSINESS_INFO.serviceTerritory}`, marginLeft + 100, currentY + 26);
  
  currentY += 40;
  
  // CONTRACT IDENTIFICATION
  addSectionHeader(1, "Contract Identification");
  
  const contractIdRows: string[][] = [
    ["Contract Number", data.contractNumber],
    ["Order Reference", data.orderReference || data.orderNumber || "—"],
    ["Payment Reference", data.paymentReference || "—"],
    ["Agreement Version", CONTRACT_TERMS.version],
    ["Issue Date", format(new Date(data.orderDate), "d MMMM yyyy", { locale: fr })],
    ["Agreement Status", data.internalStatus || "Pending (Admin-editable)"],
  ];
  
  addTable(["Identifier", "Value"], contractIdRows, [55, contentWidth - 55]);
  
  // CLIENT INFORMATION
  addSectionHeader(2, "Client Information");
  
  addKeyValue("Full Name", `${data.clientFirstName} ${data.clientLastName}`);
  addKeyValue("Email", data.clientEmail);
  addKeyValue("Phone", data.clientPhone || "—");
  addKeyValue("Date of Birth", data.clientDOB || "—");
  addKeyValue("Service Address", `${data.serviceAddress || "—"}, Québec, Canada`);
  addKeyValue("Client Account Number", `${data.clientAccountNumber || "—"} (internal ownership key)`);
  
  addLegalFooter();
  
  // ========== PAGE 2: SERVICES & EQUIPMENT BINDING ==========
  addNewPage();
  
  addSectionHeader(3, "Services & Equipment Binding");
  
  addParagraph(CONTRACT_TERMS.servicesBinding, 0, 7);
  
  currentY += 3;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("Services Subscribed (client-chosen placeholders only):", marginLeft, currentY);
  currentY += 6;
  
  const serviceRows: string[][] = [];
  if (data.internetPlan || data.servicePlan) serviceRows.push(["Internet Service", data.internetPlan || data.servicePlan]);
  if (data.tvBundle || data.bundleName) serviceRows.push(["TV + Internet Bundle", data.tvBundle || data.bundleName || "—"]);
  if (data.mobilePlan) serviceRows.push(["Mobile Service", data.mobilePlan]);
  if (data.streamingPlan) serviceRows.push(["Streaming Service", data.streamingPlan]);
  if (data.accessories) serviceRows.push(["Accessories / Extras", data.accessories]);
  
  if (serviceRows.length === 0) {
    serviceRows.push([data.category || "Telecom Service", data.servicePlan]);
  }
  
  addTable(["Service Type", "Plan / Description"], serviceRows, [55, contentWidth - 55]);
  
  // Equipment Linked to Selected Services
  currentY += 3;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("Equipment Linked to Selected Services (placeholders only):", marginLeft, currentY);
  currentY += 6;
  
  if (data.routerSerial) {
    addBulletPoint(`Nivra Born WiFi Router Serial: ${data.routerSerial}`);
    addBulletPoint(`Equipment Fee Placeholder: ${data.routerFee ? `${data.routerFee.toFixed(2)} $` : "—"}`, 10);
    addBulletPoint(`Warranty Placeholder: ${data.warrantyStatus || "1-Year Manufacturer Warranty"}`, 10);
    currentY += 2;
  }
  
  if (data.terminalSerial) {
    const count = data.terminalCount || 1;
    addBulletPoint(`Nivra 4K Smart Terminal Serial(s): ${data.terminalSerial} (×${count})`);
    addBulletPoint(`Terminal Fee Placeholder (max 4): ${data.terminalFee ? `${data.terminalFee.toFixed(2)} $` : "—"}`, 10);
    currentY += 2;
  }
  
  if (data.simSerial || data.simType) {
    addBulletPoint(`SIM Type: ${data.simType || "Physical"}`);
    addBulletPoint(`SIM Serial Number: ${data.simSerial || "Assigned at activation"}`, 10);
    addBulletPoint(`SIM Fee Placeholder: ${data.simFee ? `${data.simFee.toFixed(2)} $` : "—"}`, 10);
    currentY += 2;
  }
  
  // Tracking & Delivery
  currentY += 3;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("Tracking & Delivery (client-selected placeholders only):", marginLeft, currentY);
  currentY += 6;
  
  addBulletPoint(`Delivery Method: ${data.deliveryMethod || "Standard Québec Delivery"}`);
  addBulletPoint(`Delivery Fee: ${data.deliveryFee ? `${data.deliveryFee.toFixed(2)} $` : "—"}`);
  addBulletPoint(`Tracking Number: ${data.trackingNumber || "Assigned upon shipment"}`);
  
  addLegalFooter();
  
  // ========== PAGE 3: FEES & PAYMENT ==========
  addNewPage();
  
  addSectionHeader(4, "Applicable Fees & Conditions");
  
  addParagraph("Fees apply automatically depending on what the client purchased. Plan names are never inserted here.", 0, 7);
  
  const feeRows: string[][] = [];
  feeRows.push(["SIM Physical Fee", `${CONTRACT_TERMS.fees.simPhysical} $`]);
  feeRows.push(["eSIM Fee", `${CONTRACT_TERMS.fees.esim} $`]);
  feeRows.push(["Router Equipment Fee", `${CONTRACT_TERMS.fees.router} $`]);
  feeRows.push(["TV Terminal Fee", `${CONTRACT_TERMS.fees.tvTerminal} $ × number of terminals selected (max 4)`]);
  feeRows.push(["Uber Express Delivery Fee", `${CONTRACT_TERMS.fees.uberExpress} $ (if eligible city & selected)`]);
  feeRows.push(["Technician Installation Fee", "If Internet/TV installation selected"]);
  
  addTable(["Fee Type", "Amount / Condition"], feeRows, [60, contentWidth - 60]);
  
  // Order-specific fees
  currentY += 3;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("Order-Specific Fee Summary:", marginLeft, currentY);
  currentY += 6;
  
  const orderFeeRows: string[][] = [];
  if (data.simFee && data.simFee > 0) {
    orderFeeRows.push([data.simType === "eSIM" ? "eSIM Activation" : "Physical SIM", `${data.simFee.toFixed(2)} $`]);
  }
  if (data.routerFee && data.routerFee > 0) orderFeeRows.push(["Router Fee", `${data.routerFee.toFixed(2)} $`]);
  if (data.terminalFee && data.terminalFee > 0) {
    const count = data.terminalCount || 1;
    orderFeeRows.push([`TV Terminal (×${count})`, `${data.terminalFee.toFixed(2)} $`]);
  }
  if (data.deliveryFee && data.deliveryFee > 0) orderFeeRows.push(["Delivery Fee", `${data.deliveryFee.toFixed(2)} $`]);
  if (data.uberExpressFee && data.uberExpressFee > 0) orderFeeRows.push(["Uber Express Delivery", `${data.uberExpressFee.toFixed(2)} $`]);
  if (data.installationFee && data.installationFee > 0) orderFeeRows.push(["Technician Installation", `${data.installationFee.toFixed(2)} $`]);
  if (data.activationFee && data.activationFee > 0) orderFeeRows.push(["Activation Fee", `${data.activationFee.toFixed(2)} $`]);
  
  orderFeeRows.push(["Subtotal", `${data.subtotal.toFixed(2)} $`]);
  if (data.discountAmount && data.discountAmount > 0) orderFeeRows.push(["Discount Applied", `−${data.discountAmount.toFixed(2)} $`]);
  orderFeeRows.push(["TPS (5%)", `${data.tpsAmount.toFixed(2)} $`]);
  orderFeeRows.push(["TVQ (9.975%)", `${data.tvqAmount.toFixed(2)} $`]);
  
  addTable(["Fee Description", "Amount"], orderFeeRows, [100, 70]);
  
  // Total box
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(marginLeft + 100, currentY - 2, 70, 10, 1, 1, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("TOTAL", marginLeft + 105, currentY + 5);
  doc.text(`${data.totalAmount.toFixed(2)} $ CAD`, marginLeft + 165, currentY + 5, { align: "right" });
  currentY += 14;
  
  addSectionHeader(5, "Payment Terms");
  
  addParagraph(CONTRACT_TERMS.paymentBeforeConfirmation, 0, 7);
  
  currentY += 3;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("Accepted payment modes:", marginLeft, currentY);
  currentY += 6;
  
  CONTRACT_TERMS.paymentTerms.acceptedMethods.forEach(method => {
    addBulletPoint(method);
  });
  
  // E-Transfer box
  currentY += 3;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.8);
  doc.roundedRect(marginLeft, currentY, contentWidth, 18, 2, 2, "FD");
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 130, 0);
  doc.text("SECURE E-TRANSFER PAYMENT CHANNEL", marginLeft + 5, currentY + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(`Email: ${CONTRACT_TERMS.etransfer.email}`, marginLeft + 5, currentY + 12);
  
  currentY += 24;
  
  addParagraph("The system will generate a Payment Reference placeholder once payment is captured by the Admin.", 0, 7);
  addParagraph("Client-caused disputes or fraud flags are not part of the public contract data.", 0, 7);
  
  addLegalFooter();
  
  // ========== PAGE 4: LATE PAYMENT & CANCELLATION ==========
  addNewPage();
  
  addSectionHeader(6, "Late Payment Policy");
  
  addParagraph("Unpaid balances may incur a late fee.", 0, 7);
  addBulletPoint(`Late Fee Placeholder: ${CONTRACT_TERMS.paymentTerms.lateInterestRate}% monthly on unpaid balance`);
  addBulletPoint("Admin override is permitted and logged internally.");
  
  addSectionHeader(7, "Cancellation & Equipment Terms");
  
  addBulletPoint(CONTRACT_TERMS.cancellation.afterDeliveryCharge);
  addBulletPoint("Equipment return fees are at client cost unless defective under warranty.");
  
  currentY += 3;
  addParagraph("If an order is Cancelled at any stage:", 0, 7);
  addBulletPoint(CONTRACT_TERMS.cancellation.equipmentRemoval, 10);
  addBulletPoint(CONTRACT_TERMS.cancellation.recordPersistence, 10);
  
  addSectionHeader(8, "Warranty Terms");
  
  addParagraph("Warranty is manufacturer-based only and tracked via placeholder.", 0, 7);
  addBulletPoint(`${CONTRACT_TERMS.warranty.duration} manufacturer warranty`);
  addBulletPoint(`Coverage: ${CONTRACT_TERMS.warranty.coverage}`);
  addBulletPoint(`Exclusions: ${CONTRACT_TERMS.warranty.exclusions.join(", ")}`);
  
  addLegalFooter();
  
  // ========== PAGE 5: PRIVACY & ACCESS ==========
  addNewPage();
  
  addSectionHeader(9, "Privacy, Access & Activity Logs");
  
  addBulletPoint(PRIVACY_ACCESS_TERMS.fullPayment);
  addBulletPoint(PRIVACY_ACCESS_TERMS.adminCardAccess);
  addBulletPoint(`${PRIVACY_ACCESS_TERMS.staffCardAccess}: {{Client.Card.Last4Digits}}`);
  addBulletPoint(PRIVACY_ACCESS_TERMS.activityLogs);
  addBulletPoint(PRIVACY_ACCESS_TERMS.noPublicData);
  addBulletPoint(PRIVACY_ACCESS_TERMS.noRedirect);
  
  // Access permissions table
  currentY += 5;
  const accessRows: string[][] = [
    [ACCESS_PERMISSIONS.admin.role, ACCESS_PERMISSIONS.admin.access, ACCESS_PERMISSIONS.admin.cardAccess],
    [ACCESS_PERMISSIONS.employee.role, ACCESS_PERMISSIONS.employee.access, ACCESS_PERMISSIONS.employee.cardAccess],
    [ACCESS_PERMISSIONS.technician.role, ACCESS_PERMISSIONS.technician.access, ACCESS_PERMISSIONS.technician.cardAccess],
  ];
  
  addTable(["Role", "Access Level", "Card Access"], accessRows, [35, 80, 55]);
  
  addSectionHeader(10, "Client Acknowledgement");
  
  addParagraph("By confirming the order linked to this agreement, the client confirms and accepts that:", 0, 7);
  
  CLIENT_ACKNOWLEDGEMENT.forEach(item => {
    addBulletPoint(item);
  });
  
  addLegalFooter();
  
  // ========== PAGE 6: SIGNATURES ==========
  addNewPage();
  
  addSectionHeader(11, "Signatures");
  
  const sigWidth = (contentWidth - 20) / 2;
  const sigHeight = 55;
  
  // Client signature (LEFT)
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, currentY, sigWidth, sigHeight, 2, 2, "FD");
  
  // Left accent bar
  doc.setFillColor(...accentTeal);
  doc.rect(marginLeft, currentY, 3, sigHeight, "F");
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("CLIENT", marginLeft + 8, currentY + 10);
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(`${data.clientFirstName} ${data.clientLastName}`, marginLeft + 8, currentY + 18);
  doc.text(`Signed on: ${data.signedAt ? format(new Date(data.signedAt), "d MMM yyyy") : "____________________"}`, marginLeft + 8, currentY + 26);
  
  doc.text("Signature:", marginLeft + 8, currentY + 40);
  doc.setDrawColor(...textMuted);
  doc.setLineWidth(0.3);
  doc.line(marginLeft + 30, currentY + 40, marginLeft + sigWidth - 5, currentY + 40);
  
  // Company signature (RIGHT)
  const compSigX = marginLeft + sigWidth + 20;
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(compSigX, currentY, sigWidth, sigHeight, 2, 2, "F");
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentTeal);
  doc.text("PROCESSED AND AUTHORIZED BY", compSigX + 5, currentY + 10);
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...white);
  doc.text(`Admin: ${data.adminName || "____________________"} — ${data.adminEmail || ""}`, compSigX + 5, currentY + 20);
  doc.text(`Employee: ${data.employeeName || "____________________"} — ${data.employeeEmail || ""}`, compSigX + 5, currentY + 28);
  doc.text(`Technician: ${data.technicianName || "____________________"} — ${data.technicianEmail || ""}`, compSigX + 5, currentY + 36);
  
  doc.text("Signature:", compSigX + 5, currentY + 48);
  doc.setDrawColor(150, 150, 150);
  doc.line(compSigX + 30, currentY + 48, compSigX + sigWidth - 5, currentY + 48);
  
  currentY += sigHeight + 15;
  
  // Status banner
  if (data.isSigned && data.signedAt) {
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1.5);
    doc.roundedRect(marginLeft, currentY, contentWidth, 18, 3, 3, "FD");
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("✓ AGREEMENT EXECUTED", pageWidth / 2, currentY + 8, { align: "center" });
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(format(new Date(data.signedAt), "d MMMM yyyy 'at' HH:mm"), pageWidth / 2, currentY + 14, { align: "center" });
  } else {
    doc.setFillColor(254, 249, 195);
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1.5);
    doc.roundedRect(marginLeft, currentY, contentWidth, 15, 3, 3, "FD");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(161, 98, 7);
    doc.text("⏳ AWAITING CLIENT SIGNATURE", pageWidth / 2, currentY + 10, { align: "center" });
  }
  
  currentY += 25;
  
  // End of Agreement
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("— END OF AGREEMENT —", pageWidth / 2, currentY, { align: "center" });
  
  addLegalFooter();
  
  return doc;
};

import { safePDFDownload, safePDFOpen } from "./pdfUtils";

export const downloadTelecomContractPDF = (data: TelecomContractData): void => {
  try {
    const doc = generateTelecomContractPDF(data);
    const blob = doc.output("blob");
    const filename = `CSA-${data.contractNumber}.pdf`;
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
    const filename = `CSA-${data.contractNumber}.pdf`;
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
