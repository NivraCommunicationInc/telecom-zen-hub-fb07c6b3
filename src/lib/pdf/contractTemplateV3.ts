/**
 * Nivra Contract Template V3.0 — TELUS-Grade
 * 
 * 4-page professional service agreement:
 * - Page 1: Cover (contract ID, client info, services, equipment, totals)
 * - Page 2: Terms & Conditions
 * - Page 3: Annexes (A-C)
 * - Page 4: Signatures + terms version reference
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA, TAX, PDF_THEME } from "./companyInfo";

const C = PDF_THEME;

// ============================================================================
// CONTRACT DATA INTERFACE
// ============================================================================

export interface ContractDataV3 {
  contract_number: string;
  contract_date: string;
  terms_version: string;

  // Client
  client_name: string;
  client_email: string;
  client_phone: string;
  client_dob?: string;
  billing_address: string;
  service_address: string;

  // Account
  account_number: string;
  order_number: string;

  // Services
  services: Array<{
    type: string;
    name: string;
    description?: string;
    monthly_price: number;
  }>;

  // Equipment
  equipment: Array<{
    name: string;
    quantity: number;
    unit_price: number;
  }>;

  // Fees
  one_time_fees: Array<{
    label: string;
    amount: number;
  }>;

  // Totals
  subtotal_monthly: number;
  subtotal_one_time: number;
  discount_amount: number;
  tax_gst: number;
  tax_qst: number;
  total_due_today: number;

  // Payment
  payment_method?: string;

  // Client signature
  signature_name?: string;
  signature_date?: string;
  signature_ip?: string;
  is_signed?: boolean;

  // Admin signature
  admin_signature_name?: string;
  admin_signature_date?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

const fmtDate = (dateStr: string | undefined): string => {
  if (!dateStr) {
    console.warn("[ContractV3] Date manquante");
    return "Non fourni par le client";
  }
  try { return new Date(dateStr).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return dateStr; }
};

/** For critical fields that MUST be present on the document */
const critical = (value: string | undefined | null, fieldName: string): string => {
  if (!value || value === "—" || value === "N/A" || value.trim() === "") {
    console.warn(`[ContractV3] Champ critique manquant: ${fieldName}`);
    return "Non fourni par le client";
  }
  return value;
};

const fmtPayMethod = (m: string | undefined): string => {
  if (!m) return "Non fourni par le client";
  const map: Record<string, string> = {
    PayPal: "PayPal", paypal: "PayPal", Interac: "Virement Interac",
    interac: "Virement Interac", e_transfer: "Virement Interac",
    "Credit Card": "Carte de crédit", card: "Carte de crédit",
  };
  return map[m] || m;
};

// ============================================================================
// PAGE COMPONENTS
// ============================================================================

function drawHeader(doc: jsPDF, title: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pw, 28, "F");
  doc.setFillColor(...C.teal);
  doc.rect(0, 28, pw, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.white);
  doc.text(NIVRA.legalName, 15, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 210);
  doc.text(NIVRA.address, 15, 19);
  doc.text(NIVRA.email, 15, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.teal);
  doc.text(title, pw - 15, 14, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...C.navy);
  doc.rect(0, ph - 14, pw, 14, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 9, { align: "center" });
  doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`, pw / 2, ph - 5, { align: "center" });
  doc.setFontSize(7);
  doc.text(`Page ${pageNum} / ${totalPages}`, pw - 15, ph - 7, { align: "right" });
}

function addNewPage(doc: jsPDF) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(...C.white);
  doc.rect(0, 0, pw, ph, "F");
}

function sectionTitle(doc: jsPDF, title: string, y: number, m: number, cw: number): number {
  doc.setFillColor(...C.lightBg);
  doc.rect(m, y, cw, 7, "F");
  doc.setFillColor(...C.teal);
  doc.rect(m, y, 3, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.navy);
  doc.text(title, m + 7, y + 5);
  return y + 10;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateContractV3PDF(data: ContractDataV3): PDFGenerationResult {
  try {
    if (!data.contract_number) return { success: false, error: "Numéro de contrat manquant" };
    if (!data.client_name || !data.client_email) return { success: false, error: "Informations client incomplètes" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;
    const cw = pw - m * 2;
    const totalPages = 4;

    doc.setFillColor(...C.white);
    doc.rect(0, 0, pw, ph, "F");

    // === PAGE 1: COVER ===
    drawHeader(doc, "CONTRAT DE SERVICE");
    let y = 36;

    // Contract ID banner
    doc.setFillColor(...C.blue);
    doc.roundedRect(m, y, cw, 18, 2, 2, "F");
    doc.setTextColor(...C.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Contrat Nº ${data.contract_number}`, pw / 2, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Date d'entrée en vigueur: ${fmtDate(data.contract_date)} | Commande: ${data.order_number}`, pw / 2, y + 14, { align: "center" });
    y += 24;

    // Client info
    y = sectionTitle(doc, "INFORMATIONS DU CLIENT", y, m, cw);

    doc.setFillColor(...C.lightBg);
    doc.roundedRect(m, y, cw, 42, 2, 2, "F");

    const fields = [
      ["Nom complet", critical(data.client_name, "client_name")],
      ["Courriel", critical(data.client_email, "client_email")],
      ["Téléphone", critical(data.client_phone, "client_phone")],
      ["Adresse de facturation", critical(data.billing_address, "billing_address")],
      ["Adresse de service", critical(data.service_address, "service_address")],
      ["N° compte", critical(data.account_number, "account_number")],
    ];

    let fy = y + 6;
    fields.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMuted);
      doc.text(`${label}:`, m + 5, fy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.text((value || "—").substring(0, 55), m + 48, fy);
      fy += 6;
    });
    y += 46;

    // Services
    if (data.services.length > 0) {
      y = sectionTitle(doc, "SERVICES SOUSCRITS", y, m, cw);

      // Table header
      doc.setFillColor(...C.navy);
      doc.rect(m, y, cw, 7, "F");
      doc.setTextColor(...C.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("TYPE", m + 3, y + 5);
      doc.text("PLAN / DESCRIPTION", m + 30, y + 5);
      doc.text("MENSUEL", pw - m - 3, y + 5, { align: "right" });
      y += 9;

      data.services.forEach((svc, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 252);
          doc.rect(m, y - 1, cw, 7, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.teal);
        doc.text(svc.type.toUpperCase(), m + 3, y + 4);
        doc.setTextColor(...C.text);
        doc.text(svc.name + (svc.description ? ` — ${svc.description}` : ""), m + 30, y + 4);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(svc.monthly_price), pw - m - 3, y + 4, { align: "right" });
        y += 7;
      });
      y += 3;
    }

    // Equipment
    if (data.equipment.length > 0) {
      y = sectionTitle(doc, "ÉQUIPEMENTS (FRAIS UNIQUES)", y, m, cw);

      data.equipment.forEach((eq, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 252);
          doc.rect(m, y - 1, cw, 7, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text(eq.name, m + 5, y + 4);
        doc.text(`${eq.quantity}x`, m + 100, y + 4);
        doc.setFont("helvetica", "bold");
        doc.text(fmt(eq.unit_price * eq.quantity), pw - m - 3, y + 4, { align: "right" });
        y += 7;
      });
      y += 3;
    }

    // One-time fees
    if (data.one_time_fees.length > 0) {
      y = sectionTitle(doc, "AUTRES FRAIS UNIQUES", y, m, cw);
      data.one_time_fees.forEach((fee) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text(fee.label, m + 5, y + 4);
        doc.text(fmt(fee.amount), pw - m - 3, y + 4, { align: "right" });
        y += 7;
      });
      y += 3;
    }

    // ── CONTRACT FINANCIAL SUMMARY (commercially clear for prepaid) ──
    y += 5;
    const totX = pw / 2;
    const netMonthly = Math.max(0, data.subtotal_monthly - data.discount_amount);

    // Calculate box height dynamically
    let boxLines = 3; // monthly, discount/net, one-time fees
    if (data.discount_amount > 0) boxLines += 1;
    const boxH = 7 + boxLines * 6 + 14; // header padding + lines + note area
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(totX, y, pw / 2 - m, boxH, 2, 2, "F");

    let ty = y + 7;
    const drawTot = (label: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.text(label, totX + 5, ty);
      doc.text(value, pw - m - 5, ty, { align: "right" });
      ty += 6;
    };

    drawTot("Services mensuels récurrents:", fmt(data.subtotal_monthly));
    if (data.discount_amount > 0) {
      drawTot("Rabais 1ère période:", `- ${fmt(data.discount_amount)}`);
      drawTot("Net mensuel (1ère période prépayée):", fmt(netMonthly), true);
    }
    if (data.subtotal_one_time > 0) {
      drawTot("Frais uniques applicables:", fmt(data.subtotal_one_time));
    }

    // Note instead of misleading total
    ty += 2;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    const noteLines = doc.splitTextToSize(
      "Le montant total facturé incluant taxes est détaillé sur la facture officielle jointe à ce contrat.",
      pw / 2 - m - 10
    );
    doc.text(noteLines, totX + 5, ty);

    drawFooter(doc, 1, totalPages);

    // === PAGE 2: TERMS ===
    addNewPage(doc);
    drawHeader(doc, "CONDITIONS GÉNÉRALES");
    y = 36;

    // Payment method section — consistent with actual provider
    y += 5;
    y = sectionTitle(doc, "MODE DE PAIEMENT", y, m, cw);
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(m, y, cw, 16, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.text);
    const payMethodLabel = fmtPayMethod(data.payment_method);
    doc.text(`Mode de paiement sélectionné : ${payMethodLabel}`, m + 5, y + 6);
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    // Provider-specific cycle text — no contradictions
    const isPayPalContract = data.payment_method?.toLowerCase()?.includes("paypal");
    const isInteracContract = data.payment_method?.toLowerCase()?.includes("interac") || data.payment_method?.toLowerCase()?.includes("e_transfer");
    const cycleTextContract = isPayPalContract
      ? "Le cycle de facturation commence après confirmation du paiement PayPal."
      : isInteracContract
        ? "Le cycle de facturation commence après confirmation du virement Interac."
        : "Le cycle de facturation commence après confirmation du paiement par le fournisseur sélectionné.";
    doc.text(cycleTextContract, m + 5, y + 12);
    y += 20;

    const terms = [
      { title: "1. DURÉE ET RÉSILIATION", content: "Le présent contrat est sans engagement et peut être résilié en tout temps par le client avec un préavis de 30 jours. Les services sont fournis sur une base mensuelle prépayée. Aucuns frais de résiliation ne s'appliquent. À la résiliation, le client doit retourner tout équipement fourni dans les 15 jours." },
      { title: "2. PAIEMENT ET FACTURATION", content: "Les services sont prépayés. Le paiement doit être reçu et confirmé avant l'activation ou le renouvellement. Nivra accepte les virements Interac, PayPal et cartes de crédit. Le cycle de facturation commence à la date de confirmation du paiement. Sans paiement confirmé à la date de renouvellement (J0), le service expire automatiquement." },
      { title: "3. PAIEMENT AUTOMATIQUE (AUTOPAY)", content: "Le client peut activer le prélèvement automatique mensuel via carte de crédit enregistrée de manière sécurisée. Tant que le paiement automatique est actif, un rabais mensuel de 5,00 $ est appliqué sur les services récurrents admissibles. Ce rabais est retiré immédiatement et sans préavis si le client désactive le paiement automatique, et s'applique uniquement aux factures futures générées après la réactivation — il n'est jamais rétroactif. Le montant est prélevé automatiquement 3 jours avant la date de renouvellement du cycle." },
      { title: "4. SUSPENSION POUR NON-PAIEMENT", content: "En cas de non-paiement à la date de renouvellement (J0), le service n'est pas renouvelé et passe au statut « Expiré ». Aucun intérêt ni frais de réactivation ne s'appliquent pour un non-renouvellement normal. Après 90 jours sans renouvellement, le numéro de téléphone peut devenir irrécupérable et un nouveau numéro sera requis. Des intérêts de 5 % par mois et des frais de réactivation de 15 $ s'appliquent UNIQUEMENT en cas de litiges bancaires ou de rétrofacturations." },
      { title: "5. ÉQUIPEMENT", content: "L'équipement fourni (routeur, terminal TV, carte SIM, etc.) demeure la propriété de Nivra Communications Inc. et doit être retourné en bon état à la résiliation. Des frais de remplacement s'appliquent pour équipement non retourné ou endommagé. Garantie fabricant de 12 mois dès activation. Perte, vol et dommages causés par le client sont exclus sauf approbation interne." },
      { title: "6. UTILISATION ACCEPTABLE", content: "Le client s'engage à utiliser les services conformément aux lois en vigueur au Canada et au Québec. Toute utilisation abusive, frauduleuse ou contraire aux politiques de Nivra peut entraîner la suspension immédiate des services sans préavis ni compensation." },
      { title: "7. MODIFICATIONS TARIFAIRES", content: "Nivra se réserve le droit de modifier les tarifs, frais et conditions applicables avec un préavis écrit de 30 jours transmis par courriel. Le client peut résilier sans frais s'il n'accepte pas les modifications, dans les 30 jours suivant la réception de l'avis. L'utilisation continue des services après ce délai constitue l'acceptation des nouvelles conditions." },
      { title: "8. LIMITATION DE RESPONSABILITÉ", content: "Nivra Communications Inc. n'est pas responsable des dommages indirects, consécutifs, spéciaux ou punitifs, y compris la perte de revenus, de données ou d'occasions d'affaires. La responsabilité totale de Nivra envers le client est limitée au montant des frais effectivement payés par le client au cours des trois (3) derniers mois de service. La disponibilité de service cible est de 99,5 % sur base mensuelle." },
      { title: "9. LOI APPLICABLE ET JURIDICTION", content: "Le présent contrat est régi par les lois de la province de Québec et les lois fédérales du Canada qui s'y appliquent. Tout litige découlant du présent contrat sera soumis à la compétence exclusive des tribunaux de la province de Québec, district de Laval. Les parties conviennent de tenter une résolution à l'amiable avant toute procédure judiciaire." },
    ];

    terms.forEach(term => {
      if (y > ph - 50) {
        drawFooter(doc, 2, totalPages);
        addNewPage(doc);
        drawHeader(doc, "CONDITIONS GÉNÉRALES (suite)");
        y = 36;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C.navy);
      doc.text(term.title, m, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      const lines = doc.splitTextToSize(term.content, cw);
      doc.text(lines, m, y);
      y += lines.length * 3.8 + 6;
    });

    drawFooter(doc, 2, totalPages);

    // === PAGE 3: ANNEXES ===
    addNewPage(doc);
    drawHeader(doc, "ANNEXES");
    y = 36;

    const annexes = [
      { title: "ANNEXE A — NIVEAUX DE SERVICE (SLA)", content: "Nivra s'engage à fournir une disponibilité de 99,5% sur base mensuelle. Les interruptions planifiées seront communiquées 48 heures à l'avance par courriel. En cas de panne majeure (> 24h consécutives), un crédit proportionnel sera appliqué automatiquement au prochain cycle." },
      { title: "ANNEXE B — PROTECTION DES RENSEIGNEMENTS PERSONNELS", content: "Nivra protège les renseignements personnels conformément à la Loi 25 du Québec et à la LPRPDE fédérale. Les données sont collectées uniquement pour la fourniture des services, la facturation et le support. Aucune donnée n'est vendue à des tiers. Le client peut demander l'accès, la rectification ou la suppression de ses données en contactant support@nivra-telecom.ca." },
      { title: "ANNEXE C — PROCÉDURE DE PLAINTES ET RÉSOLUTION DE DIFFÉRENDS", content: "Pour toute plainte : contacter support@nivra-telecom.ca. Délai de réponse : 48 heures ouvrables. Si non résolue : escalade au gestionnaire de service. En dernier recours : Commission des plaintes relatives aux services de télécom (CPRST) ou le CRTC." },
    ];

    annexes.forEach(annex => {
      y = sectionTitle(doc, annex.title, y, m, cw);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      const lines = doc.splitTextToSize(annex.content, cw - 10);
      doc.text(lines, m + 5, y);
      y += lines.length * 3.8 + 10;
    });

    // Terms version reference
    y += 5;
    doc.setFillColor(...C.lightBg);
    doc.setDrawColor(...C.teal);
    doc.setLineWidth(0.5);
    doc.roundedRect(m, y, cw, 12, 1, 1, "FD");
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.navy);
    doc.text("RÉFÉRENCE AUX MODALITÉS DE SERVICE", m + 5, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text(`Ce contrat est soumis aux Modalités de service Nivra Telecom (version ${data.terms_version}), disponibles sur le portail client.`, m + 5, y + 10);

    drawFooter(doc, 3, totalPages);

    // === PAGE 4: SIGNATURES ===
    addNewPage(doc);
    drawHeader(doc, "ACCEPTATION");
    y = 36;

    y = sectionTitle(doc, "ACCEPTATION DU CONTRAT", y, m, cw);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.text);
    const acceptText = `En signant le présent contrat, le Client déclare avoir lu, compris et accepté l'ensemble des conditions générales, annexes et Modalités de service (${data.terms_version}) ci-dessus. Le Client confirme que les informations fournies sont exactes et complètes.`;
    const acceptLines = doc.splitTextToSize(acceptText, cw);
    doc.text(acceptLines, m, y);
    y += acceptLines.length * 4 + 15;

    // Signature boxes
    const boxW = (cw - 15) / 2;

    // Client signature
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(m, y, boxW, 50, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text("SIGNATURE DU CLIENT", m + 5, y + 10);

    if (data.is_signed && data.signature_name) {
      // Signed: show signature info
      doc.setFont("helvetica", "italic");
      doc.setFontSize(12);
      doc.setTextColor(...C.blue);
      doc.text(data.signature_name, m + 10, y + 25);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(`Signé le: ${fmtDate(data.signature_date)}`, m + 10, y + 32);
      if (data.signature_ip) {
        doc.text(`IP: ${data.signature_ip}`, m + 10, y + 37);
      }
      // Green checkmark
      doc.setFillColor(...C.success);
      doc.circle(m + boxW - 12, y + 10, 4, "F");
      doc.setTextColor(...C.white);
      doc.setFontSize(8);
      doc.text("✓", m + boxW - 13.5, y + 12);
    } else {
      doc.setDrawColor(...C.textMuted);
      doc.line(m + 10, y + 32, m + boxW - 10, y + 32);
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text("Signature", m + 10, y + 37);
      doc.text("Date: ___ / ___ / ______", m + 10, y + 43);
    }

    // Nivra representative
    const agentX = m + boxW + 15;
    doc.setFillColor(...C.lightBg);
    doc.roundedRect(agentX, y, boxW, 50, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text("REPRÉSENTANT NIVRA", agentX + 5, y + 10);

    if (data.admin_signature_name) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(12);
      doc.setTextColor(...C.blue);
      doc.text(data.admin_signature_name, agentX + 10, y + 25);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(`Signé le: ${fmtDate(data.admin_signature_date)}`, agentX + 10, y + 32);
      // Green checkmark
      doc.setFillColor(...C.success);
      doc.circle(agentX + boxW - 12, y + 10, 4, "F");
      doc.setTextColor(...C.white);
      doc.setFontSize(8);
      doc.text("✓", agentX + boxW - 13.5, y + 12);
    } else {
      doc.setDrawColor(...C.textMuted);
      doc.line(agentX + 10, y + 32, agentX + boxW - 10, y + 32);
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text("Signature", agentX + 10, y + 37);
      doc.text("Agent: _______________", agentX + 10, y + 43);
    }

    y += 60;

    // Contract engine footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...C.textMuted);
    doc.text(`Generated by Nivra – Contract Engine – Template ${data.terms_version} – ContractID: ${data.contract_number}`, pw / 2, y, { align: "center" });

    drawFooter(doc, 4, totalPages);

    const blob = doc.output("blob");
    const filename = `Contrat-${data.contract_number}.pdf`;

    return { success: true, blob, filename };
  } catch (error) {
    console.error("[ContractV3] Generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

export default generateContractV3PDF;
