/**
 * Edge Function: send-template-pdf-preview
 * Generates sample PDFs for the 3 billing templates and sends them by email
 * 
 * Templates:
 * - Invoice Monthly (recurring services)
 * - Invoice One-Time (equipment/fees)
 * - Order Summary (order confirmation)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { jsPDF } from "npm:jspdf@2.5.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// COLORS & CONFIG
// ============================================================================

const PDF_COLORS = {
  navy: [15, 23, 42] as [number, number, number],
  teal: [20, 184, 166] as [number, number, number],
  dark: [30, 30, 30] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  lightGray: [150, 150, 150] as [number, number, number],
  veryLightGray: [240, 240, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  error: [239, 68, 68] as [number, number, number],
};

const NIVRA_HEADER = {
  name: "NIVRA COMMUNICATIONS INC.",
  division: "Billing Division",
  province: "Québec",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  email: "Support@nivra-telecom.ca",
};

const LEGAL_FOOTER = `AVIS LÉGAL — SERVICE PRÉPAYÉ SANS CONTRAT

Ce document constitue une facture pour des services de télécommunications prépayés fournis par Nivra Communications Inc. 
Aucun engagement contractuel minimum n'est requis. Le service est renouvelé mensuellement sur paiement préalable.

• Les montants affichés sont en dollars canadiens (CAD) et incluent les taxes applicables (TPS 5%, TVQ 9.975%).
• Le paiement doit être reçu avant la date d'échéance pour maintenir le service actif.
• En cas de non-paiement à l'échéance, le service sera suspendu sans préavis additionnel.
• Des frais de retard de 5% peuvent s'appliquer aux montants impayés après 48 heures.
• Pour toute question, contactez Support@nivra-telecom.ca

Nivra Communications Inc. — NEQ 2291249786 — Province de Québec, Canada`;

// ============================================================================
// SAMPLE DATA
// ============================================================================

const today = new Date().toISOString().split("T")[0];
const cycleEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

const SAMPLE_MONTHLY = {
  account_number: "ACC-2026-0001",
  invoice_number: "INV-2026-0123",
  invoice_date: today,
  bill_cycle_date: 1,
  cycle_start: today,
  cycle_end: cycleEnd,
  status: "pending",
  subtotal_before_discounts: 119.98,
  total_discounts: 10.00,
  subtotal_after_discounts: 109.98,
  tax_gst: 5.50,
  tax_qst: 10.97,
  total_due: 126.45,
  client_name: "Jean-Pierre Tremblay",
  client_email: "jptremblay@example.com",
  client_phone: "514-555-1234",
  client_address: "1234 Rue Principale, Montréal, QC H2X 1Y4",
  invoice_lines: [
    {
      service_type: "Internet",
      service_description: "Fibre 500 Mbps Illimité",
      service_period: `${today} - ${cycleEnd}`,
      service_price: 79.99,
      service_promo: "-5$",
      service_total: 74.99,
    },
    {
      service_type: "TV",
      service_description: "Forfait Essentiel 60+ chaînes",
      service_period: `${today} - ${cycleEnd}`,
      service_price: 39.99,
      service_promo: "-5$",
      service_total: 34.99,
    },
  ],
};

const SAMPLE_ONETIME = {
  account_number: "ACC-2026-0001",
  invoice_number: "INV-2026-0124",
  invoice_date: today,
  bill_cycle_date: 1,
  cycle_start: today,
  cycle_end: cycleEnd,
  status: "paid",
  subtotal_before_discounts: 199.98,
  total_discounts: 0,
  subtotal_after_discounts: 199.98,
  tax_gst: 10.00,
  tax_qst: 19.95,
  total_due: 229.93,
  payment_reference: "PP-8MC585209K746631H",
  client_name: "Marie-Claire Dubois",
  client_email: "mcdubois@example.com",
  client_phone: "438-555-9876",
  client_address: "5678 Boulevard Saint-Laurent, Laval, QC H7T 2Y5",
  order_number: "CMD-2026-0456",
  paid_at: today,
  payment_method: "paypal",
  items: [
    {
      item_name: "Routeur Wi-Fi 6",
      item_description: "Routeur haute performance",
      qty: 1,
      unit_price: 149.99,
      line_total: 149.99,
      serial_number: "RTR-ABC123456",
    },
    {
      item_name: "Frais d'installation",
      item_description: "Installation standard",
      qty: 1,
      unit_price: 49.99,
      line_total: 49.99,
    },
  ],
};

const SAMPLE_ORDER = {
  order_number: "CMD-2026-0789",
  order_date: today,
  account_number: "ACC-2026-0002",
  client_name: "André Gagnon",
  client_email: "agagnon@example.com",
  client_phone: "450-555-4321",
  service_address: "9012 Rue du Commerce, Québec, QC G1V 3X5",
  billing_address: "9012 Rue du Commerce, Québec, QC G1V 3X5",
  services: [
    {
      service_type: "Internet",
      service_description: "Fibre 1 Gbps Illimité",
      service_period: "/mois",
      service_price: 99.99,
      service_total: 99.99,
    },
    {
      service_type: "Mobile",
      service_description: "Forfait 15 Go Canada/USA",
      service_period: "/30 jours",
      service_price: 45.00,
      service_total: 45.00,
    },
  ],
  items: [
    {
      item_name: "Routeur Mesh",
      item_description: "3-pack couverture maison",
      qty: 1,
      unit_price: 199.99,
      line_total: 199.99,
      serial_number: "MESH-XYZ789012",
    },
    {
      item_name: "Carte SIM",
      item_description: "SIM physique",
      qty: 1,
      unit_price: 10.00,
      line_total: 10.00,
    },
  ],
  subtotal_services: 144.99,
  subtotal_equipment: 209.99,
  total_discounts: 20.00,
  subtotal_before_tax: 334.98,
  tax_gst: 16.75,
  tax_qst: 33.41,
  total_due: 385.14,
  payment_status: "paid",
  payment_method: "interac",
  payment_reference: "CA1234567890",
  paid_at: today,
  promo_code: "BIENVENUE20",
  promo_description: "20$ de rabais",
  estimated_activation: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  first_billing_date: cycleEnd,
};

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrency = (amount: number): string => {
  return `${amount.toFixed(2).replace(".", ",")} $`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('fr-CA', options);
};

// ============================================================================
// PDF GENERATION - INVOICE MONTHLY
// ============================================================================

function generateInvoiceMonthlyPDF(data: typeof SAMPLE_MONTHLY): Uint8Array {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  // Header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, pageWidth, 45, "F");
  
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(0, 45, pageWidth, 3, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(NIVRA_HEADER.name, pageWidth / 2, 15, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(NIVRA_HEADER.division, pageWidth / 2, 22, { align: "center" });
  doc.setFontSize(9);
  doc.text(NIVRA_HEADER.province, pageWidth / 2, 28, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(NIVRA_HEADER.address, pageWidth / 2, 34, { align: "center" });
  doc.setTextColor(...PDF_COLORS.teal);
  doc.text(NIVRA_HEADER.email, pageWidth / 2, 40, { align: "center" });
  
  // Document title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("FACTURE MENSUELLE", pageWidth - margin, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`#${data.invoice_number}`, pageWidth - margin, 22, { align: "right" });
  
  y = 55;
  
  // Client info box
  doc.setDrawColor(...PDF_COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, 90, 30);
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, y, 3, 30, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("FACTURÉ À", margin + 6, y + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(data.client_name, margin + 6, y + 12);
  doc.text(data.client_email, margin + 6, y + 17);
  doc.text(data.client_phone || "", margin + 6, y + 22);
  doc.text(data.client_address, margin + 6, y + 27);
  
  // Account number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("NUMÉRO DE COMPTE", margin + 110, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(data.account_number, margin + 110, y + 12);
  
  y += 40;
  
  // Invoice info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text("Date de facture:", margin, y);
  doc.text("Période de service:", margin, y + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(formatDate(data.invoice_date), margin + 35, y);
  doc.text(`${data.cycle_start} au ${data.cycle_end}`, margin + 40, y + 6);
  
  // Status badge
  doc.setFillColor(...PDF_COLORS.warning);
  doc.roundedRect(pageWidth - margin - 30, y, 25, 6, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("EN ATTENTE", pageWidth - margin - 17.5, y + 4.3, { align: "center" });
  
  y += 20;
  
  // Services section
  doc.setFillColor(...PDF_COLORS.veryLightGray);
  doc.rect(margin, y, contentWidth, 8, "F");
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, y, 3, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("SERVICES SOUSCRITS", margin + 6, y + 5.5);
  
  y += 12;
  
  // Table header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("Service", margin + 2, y + 5);
  doc.text("Description", margin + 52, y + 5);
  doc.text("Prix", margin + 130, y + 5);
  doc.text("Promo", margin + 150, y + 5);
  doc.text("Total", margin + 170, y + 5, { align: "right" });
  
  y += 9;
  
  // Service lines
  data.invoice_lines.forEach((line, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 1, contentWidth, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(`🌐 ${line.service_type}`, margin + 2, y + 4);
    doc.text(line.service_description, margin + 52, y + 4);
    doc.text(formatCurrency(line.service_price), margin + 130, y + 4);
    doc.text(line.service_promo || "—", margin + 150, y + 4);
    doc.text(formatCurrency(line.service_total), margin + 170, y + 4, { align: "right" });
    y += 7;
  });
  
  y += 10;
  
  // Discounts
  if (data.total_discounts > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.success);
    doc.text(`Rabais appliqué: -${formatCurrency(data.total_discounts)}`, margin + 5, y);
    y += 10;
  }
  
  // Totals
  const totalsX = margin + contentWidth - 120;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text("Sous-total avant rabais:", totalsX, y);
  doc.text(formatCurrency(data.subtotal_before_discounts), totalsX + 118, y, { align: "right" });
  y += 7;
  
  if (data.total_discounts > 0) {
    doc.text("Rabais:", totalsX, y);
    doc.text(`-${formatCurrency(data.total_discounts)}`, totalsX + 118, y, { align: "right" });
    y += 7;
  }
  
  doc.setFont("helvetica", "bold");
  doc.text("Sous-total après rabais:", totalsX, y);
  doc.text(formatCurrency(data.subtotal_after_discounts), totalsX + 118, y, { align: "right" });
  y += 7;
  
  doc.setFont("helvetica", "normal");
  doc.text("TPS (5%):", totalsX, y);
  doc.text(formatCurrency(data.tax_gst), totalsX + 118, y, { align: "right" });
  y += 7;
  
  doc.text("TVQ (9.975%):", totalsX, y);
  doc.text(formatCurrency(data.tax_qst), totalsX + 118, y, { align: "right" });
  y += 10;
  
  // Total highlight
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(totalsX - 2, y - 1, 122, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("TOTAL À PAYER:", totalsX, y + 6);
  doc.text(formatCurrency(data.total_due), totalsX + 118, y + 6, { align: "right" });
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 35;
  doc.setDrawColor(...PDF_COLORS.lightGray);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...PDF_COLORS.lightGray);
  const footerLines = LEGAL_FOOTER.split("\n");
  let footerLineY = footerY;
  footerLines.forEach(line => {
    if (line.trim()) {
      doc.text(line, margin, footerLineY);
      footerLineY += 3.5;
    }
  });
  
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ============================================================================
// PDF GENERATION - INVOICE ONE-TIME
// ============================================================================

function generateInvoiceOneTimePDF(data: typeof SAMPLE_ONETIME): Uint8Array {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  // Header (same as monthly)
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, pageWidth, 45, "F");
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(0, 45, pageWidth, 3, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(NIVRA_HEADER.name, pageWidth / 2, 15, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(NIVRA_HEADER.division, pageWidth / 2, 22, { align: "center" });
  doc.setFontSize(9);
  doc.text(NIVRA_HEADER.province, pageWidth / 2, 28, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(NIVRA_HEADER.address, pageWidth / 2, 34, { align: "center" });
  doc.setTextColor(...PDF_COLORS.teal);
  doc.text(NIVRA_HEADER.email, pageWidth / 2, 40, { align: "center" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("FACTURE", pageWidth - margin, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`#${data.invoice_number}`, pageWidth - margin, 22, { align: "right" });
  
  y = 55;
  
  // Client info
  doc.setDrawColor(...PDF_COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, 90, 30);
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, y, 3, 30, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("FACTURÉ À", margin + 6, y + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(data.client_name, margin + 6, y + 12);
  doc.text(data.client_email, margin + 6, y + 17);
  doc.text(data.client_phone || "", margin + 6, y + 22);
  doc.text(data.client_address, margin + 6, y + 27);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("NUMÉRO DE COMPTE", margin + 110, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(data.account_number, margin + 110, y + 12);
  
  // Order number
  if (data.order_number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text("Commande liée:", margin + 110, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(`#${data.order_number}`, margin + 140, y + 20);
  }
  
  y += 40;
  
  // Status - PAID
  doc.setFillColor(...PDF_COLORS.success);
  doc.roundedRect(pageWidth - margin - 25, y - 10, 25, 6, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("PAYÉE", pageWidth - margin - 12.5, y - 6.7, { align: "center" });
  
  // Items section
  doc.setFillColor(...PDF_COLORS.veryLightGray);
  doc.rect(margin, y, contentWidth, 8, "F");
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, y, 3, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("ÉQUIPEMENTS ET FRAIS", margin + 6, y + 5.5);
  
  y += 12;
  
  // Table header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("Article", margin + 2, y + 5);
  doc.text("Description", margin + 50, y + 5);
  doc.text("Qté", margin + 100, y + 5);
  doc.text("Prix unit.", margin + 120, y + 5);
  doc.text("Total", margin + 150, y + 5);
  doc.text("N° Série", margin + 170, y + 5);
  
  y += 9;
  
  // Item lines
  data.items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 1, contentWidth, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(item.item_name, margin + 2, y + 4);
    doc.text(item.item_description || "", margin + 50, y + 4);
    doc.text(String(item.qty), margin + 100, y + 4);
    doc.text(formatCurrency(item.unit_price), margin + 120, y + 4);
    doc.text(formatCurrency(item.line_total), margin + 150, y + 4);
    doc.text(item.serial_number || "—", margin + 170, y + 4);
    y += 7;
  });
  
  y += 15;
  
  // Totals
  const totalsX = margin + contentWidth - 120;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text("Sous-total:", totalsX, y);
  doc.text(formatCurrency(data.subtotal_before_discounts), totalsX + 118, y, { align: "right" });
  y += 7;
  
  doc.text("TPS (5%):", totalsX, y);
  doc.text(formatCurrency(data.tax_gst), totalsX + 118, y, { align: "right" });
  y += 7;
  
  doc.text("TVQ (9.975%):", totalsX, y);
  doc.text(formatCurrency(data.tax_qst), totalsX + 118, y, { align: "right" });
  y += 10;
  
  // Total highlight
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(totalsX - 2, y - 1, 122, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("TOTAL À PAYER:", totalsX, y + 6);
  doc.text(formatCurrency(data.total_due), totalsX + 118, y + 6, { align: "right" });
  
  y += 20;
  
  // Paid banner
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, y, contentWidth, 15, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.success);
  doc.text("✓ FACTURE PAYÉE", margin + 5, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text(`Paiement reçu le ${formatDate(data.paid_at || today)}`, margin + 5, y + 12);
  doc.text(`Référence: ${data.payment_reference}`, margin + 80, y + 12);
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 35;
  doc.setDrawColor(...PDF_COLORS.lightGray);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...PDF_COLORS.lightGray);
  const footerLines = LEGAL_FOOTER.split("\n");
  let footerLineY = footerY;
  footerLines.forEach(line => {
    if (line.trim()) {
      doc.text(line, margin, footerLineY);
      footerLineY += 3.5;
    }
  });
  
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ============================================================================
// PDF GENERATION - ORDER SUMMARY
// ============================================================================

function generateOrderSummaryPDF(data: typeof SAMPLE_ORDER): Uint8Array {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  // Header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, pageWidth, 45, "F");
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(0, 45, pageWidth, 3, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(NIVRA_HEADER.name, pageWidth / 2, 15, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(NIVRA_HEADER.division, pageWidth / 2, 22, { align: "center" });
  doc.setFontSize(9);
  doc.text(NIVRA_HEADER.province, pageWidth / 2, 28, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(NIVRA_HEADER.address, pageWidth / 2, 34, { align: "center" });
  doc.setTextColor(...PDF_COLORS.teal);
  doc.text(NIVRA_HEADER.email, pageWidth / 2, 40, { align: "center" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("RÉSUMÉ DE COMMANDE", pageWidth - margin, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`#${data.order_number}`, pageWidth - margin, 22, { align: "right" });
  
  y = 55;
  
  // Confirmed banner
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, y, contentWidth, 12, "F");
  doc.setFillColor(...PDF_COLORS.success);
  doc.rect(margin, y, 4, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.success);
  doc.text("✓ COMMANDE CONFIRMÉE", margin + 8, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text(`Paiement reçu le ${formatDate(data.paid_at || today)}`, margin + 80, y + 8);
  
  y += 18;
  
  // Client info box
  doc.setDrawColor(...PDF_COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, 90, 40);
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, y, 3, 40, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("CLIENT", margin + 6, y + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(data.client_name, margin + 6, y + 12);
  doc.text(data.client_email, margin + 6, y + 17);
  doc.text(data.client_phone || "", margin + 6, y + 22);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text("Adresse de service:", margin + 6, y + 29);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(data.service_address, margin + 6, y + 34);
  
  // Order details
  const rightX = margin + 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("DÉTAILS DE COMMANDE", rightX, y + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text("Numéro de compte:", rightX, y + 12);
  doc.text("Date de commande:", rightX, y + 17);
  doc.text("Méthode de paiement:", rightX, y + 22);
  doc.text("Référence:", rightX, y + 27);
  
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(data.account_number, rightX + 35, y + 12);
  doc.text(formatDate(data.order_date), rightX + 35, y + 17);
  doc.text(data.payment_method?.toUpperCase() || "—", rightX + 35, y + 22);
  doc.text(data.payment_reference || "—", rightX + 35, y + 27);
  
  // Promo code
  if (data.promo_code) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.success);
    doc.text(`Promo: ${data.promo_code}`, rightX, y + 34);
    doc.setFont("helvetica", "normal");
    doc.text(data.promo_description || "", rightX + 30, y + 34);
  }
  
  y += 48;
  
  // Services section
  if (data.services && data.services.length > 0) {
    doc.setFillColor(...PDF_COLORS.veryLightGray);
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setFillColor(...PDF_COLORS.teal);
    doc.rect(margin, y, 3, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text("SERVICES SOUSCRITS (RÉCURRENTS)", margin + 6, y + 5.5);
    
    y += 12;
    
    // Table header
    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text("Service", margin + 2, y + 5);
    doc.text("Description", margin + 45, y + 5);
    doc.text("Période", margin + 120, y + 5);
    doc.text("Mensuel", margin + 165, y + 5, { align: "right" });
    
    y += 9;
    
    data.services.forEach((service, index) => {
      if (index % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 1, contentWidth, 7, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.dark);
      doc.text(`🌐 ${service.service_type}`, margin + 2, y + 4);
      doc.text(service.service_description, margin + 45, y + 4);
      doc.text(service.service_period, margin + 120, y + 4);
      doc.text(formatCurrency(service.service_total), margin + 165, y + 4, { align: "right" });
      y += 7;
    });
    
    y += 5;
  }
  
  // Equipment section
  if (data.items && data.items.length > 0) {
    doc.setFillColor(...PDF_COLORS.veryLightGray);
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setFillColor(...PDF_COLORS.teal);
    doc.rect(margin, y, 3, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text("ÉQUIPEMENTS ET FRAIS PONCTUELS", margin + 6, y + 5.5);
    
    y += 12;
    
    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text("Article", margin + 2, y + 5);
    doc.text("Description", margin + 50, y + 5);
    doc.text("Qté", margin + 110, y + 5);
    doc.text("Prix unit.", margin + 130, y + 5);
    doc.text("Total", margin + 165, y + 5, { align: "right" });
    
    y += 9;
    
    data.items.forEach((item, index) => {
      if (index % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 1, contentWidth, 7, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.dark);
      doc.text(item.item_name, margin + 2, y + 4);
      doc.text(item.item_description || "", margin + 50, y + 4);
      doc.text(String(item.qty), margin + 110, y + 4);
      doc.text(formatCurrency(item.unit_price), margin + 130, y + 4);
      doc.text(formatCurrency(item.line_total), margin + 165, y + 4, { align: "right" });
      y += 7;
      
      if (item.serial_number) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(...PDF_COLORS.gray);
        doc.text(`   N° Série: ${item.serial_number}`, margin + 5, y + 3);
        y += 5;
      }
    });
    
    y += 5;
  }
  
  y += 10;
  
  // Totals
  const totalsX = margin + contentWidth - 120;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.dark);
  
  if (data.subtotal_services > 0) {
    doc.text("Services (mensuel):", totalsX, y);
    doc.text(formatCurrency(data.subtotal_services), totalsX + 118, y, { align: "right" });
    y += 7;
  }
  
  if (data.subtotal_equipment > 0) {
    doc.text("Équipements/Frais:", totalsX, y);
    doc.text(formatCurrency(data.subtotal_equipment), totalsX + 118, y, { align: "right" });
    y += 7;
  }
  
  if (data.total_discounts > 0) {
    doc.text("Rabais appliqués:", totalsX, y);
    doc.text(`-${formatCurrency(data.total_discounts)}`, totalsX + 118, y, { align: "right" });
    y += 7;
  }
  
  doc.setFont("helvetica", "bold");
  doc.text("Sous-total:", totalsX, y);
  doc.text(formatCurrency(data.subtotal_before_tax), totalsX + 118, y, { align: "right" });
  y += 7;
  
  doc.setFont("helvetica", "normal");
  doc.text("TPS (5%):", totalsX, y);
  doc.text(formatCurrency(data.tax_gst), totalsX + 118, y, { align: "right" });
  y += 7;
  
  doc.text("TVQ (9.975%):", totalsX, y);
  doc.text(formatCurrency(data.tax_qst), totalsX + 118, y, { align: "right" });
  y += 10;
  
  // Total highlight
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(totalsX - 2, y - 1, 122, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("TOTAL:", totalsX, y + 6);
  doc.text(formatCurrency(data.total_due), totalsX + 118, y + 6, { align: "right" });
  
  y += 20;
  
  // Next steps
  if (data.estimated_activation || data.first_billing_date) {
    doc.setFillColor(...PDF_COLORS.veryLightGray);
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setFillColor(...PDF_COLORS.teal);
    doc.rect(margin, y, 3, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text("PROCHAINES ÉTAPES", margin + 6, y + 5.5);
    
    y += 12;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    
    if (data.estimated_activation) {
      doc.text(`• Activation prévue: ${formatDate(data.estimated_activation)}`, margin + 5, y);
      y += 6;
    }
    
    if (data.first_billing_date) {
      doc.text(`• Première facture mensuelle: ${formatDate(data.first_billing_date)}`, margin + 5, y);
      y += 6;
    }
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text("Vous recevrez un email de confirmation lors de l'activation de vos services.", margin + 5, y + 3);
  }
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 35;
  doc.setDrawColor(...PDF_COLORS.lightGray);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...PDF_COLORS.lightGray);
  const footerLines = LEGAL_FOOTER.split("\n");
  let footerLineY = footerY;
  footerLines.forEach(line => {
    if (line.trim()) {
      doc.text(line, margin, footerLineY);
      footerLineY += 3.5;
    }
  });
  
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ============================================================================
// HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to } = await req.json();
    
    if (!to) {
      throw new Error("Email destinataire requis");
    }

    console.log(`[send-template-pdf-preview] Generating 3 PDFs for ${to}`);

    // Generate all 3 PDFs
    const monthlyPDF = generateInvoiceMonthlyPDF(SAMPLE_MONTHLY);
    const onetimePDF = generateInvoiceOneTimePDF(SAMPLE_ONETIME);
    const orderPDF = generateOrderSummaryPDF(SAMPLE_ORDER);

    console.log("[send-template-pdf-preview] PDFs generated, sending email...");

    // Send email with all 3 attachments
    const emailResponse = await resend.emails.send({
      from: "Nivra Billing <noreply@nivra-telecom.ca>",
      to: [to],
      reply_to: "support@nivra-telecom.ca",
      subject: "📄 Aperçu des 3 Templates PDF Facturation V2",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #0F172A; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">NIVRA COMMUNICATIONS</h1>
            <p style="color: #14B8A6; margin: 5px 0 0 0;">Billing Templates V2</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #0F172A; margin-top: 0;">Aperçu des Templates PDF</h2>
            
            <p style="color: #333;">Veuillez trouver ci-joints les 3 templates PDF de facturation :</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #14B8A6;">
              <h3 style="margin: 0 0 10px 0; color: #0F172A;">📄 1. Facture Mensuelle</h3>
              <p style="margin: 0; color: #666; font-size: 14px;">
                Pour les services récurrents (Internet, TV, Mobile).<br>
                Affiche la période de service, les rabais, et les taxes TPS/TVQ.
              </p>
            </div>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #22C55E;">
              <h3 style="margin: 0 0 10px 0; color: #0F172A;">🧾 2. Facture One-Time</h3>
              <p style="margin: 0; color: #666; font-size: 14px;">
                Pour les équipements et frais ponctuels.<br>
                Inclut les numéros de série et quantités.
              </p>
            </div>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #F59E0B;">
              <h3 style="margin: 0 0 10px 0; color: #0F172A;">📦 3. Résumé de Commande</h3>
              <p style="margin: 0; color: #666; font-size: 14px;">
                Confirmation envoyée après paiement.<br>
                Combine services et équipements avec dates d'activation.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            
            <p style="color: #666; font-size: 12px; margin: 0;">
              Ces templates sont générés automatiquement par le système Billing V2.<br>
              Pour toute question, contactez support@nivra-telecom.ca
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Facture_Mensuelle_${SAMPLE_MONTHLY.invoice_number}.pdf`,
          content: base64Encode(monthlyPDF),
        },
        {
          filename: `Facture_${SAMPLE_ONETIME.invoice_number}.pdf`,
          content: base64Encode(onetimePDF),
        },
        {
          filename: `Resume_Commande_${SAMPLE_ORDER.order_number}.pdf`,
          content: base64Encode(orderPDF),
        },
      ],
    });

    console.log("[send-template-pdf-preview] Email sent:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: `3 PDFs envoyés à ${to}`,
        templates: ["Invoice Monthly", "Invoice One-Time", "Order Summary"],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[send-template-pdf-preview] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
