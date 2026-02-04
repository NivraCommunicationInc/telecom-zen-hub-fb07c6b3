/**
 * Generate a standalone PDF for Contract Summary (Résumé du contrat)
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ContractSummaryData } from "@/components/contract/ContractSummaryView";
import { BUSINESS_INFO } from "./contractPolicies";

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount);
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return "À confirmer";
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

export async function generateContractSummaryPDF(data: ContractSummaryData): Promise<void> {
  // ================================================================================
  // VALIDATION: Block if required client fields missing (per Nivra standard)
  // Required: legalName, email, phone, serviceAddress, billingAddress (fallback to serviceAddress OK)
  // ================================================================================
  const requiredFields = ["legalName", "email", "phone", "serviceAddress"];
  const missingFields = requiredFields.filter(field => {
    const value = (data.client as any)[field];
    return !value || String(value).trim() === "";
  });
  
  // billing_address check: fallback to service_address is allowed
  const hasBillingAddress = (data.client as any).billingAddress || (data.client as any).serviceAddress;
  if (!hasBillingAddress) {
    missingFields.push("billingAddress");
  }
  
  if (missingFields.length > 0) {
    const errorMsg = `Coordonnées client incomplètes — impossible de générer le document. Champs manquants: ${missingFields.join(", ")}`;
    console.error("[ContractSummaryPDF] VALIDATION BLOCKED:", errorMsg);
    throw new Error(errorMsg);
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 15;

  // Colors
  const primaryNavy: [number, number, number] = [15, 23, 42];
  const accentTeal: [number, number, number] = [20, 184, 166];
  const textDark: [number, number, number] = [30, 41, 59];
  const textMuted: [number, number, number] = [100, 116, 139];
  const borderLight: [number, number, number] = [203, 213, 225];
  const bgLight: [number, number, number] = [248, 250, 252];
  const white: [number, number, number] = [255, 255, 255];

  // Helper to add section title
  const addSectionTitle = (title: string) => {
    currentY += 4;
    doc.setFillColor(...primaryNavy);
    doc.rect(marginLeft, currentY - 3, contentWidth, 6, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(title.toUpperCase(), marginLeft + 2, currentY + 1);
    currentY += 8;
  };

  const addLabelValue = (label: string, value: string) => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text(`${label}:`, marginLeft, currentY);
    doc.setTextColor(...textDark);
    doc.text(value || "À confirmer", marginLeft + 50, currentY);
    currentY += 4.5;
  };

  // ========== HEADER — NIVRA OFFICIAL INFO ==========
  doc.setFillColor(...accentTeal);
  doc.rect(0, 0, pageWidth, 3, "F");
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 3, pageWidth, 22, "F");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("NIVRA COMMUNICATIONS INC.", pageWidth / 2, 12, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(...accentTeal);
  doc.text("RÉSUMÉ DU CONTRAT", pageWidth / 2, 20, { align: "center" });

  currentY = 32;

  // Contract reference box - ALL required numbers (CTR#, ORD#, INV#, Compte#)
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(marginLeft, currentY, contentWidth, 20, 1, 1, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  // Row 1: CTR# and ORD#
  doc.text(`Contrat #: ${data.contractNumber || "CTR-" + (data.orderId.slice(0, 8))}`, marginLeft + 3, currentY + 5);
  doc.text(`Commande #: ${data.orderNumber || "ORD-" + (data.orderId.slice(0, 8))}`, marginLeft + 65, currentY + 5);
  doc.text(`Date: ${formatDate(data.snapshotCreatedAt)}`, marginLeft + 130, currentY + 5);
  // Row 2: INV# (if exists), Compte#, Version
  doc.setFont("helvetica", "normal");
  const invoiceNumber = (data as any).invoiceNumber || "INV-" + (data.orderId.slice(0, 8));
  doc.text(`Facture #: ${invoiceNumber}`, marginLeft + 3, currentY + 12);
  doc.text(`Compte #: ${data.accountNumber || data.client.accountId || "À confirmer"}`, marginLeft + 65, currentY + 12);
  doc.text(`Version: ${data.agreementVersion || 1}`, marginLeft + 130, currentY + 12);
  currentY += 26;

  // ========== CLIENT SECTION ==========
  addSectionTitle("Client");
  addLabelValue("Nom légal", data.client.legalName);
  addLabelValue("Téléphone", data.client.phone);
  addLabelValue("Courriel", data.client.email);
  addLabelValue("Adresse de service", `${data.client.serviceAddress || ""}, ${data.client.serviceCity || ""} ${data.client.serviceProvince || "QC"} ${data.client.servicePostalCode || ""}`);
  if (data.client.billingAddress && data.client.billingAddress !== data.client.serviceAddress) {
    addLabelValue("Adresse de facturation", data.client.billingAddress);
  }
  addLabelValue("ID compte client", data.accountNumber || data.client.accountId || "À confirmer");
  currentY += 2;

  // ========== SERVICES SECTION — ONE LINE PER SERVICE (MANDATORY) ==========
  addSectionTitle("Services souscrits (détail ligne par ligne)");
  
  // Calculate totals for monthly services
  const totalMonthly = data.services.reduce((sum, s) => sum + (s.monthlyPrice || 0), 0) + 
    (data.tvChannels?.premiumTotal || 0);

  // Render EACH service on its OWN row - never combine
  data.services.forEach(service => {
    doc.setFontSize(7);
    
    // Service type badge
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...accentTeal);
    doc.text(service.type.toUpperCase(), marginLeft, currentY);
    
    // Service name
    doc.setTextColor(...textDark);
    doc.text(service.planName || service.type, marginLeft + 22, currentY);
    
    // Speed if applicable
    if (service.speed) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textMuted);
      doc.text(`Vitesse: ${service.speed}`, marginLeft + 85, currentY);
    }
    
    // Price - always on its own column
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(formatCurrency(service.monthlyPrice) + "/mois", marginLeft + 135, currentY);
    currentY += 5;

    // Portability info on separate line
    if (service.portability) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textMuted);
      doc.setFontSize(6);
      doc.text(`   → Portabilité: Oui | Numéro: ${service.numberToPort || "À confirmer"}`, marginLeft + 5, currentY);
      currentY += 4;
    }
  });

  // TV Channels summary (counts only, never individual channels)
  if (data.tvChannels) {
    currentY += 2;
    doc.setTextColor(...textMuted);
    doc.setFontSize(6);
    doc.text(`Chaînes de base: ${data.tvChannels.baseChannels || 25}/26 | Au choix: ${data.tvChannels.freeChoiceCount || 0} | Premium: ${data.tvChannels.premiumCount || 0} (${formatCurrency(data.tvChannels.premiumTotal || 0)})`, marginLeft + 5, currentY);
    currentY += 4;
  }

  // Subtotal monthly
  doc.setDrawColor(...borderLight);
  doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
  currentY += 4;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.setFontSize(8);
  doc.text(`Sous-total mensuel (avant taxes): ${formatCurrency(totalMonthly)}/mois`, marginLeft, currentY);
  currentY += 6;

  // ========== DATES & BILLING CYCLE (PREPAID) ==========
  addSectionTitle("Dates et cycle de facturation");
  addLabelValue("Date création compte", formatDate(data.dates.accountCreated));
  addLabelValue("Jour du cycle (Bill Cycle)", data.dates.billCycleDay ? String(data.dates.billCycleDay) : "À confirmer après paiement");
  addLabelValue("Date d'activation prévue", formatDate(data.dates.activationDate));
  addLabelValue("Prochaine facture", formatDate(data.dates.nextInvoiceDate));
  if (data.dates.dueDate) {
    addLabelValue("Échéance", formatDate(data.dates.dueDate));
  }
  
  // CRITICAL: Prepaid cycle notice
  currentY += 2;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...accentTeal);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, currentY, contentWidth, 12, 1, 1, "FD");
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("IMPORTANT: Le cycle de facturation commence uniquement après confirmation du paiement Interac.", marginLeft + 3, currentY + 5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.text("Les dates ci-dessus sont provisoires et seront confirmées à la réception du paiement.", marginLeft + 3, currentY + 9);
  currentY += 16;

  // ========== ONE-TIME FEES (BLOC B) ==========
  addSectionTitle("BLOC B — Frais uniques (une seule fois)");

  const fees = data.oneTimeFees;
  let oneTimeFeeTotal = 0;
  
  // Each fee on its own line
  if (fees.activationFee && fees.activationFee > 0) {
    const serviceCount = data.services.length;
    const feeLabel = serviceCount >= 2 ? "Frais d'activation (forfait groupé 2+ services)" : "Frais d'activation (1 service)";
    addLabelValue(feeLabel, formatCurrency(fees.activationFee));
    oneTimeFeeTotal += fees.activationFee;
  }
  if (fees.router && fees.router > 0) {
    addLabelValue("Routeur Nivra Born WiFi", formatCurrency(fees.router));
    oneTimeFeeTotal += fees.router;
  }
  if (fees.terminal4k && fees.terminal4k > 0) {
    addLabelValue("Terminal TV 4K", formatCurrency(fees.terminal4k));
    oneTimeFeeTotal += fees.terminal4k;
  }
  if (fees.installationFee && fees.installationFee > 0) {
    addLabelValue("Installation standard", formatCurrency(fees.installationFee));
    oneTimeFeeTotal += fees.installationFee;
  }
  if (fees.installationComplex && fees.installationComplex > 0) {
    addLabelValue("Installation complexe", formatCurrency(fees.installationComplex));
    oneTimeFeeTotal += fees.installationComplex;
  }
  if (fees.deliveryFee && fees.deliveryFee > 0) {
    addLabelValue("Livraison standard Québec", formatCurrency(fees.deliveryFee));
    oneTimeFeeTotal += fees.deliveryFee;
  }
  
  // One-time subtotal with taxes
  const oneTimeTps = Math.round(oneTimeFeeTotal * 0.05 * 100) / 100;
  const oneTimeTvq = Math.round(oneTimeFeeTotal * 0.09975 * 100) / 100;
  const oneTimeTotalWithTax = oneTimeFeeTotal + oneTimeTps + oneTimeTvq;
  
  doc.setDrawColor(...borderLight);
  doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
  currentY += 3;
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text(`Sous-total unique: ${formatCurrency(oneTimeFeeTotal)} | TPS: ${formatCurrency(oneTimeTps)} | TVQ: ${formatCurrency(oneTimeTvq)}`, marginLeft, currentY);
  currentY += 3;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.setFontSize(7);
  doc.text(`Total frais uniques avec taxes: ${formatCurrency(oneTimeTotalWithTax)}`, marginLeft, currentY);
  currentY += 6;
  
  // Reactivation fee notice
  doc.setTextColor(...textMuted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.text("Frais de réactivation (si applicable après suspension): 15 $", marginLeft, currentY);
  currentY += 6;

  // ========== PAYMENT SECTION — INTERAC ONLY (MANDATORY) ==========
  addSectionTitle("Paiement — Interac seulement");
  
  // CRITICAL: Interac-only payment notice (per Billing V2 requirements)
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...accentTeal);
  doc.setLineWidth(0.8);
  doc.roundedRect(marginLeft, currentY, contentWidth, 22, 1, 1, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("Paiement uniquement par virement Interac à Support@nivra-telecom.ca", marginLeft + 3, currentY + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.setFontSize(6);
  doc.text("Le service est activé dès réception et confirmation du paiement. Aucun paiement par carte n'est accepté.", marginLeft + 3, currentY + 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentTeal);
  doc.text("Le cycle de facturation commence uniquement à la date de confirmation du paiement Interac.", marginLeft + 3, currentY + 18);
  currentY += 26;
  
  const methodLabel = data.payment.method === "card" ? "Carte (non disponible)" : 
                      data.payment.method === "etransfer" ? "Virement Interac ✓" : 
                      `Autre: ${data.payment.method}`;
  addLabelValue("Mode sélectionné", methodLabel);
  if (data.payment.method === "etransfer" && data.payment.etransferRule) {
    const ruleLabel = data.payment.etransferRule === "after_receipt" 
      ? "Après réception" 
      : "Après réception et vérification";
    addLabelValue("Règle activation", ruleLabel);
  }
  if (data.payment.deposit && data.payment.deposit > 0) {
    addLabelValue("Dépôt", formatCurrency(data.payment.deposit));
    if (data.payment.depositConditions) {
      addLabelValue("Conditions dépôt", data.payment.depositConditions);
    }
  }
  currentY += 4;

  // ========== ACCEPTANCE SECTION ==========
  addSectionTitle("Acceptation");
  doc.setFontSize(6);
  doc.setTextColor(...textDark);
  const acceptanceText = "Le Client déclare avoir lu et accepté : Annexe A — Termes & Conditions, Annexe B — Conditions spécifiques, Annexe C — Installation, Annexe D — Paiements, Annexe E — Support/SLA (si applicable).";
  const lines = doc.splitTextToSize(acceptanceText, contentWidth);
  doc.text(lines, marginLeft, currentY);
  currentY += lines.length * 3.5 + 6;

  // Signature boxes
  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 25;

  // Client signature
  doc.setDrawColor(...borderLight);
  doc.setFillColor(...bgLight);
  doc.roundedRect(marginLeft, currentY, sigBoxWidth, sigBoxHeight, 1, 1, "FD");
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text("Signature Client: _________________", marginLeft + 3, currentY + 10);
  doc.text("Date: ___/___/______", marginLeft + 3, currentY + 18);

  // Nivra signature
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(marginLeft + sigBoxWidth + 10, currentY, sigBoxWidth, sigBoxHeight, 1, 1, "F");
  doc.setTextColor(...white);
  doc.text("Signature Nivra: _________________", marginLeft + sigBoxWidth + 13, currentY + 10);
  doc.text("Date: ___/___/______", marginLeft + sigBoxWidth + 13, currentY + 18);

  // Footer — NIVRA OFFICIAL INFO (ALWAYS PRESENT)
  // MANDATORY: Nivra Communications Inc., 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(5);
  doc.setTextColor(...textMuted);
  doc.text(
    `${BUSINESS_INFO.legalName} — ${BUSINESS_INFO.address}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );
  doc.text(
    `${BUSINESS_INFO.email} — ${BUSINESS_INFO.phone}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: "center" }
  );

  // Download
  const fileName = `Resume_Contrat_${data.contractNumber || data.orderNumber || data.orderId.slice(0, 8)}.pdf`;
  doc.save(fileName);
}

export default generateContractSummaryPDF;
