import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { COMPANY_CONTACT, ETRANSFER_CONFIG } from "@/config/company";

// Business Information
const NIVRA_BUSINESS = {
  name: COMPANY_CONTACT.legalName.toUpperCase(),
  division: "Customer Service Agreement Billing Division",
  description: "Telecommunications Services Provider — Province of Québec",
  address: COMPANY_CONTACT.fullAddress,
  email: COMPANY_CONTACT.supportEmailDisplay,
  phone: COMPANY_CONTACT.supportPhoneFormatted,
  neq: "2291249786",
};

// Quebec tax rates
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber?: string;
  paymentReference?: string;
  clientNumber?: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  clientCity?: string;
  billingCycleStart?: string;
  billingCycleEnd?: string;
  subtotal: number;
  fees?: number;
  credits?: number;
  deliveryFee?: number;
  activationFee?: number;
  installationFee?: number;
  terminalFee?: number;
  terminalCount?: number;
  routerFee?: number;
  simFee?: number;
  simType?: "physical" | "esim";
  discountAmount?: number;
  preauthDiscount?: number;
  /** Promo code applied */
  promoCode?: string;
  /** Promo discount description */
  promoDescription?: string;
  tpsAmount?: number;
  tvqAmount?: number;
  lateFeeAmount?: number;
  dueDate?: string;
  createdAt: string;
  status: string;
  paidAt?: string;
  notes?: string;
  equipmentId?: string;
  routerSerial?: string;
  terminalSerials?: string[];
  simSerial?: string;
  serviceDescription?: string;
  servicePlan?: string;
  tvBundle?: string;
  mobilePlan?: string;
  streamingService?: string;
  deliveryMethod?: string;
  trackingNumber?: string;
  issuedBy?: string;
  issuedByRole?: string;
  issuedAt?: string;
  /** Payment method: credit_card, etransfer, cash, etc. */
  paymentMethod?: "credit_card" | "etransfer" | "cash" | "other";
  /** Last 4 digits of credit card if applicable */
  cardLast4?: string;
  /** Card type (Visa, Mastercard, etc.) */
  cardType?: string;
}

export const generateInvoicePDF = (data: InvoiceData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const topMargin = 15;
  const bottomMargin = 40; // Reserve space for footer
  let currentY = margin;

  // Color palette - Professional telecom colors
  const primaryColor: [number, number, number] = [0, 150, 180]; // Teal
  const navyColor: [number, number, number] = [10, 25, 47];
  const darkColor: [number, number, number] = [30, 30, 30];
  const grayColor: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [150, 150, 150];
  const accentColor: [number, number, number] = [0, 120, 150];

  // Helper: check if we need a page break
  const checkPageBreak = (neededHeight: number): boolean => {
    if (currentY + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = topMargin;
      return true;
    }
    return false;
  };

  // Helper: add wrapped text with automatic page break
  const addWrappedText = (
    text: string,
    x: number,
    maxWidth: number,
    lineHeight: number,
    fontSize: number = 6,
    color: [number, number, number] = lightGray
  ): void => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);
    const neededHeight = lines.length * lineHeight;
    
    checkPageBreak(neededHeight);
    
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], x, currentY);
      currentY += lineHeight;
    }
  };

  // Calculate amounts
  const subtotal = data.subtotal || 0;
  const fees = data.fees || 0;
  const deliveryFee = data.deliveryFee || 0;
  const activationFee = data.activationFee || 0;
  const installationFee = data.installationFee || 0;
  const terminalFee = data.terminalFee || 0;
  const routerFee = data.routerFee || 0;
  const simFee = data.simFee || 0;
  const discountAmount = data.discountAmount || 0;
  const preauthDiscount = data.preauthDiscount || 0;
  const credits = data.credits || 0;
  const totalDiscount = discountAmount + preauthDiscount;

  const baseAmount = subtotal + fees + deliveryFee + activationFee + installationFee + terminalFee + routerFee + simFee - totalDiscount;
  const tpsAmount = data.tpsAmount ?? Math.round(baseAmount * TPS_RATE * 100) / 100;
  const tvqAmount = data.tvqAmount ?? Math.round(baseAmount * TVQ_RATE * 100) / 100;
  const lateFeeAmount = data.lateFeeAmount || 0;
  const total = baseAmount + tpsAmount + tvqAmount + lateFeeAmount - credits;

  // ============ HEADER SECTION ============
  doc.setFillColor(...navyColor);
  doc.rect(0, 0, pageWidth, 52, "F");

  // Top accent line
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Company name
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(NIVRA_BUSINESS.name, pageWidth / 2, 18, { align: "center" });

  // Division
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...primaryColor);
  doc.text(NIVRA_BUSINESS.division, pageWidth / 2, 26, { align: "center" });

  // Description
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(NIVRA_BUSINESS.description, pageWidth / 2, 33, { align: "center" });

  // Contact info
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Head Office: ${NIVRA_BUSINESS.address}`, pageWidth / 2, 40, { align: "center" });
  doc.text(`Support: ${NIVRA_BUSINESS.email}`, pageWidth / 2, 46, { align: "center" });

  currentY = 60;

  // ============ INVOICE TITLE & STATUS ============
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text("TELECOMMUNICATIONS INVOICE", margin, currentY);

  // Status badge
  const statusConfig: Record<string, { color: [number, number, number]; label: string }> = {
    paid: { color: [34, 197, 94], label: "PROCESSED" },
    pending: { color: [234, 179, 8], label: "PRE-AUTHORIZED" },
    overdue: { color: [239, 68, 68], label: "OVERDUE" },
    cancelled: { color: [156, 163, 175], label: "CANCELLED" },
  };

  const statusInfo = statusConfig[data.status] || statusConfig.pending;
  doc.setFillColor(...statusInfo.color);
  doc.roundedRect(pageWidth - margin - 55, currentY - 12, 55, 16, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(statusInfo.label, pageWidth - margin - 27.5, currentY - 2, { align: "center" });

  currentY += 12;

  // ============ IDENTIFIERS SECTION ============
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY, contentWidth, 38, 2, 2, "F");
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, margin, currentY + 38);

  const col1 = margin + 8;
  const col2 = margin + 55;
  const col3 = margin + 110;
  const col4 = margin + 155;

  // Row 1
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGray);
  doc.text("INVOICE NUMBER", col1, currentY + 7);
  doc.text("ORDER REFERENCE", col2, currentY + 7);
  doc.text("PAYMENT REFERENCE", col3, currentY + 7);
  doc.text("ACCOUNT KEY", col4, currentY + 7);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text(data.invoiceNumber || "—", col1, currentY + 13);
  doc.text(data.orderNumber || "—", col2, currentY + 13);
  doc.setTextColor(...primaryColor);
  doc.text(data.paymentReference || "—", col3, currentY + 13);
  doc.setTextColor(...darkColor);
  doc.text(data.clientNumber || "—", col4, currentY + 13);

  // Row 2
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...lightGray);
  doc.text("ISSUE DATE", col1, currentY + 23);
  doc.text("BILLING CYCLE START", col2, currentY + 23);
  doc.text("BILLING CYCLE END", col3, currentY + 23);
  if (data.dueDate) {
    doc.text("DUE DATE", col4, currentY + 23);
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text(format(new Date(data.createdAt), "yyyy-MM-dd"), col1, currentY + 29);
  doc.text(data.billingCycleStart ? format(new Date(data.billingCycleStart), "yyyy-MM-dd") : format(new Date(data.createdAt), "yyyy-MM-dd"), col2, currentY + 29);
  doc.text(data.billingCycleEnd ? format(new Date(data.billingCycleEnd), "yyyy-MM-dd") : "—", col3, currentY + 29);
  if (data.dueDate) {
    doc.setTextColor(data.status === "overdue" ? 239 : darkColor[0], data.status === "overdue" ? 68 : darkColor[1], data.status === "overdue" ? 68 : darkColor[2]);
    doc.text(format(new Date(data.dueDate), "yyyy-MM-dd"), col4, currentY + 29);
  }

  currentY += 45;

  // ============ CLIENT DETAILS SECTION ============
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentColor);
  doc.text("ACCOUNT HOLDER INFORMATION", margin, currentY);

  currentY += 6;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, margin + 80, currentY);

  currentY += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);
  doc.setFontSize(8);

  doc.text(`Name: ${data.clientName}`, margin, currentY);
  currentY += 5;
  doc.text(`Email: ${data.clientEmail}`, margin, currentY);
  if (data.clientPhone) {
    currentY += 5;
    doc.text(`Phone: ${data.clientPhone}`, margin, currentY);
  }
  if (data.clientAddress || data.clientCity) {
    currentY += 5;
    const address = [data.clientAddress, data.clientCity, "Québec, Canada"].filter(Boolean).join(", ");
    doc.text(`Service Address: ${address}`, margin, currentY);
  }

  currentY += 12;

  // ============ SERVICES BILLED SECTION ============
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentColor);
  doc.text("SERVICES BILLED", margin, currentY);

  currentY += 6;
  doc.setDrawColor(...primaryColor);
  doc.line(margin, currentY, margin + 45, currentY);

  currentY += 8;

  // Table header
  doc.setFillColor(...navyColor);
  doc.rect(margin, currentY, contentWidth, 8, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("CATEGORY", margin + 5, currentY + 5.5);
  doc.text("DESCRIPTION", margin + 45, currentY + 5.5);
  doc.text("AMOUNT (CAD)", pageWidth - margin - 5, currentY + 5.5, { align: "right" });

  currentY += 12;

  // Line items
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);
  doc.setFontSize(8);

  let rowIndex = 0;
  const addServiceRow = (category: string, description: string, amount: number, isCredit: boolean = false) => {
    if (amount === 0) return;
    
    // Alternate row background
    if (rowIndex % 2 === 0) {
      doc.setFillColor(252, 252, 253);
      doc.rect(margin, currentY - 3, contentWidth, 7, "F");
    }
    
    doc.setTextColor(...grayColor);
    doc.setFontSize(7);
    doc.text(category.toUpperCase(), margin + 5, currentY);
    
    doc.setTextColor(...darkColor);
    doc.setFontSize(8);
    doc.text(description, margin + 45, currentY);
    
    doc.setTextColor(isCredit ? 34 : darkColor[0], isCredit ? 197 : darkColor[1], isCredit ? 94 : darkColor[2]);
    doc.text(`${isCredit ? "-" : ""}${amount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
    doc.setTextColor(...darkColor);
    
    currentY += 7;
    rowIndex++;
  };

  // Monthly Services Section
  if (data.servicePlan || data.serviceDescription || subtotal > 0) {
    addServiceRow("Monthly", data.servicePlan || data.serviceDescription || "Telecommunications Services", subtotal);
  }
  if (data.tvBundle) {
    addServiceRow("Monthly", `TV Bundle: ${data.tvBundle}`, 0);
  }
  if (data.mobilePlan) {
    addServiceRow("Monthly", `Mobile Plan: ${data.mobilePlan}`, 0);
  }
  if (data.streamingService) {
    addServiceRow("Monthly", `Streaming: ${data.streamingService}`, 0);
  }
  if (fees > 0) {
    addServiceRow("Monthly", "Additional Service Fees", fees);
  }

  // One-Time Equipment Fees Section
  if (routerFee > 0) {
    const routerDesc = data.routerSerial 
      ? `Nivra Born Wifi Router (S/N: ${data.routerSerial}) — 1-Year Warranty`
      : "Nivra Born Wifi Router — 1-Year Manufacturer Warranty";
    addServiceRow("Equipment", routerDesc, routerFee);
  }
  if (terminalFee > 0) {
    const termCount = data.terminalCount || Math.ceil(terminalFee / 50);
    const termDesc = data.terminalSerials?.length 
      ? `Nivra 4K Smart Terminal ×${termCount} (S/N: ${data.terminalSerials.join(", ")})`
      : `Nivra 4K Smart Terminal ×${termCount} — 1-Year Warranty`;
    addServiceRow("Equipment", termDesc, terminalFee);
  }
  if (simFee > 0) {
    const simTypeLabel = data.simType === "esim" ? "eSIM" : "Physical SIM";
    const simDesc = data.simSerial 
      ? `${simTypeLabel} Card (S/N: ${data.simSerial})`
      : `${simTypeLabel} Card`;
    addServiceRow("Equipment", simDesc, simFee);
  }

  // Delivery Fees Section
  if (deliveryFee > 0) {
    const deliveryDesc = data.deliveryMethod === "uber" 
      ? "Uber Express Delivery (Same-Day)" 
      : data.deliveryMethod === "shipHome"
      ? "Ship to Home Delivery"
      : "Standard Delivery (Québec)";
    addServiceRow("Delivery", deliveryDesc, deliveryFee);
  }
  if (data.trackingNumber) {
    doc.setFontSize(6);
    doc.setTextColor(...lightGray);
    doc.text(`Tracking: ${data.trackingNumber}`, margin + 45, currentY - 2);
    currentY += 3;
  }

  // Installation Fee
  if (installationFee > 0) {
    addServiceRow("Installation", "Professional Technician Installation", installationFee);
  }

  // Activation Fee
  if (activationFee > 0) {
    addServiceRow("Activation", "Service Activation Fee", activationFee);
  }

  // Discounts
  if (totalDiscount > 0) {
    if (preauthDiscount > 0) {
      addServiceRow("Discount", "Pre-Authorization Discount", preauthDiscount, true);
    }
    if (discountAmount > 0) {
      const promoLabel = data.promoCode 
        ? `Promotional Discount (${data.promoCode})` 
        : "Promotional Discount Applied";
      addServiceRow("Discount", promoLabel, discountAmount, true);
    }
  }

  currentY += 5;

  // ============ ONE-TIME FEES SECTION (FRAIS UNIQUES) ============
  const oneTimeFeesTotal = deliveryFee + activationFee + installationFee + terminalFee + routerFee + simFee;
  if (oneTimeFeesTotal > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...accentColor);
    doc.text("ONE-TIME FEES / FRAIS UNIQUES", margin, currentY);

    currentY += 6;
    doc.setDrawColor(...primaryColor);
    doc.line(margin, currentY, margin + 70, currentY);

    currentY += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    
    const addOneTimeFeeRow = (label: string, amount: number) => {
      if (amount <= 0) return;
      doc.text(label, margin, currentY);
      doc.text(`${amount.toFixed(2)} $`, pageWidth - margin - 5, currentY, { align: "right" });
      currentY += 5;
    };
    
    addOneTimeFeeRow("Delivery / Livraison", deliveryFee);
    addOneTimeFeeRow("Activation", activationFee);
    addOneTimeFeeRow("Installation", installationFee);
    addOneTimeFeeRow("Router / Routeur", routerFee);
    addOneTimeFeeRow("TV Terminal", terminalFee);
    addOneTimeFeeRow("SIM Card", simFee);
    
    currentY += 5;
  }

  // ============ BILLING BREAKDOWN SECTION ============
  doc.setDrawColor(...grayColor);
  doc.setLineWidth(0.2);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // Summary rows
  const addSummaryRow = (label: string, value: string, isBold: boolean = false, color?: [number, number, number]) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(...(color || darkColor));
    doc.setFontSize(8);
    doc.text(label, margin + 100, currentY);
    doc.text(value, pageWidth - margin - 5, currentY, { align: "right" });
    currentY += 6;
  };

  addSummaryRow("Subtotal Before Taxes", `${baseAmount.toFixed(2)} $`);
  addSummaryRow(`GST/TPS (5%)`, `${tpsAmount.toFixed(2)} $`);
  addSummaryRow(`QST/TVQ (9.975%)`, `${tvqAmount.toFixed(2)} $`);

  if (lateFeeAmount > 0) {
    addSummaryRow("Late Payment Fee (5%)", `${lateFeeAmount.toFixed(2)} $`, false, [239, 68, 68]);
  }

  if (credits > 0) {
    addSummaryRow("Credits Applied", `-${credits.toFixed(2)} $`, false, [34, 197, 94]);
  }

  currentY += 3;

  // Total box
  doc.setFillColor(...navyColor);
  doc.roundedRect(margin + 90, currentY, contentWidth - 90, 12, 2, 2, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL", margin + 100, currentY + 8);
  doc.setTextColor(...primaryColor);
  doc.text(`${total.toFixed(2)} $ CAD`, pageWidth - margin - 8, currentY + 8, { align: "right" });

  currentY += 20;

  // ============ PAYMENT STATUS SECTION ============
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentColor);
  doc.text("PAYMENT STATUS", margin, currentY);

  currentY += 6;
  doc.setDrawColor(...primaryColor);
  doc.line(margin, currentY, margin + 50, currentY);

  currentY += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkColor);

  doc.text(`Status: ${statusInfo.label}`, margin, currentY);
  if (data.paidAt) {
    doc.text(`Processed: ${format(new Date(data.paidAt), "yyyy-MM-dd HH:mm")}`, margin + 50, currentY);
  }
  currentY += 5;
  doc.text(`Client Balance: ${total.toFixed(2)} $ CAD`, margin, currentY);

  currentY += 10;

  // ============ PAYMENT INFORMATION BOX ============
  // Determine payment method from data
  const isCreditCardPayment = data.paymentMethod === "credit_card" || 
    (data.cardLast4 && data.cardLast4.length === 4) ||
    (data.paymentReference?.toLowerCase().includes("card"));
  
  if (isCreditCardPayment) {
    // Credit card payment - show card info without security answer
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, "F");
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, margin, currentY + 18);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text("Payment Method", margin + 6, currentY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...grayColor);
    
    // Build card display string
    let cardDisplay = "Credit Card";
    if (data.cardType && data.cardLast4) {
      cardDisplay = `${data.cardType} •••• ${data.cardLast4}`;
    } else if (data.cardLast4) {
      cardDisplay = `Card •••• ${data.cardLast4}`;
    } else if (data.paymentReference) {
      cardDisplay = data.paymentReference;
    }
    
    doc.text(`Paid via: ${cardDisplay}`, margin + 6, currentY + 13);

    currentY += 24;
  } else {
    // Interac e-Transfer or pending payment - show transfer instructions
    // DO NOT show security answer on invoices
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, "F");
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, margin, currentY + 22);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text("Payment Instructions — Interac e-Transfer", margin + 6, currentY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Email:", margin + 6, currentY + 14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text("Support@nivratelecom.ca", margin + 22, currentY + 14);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkColor);
    doc.text("Security Q&A: Your full name or company name (exactly as registered)", margin + 6, currentY + 19);

    currentY += 28;
  }

  // ============ LATE PAYMENT POLICY ============
  checkPageBreak(12);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...grayColor);
  doc.text("LATE PAYMENT POLICY", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  currentY += 4;
  doc.text("A late fee of 5% monthly will be applied to any unpaid balance after the due date.", margin, currentY);

  currentY += 8;

  // ============ NOTES ============
  if (data.notes) {
    checkPageBreak(20);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...grayColor);
    doc.text("NOTES:", margin, currentY);
    currentY += 5;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    const maxNoteLines = Math.min(noteLines.length, 3);
    for (let i = 0; i < maxNoteLines; i++) {
      doc.text(noteLines[i], margin, currentY);
      currentY += 4;
    }
    currentY += 4;
  }

  // ============ DISCLAIMER SECTION (before fixed footer) ============
  currentY += 5;
  
  const disclaimerTexts = [
    "Fulfillment and activation timelines apply according to order category. Equipment warranty is manufacturer-based for 12 months from activation.",
    "Loss, theft, or customer damage are excluded unless override is approved internally by Admin. All invoice records, payment references, and equipment assignments are stored in Nivra internal systems and are not shared externally."
  ];
  
  doc.setFont("helvetica", "normal");
  
  for (const disclaimer of disclaimerTexts) {
    addWrappedText(disclaimer, margin, contentWidth, 3.5, 5.5, lightGray);
    currentY += 2;
  }

  // Signature line (if applicable)
  if (data.issuedBy || data.issuedByRole) {
    currentY += 4;
    checkPageBreak(10);
    doc.setFontSize(6);
    doc.setTextColor(...grayColor);
    doc.text("Issued by: ___________________________", margin, currentY);
    doc.text(`Role: ${data.issuedByRole || "Admin/Employee"}`, margin + 60, currentY);
    doc.text(`Timestamp: ${data.issuedAt || format(new Date(), "yyyy-MM-dd HH:mm")}`, margin + 110, currentY);
    currentY += 8;
  }

  // ============ FIXED FOOTER SECTION (always at bottom) ============
  // Draw footer on current page (and all pages if multi-page)
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    
    const footerY = pageHeight - 18;
    
    // Footer divider
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    
    // Bottom accent bar
    doc.setFillColor(...primaryColor);
    doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

    // Business footer text
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    doc.text(`${NIVRA_BUSINESS.name} | NEQ: ${NIVRA_BUSINESS.neq} | ${NIVRA_BUSINESS.address}`, pageWidth / 2, footerY + 8, { align: "center" });
    
    // Page number
    doc.setFontSize(5);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY + 8, { align: "right" });
  }

  return doc;
};

import { safePDFDownload, safePDFOpen } from "./pdfUtils";

export const downloadInvoicePDF = (data: InvoiceData): void => {
  try {
    const doc = generateInvoicePDF(data);
    const blob = doc.output("blob");
    const filename = `Invoice_${data.invoiceNumber}_${data.clientName.replace(/\s+/g, "_")}.pdf`;
    safePDFDownload(blob, filename);
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    throw new Error("Failed to generate invoice PDF");
  }
};

export const viewInvoicePDF = (data: InvoiceData): void => {
  try {
    const doc = generateInvoicePDF(data);
    const blob = doc.output("blob");
    const filename = `Invoice_${data.invoiceNumber}.pdf`;
    safePDFOpen(blob, filename);
  } catch (error) {
    console.error("Error viewing invoice PDF:", error);
    throw new Error("Failed to open invoice PDF");
  }
};

export const getInvoicePDFBlob = (data: InvoiceData): Blob => {
  try {
    const doc = generateInvoicePDF(data);
    return doc.output("blob");
  } catch (error) {
    console.error("Error creating invoice PDF blob:", error);
    throw new Error("Failed to create invoice PDF");
  }
};
