/**
 * Nivra Service Terms PDF Generator V3.0
 * 
 * Generates the full "Modalités de service" document.
 * This is a multi-page legal document attached to every order.
 * 
 * Content matches the approved Modalites-Service-Nivra document.
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA, PDF_THEME } from "./companyInfo";

const C = PDF_THEME;

const TERMS_VERSION = "v2026-02-05";

// ============================================================================
// PAGE COMPONENTS
// ============================================================================

function drawTermsHeader(doc: jsPDF, subtitle: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pw, 24, "F");
  doc.setFillColor(...C.teal);
  doc.rect(0, 24, pw, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text("Nivra Telecom", 15, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.teal);
  doc.text(`Modalités de service - ${TERMS_VERSION}`, 15, 17);

  if (subtitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(180, 190, 210);
    doc.text(subtitle, pw - 15, 14, { align: "right" });
  }
}

function drawTermsFooter(doc: jsPDF, pageNum: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...C.border);
  doc.line(15, ph - 12, pw - 15, ph - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...C.textMuted);
  doc.text(`© ${new Date().getFullYear()} ${NIVRA.legalName}. Tous droits réservés.`, 15, ph - 7);
  doc.text(`Page ${pageNum}`, pw - 15, ph - 7, { align: "right" });
}

// ============================================================================
// CONTENT SECTIONS
// ============================================================================

interface Section {
  title: string;
  content: string[];
}

const SECTIONS: Section[] = [
  {
    title: "1. PRÉAMBULE, ACCEPTATION ET CHAMP D'APPLICATION",
    content: [
      "Les présentes Modalités de service (les « Modalités ») constituent une entente légale contraignante entre Nivra Communications Inc., opérant sous le nom Nivra Telecom (« Nivra », « nous », « notre »), et toute personne physique ou morale (« Client », « vous », « votre ») qui crée un compte client, commande un service, effectue un paiement ou utilise un service fourni par Nivra.",
      "En accédant aux Services, en confirmant une commande, en effectuant un paiement ou en utilisant un Service, le Client reconnaît avoir lu, compris et accepté les présentes Modalités, sans réserve.",
      "Les présentes Modalités s'appliquent exclusivement aux Services souscrits par le Client et doivent être lues conjointement avec le contrat de services, le résumé des renseignements essentiels, les annexes applicables et les politiques publiées sur le portail client.",
    ],
  },
  {
    title: "2. DÉFINITIONS ET INTERPRÉTATION",
    content: [
      "Services : ensemble des services de télécommunications offerts par Nivra, incluant notamment Internet, Mobile, Télévision et services connexes.",
      "Client : toute personne ou entité ayant souscrit un ou plusieurs Services.",
      "Compte : dossier client créé dans les systèmes de Nivra.",
      "Cycle de facturation (Bill Cycle) : période contractuelle de trente (30) jours.",
      "Date de cycle : jour du mois correspondant à la création du Compte.",
      "Facture mensuelle : document généré à titre informatif indiquant les Services actifs et les montants applicables pour le cycle à venir.",
      "Paiement confirmé : paiement reçu, validé et accepté par Nivra.",
      "Non-renouvellement : absence de paiement confirmé à la date de cycle.",
      "Suspension : interruption temporaire d'un Service à la suite d'un non-renouvellement.",
      "Annulation : désactivation définitive d'un Service après expiration de la période de récupération.",
    ],
  },
  {
    title: "3. NATURE DES SERVICES ET ABSENCE DE VÉRIFICATION DE CRÉDIT",
    content: [
      "Nivra est un fournisseur de services de télécommunications prépayés. Aucune vérification de crédit externe n'est effectuée lors de la souscription.",
      "Les Services sont fournis sur la base des informations fournies par le Client, de la disponibilité technique et des règles internes de prévention de fraude et de conformité.",
      "Nivra se réserve le droit de refuser, suspendre ou résilier un Service en cas d'information inexacte, incomplète ou trompeuse.",
    ],
  },
  {
    title: "4. MODÈLE DE FACTURATION — PRÉPAYÉ À RENOUVELLEMENT MENSUEL",
    content: [
      "Tous les Services Nivra sont fournis selon un modèle prépayé, avec une présentation de type postpayée.",
      "Une facture mensuelle est générée et rendue disponible avant chaque cycle afin de résumer les Services actifs, afficher les montants applicables et permettre le renouvellement du cycle.",
      "IMPORTANT : La facture mensuelle ne constitue pas une dette. Aucun Service n'est fourni sans paiement confirmé pour le cycle correspondant.",
      "Taxes applicables : TPS (5%) et TVQ (9,975%) sont calculées et affichées conformément aux lois fiscales du Québec.",
    ],
  },
  {
    title: "5. PAIEMENT, MÉTHODES ACCEPTÉES ET CONFIRMATION",
    content: [
      "Méthodes acceptées : Virement Interac (e-Transfer), PayPal, Carte de crédit.",
      "Le paiement doit être confirmé AVANT la date de cycle (J0) pour renouveler le Service.",
      "La confirmation est effectuée automatiquement pour PayPal et carte de crédit. Pour les virements Interac, la confirmation est effectuée manuellement par l'équipe de facturation dans un délai de 24 heures ouvrables.",
      "Aucun paiement en espèces, chèque ou mandat-poste n'est accepté.",
    ],
  },
  {
    title: "6. NON-RENOUVELLEMENT ET CONSÉQUENCES",
    content: [
      "En cas de non-paiement confirmé à la date de cycle (J0), le Service n'est pas renouvelé automatiquement.",
      "Aucun intérêt, aucune pénalité et aucuns frais de réactivation ne s'appliquent pour un non-renouvellement normal.",
      "Le Client conserve son numéro de téléphone et ses données pendant une période de grâce de 90 jours suivant le non-renouvellement.",
      "Après 90 jours sans renouvellement, le numéro de téléphone peut devenir irrécupérable et un nouveau numéro sera requis pour réactiver le Service.",
      "EXCEPTION — Litiges et rétrofacturations : En cas de litige bancaire, rétrofacturation (chargeback) ou fraude, des intérêts de 5% par mois et des frais de réactivation de 15$ s'appliquent.",
    ],
  },
  {
    title: "7. ÉQUIPEMENT",
    content: [
      "L'équipement fourni par Nivra (routeur, terminal TV 4K, etc.) demeure la propriété de Nivra Communications Inc.",
      "Le Client est responsable de l'utilisation et de l'entretien de l'équipement pendant toute la durée du Service.",
      "À la résiliation, l'équipement doit être retourné en bon état dans les 30 jours. Des frais s'appliquent pour équipement non retourné ou endommagé.",
      "Garantie fabricant : 12 mois à compter de la date d'activation. Perte, vol et dommages causés par le Client sont exclus de la garantie sauf approbation interne.",
    ],
  },
  {
    title: "8. RÉSILIATION ET PORTABILITÉ",
    content: [
      "Le Client peut résilier le Service en tout temps avec un préavis de 30 jours, sans frais de résiliation.",
      "La portabilité du numéro est disponible conformément aux directives du CRTC.",
      "Nivra se réserve le droit de résilier un Service immédiatement en cas d'utilisation abusive, frauduleuse ou non conforme aux présentes Modalités.",
    ],
  },
  {
    title: "9. PROTECTION DES RENSEIGNEMENTS PERSONNELS",
    content: [
      "Nivra protège les renseignements personnels conformément à la Loi 25 du Québec et à la LPRPDE fédérale.",
      "Les données personnelles sont collectées uniquement pour la fourniture des Services, la facturation, le support technique et la prévention de la fraude.",
      "Aucune donnée personnelle n'est vendue à des tiers.",
      "Le Client peut demander l'accès, la rectification ou la suppression de ses données en contactant support@nivra-telecom.ca.",
    ],
  },
  {
    title: "10. LIMITATION DE RESPONSABILITÉ",
    content: [
      "Nivra n'est pas responsable des dommages indirects, consécutifs, spéciaux ou punitifs résultant de l'utilisation ou de l'impossibilité d'utiliser les Services.",
      "La responsabilité totale de Nivra est limitée aux frais payés par le Client au cours des trois (3) derniers mois.",
      "Nivra s'engage à fournir une disponibilité de service de 99,5% sur une base mensuelle. En cas de panne majeure (> 24h consécutives), un crédit proportionnel sera appliqué automatiquement.",
    ],
  },
  {
    title: "11. RÉSOLUTION DES DIFFÉRENDS",
    content: [
      "Pour toute plainte : contacter support@nivra-telecom.ca. Délai de réponse : 48 heures ouvrables.",
      "Si la plainte n'est pas résolue : escalade au gestionnaire de service de Nivra.",
      "En dernier recours : Commission des plaintes relatives aux services de télécom-télévision (CPRST) ou le Conseil de la radiodiffusion et des télécommunications canadiennes (CRTC).",
    ],
  },
  {
    title: "12. DISPOSITIONS GÉNÉRALES",
    content: [
      "Les présentes Modalités sont régies par les lois de la province de Québec et les lois fédérales du Canada applicables.",
      "Toute modification aux Modalités sera communiquée par courriel ou via le portail client avec un préavis de 30 jours.",
      "Si une disposition des présentes Modalités est jugée invalide, les autres dispositions demeurent en vigueur.",
      "Les présentes Modalités constituent l'intégralité de l'accord entre le Client et Nivra concernant les Services.",
    ],
  },
];

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateServiceTermsPDF(): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;
    const cw = pw - m * 2;
    const maxY = ph - 18;
    let pageNum = 1;

    // === COVER PAGE ===
    doc.setFillColor(...C.white);
    doc.rect(0, 0, pw, ph, "F");
    drawTermsHeader(doc, "");

    let y = 50;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...C.navy);
    doc.text("MODALITÉS DE SERVICE", pw / 2, y, { align: "center" });
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...C.textMuted);
    doc.text("NIVRA TELECOM", pw / 2, y, { align: "center" });
    y += 12;

    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text("Version intégrale étendue — Prépayé à renouvellement mensuel (expérience postpayée)", pw / 2, y, { align: "center" });
    y += 8;
    doc.text(`Dernière mise à jour : ${TERMS_VERSION.replace("v", "")}`, pw / 2, y, { align: "center" });
    y += 15;

    doc.setFontSize(9);
    doc.text("Ce document présente les modalités applicables aux services de télécommunications", pw / 2, y, { align: "center" });
    y += 5;
    doc.text("offerts par Nivra Telecom, incluant les annexes applicables.", pw / 2, y, { align: "center" });

    // Table of contents
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.navy);
    doc.text("Table des matières", m, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.text);
    SECTIONS.forEach((section, i) => {
      doc.text(`${section.title}`, m + 5, y);
      y += 5;
    });

    drawTermsFooter(doc, pageNum);

    // === CONTENT PAGES ===
    SECTIONS.forEach(section => {
      // Check if we need a new page
      const estimatedHeight = section.content.length * 15 + 15;
      if (y + 20 > maxY || (pageNum === 1)) {
        doc.addPage();
        pageNum++;
        doc.setFillColor(...C.white);
        doc.rect(0, 0, pw, ph, "F");
        drawTermsHeader(doc, section.title.split(".")[0]);
        y = 32;
      }

      // Section title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...C.navy);
      doc.text(section.title, m, y);
      y += 6;

      // Content paragraphs
      section.content.forEach(paragraph => {
        if (y > maxY - 10) {
          drawTermsFooter(doc, pageNum);
          doc.addPage();
          pageNum++;
          doc.setFillColor(...C.white);
          doc.rect(0, 0, pw, ph, "F");
          drawTermsHeader(doc, "");
          y = 32;
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);

        // Handle bullet points
        const isBullet = paragraph.startsWith("•") || paragraph.startsWith("-") || /^[A-Z]+\s:/.test(paragraph);
        const indent = isBullet ? 5 : 0;

        const lines = doc.splitTextToSize(paragraph, cw - indent);
        doc.text(lines, m + indent, y);
        y += lines.length * 3.8 + 3;
      });

      y += 5;
      drawTermsFooter(doc, pageNum);
    });

    const blob = doc.output("blob");
    const filename = `Modalites-Service-Nivra-${TERMS_VERSION}.pdf`;

    return { success: true, blob, filename };
  } catch (error) {
    console.error("[ServiceTermsPDF] Generation error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

export const CURRENT_TERMS_VERSION = TERMS_VERSION;

export default generateServiceTermsPDF;
