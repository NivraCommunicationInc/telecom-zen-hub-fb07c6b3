/**
 * Nivra Contract Template V5.0 - Telecom-Grade Professional Standard
 * 
 * 4-page contract with integrated modalités:
 * Page 1: Header + Client ID + Financial Summary
 * Page 2: Services & Equipment + Conditions 1-5
 * Page 3: Conditions 6-12 (Modalités intégrées)
 * Page 4: Signatures + Legal Notice
 */

import jsPDFModule from "npm:jspdf@2.5.2";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;
type jsPDF = any;
import type { PDFGenerationResult } from "./types.ts";
import { NIVRA } from "./companyInfo.ts";

// ============================================================================
// CONTRACT DATA INTERFACE
// ============================================================================

export interface ContractDataV3 {
  contract_number: string;
  contract_date: string;
  terms_version: string;

  client_name: string;
  client_email: string;
  client_phone: string;
  client_dob?: string;
  billing_address: string;
  service_address: string;

  account_number: string;
  order_number: string;

  services: Array<{
    type: string;
    name: string;
    description?: string;
    monthly_price: number;
  }>;

  equipment: Array<{
    name: string;
    quantity: number;
    unit_price: number;
  }>;

  one_time_fees: Array<{
    label: string;
    amount: number;
  }>;

  subtotal_monthly: number;
  subtotal_one_time: number;
  discount_amount: number;
  tax_gst: number;
  tax_qst: number;
  total_due_today: number;

  payment_method?: string;

  signature_name?: string;
  signature_date?: string;
  signature_ip?: string;
  is_signed?: boolean;

  admin_signature_name?: string;
  admin_signature_date?: string;

  discount_label?: string;

  // ADD-ONLY: real discount lines from billing_invoice_lines (line_type='discount')
  has_discount?: boolean;
  discount_lines?: Array<{
    description: string;
    unit_price: number;
  }>;

  // Field-sales attribution (ADD-ONLY - only rendered when sale_source === 'field_sales')
  sale_source?: string;
  agent_name?: string;
  agent_number?: string;

  // Optional activation/install details (telecom)
  mobile_assigned_number?: string;
  mobile_sim_iccid?: string;
  mobile_sim_carrier?: string;
  mobile_sim_type?: string;
  mobile_activated_at?: string;
  install_date?: string;
  technician_name?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "-";
  const ymd = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return `${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
  }
  return "-";
};

const NAVY        = [0, 102, 204] as const;   // #0066CC — was [30,64,120]
const GREEN_ACCENT = [124, 58, 237] as const; // #7C3AED violet — was green

function drawHeader(doc: jsPDF, contractNum: string, pageLabel: string) {
  const pw = doc.internal.pageSize.getWidth();

  // Blue main zone (0 – 29 mm)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pw, 29, "F");

  // Violet accent strip (29 – 32 mm)
  doc.setFillColor(GREEN_ACCENT[0], GREEN_ACCENT[1], GREEN_ACCENT[2]);
  doc.rect(0, 29, pw, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 220, 245);
  doc.text("CONTRAT DE SERVICE DE TELECOMMUNICATIONS", 15, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`No ${contractNum}`, pw - 15, 13, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 220, 245);
  doc.text(pageLabel, pw - 15, 22, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Violet accent line
  doc.setFillColor(124, 58, 237);
  doc.rect(0, ph - 16, pw, 1.5, "F");

  // Grey band
  doc.setFillColor(248, 250, 252);
  doc.rect(0, ph - 14.5, pw, 14.5, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${NIVRA.legalName} | ${NIVRA.email} | ${NIVRA.website}`, 15, ph - 8.5);
  doc.text(`Page ${pageNum} de ${totalPages}`, pw - 15, ph - 8.5, { align: "right" });
  doc.text("Ce document constitue un contrat legalement contraignant.", pw / 2, ph - 4, { align: "center" });
}

function sectionTitle(doc: jsPDF, num: number | string, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 102, 204);
  doc.text(`${num}. ${title}`, 15, y);
  doc.setDrawColor(124, 58, 237);
  doc.line(15, y + 1.5, 190, y + 1.5);
  return y + 7;
}

function clause(doc: jsPDF, text: string, y: number, indent: number = 17): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize(text, 190 - indent);
  for (const line of lines) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(line, indent, y);
    y += 3.8;
  }
  return y + 1.5;
}

function bulletClause(doc: jsPDF, text: string, y: number): number {
  return clause(doc, `\u2022 ${text}`, y, 20);
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateContractV3PDF(data: ContractDataV3): PDFGenerationResult {
  try {
    if (!data.contract_number) return { success: false, error: "Numero de contrat manquant" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const totalPages = 4;

    // ===================================================================
    // PAGE 1 - IDENTIFICATION & SOMMAIRE FINANCIER
    // ===================================================================
    drawHeader(doc, data.contract_number, "Identification");

    let y = 42;

    // Contract date line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date du contrat: ${fmtDate(data.contract_date)}  |  Version des modalites: ${data.terms_version}`, 15, y);
    y += 8;

    // IDENTIFICATION DU CLIENT
    y = sectionTitle(doc, "A", "IDENTIFICATION DU TITULAIRE", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    const col1 = 15;
    const col2 = 105;
    const labelStyle = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(100, 100, 100); };
    const valueStyle = () => { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(0, 0, 0); };

    labelStyle(); doc.text("Nom complet", col1, y);
    labelStyle(); doc.text("No de compte", col2, y); y += 4;
    valueStyle(); doc.text(data.client_name || "-", col1, y);
    valueStyle(); doc.text(data.account_number, col2, y); y += 6;

    labelStyle(); doc.text("Courriel", col1, y);
    labelStyle(); doc.text("No de commande", col2, y); y += 4;
    valueStyle(); doc.text(data.client_email || "-", col1, y);
    valueStyle(); doc.text(data.order_number, col2, y); y += 6;

    labelStyle(); doc.text("Telephone", col1, y);
    labelStyle(); doc.text("Methode de paiement", col2, y); y += 4;
    valueStyle(); doc.text(data.client_phone || "-", col1, y);
    valueStyle(); doc.text(data.payment_method === "card" ? "Carte de credit" : data.payment_method === "paypal" ? "PayPal" : data.payment_method || "-", col2, y); y += 6;

    labelStyle(); doc.text("Adresse de facturation", col1, y);
    labelStyle(); doc.text("Adresse de service", col2, y); y += 4;
    valueStyle();
    const billParts = doc.splitTextToSize(data.billing_address || "-", 85);
    doc.text(billParts, col1, y);
    const svcParts = doc.splitTextToSize(data.service_address || "-", 85);
    doc.text(svcParts, col2, y);
    y += Math.max(billParts.length, svcParts.length) * 4 + 6;

    // FIELD-SALES AGENT BLOCK (ADD-ONLY - conditional)
    if (data.sale_source === "field_sales" && (data.agent_name || data.agent_number)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 102, 204);
      doc.text("Representant commercial", 15, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text(`Nom : ${data.agent_name || "-"}`, 17, y); y += 4;
      doc.text(`Badge : ${data.agent_number || "-"}`, 17, y); y += 4;
      doc.text("Type de vente : Vente terrain (Porte-a-porte)", 17, y); y += 6;
      doc.setTextColor(0, 0, 0);
    }

    // SOMMAIRE FINANCIER
    y = sectionTitle(doc, "B", "SOMMAIRE FINANCIER", y);

    // Services mensuels recurrents
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 102, 204);
    doc.text("Services mensuels recurrents", 17, y);
    doc.text("Tarif/mois", 170, y, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    for (const svc of data.services) {
      doc.text(svc.name, 20, y);
      doc.text(fmt(svc.monthly_price), 170, y, { align: "right" });
      y += 5;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Sous-total mensuel recurrent", 20, y);
    doc.text(fmt(data.subtotal_monthly), 170, y, { align: "right" });
    y += 7;

    // Equipment & Fees
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 102, 204);
    doc.text("Frais uniques (equipement, activation, livraison)", 17, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    for (const eq of data.equipment) {
      doc.text(`${eq.name} (x${eq.quantity})`, 20, y);
      doc.text(fmt(eq.unit_price * eq.quantity), 170, y, { align: "right" });
      y += 5;
    }
    for (const fee of data.one_time_fees) {
      doc.text(fee.label, 20, y);
      doc.text(fmt(fee.amount), 170, y, { align: "right" });
      y += 5;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Sous-total frais uniques", 20, y);
    doc.text(fmt(data.subtotal_one_time), 170, y, { align: "right" });
    y += 7;

    // Promotion
    if (data.discount_amount > 0) {
      doc.setTextColor(0, 128, 0);
      doc.setFont("helvetica", "bold");
      doc.text(data.discount_label || "Promotion appliquee", 20, y);
      doc.text(fmt(-data.discount_amount), 170, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 7;
    }

    // Tax & Total box
    doc.setDrawColor(200, 200, 200);
    doc.line(100, y, 190, y);
    y += 5;
    const taxableBase = data.total_due_today - data.tax_gst - data.tax_qst;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("Sous-total taxable", 105, y); doc.text(fmt(taxableBase), 170, y, { align: "right" }); y += 5;
    doc.text("TPS (5%)", 105, y); doc.text(fmt(data.tax_gst), 170, y, { align: "right" }); y += 5;
    doc.text("TVQ (9,975%)", 105, y); doc.text(fmt(data.tax_qst), 170, y, { align: "right" }); y += 6;

    doc.setFillColor(0, 102, 204);
    doc.rect(100, y, 90, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL PAYE AUJOURD'HUI", 105, y + 5.5);
    doc.text(fmt(data.total_due_today), 186, y + 5.5, { align: "right" });
    y += 12;

    // Monthly recurring reminder
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(`Votre tarif mensuel recurrent sera de ${fmt(data.subtotal_monthly)} (avant taxes) a compter du prochain cycle.`, 15, y);
    y += 6;

    // Activation / installation details (mobile / internet / TV)
    const hasActivation = data.mobile_assigned_number || data.mobile_sim_iccid || data.install_date || data.technician_name;
    if (hasActivation) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 102, 204);
      doc.text("Details d'activation / installation", 15, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      if (data.mobile_assigned_number) { doc.text(`Numero attribue : ${data.mobile_assigned_number}`, 17, y); y += 4; }
      if (data.mobile_sim_iccid) { doc.text(`SIM ICCID : ${data.mobile_sim_iccid}` + (data.mobile_sim_type ? ` (${data.mobile_sim_type})` : ""), 17, y); y += 4; }
      if (data.mobile_sim_carrier) { doc.text(`Reseau : ${data.mobile_sim_carrier}`, 17, y); y += 4; }
      if (data.mobile_activated_at) { doc.text(`Activation mobile : ${fmtDate(data.mobile_activated_at)}`, 17, y); y += 4; }
      if (data.install_date) { doc.text(`Date d'installation : ${fmtDate(data.install_date)}`, 17, y); y += 4; }
      if (data.technician_name) { doc.text(`Technicien : ${data.technician_name}`, 17, y); y += 4; }
    }

    drawFooter(doc, 1, totalPages);

    // ===================================================================
    // PAGE 2 - CONDITIONS GENERALES (1-5)
    // ===================================================================
    doc.addPage();
    drawHeader(doc, data.contract_number, "Conditions generales");
    y = 42;

    y = sectionTitle(doc, 1, "NATURE DU SERVICE ET ACTIVATION", y);
    y = bulletClause(doc, "Nivra Telecom est un fournisseur de services de telecommunications prepaye a renouvellement mensuel.", y);
    y = bulletClause(doc, "Aucune verification de credit externe n'est effectuee lors de la souscription.", y);
    y = bulletClause(doc, `Le service debute a la date de livraison et d'installation de l'equipement, soit a compter du ${fmtDate(data.contract_date)} ou de la date effective d'activation.`, y);
    y = bulletClause(doc, "Nivra se reserve le droit de refuser, suspendre ou retarder toute commande si une fraude est suspectee, sans obligation de motiver sa decision.", y);
    y += 3;

    y = sectionTitle(doc, 2, "FACTURATION ET CYCLE DE PAIEMENT", y);
    y = bulletClause(doc, "Le cycle de facturation est mensuel (30 jours), ancre a la date d'activation du service.", y);
    y = bulletClause(doc, "Une facture est generee et rendue disponible sur le portail client trois (3) jours avant la date de renouvellement.", y);
    y = bulletClause(doc, "La facture est un document informatif; aucun service n'est fourni sans paiement confirme pour le cycle correspondant.", y);
    y = bulletClause(doc, "Taxes applicables: TPS (5%) et TVQ (9,975%), calculees conformement aux lois fiscales du Quebec.", y);
    y = bulletClause(doc, "Le client est responsable de consulter ses factures via le portail. Toute contestation doit etre soumise dans les trente (30) jours suivant l'emission.", y);
    y += 3;

    y = sectionTitle(doc, 3, "CONDITIONS DE PAIEMENT", y);
    y = bulletClause(doc, "Methodes de paiement acceptees: PayPal (methode principale recommandee) et virement Interac (e-Transfer).", y);
    y = bulletClause(doc, "Le paiement doit etre confirme AVANT la date de cycle pour renouveler le service.", y);
    y = bulletClause(doc, "La confirmation est automatique pour PayPal. Pour Interac, la confirmation est effectuee manuellement dans un delai de vingt-quatre (24) heures ouvrables.", y);
    y = bulletClause(doc, "Aucun paiement en especes, cheque ou mandat-poste n'est accepte.", y);
    y += 3;

    y = sectionTitle(doc, 4, "PRELEVEMENTS AUTOMATIQUES (AUTOPAY)", y);
    y = bulletClause(doc, "L'activation du prelevement automatique accorde un rabais de 5,00 $/mois sur le tarif mensuel recurrent.", y);
    y = bulletClause(doc, "Le client peut activer ou desactiver l'autopay a tout moment via son portail client.", y);
    y = bulletClause(doc, "La desactivation de l'autopay entraine le retrait immediat du rabais, effectif des la prochaine facture.", y);
    y = bulletClause(doc, "Le prelevement est effectue automatiquement a la date d'echeance de la facture.", y);
    y += 3;

    y = sectionTitle(doc, "4bis", "CHANGEMENT DE FORFAIT", y);
    y = bulletClause(doc, "En cas de changement de forfait (upgrade), le nouveau tarif prend effet immediatement et un ajustement proratise au prorata journalier du cycle en cours est facture sur-le-champ.", y);
    y = bulletClause(doc, "En cas de reduction de forfait (downgrade), le changement prend effet au prochain cycle de renouvellement, sans frais ni remboursement pour le cycle en cours.", y);
    y += 3;

    y = sectionTitle(doc, 5, "PROMOTION ET RABAIS APPLICABLE", y);
    if (data.has_discount && Array.isArray(data.discount_lines) && data.discount_lines.length > 0) {
      for (const dl of data.discount_lines) {
        y = bulletClause(doc, `${dl.description} - ${fmt(dl.unit_price)}/mois`, y);
      }
      y = bulletClause(doc, "Cette promotion s'applique uniquement aux elements et a la duree specifies dans l'offre.", y);
    } else if (data.discount_amount > 0) {
      y = bulletClause(doc, `Promotion appliquee: ${data.discount_label || "Rabais promotionnel"} pour un montant de ${fmt(data.discount_amount)}.`, y);
      y = bulletClause(doc, "Cette promotion s'applique uniquement a la premiere facture ou aux elements specifies dans l'offre.", y);
    } else {
      y = bulletClause(doc, "Aucun rabais applique a cette commande.", y);
    }
    y = bulletClause(doc, "Les promotions sont non cumulables sauf indication contraire expresse.", y);
    y = bulletClause(doc, "Nivra se reserve le droit de modifier ou retirer toute offre promotionnelle a tout moment.", y);

    drawFooter(doc, 2, totalPages);

    // ===================================================================
    // PAGE 3 - MODALITES (6-12)
    // ===================================================================
    doc.addPage();
    drawHeader(doc, data.contract_number, "Modalites de service");
    y = 42;

    y = sectionTitle(doc, 6, "NON-RENOUVELLEMENT ET CONSEQUENCES", y);
    y = bulletClause(doc, "En cas de non-paiement confirme a la date de cycle (jour d'echeance), la facture devient en souffrance.", y);
    y = bulletClause(doc, "Apres cinq (5) jours de retard (J+5), le service est suspendu. La facture demeure en souffrance et le client dispose d'un delai de reactivation de cinq (5) jours supplementaires.", y);
    y = bulletClause(doc, "Apres dix (10) jours de retard (J+10), la facture est annulee et aucune dette n'est portee au dossier. La reactivation requiert un nouveau cycle de paiement.", y);
    y = bulletClause(doc, "Le client conserve son numero et ses donnees pendant une periode de grace de quatre-vingt-dix (90) jours apres suspension. Apres 90 jours, le numero peut devenir irrecuperable.", y);
    y = bulletClause(doc, "Exception - Litiges et retrofacturations: en cas de chargeback ou fraude, des interets de 5% par mois et des frais de reactivation de 15,00 $ plus taxes applicables (TPS/TVQ) s'appliquent. Le client doit contacter Nivra AVANT d'initier un litige bancaire; toute retrofacturation abusive entraine la suspension immediate du service et des poursuites legales.", y);
    y += 3;

    y = sectionTitle(doc, 7, "RESILIATION", y);
    y = bulletClause(doc, "Le client peut resilier a tout moment via le portail client ou en contactant le service a la clientele.", y);
    y = bulletClause(doc, "Le service reste actif jusqu'a la fin du cycle prepaye en cours.", y);
    y = bulletClause(doc, "Aucun remboursement partiel n'est accorde pour les jours non utilises.", y);
    y = bulletClause(doc, "La portabilite du numero est disponible conformement aux directives du CRTC.", y);
    y = bulletClause(doc, "Nivra se reserve le droit de resilier immediatement le service en cas d'utilisation abusive, frauduleuse ou contraire aux presentes conditions.", y);
    y += 3;

    y = sectionTitle(doc, 8, "EQUIPEMENT", y);
    y = bulletClause(doc, "L'equipement fourni par Nivra (routeur, terminal TV, etc.) est vendu au client comme frais unique; il devient sa propriete apres paiement.", y);
    y = bulletClause(doc, "Le client est responsable de l'utilisation et de l'entretien de l'equipement.", y);
    y = bulletClause(doc, "Garantie fabricant: douze (12) mois a compter de la date d'activation. Perte, vol et dommages causes par le client sont exclus.", y);
    y = bulletClause(doc, "En cas de resiliation, l'equipement n'a pas a etre retourne sauf s'il a ete fourni en pret (indique explicitement sur la commande).", y);
    y += 3;

    y = sectionTitle(doc, 9, "SUSPENSION POUR NON-PAIEMENT", y);
    y = bulletClause(doc, "En cas de non-paiement a la date d'echeance (jour de cycle), la facture devient en souffrance (J0). Apres cinq (5) jours (J+5), le service est automatiquement suspendu.", y);
    y = bulletClause(doc, "Entre J+5 et J+10, le client peut reactiver son service en reglant la facture en souffrance. Apres J+10, la facture est annulee et la reactivation necessite un nouveau paiement complet.", y);
    y = bulletClause(doc, "Des frais de reactivation de 15,00 $ peuvent s'appliquer.", y);
    y += 3;

    y = sectionTitle(doc, 10, "LIMITATION DE RESPONSABILITE", y);
    y = bulletClause(doc, "Nivra n'est pas responsable des dommages indirects, consequentiels, speciaux ou punitifs resultant de l'utilisation ou de l'impossibilite d'utiliser les services.", y);
    y = bulletClause(doc, "La responsabilite totale de Nivra est limitee au montant paye par le client pour le service specifique concerne, au cours des trois (3) derniers mois.", y);
    y = bulletClause(doc, "Nivra ne garantit pas une disponibilite de 100% et n'est pas responsable des interruptions causees par des pannes reseau, catastrophes naturelles ou interventions de tiers.", y);
    y += 3;

    y = sectionTitle(doc, 11, "PROTECTION DES RENSEIGNEMENTS PERSONNELS", y);
    y = bulletClause(doc, "Nivra protege les renseignements personnels conformement a la Loi 25 du Quebec et a la LPRPDE federale.", y);
    y = bulletClause(doc, "Les donnees sont collectees uniquement pour la fourniture des services, la facturation, le support et la prevention de la fraude. Aucune donnee n'est vendue a des tiers.", y);
    y += 3;

    y = sectionTitle(doc, 12, "LOI APPLICABLE ET RESOLUTION DES DIFFERENDS", y);
    y = bulletClause(doc, "Ce contrat est regi par les lois de la province de Quebec et les lois federales du Canada applicables.", y);
    y = bulletClause(doc, "Tout litige sera soumis aux tribunaux competents du district judiciaire de Montreal.", y);
    y = bulletClause(doc, "Les dispositions de la Loi sur la protection du consommateur (Quebec) s'appliquent.", y);
    y = bulletClause(doc, "Pour toute plainte: contacter support@nivra-telecom.ca. Delai de reponse: quarante-huit (48) heures ouvrables. En dernier recours: Commission des plaintes relatives aux services de telecom-television (CPRST).", y);

    drawFooter(doc, 3, totalPages);

    // ===================================================================
    // PAGE 4 - SIGNATURES & AVIS LEGAL
    // ===================================================================
    doc.addPage();
    drawHeader(doc, data.contract_number, "Signatures");
    y = 42;

    // Acceptance clause
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 102, 204);
    doc.text("DECLARATION ET ACCEPTATION", 15, y);
    doc.line(15, y + 1.5, 190, y + 1.5);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    const acceptText = [
      "En signant ce contrat, le client declare et confirme:",
      "",
      "  (a) Avoir lu et compris l'integralite des conditions generales et des modalites de service ci-dessus;",
      "  (b) Avoir verifie l'exactitude des informations personnelles, de l'adresse de service et du sommaire financier;",
      "  (c) Accepter les tarifs mensuels recurrents et les frais uniques indiques au sommaire financier;",
      "  (d) Comprendre que les services Nivra sont prepaye a renouvellement mensuel et qu'aucun service n'est fourni sans paiement confirme;",
      "  (e) Accepter que les factures sont exclusivement numeriques et accessibles via le portail client;",
      "  (f) Comprendre la politique de resiliation, de remboursement et de retour d'equipement;",
      "  (g) Accepter les conditions de prelevement automatique et de promotion, le cas echeant.",
    ];
    for (const line of acceptText) {
      doc.text(line, 17, y);
      y += 4.5;
    }
    y += 8;

    // SIGNATURES
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 102, 204);
    doc.text("SIGNATURES", 15, y);
    doc.setDrawColor(30, 64, 120);
    doc.line(15, y + 1.5, 190, y + 1.5);
    y += 12;

    // Client signature
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("TITULAIRE DU COMPTE", 15, y);
    doc.text("NIVRA TELECOM INC.", 110, y);
    y += 18;

    doc.setDrawColor(0, 0, 0);
    doc.line(15, y, 95, y);
    doc.line(110, y, 190, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(data.client_name || "-", 15, y);
    doc.text(data.admin_signature_name || "Representant autorise", 110, y);
    y += 5;

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    if (data.is_signed) {
      doc.text(`Signe le: ${fmtDate(data.signature_date)}`, 15, y);
      if (data.signature_ip) {
        doc.text(`IP: ${data.signature_ip}`, 15, y + 4);
      }
    } else {
      doc.text("Date: En attente de signature", 15, y);
    }
    doc.text(`Date: ${fmtDate(data.contract_date)}`, 110, y);
    y += 15;

    // Legal notice box
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, y, 175, 35, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("AVIS LEGAL", 20, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    const legalLines = doc.splitTextToSize(
      `Ce contrat a ete genere electroniquement le ${fmtDate(data.contract_date)} par les systemes de Nivra Telecom. ` +
      `Contrat No ${data.contract_number}, Commande No ${data.order_number}, Compte No ${data.account_number}. ` +
      `En signant ce document, le client confirme avoir lu et accepte l'integralite des termes, conditions et modalites ci-dessus. ` +
      `Toute modification aux presentes conditions sera communiquee par courriel ou via le portail client avec un preavis de trente (30) jours. ` +
      `Si une disposition du present contrat est jugee invalide par un tribunal competent, les autres dispositions demeurent en vigueur. ` +
      `Le present contrat constitue l'integralite de l'accord entre le client et Nivra Telecom concernant les services souscrits.`,
      165
    );
    doc.text(legalLines, 20, y + 10);

    drawFooter(doc, 4, totalPages);

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Contrat_${data.contract_number}_Nivra.pdf`,
    };
  } catch (error) {
    console.error("[ContractV5] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateContractV3PDF;
