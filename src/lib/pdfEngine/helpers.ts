/**
 * Nivra Document Engine - PDF Helpers
 * Reusable functions for PDF generation with proper text wrapping and layout
 */

import jsPDF from "jspdf";
import { PDF_LAYOUT, type ColorKey } from "./types";

const { marginLeft, marginRight, contentWidth, colors, fontSize, lineHeight } = PDF_LAYOUT;

// ============= PAGE MANAGEMENT =============

export interface PDFState {
  doc: jsPDF;
  currentY: number;
  pageNumber: number;
  totalPages?: number;
}

export const getPageHeight = (doc: jsPDF): number => doc.internal.pageSize.getHeight();
export const getPageWidth = (doc: jsPDF): number => doc.internal.pageSize.getWidth();

export const checkPageBreak = (state: PDFState, neededHeight: number): boolean => {
  const pageHeight = getPageHeight(state.doc);
  const bottomMargin = PDF_LAYOUT.marginBottom + 10; // Extra space for footer
  
  if (state.currentY + neededHeight > pageHeight - bottomMargin) {
    return true;
  }
  return false;
};

export const addNewPage = (state: PDFState, addHeader: () => void): void => {
  state.doc.addPage();
  state.pageNumber++;
  state.currentY = PDF_LAYOUT.marginTop + 15;
  addHeader();
};

// ============= COLOR HELPERS =============

export const setColor = (doc: jsPDF, colorKey: ColorKey, type: "text" | "fill" | "draw" = "text"): void => {
  const [r, g, b] = colors[colorKey];
  if (type === "text") {
    doc.setTextColor(r, g, b);
  } else if (type === "fill") {
    doc.setFillColor(r, g, b);
  } else {
    doc.setDrawColor(r, g, b);
  }
};

// ============= TEXT HELPERS =============

/**
 * Safely wraps text to fit within content width
 * Returns the wrapped lines and the height they will occupy
 */
export const wrapText = (
  doc: jsPDF, 
  text: string, 
  maxWidth: number = contentWidth,
  fontSize_: number = fontSize.body
): { lines: string[]; height: number } => {
  doc.setFontSize(fontSize_);
  const lines = doc.splitTextToSize(text, maxWidth);
  const height = lines.length * (fontSize_ * 0.45);
  return { lines, height };
};

/**
 * Adds a paragraph with automatic text wrapping and page break handling
 */
export const addParagraph = (
  state: PDFState,
  text: string,
  options: {
    fontSize?: number;
    color?: ColorKey;
    indent?: number;
    maxWidth?: number;
    addHeader?: () => void;
  } = {}
): void => {
  const {
    fontSize: fs = fontSize.body,
    color = "text",
    indent = 0,
    maxWidth = contentWidth - indent,
    addHeader = () => {},
  } = options;

  const { doc } = state;
  doc.setFontSize(fs);
  doc.setFont("helvetica", "normal");
  setColor(doc, color);

  const { lines, height } = wrapText(doc, text, maxWidth, fs);
  
  // Check if we need a page break
  if (checkPageBreak(state, height + 4)) {
    addNewPage(state, addHeader);
  }

  doc.text(lines, marginLeft + indent, state.currentY);
  state.currentY += height + 3;
};

/**
 * Adds a key-value pair on the same line
 */
export const addLabelValue = (
  state: PDFState,
  label: string,
  value: string,
  options: {
    labelWidth?: number;
    addHeader?: () => void;
  } = {}
): void => {
  const { labelWidth = 55, addHeader = () => {} } = options;
  const { doc } = state;

  if (checkPageBreak(state, 6)) {
    addNewPage(state, addHeader);
  }

  // Label
  doc.setFontSize(fontSize.small);
  doc.setFont("helvetica", "normal");
  setColor(doc, "muted");
  doc.text(label + ":", marginLeft, state.currentY);

  // Value - wrap if too long
  setColor(doc, "text");
  const maxValueWidth = contentWidth - labelWidth - 5;
  const valueText = value || "—";
  
  if (doc.getTextWidth(valueText) > maxValueWidth) {
    const { lines } = wrapText(doc, valueText, maxValueWidth, fontSize.small);
    doc.text(lines, marginLeft + labelWidth, state.currentY);
    state.currentY += lines.length * lineHeight.compact;
  } else {
    doc.text(valueText, marginLeft + labelWidth, state.currentY);
    state.currentY += lineHeight.normal;
  }
};

// ============= SECTION HEADERS =============

/**
 * Adds a section title with divider line - compact spacing
 */
export const addSectionTitle = (
  state: PDFState,
  title: string,
  options: {
    addHeader?: () => void;
  } = {}
): void => {
  const { addHeader = () => {} } = options;
  const { doc } = state;
  const pageWidth = getPageWidth(doc);

  if (checkPageBreak(state, 12)) {
    addNewPage(state, addHeader);
  }

  // Minimal top spacing
  state.currentY += 2;

  // Top divider line
  setColor(doc, "border", "draw");
  doc.setLineWidth(0.4);
  doc.line(marginLeft, state.currentY, pageWidth - marginRight, state.currentY);
  state.currentY += 4;

  // Section title
  doc.setFontSize(fontSize.sectionTitle);
  doc.setFont("helvetica", "bold");
  setColor(doc, "primary");
  doc.text(title.toUpperCase(), marginLeft, state.currentY);
  state.currentY += 2;

  // Bottom divider line
  setColor(doc, "border", "draw");
  doc.line(marginLeft, state.currentY, pageWidth - marginRight, state.currentY);
  state.currentY += 4;
};

/**
 * Adds a sub-section header (no divider)
 */
export const addSubHeader = (
  state: PDFState,
  text: string,
  options: { addHeader?: () => void } = {}
): void => {
  const { addHeader = () => {} } = options;
  const { doc } = state;

  if (checkPageBreak(state, 8)) {
    addNewPage(state, addHeader);
  }

  state.currentY += 2;
  doc.setFontSize(fontSize.small);
  doc.setFont("helvetica", "bold");
  setColor(doc, "primary");
  doc.text(text, marginLeft, state.currentY);
  state.currentY += 5;
};

// ============= TABLE HELPERS =============

/**
 * Adds a table header row
 */
export const addTableHeader = (
  state: PDFState,
  columns: string[],
  widths: number[],
  options: { addHeader?: () => void } = {}
): void => {
  const { addHeader = () => {} } = options;
  const { doc } = state;
  const rowHeight = 6;

  if (checkPageBreak(state, rowHeight + 4)) {
    addNewPage(state, addHeader);
  }

  // Background
  setColor(doc, "primary", "fill");
  doc.rect(marginLeft, state.currentY - 4, contentWidth, rowHeight, "F");

  // Text
  doc.setFontSize(fontSize.tiny);
  doc.setFont("helvetica", "bold");
  setColor(doc, "white");

  let xPos = marginLeft + 3;
  columns.forEach((col, i) => {
    // Truncate if needed
    const maxChars = Math.floor((widths[i] - 4) / 2);
    const text = col.length > maxChars ? col.substring(0, maxChars - 1) + "…" : col;
    doc.text(text, xPos, state.currentY);
    xPos += widths[i];
  });

  state.currentY += rowHeight;
};

/**
 * Adds a table data row with alternating background and auto text wrapping
 */
export const addTableRow = (
  state: PDFState,
  columns: string[],
  widths: number[],
  rowIndex: number,
  options: { 
    addHeader?: () => void;
    rightAlignLast?: boolean;
  } = {}
): void => {
  const { addHeader = () => {}, rightAlignLast = false } = options;
  const { doc } = state;
  
  // Calculate actual row height based on content wrapping
  let maxLines = 1;
  const wrappedColumns: string[][] = [];
  
  columns.forEach((col, i) => {
    const maxWidth = widths[i] - 6;
    doc.setFontSize(fontSize.tiny);
    const wrapped = doc.splitTextToSize(col, maxWidth);
    wrappedColumns.push(wrapped);
    maxLines = Math.max(maxLines, wrapped.length);
  });
  
  const lineHeight = 4;
  const rowHeight = Math.max(5, maxLines * lineHeight + 1);

  if (checkPageBreak(state, rowHeight + 2)) {
    addNewPage(state, addHeader);
  }

  // Alternating background
  if (rowIndex % 2 === 0) {
    setColor(doc, "background", "fill");
    doc.rect(marginLeft, state.currentY - 3.5, contentWidth, rowHeight, "F");
  }

  doc.setFontSize(fontSize.tiny);
  doc.setFont("helvetica", "normal");
  setColor(doc, "text");

  let xPos = marginLeft + 3;
  wrappedColumns.forEach((lines, i) => {
    const isLast = i === columns.length - 1;
    
    if (rightAlignLast && isLast) {
      // For right-aligned, only show first line to prevent overlap
      doc.text(lines[0] || "", marginLeft + contentWidth - 3, state.currentY, { align: "right" });
    } else {
      // Multi-line support
      lines.forEach((line, lineIdx) => {
        doc.text(line, xPos, state.currentY + (lineIdx * lineHeight));
      });
    }
    xPos += widths[i];
  });

  state.currentY += rowHeight;
};

// ============= SPECIAL ELEMENTS =============

/**
 * Adds a highlighted info box
 */
export const addInfoBox = (
  state: PDFState,
  lines: string[],
  options: {
    addHeader?: () => void;
    bgColor?: ColorKey;
    accentColor?: ColorKey;
    height?: number;
  } = {}
): void => {
  const { 
    addHeader = () => {}, 
    bgColor = "background",
    accentColor = "accent",
    height = lines.length * 5 + 8,
  } = options;
  const { doc } = state;
  const pageWidth = getPageWidth(doc);

  if (checkPageBreak(state, height + 4)) {
    addNewPage(state, addHeader);
  }

  // Background box
  setColor(doc, bgColor, "fill");
  setColor(doc, "border", "draw");
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, state.currentY, contentWidth, height, 2, 2, "FD");

  // Accent line on left
  setColor(doc, accentColor, "draw");
  doc.setLineWidth(1.5);
  doc.line(marginLeft, state.currentY + 2, marginLeft, state.currentY + height - 2);

  // Content
  doc.setFontSize(fontSize.small);
  setColor(doc, "text");
  doc.setFont("helvetica", "normal");
  
  let textY = state.currentY + 6;
  lines.forEach(line => {
    doc.text(line, marginLeft + 6, textY);
    textY += 5;
  });

  state.currentY += height + 4;
};

/**
 * Adds a total box (highlighted amount)
 */
export const addTotalBox = (
  state: PDFState,
  label: string,
  amount: string,
  options: { addHeader?: () => void } = {}
): void => {
  const { addHeader = () => {} } = options;
  const { doc } = state;

  if (checkPageBreak(state, 14)) {
    addNewPage(state, addHeader);
  }

  state.currentY += 2;

  // Box background
  setColor(doc, "primary", "fill");
  doc.roundedRect(marginLeft + 60, state.currentY - 2, contentWidth - 60, 12, 2, 2, "F");

  // Label
  doc.setFontSize(fontSize.sectionTitle);
  doc.setFont("helvetica", "bold");
  setColor(doc, "white");
  doc.text(label, marginLeft + 68, state.currentY + 5);

  // Amount
  setColor(doc, "accent");
  doc.text(amount, marginLeft + contentWidth - 8, state.currentY + 5, { align: "right" });

  state.currentY += 16;
};

// ============= HEADER & FOOTER =============

/**
 * Adds the document header (top of page 1)
 */
export const addDocumentHeader = (
  state: PDFState,
  companyName: string,
  documentTitle: string,
  subtitle?: string
): void => {
  const { doc } = state;
  const pageWidth = getPageWidth(doc);

  // Top accent stripe
  setColor(doc, "accent", "fill");
  doc.rect(0, 0, pageWidth, 3, "F");

  // Navy header band
  setColor(doc, "primary", "fill");
  doc.rect(0, 3, pageWidth, 26, "F");

  // Company name
  doc.setFontSize(fontSize.title);
  doc.setFont("helvetica", "bold");
  setColor(doc, "white");
  doc.text(companyName.toUpperCase(), pageWidth / 2, 14, { align: "center" });

  // Document title
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setColor(doc, "accent");
  doc.text(documentTitle, pageWidth / 2, 22, { align: "center" });

  if (subtitle) {
    doc.setFontSize(7);
    setColor(doc, "white");
    doc.text(subtitle, pageWidth / 2, 27, { align: "center" });
  }

  state.currentY = 36;
};

/**
 * Adds a compact header for subsequent pages
 */
export const addPageHeaderCompact = (
  state: PDFState,
  companyName: string,
  docRef: string
): void => {
  const { doc } = state;
  const pageWidth = getPageWidth(doc);

  setColor(doc, "accent", "fill");
  doc.rect(0, 0, pageWidth, 2, "F");

  setColor(doc, "primary", "fill");
  doc.rect(0, 2, pageWidth, 10, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  setColor(doc, "white");
  doc.text(companyName.toUpperCase(), marginLeft, 9);

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(docRef, pageWidth - marginRight, 9, { align: "right" });

  state.currentY = 18;
};

/**
 * Adds the document footer
 */
export const addDocumentFooter = (
  state: PDFState,
  footerText: string
): void => {
  const { doc, pageNumber } = state;
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);

  // Divider line
  setColor(doc, "border", "draw");
  doc.setLineWidth(0.3);
  doc.line(marginLeft, pageHeight - 16, pageWidth - marginRight, pageHeight - 16);

  // Footer text
  doc.setFontSize(5);
  setColor(doc, "muted");
  doc.text(footerText, pageWidth / 2, pageHeight - 11, { align: "center" });

  // Page number
  doc.setFont("helvetica", "bold");
  doc.text(`Page ${pageNumber}`, pageWidth - marginRight, pageHeight - 6, { align: "right" });
};

// ============= FORMATTING HELPERS =============

export const formatCurrency = (amount: number): string => {
  return `${amount.toFixed(2)} $`;
};

export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};
