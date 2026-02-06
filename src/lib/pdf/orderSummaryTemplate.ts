/**
 * Nivra Order Summary Template
 * Résumé de commande envoyé après paiement confirmé
 * 
 * Layout: A4/Letter printable
 * Header: Centered NIVRA COMMUNICATIONS INC.
 * 
 * Variables:
 * - order_number, order_date, account_number
 * - client info, service address, billing address
 * - subtotal_services, subtotal_equipment, total_discounts
 * - subtotal_before_tax, tax_gst, tax_qst, total_due
 * - payment_status, payment_method, payment_reference
 * 
 * Services: services[] (InvoiceLine)
 * Items: items[] (OneTimeItem)
 */

import jsPDF from "jspdf";
import type { OrderSummaryData, PDFGenerationResult } from "./types";
import {
  createPDFContext,
  renderCenteredHeader,
  renderSectionHeader,
  renderTableHeader,
  renderTableRow,
  renderTotalsSection,
  renderLegalFooter,
  formatCurrency,
  formatDate,
  formatShortDate,
  checkPageBreak,
  PDF_COLORS,
} from "./pdfHelpers";

// ============================================================================
// SERVICE TYPE LABELS
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

export function generateOrderSummaryPDF(data: OrderSummaryData): PDFGenerationResult {
  try {
    // Validate required fields
    if (!data.order_number) {
      return { success: false, error: "Numéro de commande manquant" };
    }
    if (!data.client_name || !data.client_email) {
      return { success: false, error: "Informations client incomplètes" };
    }

    const ctx = createPDFContext();
    const { doc, margin, contentWidth } = ctx;

    // ========================================================================
    // HEADER
    // ========================================================================
    renderCenteredHeader(ctx, "RÉSUMÉ DE COMMANDE", `#${data.order_number}`);

    // ========================================================================
    // ORDER STATUS BANNER
    // ========================================================================
    if (data.payment_status === "paid") {
      doc.setFillColor(240, 253, 244);
      doc.rect(margin, ctx.currentY, contentWidth, 12, "F");
      
      doc.setFillColor(...PDF_COLORS.success);
      doc.rect(margin, ctx.currentY, 4, 12, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...PDF_COLORS.success);
      doc.text("✓ COMMANDE CONFIRMÉE", margin + 8, ctx.currentY + 8);
      
      if (data.paid_at) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.gray);
        doc.text(`Paiement reçu le ${formatDate(data.paid_at)}`, margin + 80, ctx.currentY + 8);
      }
      
      ctx.currentY += 18;
    } else {
      ctx.currentY += 5;
    }

    // ========================================================================
    // CLIENT & ORDER INFO
    // ========================================================================
    checkPageBreak(ctx, 50);
    
    // Left column - Client info
    doc.setDrawColor(...PDF_COLORS.lightGray);
    doc.setLineWidth(0.3);
    doc.rect(margin, ctx.currentY, 90, 40);
    
    doc.setFillColor(...PDF_COLORS.teal);
    doc.rect(margin, ctx.currentY, 3, 40, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text("CLIENT", margin + 6, ctx.currentY + 6);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(data.client_name, margin + 6, ctx.currentY + 12);
    doc.text(data.client_email, margin + 6, ctx.currentY + 17);
    if (data.client_phone) {
      doc.text(data.client_phone, margin + 6, ctx.currentY + 22);
    }
    
    // Address
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text("Adresse de service:", margin + 6, ctx.currentY + 29);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.dark);
    const addrLines = doc.splitTextToSize(data.service_address, 75);
    doc.text(addrLines.slice(0, 2), margin + 6, ctx.currentY + 34);
    
    // Right column - Order info
    const rightX = margin + 100;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text("DÉTAILS DE COMMANDE", rightX, ctx.currentY + 6);
    
    const orderInfo = [
      { label: "Numéro de compte:", value: data.account_number },
      { label: "Date de commande:", value: formatDate(data.order_date) },
      { label: "Méthode de paiement:", value: data.payment_method?.toUpperCase() || "—" },
    ];
    
    if (data.payment_reference) {
      orderInfo.push({ label: "Référence:", value: data.payment_reference });
    }
    
    let infoY = ctx.currentY + 12;
    for (const info of orderInfo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.gray);
      doc.text(info.label, rightX, infoY);
      
      doc.setTextColor(...PDF_COLORS.dark);
      doc.text(info.value, rightX + 35, infoY);
      infoY += 5;
    }
    
    // Promo code if applicable
    if (data.promo_code) {
      infoY += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.success);
      doc.text(`Promo: ${data.promo_code}`, rightX, infoY);
      if (data.promo_description) {
        doc.setFont("helvetica", "normal");
        doc.text(data.promo_description, rightX + 25, infoY);
      }
    }
    
    ctx.currentY += 48;

    // ========================================================================
    // SERVICES SECTION (only if subscribed)
    // ========================================================================
    if (data.services && data.services.length > 0) {
      renderSectionHeader(ctx, "Services Souscrits (Récurrents)");

      const columns = [
        { label: "Service", width: 45, align: "left" as const },
        { label: "Description", width: 60, align: "left" as const },
        { label: "Période", width: 35, align: "center" as const },
        { label: "Mensuel", width: 25, align: "right" as const },
      ];

      renderTableHeader(ctx, columns);

      data.services.forEach((service, index) => {
        const serviceLabel = SERVICE_TYPE_LABELS[service.service_type] || service.service_type;
        
        renderTableRow(
          ctx,
          [
            serviceLabel,
            service.service_description || "",
            service.service_period || "/mois",
            formatCurrency(service.service_total),
          ],
          columns.map(c => ({ width: c.width, align: c.align })),
          index % 2 === 1
        );
      });

      ctx.currentY += 5;
    }

    // ========================================================================
    // EQUIPMENT SECTION (only if items exist)
    // ========================================================================
    if (data.items && data.items.length > 0) {
      renderSectionHeader(ctx, "Équipements et Frais Ponctuels");

      const columns = [
        { label: "Article", width: 50, align: "left" as const },
        { label: "Description", width: 45, align: "left" as const },
        { label: "Qté", width: 15, align: "center" as const },
        { label: "Prix unit.", width: 25, align: "right" as const },
        { label: "Total", width: 25, align: "right" as const },
      ];

      renderTableHeader(ctx, columns);

      data.items.forEach((item, index) => {
        renderTableRow(
          ctx,
          [
            item.item_name,
            item.item_description || "",
            String(item.qty),
            formatCurrency(item.unit_price),
            formatCurrency(item.line_total),
          ],
          columns.map(c => ({ width: c.width, align: c.align })),
          index % 2 === 1
        );
        
        // Serial number on separate line if present
        if (item.serial_number) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(...PDF_COLORS.gray);
          doc.text(`   N° Série: ${item.serial_number}`, margin + 5, ctx.currentY + 3);
          ctx.currentY += 5;
        }
      });

      ctx.currentY += 5;
    }

    // ========================================================================
    // TOTALS SECTION
    // ========================================================================
    ctx.currentY += 5;
    
    const totals = [];
    
    if (data.subtotal_services > 0) {
      totals.push({ 
        label: "Services (mensuel):", 
        value: formatCurrency(data.subtotal_services) 
      });
    }
    
    if (data.subtotal_equipment > 0) {
      totals.push({ 
        label: "Équipements/Frais:", 
        value: formatCurrency(data.subtotal_equipment) 
      });
    }

    if (data.total_discounts > 0) {
      totals.push({
        label: "Rabais appliqués:",
        value: `-${formatCurrency(data.total_discounts)}`,
      });
    }

    totals.push(
      { 
        label: "Sous-total:", 
        value: formatCurrency(data.subtotal_before_tax),
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
        label: "TOTAL:", 
        value: formatCurrency(data.total_due),
        isHighlight: true,
      } as any
    );

    renderTotalsSection(ctx, totals);

    // ========================================================================
    // ACTIVATION INFO
    // ========================================================================
    if (data.estimated_activation || data.first_billing_date) {
      ctx.currentY += 10;
      checkPageBreak(ctx, 25);
      
      renderSectionHeader(ctx, "Prochaines Étapes");
      
      if (data.estimated_activation) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.dark);
        doc.text(`• Activation prévue: ${formatDate(data.estimated_activation)}`, margin + 5, ctx.currentY + 5);
        ctx.currentY += 6;
      }
      
      if (data.first_billing_date) {
        doc.text(`• Première facture mensuelle: ${formatDate(data.first_billing_date)}`, margin + 5, ctx.currentY + 5);
        ctx.currentY += 6;
      }
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.gray);
      doc.text("Vous recevrez un email de confirmation lors de l'activation de vos services.", margin + 5, ctx.currentY + 8);
      
      ctx.currentY += 15;
    }

    // ========================================================================
    // LEGAL FOOTER
    // ========================================================================
    renderLegalFooter(ctx);

    // ========================================================================
    // GENERATE BLOB
    // ========================================================================
    const blob = doc.output("blob");
    const filename = `Resume_Commande_${data.order_number}_${data.order_date.replace(/-/g, "")}.pdf`;

    return {
      success: true,
      blob,
      filename,
    };
  } catch (error) {
    console.error("[OrderSummaryPDF] Generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

// ============================================================================
// CONVENIENCE EXPORT
// ============================================================================

export default generateOrderSummaryPDF;
