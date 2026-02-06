/**
 * Nivra PDF Templates - Shared Helpers
 * Common utilities for PDF generation
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { NIVRA_HEADER, PREPAID_LEGAL_FOOTER, type CompanyHeaderInfo } from "./types";

// ============================================================================
// COLORS
// ============================================================================

export const PDF_COLORS = {
  navy: [15, 23, 42] as [number, number, number],      // #0F172A
  teal: [20, 184, 166] as [number, number, number],    // #14B8A6
  dark: [30, 30, 30] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  lightGray: [150, 150, 150] as [number, number, number],
  veryLightGray: [240, 240, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  error: [239, 68, 68] as [number, number, number],
};

// ============================================================================
// PAGE DIMENSIONS
// ============================================================================

export const PAGE_CONFIG = {
  margin: 15,
  topMargin: 15,
  bottomMargin: 55,  // Increased to prevent content overlapping footer
  headerHeight: 45,
  footerHeight: 35,
};

// ============================================================================
// FORMATTERS
// ============================================================================

export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) return "0,00 $";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

export const formatShortDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
};

// ============================================================================
// PDF HELPERS
// ============================================================================

export interface PDFContext {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  currentY: number;
}

export const createPDFContext = (): PDFContext => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  return {
    doc,
    pageWidth,
    pageHeight,
    margin: PAGE_CONFIG.margin,
    contentWidth: pageWidth - PAGE_CONFIG.margin * 2,
    currentY: PAGE_CONFIG.margin,
  };
};

export const checkPageBreak = (ctx: PDFContext, neededHeight: number): boolean => {
  if (ctx.currentY + neededHeight > ctx.pageHeight - PAGE_CONFIG.bottomMargin) {
    ctx.doc.addPage();
    ctx.currentY = PAGE_CONFIG.topMargin;
    return true;
  }
  return false;
};

// ============================================================================
// HEADER RENDERER - Centered Nivra Header
// ============================================================================

export const renderCenteredHeader = (
  ctx: PDFContext,
  documentTitle: string,
  documentNumber: string,
  headerInfo: CompanyHeaderInfo = NIVRA_HEADER
): void => {
  const { doc, pageWidth, margin } = ctx;
  const centerX = pageWidth / 2;
  
  // Navy background header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, pageWidth, PAGE_CONFIG.headerHeight, "F");
  
  // Teal accent line
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(0, PAGE_CONFIG.headerHeight, pageWidth, 3, "F");
  
  // Company name - centered
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(headerInfo.name, centerX, 15, { align: "center" });
  
  // Division
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(headerInfo.division, centerX, 22, { align: "center" });
  
  // Province
  doc.setFontSize(9);
  doc.text(headerInfo.province, centerX, 28, { align: "center" });
  
  // Address
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(headerInfo.address, centerX, 34, { align: "center" });
  
  // Email
  doc.setTextColor(...PDF_COLORS.teal);
  doc.text(headerInfo.email, centerX, 40, { align: "center" });
  
  // Document title and number - right side
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(documentTitle, pageWidth - margin, 15, { align: "right" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(documentNumber, pageWidth - margin, 22, { align: "right" });
  
  ctx.currentY = PAGE_CONFIG.headerHeight + 10;
};

// ============================================================================
// SECTION HEADER
// ============================================================================

export const renderSectionHeader = (
  ctx: PDFContext,
  title: string,
  icon?: string
): void => {
  const { doc, margin, contentWidth } = ctx;
  
  checkPageBreak(ctx, 15);
  
  // Section background
  doc.setFillColor(...PDF_COLORS.veryLightGray);
  doc.rect(margin, ctx.currentY, contentWidth, 8, "F");
  
  // Teal left border
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, ctx.currentY, 3, 8, "F");
  
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text(title.toUpperCase(), margin + 6, ctx.currentY + 5.5);
  
  ctx.currentY += 12;
};

// ============================================================================
// TABLE HEADER
// ============================================================================

export const renderTableHeader = (
  ctx: PDFContext,
  columns: { label: string; width: number; align?: "left" | "center" | "right" }[]
): void => {
  const { doc, margin } = ctx;
  
  checkPageBreak(ctx, 10);
  
  // Header background
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(margin, ctx.currentY, ctx.contentWidth, 7, "F");
  
  // Column headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.white);
  
  let x = margin + 2;
  for (const col of columns) {
    const textX = col.align === "right" ? x + col.width - 2 : 
                  col.align === "center" ? x + col.width / 2 : x;
    const align = col.align || "left";
    doc.text(col.label, textX, ctx.currentY + 5, { align });
    x += col.width;
  }
  
  ctx.currentY += 9;
};

// ============================================================================
// TABLE ROW
// ============================================================================

export const renderTableRow = (
  ctx: PDFContext,
  values: string[],
  columns: { width: number; align?: "left" | "center" | "right" }[],
  isAlternate: boolean = false
): void => {
  const { doc, margin } = ctx;
  
  checkPageBreak(ctx, 8);
  
  // Alternate row background
  if (isAlternate) {
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, ctx.currentY - 1, ctx.contentWidth, 7, "F");
  }
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.dark);
  
  let x = margin + 2;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const value = values[i] || "";
    const textX = col.align === "right" ? x + col.width - 2 : 
                  col.align === "center" ? x + col.width / 2 : x;
    const align = col.align || "left";
    doc.text(value, textX, ctx.currentY + 4, { align });
    x += col.width;
  }
  
  ctx.currentY += 7;
};

// ============================================================================
// TOTALS SECTION
// ============================================================================

export const renderTotalsSection = (
  ctx: PDFContext,
  totals: { label: string; value: string; isBold?: boolean; isHighlight?: boolean }[]
): void => {
  const { doc, margin, contentWidth } = ctx;
  
  // Calculate total height needed for all rows + extra safety margin for footer
  const totalHeight = totals.reduce((sum, row) => sum + (row.isHighlight ? 10 : 7), 0) + 20;
  
  // Force page break if totals section would overlap with footer
  checkPageBreak(ctx, totalHeight);
  
  const totalsWidth = 120;
  const startX = margin + contentWidth - totalsWidth;
  
  for (const row of totals) {
    // Check each row individually to prevent overflow
    checkPageBreak(ctx, row.isHighlight ? 12 : 9);
    
    if (row.isHighlight) {
      doc.setFillColor(...PDF_COLORS.navy);
      doc.rect(startX, ctx.currentY - 1, totalsWidth, 8, "F");
      doc.setTextColor(...PDF_COLORS.white);
    } else {
      doc.setTextColor(...PDF_COLORS.dark);
    }
    
    doc.setFont("helvetica", row.isBold || row.isHighlight ? "bold" : "normal");
    doc.setFontSize(row.isHighlight ? 10 : 9);
    
    doc.text(row.label, startX + 2, ctx.currentY + 5);
    doc.text(row.value, startX + totalsWidth - 2, ctx.currentY + 5, { align: "right" });
    
    ctx.currentY += row.isHighlight ? 10 : 7;
  }
};

// ============================================================================
// STATUS BADGE
// ============================================================================

export const renderStatusBadge = (
  ctx: PDFContext,
  status: string,
  x: number,
  y: number
): void => {
  const { doc } = ctx;
  
  const statusConfig: Record<string, { bg: [number, number, number]; text: string }> = {
    paid: { bg: PDF_COLORS.success, text: "PAYÉE" },
    pending: { bg: PDF_COLORS.warning, text: "EN ATTENTE" },
    overdue: { bg: PDF_COLORS.error, text: "EN RETARD" },
    cancelled: { bg: PDF_COLORS.gray, text: "ANNULÉE" },
    processing: { bg: PDF_COLORS.teal, text: "EN COURS" },
  };
  
  const config = statusConfig[status] || { bg: PDF_COLORS.gray, text: status.toUpperCase() };
  
  doc.setFillColor(...config.bg);
  doc.roundedRect(x, y, 25, 6, 1, 1, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(config.text, x + 12.5, y + 4.3, { align: "center" });
};

// ============================================================================
// LEGAL FOOTER
// ============================================================================

export const renderLegalFooter = (ctx: PDFContext): void => {
  const { doc, pageWidth, margin, contentWidth, pageHeight } = ctx;
  
  // Add new page if not enough space
  if (ctx.currentY > pageHeight - 60) {
    doc.addPage();
    ctx.currentY = PAGE_CONFIG.topMargin;
  }
  
  const footerY = pageHeight - PAGE_CONFIG.footerHeight;
  
  // Separator line
  doc.setDrawColor(...PDF_COLORS.lightGray);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  // Legal text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...PDF_COLORS.lightGray);
  
  const lines = PREPAID_LEGAL_FOOTER.split("\n");
  let lineY = footerY;
  
  for (const line of lines) {
    if (line.trim()) {
      const wrappedLines = doc.splitTextToSize(line, contentWidth);
      for (const wl of wrappedLines) {
        doc.text(wl, margin, lineY);
        lineY += 3.5;
      }
    } else {
      lineY += 2;
    }
  }
};

// ============================================================================
// CLIENT INFO BLOCK
// ============================================================================

export const renderClientInfoBlock = (
  ctx: PDFContext,
  client: {
    name: string;
    email: string;
    phone?: string;
    address: string;
    account_number: string;
  }
): void => {
  const { doc, margin } = ctx;
  
  checkPageBreak(ctx, 35);
  
  // Box
  doc.setDrawColor(...PDF_COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.rect(margin, ctx.currentY, 90, 30);
  
  // Teal accent
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, ctx.currentY, 3, 30, "F");
  
  // Content
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("FACTURÉ À", margin + 6, ctx.currentY + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(client.name, margin + 6, ctx.currentY + 12);
  doc.text(client.email, margin + 6, ctx.currentY + 17);
  if (client.phone) {
    doc.text(client.phone, margin + 6, ctx.currentY + 22);
  }
  
  // Address (wrapped)
  const addressLines = doc.splitTextToSize(client.address, 75);
  let addrY = client.phone ? ctx.currentY + 27 : ctx.currentY + 22;
  for (const line of addressLines.slice(0, 2)) {
    doc.text(line, margin + 6, addrY);
    addrY += 4;
  }
  
  // Account number on the right
  const rightX = margin + 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("NUMÉRO DE COMPTE", rightX, ctx.currentY + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(client.account_number, rightX, ctx.currentY + 12);
  
  ctx.currentY += 35;
};

// ============================================================================
// INVOICE INFO BLOCK
// ============================================================================

export const renderInvoiceInfoBlock = (
  ctx: PDFContext,
  info: {
    invoice_date: string;
    due_date?: string;
    cycle_start: string;
    cycle_end: string;
    status: string;
    payment_method?: string | null;
    payment_reference?: string | null;
  }
): void => {
  const { doc, margin, contentWidth } = ctx;
  
  checkPageBreak(ctx, 25);
  
  const rightX = margin + contentWidth - 90;
  
  // Left side - Dates
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text("Date de facture:", margin, ctx.currentY + 5);
  doc.text("Période de service:", margin, ctx.currentY + 11);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(formatDate(info.invoice_date), margin + 35, ctx.currentY + 5);
  doc.text(`${formatShortDate(info.cycle_start)} au ${formatShortDate(info.cycle_end)}`, margin + 40, ctx.currentY + 11);
  
  // Right side - Status and Payment
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text("Statut:", rightX, ctx.currentY + 5);
  
  renderStatusBadge(ctx, info.status, rightX + 15, ctx.currentY + 1);
  
  if (info.payment_method) {
    doc.text("Paiement:", rightX, ctx.currentY + 11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(info.payment_method.toUpperCase(), rightX + 20, ctx.currentY + 11);
  }
  
  if (info.payment_reference) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text(`Réf: ${info.payment_reference}`, rightX, ctx.currentY + 17);
  }
  
  ctx.currentY += 25;
};
