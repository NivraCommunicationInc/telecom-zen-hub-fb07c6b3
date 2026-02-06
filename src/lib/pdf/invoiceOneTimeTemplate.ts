/**
 * Nivra Invoice One-Time Template
 * Facture pour équipements et frais ponctuels
 * 
 * Layout: A4/Letter printable
 * Header: Centered NIVRA COMMUNICATIONS INC.
 * 
 * Variables:
 * - account_number, invoice_number, invoice_date, status
 * - subtotal_before_discounts, total_discounts, subtotal_after_discounts
 * - tax_gst, tax_qst, total_due, payment_reference
 * 
 * Items: items[] with item_name, item_description, qty, unit_price, 
 *        line_total, serial_number
 */

import jsPDF from "jspdf";
import type { InvoiceOneTimeData, PDFGenerationResult } from "./types";
import {
  createPDFContext,
  renderCenteredHeader,
  renderClientInfoBlock,
  renderSectionHeader,
  renderTableHeader,
  renderTableRow,
  renderTotalsSection,
  renderLegalFooter,
  formatCurrency,
  formatDate,
  checkPageBreak,
  PDF_COLORS,
} from "./pdfHelpers";

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateInvoiceOneTimePDF(data: InvoiceOneTimeData): PDFGenerationResult {
  try {
    // Validate required fields
    if (!data.invoice_number) {
      return { success: false, error: "Numéro de facture manquant" };
    }
    if (!data.client_name || !data.client_email) {
      return { success: false, error: "Informations client incomplètes" };
    }

    const ctx = createPDFContext();
    const { doc, margin, contentWidth } = ctx;

    // ========================================================================
    // HEADER
    // ========================================================================
    renderCenteredHeader(ctx, "FACTURE", `#${data.invoice_number}`);

    // ========================================================================
    // CLIENT INFO BLOCK
    // ========================================================================
    renderClientInfoBlock(ctx, {
      name: data.client_name,
      email: data.client_email,
      phone: data.client_phone,
      address: data.client_address,
      account_number: data.account_number,
    });

    ctx.currentY += 5;

    // ========================================================================
    // INVOICE INFO
    // ========================================================================
    checkPageBreak(ctx, 20);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text("Date de facture:", margin, ctx.currentY + 5);
    
    if (data.order_number) {
      doc.text("Commande liée:", margin + 80, ctx.currentY + 5);
    }
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(formatDate(data.invoice_date), margin + 35, ctx.currentY + 5);
    
    if (data.order_number) {
      doc.text(`#${data.order_number}`, margin + 110, ctx.currentY + 5);
    }
    
    // Status badge
    const statusX = contentWidth - 25;
    renderStatusBadge(ctx, data.status, margin + statusX, ctx.currentY + 1);
    
    ctx.currentY += 15;

    // ========================================================================
    // ITEMS SECTION
    // ========================================================================
    if (data.items && data.items.length > 0) {
      renderSectionHeader(ctx, "Équipements et Frais");

      // Table columns
      const columns = [
        { label: "Article", width: 50, align: "left" as const },
        { label: "Description", width: 45, align: "left" as const },
        { label: "Qté", width: 15, align: "center" as const },
        { label: "Prix unit.", width: 25, align: "right" as const },
        { label: "Total", width: 25, align: "right" as const },
        { label: "N° Série", width: 35, align: "left" as const },
      ];

      renderTableHeader(ctx, columns);

      // Item lines
      data.items.forEach((item, index) => {
        renderTableRow(
          ctx,
          [
            item.item_name,
            item.item_description || "",
            String(item.qty),
            formatCurrency(item.unit_price),
            formatCurrency(item.line_total),
            item.serial_number || "—",
          ],
          columns.map(c => ({ width: c.width, align: c.align })),
          index % 2 === 1
        );
      });

      ctx.currentY += 5;
    }

    // ========================================================================
    // DISCOUNTS SECTION (if applicable)
    // ========================================================================
    if (data.total_discounts > 0) {
      checkPageBreak(ctx, 25);
      
      renderSectionHeader(ctx, "Rabais Appliqués");
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...PDF_COLORS.success);
      doc.text(`Rabais total: -${formatCurrency(data.total_discounts)}`, margin + 5, ctx.currentY + 5);
      
      ctx.currentY += 15;
    }

    // ========================================================================
    // TOTALS SECTION
    // ========================================================================
    ctx.currentY += 5;
    
    const totals = [
      { 
        label: "Sous-total:", 
        value: formatCurrency(data.subtotal_before_discounts) 
      },
    ];

    if (data.total_discounts > 0) {
      totals.push({
        label: "Rabais:",
        value: `-${formatCurrency(data.total_discounts)}`,
      });
      totals.push({
        label: "Sous-total après rabais:",
        value: formatCurrency(data.subtotal_after_discounts),
        isBold: true,
      } as any);
    }

    totals.push(
      { 
        label: "TPS (5%):", 
        value: formatCurrency(data.tax_gst) 
      },
      { 
        label: "TVQ (9.975%):", 
        value: formatCurrency(data.tax_qst) 
      },
      { 
        label: "TOTAL À PAYER:", 
        value: formatCurrency(data.total_due),
        isHighlight: true,
      } as any
    );

    renderTotalsSection(ctx, totals);

    // ========================================================================
    // PAYMENT INFO (if paid)
    // ========================================================================
    if (data.status === "paid" && data.paid_at) {
      ctx.currentY += 10;
      checkPageBreak(ctx, 20);
      
      doc.setFillColor(240, 253, 244);
      doc.rect(margin, ctx.currentY, contentWidth, 15, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...PDF_COLORS.success);
      doc.text("✓ FACTURE PAYÉE", margin + 5, ctx.currentY + 7);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.gray);
      doc.text(`Paiement reçu le ${formatDate(data.paid_at)}`, margin + 5, ctx.currentY + 12);
      
      if (data.payment_reference) {
        doc.text(`Référence: ${data.payment_reference}`, margin + 80, ctx.currentY + 12);
      }
      
      ctx.currentY += 20;
    }

    // ========================================================================
    // NOTES
    // ========================================================================
    if (data.notes) {
      ctx.currentY += 10;
      checkPageBreak(ctx, 20);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.gray);
      doc.text("Notes:", margin, ctx.currentY);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_COLORS.dark);
      const noteLines = doc.splitTextToSize(data.notes, contentWidth);
      doc.text(noteLines, margin, ctx.currentY + 5);
      ctx.currentY += 5 + noteLines.length * 4;
    }

    // ========================================================================
    // LEGAL FOOTER
    // ========================================================================
    renderLegalFooter(ctx);

    // ========================================================================
    // GENERATE BLOB
    // ========================================================================
    const blob = doc.output("blob");
    const filename = `Facture_${data.invoice_number}_${data.invoice_date.replace(/-/g, "")}.pdf`;

    return {
      success: true,
      blob,
      filename,
    };
  } catch (error) {
    console.error("[InvoiceOneTimePDF] Generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

// ============================================================================
// HELPER - Status Badge (imported from pdfHelpers but needed locally)
// ============================================================================

function renderStatusBadge(
  ctx: { doc: jsPDF },
  status: string,
  x: number,
  y: number
): void {
  const { doc } = ctx;
  
  const statusConfig: Record<string, { bg: [number, number, number]; text: string }> = {
    paid: { bg: PDF_COLORS.success, text: "PAYÉE" },
    pending: { bg: PDF_COLORS.warning, text: "EN ATTENTE" },
    overdue: { bg: PDF_COLORS.error, text: "EN RETARD" },
    cancelled: { bg: PDF_COLORS.gray, text: "ANNULÉE" },
  };
  
  const config = statusConfig[status] || { bg: PDF_COLORS.gray, text: status.toUpperCase() };
  
  doc.setFillColor(...config.bg);
  doc.roundedRect(x, y, 25, 6, 1, 1, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(config.text, x + 12.5, y + 4.3, { align: "center" });
}

// ============================================================================
// CONVENIENCE EXPORT
// ============================================================================

export default generateInvoiceOneTimePDF;
