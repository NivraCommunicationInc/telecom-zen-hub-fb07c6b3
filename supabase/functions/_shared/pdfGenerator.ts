/**
 * PDF Generator for Edge Functions
 * 
 * Generates professional multi-page PDFs for invoices, contracts, and summaries.
 * Used by email sending functions to attach PDFs to emails.
 */

import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

// Company information — MUST match client-side companyInfo.ts
export const COMPANY = {
  name: "NIVRA COMMUNICATIONS INC.",
  legalName: "NIVRA COMMUNICATIONS INC.",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  email: "Support@nivra-telecom.ca",
  phone: "438-544-2233",
  website: "www.nivra-telecom.ca",
  neq: "2291249786",
  gstNumber: "732287291 RT0001",
  qstNumber: "1229249786 TQ0001",
};

// Professional color palette
const COLORS = {
  primary: [15, 23, 42] as [number, number, number],
  accent: [0, 102, 204] as [number, number, number], // #0066CC
  text: [51, 65, 85] as [number, number, number],
  textLight: [100, 116, 139] as [number, number, number],
  lightGray: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
};

// Format helpers
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-CA', { 
    style: 'currency', 
    currency: 'CAD' 
  }).format(amount || 0);
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'Non fourni par le client';
  try {
    return new Date(dateStr).toLocaleDateString('fr-CA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch { return dateStr; }
};

// Helper to add new page with white background
const addPage = (doc: jsPDF) => {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
};

// Helper to draw header on each page
const drawHeader = (doc: jsPDF, title: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 22, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("NIVRA TELECOM", 15, 11);
  
  doc.setFontSize(12);
  doc.text(title, pageWidth - 15, 11, { align: "right" });
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(COMPANY.email, 15, 18);
};

// Helper to draw footer on each page
const drawFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, pageHeight - 18, pageWidth, 18, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(7);
  doc.text(COMPANY.legalName, pageWidth / 2, pageHeight - 12, { align: "center" });
  doc.text(`${COMPANY.address} | TPS: ${COMPANY.gstNumber} | TVQ: ${COMPANY.qstNumber}`, pageWidth / 2, pageHeight - 7, { align: "center" });
  
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - 15, pageHeight - 9, { align: "right" });
};

// ============================================================================
// INVOICE PDF GENERATOR
// ============================================================================

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  account_number: string;
  period_start?: string;
  period_end?: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  services: Array<{
    name: string;
    description?: string;
    price: number;
    quantity?: number;
  }>;
  subtotal: number;
  discount_label?: string;
  discount_amount?: number;
  tps: number;
  tvq: number;
  total: number;
  previous_balance?: number;
  payments?: Array<{
    date: string;
    method: string;
    amount: number;
    reference?: string;
  }>;
  balance_due: number;
  status?: string;
}

export function generateInvoicePDF(data: InvoiceData): string {
  // HARD STOP: account_number is mandatory for all financial documents
  if (!data.account_number || data.account_number === 'N/A' || data.account_number === '000000') {
    throw new Error('MISSING_ACCOUNT_NUMBER: Impossible de générer la facture sans numéro de compte valide.');
  }
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  
  // Force white background
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  
  // === PAGE 1: SUMMARY ===
  drawHeader(doc, "FACTURE");
  
  let y = 32;
  
  // Invoice info box
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 32, 3, 3, "F");
  
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  
  // Left column
  doc.text("Numéro de facture:", margin + 5, y + 8);
  doc.text("Date d'émission:", margin + 5, y + 16);
  doc.text("Date d'échéance:", margin + 5, y + 24);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text(data.invoice_number || "N/A", margin + 50, y + 8);
  doc.text(formatDate(data.invoice_date), margin + 50, y + 16);
  doc.text(formatDate(data.due_date), margin + 50, y + 24);
  
  // Right column
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("Numéro de compte:", pageWidth / 2 + 10, y + 8);
  doc.text("Période de service:", pageWidth / 2 + 10, y + 16);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text(data.account_number || "N/A", pageWidth - margin - 5, y + 8, { align: "right" });
  
  const periodText = data.period_start && data.period_end 
    ? `${formatDate(data.period_start).split(' ').slice(0, 2).join(' ')} – ${formatDate(data.period_end).split(' ').slice(0, 2).join(' ')}`
    : "N/A";
  doc.text(periodText, pageWidth - margin - 5, y + 16, { align: "right" });
  
  y += 42;
  
  // Client info block
  doc.setFillColor(...COLORS.accent);
  doc.rect(margin, y, 3, 22, "F");
  
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Facturé à:", margin + 8, y + 7);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text(data.client_name || "Client", margin + 8, y + 14);
  if (data.client_address) {
    doc.text(data.client_address, margin + 8, y + 20);
  }
  
  y += 32;
  
  // Services table header
  doc.setFillColor(...COLORS.primary);
  doc.rect(margin, y, pageWidth - margin * 2, 10, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICE", margin + 5, y + 7);
  doc.text("DESCRIPTION", margin + 55, y + 7);
  doc.text("QTÉ", pageWidth - margin - 35, y + 7, { align: "center" });
  doc.text("MONTANT", pageWidth - margin - 5, y + 7, { align: "right" });
  
  y += 12;
  
  // Services rows
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  
  const services = data.services || [];
  services.forEach((service, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(margin, y - 3, pageWidth - margin * 2, 10, "F");
    }
    doc.text(service.name || "", margin + 5, y + 4);
    doc.text((service.description || "").substring(0, 35), margin + 55, y + 4);
    doc.text(String(service.quantity || 1), pageWidth - margin - 35, y + 4, { align: "center" });
    doc.text(formatCurrency(service.price), pageWidth - margin - 5, y + 4, { align: "right" });
    y += 10;
  });
  
  y += 5;
  
  // Totals section
  doc.setDrawColor(...COLORS.border);
  doc.line(pageWidth / 2, y, pageWidth - margin, y);
  
  y += 8;
  const totals: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: "Sous-total", value: formatCurrency(data.subtotal) },
  ];
  
  // Discount line (if present) — always show with negative sign
  if (data.discount_label && data.discount_amount) {
    const absDiscount = Math.abs(data.discount_amount);
    totals.push({ label: data.discount_label, value: `-${formatCurrency(absDiscount)}`, highlight: true });
  }
  
  totals.push(
    { label: "TPS (5%)", value: formatCurrency(data.tps) },
    { label: "TVQ (9.975%)", value: formatCurrency(data.tvq) },
  );
  
  if (data.previous_balance) {
    totals.push({ label: "Solde précédent", value: formatCurrency(data.previous_balance) });
  }
  
  doc.setFontSize(10);
  totals.forEach((item) => {
    doc.setFont("helvetica", "normal");
    if (item.highlight) {
      doc.setTextColor(...COLORS.success);
    } else {
      doc.setTextColor(...COLORS.text);
    }
    doc.text(item.label, pageWidth / 2 + 10, y);
    doc.text(item.value, pageWidth - margin - 5, y, { align: "right" });
    y += 7;
  });
  
  y += 3;
  
  // Total box
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(pageWidth / 2, y, pageWidth / 2 - margin, 14, 2, 2, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", pageWidth / 2 + 8, y + 9);
  doc.text(formatCurrency(data.total), pageWidth - margin - 5, y + 9, { align: "right" });
  
  y += 20;
  
  // Payment history section (if payments exist)
  if (data.payments && data.payments.length > 0) {
    doc.setFillColor(...COLORS.lightGray);
    const paymentHeight = 10 + data.payments.length * 8 + 12;
    doc.roundedRect(margin, y, pageWidth - margin * 2, paymentHeight, 3, 3, "F");
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Historique de paiement", margin + 5, y + 8);
    y += 12;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.text);
    
    data.payments.forEach((payment) => {
      doc.text(formatDate(payment.date), margin + 5, y + 4);
      doc.text(payment.method, margin + 60, y + 4);
      if (payment.reference) {
        doc.text(payment.reference, margin + 95, y + 4);
      }
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(payment.amount), pageWidth - margin - 5, y + 4, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 8;
    });
    
    // Balance due
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(data.balance_due <= 0 ? COLORS.success[0] : COLORS.accent[0], data.balance_due <= 0 ? COLORS.success[1] : COLORS.accent[1], data.balance_due <= 0 ? COLORS.success[2] : COLORS.accent[2]);
    doc.text("Solde dû:", margin + 5, y);
    doc.text(data.balance_due <= 0 ? "0,00 $ — Payé" : formatCurrency(data.balance_due), pageWidth - margin - 5, y, { align: "right" });
    
    y += 15;
  }
  
  // Payment instructions (only if balance due > 0)
  if (data.balance_due > 0) {
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, "F");
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Paiement par Virement Interac", margin + 5, y + 8);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(9);
    doc.text("Courriel: support@nivra-telecom.ca", margin + 5, y + 16);
    doc.text("Question secrète: Numéro de facture", margin + 5, y + 23);
    doc.text(`Réponse: ${data.invoice_number}`, margin + 90, y + 23);
    
    y += 35;
  }
  
  // Prepaid legal note
  y = Math.max(y, pageHeight - 45);
  doc.setDrawColor(...COLORS.border);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...COLORS.textLight);
  doc.text("Service prépayé — aucun montant dû n'est créé en cas de non-renouvellement normal.", margin, y);
  doc.text("En cas de non-renouvellement, le service est suspendu à la fin de la période payée.", margin, y + 4);
  
  // Footer
  const totalPdfPages = 1;
  drawFooter(doc, 1, totalPdfPages);
  
  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// CONTRACT PDF GENERATOR
// ============================================================================

export interface ContractData {
  contract_number: string;
  effective_date: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  client_dob?: string;
  services: Array<{
    name: string;
    description?: string;
    monthly_price: number;
  }>;
  equipment?: Array<{
    name: string;
    price: number;
  }>;
  total_monthly: number;
  total_one_time: number;
  agent_name?: string;
  agent_code?: string;
}

export function generateContractPDF(data: ContractData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const totalPages = 4; // Cover + Terms + Annex + Signatures
  
  // === PAGE 1: COVER ===
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  drawHeader(doc, "CONTRAT DE SERVICE");
  
  let y = 35;
  
  // Contract number box
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 3, 3, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Contrat Nº ${data.contract_number || "CTR-XXXX"}`, pageWidth / 2, y + 9, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date d'entrée en vigueur: ${formatDate(data.effective_date)}`, pageWidth / 2, y + 16, { align: "center" });
  
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
    { label: "Nom complet:", value: data.client_name || "N/A" },
    { label: "Courriel:", value: data.client_email || "N/A" },
    { label: "Téléphone:", value: data.client_phone || "N/A" },
    { label: "Adresse:", value: data.client_address || "N/A" },
  ];
  
  clientInfo.forEach((item, i) => {
    doc.setFont("helvetica", "bold");
    doc.text(item.label, margin + 8, y + 20 + i * 7);
    doc.setFont("helvetica", "normal");
    doc.text(item.value, margin + 40, y + 20 + i * 7);
  });
  
  y += 55;
  
  // Services section
  doc.setFillColor(...COLORS.accent);
  doc.rect(margin, y, 4, 8, "F");
  
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICES SOUSCRITS", margin + 8, y + 6);
  
  y += 14;
  
  // Services table
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
  
  const services = data.services || [];
  services.forEach((service, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(margin, y - 2, pageWidth - margin * 2, 8, "F");
    }
    doc.text(service.name || "", margin + 5, y + 4);
    doc.text((service.description || "").substring(0, 40), margin + 60, y + 4);
    doc.text(formatCurrency(service.monthly_price), pageWidth - margin - 5, y + 4, { align: "right" });
    y += 8;
  });
  
  // Equipment if any
  if (data.equipment && data.equipment.length > 0) {
    y += 10;
    doc.setFillColor(...COLORS.accent);
    doc.rect(margin, y, 4, 8, "F");
    
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ÉQUIPEMENTS", margin + 8, y + 6);
    
    y += 12;
    
    data.equipment.forEach((equip, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(...COLORS.lightGray);
        doc.rect(margin, y - 2, pageWidth - margin * 2, 8, "F");
      }
      doc.setTextColor(...COLORS.text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(equip.name || "", margin + 5, y + 4);
      doc.text(formatCurrency(equip.price) + " (une fois)", pageWidth - margin - 5, y + 4, { align: "right" });
      y += 8;
    });
  }
  
  // Totals
  y += 10;
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(pageWidth / 2, y, pageWidth / 2 - margin, 20, 2, 2, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL MENSUEL", pageWidth / 2 + 8, y + 8);
  doc.text(formatCurrency(data.total_monthly), pageWidth - margin - 5, y + 8, { align: "right" });
  
  if (data.total_one_time > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Frais uniques", pageWidth / 2 + 8, y + 15);
    doc.text(formatCurrency(data.total_one_time), pageWidth - margin - 5, y + 15, { align: "right" });
  }
  
  drawFooter(doc, 1, totalPages);
  
  // === PAGE 2: TERMS ===
  addPage(doc);
  drawHeader(doc, "CONDITIONS GÉNÉRALES");
  
  y = 32;
  
  const terms = [
    {
      title: "1. DURÉE ET RÉSILIATION",
      content: "Le présent contrat est sans engagement et peut être résilié en tout temps par le client avec un préavis de 30 jours. Les services sont fournis sur une base mensuelle prépayée."
    },
    {
      title: "2. PAIEMENT",
      content: "Les services sont prépayés. Le paiement doit être reçu avant l'activation ou le renouvellement des services. Nivra Telecom accepte les virements Interac et PayPal. Les paiements sont dus avant la date d'échéance indiquée sur la facture."
    },
    {
      title: "3. ÉQUIPEMENT",
      content: "L'équipement fourni par Nivra Telecom demeure la propriété de Nivra Telecom et doit être retourné en bon état à la résiliation du contrat. Des frais peuvent s'appliquer pour l'équipement non retourné ou endommagé."
    },
    {
      title: "4. UTILISATION ACCEPTABLE",
      content: "Le client s'engage à utiliser les services conformément aux lois en vigueur et aux politiques d'utilisation acceptable de Nivra Telecom. Toute utilisation abusive peut entraîner la suspension ou la résiliation des services."
    },
    {
      title: "5. MODIFICATIONS",
      content: "Nivra Telecom se réserve le droit de modifier les tarifs et conditions avec un préavis de 30 jours. Le client peut résilier sans frais s'il n'accepte pas les modifications."
    },
    {
      title: "6. LIMITATION DE RESPONSABILITÉ",
      content: "Nivra Telecom n'est pas responsable des dommages indirects, consécutifs ou punitifs. La responsabilité totale de Nivra Telecom est limitée aux frais payés par le client au cours des trois derniers mois."
    },
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
    {
      title: "ANNEXE A — NIVEAUX DE SERVICE",
      content: "Nivra Telecom s'engage à fournir une disponibilité de service de 99.5% sur une base mensuelle. Les interruptions planifiées seront communiquées 48 heures à l'avance. En cas de panne majeure, un crédit proportionnel sera appliqué."
    },
    {
      title: "ANNEXE B — POLITIQUE DE CONFIDENTIALITÉ",
      content: "Nivra Telecom s'engage à protéger les renseignements personnels conformément à la Loi 25 du Québec. Les données sont collectées uniquement pour la fourniture des services et ne sont jamais vendues à des tiers."
    },
    {
      title: "ANNEXE C — PROCÉDURE DE PLAINTES",
      content: "Pour toute plainte, contactez support@nivra-telecom.ca. Nous nous engageons à répondre dans les 48 heures ouvrables. Si la plainte n'est pas résolue à votre satisfaction, vous pouvez contacter la CRTC."
    },
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
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, (pageWidth - margin * 3) / 2, 50, 3, 3, "F");
  
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SIGNATURE DU CLIENT", margin + 5, y + 10);
  
  doc.setDrawColor(...COLORS.text);
  doc.line(margin + 10, y + 35, margin + (pageWidth - margin * 3) / 2 - 10, y + 35);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textLight);
  doc.text("Signature", margin + 10, y + 40);
  doc.text("Date: ___ / ___ / ______", margin + 10, y + 46);
  
  // Agent signature box
  const agentX = margin + (pageWidth - margin * 3) / 2 + margin;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(agentX, y, (pageWidth - margin * 3) / 2, 50, 3, 3, "F");
  
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("REPRÉSENTANT NIVRA", agentX + 5, y + 10);
  
  doc.setDrawColor(...COLORS.text);
  doc.line(agentX + 10, y + 35, agentX + (pageWidth - margin * 3) / 2 - 10, y + 35);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textLight);
  doc.text("Signature", agentX + 10, y + 40);
  doc.text(`Agent: ${data.agent_name || "_______________"}`, agentX + 10, y + 46);
  
  drawFooter(doc, 4, totalPages);
  
  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// SUMMARY PDF GENERATOR  
// ============================================================================

export interface SummaryData {
  order_number: string;
  order_date: string;
  status: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  services: Array<{
    name: string;
    price: number;
    is_recurring: boolean;
  }>;
  subtotal_recurring: number;
  subtotal_one_time: number;
  tps: number;
  tvq: number;
  total: number;
  installation_date?: string;
}

export function generateSummaryPDF(data: SummaryData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  
  // Force white background
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  
  drawHeader(doc, "SOMMAIRE DE COMMANDE");
  
  let y = 32;
  
  // Order info banner
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 3, 3, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Commande #${data.order_number || "CMD-XXXX"}`, margin + 5, y + 9);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${formatDate(data.order_date)}`, margin + 5, y + 16);
  doc.text(`Statut: ${data.status || "En attente"}`, pageWidth / 2, y + 16);
  
  y += 32;
  
  // Client section
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Informations client", margin, y);
  
  y += 8;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, "F");
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.text(`Nom: ${data.client_name || "N/A"}`, margin + 5, y + 8);
  doc.text(`Courriel: ${data.client_email || "N/A"}`, margin + 5, y + 15);
  doc.text(`Téléphone: ${data.client_phone || "N/A"}`, margin + 5, y + 22);
  doc.text(`Adresse: ${data.client_address || "N/A"}`, pageWidth / 2, y + 8);
  
  if (data.installation_date) {
    doc.setFont("helvetica", "bold");
    doc.text(`Installation: ${formatDate(data.installation_date)}`, pageWidth / 2, y + 22);
  }
  
  y += 38;
  
  // Services
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Services commandés", margin, y);
  
  y += 8;
  
  doc.setFillColor(...COLORS.primary);
  doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICE", margin + 5, y + 5.5);
  doc.text("TYPE", pageWidth / 2, y + 5.5);
  doc.text("PRIX", pageWidth - margin - 5, y + 5.5, { align: "right" });
  
  y += 10;
  
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  
  const services = data.services || [];
  services.forEach((service, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(margin, y - 2, pageWidth - margin * 2, 8, "F");
    }
    doc.text(service.name || "", margin + 5, y + 4);
    doc.text(service.is_recurring ? "Mensuel" : "Une fois", pageWidth / 2, y + 4);
    doc.text(formatCurrency(service.price), pageWidth - margin - 5, y + 4, { align: "right" });
    y += 8;
  });
  
  y += 10;
  
  // Totals
  const totals = [
    { label: "Mensuel récurrent:", value: formatCurrency(data.subtotal_recurring) },
    { label: "Frais uniques:", value: formatCurrency(data.subtotal_one_time) },
    { label: "TPS (5%):", value: formatCurrency(data.tps) },
    { label: "TVQ (9.975%):", value: formatCurrency(data.tvq) },
  ];
  
  totals.forEach((item) => {
    doc.text(item.label, pageWidth / 2 + 10, y);
    doc.text(item.value, pageWidth - margin - 5, y, { align: "right" });
    y += 6;
  });
  
  y += 5;
  
  // Total box
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(pageWidth / 2, y, pageWidth / 2 - margin, 12, 2, 2, "F");
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", pageWidth / 2 + 8, y + 8);
  doc.text(formatCurrency(data.total), pageWidth - margin - 5, y + 8, { align: "right" });
  
  drawFooter(doc, 1, 1);
  
  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// CONTRACT SUMMARY (RRE) PDF GENERATOR — 1 page
// ============================================================================

export interface ContractSummaryData {
  account_number: string;
  contract_number: string;
  order_number: string;
  effective_date: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  services: Array<{ name: string; monthly_price: number }>;
  equipment: Array<{ name: string; price: number }>;
  total_monthly: number;
  total_one_time: number;
  tps_monthly: number;
  tvq_monthly: number;
  total_monthly_with_tax: number;
  payment_method: string;
  bill_cycle_day: number;
  terms_version: string;
}

export function generateContractSummaryPDF(data: ContractSummaryData): string {
  // HARD STOP: account_number is mandatory
  if (!data.account_number || data.account_number === 'N/A' || data.account_number === '000000') {
    throw new Error('MISSING_ACCOUNT_NUMBER: Impossible de générer le RRE sans numéro de compte valide.');
  }
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  drawHeader(doc, "RÉSUMÉ DU CONTRAT");

  let y = 32;

  // Title banner
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 14, 3, 3, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FICHE ESSENTIELLE — RÉSUMÉ DES INFORMATIONS CRITIQUES", pageWidth / 2, y + 9, { align: "center" });
  y += 22;

  // Reference block
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 3, 3, "F");
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Compte:", margin + 5, y + 7);
  doc.text("Contrat:", margin + 5, y + 14);
  doc.text("Commande:", pageWidth / 2, y + 7);
  doc.text("Date effective:", pageWidth / 2, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text(data.account_number, margin + 30, y + 7);
  doc.text(data.contract_number, margin + 30, y + 14);
  doc.text(data.order_number, pageWidth / 2 + 30, y + 7);
  doc.text(formatDate(data.effective_date), pageWidth / 2 + 38, y + 14);
  y += 26;

  // Client block
  doc.setFillColor(...COLORS.accent);
  doc.rect(margin, y, 3, 8, "F");
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENT", margin + 7, y + 6);
  y += 12;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text(`Nom: ${data.client_name}`, margin + 5, y);
  doc.text(`Courriel: ${data.client_email}`, margin + 5, y + 6);
  doc.text(`Téléphone: ${data.client_phone}`, margin + 5, y + 12);
  doc.text(`Adresse: ${data.client_address}`, margin + 5, y + 18);
  y += 26;

  // Services table
  doc.setFillColor(...COLORS.accent);
  doc.rect(margin, y, 3, 8, "F");
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICES SOUSCRITS", margin + 7, y + 6);
  y += 12;

  doc.setFillColor(...COLORS.primary);
  doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("SERVICE", margin + 5, y + 5);
  doc.text("MENSUEL", pageWidth - margin - 5, y + 5, { align: "right" });
  y += 9;

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  data.services.forEach((s, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.lightGray);
      doc.rect(margin, y - 2, pageWidth - margin * 2, 7, "F");
    }
    doc.text(s.name, margin + 5, y + 3);
    doc.text(formatCurrency(s.monthly_price), pageWidth - margin - 5, y + 3, { align: "right" });
    y += 7;
  });

  // Equipment
  if (data.equipment.length > 0) {
    y += 4;
    doc.setFillColor(...COLORS.accent);
    doc.rect(margin, y, 3, 8, "F");
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("FRAIS UNIQUES / ÉQUIPEMENT", margin + 7, y + 6);
    y += 12;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.text);
    data.equipment.forEach((e) => {
      doc.text(e.name, margin + 5, y);
      doc.text(formatCurrency(e.price), pageWidth - margin - 5, y, { align: "right" });
      y += 6;
    });
  }

  // Totals
  y += 6;
  doc.setDrawColor(...COLORS.border);
  doc.line(pageWidth / 2, y, pageWidth - margin, y);
  y += 6;

  const totals = [
    { label: "Total mensuel (avant taxes)", value: formatCurrency(data.total_monthly) },
    { label: "TPS (5%)", value: formatCurrency(data.tps_monthly) },
    { label: "TVQ (9.975%)", value: formatCurrency(data.tvq_monthly) },
    { label: "Frais uniques", value: formatCurrency(data.total_one_time) },
  ];

  doc.setFontSize(9);
  totals.forEach((t) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.text);
    doc.text(t.label, pageWidth / 2 + 5, y);
    doc.text(t.value, pageWidth - margin - 5, y, { align: "right" });
    y += 6;
  });

  y += 2;
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(pageWidth / 2, y, pageWidth / 2 - margin, 10, 2, 2, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL MENSUEL", pageWidth / 2 + 5, y + 7);
  doc.text(formatCurrency(data.total_monthly_with_tax), pageWidth - margin - 5, y + 7, { align: "right" });

  y += 18;

  // Payment & billing info
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 3, 3, "F");
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Mode de paiement:", margin + 5, y + 7);
  doc.text("Jour de facturation:", margin + 5, y + 14);
  doc.text("Modalités de service:", pageWidth / 2, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  doc.text(data.payment_method, margin + 48, y + 7);
  doc.text(`Le ${data.bill_cycle_day} de chaque mois`, margin + 48, y + 14);
  doc.text(data.terms_version, pageWidth / 2 + 42, y + 7);

  y += 28;

  // Legal note
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...COLORS.textLight);
  doc.text("Service prépayé — Le cycle commence après confirmation du paiement.", margin, y);
  doc.text("En cas de non-renouvellement, le service expire à la fin de la période payée. Aucune dette n'est créée.", margin, y + 4);

  drawFooter(doc, 1, 1);
  return doc.output("datauristring").split(",")[1];
}

// ============================================================================
// EXPORT
// ============================================================================

export type PDFType = 'invoice' | 'contract' | 'summary' | 'contract_summary';

export interface PDFAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
}

export function generatePDFAttachment(
  type: PDFType, 
  data: InvoiceData | ContractData | SummaryData | ContractSummaryData
): PDFAttachment | null {
  try {
    switch (type) {
      case 'invoice':
        return {
          filename: `Facture-${(data as InvoiceData).invoice_number || 'Nivra'}.pdf`,
          content: generateInvoicePDF(data as InvoiceData),
          contentType: 'application/pdf',
        };
      case 'contract':
        return {
          filename: `Contrat-${(data as ContractData).contract_number || 'Nivra'}.pdf`,
          content: generateContractPDF(data as ContractData),
          contentType: 'application/pdf',
        };
      case 'summary':
        return {
          filename: `Sommaire-${(data as SummaryData).order_number || 'Nivra'}.pdf`,
          content: generateSummaryPDF(data as SummaryData),
          contentType: 'application/pdf',
        };
      case 'contract_summary':
        return {
          filename: `Resume-Contrat-${(data as ContractSummaryData).contract_number || 'Nivra'}.pdf`,
          content: generateContractSummaryPDF(data as ContractSummaryData),
          contentType: 'application/pdf',
        };
      default:
        return null;
    }
  } catch (error) {
    console.error(`[pdfGenerator] Error generating ${type} PDF:`, error);
    return null;
  }
}
