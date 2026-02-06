/**
 * Nivra Invoice Monthly Template
 * Facture mensuelle prépayée affichée style postpayé
 * 
 * Layout: A4/Letter printable
 * Header: Centered NIVRA COMMUNICATIONS INC.
 * 
 * Variables:
 * - account_number, invoice_number, invoice_date, bill_cycle_date
 * - cycle_start, cycle_end, status, subtotal_before_discounts
 * - total_discounts, subtotal_after_discounts, tax_gst, tax_qst, total_due
 * - payment_reference
 * 
 * Lines: invoice_lines[] with service_type, service_description, service_period,
 *        service_price, service_promo, service_total
 */

import jsPDF from "jspdf";
import type { InvoiceMonthlyData, PDFGenerationResult } from "./types";
import {
  createPDFContext,
  renderCenteredHeader,
  renderClientInfoBlock,
  renderInvoiceInfoBlock,
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
// SERVICE TYPE ICONS (text representation)
// ============================================================================

const SERVICE_TYPE_LABELS: Record<string, string> = {
  Internet: "🌐 Internet",
  TV: "📺 TV",
  Mobile: "📱 Mobile",
  Security: "🔒 Sécurité",
  Streaming: "🎬 Streaming",
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateInvoiceMonthlyPDF(data: InvoiceMonthlyData): PDFGenerationResult {
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
    renderCenteredHeader(ctx, "FACTURE MENSUELLE", `#${data.invoice_number}`);

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
    // INVOICE INFO BLOCK
    // ========================================================================
    renderInvoiceInfoBlock(ctx, {
      invoice_date: data.invoice_date,
      cycle_start: data.cycle_start,
      cycle_end: data.cycle_end,
      status: data.status,
      payment_method: data.payment_method,
      payment_reference: data.payment_reference,
    });

    ctx.currentY += 5;

    // ========================================================================
    // SERVICES SECTION
    // ========================================================================
    if (data.invoice_lines && data.invoice_lines.length > 0) {
      renderSectionHeader(ctx, "Services Souscrits");

      // Table columns
      const columns = [
        { label: "Service", width: 50, align: "left" as const },
        { label: "Description", width: 55, align: "left" as const },
        { label: "Période", width: 35, align: "center" as const },
        { label: "Prix", width: 20, align: "right" as const },
        { label: "Promo", width: 15, align: "center" as const },
        { label: "Total", width: 20, align: "right" as const },
      ];

      renderTableHeader(ctx, columns);

      // Service lines
      data.invoice_lines.forEach((line, index) => {
        const serviceLabel = SERVICE_TYPE_LABELS[line.service_type] || line.service_type;
        
        renderTableRow(
          ctx,
          [
            serviceLabel,
            line.service_description || "",
            line.service_period || "",
            formatCurrency(line.service_price),
            line.service_promo || "—",
            formatCurrency(line.service_total),
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
      
      renderSectionHeader(ctx, "Rabais et Promotions");
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...PDF_COLORS.success);
      doc.text(`Rabais appliqué: -${formatCurrency(data.total_discounts)}`, margin + 5, ctx.currentY + 5);
      
      ctx.currentY += 15;
    }

    // ========================================================================
    // TOTALS SECTION
    // ========================================================================
    ctx.currentY += 5;
    
    const totals = [
      { 
        label: "Sous-total avant rabais:", 
        value: formatCurrency(data.subtotal_before_discounts) 
      },
    ];

    if (data.total_discounts > 0) {
      totals.push({
        label: "Rabais:",
        value: `-${formatCurrency(data.total_discounts)}`,
      });
    }

    totals.push(
      { 
        label: "Sous-total après rabais:", 
        value: formatCurrency(data.subtotal_after_discounts),
        isBold: true,
      } as any,
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
    const filename = `Facture_Mensuelle_${data.invoice_number}_${data.invoice_date.replace(/-/g, "")}.pdf`;

    return {
      success: true,
      blob,
      filename,
    };
  } catch (error) {
    console.error("[InvoiceMonthlyPDF] Generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

// ============================================================================
// CONVENIENCE EXPORT
// ============================================================================

export default generateInvoiceMonthlyPDF;
