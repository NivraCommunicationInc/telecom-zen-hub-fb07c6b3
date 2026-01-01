import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BUSINESS_INFO,
  CONTRACT_TERMS,
  ACCESS_PERMISSIONS,
  WARRANTY_POLICY,
  CANCELLATION_POLICY,
  NO_CREDIT_CHECK_POLICY,
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
  servicePlan: string; // Main service name
  bundleName?: string;
  category?: string;
  
  // Equipment Assigned
  routerSerial?: string;
  terminalSerial?: string;
  terminalCount?: number;
  simSerial?: string;
  simType?: string; // "SIM" or "eSIM"
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
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;
  let pageNumber = 1;
  
  // Colors
  const navyColor: [number, number, number] = [10, 25, 47];
  const cyanAccent: [number, number, number] = [0, 188, 212];
  const darkText: [number, number, number] = [33, 33, 33];
  const grayText: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [245, 247, 250];
  
  const addNewPage = () => {
    addFooter();
    doc.addPage();
    pageNumber++;
    currentY = 25;
    addPageHeader();
  };
  
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 35) {
      addNewPage();
    }
  };
  
  const addPageHeader = () => {
    if (pageNumber > 1) {
      doc.setFillColor(...cyanAccent);
      doc.rect(0, 0, pageWidth, 3, "F");
      doc.setFillColor(...navyColor);
      doc.rect(0, 3, pageWidth, 15, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(BUSINESS_INFO.name.toUpperCase(), margin, 12);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Contract ID: ${data.contractNumber}`, pageWidth - margin, 12, { align: "right" });
      currentY = 25;
    }
  };
  
  const addFooter = () => {
    doc.setFillColor(...cyanAccent);
    doc.rect(0, pageHeight - 10, pageWidth, 2, "F");
    doc.setFontSize(6);
    doc.setTextColor(...grayText);
    doc.text(`${BUSINESS_INFO.legalName} | ${BUSINESS_INFO.phone} | ${BUSINESS_INFO.email}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 5, { align: "right" });
    
    // Initials boxes
    doc.setDrawColor(...grayText);
    doc.setLineWidth(0.3);
    doc.rect(margin, pageHeight - 20, 18, 7);
    doc.rect(margin + 22, pageHeight - 20, 18, 7);
    doc.setFontSize(5);
    doc.text("Client", margin + 9, pageHeight - 22, { align: "center" });
    doc.text("Nivra", margin + 31, pageHeight - 22, { align: "center" });
  };
  
  const addSectionNumber = (num: number, title: string) => {
    checkPageBreak(16);
    currentY += 4;
    doc.setFillColor(...navyColor);
    doc.roundedRect(margin, currentY - 4, contentWidth, 9, 1, 1, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`${num}. ${title}`, margin + 4, currentY + 2);
    currentY += 10;
  };
  
  const addParagraph = (text: string, fontSize: number = 8, indent: number = 0) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    const lineHeight = fontSize * 0.4;
    checkPageBreak(lines.length * lineHeight + 3);
    doc.text(lines, margin + indent, currentY);
    currentY += lines.length * lineHeight + 2;
  };
  
  const addTableRow = (col1: string, col2: string, y: number, isHeader: boolean = false) => {
    const col1Width = 55;
    doc.setFontSize(7);
    if (isHeader) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...navyColor);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...darkText);
    }
    doc.text(col1, margin + 5, y);
    doc.text(col2, margin + col1Width, y);
    return y + 5;
  };
  
  // ========== PAGE 1: COVER ==========
  doc.setFillColor(...cyanAccent);
  doc.rect(0, 0, pageWidth, 4, "F");
  doc.setFillColor(...navyColor);
  doc.rect(0, 4, pageWidth, 50, "F");
  
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.name.toUpperCase(), pageWidth / 2, 22, { align: "center" });
  
  doc.setFontSize(11);
  doc.setTextColor(...cyanAccent);
  doc.text("Customer Service Agreement (CSA)", pageWidth / 2, 34, { align: "center" });
  
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text("Licensed Telecommunications Services Provider — Province of Québec", pageWidth / 2, 42, { align: "center" });
  doc.text(`${BUSINESS_INFO.email}`, pageWidth / 2, 50, { align: "center" });
  
  currentY = 62;
  
  // ========== SECTION 1: PARTIES ==========
  addSectionNumber(1, "Parties");
  
  const partyWidth = (contentWidth - 8) / 2;
  
  // Service Provider
  doc.setFillColor(...navyColor);
  doc.roundedRect(margin, currentY, partyWidth, 38, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cyanAccent);
  doc.text("Service Provider", margin + 4, currentY + 8);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.legalName, margin + 4, currentY + 16);
  doc.text(BUSINESS_INFO.address, margin + 4, currentY + 22);
  doc.text(`Customer Support: ${BUSINESS_INFO.email}`, margin + 4, currentY + 28);
  doc.setFontSize(6);
  doc.setTextColor(180, 180, 180);
  doc.text("(system-owned inbox)", margin + 4, currentY + 33);
  
  // Client
  const clientX = margin + partyWidth + 8;
  doc.setFillColor(...lightGray);
  doc.roundedRect(clientX, currentY, partyWidth, 38, 2, 2, "F");
  doc.setDrawColor(...cyanAccent);
  doc.setLineWidth(1);
  doc.line(clientX, currentY + 2, clientX, currentY + 36);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("Client (Service Subscriber)", clientX + 4, currentY + 8);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(`${data.clientFirstName} ${data.clientLastName}`, clientX + 4, currentY + 16);
  doc.text(data.clientEmail, clientX + 4, currentY + 22);
  if (data.clientPhone) doc.text(data.clientPhone, clientX + 4, currentY + 28);
  
  currentY += 45;
  
  // ========== SECTION 2: AGREEMENT IDENTIFICATION ==========
  addSectionNumber(2, "Agreement Identification");
  
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 40, 2, 2, "F");
  
  let idY = currentY + 8;
  idY = addTableRow("Identifier Type", "Format", idY, true);
  idY = addTableRow("Contract ID", data.contractNumber, idY);
  if (data.orderReference || data.orderNumber) {
    idY = addTableRow("Order Reference", data.orderReference || data.orderNumber || "", idY);
  }
  if (data.paymentReference) {
    idY = addTableRow("Payment Reference", data.paymentReference, idY);
  }
  idY = addTableRow("Agreement Version", CONTRACT_TERMS.version, idY);
  idY = addTableRow("Issued On", format(new Date(data.orderDate), "d MMMM yyyy", { locale: fr }), idY);
  addTableRow("Internal Status Flow", CONTRACT_TERMS.statusFlow.join(" → "), idY);
  
  currentY += 47;
  
  // ========== SECTION 3: SERVICES SUBSCRIBED ==========
  addSectionNumber(3, "Services Subscribed");
  
  addParagraph("The contract binds dynamically to all services selected and paid through the Nivra platform:", 7);
  currentY += 2;
  
  doc.setFillColor(...lightGray);
  const servicesHeight = 35;
  doc.roundedRect(margin, currentY, contentWidth, servicesHeight, 2, 2, "F");
  
  let servY = currentY + 7;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  
  const serviceItems = [
    { label: "Internet", value: data.internetPlan || data.servicePlan },
    { label: "TV Bundle", value: data.tvBundle || data.bundleName },
    { label: "Mobile Plan", value: data.mobilePlan },
    { label: "Security", value: data.securityPlan },
    { label: "Streaming", value: data.streamingPlan },
    { label: "Accessories", value: data.accessories },
  ];
  
  serviceItems.forEach((item, i) => {
    if (item.value) {
      doc.text(`• ${item.label}: ${item.value}`, margin + 5, servY);
      servY += 5;
    }
  });
  
  currentY += servicesHeight + 3;
  
  doc.setFontSize(6);
  doc.setTextColor(...grayText);
  doc.text("* TV services cannot be subscribed without an Internet plan.", margin + 5, currentY);
  currentY += 5;
  
  addFooter();
  
  // ========== PAGE 2: EQUIPMENT & FEES ==========
  addNewPage();
  
  // ========== SECTION 4: EQUIPMENT ASSIGNED ==========
  addSectionNumber(4, "Equipment Assigned to Order");
  
  doc.setFillColor(...lightGray);
  const equipHeight = 35;
  doc.roundedRect(margin, currentY, contentWidth, equipHeight, 2, 2, "F");
  
  let eqY = currentY + 8;
  eqY = addTableRow("Equipment Type", "Placeholder", eqY, true);
  
  if (data.routerSerial) {
    eqY = addTableRow("Router", data.routerSerial, eqY);
  }
  if (data.terminalSerial) {
    const terminalInfo = data.terminalCount ? `${data.terminalSerial} (x${data.terminalCount})` : data.terminalSerial;
    eqY = addTableRow("TV Terminal(s)", terminalInfo, eqY);
  }
  if (data.simSerial || data.simType) {
    const simInfo = `${data.simSerial || "N/A"} — ${data.simType || "SIM"}`;
    eqY = addTableRow("SIM / eSIM", simInfo, eqY);
  }
  addTableRow("Warranty", data.warrantyStatus || "1-year manufacturer warranty", eqY);
  
  currentY += equipHeight + 5;
  
  // ========== SECTION 5: FEES & PAYMENTS ==========
  addSectionNumber(5, "Fees & Payments (No Credit Verification, No Commission)");
  
  addParagraph("All one-time fees are paid before order confirmation. Fees are not plan-name dependent and apply automatically:", 7);
  currentY += 2;
  
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 55, 2, 2, "F");
  
  let feeY = currentY + 8;
  const priceCol = pageWidth - margin - 30;
  
  const addFeeRow = (label: string, condition: string, amount: string, isNegative: boolean = false) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);
    doc.text(label, margin + 5, feeY);
    doc.setTextColor(...grayText);
    doc.text(condition, margin + 45, feeY);
    doc.setFont("helvetica", "bold");
    if (isNegative) {
      doc.setTextColor(34, 197, 94);
    } else {
      doc.setTextColor(...darkText);
    }
    doc.text(amount, priceCol, feeY, { align: "right" });
    feeY += 5;
  };
  
  feeY = addTableRow("Fee Type", "Applied Logic                                  Amount", feeY, true);
  
  if (data.simFee && data.simFee > 0) {
    const simLabel = data.simType === "eSIM" ? "eSIM" : "SIM Physical";
    addFeeRow(simLabel, data.simType === "eSIM" ? "Added if eSIM selected" : "Added if SIM selected", `${data.simFee.toFixed(2)} $`);
  }
  if (data.routerFee && data.routerFee > 0) {
    addFeeRow("Router Fee", "Added if router delivered", `${data.routerFee.toFixed(2)} $`);
  }
  if (data.terminalFee && data.terminalFee > 0) {
    const termCount = data.terminalCount || 1;
    addFeeRow("TV Terminal", `Added per terminal (x${termCount})`, `${data.terminalFee.toFixed(2)} $`);
  }
  if (data.uberExpressFee && data.uberExpressFee > 0) {
    addFeeRow("Uber Express", "Added if eligible city", `${data.uberExpressFee.toFixed(2)} $`);
  }
  if (data.installationFee && data.installationFee > 0) {
    addFeeRow("Technician Install", "Added if Internet/TV", `${data.installationFee.toFixed(2)} $`);
  }
  if (data.discountAmount && data.discountAmount > 0) {
    addFeeRow("Discount", "Applied", `-${data.discountAmount.toFixed(2)} $`, true);
  }
  
  currentY += 60;
  
  // Accepted Payment Methods
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("Accepted Payment Methods", margin, currentY);
  currentY += 5;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(CONTRACT_TERMS.paymentTerms.acceptedMethods.join(", "), margin + 5, currentY);
  currentY += 8;
  
  // E-Transfer Instructions
  doc.setFillColor(255, 250, 235);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "F");
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "S");
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 130, 0);
  doc.text("E-Transfer Instructions (Secure Payment Channel)", margin + 5, currentY + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(`Email: ${CONTRACT_TERMS.etransfer.email}`, margin + 5, currentY + 12);
  doc.text(`Security Question: ${CONTRACT_TERMS.etransfer.securityQuestion}`, margin + 5, currentY + 17);
  doc.text(`Required Answer: ${CONTRACT_TERMS.etransfer.securityAnswer}`, margin + 100, currentY + 17);
  
  currentY += 28;
  
  // ========== SECTION 6: DELIVERY & FULFILLMENT SLA ==========
  addSectionNumber(6, "Delivery & Fulfillment SLA");
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("Delivery Category Enforcement", margin, currentY);
  currentY += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(`• Orders containing Mobile, Streaming, or Accessories → Delivery only`, margin + 5, currentY);
  currentY += 4;
  doc.text(`• Orders containing Internet or TV → Technician installation may be selected`, margin + 5, currentY);
  currentY += 6;
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("Delivery Timeframes", margin, currentY);
  currentY += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(`• Standard Québec Delivery: ${CONTRACT_TERMS.delivery.standardDays}`, margin + 5, currentY);
  currentY += 4;
  doc.text(`• Uber Express Delivery (${CONTRACT_TERMS.delivery.uberExpress}): Only eligible in:`, margin + 5, currentY);
  currentY += 4;
  doc.setFontSize(6);
  doc.text(`  ${CONTRACT_TERMS.delivery.eligibleCities.join(", ")}`, margin + 5, currentY);
  currentY += 6;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("No External Redirect", margin, currentY);
  currentY += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text("The client will never be redirected to third-party carrier websites for delivery or payment.", margin + 5, currentY);
  
  addFooter();
  
  // ========== PAGE 3: PORTABILITY & POLICIES ==========
  addNewPage();
  
  // ========== SECTION 7: NUMBER PORTABILITY ==========
  addSectionNumber(7, "Number Portability (Québec Only)");
  
  addParagraph("If the order contains a number transfer request, the system will validate inline using:", 7);
  currentY += 2;
  
  doc.setFontSize(7);
  doc.setTextColor(...darkText);
  doc.text(`Area codes permitted: ${CONTRACT_TERMS.portability.allowedAreaCodes.join(", ")}`, margin + 5, currentY);
  currentY += 6;
  
  doc.text("If transferable → Admin may request:", margin + 5, currentY);
  currentY += 4;
  doc.text("• Previous carrier name (Québec carriers only)", margin + 10, currentY);
  currentY += 4;
  doc.text("• Client account number", margin + 10, currentY);
  currentY += 4;
  doc.text("• Internal approval", margin + 10, currentY);
  currentY += 6;
  
  doc.text(`If new number is required → system assigns temporary placeholder: ${CONTRACT_TERMS.portability.tempPlaceholder}`, margin + 5, currentY);
  currentY += 4;
  doc.setFontSize(6);
  doc.setTextColor(...grayText);
  doc.text("(modifiable later by Admin only)", margin + 5, currentY);
  currentY += 4;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 50, 50);
  doc.text("The client cannot choose their phone number at checkout.", margin + 5, currentY);
  currentY += 8;
  
  // ========== SECTION 8: EQUIPMENT WARRANTY POLICY ==========
  addSectionNumber(8, "Equipment Warranty Policy");
  
  doc.setFontSize(7);
  doc.setTextColor(...darkText);
  doc.setFont("helvetica", "normal");
  doc.text(`• ${CONTRACT_TERMS.warranty.duration} manufacturer warranty`, margin + 5, currentY);
  currentY += 4;
  doc.text(`• Covers ${CONTRACT_TERMS.warranty.coverage.toLowerCase()}`, margin + 5, currentY);
  currentY += 4;
  doc.text("• Excludes:", margin + 5, currentY);
  currentY += 4;
  CONTRACT_TERMS.warranty.exclusions.forEach(excl => {
    doc.text(`  - ${excl}`, margin + 10, currentY);
    currentY += 4;
  });
  currentY += 4;
  
  // ========== SECTION 9: CANCELLATION & NON-RETURN POLICY ==========
  addSectionNumber(9, "Cancellation & Non-Return Policy");
  
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 25, 2, 2, "F");
  
  let cancY = currentY + 7;
  cancY = addTableRow("Cancellation Stage", "Rule", cancY, true);
  cancY = addTableRow("After delivery", CONTRACT_TERMS.cancellation.afterDeliveryCharge, cancY);
  cancY = addTableRow("Before delivery", CONTRACT_TERMS.cancellation.beforeDeliveryCharge, cancY);
  addTableRow("Order cancelled", "All service bindings removed from client profile", cancY);
  
  currentY += 30;
  
  doc.setFontSize(7);
  doc.setTextColor(180, 50, 50);
  doc.setFont("helvetica", "bold");
  doc.text("If equipment is not returned:", margin + 5, currentY);
  currentY += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(`${CONTRACT_TERMS.cancellation.nonReturnFee} may be applied.`, margin + 5, currentY);
  currentY += 8;
  
  // ========== SECTION 10: DATA PRIVACY & ACCESS PERMISSIONS ==========
  addSectionNumber(10, "Data Privacy & Access Permissions");
  
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "F");
  
  let permY = currentY + 7;
  permY = addTableRow("Role", "Access Level", permY, true);
  permY = addTableRow(ACCESS_PERMISSIONS.admin.role, ACCESS_PERMISSIONS.admin.access, permY);
  permY = addTableRow(ACCESS_PERMISSIONS.employee.role, ACCESS_PERMISSIONS.employee.access, permY);
  addTableRow(ACCESS_PERMISSIONS.technician.role, ACCESS_PERMISSIONS.technician.access, permY);
  
  currentY += 28;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 197, 94);
  doc.text("No client data is sold or shared externally.", margin + 5, currentY);
  currentY += 8;
  
  // ========== SECTION 11: INTERNAL ACTIVITY LOGS ==========
  addSectionNumber(11, "Internal Activity Logs");
  
  addParagraph("All account modifications are logged internally and visible only to the Admin in:", 7);
  currentY += 1;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("Admin Portal → Logs privés", margin + 5, currentY);
  currentY += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text("Fields logged: Actor role, Internal email, Timestamp, Field changed, Old value → New value, Reason entered", margin + 5, currentY);
  currentY += 5;
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 197, 94);
  doc.text("Logs and records never disappear from the system.", margin + 5, currentY);
  
  addFooter();
  
  // ========== PAGE 4: ACCEPTANCE & SIGNATURES ==========
  addNewPage();
  
  // ========== SECTION 12: CLIENT ACCEPTANCE ==========
  addSectionNumber(12, "Client Acceptance");
  
  addParagraph("By confirming this agreement, the client accepts:", 7);
  currentY += 2;
  
  const acceptanceItems = [
    "Fees applied before confirmation",
    "Delivery category enforcement",
    "Warranty and cancellation policies",
    "Data privacy terms",
    "The agreement as legally enforceable in Québec",
  ];
  
  acceptanceItems.forEach(item => {
    doc.setFontSize(7);
    doc.setTextColor(...darkText);
    doc.text(`• ${item}`, margin + 5, currentY);
    currentY += 4;
  });
  
  currentY += 6;
  
  // ========== SECTION 13: SIGNATURES ==========
  addSectionNumber(13, "Signatures");
  
  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 60;
  
  // Client e-Signature
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");
  doc.setDrawColor(...cyanAccent);
  doc.setLineWidth(1);
  doc.line(margin, currentY + 2, margin, currentY + sigBoxHeight - 2);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navyColor);
  doc.text("Client e-Signature", margin + sigBoxWidth / 2, currentY + 10, { align: "center" });
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkText);
  doc.text(`Name: ${data.clientFirstName} ${data.clientLastName}`, margin + 5, currentY + 22);
  doc.text(`Date: ${data.signedAt ? format(new Date(data.signedAt), "d MMMM yyyy", { locale: fr }) : "_______________________"}`, margin + 5, currentY + 30);
  doc.text("Signature:", margin + 5, currentY + 42);
  doc.setDrawColor(...grayText);
  doc.line(margin + 25, currentY + 42, margin + sigBoxWidth - 5, currentY + 42);
  
  // Processed by (Nivra Employee)
  const empX = margin + sigBoxWidth + 10;
  doc.setFillColor(...navyColor);
  doc.roundedRect(empX, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cyanAccent);
  doc.text("Processed by (Nivra Employee)", empX + sigBoxWidth / 2, currentY + 10, { align: "center" });
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`Name: ${data.employeeName || "_______________________"}`, empX + 5, currentY + 22);
  doc.text(`Role: ${data.employeeRole || "_______________________"}`, empX + 5, currentY + 30);
  doc.text(`Internal Email: ${data.employeeEmail || "_______________________"}`, empX + 5, currentY + 38);
  doc.text("Signature:", empX + 5, currentY + 50);
  doc.setDrawColor(100, 100, 100);
  doc.line(empX + 25, currentY + 50, empX + sigBoxWidth - 5, currentY + 50);
  
  doc.setFontSize(6);
  doc.setTextColor(180, 180, 180);
  doc.text("Authorized for Nivra Communications Inc.", empX + 5, currentY + 56);
  
  currentY += sigBoxHeight + 15;
  
  // Status banner
  if (data.isSigned && data.signedAt) {
    doc.setFillColor(230, 255, 230);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "F");
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "S");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 150, 94);
    doc.text("✓ CONTRACT SIGNED / CONTRAT SIGNÉ", pageWidth / 2, currentY + 10, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`${format(new Date(data.signedAt), "d MMMM yyyy 'at' HH:mm", { locale: fr })}`, pageWidth / 2, currentY + 17, { align: "center" });
  } else {
    doc.setFillColor(255, 250, 235);
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, "F");
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1);
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, "S");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 130, 0);
    doc.text("⏳ AWAITING SIGNATURE / EN ATTENTE DE SIGNATURE", pageWidth / 2, currentY + 11, { align: "center" });
  }
  
  addFooter();
  
  return doc;
};

export const downloadTelecomContractPDF = (data: TelecomContractData): void => {
  const doc = generateTelecomContractPDF(data);
  doc.save(`CSA-${data.contractNumber}.pdf`);
};

export const viewTelecomContractPDF = (data: TelecomContractData): void => {
  const doc = generateTelecomContractPDF(data);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
};

export const getTelecomContractBlob = (data: TelecomContractData): Blob => {
  const doc = generateTelecomContractPDF(data);
  return doc.output("blob");
};
