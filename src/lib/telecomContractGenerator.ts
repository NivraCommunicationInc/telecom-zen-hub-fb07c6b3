import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BUSINESS_INFO,
  CONTRACT_TERMS,
  ACCESS_PERMISSIONS,
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
  
  // Status
  internalStatus?: string;
  isSigned: boolean;
  signedAt?: string;
  
  // Employee who processed
  employeeName?: string;
  employeeRole?: string;
  employeeEmail?: string;
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
  let sectionNumber = 0;
  
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
      `${BUSINESS_INFO.legalName} — ${BUSINESS_INFO.address} — ${BUSINESS_INFO.phone}`,
      pageWidth / 2,
      pageHeight - 16,
      { align: "center" }
    );
    doc.text(
      "Licensed Telecommunications Services Provider — Province of Québec",
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
  
  const addSectionHeader = (title: string) => {
    sectionNumber++;
    checkPageBreak(18);
    currentY += 6;
    
    // Section number box
    doc.setFillColor(...primaryNavy);
    doc.roundedRect(marginLeft, currentY - 5, 8, 8, 1, 1, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(String(sectionNumber), marginLeft + 4, currentY, { align: "center" });
    
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
  
  const addClause = (clauseNum: string, text: string, indent: number = 0) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    
    const clauseX = marginLeft + indent;
    doc.text(clauseNum, clauseX, currentY);
    
    doc.setFont("helvetica", "normal");
    const textX = clauseX + 12;
    const maxWidth = contentWidth - indent - 12;
    const lines = doc.splitTextToSize(text, maxWidth);
    
    checkPageBreak(lines.length * 4 + 2);
    doc.text(lines, textX, currentY);
    currentY += lines.length * 4 + 3;
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
  
  // ========== PAGE 1: COVER & PARTIES ==========
  
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
  doc.text("CUSTOMER SERVICE AGREEMENT", pageWidth / 2, 32, { align: "center" });
  
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text("Licensed Telecommunications Services Provider — Province of Québec", pageWidth / 2, 40, { align: "center" });
  
  currentY = 52;
  
  // Reference ID box (sidebar-style, top right)
  const refBoxWidth = 55;
  const refBoxX = pageWidth - marginRight - refBoxWidth;
  
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...accentTeal);
  doc.setLineWidth(1);
  doc.roundedRect(refBoxX, currentY, refBoxWidth, 32, 2, 2, "FD");
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textMuted);
  doc.text("CONTRACT REFERENCE", refBoxX + refBoxWidth / 2, currentY + 6, { align: "center" });
  
  doc.setFontSize(8);
  doc.setTextColor(...primaryNavy);
  doc.text(data.contractNumber, refBoxX + refBoxWidth / 2, currentY + 13, { align: "center" });
  
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text("ISSUED", refBoxX + refBoxWidth / 2, currentY + 20, { align: "center" });
  
  doc.setFontSize(7);
  doc.setTextColor(...textDark);
  doc.text(format(new Date(data.orderDate), "dd MMM yyyy").toUpperCase(), refBoxX + refBoxWidth / 2, currentY + 26, { align: "center" });
  
  // Parties section (left side)
  const partiesWidth = refBoxX - marginLeft - 10;
  
  addSectionHeader("Parties");
  
  // Provider box
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(marginLeft, currentY, partiesWidth / 2 - 3, 35, 2, 2, "F");
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentTeal);
  doc.text("SERVICE PROVIDER", marginLeft + 4, currentY + 7);
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...white);
  doc.text(BUSINESS_INFO.legalName, marginLeft + 4, currentY + 14);
  doc.text(BUSINESS_INFO.address, marginLeft + 4, currentY + 20);
  doc.text(`Tel: ${BUSINESS_INFO.phone}`, marginLeft + 4, currentY + 26);
  doc.text(BUSINESS_INFO.email, marginLeft + 4, currentY + 32);
  
  // Client box
  const clientBoxX = marginLeft + partiesWidth / 2 + 3;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(clientBoxX, currentY, partiesWidth / 2 - 3, 35, 2, 2, "FD");
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("CLIENT (SUBSCRIBER)", clientBoxX + 4, currentY + 7);
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(`${data.clientFirstName} ${data.clientLastName}`, clientBoxX + 4, currentY + 14);
  doc.text(data.clientEmail, clientBoxX + 4, currentY + 20);
  if (data.clientPhone) doc.text(data.clientPhone, clientBoxX + 4, currentY + 26);
  if (data.clientAccountNumber) {
    doc.setFont("helvetica", "bold");
    doc.text(`Account: ${data.clientAccountNumber}`, clientBoxX + 4, currentY + 32);
  }
  
  currentY += 42;
  
  // Agreement identifiers table
  addSectionHeader("Agreement Identification");
  
  const idRows: string[][] = [
    ["Contract ID", data.contractNumber],
    ["Order Reference", data.orderReference || data.orderNumber || "—"],
    ["Agreement Version", CONTRACT_TERMS.version],
    ["Issue Date", format(new Date(data.orderDate), "d MMMM yyyy", { locale: fr })],
  ];
  
  addTable(["Identifier", "Value"], idRows, [50, contentWidth - 50]);
  
  // Services section
  addSectionHeader("Services Subscribed");
  
  addParagraph("This Agreement binds dynamically to all services selected and paid through the Nivra platform:", 0, 7);
  
  const serviceRows: string[][] = [];
  if (data.internetPlan || data.servicePlan) serviceRows.push(["Internet", data.internetPlan || data.servicePlan]);
  if (data.tvBundle || data.bundleName) serviceRows.push(["TV Bundle", data.tvBundle || data.bundleName || "—"]);
  if (data.mobilePlan) serviceRows.push(["Mobile Plan", data.mobilePlan]);
  if (data.securityPlan) serviceRows.push(["Security", data.securityPlan]);
  if (data.streamingPlan) serviceRows.push(["Streaming", data.streamingPlan]);
  if (data.accessories) serviceRows.push(["Accessories", data.accessories]);
  
  if (serviceRows.length === 0) {
    serviceRows.push([data.category || "Telecom Service", data.servicePlan]);
  }
  
  addTable(["Service Type", "Plan/Description"], serviceRows, [45, contentWidth - 45]);
  
  doc.setFontSize(6);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...textMuted);
  doc.text("* TV services cannot be subscribed without an active Internet plan.", marginLeft, currentY);
  currentY += 5;
  
  addLegalFooter();
  
  // ========== PAGE 2: EQUIPMENT & FEES ==========
  addNewPage();
  
  addSectionHeader("Equipment Assigned");
  
  const equipRows: string[][] = [];
  if (data.routerSerial) equipRows.push(["Nivra WiFi Router", data.routerSerial, "1-Year Warranty"]);
  if (data.terminalSerial) {
    const count = data.terminalCount || 1;
    equipRows.push(["Nivra 4K Terminal", `${data.terminalSerial} (×${count})`, "1-Year Warranty"]);
  }
  if (data.simSerial || data.simType) {
    equipRows.push([data.simType === "eSIM" ? "eSIM" : "Physical SIM", data.simSerial || "Assigned at activation", "—"]);
  }
  if (data.imeiNumber) equipRows.push(["IMEI", data.imeiNumber, "—"]);
  
  if (equipRows.length > 0) {
    addTable(["Equipment", "Serial / Reference", "Warranty"], equipRows, [55, 70, 45]);
  } else {
    addParagraph("Equipment will be assigned upon order processing.", 0, 7);
  }
  
  addSectionHeader("Fees & Payment Terms");
  
  addClause("5.1", "All one-time fees are collected before order confirmation. Fees are applied automatically based on service selection.");
  
  const feeRows: string[][] = [];
  if (data.simFee && data.simFee > 0) {
    feeRows.push([data.simType === "eSIM" ? "eSIM Activation" : "Physical SIM", `${data.simFee.toFixed(2)} $`]);
  }
  if (data.routerFee && data.routerFee > 0) feeRows.push(["Router Fee", `${data.routerFee.toFixed(2)} $`]);
  if (data.terminalFee && data.terminalFee > 0) {
    const count = data.terminalCount || 1;
    feeRows.push([`TV Terminal (×${count})`, `${data.terminalFee.toFixed(2)} $`]);
  }
  if (data.deliveryFee && data.deliveryFee > 0) feeRows.push(["Delivery Fee", `${data.deliveryFee.toFixed(2)} $`]);
  if (data.uberExpressFee && data.uberExpressFee > 0) feeRows.push(["Uber Express Delivery", `${data.uberExpressFee.toFixed(2)} $`]);
  if (data.installationFee && data.installationFee > 0) feeRows.push(["Technician Installation", `${data.installationFee.toFixed(2)} $`]);
  if (data.activationFee && data.activationFee > 0) feeRows.push(["Activation Fee", `${data.activationFee.toFixed(2)} $`]);
  
  feeRows.push(["Subtotal", `${data.subtotal.toFixed(2)} $`]);
  if (data.discountAmount && data.discountAmount > 0) feeRows.push(["Discount Applied", `−${data.discountAmount.toFixed(2)} $`]);
  feeRows.push(["TPS (5%)", `${data.tpsAmount.toFixed(2)} $`]);
  feeRows.push(["TVQ (9.975%)", `${data.tvqAmount.toFixed(2)} $`]);
  
  addTable(["Fee Description", "Amount"], feeRows, [120, 50]);
  
  // Total box
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(marginLeft + 120, currentY - 2, 50, 10, 1, 1, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("TOTAL", marginLeft + 125, currentY + 5);
  doc.text(`${data.totalAmount.toFixed(2)} $ CAD`, marginLeft + 165, currentY + 5, { align: "right" });
  currentY += 14;
  
  // Payment methods
  addClause("5.2", `Accepted Payment Methods: ${CONTRACT_TERMS.paymentTerms.acceptedMethods.join(", ")}`);
  
  // E-Transfer box
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.8);
  doc.roundedRect(marginLeft, currentY, contentWidth, 20, 2, 2, "FD");
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 130, 0);
  doc.text("E-TRANSFER SECURE PAYMENT CHANNEL", marginLeft + 5, currentY + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(`Email: ${CONTRACT_TERMS.etransfer.email}`, marginLeft + 5, currentY + 12);
  doc.text(`Security Question: "${CONTRACT_TERMS.etransfer.securityQuestion}"`, marginLeft + 80, currentY + 12);
  doc.text(`Answer: "${CONTRACT_TERMS.etransfer.securityAnswer}"`, marginLeft + 5, currentY + 17);
  
  currentY += 26;
  
  addLegalFooter();
  
  // ========== PAGE 3: DELIVERY & POLICIES ==========
  addNewPage();
  
  addSectionHeader("Delivery & Fulfillment");
  
  addClause("6.1", `Standard Québec Delivery: ${CONTRACT_TERMS.delivery.standardDays}`);
  addClause("6.2", `Uber Express Delivery (${CONTRACT_TERMS.delivery.uberExpress}): Available in ${CONTRACT_TERMS.delivery.eligibleCities.slice(0, 4).join(", ")}, and select areas.`);
  addClause("6.3", "Orders containing Mobile, Streaming, or Accessories → Delivery only. Orders with Internet or TV → Installation available.");
  addClause("6.4", "The Client will not be redirected to third-party carrier websites for delivery or payment processing.");
  
  addSectionHeader("Number Portability (Québec Only)");
  
  addClause("7.1", `Permitted area codes: ${CONTRACT_TERMS.portability.allowedAreaCodes.join(", ")}`);
  addClause("7.2", "If transferable, Admin may request: previous carrier name, account number, and internal approval.");
  addClause("7.3", `If new number required, temporary placeholder assigned: ${CONTRACT_TERMS.portability.tempPlaceholder} (modifiable by Admin only).`);
  
  addSectionHeader("Equipment Warranty");
  
  addClause("8.1", `${CONTRACT_TERMS.warranty.duration} manufacturer warranty on all Nivra equipment.`);
  addClause("8.2", `Coverage: ${CONTRACT_TERMS.warranty.coverage}.`);
  addClause("8.3", `Exclusions: ${CONTRACT_TERMS.warranty.exclusions.join(", ")}.`);
  
  addSectionHeader("Cancellation & Return Policy");
  
  const cancRows: string[][] = [
    ["Before Delivery", "No fees, equipment/delivery costs may apply"],
    ["After Delivery", CONTRACT_TERMS.cancellation.afterDeliveryCharge],
    ["Equipment Return", `Within ${CONTRACT_TERMS.cancellation.returnDays} days; return costs on Client`],
    ["Non-Return Penalty", "Variable fee after Admin validation"],
  ];
  
  addTable(["Stage", "Terms"], cancRows, [50, contentWidth - 50]);
  
  addSectionHeader("Data Privacy & Access");
  
  const accessRows: string[][] = [
    [ACCESS_PERMISSIONS.admin.role, ACCESS_PERMISSIONS.admin.access],
    [ACCESS_PERMISSIONS.employee.role, ACCESS_PERMISSIONS.employee.access],
    [ACCESS_PERMISSIONS.technician.role, ACCESS_PERMISSIONS.technician.access],
  ];
  
  addTable(["Role", "Access Level"], accessRows, [40, contentWidth - 40]);
  
  addClause("10.1", "No client data is sold or shared externally. All modifications are logged in Admin Portal → Logs privés.");
  
  addLegalFooter();
  
  // ========== PAGE 4: LEGAL & SIGNATURES ==========
  addNewPage();
  
  addSectionHeader("Legal Terms");
  
  addClause("11.1", `LATE PAYMENT: Interest of ${CONTRACT_TERMS.paymentTerms.lateInterestRate}% per month on unpaid balances after ${CONTRACT_TERMS.paymentTerms.dueDays} days.`);
  addClause("11.2", "NO CREDIT CHECK: Access based on pre-authorization or security deposit. No impact on credit file.");
  addClause("11.3", "CONFIDENTIALITY: Client information kept strictly confidential; not shared without explicit consent.");
  addClause("11.4", "DATA PROTECTION: Personal data protected per Québec privacy laws and Law 25.");
  addClause("11.5", "FRAUD & ABUSE: Fraudulent use results in immediate termination and potential legal action.");
  addClause("11.6", "JURISDICTION: Governed by laws of Québec and applicable federal laws of Canada.");
  
  addSectionHeader("Client Acceptance");
  
  addParagraph("By confirming this Agreement, the Client accepts:", 0, 8);
  
  const acceptItems = [
    "All fees applied before confirmation",
    "Delivery category enforcement rules",
    "Equipment warranty and cancellation policies",
    "Data privacy and access terms",
    "This Agreement as legally enforceable in the Province of Québec"
  ];
  
  acceptItems.forEach((item, i) => {
    addClause(`12.${i + 1}`, item, 5);
  });
  
  currentY += 5;
  
  addSectionHeader("Signatures");
  
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
  doc.text("CLIENT E-SIGNATURE", marginLeft + 8, currentY + 10);
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(`Name: ${data.clientFirstName} ${data.clientLastName}`, marginLeft + 8, currentY + 20);
  doc.text(`Date: ${data.signedAt ? format(new Date(data.signedAt), "d MMM yyyy") : "____________________"}`, marginLeft + 8, currentY + 28);
  
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
  doc.text("NIVRA AUTHORIZED REPRESENTATIVE", compSigX + 5, currentY + 10);
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...white);
  doc.text(`Name: ${data.employeeName || "____________________"}`, compSigX + 5, currentY + 20);
  doc.text(`Role: ${data.employeeRole || "____________________"}`, compSigX + 5, currentY + 28);
  doc.text(`Email: ${data.employeeEmail || "____________________"}`, compSigX + 5, currentY + 36);
  
  doc.text("Signature:", compSigX + 5, currentY + 48);
  doc.setDrawColor(150, 150, 150);
  doc.line(compSigX + 30, currentY + 48, compSigX + sigWidth - 5, currentY + 48);
  
  currentY += sigHeight + 12;
  
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
