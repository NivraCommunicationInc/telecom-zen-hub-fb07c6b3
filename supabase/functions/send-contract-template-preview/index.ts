/**
 * Edge Function: send-contract-template-preview
 * Generates a complete contract PDF (8+ pages) and sends it by email
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
  blue: [37, 99, 235] as [number, number, number],
};

const NIVRA_HEADER = {
  name: "NIVRA COMMUNICATIONS INC.",
  division: "Billing Division",
  province: "Québec",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  email: "Support@nivra-telecom.ca",
};

const BUSINESS_INFO = {
  legalName: "Nivra Communications Inc.",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  email: "Support@nivra-telecom.ca",
  neq: "2291249786",
};

// ============================================================================
// ANNEXES - FULL LEGAL TEXT
// ============================================================================

const ANNEXE_A = {
  id: "A",
  title: "ANNEXE A — TERMES ET CONDITIONS (NIVRA TELECOM)",
  sections: [
    {
      number: "1",
      title: "Parties, portée et définitions",
      paragraphs: [
        `Le présent contrat est conclu entre Nivra Communications Inc. (« Nivra ») et le client identifié au contrat (« Client »).`,
        `Coordonnées support : Support@nivra-telecom.ca`,
        `Services : téléphonie, Internet, télévision, sécurité et services connexes fournis par Nivra.`,
        `Date d'activation : date d'activation du service et/ou de remise de l'équipement.`,
        `Cycle de facturation (Bill Cycle) : le jour du mois correspondant à la date de création du compte Client.`,
        `Le contrat prend effet à la Date d'activation et se renouvelle par cycle, sauf résiliation conformément aux présentes.`,
      ],
    },
    {
      number: "2",
      title: "Services, limites et disponibilité",
      paragraphs: [
        `Les Services fournis sont ceux décrits au contrat, à la commande et/ou à la facture.`,
        `Sauf mention contraire, ne sont pas inclus : travaux spécialisés sur le réseau interne du Client, câblage complexe, configuration avancée.`,
        `Disponibilité — best effort. Les Services sont fournis sur une base best effort. Des interruptions peuvent survenir (maintenance, contraintes techniques, fournisseurs tiers, sécurité réseau, force majeure).`,
      ],
    },
    {
      number: "3",
      title: "Facturation prépayée, annulation, taxes, prix",
      paragraphs: [
        `Services prépayés. Les Services sont facturés à l'avance par cycle. Le renouvellement est effectué uniquement si le paiement est reçu et confirmé.`,
        `Annulation / absence de remboursement. Le Client peut annuler à tout moment. Le service demeure actif jusqu'à la fin de la période payée.`,
        `Taxes. Les montants sont sujets aux taxes applicables (TPS/TVQ), sauf indication contraire.`,
        `Ajustements de prix. Nivra peut modifier ses tarifs et modalités avec un préavis raisonnable.`,
      ],
    },
    {
      number: "4",
      title: "Retard, intérêt, suspension, réactivation",
      paragraphs: [
        `Intérêt de retard (factures impayées). À compter du 15e jour suivant la date d'échéance, un intérêt de 5% par mois s'applique sur tout solde impayé.`,
        `Suspension pour non-paiement. Les Services peuvent être suspendus après 15 jours suivant la date d'échéance.`,
        `Frais de réactivation. Des frais de réactivation de 15$ s'appliquent pour rétablir un service suspendu pour non-paiement.`,
      ],
    },
    {
      number: "5",
      title: "Dépôt et préautorisation",
      paragraphs: [
        `Aucune vérification de crédit externe. Nivra n'effectue pas de vérification de crédit externe.`,
        `Dépôt. Aucun dépôt n'est généralement exigé pour un nouveau client.`,
      ],
    },
    {
      number: "6",
      title: "Équipement, garantie et remplacement",
      paragraphs: [
        `Équipement vendu à l'activation. Les équipements fournis par Nivra peuvent être des équipements déjà utilisés et sont vendus au Client à l'activation.`,
        `Garantie 1 an. Garantie de un (1) an à compter de la date d'activation, couvrant uniquement les défauts du fabricant.`,
        `DOA. Fenêtre d'échange DOA : 14 jours suivant la remise/activation.`,
        `Exclusions. Dommages causés par le Client, perte, vol, dommages liquides, bris physique, usure normale.`,
      ],
    },
    {
      number: "7",
      title: "Contestations, litiges et rétrofacturations",
      paragraphs: [
        `Contestation de facture (10 jours). Toute contestation doit être soumise dans un délai de dix (10) jours suivant l'émission.`,
        `Chargebacks / litiges bancaires. En cas de contestation bancaire/rétrofacturation, Nivra peut suspendre le service.`,
      ],
    },
    {
      number: "8",
      title: "Paiements frauduleux, pénalités",
      paragraphs: [
        `Frais fixes. Le Client sera facturé 100$ par paiement frauduleux / paiement en litige confirmé.`,
        `Intérêt majoré. Tout montant à rembourser porte intérêt au taux de 29% par mois.`,
        `Recouvrement. À défaut de paiement, Nivra peut transférer le dossier au recouvrement.`,
      ],
    },
    {
      number: "9",
      title: "Identité, NIP, confidentialité",
      paragraphs: [
        `Validation d'identité. Une pièce d'identité valide avec photo peut être exigée.`,
        `NIP. Un NIP de sécurité à 4 chiffres est obligatoire.`,
        `Protection des renseignements personnels. Nivra protège les renseignements personnels conformément aux lois applicables (PIPEDA, Loi 25).`,
      ],
    },
    {
      number: "10",
      title: "Plaintes, CRTC et recours externe",
      paragraphs: [
        `Plainte interne. Le Client doit d'abord contacter Nivra via Support@nivra-telecom.ca et/ou le portail client.`,
        `Recours externe (CCTS). Le Client peut déposer une plainte auprès de la CCTS (www.ccts-cprst.ca).`,
      ],
    },
    {
      number: "11",
      title: "Résiliation et clauses générales",
      paragraphs: [
        `Résiliation par Nivra. Nivra peut suspendre ou résilier en cas de non-paiement, fraude, abus.`,
        `Limitation de responsabilité. Nivra n'est pas responsable des dommages indirects.`,
        `Juridiction. Régi par les lois du Québec et les lois applicables du Canada.`,
      ],
    },
  ],
};

const ANNEXE_B = {
  id: "B",
  title: "ANNEXE B — CONDITIONS SPÉCIFIQUES PAR SERVICE",
  sections: [
    {
      number: "B1",
      title: "Services mobiles (SIM, portabilité, roaming)",
      paragraphs: [
        `Portabilité (transfert de numéro). Le Client peut demander le transfert de son numéro vers Nivra.`,
        `SIM / eSIM. Des frais peuvent s'appliquer pour : activation, remplacement, SIM perdue/volée.`,
        `Roaming, hors-forfait. Les frais sont facturés selon le plan choisi et/ou les tarifs applicables.`,
      ],
    },
    {
      number: "B2",
      title: "Services Internet (vitesse, Wi-Fi, réseau)",
      paragraphs: [
        `Vitesse "jusqu'à". Les vitesses annoncées sont des vitesses maximales théoriques "jusqu'à".`,
        `Réseau interne. Le Client est responsable de son réseau interne (routeur, câbles, prises).`,
        `Usage raisonnable. Les plans illimités sont soumis à une politique d'usage raisonnable.`,
      ],
    },
    {
      number: "B3",
      title: "Services Télévision (chaînes, modifications)",
      paragraphs: [
        `Chaînes de base. Tous les plans TV incluent automatiquement 25 ou 26 chaînes de base.`,
        `Chaînes Free-Choice. Le Client peut sélectionner un nombre déterminé de chaînes.`,
        `Chaînes Premium. Les chaînes Premium sont facturées en supplément.`,
      ],
    },
    {
      number: "B4",
      title: "Services de Sécurité",
      paragraphs: [
        `Non-urgence. Les services de sécurité ne remplacent pas les services d'urgence (911).`,
        `Dépendances. Les services peuvent dépendre de l'alimentation électrique et d'Internet.`,
      ],
    },
  ],
};

const ANNEXE_C = {
  id: "C",
  title: "ANNEXE C — POLITIQUE D'INSTALLATION ET RENDEZ-VOUS",
  sections: [
    {
      title: "Installation standard vs complexe",
      paragraphs: [
        `Une installation "standard" couvre les opérations normales prévues au plan.`,
        `Une installation "complexe" peut inclure : câblage additionnel, perçage, configuration avancée.`,
      ],
    },
    {
      title: "Prérequis et accès",
      paragraphs: [
        `Le Client doit assurer : accès au logement, prise électrique fonctionnelle, présence d'une personne autorisée.`,
      ],
    },
    {
      title: "Rendez-vous, retard et absence",
      paragraphs: [
        `Le Client doit être disponible dans la fenêtre prévue.`,
        `En cas d'absence, des frais de déplacement/no-show peuvent s'appliquer.`,
      ],
    },
  ],
};

const ANNEXE_D = {
  id: "D",
  title: "ANNEXE D — MODALITÉS DE PAIEMENT",
  sections: [
    {
      number: "D1",
      title: "Modes de paiement",
      paragraphs: [
        `Les modes acceptés sont ceux indiqués au portail (carte, virement Interac e-Transfer, etc.).`,
      ],
    },
    {
      number: "D2",
      title: "e-Transfer — règles",
      paragraphs: [
        `Instructions. Le Client doit envoyer le virement selon les instructions communiquées par Nivra.`,
        `Vérification. L'activation se fait après réception et vérification du paiement.`,
        `Paiement retourné/refusé. Peut entraîner une suspension de service et/ou des frais additionnels.`,
      ],
    },
  ],
};

const ANNEXE_E = {
  id: "E",
  title: "ANNEXE E — SUPPORT, TICKETS, SLA",
  sections: [
    {
      number: "E1",
      title: "Support et tickets",
      paragraphs: [
        `Canaux. Les communications peuvent être transmises via le portail client et/ou par courriel.`,
        `Délais de réponse. Nivra vise des délais de réponse raisonnables (sans garantie sauf SLA).`,
        `Fermeture de ticket. Un ticket peut être fermé si le Client ne répond pas après 7 jours.`,
      ],
    },
    {
      number: "E2",
      title: "SLA entreprise (optionnel)",
      paragraphs: [
        `Si un plan "Entreprise" avec SLA est souscrit, les paramètres sont définis au Résumé du contrat.`,
      ],
    },
    {
      number: "E3",
      title: "Avis électroniques",
      paragraphs: [
        `Avis électroniques. Les avis transmis via le portail et/ou par courriel sont réputés valides.`,
        `Preuves techniques. Les journaux techniques peuvent servir d'éléments de preuve.`,
      ],
    },
  ],
};

const ALL_ANNEXES = [ANNEXE_A, ANNEXE_B, ANNEXE_C, ANNEXE_D, ANNEXE_E];

// ============================================================================
// SAMPLE CONTRACT DATA
// ============================================================================

const today = new Date().toISOString().split("T")[0];

const SAMPLE_CONTRACT = {
  contract_number: "NVR-PREP-QC-2026-00001",
  contract_date: today,
  contract_version: "v2.0-PREP-QC-2026",
  client_name: "Sophie Lavoie",
  client_email: "slavoie@example.com",
  client_phone: "514-555-7890",
  service_address: "4567 Avenue des Pins, Montréal, QC H2W 1R7",
  billing_address: "4567 Avenue des Pins, Montréal, QC H2W 1R7",
  account_number: "ACC-2026-0003",
  order_number: "CMD-2026-0999",
  order_date: today,
  services: [
    { service_type: "Internet", service_description: "Fibre 1 Gbps Illimité", service_price: 99.99, service_total: 99.99 },
    { service_type: "TV", service_description: "Forfait Premium 120+ chaînes", service_price: 59.99, service_total: 59.99 },
  ],
  equipment: [
    { item_name: "Routeur Wi-Fi 6 Nivra", qty: 1, unit_price: 60.00, line_total: 60.00, serial_number: "RTR-NVR-2026-001" },
    { item_name: "Terminal 4K Nivra", qty: 2, unit_price: 50.00, line_total: 100.00, serial_number: "TV4K-NVR-2026-001" },
  ],
  one_time_fees: [
    { label: "Frais d'activation (bundle)", amount: 45.00 },
    { label: "Frais de livraison", amount: 30.00 },
  ],
  subtotal_monthly: 159.98,
  subtotal_equipment: 160.00,
  subtotal_one_time_fees: 75.00,
  total_discounts: 20.00,
  subtotal_before_tax: 374.98,
  tax_gst: 18.75,
  tax_qst: 37.41,
  total_due_today: 431.14,
  monthly_recurring: 159.98,
  promo_code: "BIENVENUE20",
  promo_description: "20$ de rabais sur la première commande",
  installation_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  installation_time_slot: "10h00 - 12h00",
  bill_cycle_day: 15,
  payment_method: "interac",
  payment_reference: "CA9876543210",
  signature_name: "Sophie Lavoie",
  signature_date: today,
  is_signed: true,
};

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrency = (amount: number): string => `${amount.toFixed(2).replace(".", ",")} $`;

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
};

// ============================================================================
// PDF GENERATION - CONTRACT (8+ PAGES)
// ============================================================================

function generateContractPDF(data: typeof SAMPLE_CONTRACT): Uint8Array {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  // Helper to check page break
  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 20;
      return true;
    }
    return false;
  };

  // ========================================================================
  // PAGE 1: EXECUTIVE SUMMARY
  // ========================================================================
  
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
  doc.text("CONTRAT DE SERVICE", pageWidth - margin, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`#${data.contract_number}`, pageWidth - margin, 22, { align: "right" });
  
  y = 55;
  
  // Signed badge
  if (data.is_signed) {
    doc.setFillColor(220, 252, 231);
    doc.rect(margin, y, contentWidth, 12, "F");
    doc.setFillColor(...PDF_COLORS.success);
    doc.rect(margin, y, 4, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_COLORS.success);
    doc.text("✓ CONTRAT SIGNÉ ÉLECTRONIQUEMENT", margin + 8, y + 8);
    y += 16;
  }
  
  // Agreement type
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("ENTENTE DE SERVICE DE TÉLÉCOMMUNICATIONS PRÉPAYÉ", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text(`Version ${data.contract_version} — Province de Québec`, pageWidth / 2, y, { align: "center" });
  y += 10;
  
  // Parties box
  doc.setDrawColor(...PDF_COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 32);
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, y, 4, 32, "F");
  
  // Provider
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("FOURNISSEUR", margin + 8, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(BUSINESS_INFO.legalName, margin + 8, y + 12);
  doc.text(BUSINESS_INFO.address, margin + 8, y + 17);
  doc.text(BUSINESS_INFO.email, margin + 8, y + 22);
  doc.text(`NEQ: ${BUSINESS_INFO.neq}`, margin + 8, y + 27);
  
  // Client
  const rightX = margin + contentWidth / 2 + 5;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("CLIENT", rightX, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(data.client_name, rightX, y + 12);
  doc.text(data.client_email, rightX, y + 17);
  doc.text(data.client_phone || "", rightX, y + 22);
  doc.text(`Compte: ${data.account_number}`, rightX, y + 27);
  
  y += 38;
  
  // Addresses
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text("Adresse de service:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(data.service_address, margin + 35, y);
  y += 8;
  
  // SERVICES SECTION
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
  doc.text("Mensuel", margin + 130, y + 5);
  doc.text("Total", margin + contentWidth - 5, y + 5, { align: "right" });
  y += 9;
  
  // Service lines
  data.services.forEach((svc, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 1, contentWidth, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(svc.service_type, margin + 2, y + 4);
    doc.text(svc.service_description, margin + 45, y + 4);
    doc.text(formatCurrency(svc.service_price), margin + 130, y + 4);
    doc.text(formatCurrency(svc.service_total), margin + contentWidth - 5, y + 4, { align: "right" });
    y += 7;
  });
  y += 5;
  
  // EQUIPMENT SECTION
  doc.setFillColor(...PDF_COLORS.veryLightGray);
  doc.rect(margin, y, contentWidth, 8, "F");
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, y, 3, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("ÉQUIPEMENTS (ACHAT)", margin + 6, y + 5.5);
  y += 12;
  
  // Table header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("Équipement", margin + 2, y + 5);
  doc.text("Qté", margin + 90, y + 5);
  doc.text("Prix unit.", margin + 110, y + 5);
  doc.text("Total", margin + contentWidth - 5, y + 5, { align: "right" });
  y += 9;
  
  // Equipment lines
  data.equipment.forEach((eq, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 1, contentWidth, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(eq.item_name, margin + 2, y + 4);
    doc.text(String(eq.qty), margin + 90, y + 4);
    doc.text(formatCurrency(eq.unit_price), margin + 110, y + 4);
    doc.text(formatCurrency(eq.line_total), margin + contentWidth - 5, y + 4, { align: "right" });
    y += 7;
    if (eq.serial_number) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.gray);
      doc.text(`   N° Série: ${eq.serial_number}`, margin + 5, y + 2);
      y += 5;
    }
  });
  y += 5;
  
  // ONE-TIME FEES
  doc.setFillColor(...PDF_COLORS.veryLightGray);
  doc.rect(margin, y, contentWidth, 8, "F");
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, y, 3, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("FRAIS UNIQUES", margin + 6, y + 5.5);
  y += 12;
  
  data.one_time_fees.forEach(fee => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(`• ${fee.label}`, margin + 5, y);
    doc.text(formatCurrency(fee.amount), margin + contentWidth - 5, y, { align: "right" });
    y += 5;
  });
  y += 5;
  
  // TOTALS - Check if we need a page break before totals section
  const totalsHeight = 80; // Height needed for full totals section
  if (y + totalsHeight > pageHeight - 55) {
    doc.addPage();
    y = 25;
  }
  
  const totalsX = margin + contentWidth - 120;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.dark);
  
  doc.text("Services mensuels:", totalsX, y);
  doc.text(formatCurrency(data.subtotal_monthly), totalsX + 118, y, { align: "right" });
  y += 6;
  doc.text("Équipements:", totalsX, y);
  doc.text(formatCurrency(data.subtotal_equipment), totalsX + 118, y, { align: "right" });
  y += 6;
  doc.text("Frais uniques:", totalsX, y);
  doc.text(formatCurrency(data.subtotal_one_time_fees), totalsX + 118, y, { align: "right" });
  y += 6;
  if (data.total_discounts > 0) {
    doc.setTextColor(...PDF_COLORS.success);
    doc.text("Rabais appliqués:", totalsX, y);
    doc.text(`-${formatCurrency(data.total_discounts)}`, totalsX + 118, y, { align: "right" });
    y += 6;
    doc.setTextColor(...PDF_COLORS.dark);
  }
  doc.setFont("helvetica", "bold");
  doc.text("Sous-total:", totalsX, y);
  doc.text(formatCurrency(data.subtotal_before_tax), totalsX + 118, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text("TPS (5%):", totalsX, y);
  doc.text(formatCurrency(data.tax_gst), totalsX + 118, y, { align: "right" });
  y += 6;
  doc.text("TVQ (9.975%):", totalsX, y);
  doc.text(formatCurrency(data.tax_qst), totalsX + 118, y, { align: "right" });
  y += 8;
  
  // Total highlight
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(totalsX - 2, y - 1, 122, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("TOTAL À PAYER AUJOURD'HUI:", totalsX, y + 6);
  doc.text(formatCurrency(data.total_due_today), totalsX + 118, y + 6, { align: "right" });
  y += 15;
  
  // Monthly recurring
  doc.setTextColor(...PDF_COLORS.teal);
  doc.setFontSize(9);
  doc.text(`Récurrent mensuel: ${formatCurrency(data.monthly_recurring)}`, totalsX, y);
  
  // ========================================================================
  // PAGE 2+: POLICIES
  // ========================================================================
  doc.addPage();
  y = 20;
  
  // Header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(0, 20, pageWidth, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("POLITIQUES ET CONDITIONS GÉNÉRALES", pageWidth / 2, 13, { align: "center" });
  y = 30;
  
  // Policies
  const policies = [
    { title: "FACTURATION PRÉPAYÉE", content: "• Prépayé : Les services sont facturés à l'avance par cycle de service.\n• Annulez à tout moment : Vous pouvez annuler à tout moment. Aucun financement d'appareil.\n• Si vous annulez, le service reste actif jusqu'à la fin de la période payée." },
    { title: "CYCLE DE FACTURATION", content: "• Chaque compte a un « Bill Cycle Day » (jour du mois pour le renouvellement).\n• La facture est émise 5 jours avant le Bill Cycle.\n• Le paiement doit être reçu AVANT la date du Bill Cycle pour renouveler le service.\n• Après 90 jours sans renouvellement, le numéro peut devenir irrécupérable." },
    { title: "GARANTIE (1 AN)", content: "• Garantie manufacturier d'un (1) an à compter de la date d'activation.\n• Couvre les défauts de fabrication uniquement.\n• Fenêtre d'échange DOA : 14 jours à compter de la livraison." },
    { title: "ANNULATION", content: "• Le client peut annuler à tout moment via le Portail Client ou ticket.\n• Les annulations prennent effet à la fin du cycle payé.\n• L'équipement doit être retourné dans les 14 jours." },
    { title: "SANS VÉRIFICATION DE CRÉDIT", content: "• Nivra Communications n'effectue aucune vérification de crédit.\n• L'accès aux services est basé sur pré-autorisation ou dépôt." },
    { title: "AVIS RÉGLEMENTAIRES", content: "• Plaintes : CCTS (www.ccts-cprst.ca)\n• CRTC : crtc.gc.ca\n• Codes applicables : Wireless Code, Internet Code, Television Service Provider Code" },
  ];
  
  policies.forEach(policy => {
    checkPageBreak(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text(policy.title, margin, y);
    y += 5;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    const lines = doc.splitTextToSize(policy.content, contentWidth);
    lines.forEach((line: string) => {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 4;
    });
    y += 5;
  });
  
  // Fees schedule
  checkPageBreak(50);
  doc.setFillColor(...PDF_COLORS.veryLightGray);
  doc.rect(margin, y, contentWidth, 8, "F");
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(margin, y, 3, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("GRILLE TARIFAIRE DES FRAIS", margin + 6, y + 5.5);
  y += 12;
  
  const fees = [
    { desc: "Frais d'activation (1 service)", amount: "25,00 $" },
    { desc: "Frais d'activation (2+ services bundle)", amount: "45,00 $" },
    { desc: "Frais de livraison standard", amount: "30,00 $" },
    { desc: "Terminal TV 4K Nivra (achat)", amount: "50,00 $" },
    { desc: "Routeur Wi-Fi Nivra (achat)", amount: "60,00 $" },
    { desc: "Frais de réactivation (chargeback)", amount: "15,00 $" },
    { desc: "Intérêt mensuel (contestation)", amount: "5%" },
  ];
  
  fees.forEach(fee => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.dark);
    doc.text(`• ${fee.desc}`, margin + 5, y);
    doc.text(fee.amount, margin + contentWidth - 5, y, { align: "right" });
    y += 5;
  });
  
  // ========================================================================
  // ANNEXES A-E
  // ========================================================================
  ALL_ANNEXES.forEach(annexe => {
    doc.addPage();
    y = 20;
    
    // Annexe header
    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(0, 0, pageWidth, 25, "F");
    doc.setFillColor(...PDF_COLORS.teal);
    doc.rect(0, 25, pageWidth, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text(annexe.title, pageWidth / 2, 16, { align: "center" });
    y = 35;
    
    // Sections
    annexe.sections.forEach(section => {
      checkPageBreak(35);
      
      const sectionTitle = section.number ? `${section.number}. ${section.title}` : section.title;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...PDF_COLORS.navy);
      doc.text(sectionTitle, margin, y);
      y += 6;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.dark);
      
      section.paragraphs.forEach(para => {
        checkPageBreak(15);
        const lines = doc.splitTextToSize(para, contentWidth);
        lines.forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, margin, y);
          y += 4;
        });
        y += 3;
      });
      y += 5;
    });
  });
  
  // ========================================================================
  // SIGNATURE PAGE
  // ========================================================================
  doc.addPage();
  y = 20;
  
  // Signature header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, pageWidth, 25, "F");
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(0, 25, pageWidth, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("SIGNATURE ÉLECTRONIQUE", pageWidth / 2, 16, { align: "center" });
  y = 40;
  
  // Legal notice
  const legalNotice = `En apposant ma signature électronique ci-dessous, je reconnais avoir lu, compris et accepté l'ensemble des termes et conditions de ce contrat de service de télécommunications prépayé, incluant toutes les annexes (A à E). Je confirme que les informations fournies sont exactes et que j'accepte de recevoir les communications par voie électronique.`;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.dark);
  const noticeLines = doc.splitTextToSize(legalNotice, contentWidth);
  noticeLines.forEach((line: string) => {
    doc.text(line, margin, y);
    y += 4;
  });
  y += 15;
  
  // Signature box
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(1);
  doc.rect(margin, y, contentWidth, 50);
  
  if (data.is_signed && data.signature_name) {
    doc.setFillColor(240, 253, 244);
    doc.rect(margin + 0.5, y + 0.5, contentWidth - 1, 49, "F");
    
    // Signature in blue italic
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(24);
    doc.setTextColor(...PDF_COLORS.blue);
    doc.text(data.signature_name, margin + contentWidth / 2, y + 25, { align: "center" });
    
    // Signed badge
    doc.setFillColor(...PDF_COLORS.success);
    doc.roundedRect(margin + contentWidth / 2 - 40, y + 35, 80, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text("CONTRAT SIGNÉ ÉLECTRONIQUEMENT", margin + contentWidth / 2, y + 40, { align: "center" });
  }
  
  y += 55;
  
  // Signature details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text(`Nom du signataire: ${data.signature_name}`, margin, y);
  y += 5;
  doc.text(`Date de signature: ${formatDate(data.signature_date)}`, margin, y);
  y += 5;
  doc.text(`Numéro de contrat: ${data.contract_number}`, margin, y);
  y += 5;
  doc.text(`Numéro de commande: ${data.order_number}`, margin, y);
  y += 15;
  
  // Legal compliance
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, y, contentWidth, 25, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.gray);
  const complianceText = `Cette signature électronique est conforme à la Loi concernant le cadre juridique des technologies de l'information (L.R.Q., c. C-1.1) du Québec et à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) du Canada. Le document signé électroniquement a la même valeur juridique qu'un document signé de façon manuscrite.`;
  const compLines = doc.splitTextToSize(complianceText, contentWidth - 10);
  let compY = y + 5;
  compLines.forEach((line: string) => {
    doc.text(line, margin + 5, compY);
    compY += 3.5;
  });
  
  // ========================================================================
  // PAGE NUMBERS
  // ========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text(`Page ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    doc.text(`Contrat #${data.contract_number}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }
  
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[send-contract-template-preview] Generating contract PDF...");
    
    // Generate PDF
    const pdfBuffer = generateContractPDF(SAMPLE_CONTRACT);
    const pdfBase64 = base64Encode(pdfBuffer);
    
    console.log("[send-contract-template-preview] Contract PDF generated, pages:", 10);
    
    // Get recipient from request or use default
    let recipientEmail = "support@nivra-telecom.ca";
    try {
      const body = await req.json();
      if (body?.email) {
        recipientEmail = body.email;
      }
    } catch {
      // Use default email
    }
    
    // Send email with attachment
    const { error } = await resend.emails.send({
      from: "Nivra Billing <no-reply@nivra-telecom.ca>",
      to: [recipientEmail],
      subject: "📄 Template Contrat V2 - Aperçu Complet (8+ pages)",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #0F172A;">Template de Contrat V2 - Aperçu</h1>
          <p>Vous trouverez ci-joint le template de contrat complet avec:</p>
          <ul>
            <li>✅ Résumé exécutif (Page 1)</li>
            <li>✅ Services souscrits</li>
            <li>✅ Équipements et numéros de série</li>
            <li>✅ Frais uniques</li>
            <li>✅ Totaux avec taxes TPS/TVQ</li>
            <li>✅ Politiques générales</li>
            <li>✅ Grille tarifaire des frais</li>
            <li>✅ <strong>Annexe A</strong> — Termes et conditions</li>
            <li>✅ <strong>Annexe B</strong> — Conditions par service (Mobile, Internet, TV, Sécurité)</li>
            <li>✅ <strong>Annexe C</strong> — Politique d'installation et rendez-vous</li>
            <li>✅ <strong>Annexe D</strong> — Modalités de paiement</li>
            <li>✅ <strong>Annexe E</strong> — Support, tickets, SLA</li>
            <li>✅ Page de signature électronique</li>
          </ul>
          <p style="color: #14B8A6; font-weight: bold;">Ce template est conforme à la loi québécoise sur les signatures électroniques (L.R.Q., c. C-1.1).</p>
          <hr style="border: 1px solid #E5E7EB; margin: 20px 0;" />
          <p style="color: #6B7280; font-size: 12px;">
            Nivra Communications Inc. — Billing Division<br/>
            Support@nivra-telecom.ca
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Contrat_NVR-PREP-QC-2026-00001_Sophie_Lavoie.pdf`,
          content: pdfBase64,
          contentType: "application/pdf",
        },
      ],
    });

    if (error) {
      console.error("[send-contract-template-preview] Resend error:", error);
      throw new Error(`Email send failed: ${error.message}`);
    }

    console.log("[send-contract-template-preview] Email sent successfully to:", recipientEmail);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Contract template sent to ${recipientEmail}`,
        pages: 10,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-contract-template-preview] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
