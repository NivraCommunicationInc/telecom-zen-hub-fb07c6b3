/**
 * PDF Helpers - V2.5
 * Utility functions for PDF generation
 * Moved from pdfEngine/ to pdf/ for unified engine
 */

/**
 * Sanitize legal text for PDF rendering
 * Removes control characters and problematic Unicode
 */
export function sanitizeLegalText(text: string | undefined | null): string {
  if (!text) return "";
  
  return text
    // Remove control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Remove problematic Unicode
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format currency for Quebec/Canada
 */
export function formatCurrencyCAD(amount: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount || 0);
}

/**
 * Format date for Quebec locale
 */
export function formatDateFR(dateStr: string | Date | undefined): string {
  if (!dateStr) return "—";
  
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  
  if (isNaN(date.getTime())) return "—";
  
  return date.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format short date YYYY-MM-DD
 */
export function formatDateShort(dateStr: string | Date | undefined): string {
  if (!dateStr) return "—";
  
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  
  if (isNaN(date.getTime())) return "—";
  
  return date.toISOString().split("T")[0];
}

export interface PDFState {
  currentY: number;
  pageNumber: number;
}

export const createPDFState = (): PDFState => ({
  currentY: 15,
  pageNumber: 1,
});
