/**
 * Nivra Contract Template - PRODUCTION STANDARD
 * Matches the approved server-side pdfGenerator.ts style exactly.
 * 
 * 4-page clean layout:
 * - Page 1: Cover (client info, services, equipment, totals)
 * - Page 2: Terms & Conditions (6 sections)
 * - Page 3: Annexes (A, B, C)
 * - Page 4: Signatures
 * 
 * Visual: Navy header bar (#0F172A) + Blue accent (#0066CC)
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";

// ============================================================================
// CONTRACT DATA INTERFACE (backward compatible)
// ============================================================================

export interface ContractData {
  contract_number?: string;
  contractNumber?: string;
  contractId?: string;
  templateId?: string;
  templateVersion?: string;
  contract_date?: string;
  contract_version?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_dob?: string;
  service_address?: string;
  billing_address?: string;
  account_number?: string;
  order_number?: string;
  order_date?: string;
  services?: Array<{
    service_type: string;
    service_description?: string;
    service_price: number;
    service_total: number;
    service_period?: string;
    [key: string]: any;
  }>;
  equipment?: Array<{
    item_name: string;
    item_description?: string;
    qty: number;
    unit_price: number;
    line_total: number;
    serial_number?: string;
    [key: string]: any;
  }>;
  one_time_fees?: { label: string; amount: number }[];
  subtotal_monthly?: number;
  subtotal_equipment?: number;
  subtotal_one_time_fees?: number;
  total_discounts?: number;
  subtotal_before_tax?: number;
  tax_gst?: number;
  tax_qst?: number;
  total_due_today?: number;
  monthly_recurring?: number;
  promo_code?: string;
  promo_description?: string;
  installation_date?: string;
  installation_time_slot?: string;
  installation_type?: "standard" | "complex";
  activation_date?: string;
  first_billing_date?: string;
  bill_cycle_day?: number;
  payment_method?: string;
  payment_reference?: string;
  signature_name?: string;
  signature_date?: string;
  signature_ip?: string;
  is_signed?: boolean;
  [key: string]: any;
}

// ============================================================================
// COMPANY & COLORS (matching pdfGenerator.ts exactly)
// ============================================================================

const COMPANY = {
  name: "Nivra Telecom",
  legalName: "9477-4922 Québec inc. (Nivra Telecom)",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  email: "Support@nivra-telecom.ca",
  gstNumber: "713971764RT0001",
  qstNumber: "1232379195TQ0001",
};

const COLORS = {
  primary: [15, 23, 42] as [number, number, number],
  accent: [0, 102, 204] as [number, number, number],
  text: [51, 65, 85] as [number, number, number],
  textLight: [100, 116, 139] as [number, number, number],
  lightGray: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
};

// ============================================================================
// HELPERS (matching pdfGenerator.ts exactly)
// ============================================================================

const formatCurrencyCAD = (amount: number): string => {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);
};

const formatDateFR = (dateStr: string | undefined): string => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const addPage = (doc: jsPDF) => {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pw, ph, "F");
};

const drawHeader = (doc: jsPDF, title: string) => {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pw, 22, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("NIVRA TELECOM", 15, 11);
  doc.setFontSize(12);
  doc.text(title, pw - 15, 11, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(COMPANY.email, 15, 18);
};

const drawFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, ph - 18, pw, 18, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(7);
  doc.text(COMPANY.legalName, pw / 2, ph - 12, { align: "center" });
  doc.text(`${COMPANY.address} | TPS: ${COMPANY.gstNumber} | TVQ: ${COMPANY.qstNumber}`, pw / 2, ph - 7, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} / ${totalPages}`, pw - 15, ph - 9, { align: "right" });
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateContractPDF(data: ContractData): PDFGenerationResult {
  try {
    const contractNum = data.contract_number || data.contractNumber || "CTR-XXXX";
    const clientName = data.client_name || "N/A";
    const clientEmail = data.client_email || "N/A";
    const clientPhone = data.client_phone || "N/A";
    const clientAddress = data.service_address || data.billing_address || "N/A";

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const totalPages = 4;

    // Force white background
    doc.setFillColor(...COLORS.white);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // === PAGE 1: COVER ===
    drawHeader(doc, "CONTRAT DE SERVICE");

    let y = 35;

    // Contract number box
    doc.setFillColor(...COLORS.accent);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 3, 3, "F");
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Contrat Nº ${contractNum}`, pageWidth / 2, y + 9, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Date d'entrée en vigueur: ${formatDateFR(data.contract_date || data.order_date)}`, pageWidth / 2, y + 16, { align: "center" });
    y += 30;

    // Client information section
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 45, 3, 3, "F");
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMATIONS DU CLIENT", margin + 5, y + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);

    const clientInfo = [
      { label: "Nom complet:", value: clientName },
      { label: "Courriel:", value: clientEmail },
      { label: "Téléphone:", value: clientPhone },
      { label: "Adresse:", value: clientAddress },
    ];
    clientInfo.forEach((item, i) => {
      doc.setFont("helvetica", "bold");
      doc.text(item.label, margin + 8, y + 20 + i * 7);
      doc.setFont("helvetica", "normal");
      doc.text(item.value.substring(0, 60), margin + 40, y + 20 + i * 7);
    });
    y += 55;

    // Services section
    const services = data.services || [];
    if (services.length > 0) {
      doc.setFillColor(...COLORS.accent);
      doc.rect(margin, y, 4, 8, "F");
      doc.setTextColor(...COLORS.primary);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("SERVICES SOUSCRITS", margin + 8, y + 6);
      y += 14;

      // Table header
      doc.setFillColor(...COLORS.primary);
      doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("SERVICE", margin + 5, y + 5.5);
      doc.text("DESCRIPTION", margin + 60, y + 5.5);
      doc.text("MENSUEL", pageWidth - margin - 5, y + 5.5, { align: "right" });
      y += 10;

      doc.setTextColor(...COLORS.text);
      doc.setFont("helvetica", "normal");
      services.forEach((svc, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(...COLORS.lightGray);
          doc.rect(margin, y - 2, pageWidth - margin * 2, 8, "F");
        }
        doc.text(svc.service_type || "", margin + 5, y + 4);
        doc.text((svc.service_description || "").substring(0, 40), margin + 60, y + 4);
        doc.text(formatCurrencyCAD(svc.service_price || svc.service_total), pageWidth - margin - 5, y + 4, { align: "right" });
        y += 8;
      });
    }

    // Equipment section
    const equipment = data.equipment || [];
    if (equipment.length > 0) {
      y += 10;
      doc.setFillColor(...COLORS.accent);
      doc.rect(margin, y, 4, 8, "F");
      doc.setTextColor(...COLORS.primary);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("ÉQUIPEMENTS", margin + 8, y + 6);
      y += 12;

      doc.setTextColor(...COLORS.text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      equipment.forEach((equip, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(...COLORS.lightGray);
          doc.rect(margin, y - 2, pageWidth - margin * 2, 8, "F");
        }
        doc.text(equip.item_name || "", margin + 5, y + 4);
        doc.text(formatCurrencyCAD(equip.unit_price || equip.line_total) + " (une fois)", pageWidth - margin - 5, y + 4, { align: "right" });
        y += 8;
      });
    }

    // Totals
    y += 10;
    const totalMonthly = data.subtotal_monthly || data.monthly_recurring || services.reduce((sum, s) => sum + (s.service_price || s.service_total || 0), 0);
    const totalOneTime = data.subtotal_equipment || data.subtotal_one_time_fees || equipment.reduce((sum, e) => sum + (e.unit_price || e.line_total || 0), 0);

    doc.setFillColor(...COLORS.success);
    doc.roundedRect(pageWidth / 2, y, pageWidth / 2 - margin, 20, 2, 2, "F");
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL MENSUEL", pageWidth / 2 + 8, y + 8);
    doc.text(formatCurrencyCAD(totalMonthly), pageWidth - margin - 5, y + 8, { align: "right" });
    if (totalOneTime > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Frais uniques", pageWidth / 2 + 8, y + 15);
      doc.text(formatCurrencyCAD(totalOneTime), pageWidth - margin - 5, y + 15, { align: "right" });
    }

    drawFooter(doc, 1, totalPages);

    // === PAGE 2: TERMS ===
    addPage(doc);
    drawHeader(doc, "CONDITIONS GÉNÉRALES");
    y = 32;

    const terms = [
      { title: "1. DURÉE ET RÉSILIATION", content: "Le présent contrat est sans engagement et peut être résilié en tout temps par le client avec un préavis de 30 jours. Les services sont fournis sur une base mensuelle prépayée." },
      { title: "2. PAIEMENT", content: "Les services sont prépayés. Le paiement doit être reçu avant l'activation ou le renouvellement des services. Nivra Telecom accepte les virements Interac et PayPal. Les paiements sont dus avant la date d'échéance indiquée sur la facture." },
      { title: "3. ÉQUIPEMENT", content: "L'équipement fourni par Nivra Telecom demeure la propriété de Nivra Telecom et doit être retourné en bon état à la résiliation du contrat. Des frais peuvent s'appliquer pour l'équipement non retourné ou endommagé." },
      { title: "4. UTILISATION ACCEPTABLE", content: "Le client s'engage à utiliser les services conformément aux lois en vigueur et aux politiques d'utilisation acceptable de Nivra Telecom. Toute utilisation abusive peut entraîner la suspension ou la résiliation des services." },
      { title: "5. MODIFICATIONS", content: "Nivra Telecom se réserve le droit de modifier les tarifs et conditions avec un préavis de 30 jours. Le client peut résilier sans frais s'il n'accepte pas les modifications." },
      { title: "6. LIMITATION DE RESPONSABILITÉ", content: "Nivra Telecom n'est pas responsable des dommages indirects, consécutifs ou punitifs. La responsabilité totale de Nivra Telecom est limitée aux frais payés par le client au cours des trois derniers mois." },
    ];

    terms.forEach((term) => {
      if (y > pageHeight - 50) {
        addPage(doc);
        drawHeader(doc, "CONDITIONS GÉNÉRALES");
        y = 32;
      }
      doc.setTextColor(...COLORS.primary);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(term.title, margin, y);
      y += 6;
      doc.setTextColor(...COLORS.text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(term.content, pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 8;
    });

    drawFooter(doc, 2, totalPages);

    // === PAGE 3: ANNEXES ===
    addPage(doc);
    drawHeader(doc, "ANNEXES");
    y = 32;

    const annexes = [
      { title: "ANNEXE A — NIVEAUX DE SERVICE", content: "Nivra Telecom s'engage à fournir une disponibilité de service de 99.5% sur une base mensuelle. Les interruptions planifiées seront communiquées 48 heures à l'avance. En cas de panne majeure, un crédit proportionnel sera appliqué." },
      { title: "ANNEXE B — POLITIQUE DE CONFIDENTIALITÉ", content: "Nivra Telecom s'engage à protéger les renseignements personnels conformément à la Loi 25 du Québec. Les données sont collectées uniquement pour la fourniture des services et ne sont jamais vendues à des tiers." },
      { title: "ANNEXE C — PROCÉDURE DE PLAINTES", content: "Pour toute plainte, contactez support@nivra-telecom.ca. Nous nous engageons à répondre dans les 48 heures ouvrables. Si la plainte n'est pas résolue à votre satisfaction, vous pouvez contacter la CRTC." },
    ];

    annexes.forEach((annex) => {
      doc.setFillColor(...COLORS.accent);
      doc.rect(margin, y, 4, 8, "F");
      doc.setTextColor(...COLORS.primary);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(annex.title, margin + 8, y + 6);
      y += 12;
      doc.setTextColor(...COLORS.text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(annex.content, pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 15;
    });

    drawFooter(doc, 3, totalPages);

    // === PAGE 4: SIGNATURES ===
    addPage(doc);
    drawHeader(doc, "SIGNATURES");
    y = 40;

    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("ACCEPTATION DU CONTRAT", margin, y);
    y += 8;

    doc.setTextColor(...COLORS.text);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const acceptText = "En signant ce contrat, les deux parties reconnaissent avoir lu, compris et accepté l'ensemble des conditions générales et annexes ci-dessus.";
    const acceptLines = doc.splitTextToSize(acceptText, pageWidth - margin * 2);
    doc.text(acceptLines, margin, y);
    y += 25;

    // Client signature box
    const boxWidth = (pageWidth - margin * 3) / 2;
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(margin, y, boxWidth, 50, 3, 3, "F");
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("SIGNATURE DU CLIENT", margin + 5, y + 10);

    if (data.is_signed && data.signature_name) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(12);
      doc.setTextColor(...COLORS.accent);
      doc.text(data.signature_name, margin + 10, y + 30);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textLight);
      doc.text(`Signé le: ${formatDateFR(data.signature_date)}`, margin + 10, y + 40);
    } else {
      doc.setDrawColor(...COLORS.text);
      doc.line(margin + 10, y + 35, margin + boxWidth - 10, y + 35);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textLight);
      doc.text("Signature", margin + 10, y + 40);
      doc.text("Date: ___ / ___ / ______", margin + 10, y + 46);
    }

    // Agent signature box
    const agentX = margin + boxWidth + margin;
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(agentX, y, boxWidth, 50, 3, 3, "F");
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("REPRÉSENTANT NIVRA", agentX + 5, y + 10);
    doc.setDrawColor(...COLORS.text);
    doc.line(agentX + 10, y + 35, agentX + boxWidth - 10, y + 35);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textLight);
    doc.text("Signature", agentX + 10, y + 40);
    doc.text("Agent: _______________", agentX + 10, y + 46);

    drawFooter(doc, 4, totalPages);

    // Generate blob
    const blob = doc.output("blob");
    const filename = `Contrat-${contractNum}.pdf`;

    return { success: true, blob, filename };
  } catch (error) {
    console.error("[ContractPDF] Generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

export default generateContractPDF;
