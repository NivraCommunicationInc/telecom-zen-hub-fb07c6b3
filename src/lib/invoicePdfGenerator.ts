/**
 * Invoice PDF Generator - Deprecated Stub
 * 
 * @deprecated This module has been replaced by the unified engine.
 * Use generateInvoicePDF from @/lib/pdf/invoiceEngine instead.
 */

import jsPDF from "jspdf";

export interface InvoiceData {
  invoiceNumber: string;
  [key: string]: any;
}

/**
 * @deprecated Use generateInvoicePDF from @/lib/pdf/invoiceEngine
 */
export function generateInvoicePDF(data: InvoiceData): jsPDF {
  console.warn("[DEPRECATED] generateInvoicePDF from invoicePdfGenerator - use @/lib/pdf/invoiceEngine instead");
  
  // Return a minimal jsPDF document for backward compatibility
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text("Document généré par le système legacy", 20, 20);
  doc.text(`Facture: ${data.invoiceNumber || "N/A"}`, 20, 35);
  doc.text("Veuillez utiliser le nouveau moteur unifié.", 20, 50);
  
  return doc;
}
