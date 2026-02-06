/**
 * MODALITÉS DE SERVICE PDF GENERATOR — Nivra Telecom
 * Document ID: ND-TOS-2026-02-05
 * Version: 2026-02-05
 * 
 * This generator produces a professional multi-page PDF containing:
 * - Complete Terms of Service (Sections 1-21)
 * - Annexe B: Conditions spécifiques par service
 * - Annexe C: Politique d'installation et rendez-vous
 * - Annexe D: Modalités de paiement et e-Transfer
 * - Annexe E: Support, tickets, SLA Entreprise
 * 
 * CRITICAL: The text content is NEVER modified - exact reproduction required.
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { COMPANY_CONTACT } from "@/config/company";

// Document metadata
export const TERMS_DOCUMENT_INFO = {
  id: "ND-TOS-2026-02-05",
  version: "2026-02-05",
  title: "MODALITÉS DE SERVICE – NIVRA TELECOM",
  subtitle: "Version intégrale étendue – Prépayé à renouvellement mensuel (expérience postpayée)",
  lastUpdated: "2026-02-05",
};

export interface TermsModalitesData {
  orderId: string;
  orderNumber?: string;
  accountId?: string;
  accountNumber?: string;
  issuedDate: Date;
  clientName?: string;
  clientEmail?: string;
}

// Color palette
const COLORS = {
  navy: [15, 23, 42] as [number, number, number],
  teal: [20, 184, 166] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  gray: [100, 116, 139] as [number, number, number],
  lightGray: [148, 163, 184] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
};

/**
 * Generate the Terms/Modalités de service PDF
 */
export function generateTermsModalitesPDF(data: TermsModalitesData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter", // 8.5x11 inches
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const headerHeight = 25;
  const footerHeight = 15;
  let currentY = margin + headerHeight;
  let pageNumber = 1;
  let totalPages = 0; // Will be updated at the end

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const addHeader = () => {
    // Navy header bar
    doc.setFillColor(...COLORS.navy);
    doc.rect(0, 0, pageWidth, headerHeight, "F");

    // Company name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.white);
    doc.text("NIVRA TELECOM", margin, 10);

    // Document title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Modalités de service", margin, 16);

    // Document ID on right
    doc.setFontSize(8);
    doc.text(TERMS_DOCUMENT_INFO.id, pageWidth - margin, 10, { align: "right" });
    doc.text(`v${TERMS_DOCUMENT_INFO.version}`, pageWidth - margin, 16, { align: "right" });
  };

  const addFooter = () => {
    const footerY = pageHeight - footerHeight + 5;

    // Footer line
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    // Copyright
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text("© 2026 Nivra Communications Inc. Tous droits réservés.", margin, footerY + 2);

    // Page number placeholder (will be updated at the end)
    doc.text(`Page ${pageNumber}`, pageWidth - margin, footerY + 2, { align: "right" });
  };

  const checkPageBreak = (neededHeight: number): boolean => {
    const maxY = pageHeight - footerHeight - margin;
    if (currentY + neededHeight > maxY) {
      addFooter();
      doc.addPage();
      pageNumber++;
      addHeader();
      currentY = margin + headerHeight + 5;
      return true;
    }
    return false;
  };

  const addSectionTitle = (title: string, level: 1 | 2 | 3 = 1) => {
    checkPageBreak(15);
    
    const fontSize = level === 1 ? 12 : level === 2 ? 10 : 9;
    const color = level === 1 ? COLORS.navy : level === 2 ? COLORS.dark : COLORS.gray;
    const isBold = level <= 2;
    
    currentY += level === 1 ? 8 : level === 2 ? 6 : 4;
    
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.text(title, margin, currentY);
    
    currentY += fontSize * 0.4 + 3;
  };

  const addParagraph = (text: string, indent: number = 0) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.dark);

    const lines = doc.splitTextToSize(text, contentWidth - indent);
    const lineHeight = 4.5;
    const neededHeight = lines.length * lineHeight;

    checkPageBreak(neededHeight);

    for (const line of lines) {
      doc.text(line, margin + indent, currentY);
      currentY += lineHeight;
    }
    currentY += 2;
  };

  const addBulletPoint = (text: string, bulletChar: string = "•") => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.dark);

    const indent = 6;
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    const lineHeight = 4.5;
    const neededHeight = lines.length * lineHeight;

    checkPageBreak(neededHeight);

    doc.text(bulletChar, margin + 2, currentY);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], margin + indent, currentY);
      currentY += lineHeight;
    }
  };

  const addWarningBox = (text: string) => {
    checkPageBreak(15);
    
    const boxHeight = 12;
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(245, 158, 11); // amber-500
    doc.roundedRect(margin, currentY, contentWidth, boxHeight, 2, 2, "FD");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text("⚠️ " + text, margin + 4, currentY + 7);
    
    currentY += boxHeight + 4;
  };

  const addPageBreak = () => {
    addFooter();
    doc.addPage();
    pageNumber++;
    addHeader();
    currentY = margin + headerHeight + 5;
  };

  // ============================================================================
  // PAGE 1: COVER / FIRST PAGE
  // ============================================================================

  addHeader();

  // Title block
  currentY = margin + headerHeight + 15;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.navy);
  doc.text(TERMS_DOCUMENT_INFO.title, pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.gray);
  doc.text(TERMS_DOCUMENT_INFO.subtitle, pageWidth / 2, currentY, { align: "center" });
  currentY += 8;

  doc.setFontSize(9);
  doc.text(`Dernière mise à jour : ${TERMS_DOCUMENT_INFO.lastUpdated}`, pageWidth / 2, currentY, { align: "center" });
  currentY += 12;

  // Document metadata box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(...COLORS.lightGray);
  const metaBoxY = currentY;
  const metaBoxHeight = 28;
  doc.roundedRect(margin, metaBoxY, contentWidth, metaBoxHeight, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.navy);
  
  const col1X = margin + 8;
  const col2X = margin + contentWidth / 2;
  
  doc.text("Identifiant document :", col1X, metaBoxY + 8);
  doc.text("Identifiant commande :", col1X, metaBoxY + 15);
  doc.text("Date d'émission :", col2X, metaBoxY + 8);
  if (data.accountNumber) {
    doc.text("Numéro de compte :", col2X, metaBoxY + 15);
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  doc.text(TERMS_DOCUMENT_INFO.id, col1X + 40, metaBoxY + 8);
  doc.text(data.orderNumber || data.orderId.slice(0, 12).toUpperCase(), col1X + 45, metaBoxY + 15);
  doc.text(format(data.issuedDate, "d MMMM yyyy", { locale: fr }), col2X + 35, metaBoxY + 8);
  if (data.accountNumber) {
    doc.text(data.accountNumber, col2X + 40, metaBoxY + 15);
  }

  currentY = metaBoxY + metaBoxHeight + 10;

  // Separator
  doc.setDrawColor(...COLORS.teal);
  doc.setLineWidth(1);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // ============================================================================
  // SECTION 1: PRÉAMBULE, ACCEPTATION ET CHAMP D'APPLICATION
  // ============================================================================

  addSectionTitle("1. PRÉAMBULE, ACCEPTATION ET CHAMP D'APPLICATION");

  addParagraph(`Les présentes Modalités de service (les « Modalités ») constituent une entente légale contraignante entre Nivra Communications Inc., opérant sous le nom Nivra Telecom (« Nivra », « nous », « notre »), et toute personne physique ou morale (« Client », « vous », « votre ») qui :`);

  addBulletPoint("crée un compte client,");
  addBulletPoint("commande un service,");
  addBulletPoint("effectue un paiement,");
  addBulletPoint("utilise ou bénéficie d'un service fourni par Nivra.");

  addParagraph(`En accédant aux Services, en confirmant une commande, en effectuant un paiement ou en utilisant un Service, le Client reconnaît avoir lu, compris et accepté les présentes Modalités, sans réserve.`);

  addParagraph(`Les présentes Modalités s'appliquent exclusivement aux Services souscrits par le Client et doivent être lues conjointement avec :`);

  addBulletPoint("le contrat de services,");
  addBulletPoint("le résumé des renseignements essentiels,");
  addBulletPoint("les annexes applicables (installation, paiement, support, etc.),");
  addBulletPoint("les politiques publiées sur le portail client.");

  // ============================================================================
  // SECTION 2: DÉFINITIONS ET INTERPRÉTATION
  // ============================================================================

  addSectionTitle("2. DÉFINITIONS ET INTERPRÉTATION");

  addParagraph(`Aux fins des présentes Modalités, les termes suivants ont la signification ci-dessous :`);

  addBulletPoint("Services : ensemble des services de télécommunications offerts par Nivra, incluant notamment Internet, Mobile, Télévision et services connexes.");
  addBulletPoint("Client : toute personne ou entité ayant souscrit un ou plusieurs Services.");
  addBulletPoint("Compte : dossier client créé dans les systèmes de Nivra.");
  addBulletPoint("Cycle de facturation (Bill Cycle) : période contractuelle de trente (30) jours.");
  addBulletPoint("Date de cycle : jour du mois correspondant à la création du Compte.");
  addBulletPoint("Facture mensuelle : document généré à titre informatif indiquant les Services actifs et les montants applicables pour le cycle à venir.");
  addBulletPoint("Paiement confirmé : paiement reçu, validé et accepté par Nivra.");
  addBulletPoint("Non-renouvellement : absence de paiement confirmé à la date de cycle.");
  addBulletPoint("Suspension : interruption temporaire d'un Service à la suite d'un non-renouvellement.");
  addBulletPoint("Annulation : désactivation définitive d'un Service après expiration de la période de récupération.");

  addParagraph(`Les titres sont fournis à titre indicatif et n'affectent pas l'interprétation des présentes.`);

  // ============================================================================
  // SECTION 3: NATURE DES SERVICES
  // ============================================================================

  addSectionTitle("3. NATURE DES SERVICES ET ABSENCE DE VÉRIFICATION DE CRÉDIT");

  addParagraph(`Nivra est un fournisseur de services de télécommunications prépayés. Aucune vérification de crédit externe n'est effectuée lors de la souscription.`);

  addParagraph(`Les Services sont fournis sur la base :`);

  addBulletPoint("des informations fournies par le Client,");
  addBulletPoint("de la disponibilité technique,");
  addBulletPoint("des règles internes de prévention de fraude et de conformité.");

  addParagraph(`Nivra se réserve le droit de refuser, suspendre ou résilier un Service en cas d'information inexacte, incomplète ou trompeuse.`);

  // ============================================================================
  // SECTION 4: MODÈLE DE FACTURATION
  // ============================================================================

  addSectionTitle("4. MODÈLE DE FACTURATION — PRÉPAYÉ À RENOUVELLEMENT MENSUEL");

  addParagraph(`Tous les Services Nivra sont fournis selon un modèle prépayé, avec une présentation de type postpayée.`);

  addParagraph(`Une facture mensuelle est générée et rendue disponible avant chaque cycle afin de :`);

  addBulletPoint("résumer les Services actifs,");
  addBulletPoint("afficher les montants applicables,");
  addBulletPoint("permettre le renouvellement du cycle.");

  addWarningBox("La facture mensuelle ne constitue pas une dette. Aucun Service n'est fourni sans paiement confirmé pour le cycle correspondant.");

  // ============================================================================
  // SECTION 5: CYCLE DE FACTURATION
  // ============================================================================

  addSectionTitle("5. CYCLE DE FACTURATION, DATES ET AJUSTEMENTS");

  addSectionTitle("5.1 Durée du cycle", 3);
  addParagraph(`Chaque cycle couvre une période de 30 jours, sauf indication contraire.`);

  addSectionTitle("5.2 Date de cycle", 3);
  addParagraph(`La date de cycle est définie à la création du Compte. Si le mois ne comporte pas ce jour (ex. 29–31), la date est ajustée au dernier jour du mois.`);

  addSectionTitle("5.3 Début du cycle", 3);
  addParagraph(`Le cycle débute uniquement à la date et à l'heure de confirmation du paiement.`);

  // ============================================================================
  // SECTION 6: MODES DE PAIEMENT
  // ============================================================================

  addSectionTitle("6. MODES DE PAIEMENT ET TRAITEMENT");

  addParagraph(`Les modes de paiement acceptés incluent :`);

  addBulletPoint("Carte de crédit (via fournisseur autorisé),");
  addBulletPoint("PayPal,");
  addBulletPoint("Virement Interac e-Transfer.");

  addParagraph(`Nivra ne conserve aucun numéro complet de carte. Des contrôles antifraude peuvent entraîner un statut « en vérification ».`);

  addParagraph(`Un paiement non confirmé ne déclenche aucun renouvellement.`);

  // ============================================================================
  // SECTION 7: NON-RENOUVELLEMENT
  // ============================================================================

  addSectionTitle("7. NON-RENOUVELLEMENT, SUSPENSION ET ABSENCE DE DETTE");

  addParagraph(`En l'absence de paiement confirmé à la date de cycle :`);

  addBulletPoint("Le cycle n'est pas renouvelé");
  addBulletPoint("Le Service est suspendu automatiquement");
  addBulletPoint("Aucun intérêt, frais de retard ou pénalité ne s'applique");
  addBulletPoint("Le Client ne contracte aucune dette envers Nivra");

  addParagraph(`Le non-renouvellement constitue une interruption volontaire du Service, et non un défaut de paiement postpayé.`);

  // ============================================================================
  // SECTION 8: PÉRIODE DE SUSPENSION
  // ============================================================================

  addSectionTitle("8. PÉRIODE DE SUSPENSION ET ANNULATION APRÈS 90 JOURS");

  addParagraph(`Après suspension :`);

  addBulletPoint("le Service demeure récupérable pendant 90 jours civils,");
  addBulletPoint("aucune facturation n'est générée pendant cette période.");

  addParagraph(`Après 90 jours sans paiement :`);

  addBulletPoint("le Service est annulé définitivement,");
  addBulletPoint("les numéros de téléphone peuvent devenir irrécupérables,");
  addBulletPoint("une nouvelle activation peut être requise.");

  // ============================================================================
  // SECTION 9: ANNULATION
  // ============================================================================

  addSectionTitle("9. ANNULATION PAR LE CLIENT");

  addParagraph(`Le Client peut annuler un Service à tout moment.`);

  addParagraph(`L'annulation prend effet à la fin du cycle payé.`);

  addParagraph(`Aucun remboursement partiel n'est accordé.`);

  addParagraph(`Exceptions : obligation légale ou erreur de facturation confirmée.`);

  // ============================================================================
  // SECTION 10: INSTALLATION
  // ============================================================================

  addSectionTitle("10. INSTALLATION, RENDEZ-VOUS ET ACCÈS");

  addSectionTitle("10.1 Installation standard", 3);
  addParagraph(`Inclut les opérations normales prévues au plan souscrit.`);

  addSectionTitle("10.2 Installation complexe", 3);
  addParagraph(`Peut inclure câblage, perçage, configuration avancée ou contraintes d'accès. Des frais supplémentaires peuvent s'appliquer.`);

  addSectionTitle("10.3 Absence ou accès impossible", 3);
  addParagraph(`Une absence, un retard important ou un accès impossible peut entraîner :`);
  addBulletPoint("frais de déplacement,");
  addBulletPoint("replanification,");
  addBulletPoint("annulation de l'intervention.");

  // ============================================================================
  // SECTION 11: ÉQUIPEMENT
  // ============================================================================

  addSectionTitle("11. ÉQUIPEMENT, SIM, eSIM ET GARANTIE");

  addParagraph(`Les équipements fournis peuvent être neufs ou remis à neuf.`);

  addBulletPoint("Garantie limitée : 1 an");
  addBulletPoint("DOA : 14 jours");
  addBulletPoint("Exclusions : bris, liquide, perte, vol, modifications non autorisées");

  addParagraph(`Les cartes SIM et eSIM peuvent entraîner des frais d'activation ou de remplacement.`);

  // ============================================================================
  // SECTION 12-21: REMAINING SECTIONS
  // ============================================================================

  addSectionTitle("12. CONDITIONS SPÉCIFIQUES — MOBILE");

  addBulletPoint("Portabilité soumise au fournisseur précédent");
  addBulletPoint("Informations exactes requises (nom, numéro, NIP de portage)");
  addBulletPoint("Le Client demeure responsable des usages avant blocage en cas de perte/vol");
  addBulletPoint("Les frais hors-forfait sont facturés selon l'usage réel");

  addSectionTitle("13. CONDITIONS SPÉCIFIQUES — INTERNET");

  addBulletPoint("Vitesses annoncées « jusqu'à »");
  addBulletPoint("Performance dépend du réseau interne du Client");
  addBulletPoint("Usage raisonnable applicable même sur forfaits illimités");
  addBulletPoint("Service fourni sur une base best effort");

  addSectionTitle("14. CONDITIONS SPÉCIFIQUES — TÉLÉVISION");

  addBulletPoint("Un forfait Internet actif est requis");
  addBulletPoint("Chaînes incluses selon le plan");
  addBulletPoint("Chaînes premium facturées en supplément");
  addBulletPoint("Certaines modifications nécessitent un ticket support");

  addSectionTitle("15. SUPPORT, TICKETS ET SLA");

  addParagraph(`Le support est offert via :`);
  addBulletPoint("portail client,");
  addBulletPoint("courriel officiel.");

  addParagraph(`Les délais annoncés sont des objectifs, non des garanties. Un SLA s'applique uniquement s'il est expressément indiqué au contrat.`);

  addSectionTitle("16. FRAUDE, CONTESTATIONS ET CHARGEBACKS");

  addParagraph(`Avant toute contestation bancaire, le Client doit contacter Nivra.`);

  addParagraph(`En cas de chargeback confirmé :`);
  addBulletPoint("suspension du Service possible,");
  addBulletPoint("frais administratifs raisonnables,");
  addBulletPoint("mesures de recouvrement permises par la loi.");

  addParagraph(`Ces mesures ne s'appliquent jamais aux non-renouvellements normaux.`);

  addSectionTitle("17. IDENTITÉ, SÉCURITÉ ET NIP");

  addBulletPoint("Une pièce d'identité valide peut être exigée");
  addBulletPoint("Un NIP à 4 chiffres est requis pour certaines opérations");
  addBulletPoint("Le Client est responsable de la confidentialité de son NIP");

  addSectionTitle("18. PROTECTION DES RENSEIGNEMENTS PERSONNELS");

  addParagraph(`Nivra protège les renseignements personnels conformément :`);
  addBulletPoint("à la Loi 25 (Québec),");
  addBulletPoint("à la PIPEDA (Canada).");

  addParagraph(`Les données sont utilisées uniquement pour :`);
  addBulletPoint("fournir les Services,");
  addBulletPoint("gérer la facturation,");
  addBulletPoint("offrir le support,");
  addBulletPoint("prévenir la fraude.");

  addSectionTitle("19. LIMITATION DE RESPONSABILITÉ");

  addParagraph(`Dans la mesure permise par la loi :`);
  addBulletPoint("Nivra n'est pas responsable des dommages indirects,");
  addBulletPoint("la responsabilité totale est limitée aux montants payés pour le cycle concerné.");

  addSectionTitle("20. CONFORMITÉ RÉGLEMENTAIRE ET PLAINTES");

  addParagraph(`Nivra vise la conformité aux codes applicables du CRTC.`);

  addParagraph(`Si un différend n'est pas résolu, le Client peut s'adresser à la Commission des plaintes relatives aux services de télécom-télévision (CPRST / CCTS).`);

  addSectionTitle("21. DROIT APPLICABLE, DIVISIBILITÉ ET INTÉGRALITÉ");

  addParagraph(`Les présentes Modalités sont régies par les lois du Québec et du Canada.`);

  addParagraph(`Si une clause est invalide, les autres demeurent en vigueur. Les présentes Modalités et leurs annexes constituent l'intégralité de l'entente.`);

  // ============================================================================
  // ANNEXE B — CONDITIONS SPÉCIFIQUES PAR SERVICE
  // ============================================================================

  addPageBreak();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.navy);
  doc.text("ANNEXE B — CONDITIONS SPÉCIFIQUES PAR SERVICE", pageWidth / 2, currentY, { align: "center" });
  currentY += 6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text("(Fait partie intégrante des Modalités de service – Nivra Telecom)", pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  addSectionTitle("B.1 — DISPOSITIONS GÉNÉRALES APPLICABLES AUX SERVICES", 2);
  addParagraph(`Les présentes conditions spécifiques complètent les Modalités de service générales et s'appliquent uniquement aux services effectivement souscrits par le Client. En cas de divergence, les conditions spécifiques du service concerné prévalent sur les dispositions générales, dans la mesure permise par la loi.`);
  addParagraph(`Les services sont fournis sous réserve :`);
  addBulletPoint("de la disponibilité technique,");
  addBulletPoint("de la couverture réseau,");
  addBulletPoint("des contraintes imposées par des fournisseurs tiers,");
  addBulletPoint("des règles de sécurité et de conformité internes de Nivra.");

  addSectionTitle("B.2 — SERVICES MOBILES", 2);

  addSectionTitle("B.2.1 Portabilité des numéros", 3);
  addParagraph(`Le Client peut demander le transfert (portabilité) de son numéro vers Nivra Telecom. La portabilité dépend du fournisseur cédant, des informations fournies par le Client, et des règles réglementaires applicables.`);
  addParagraph(`Le Client est responsable de fournir des informations exactes et complètes, incluant : nom exact au dossier, numéro à transférer, NIP/PIN de portage (si requis).`);
  addParagraph(`Tout refus, délai ou échec causé par des informations inexactes ne saurait engager la responsabilité de Nivra.`);

  addSectionTitle("B.2.2 Carte SIM et eSIM", 3);
  addParagraph(`Le Client est responsable de la conservation et de la sécurité de sa carte SIM ou eSIM. Des frais peuvent s'appliquer pour activation initiale, remplacement, perte, vol ou bris, changement de SIM ou eSIM.`);
  addParagraph(`En cas de perte ou de vol, le Client doit aviser Nivra immédiatement afin de bloquer la ligne. Le Client demeure responsable de toute utilisation effectuée avant le blocage.`);

  addSectionTitle("B.2.3 Utilisation, surconsommation et hors-forfait", 3);
  addParagraph(`Les frais liés à l'itinérance (roaming), les données excédentaires, les appels internationaux, les numéros spéciaux ou services à valeur ajoutée, sont facturés selon les tarifs applicables au moment de l'utilisation, tels qu'affichés au portail client.`);
  addParagraph(`En cas d'utilisation inhabituelle ou de risque de fraude, Nivra peut appliquer des mesures de protection, incluant un blocage temporaire ou une suspension.`);

  addSectionTitle("B.3 — SERVICES INTERNET", 2);

  addSectionTitle("B.3.1 Vitesse et performance", 3);
  addParagraph(`Les vitesses annoncées sont des vitesses maximales théoriques « jusqu'à ». La vitesse réelle peut varier en fonction notamment de la congestion du réseau, de la qualité du câblage, du matériel utilisé, du réseau interne du Client, et des interférences Wi-Fi. Sauf mention expresse, les services sont fournis sur une base best effort.`);

  addSectionTitle("B.3.2 Réseau interne du Client", 3);
  addParagraph(`Le Client est entièrement responsable de son réseau interne, de ses appareils, de la configuration Wi-Fi, et de la sécurité de ses équipements. Nivra n'est pas responsable des limitations de performance ou interruptions causées par l'équipement ou l'environnement du Client.`);

  addSectionTitle("B.3.3 Usage raisonnable", 3);
  addParagraph(`Même lorsqu'un forfait est présenté comme « illimité », il demeure soumis à une politique d'usage raisonnable visant à prévenir l'abus, la fraude, la revente non autorisée, et les atteintes à la sécurité du réseau. En cas d'usage abusif, Nivra peut appliquer des mesures de gestion du trafic ou suspendre le service.`);

  addSectionTitle("B.4 — SERVICES DE TÉLÉVISION", 2);

  addSectionTitle("B.4.1 Dépendance au service Internet", 3);
  addParagraph(`Le service de télévision Nivra nécessite un forfait Internet actif. En cas de résiliation ou d'annulation du service Internet, le service TV sera automatiquement résilié.`);

  addSectionTitle("B.4.2 Chaînes incluses et options", 3);
  addParagraph(`Les chaînes incluses dépendent du plan souscrit. Certains plans incluent des chaînes de base obligatoires, des chaînes à sélection libre (« Free-Choice »), et des chaînes premium facturées en supplément. Les sélections sont consignées au portail client.`);

  addSectionTitle("B.4.3 Modifications et tickets", 3);
  addParagraph(`Certaines modifications de chaînes nécessitent la création d'un ticket de support. Les délais de traitement sont indicatifs et peuvent varier selon les contraintes techniques et les systèmes tiers.`);

  addSectionTitle("B.5 — INSTALLATION ET INTERVENTIONS TECHNIQUES", 2);

  addSectionTitle("B.5.1 Installation standard", 3);
  addParagraph(`L'installation standard couvre les opérations normales prévues au plan souscrit.`);

  addSectionTitle("B.5.2 Installation complexe", 3);
  addParagraph(`Une installation est considérée complexe lorsqu'elle implique câblage additionnel, perçage de murs, traversée de cloisons, configuration réseau avancée, déplacement ou ajout de prises, accès restreint ou conditions particulières sur le site, et contraintes liées à la structure du bâtiment.`);
  addParagraph(`Toute installation complexe peut entraîner des frais additionnels, une replanification, ou un refus d'intervention si les conditions ne sont pas sécuritaires ou conformes.`);

  addSectionTitle("B.5.3 Rendez-vous manqué", 3);
  addParagraph(`En cas d'absence, d'accès impossible ou d'annulation tardive, des frais de déplacement ou de replanification peuvent être facturés.`);

  addSectionTitle("B.6 — ÉQUIPEMENT ET GARANTIE", 2);
  addParagraph(`Les équipements fournis par Nivra peuvent être neufs ou remis à neuf.`);
  addParagraph(`Garantie limitée de un (1) an. Fenêtre DOA : 14 jours.`);
  addParagraph(`La garantie ne couvre pas : dommages causés par le Client, perte ou vol, dommages liquides, bris physiques, modifications non autorisées.`);

  addSectionTitle("B.7 — SERVICES DE SÉCURITÉ (SI APPLICABLE)", 2);
  addParagraph(`Les services de sécurité fournis par Nivra ne remplacent pas les services d'urgence et peuvent dépendre de l'électricité, d'Internet ou du réseau mobile. En cas d'urgence, le Client doit contacter les autorités compétentes (911).`);

  addSectionTitle("B.8 — SUPPORT, TICKETS ET SLA", 2);
  addParagraph(`Toutes les demandes de support doivent transiter par le portail client ou les canaux officiels indiqués par Nivra. Les délais de réponse sont des objectifs, non des garanties. Un SLA ne s'applique que s'il est expressément prévu au contrat ou au résumé des renseignements essentiels. Les tickets peuvent être fermés après un délai raisonnable en l'absence de réponse du Client.`);

  addSectionTitle("B.9 — RESPONSABILITÉS DU CLIENT", 2);
  addParagraph(`Le Client s'engage à fournir des informations exactes, collaborer au diagnostic, permettre l'accès lorsque requis, et utiliser les services conformément aux lois applicables.`);

  addSectionTitle("B.10 — DISPOSITIONS FINALES DE L'ANNEXE B", 2);
  addParagraph(`La présente Annexe B fait partie intégrante des Modalités de service. Elle est réputée acceptée par le Client dès la souscription, l'utilisation ou le renouvellement d'un Service.`);

  // ============================================================================
  // ANNEXE C — POLITIQUE D'INSTALLATION ET RENDEZ-VOUS
  // ============================================================================

  addPageBreak();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.navy);
  doc.text("ANNEXE C — POLITIQUE D'INSTALLATION ET RENDEZ-VOUS", pageWidth / 2, currentY, { align: "center" });
  currentY += 6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text("(Fait partie intégrante des Modalités de service – Nivra Telecom)", pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  addSectionTitle("C.1 — PORTÉE DE L'ANNEXE C", 2);
  addParagraph(`La présente Annexe C encadre l'ensemble des règles applicables aux installations, interventions techniques, rendez-vous, déplacements de techniciens et accès aux lieux dans le cadre des services fournis par Nivra Telecom.`);
  addParagraph(`Elle s'applique à tout Client ayant souscrit un service nécessitant une installation initiale, une activation sur site, une intervention technique, ou un déplacement planifié ou non planifié.`);

  addSectionTitle("C.2 — TYPES D'INSTALLATION", 2);

  addSectionTitle("C.2.1 Installation standard", 3);
  addParagraph(`Une installation est considérée comme standard lorsqu'elle inclut uniquement la connexion aux infrastructures existantes, l'activation du service, les vérifications usuelles de fonctionnement, et la configuration de base prévue au plan souscrit.`);
  addParagraph(`L'installation standard est limitée au temps, aux équipements et aux opérations normalement requis pour un service résidentiel ou commercial simple.`);

  addSectionTitle("C.2.2 Installation complexe", 3);
  addParagraph(`Une installation est considérée complexe lorsqu'elle implique, sans s'y limiter : câblage additionnel, perçage de murs, planchers ou plafonds, traversée de cloisons, configuration réseau avancée, déplacement ou ajout de prises, accès restreint ou conditions particulières sur le site, contraintes liées à la structure du bâtiment.`);
  addParagraph(`Toute installation complexe peut entraîner des frais additionnels, une replanification, ou un refus d'intervention si les conditions ne sont pas sécuritaires ou conformes.`);

  addSectionTitle("C.3 — PRÉREQUIS À L'INSTALLATION", 2);
  addParagraph(`Le Client doit s'assurer, avant le rendez-vous, que les conditions suivantes sont respectées :`);
  addBulletPoint("accès libre et sécuritaire au logement ou local,");
  addBulletPoint("accès au local technique, panneau électrique ou point d'entrée,");
  addBulletPoint("prise électrique fonctionnelle,");
  addBulletPoint("présence d'une personne majeure autorisée,");
  addBulletPoint("autorisation écrite du propriétaire ou du syndicat (si requis).");
  addParagraph(`Tout manquement à ces prérequis peut entraîner l'échec de l'installation, des frais de déplacement, ou une replanification à une date ultérieure.`);

  addSectionTitle("C.4 — RENDEZ-VOUS ET FENÊTRES D'INTERVENTION", 2);
  addParagraph(`Les rendez-vous sont planifiés dans une fenêtre horaire estimée. Les heures fournies sont indicatives et peuvent varier en fonction du volume d'interventions, des contraintes techniques, des conditions de circulation ou météo, de facteurs hors du contrôle de Nivra.`);
  addParagraph(`Nivra ne garantit pas une heure exacte d'arrivée, mais s'engage à respecter la fenêtre prévue dans la mesure du possible.`);

  addSectionTitle("C.5 — ABSENCE, RETARD ET NO-SHOW", 2);

  addSectionTitle("C.5.1 Absence du Client", 3);
  addParagraph(`Si le Client est absent au moment du rendez-vous ou refuse l'accès : l'intervention peut être annulée, des frais de déplacement / no-show peuvent être facturés, une nouvelle date devra être planifiée.`);

  addSectionTitle("C.5.2 Annulation tardive", 3);
  addParagraph(`Toute annulation effectuée sans préavis raisonnable peut entraîner des frais, tels qu'indiqués au résumé de contrat, à la commande ou à la facture.`);

  addSectionTitle("C.6 — INSTALLATION IMPOSSIBLE", 2);
  addParagraph(`Une installation peut être jugée impossible pour des raisons incluant : contraintes techniques, absence d'infrastructure, accès refusé, conditions dangereuses, non-conformité du site.`);
  addParagraph(`Dans ce cas : l'intervention peut être clôturée, les frais déjà engagés (déplacement, diagnostic) peuvent être facturés, le service peut être annulé sans activation.`);

  addSectionTitle("C.7 — RESPONSABILITÉS ET LIMITES", 2);
  addParagraph(`Le technicien n'est pas autorisé à modifier des structures porteuses, effectuer des travaux électriques majeurs, intervenir sur des équipements non liés au service, ou contourner des règles de sécurité ou de conformité.`);
  addParagraph(`Toute demande excédant le cadre de l'installation prévue peut être refusée.`);

  addSectionTitle("C.8 — INTERVENTIONS POST-INSTALLATION", 2);
  addParagraph(`Les interventions ultérieures (déplacement, reconfiguration, diagnostic avancé) peuvent être facturées, planifiées selon disponibilité, et soumises à validation préalable.`);

  addSectionTitle("C.9 — ACCEPTATION DE L'INSTALLATION", 2);
  addParagraph(`À la fin de l'intervention, le Client reconnaît que le service est fonctionnel selon les tests effectués, l'installation est conforme au plan souscrit, et toute anomalie doit être signalée rapidement via le support.`);

  addSectionTitle("C.10 — DISPOSITIONS FINALES", 2);
  addParagraph(`La présente Annexe C est réputée acceptée dès la confirmation d'un rendez-vous ou l'exécution d'une intervention.`);

  // ============================================================================
  // ANNEXE D — MODALITÉS DE PAIEMENT ET e-TRANSFER
  // ============================================================================

  addPageBreak();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.navy);
  doc.text("ANNEXE D — MODALITÉS DE PAIEMENT ET e-TRANSFER", pageWidth / 2, currentY, { align: "center" });
  currentY += 6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text("(Fait partie intégrante des Modalités de service – Nivra Telecom)", pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  addSectionTitle("D.1 — PORTÉE DE L'ANNEXE D", 2);
  addParagraph(`La présente Annexe D encadre les règles applicables aux paiements, moyens de paiement, traitement, vérification, non-confirmation, ainsi qu'aux paiements Interac e-Transfer.`);
  addParagraph(`Elle s'applique à l'ensemble des Services Nivra, dans le cadre du modèle prépayé à renouvellement mensuel.`);

  addSectionTitle("D.2 — MOYENS DE PAIEMENT ACCEPTÉS", 2);
  addParagraph(`Les moyens de paiement acceptés incluent :`);
  addBulletPoint("Carte de crédit (traitée par un fournisseur autorisé),");
  addBulletPoint("PayPal,");
  addBulletPoint("Virement Interac e-Transfer.");
  addParagraph(`Nivra se réserve le droit de limiter un mode de paiement, de refuser un paiement, ou de placer un paiement en vérification, en cas de risque de fraude ou de non-conformité.`);

  addSectionTitle("D.3 — PAIEMENT PAR CARTE DE CRÉDIT", 2);
  addParagraph(`Les paiements par carte sont traités par des plateformes sécurisées, ne sont pas stockés intégralement par Nivra, et peuvent faire l'objet de contrôles antifraude.`);
  addParagraph(`Un paiement refusé ou annulé ne déclenche aucune activation ni renouvellement.`);

  addSectionTitle("D.4 — PAIEMENT PAR PAYPAL", 2);
  addParagraph(`Les paiements PayPal sont soumis aux règles de PayPal et au statut de confirmation retourné.`);
  addParagraph(`Un paiement PayPal non confirmé ou contesté peut entraîner la suspension du service.`);

  addSectionTitle("D.5 — PAIEMENT PAR VIREMENT INTERAC (e-TRANSFER)", 2);

  addSectionTitle("D.5.1 Instructions générales", 3);
  addParagraph(`Le Client doit suivre strictement les instructions communiquées par Nivra, incluant : adresse de destination, montant exact, référence (numéro de compte ou facture), message requis.`);

  addSectionTitle("D.5.2 Statuts de paiement e-Transfer", 3);
  addParagraph(`Les paiements e-Transfer peuvent passer par les statuts suivants : Pending (En attente), In verification (En vérification), Completed (Confirmé), Declined (Refusé), Fraud (Fraude suspectée).`);
  addParagraph(`L'activation ou le renouvellement est effectué uniquement au statut Confirmé.`);

  addSectionTitle("D.5.3 Erreurs de paiement", 3);
  addParagraph(`En cas de montant incorrect, mauvaise référence, ou réponse invalide, le paiement peut être retardé, refusé ou retourné, sans obligation d'activation.`);

  addSectionTitle("D.6 — PAIEMENT EN VÉRIFICATION", 2);
  addParagraph(`Un paiement en vérification n'entraîne aucune pénalité, ne garantit pas l'activation, et peut retarder le renouvellement du service.`);
  addParagraph(`Le Client demeure responsable de fournir un paiement valide et conforme.`);

  addSectionTitle("D.7 — NON-RENOUVELLEMENT PRÉPAYÉ", 2);
  addParagraph(`En l'absence de paiement confirmé : le service n'est pas renouvelé, il est suspendu automatiquement, aucune dette n'est créée, aucun intérêt ne s'applique.`);

  addSectionTitle("D.8 — CONTESTATIONS ET CHARGEBACKS", 2);
  addParagraph(`Avant toute contestation bancaire, le Client doit contacter le support Nivra.`);
  addParagraph(`En cas de contestation ou chargeback confirmé : le service peut être suspendu, des frais administratifs raisonnables peuvent s'appliquer, des mesures de recouvrement peuvent être entreprises, dans la mesure permise par la loi.`);
  addParagraph(`Ces mesures ne s'appliquent pas aux non-renouvellements normaux.`);

  addSectionTitle("D.9 — PREUVES ET TRAÇABILITÉ", 2);
  addParagraph(`Le Client reconnaît que peuvent servir de preuve : confirmations de paiement, statuts e-Transfer, journaux techniques, factures, communications via le portail ou courriel.`);

  addSectionTitle("D.10 — DISPOSITIONS FINALES", 2);
  addParagraph(`La présente Annexe D est réputée acceptée dès qu'un paiement est effectué ou tenté auprès de Nivra Telecom.`);

  // ============================================================================
  // ANNEXE E — SUPPORT, TICKETS, SLA ENTREPRISE
  // ============================================================================

  addPageBreak();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.navy);
  doc.text("ANNEXE E — SUPPORT, TICKETS, SLA ENTREPRISE", pageWidth / 2, currentY, { align: "center" });
  currentY += 6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text("(Fait partie intégrante des Modalités de service – Nivra Telecom)", pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  addSectionTitle("E.1 — PORTÉE ET OBJECTIF DE L'ANNEXE E", 2);
  addParagraph(`La présente Annexe E encadre les règles applicables au support technique, à la gestion des tickets, aux délais de réponse, ainsi qu'aux engagements de niveau de service (SLA) lorsqu'un plan Entreprise ou B2B est souscrit.`);
  addParagraph(`Elle s'applique à tous les Clients utilisant le support Nivra, et spécifiquement aux Clients Entreprise bénéficiant d'un SLA contractuel, lorsque mentionné au contrat ou au résumé des renseignements essentiels.`);
  addParagraph(`À défaut d'un SLA expressément indiqué, les services sont fournis sur une base best effort.`);

  addSectionTitle("E.2 — CANAUX DE SUPPORT OFFICIELS", 2);
  addParagraph(`Les communications avec Nivra doivent transiter par les canaux officiels suivants :`);
  addBulletPoint("Portail client (méthode prioritaire) : Création et suivi de tickets, notifications, pièces jointes.");
  addBulletPoint(`Courriel de support : ${COMPANY_CONTACT.supportEmailDisplay}`);
  addBulletPoint("Autres canaux (chat, téléphone) : lorsque disponibles et indiqués au portail.");
  addParagraph(`Les demandes transmises par des canaux non officiels peuvent ne pas être traitées.`);

  addSectionTitle("E.3 — SYSTÈME DE TICKETS", 2);

  addSectionTitle("E.3.1 Création d'un ticket", 3);
  addParagraph(`Toute demande de support, incident ou question doit faire l'objet d'un ticket contenant : une description claire du problème, le service concerné, toute information ou preuve pertinente (photos, messages d'erreur, tests).`);
  addParagraph(`Un ticket incomplet peut retarder le traitement.`);

  addSectionTitle("E.3.2 Statuts de tickets", 3);
  addParagraph(`Les tickets suivent généralement les statuts suivants : Open (Ouvert), In Progress (En cours), Waiting for Client (En attente du client), Resolved (Résolu), Closed (Fermé).`);

  addSectionTitle("E.3.3 Fermeture automatique", 3);
  addParagraph(`Un ticket peut être fermé automatiquement si le Client ne répond pas aux demandes d'information ou ne fournit pas les éléments requis pendant une période raisonnable (ex. 7 jours). Un ticket fermé peut être rouvert sur demande.`);

  addSectionTitle("E.4 — PRIORISATION DES INCIDENTS", 2);
  addParagraph(`Les incidents sont classés selon leur impact :`);
  addBulletPoint("P1 – Critique : service entièrement indisponible (Entreprise)");
  addBulletPoint("P2 – Majeur : dégradation importante");
  addBulletPoint("P3 – Standard : incident partiel ou intermittent");
  addBulletPoint("P4 – Mineur / Demande : information, configuration, changement");
  addParagraph(`La priorité détermine l'ordre de traitement et les délais cibles.`);

  addSectionTitle("E.5 — DÉLAIS DE RÉPONSE (OBJECTIFS GÉNÉRAUX)", 2);
  addParagraph(`Sauf SLA spécifique, Nivra vise les objectifs suivants sans garantie :`);
  addBulletPoint("Première réponse : 24 heures ouvrables");
  addBulletPoint("Résolution standard : 48 à 72 heures ouvrables");
  addBulletPoint("Modifications TV / configuration : 2 à 24 heures");
  addBulletPoint("Incidents critiques : traitement prioritaire lorsque possible");
  addParagraph(`Les délais peuvent varier selon la complexité, la collaboration du Client, et les dépendances à des fournisseurs tiers.`);

  addSectionTitle("E.6 — SLA ENTREPRISE (SI APPLICABLE)", 2);

  addSectionTitle("E.6.1 Applicabilité", 3);
  addParagraph(`Un SLA Entreprise s'applique uniquement si explicitement indiqué au contrat, mentionné au résumé des renseignements essentiels, ou prévu dans une annexe SLA dédiée. À défaut, aucun SLA garanti ne s'applique.`);

  addSectionTitle("E.6.2 Paramètres SLA", 3);
  addParagraph(`Selon le plan Entreprise souscrit, le SLA peut inclure : heures de support étendues, délais de réponse garantis, délais de rétablissement ciblés, priorisation P1/P2, crédits de service conditionnels.`);
  addParagraph(`Les paramètres précis sont ceux indiqués au contrat.`);

  addSectionTitle("E.6.3 Exclusions SLA", 3);
  addParagraph(`Le SLA ne s'applique pas aux interruptions causées par : force majeure, pannes électriques, problèmes du réseau interne du Client, équipements non fournis par Nivra, actes du Client ou tiers, maintenance planifiée ou urgente.`);

  addSectionTitle("E.7 — OBLIGATIONS DU CLIENT", 2);
  addParagraph(`Le Client s'engage à fournir des informations exactes et complètes, permettre l'accès lorsque requis, effectuer les tests demandés, et collaborer au diagnostic.`);
  addParagraph(`Le non-respect de ces obligations peut retarder la résolution, suspendre le traitement du ticket, ou invalider un SLA.`);

  addSectionTitle("E.8 — CHANGEMENTS, CONFIGURATIONS ET DEMANDES ADMIN", 2);
  addParagraph(`Certaines demandes (ex. changement de plan, chaînes TV, configuration réseau) peuvent nécessiter une validation administrative, peuvent entraîner des délais additionnels, et peuvent être facturées selon la nature de la demande.`);

  addSectionTitle("E.9 — PREUVES TECHNIQUES ET TRAÇABILITÉ", 2);
  addParagraph(`Le Client reconnaît que peuvent servir de preuves en cas de litige : journaux techniques (logs), statuts de tickets, confirmations d'activation, preuves de livraison ou d'intervention, communications via le portail ou courriel.`);

  addSectionTitle("E.10 — ENREGISTREMENTS ET QUALITÉ", 2);
  addParagraph(`Nivra peut, lorsque permis par la loi : enregistrer certaines communications, analyser les tickets à des fins de qualité, utiliser des données agrégées pour améliorer ses services. Un avis est donné lorsque requis.`);

  addSectionTitle("E.11 — PLAINTES INTERNES", 2);
  addParagraph(`Avant tout recours externe, le Client doit ouvrir un ticket de plainte, décrire précisément la situation, et permettre une analyse interne. Nivra vise un traitement équitable et documenté des plaintes.`);

  addSectionTitle("E.12 — RECOURS EXTERNES (CPRST / CCTS)", 2);
  addParagraph(`Si une plainte n'est pas résolue à la satisfaction du Client, celui-ci peut contacter la Commission des plaintes relatives aux services de télécom-télévision (CPRST / CCTS), organisme indépendant de résolution des plaintes au Canada.`);
  addParagraph(`Les coordonnées et procédures sont disponibles sur le site officiel du CPRST.`);

  addSectionTitle("E.13 — LIMITATION ET NON-GARANTIE", 2);
  addParagraph(`Sauf SLA expressément prévu : les délais sont indicatifs, aucune garantie de temps de rétablissement n'est accordée, le support est fourni selon une obligation de moyens.`);

  addSectionTitle("E.14 — ACCEPTATION ET INTÉGRALITÉ", 2);
  addParagraph(`La présente Annexe E fait partie intégrante des Modalités de service. Elle est réputée acceptée dès l'utilisation du support, la création d'un ticket, ou la souscription à un plan Entreprise.`);

  // ============================================================================
  // FINAL PAGE: ACCEPTANCE
  // ============================================================================

  addPageBreak();

  // Acceptance section
  currentY = margin + headerHeight + 20;

  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(...COLORS.teal);
  doc.setLineWidth(1);
  const acceptBoxY = currentY;
  const acceptBoxHeight = 50;
  doc.roundedRect(margin, acceptBoxY, contentWidth, acceptBoxHeight, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.navy);
  doc.text("ACCEPTATION DES MODALITÉS", margin + contentWidth / 2, acceptBoxY + 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  doc.text(`Accepté lors de la commande #${data.orderNumber || data.orderId}`, margin + contentWidth / 2, acceptBoxY + 25, { align: "center" });
  doc.text(`Date : ${format(data.issuedDate, "d MMMM yyyy 'à' HH:mm", { locale: fr })}`, margin + contentWidth / 2, acceptBoxY + 32, { align: "center" });
  
  if (data.clientName) {
    doc.text(`Client : ${data.clientName}`, margin + contentWidth / 2, acceptBoxY + 39, { align: "center" });
  }
  if (data.clientEmail) {
    doc.setFontSize(8);
    doc.text(`(${data.clientEmail})`, margin + contentWidth / 2, acceptBoxY + 45, { align: "center" });
  }

  currentY = acceptBoxY + acceptBoxHeight + 15;

  // Legal disclaimer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  const disclaimer = `En passant cette commande, le Client reconnaît avoir lu, compris et accepté l'intégralité des présentes Modalités de service, incluant les Annexes B, C, D et E. Ces conditions font partie intégrante du contrat de services Nivra Telecom.`;
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
  for (const line of disclaimerLines) {
    doc.text(line, margin, currentY);
    currentY += 4;
  }

  currentY += 10;

  // Contact info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.navy);
  doc.text("Pour toute question :", margin, currentY);
  currentY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.dark);
  doc.text(`Courriel : ${COMPANY_CONTACT.supportEmailDisplay}`, margin, currentY);
  currentY += 4;
  doc.text(`Portail client : portal.nivra-telecom.ca`, margin, currentY);
  currentY += 4;
  doc.text(`Heures de support : ${COMPANY_CONTACT.supportHours}`, margin, currentY);

  // Add final footer
  addFooter();

  // Store total pages for later update
  totalPages = pageNumber;

  return doc;
}

/**
 * Generate and save the Terms PDF as a blob
 */
export function generateTermsModalitesPDFBlob(data: TermsModalitesData): Blob {
  const doc = generateTermsModalitesPDF(data);
  return doc.output("blob");
}

/**
 * Generate filename for the Terms PDF
 */
export function getTermsModalitesFilename(orderNumber: string): string {
  return `Modalites_Service_Nivra_${orderNumber}.pdf`;
}
