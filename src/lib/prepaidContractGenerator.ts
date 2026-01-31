import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BUSINESS_INFO,
  CONTRACT_TERMS,
  CLIENT_ACKNOWLEDGEMENT,
  PREPAID_BILLING_SUMMARY,
  LATE_PAYMENT_POLICY,
  REGULATORY_NOTICES,
  WARRANTY_POLICY,
  CANCELLATION_POLICY,
} from "./contractPolicies";
import { ACTIVE_CONTRACT_TEMPLATE, getContractEngineFooterLine } from "./contractTemplate";
import { safePDFDownload, safePDFOpen } from "./pdfUtils";

// ========== INTERFACES ==========

export interface PrepaidServiceItem {
  type: "Mobile" | "Internet" | "TV" | "Streaming+";
  planName: string;
  cyclePrice: number;
  inclusions?: string;
}

export interface PrepaidStreamingAddon {
  id: string;
  name: string;
  priceMonthly: number;
  category?: string;
}

export interface PrepaidOneTimeFee {
  item: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface PrepaidContractData {
  // Template metadata
  contractId?: string;
  templateId?: string;
  templateVersion?: string;

  // Page 1 — Critical Information Summary
  providerLegalName?: string;
  providerAddress?: string;
  supportPhone?: string;
  supportEmail?: string;

  orderId: string;
  orderReference: string; // MUST NOT BE BLANK
  issueDate: string;
  effectiveDate: string;

  // Client info
  clientFullName: string;
  clientEmail: string;
  clientPhone?: string;

  // Addresses
  serviceAddressFull?: string;
  billingAddressFull?: string;

  // Services (prepaid/cycle)
  mobilePlan?: { name: string; cyclePrice: number };
  internetPlan?: { name: string; cyclePrice: number };
  tvPlan?: { name: string; cyclePrice: number };
  streamingAddons?: PrepaidStreamingAddon[];

  // Billing summary
  recurringSubtotal: number;
  discountsTotal?: number;
  taxTotal: number;
  recurringTotal: number;

  // One-time charges
  activationQty?: number;
  activationTotal?: number;
  deliveryQty?: number;
  deliveryTotal?: number;
  terminalQty?: number;
  terminalTotal?: number;
  routerQty?: number;
  routerTotal?: number;
  reactivationQty?: number;
  reactivationTotal?: number;

  oneTimeSubtotal: number;
  oneTimeTax: number;
  oneTimeTotal: number;

  // Amount due today
  totalDueToday: number;
  paymentMethod?: string;
  paymentStatus?: string; // Pending | Verified | Completed | Declined | Fraud

  // Signatures
  clientSignature?: string;
  clientSignedDatetime?: string;
  clientIp?: string;
  repNameTitle?: string;
  repSignature?: string;
  repSignedDatetime?: string;

  // Snapshot for appendix
  snapshotTimestamp?: string;
  snapshotHash?: string;

  // Legacy compatibility
  isSigned?: boolean;
  signedAt?: string;
  
  // Reactivation scope
  reactivationScope?: string;
  returnWindowDays?: number;
  installationDetails?: string;
  liabilityCap?: string;
  privacyPolicyUrl?: string;
}

// ========== GENERATOR ==========

export const generatePrepaidContractPDF = (data: PrepaidContractData): jsPDF => {
  // VALIDATION: order_reference must not be blank
  if (!data.orderReference || data.orderReference.trim() === "") {
    throw new Error("Contract generation refused: order_reference is blank");
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let currentY = 15;
  let pageNumber = 1;
  let totalPages = 7; // Will be updated at the end

  // Color palette
  const primaryNavy: [number, number, number] = [15, 23, 42];
  const accentTeal: [number, number, number] = [20, 184, 166];
  const textDark: [number, number, number] = [30, 41, 59];
  const textMuted: [number, number, number] = [100, 116, 139];
  const borderLight: [number, number, number] = [203, 213, 225];
  const bgLight: [number, number, number] = [248, 250, 252];
  const white: [number, number, number] = [255, 255, 255];

  // ========== HELPER FUNCTIONS ==========

  const addNewPage = () => {
    doc.addPage();
    pageNumber++;
    currentY = 20;
    addPageHeader();
  };

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 25) {
      addNewPage();
    }
  };

  const addPageHeader = () => {
    if (pageNumber > 1) {
      doc.setFillColor(...accentTeal);
      doc.rect(0, 0, pageWidth, 2, "F");

      doc.setFillColor(...primaryNavy);
      doc.rect(0, 2, pageWidth, 10, "F");

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      doc.text("NIVRA TELECOM — Contrat de services prépayés", marginLeft, 9);

      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(`Réf: ${data.orderReference}`, pageWidth - marginRight, 9, { align: "right" });

      currentY = 18;
    }
  };

  const addFooter = (pageNum: number) => {
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 18, pageWidth - marginRight, pageHeight - 18);

    const engineLine = getContractEngineFooterLine({
      contractId: data.contractId || data.orderReference,
      templateVersion: data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version,
    });

    doc.setFontSize(5);
    doc.setTextColor(...textMuted);
    doc.text(
      `${BUSINESS_INFO.legalName} — ${BUSINESS_INFO.address} — ${BUSINESS_INFO.serviceTerritory}`,
      pageWidth / 2,
      pageHeight - 13,
      { align: "center" }
    );

    doc.text(engineLine, pageWidth / 2, pageHeight - 9, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - marginRight, pageHeight - 8, { align: "right" });
  };

  const addAnnexeHeader = (letter: string, title: string) => {
    doc.setFillColor(...primaryNavy);
    doc.rect(0, 0, pageWidth, 25, "F");

    doc.setFillColor(...accentTeal);
    doc.rect(0, 25, pageWidth, 3, "F");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(`Annexe ${letter}`, pageWidth / 2, 12, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...accentTeal);
    doc.text(title, pageWidth / 2, 20, { align: "center" });

    currentY = 35;
  };

  const addSectionHeader = (number: string, title: string) => {
    checkPageBreak(12);
    currentY += 4;

    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 4;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryNavy);
    doc.text(`${number}. ${title}`, marginLeft, currentY);

    currentY += 2;
    doc.setDrawColor(...borderLight);
    doc.line(marginLeft, currentY, pageWidth - marginRight, currentY);
    currentY += 6;
  };

  const addLabelValue = (label: string, value: string, labelWidth: number = 60) => {
    checkPageBreak(5);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);

    const paddedLabel = (label + ":").padEnd(35, " ");
    doc.text(paddedLabel, marginLeft, currentY);

    doc.setTextColor(...textDark);
    doc.text(value || "—", marginLeft + labelWidth, currentY);
    currentY += 4.5;
  };

  const addSubHeader = (text: string) => {
    checkPageBreak(8);
    currentY += 2;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryNavy);
    doc.text(text, marginLeft, currentY);
    currentY += 5;
  };

  const addParagraph = (text: string, fontSize: number = 6.5) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);

    const lines = doc.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * 3.5 + 2);
    doc.text(lines, marginLeft, currentY);
    currentY += lines.length * 3.5 + 2;
  };

  const addTableHeader = (cols: string[], widths: number[]) => {
    const rowHeight = 5;
    checkPageBreak(rowHeight + 2);

    doc.setFillColor(...primaryNavy);
    doc.rect(marginLeft, currentY - 3.5, contentWidth, rowHeight, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);

    let xPos = marginLeft + 2;
    cols.forEach((col, i) => {
      doc.text(col, xPos, currentY);
      xPos += widths[i];
    });

    currentY += rowHeight;
  };

  const addTableRow = (cols: string[], widths: number[]) => {
    const rowHeight = 5;
    checkPageBreak(rowHeight + 2);

    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);

    let xPos = marginLeft + 2;
    cols.forEach((col, i) => {
      const maxChars = Math.floor(widths[i] / 2);
      const truncated = col.length > maxChars ? col.substring(0, maxChars - 2) + ".." : col;
      doc.text(truncated, xPos, currentY);
      xPos += widths[i];
    });

    currentY += rowHeight;
  };

  // ========== PAGE 1: RÉSUMÉ DU CONTRAT ==========

  // Top accent
  doc.setFillColor(...accentTeal);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Header band
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 3, pageWidth, 28, "F");

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("Nivra Telecom — Contrat de services prépayés", pageWidth / 2, 15, { align: "center" });

  // Subtitle
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...accentTeal);
  doc.text("RÉSUMÉ DU CONTRAT", pageWidth / 2, 23, { align: "center" });

  currentY = 38;

  // Page label
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("Page 1 — Résumé et acceptation du contrat", marginLeft, currentY);
  currentY += 8;

  // Provider info box
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, currentY, contentWidth, 16, 1, 1, "FD");

  doc.setFontSize(6);
  doc.setTextColor(...textDark);
  doc.text(`Fournisseur: ${data.providerLegalName || BUSINESS_INFO.legalName}`, marginLeft + 3, currentY + 5);
  doc.text(`Adresse: ${data.providerAddress || BUSINESS_INFO.address}`, marginLeft + 3, currentY + 9);
  doc.text(`Support: ${data.supportPhone || BUSINESS_INFO.phone} | ${data.supportEmail || BUSINESS_INFO.email}`, marginLeft + 3, currentY + 13);

  currentY += 22;

  // Contract/Order info
  addLabelValue("Numéro de contrat", data.contractId || `CTR-PREP-${data.orderReference}`);
  addLabelValue("Numéro de commande", data.orderId);
  addLabelValue("Référence", data.orderReference);
  addLabelValue("Date d'émission", data.issueDate);
  addLabelValue("Date d'entrée en vigueur", data.effectiveDate);

  currentY += 4;

  // Client info
  addSubHeader("INFORMATIONS CLIENT");
  addLabelValue("Nom complet", data.clientFullName);
  addLabelValue("Courriel", data.clientEmail);
  addLabelValue("Téléphone", data.clientPhone || "—");
  addLabelValue("Adresse de service", data.serviceAddressFull || "—");
  addLabelValue("Adresse de facturation", data.billingAddressFull || data.serviceAddressFull || "—");

  currentY += 4;

  // Services summary
  addSubHeader("SERVICES SOUSCRITS");

  const serviceColWidths = [35, 70, 50];
  addTableHeader(["Service", "Forfait", "Prix/cycle"], serviceColWidths);

  if (data.mobilePlan) {
    addTableRow(["Mobile", data.mobilePlan.name, `${data.mobilePlan.cyclePrice.toFixed(2)} $`], serviceColWidths);
  }
  if (data.internetPlan) {
    addTableRow(["Internet", data.internetPlan.name, `${data.internetPlan.cyclePrice.toFixed(2)} $`], serviceColWidths);
  }
  if (data.tvPlan) {
    addTableRow(["TV", data.tvPlan.name, `${data.tvPlan.cyclePrice.toFixed(2)} $`], serviceColWidths);
  }
  if (data.streamingAddons && data.streamingAddons.length > 0) {
    const streamingList = data.streamingAddons.map(s => s.name).join(", ");
    const streamingTotal = data.streamingAddons.reduce((sum, s) => sum + s.priceMonthly, 0);
    addTableRow(["Streaming+", streamingList, `${streamingTotal.toFixed(2)} $`], serviceColWidths);
  }

  currentY += 6;

  // Totals box
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(marginLeft, currentY, contentWidth, 22, 1, 1, "FD");

  doc.setFontSize(6.5);
  doc.setTextColor(...textDark);
  let boxY = currentY + 5;
  doc.text(`Sous-total récurrent: ${data.recurringSubtotal.toFixed(2)} $`, marginLeft + 5, boxY);
  if (data.discountsTotal && data.discountsTotal > 0) {
    boxY += 4;
    doc.text(`Rabais: -${data.discountsTotal.toFixed(2)} $`, marginLeft + 5, boxY);
  }
  boxY += 4;
  doc.text(`Taxes (TPS/TVQ): ${data.taxTotal.toFixed(2)} $`, marginLeft + 5, boxY);
  boxY += 4;
  doc.setFont("helvetica", "bold");
  doc.text(`Total récurrent par cycle: ${data.recurringTotal.toFixed(2)} $`, marginLeft + 5, boxY);

  // One-time on right side
  doc.setFont("helvetica", "normal");
  boxY = currentY + 5;
  doc.text(`Frais uniques: ${data.oneTimeSubtotal.toFixed(2)} $`, marginLeft + 100, boxY);
  boxY += 4;
  doc.text(`Taxes frais uniques: ${data.oneTimeTax.toFixed(2)} $`, marginLeft + 100, boxY);
  boxY += 4;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text(`TOTAL DÛ AUJOURD'HUI: ${data.totalDueToday.toFixed(2)} $ CAD`, marginLeft + 100, boxY);

  currentY += 28;

  // Acceptation des annexes
  addSubHeader("ACCEPTATION DES ANNEXES");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  const annexeText = "En signant ce contrat, le client reconnaît avoir lu et accepté les termes et conditions décrits dans les annexes suivantes:";
  doc.text(annexeText, marginLeft, currentY);
  currentY += 5;

  const annexeList = [
    "Annexe A — Termes et conditions (Nivra Telecom)",
    "Annexe B — Conditions spécifiques par service",
    "Annexe C — Politique d'installation et rendez-vous (terrain)",
    "Annexe D — Modalités de paiement (incluant e-Transfer)",
    "Annexe E — Support, tickets, SLA et clauses avancées"
  ];

  annexeList.forEach(annexe => {
    doc.setFontSize(6);
    doc.text(`• ${annexe}`, marginLeft + 5, currentY);
    currentY += 4;
  });

  currentY += 6;

  // Signatures section
  addSubHeader("SIGNATURES");

  const sigBoxWidth = (contentWidth - 10) / 2;
  const sigBoxHeight = 35;

  // Client signature box (LEFT)
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginLeft, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "FD");

  doc.setFillColor(...accentTeal);
  doc.rect(marginLeft, currentY, 3, sigBoxHeight, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("CLIENT", marginLeft + 8, currentY + 7);

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(`Nom: ${data.clientFullName}`, marginLeft + 8, currentY + 13);
  doc.text(`Signature: ${data.clientSignature || "____________________"}`, marginLeft + 8, currentY + 19);
  doc.text(`Date: ${data.clientSignedDatetime || "____________________"}`, marginLeft + 8, currentY + 25);
  doc.text(`IP: ${data.clientIp || "—"}`, marginLeft + 8, currentY + 31);

  // Provider signature box (RIGHT)
  const provSigX = marginLeft + sigBoxWidth + 10;
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(provSigX, currentY, sigBoxWidth, sigBoxHeight, 2, 2, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentTeal);
  doc.text("NIVRA TELECOM", provSigX + 5, currentY + 7);

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...white);
  doc.text(`Représentant: ${data.repNameTitle || "____________________"}`, provSigX + 5, currentY + 13);
  doc.text(`Signature: ${data.repSignature || "____________________"}`, provSigX + 5, currentY + 19);
  doc.text(`Date: ${data.repSignedDatetime || "____________________"}`, provSigX + 5, currentY + 25);

  currentY += sigBoxHeight + 8;

  // Signature status banner
  if (data.isSigned && data.signedAt) {
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1.5);
    doc.roundedRect(marginLeft, currentY, contentWidth, 12, 3, 3, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("CONTRAT SIGNÉ", pageWidth / 2, currentY + 7, { align: "center" });
  } else {
    doc.setFillColor(254, 249, 195);
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1.5);
    doc.roundedRect(marginLeft, currentY, contentWidth, 10, 3, 3, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(161, 98, 7);
    doc.text("EN ATTENTE DE SIGNATURE", pageWidth / 2, currentY + 6, { align: "center" });
  }

  addFooter(1);

  // ========== ANNEXE A: TERMES ET CONDITIONS (NIVRA TELECOM) ==========
  addNewPage();
  addAnnexeHeader("A", "TERMES ET CONDITIONS (NIVRA TELECOM)");

  // Section 1: Parties, portée et définitions
  addSectionHeader("1", "Parties, portée et définitions");
  addParagraph("Le présent contrat est conclu entre Nivra Communications Inc. (« Nivra ») et le client identifié au contrat (« Client »).");
  addParagraph("Coordonnées support : Support@nivratelecom.com");

  addSubHeader("Définitions");
  addParagraph("Services : téléphonie, Internet, télévision, sécurité et services connexes fournis par Nivra.");
  addParagraph("Date d'activation : date d'activation du service et/ou de remise de l'équipement.");
  addParagraph("Cycle de facturation (Bill Cycle) : le jour du mois correspondant à la date de création du compte Client. Exemple : compte créé le 4 → facture émise le 4 de chaque mois. Si le mois ne comporte pas ce jour (29–31), la facturation est effectuée le dernier jour du mois.");
  addParagraph("Échéance : date limite de paiement indiquée sur la facture/portail.");
  addParagraph("Équipement : matériel fourni par Nivra (ex. routeur, terminal 4K), vendu au Client à l'activation.");
  addParagraph("Le contrat prend effet à la Date d'activation et se renouvelle par cycle, sauf résiliation conformément aux présentes.");

  // Section 2: Services, limites et disponibilité
  addSectionHeader("2", "Services, limites et disponibilité");
  addParagraph("Les Services fournis sont ceux décrits au contrat, à la commande et/ou à la facture.");
  addParagraph("Sauf mention contraire, ne sont pas inclus : travaux spécialisés sur le réseau interne du Client, câblage complexe, configuration avancée, réparations d'infrastructure appartenant au Client, ou toute prestation non décrite.");
  addParagraph("Disponibilité — best effort. Les Services sont fournis sur une base best effort. Des interruptions peuvent survenir (maintenance, contraintes techniques, fournisseurs tiers, sécurité réseau, force majeure). Les délais d'installation/activation sont estimés.");

  // Section 3: Facturation prépayée, annulation, taxes, prix
  addSectionHeader("3", "Facturation prépayée, annulation, taxes, prix");
  addParagraph("Services prépayés. Les Services sont facturés à l'avance par cycle. Le renouvellement est effectué uniquement si le paiement est reçu et confirmé.");
  addParagraph("Annulation / absence de remboursement. Le Client peut annuler à tout moment. Le service demeure actif jusqu'à la fin de la période payée. Le mois (cycle) en cours payé n'est pas remboursable, en tout ou en partie, sauf disposition légale contraire ou erreur de facturation confirmée.");
  addParagraph("Taxes. Les montants sont sujets aux taxes applicables (TPS/TVQ), sauf indication contraire.");
  addParagraph("Ajustements de prix. Nivra peut modifier ses tarifs et modalités avec un préavis raisonnable transmis via le portail et/ou par courriel, selon les règles applicables.");
  addParagraph("Erreur de prix / \"Prix à confirmer\". En cas d'erreur technique d'affichage (ex. « Prix à confirmer »), le prix applicable est celui indiqué sur la confirmation de commande et/ou la facture. Nivra peut corriger une erreur manifeste et en aviser le Client; avant activation, le Client peut annuler si le prix corrigé ne lui convient pas.");

  // Section 4: Retard, intérêt, suspension, réactivation
  addSectionHeader("4", "Retard, intérêt, suspension, réactivation");
  addParagraph("Intérêt de retard (factures impayées). À compter du 15e jour suivant la date d'échéance, un intérêt de cinq pour cent (5%) par mois s'applique sur tout solde impayé, jusqu'au paiement complet.");
  addParagraph("Suspension pour non-paiement. Les Services peuvent être suspendus après 15 jours suivant la date d'échéance. Une notification est transmise via portail et/ou courriel. Nivra n'est pas responsable des impacts liés à la suspension (incluant Internet, téléphonie, télévision, systèmes de sécurité/alarme).");
  addParagraph("Frais de réactivation. Des frais de réactivation de 15 $ s'appliquent pour rétablir un service suspendu pour non-paiement. Le paiement intégral du solde dû est requis avant réactivation.");

  // Section 5: Dépôt, préautorisation et "crédit interne"
  addSectionHeader("5", "Dépôt, préautorisation et crédit interne");
  addParagraph("Aucune vérification de crédit externe. Nivra n'effectue pas de vérification de crédit externe. Toutefois, Nivra utilise un système interne basé notamment sur l'historique de paiement du Client auprès de Nivra.");
  addParagraph("Dépôt. Aucun dépôt n'est généralement exigé pour un nouveau client. Pour un client existant, un dépôt et/ou une préautorisation peut être exigé(e) en cas d'historique de retards, factures impayées ou incidents de paiement. Le montant et les modalités sont communiqués au portail, à la commande ou à la facture.");

  // Section 6: Équipement (usagé vendu), garantie et remplacement
  addSectionHeader("6", "Équipement (usagé vendu), garantie et remplacement");
  addParagraph("Équipement vendu à l'activation. Les équipements fournis par Nivra peuvent être des équipements déjà utilisés et sont vendus au Client à l'activation (frais uniques).");
  addParagraph("Garantie 1 an. Garantie de un (1) an à compter de la date d'activation, couvrant uniquement les défauts du fabricant et problèmes techniques rendant l'équipement non fonctionnel dans un usage normal.");
  addParagraph("DOA. Fenêtre d'échange DOA : 14 jours suivant la remise/activation (preuve requise).");
  addParagraph("Exclusions. Dommages causés par le Client, perte, vol, dommages liquides, bris physique, usure normale, modifications non autorisées.");
  addParagraph("Frais de remplacement. Le Client paie les frais de livraison pour un remplacement. Si le Client demande une installation par technicien, des frais d'installation s'appliquent.");

  // Section 7: Contestations, litiges et rétrofacturations
  addSectionHeader("7", "Contestations, litiges et rétrofacturations");
  addParagraph("Contestation de facture (10 jours). Toute contestation doit être soumise dans un délai de dix (10) jours suivant l'émission (ou la mise à disposition au portail), avec description des montants contestés. Passé ce délai, la facture est réputée acceptée, sous réserve des droits prévus par la loi.");
  addParagraph("Chargebacks / litiges bancaires. En cas de contestation bancaire/rétrofacturation, Nivra peut suspendre le service, demander des preuves, et refuser la réactivation tant que la situation n'est pas régularisée.");

  // Section 8: Paiements frauduleux, pénalités, recouvrement
  addSectionHeader("8", "Paiements frauduleux, pénalités, recouvrement");
  addParagraph("Définition. Un « paiement frauduleux / paiement en litige confirmé » inclut tout paiement contesté, rétrofacturé, annulé, refusé, ou déclaré non autorisé par l'institution financière ou le processeur de paiement.");
  addParagraph("Frais fixes. Le Client sera facturé 100 $ par paiement frauduleux / paiement en litige confirmé (frais administratifs de traitement et d'enquête).");
  addParagraph("Intérêt majoré. Tout montant à rembourser à Nivra résultant d'un paiement frauduleux / paiement en litige confirmé porte intérêt au taux de vingt-neuf pour cent (29%) par mois, calculé quotidiennement au taux équivalent, à compter de la date où Nivra est débitée jusqu'au remboursement complet.");
  addParagraph("Paiement après décision bancaire. Une fois une décision rendue par l'institution financière confirmant le litige en défaveur du Client, le Client dispose de cinq (5) jours pour payer le montant dû, notamment par virement Interac selon les instructions de Nivra.");
  addParagraph("Recouvrement. À défaut de paiement dans ce délai, Nivra peut transférer le dossier au recouvrement. Des frais administratifs de suivi de 5 $ par jour peuvent alors s'appliquer jusqu'au paiement complet, dans la mesure permise par la loi.");
  addParagraph("Frais légaux. Si Nivra entreprend des démarches judiciaires, le Client accepte de rembourser les frais raisonnables encourus (honoraires et débours), dans la mesure permise par la loi.");

  // Section 9: Identité, NIP, confidentialité et sécurité
  addSectionHeader("9", "Identité, NIP, confidentialité et sécurité");
  addParagraph("Validation d'identité. Une pièce d'identité valide avec photo peut être exigée (permis de conduire, passeport, carte d'assurance maladie du Québec selon restrictions). Vérification possible via portail sécurisé.");
  addParagraph("NIP. Un NIP de sécurité à 4 chiffres est obligatoire. Le Client peut désigner un utilisateur autorisé. Le Client est responsable de la confidentialité du NIP.");
  addParagraph("Protection des renseignements personnels. Nivra protège les renseignements personnels conformément aux lois applicables (PIPEDA, Loi 25). Les données sont utilisées pour fournir/gérer les services, la facturation, le support et la prévention de fraude.");
  addParagraph("Avertissement. Nivra ne demandera jamais le NAS ni des informations complètes de carte de crédit par courriel/téléphone. Signalez toute tentative suspecte à Support@nivratelecom.com.");

  // Section 10: Plaintes, CRTC et recours externe
  addSectionHeader("10", "Plaintes, CRTC et recours externe");
  addParagraph("Plainte interne. Le Client doit d'abord contacter Nivra via Support@nivratelecom.com et/ou le portail client.");
  addParagraph("Recours externe (CCTS). Si le problème n'est pas résolu avec Nivra, le Client peut déposer une plainte auprès de la Commission for Complaints for Telecom-television Services (CCTS), organisme indépendant de résolution de plaintes pour services télécom/Internet/TV au Canada.");
  addParagraph("Cadre de protection (CRTC). Selon le service, les codes de protection applicables incluent notamment le Wireless Code et l'Internet Code de la CRTC, utilisés dans le traitement des plaintes.");

  // Section 11: Résiliation, responsabilité et clauses générales
  addSectionHeader("11", "Résiliation, responsabilité et clauses générales");
  addParagraph("Résiliation par Nivra. Nivra peut suspendre ou résilier en cas de non-paiement, fraude, fausse identité, abus, usage interdit, ou risque de sécurité. Les montants dus demeurent exigibles.");
  addParagraph("Limitation de responsabilité. Dans la mesure permise par la loi, Nivra n'est pas responsable des dommages indirects (perte de profits, données, interruption, etc.). La responsabilité totale de Nivra est limitée aux montants payés par le Client pour le cycle concerné.");
  addParagraph("Avis/notifications. Les avis peuvent être transmis par portail et/ou courriel.");
  addParagraph("Force majeure. Nivra n'est pas responsable des interruptions causées par des événements hors de son contrôle.");
  addParagraph("Divisibilité / intégralité / modifications. Si une clause est invalide, les autres demeurent en vigueur. Le contrat et ses annexes constituent l'intégralité de l'entente. Toute modification est communiquée par écrit (portail/courriel) selon les règles applicables.");
  addParagraph("Juridiction. Régi par les lois du Québec et les lois applicables du Canada; tribunaux compétents du Québec.");

  // ========== ANNEXE B: CONDITIONS SPÉCIFIQUES PAR SERVICE ==========
  addNewPage();
  addAnnexeHeader("B", "CONDITIONS SPÉCIFIQUES PAR SERVICE");

  // B1: Services mobiles
  addSectionHeader("B1", "Services mobiles (SIM, portabilité, roaming et surconsommation)");
  addParagraph("Portabilité (transfert de numéro). Le Client peut demander le transfert (portabilité) de son numéro vers Nivra. La portabilité dépend du fournisseur actuel, des informations fournies et des règles applicables. Le Client est responsable de fournir des informations exactes (nom, adresse, numéro, NIP/PIN de portage si requis). Toute erreur, refus ou délai causé par des informations inexactes peut entraîner un retard d'activation ou des frais additionnels indiqués à la commande. Nivra n'est pas responsable des pertes de service imputables au fournisseur cédant, à une demande de portage erronée ou à une résiliation prématurée par le Client avant complétion du transfert.");
  addParagraph("SIM / eSIM — activation, remplacement et pertes. Le Client est responsable de la protection de sa carte SIM/eSIM. Des frais peuvent s'appliquer pour : activation, remplacement, changement de SIM, SIM perdue/volée/brisée, ou réémission, tels qu'indiqués au résumé du contrat, à la commande ou à la facture. En cas de perte/vol, le Client doit aviser Nivra immédiatement afin de bloquer la ligne, et demeure responsable des usages effectués avant le blocage, sous réserve des droits prévus par la loi.");
  addParagraph("Roaming, hors-forfait et surconsommation. Les frais de roaming, hors-forfait, surconsommation ou services à valeur ajoutée (ex. international, numéros spéciaux, données excédentaires) sont facturés selon le plan choisi et/ou les tarifs applicables au moment de l'utilisation, tels qu'affichés au portail ou transmis par Nivra. En cas de volumes inhabituels ou risque de fraude, Nivra peut appliquer des mesures de protection (blocage temporaire, suspension, vérification d'identité).");

  // B2: Services Internet
  addSectionHeader("B2", "Services Internet (vitesse, Wi-Fi, réseau interne, usage raisonnable)");
  addParagraph("Vitesse \"jusqu'à\" et facteurs de performance. Les vitesses annoncées sont des vitesses maximales théoriques \"jusqu'à\". La vitesse réelle peut varier selon : congestion réseau, équipements, distance, qualité du câblage, interférences Wi-Fi, bâtiment, appareils connectés, et configuration du réseau interne. Sauf indication expresse au résumé du contrat (SLA/garantie), le service est fourni en best effort.");
  addParagraph("Réseau interne du Client. Le Client est responsable de son réseau interne (routeur personnel, Wi-Fi, câbles, prises, switch, appareils). Nivra n'est pas responsable des limitations de performance dues à l'équipement du Client, à la configuration interne, à des interférences ou à des installations non conformes.");
  addParagraph("Usage raisonnable (\"fair use\"). Si un plan illimité est offert, il demeure soumis à une politique d'usage raisonnable visant à prévenir l'abus, la fraude, l'atteinte à la sécurité du réseau ou la revente non autorisée. En cas d'usage abusif, Nivra peut imposer des mesures de gestion (réduction temporaire, blocage, suspension, vérification).");

  // B3: Services Télévision
  addSectionHeader("B3", "Services Télévision (chaînes, sélections, modifications et tickets)");
  addParagraph("Chaînes de base obligatoires. Tous les plans TV incluent automatiquement 25 ou 26 chaînes de base (gratuites et obligatoires) indiquées au moment de la commande et/ou au portail client.");
  addParagraph("Chaînes \"Free-Choice\" selon le plan. Selon le plan, le Client peut sélectionner un nombre déterminé de chaînes \"Free-Choice\" (gratuites). Les sélections sont consignées au résumé/commande/portail.");
  addParagraph("Chaînes Premium et payantes. Les chaînes Premium/payantes sont facturées en supplément, selon les tarifs affichés (ex. 10 $ à 18 $/mois par chaîne ou prix groupé si bundle) au moment de la commande.");
  addParagraph("Commandes créées par l'admin. Si la commande est placée par un administrateur, Nivra peut assigner des chaînes \"Free-Choice\" de façon aléatoire à des fins d'activation initiale. Dans ce cas, le Client peut demander une modification après l'installation/activation, selon les règles du plan.");
  addParagraph("Modifications et rôles (admin vs client). Les modifications de chaînes peuvent être restreintes selon l'origine de la commande (admin vs client) et le statut d'installation. Les règles exactes sont celles indiquées au portail et au résumé du contrat.");
  addParagraph("Ticket interne après confirmation. Lorsque des sélections/modifications doivent être confirmées par Nivra, un ticket interne est créé avec un ETA de 2 heures à 24 heures et les statuts : Open → In Progress → Completed. Le Client reconnaît que l'activation/modification peut dépendre de systèmes tiers et de fenêtres techniques.");

  // B4: Services de Sécurité
  addSectionHeader("B4", "Services de Sécurité (non-urgence, dépendances, tests et fausses alarmes)");
  addParagraph("Non-urgence. Les services de sécurité (équipements, capteurs, surveillance, etc.) ne remplacent pas les services d'urgence. En cas d'urgence, le Client doit contacter les autorités compétentes (911).");
  addParagraph("Dépendances (Internet/électricité). Les services de sécurité peuvent dépendre de l'alimentation électrique, d'Internet, du réseau cellulaire et d'autres facteurs externes. Nivra n'est pas responsable des interruptions causées par une panne d'électricité, une panne Internet, un défaut de réseau ou un problème du réseau interne du Client.");
  addParagraph("Installation, tests et fausses alarmes. Le Client s'engage à permettre les tests raisonnables après installation. Toute fausse alarme, déplacement additionnel, réinstallation ou intervention non couverte peut entraîner des frais tels qu'indiqués au résumé du contrat ou à la facture.");

  // ========== ANNEXE C: POLITIQUE D'INSTALLATION ET RENDEZ-VOUS (TERRAIN) ==========
  addNewPage();
  addAnnexeHeader("C", "POLITIQUE D'INSTALLATION ET RENDEZ-VOUS (TERRAIN)");

  addParagraph("Installation standard vs complexe. Une installation \"standard\" couvre les opérations normales prévues au plan (connexion de base, activation, vérifications usuelles). Une installation \"complexe\" peut inclure, sans limitation : câblage additionnel, perçage, traversée de murs/planchers, configuration avancée, déplacement de prises, accès restreint, ou toute situation exigeant du temps/équipement additionnel. Les frais applicables sont ceux indiqués au résumé du contrat, à la commande ou à la facture.");

  addParagraph("Prérequis et accès. Le Client doit assurer : accès au logement/local, accès au local technique/panneau, prise électrique fonctionnelle, présence d'une personne autorisée, et autorisation du propriétaire/condo lorsque requis. Les retards/échecs d'installation causés par l'absence de prérequis peuvent entraîner des frais de déplacement et une replanification.");

  addParagraph("Rendez-vous, retard et absence (no-show). Le Client doit être disponible dans la fenêtre prévue. En cas d'absence, d'accès impossible, d'annulation tardive ou de retard important, Nivra peut facturer des frais de déplacement/no-show tels qu'indiqués au résumé du contrat ou à la facture, et reprogrammer l'intervention.");

  addParagraph("Installation impossible. Si l'installation est impossible en raison de contraintes techniques, d'accès, d'infrastructure ou d'autorisation, Nivra peut clôturer l'intervention et facturer les frais déjà engagés (déplacement, diagnostic, etc.) selon les montants indiqués au résumé/commande/facture.");

  // ========== ANNEXE D: MODALITÉS DE PAIEMENT (INCLUANT E-TRANSFER) ==========
  addNewPage();
  addAnnexeHeader("D", "MODALITÉS DE PAIEMENT (INCLUANT E-TRANSFER)");

  // D1: Modes de paiement
  addSectionHeader("D1", "Modes de paiement");
  addParagraph("Les modes de paiement acceptés sont ceux indiqués au portail et/ou au résumé du contrat (carte, virement Interac e-Transfer, etc.). Nivra peut refuser un mode de paiement en cas de risque de fraude ou non-conformité.");

  // D2: e-Transfer
  addSectionHeader("D2", "e-Transfer — règles de traitement et activation");
  addParagraph("Instructions. Le Client doit envoyer le virement e-Transfer selon les instructions communiquées par Nivra (nom du bénéficiaire, question/réponse si applicable, montant exact, référence/numéro de facture).");
  addParagraph("Statuts e-Transfer (interne). Les paiements e-Transfer peuvent être suivis avec les statuts : Pending, In verification, Complete, Declined, Fraud. La mise à jour des statuts est gérée par Nivra.");
  addParagraph("Vérification et activation. Sauf indication contraire au résumé du contrat, l'activation/renouvellement du service se fait après réception et vérification du paiement. Si le Client envoie un mauvais montant, une mauvaise référence, ou une mauvaise réponse, le paiement peut être retardé, refusé ou retourné, et des frais administratifs peuvent s'appliquer.");
  addParagraph("Paiement retourné/refusé. Tout paiement retourné, refusé ou annulé peut entraîner une suspension de service et/ou des frais additionnels selon les présents Termes & Conditions et les montants indiqués à la facture.");

  // ========== ANNEXE E: SUPPORT, TICKETS, SLA (OPTIONNEL B2B) ET CLAUSES AVANCÉES ==========
  addNewPage();
  addAnnexeHeader("E", "SUPPORT, TICKETS, SLA (OPTIONNEL B2B) ET CLAUSES AVANCÉES");

  // E1: Support et tickets
  addSectionHeader("E1", "Support et tickets (portail)");
  addParagraph("Canaux. Le Client accepte que les communications (avis, factures, notifications, tickets) puissent être transmises via le portail client et/ou par courriel à l'adresse inscrite au dossier.");
  addParagraph("Délais de réponse cibles (sans garantie). Nivra vise des délais de réponse raisonnables selon la charge et la priorité du dossier. Ces délais sont des cibles et non une garantie, sauf SLA indiqué au résumé du contrat.");
  addParagraph("Obligations du Client. Le Client doit fournir des informations exactes, permettre l'accès lorsque requis, et collaborer au diagnostic (tests, photos, accès au modem/routeur). Les délais peuvent être prolongés si le Client ne répond pas ou ne fournit pas les informations nécessaires.");
  addParagraph("Fermeture de ticket. Un ticket peut être fermé si le Client ne répond pas ou ne fournit pas les informations requises après un délai raisonnable (ex. 7 jours), et pourra être rouvert sur demande.");

  // E2: SLA entreprise
  addSectionHeader("E2", "SLA entreprise (uniquement si indiqué au Résumé du contrat)");
  addParagraph("Si un plan \"Entreprise\" avec SLA est souscrit, les paramètres (heures de support, priorités P1/P2/P3, temps de réponse/rétablissement, crédits de service) sont définis au Résumé du contrat ou à une annexe SLA dédiée. À défaut, le service demeure en best effort.");

  // E3: Avis électroniques, non-renonciation, preuves, enregistrements
  addSectionHeader("E3", "Avis électroniques, non-renonciation, preuves, enregistrements");
  addParagraph("Avis électroniques. Les avis transmis via le portail et/ou par courriel sont réputés valides et reçus selon la date d'envoi/affichage, sous réserve des règles applicables.");
  addParagraph("Non-renonciation. Le fait pour Nivra de ne pas appliquer une clause à un moment donné ne constitue pas une renonciation à l'appliquer ultérieurement.");
  addParagraph("Preuves techniques. Le Client accepte que les journaux techniques (logs), confirmations d'activation, preuves de livraison, statuts de paiement et tickets puissent servir d'éléments de preuve en cas de contestation, dans la mesure permise par la loi.");
  addParagraph("Enregistrements (si applicable). Si Nivra enregistre certains appels pour qualité, conformité ou preuve, un avis sera donné au moment de l'appel lorsque requis.");

  currentY += 10;

  // End of Agreement
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryNavy);
  doc.text("— FIN DU CONTRAT —", pageWidth / 2, currentY, { align: "center" });

  // Update total pages - use pages array length
  totalPages = (doc.internal as any).pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Clear old footer area
    doc.setFillColor(255, 255, 255);
    doc.rect(0, pageHeight - 20, pageWidth, 20, "F");
    addFooter(i);
  }

  return doc;
};

// ========== UTILITY FUNCTIONS ==========

export const downloadPrepaidContractPDF = (data: PrepaidContractData): void => {
  try {
    const doc = generatePrepaidContractPDF(data);
    const blob = doc.output("blob");
    const version = data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version;
    const idPart = data.contractId || data.orderReference;
    const filename = `PSA-${idPart}-${version}.pdf`;
    safePDFDownload(blob, filename);
  } catch (error) {
    console.error("Error generating Prepaid PDF:", error);
    throw new Error("Failed to generate prepaid contract PDF");
  }
};

export const viewPrepaidContractPDF = (data: PrepaidContractData): void => {
  try {
    const doc = generatePrepaidContractPDF(data);
    const blob = doc.output("blob");
    const version = data.templateVersion || ACTIVE_CONTRACT_TEMPLATE.version;
    const idPart = data.contractId || data.orderReference;
    const filename = `PSA-${idPart}-${version}.pdf`;
    safePDFOpen(blob, filename);
  } catch (error) {
    console.error("Error viewing Prepaid PDF:", error);
    throw new Error("Failed to open prepaid contract PDF");
  }
};

export const getPrepaidContractBlob = (data: PrepaidContractData): Blob => {
  try {
    const doc = generatePrepaidContractPDF(data);
    return doc.output("blob");
  } catch (error) {
    console.error("Error creating Prepaid PDF blob:", error);
    throw new Error("Failed to create prepaid contract PDF");
  }
};
