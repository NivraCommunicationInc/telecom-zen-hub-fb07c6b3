/**
 * Nivra Document Engine - Complete Legal Annexes (French)
 * ANNEXES A → E - Full legal text for prepaid contracts
 * 
 * IMPORTANT: Do not modify this text without legal review.
 * Each annexe is rendered in full, with proper page breaks.
 */

import { COMPANY_CONTACT } from "@/config/company";

export interface AnnexeSection {
  id: string;
  title: string;
  sections: Array<{
    number?: string;
    title: string;
    paragraphs: string[];
  }>;
}

// ============= ANNEXE A — TERMES ET CONDITIONS =============

export const ANNEXE_A: AnnexeSection = {
  id: "A",
  title: "ANNEXE A — TERMES ET CONDITIONS (NIVRA TELECOM)",
  sections: [
    {
      number: "1",
      title: "Parties, portée et définitions",
      paragraphs: [
        `Le présent contrat est conclu entre Nivra Communications Inc. (« Nivra ») et le client identifié au contrat (« Client »).`,
        `Coordonnées support : ${COMPANY_CONTACT.supportEmailDisplay}`,
      ],
    },
    {
      title: "Définitions",
      paragraphs: [
        `Services : téléphonie, Internet, télévision, sécurité et services connexes fournis par Nivra.`,
        `Date d'activation : date d'activation du service et/ou de remise de l'équipement.`,
        `Cycle de facturation (Bill Cycle) : le jour du mois correspondant à la date de création du compte Client. Exemple : compte créé le 4 → facture émise le 4 de chaque mois. Si le mois ne comporte pas ce jour (29–31), la facturation est effectuée le dernier jour du mois.`,
        `Échéance : date limite de paiement indiquée sur la facture/portail.`,
        `Équipement : matériel fourni par Nivra (ex. routeur, terminal 4K), vendu au Client à l'activation.`,
        `Le contrat prend effet à la Date d'activation et se renouvelle par cycle, sauf résiliation conformément aux présentes.`,
      ],
    },
    {
      number: "2",
      title: "Services, limites et disponibilité",
      paragraphs: [
        `Les Services fournis sont ceux décrits au contrat, à la commande et/ou à la facture.`,
        `Sauf mention contraire, ne sont pas inclus : travaux spécialisés sur le réseau interne du Client, câblage complexe, configuration avancée, réparations d'infrastructure appartenant au Client, ou toute prestation non décrite.`,
        `Disponibilité — best effort. Les Services sont fournis sur une base best effort. Des interruptions peuvent survenir (maintenance, contraintes techniques, fournisseurs tiers, sécurité réseau, force majeure). Les délais d'installation/activation sont estimés.`,
      ],
    },
    {
      number: "3",
      title: "Facturation prépayée, annulation, taxes, prix",
      paragraphs: [
        `Services prépayés. Les Services sont facturés à l'avance par cycle. Le renouvellement est effectué uniquement si le paiement est reçu et confirmé.`,
        `Annulation / absence de remboursement. Le Client peut annuler à tout moment. Le service demeure actif jusqu'à la fin de la période payée. Le mois (cycle) en cours payé n'est pas remboursable, en tout ou en partie, sauf disposition légale contraire ou erreur de facturation confirmée.`,
        `Taxes. Les montants sont sujets aux taxes applicables (TPS/TVQ), sauf indication contraire.`,
        `Ajustements de prix. Nivra peut modifier ses tarifs et modalités avec un préavis raisonnable transmis via le portail et/ou par courriel, selon les règles applicables.`,
        `Erreur de prix / "Prix à confirmer". En cas d'erreur technique d'affichage (ex. « Prix à confirmer »), le prix applicable est celui indiqué sur la confirmation de commande et/ou la facture. Nivra peut corriger une erreur manifeste et en aviser le Client; avant activation, le Client peut annuler si le prix corrigé ne lui convient pas.`,
      ],
    },
    {
      number: "4",
      title: "Retard, intérêt, suspension, réactivation",
      paragraphs: [
        `Intérêt de retard (factures impayées). À compter du 15e jour suivant la date d'échéance, un intérêt de cinq pour cent (5%) par mois s'applique sur tout solde impayé, jusqu'au paiement complet.`,
        `Suspension pour non-paiement. Les Services peuvent être suspendus après 15 jours suivant la date d'échéance. Une notification est transmise via portail et/ou courriel. Nivra n'est pas responsable des impacts liés à la suspension (incluant Internet, téléphonie, télévision, systèmes de sécurité/alarme).`,
        `Frais de réactivation. Des frais de réactivation de 15 $ s'appliquent pour rétablir un service suspendu pour non-paiement. Le paiement intégral du solde dû est requis avant réactivation.`,
      ],
    },
    {
      number: "5",
      title: "Dépôt, préautorisation et \"crédit interne\"",
      paragraphs: [
        `Aucune vérification de crédit externe. Nivra n'effectue pas de vérification de crédit externe. Toutefois, Nivra utilise un système interne basé notamment sur l'historique de paiement du Client auprès de Nivra.`,
        `Dépôt. Aucun dépôt n'est généralement exigé pour un nouveau client. Pour un client existant, un dépôt et/ou une préautorisation peut être exigé(e) en cas d'historique de retards, factures impayées ou incidents de paiement. Le montant et les modalités sont communiqués au portail, à la commande ou à la facture.`,
      ],
    },
    {
      number: "6",
      title: "Équipement (usagé vendu), garantie et remplacement",
      paragraphs: [
        `Équipement vendu à l'activation. Les équipements fournis par Nivra peuvent être des équipements déjà utilisés et sont vendus au Client à l'activation (frais uniques).`,
        `Garantie 1 an. Garantie de un (1) an à compter de la date d'activation, couvrant uniquement les défauts du fabricant et problèmes techniques rendant l'équipement non fonctionnel dans un usage normal.`,
        `DOA. Fenêtre d'échange DOA : 14 jours suivant la remise/activation (preuve requise).`,
        `Exclusions. Dommages causés par le Client, perte, vol, dommages liquides, bris physique, usure normale, modifications non autorisées.`,
        `Frais de remplacement. Le Client paie les frais de livraison pour un remplacement. Si le Client demande une installation par technicien, des frais d'installation s'appliquent.`,
      ],
    },
    {
      number: "7",
      title: "Contestations, litiges et rétrofacturations",
      paragraphs: [
        `Contestation de facture (10 jours). Toute contestation doit être soumise dans un délai de dix (10) jours suivant l'émission (ou la mise à disposition au portail), avec description des montants contestés. Passé ce délai, la facture est réputée acceptée, sous réserve des droits prévus par la loi.`,
        `Chargebacks / litiges bancaires. En cas de contestation bancaire/rétrofacturation, Nivra peut suspendre le service, demander des preuves, et refuser la réactivation tant que la situation n'est pas régularisée.`,
      ],
    },
    {
      number: "8",
      title: "Paiements frauduleux, pénalités, recouvrement",
      paragraphs: [
        `Définition. Un « paiement frauduleux / paiement en litige confirmé » inclut tout paiement contesté, rétrofacturé, annulé, refusé, ou déclaré non autorisé par l'institution financière ou le processeur de paiement.`,
        `Frais fixes. Le Client sera facturé 100 $ par paiement frauduleux / paiement en litige confirmé (frais administratifs de traitement et d'enquête).`,
        `Intérêt majoré. Tout montant à rembourser à Nivra résultant d'un paiement frauduleux / paiement en litige confirmé porte intérêt au taux de vingt-neuf pour cent (29%) par mois, calculé quotidiennement au taux équivalent, à compter de la date où Nivra est débitée jusqu'au remboursement complet.`,
        `Paiement après décision bancaire. Une fois une décision rendue par l'institution financière confirmant le litige en défaveur du Client, le Client dispose de cinq (5) jours pour payer le montant dû, notamment par virement Interac selon les instructions de Nivra.`,
        `Recouvrement. À défaut de paiement dans ce délai, Nivra peut transférer le dossier au recouvrement. Des frais administratifs de suivi de 5 $ par jour peuvent alors s'appliquer jusqu'au paiement complet, dans la mesure permise par la loi.`,
        `Frais légaux. Si Nivra entreprend des démarches judiciaires, le Client accepte de rembourser les frais raisonnables encourus (honoraires et débours), dans la mesure permise par la loi.`,
      ],
    },
    {
      number: "9",
      title: "Identité, NIP, confidentialité et sécurité",
      paragraphs: [
        `Validation d'identité. Une pièce d'identité valide avec photo peut être exigée (permis de conduire, passeport, carte d'assurance maladie du Québec selon restrictions). Vérification possible via portail sécurisé.`,
        `NIP. Un NIP de sécurité à 4 chiffres est obligatoire. Le Client peut désigner un utilisateur autorisé. Le Client est responsable de la confidentialité du NIP.`,
        `Protection des renseignements personnels. Nivra protège les renseignements personnels conformément aux lois applicables (PIPEDA, Loi 25). Les données sont utilisées pour fournir/gérer les services, la facturation, le support et la prévention de fraude.`,
        `Avertissement. Nivra ne demandera jamais le NAS ni des informations complètes de carte de crédit par courriel/téléphone. Signalez toute tentative suspecte à ${COMPANY_CONTACT.supportEmailDisplay}.`,
      ],
    },
    {
      number: "10",
      title: "Plaintes, CRTC et recours externe",
      paragraphs: [
        `Plainte interne. Le Client doit d'abord contacter Nivra via ${COMPANY_CONTACT.supportEmailDisplay} et/ou le portail client.`,
        `Recours externe (CCTS). Si le problème n'est pas résolu avec Nivra, le Client peut déposer une plainte auprès de la Commission for Complaints for Telecom-television Services (CCTS), organisme indépendant de résolution de plaintes pour services télécom/Internet/TV au Canada.`,
        `Cadre de protection (CRTC). Selon le service, les codes de protection applicables incluent notamment le Wireless Code et l'Internet Code de la CRTC, utilisés dans le traitement des plaintes.`,
      ],
    },
    {
      number: "11",
      title: "Résiliation, responsabilité et clauses générales",
      paragraphs: [
        `Résiliation par Nivra. Nivra peut suspendre ou résilier en cas de non-paiement, fraude, fausse identité, abus, usage interdit, ou risque de sécurité. Les montants dus demeurent exigibles.`,
        `Limitation de responsabilité. Dans la mesure permise par la loi, Nivra n'est pas responsable des dommages indirects (perte de profits, données, interruption, etc.). La responsabilité totale de Nivra est limitée aux montants payés par le Client pour le cycle concerné.`,
        `Avis/notifications. Les avis peuvent être transmis par portail et/ou courriel.`,
        `Force majeure. Nivra n'est pas responsable des interruptions causées par des événements hors de son contrôle.`,
        `Divisibilité / intégralité / modifications. Si une clause est invalide, les autres demeurent en vigueur. Le contrat et ses annexes constituent l'intégralité de l'entente. Toute modification est communiquée par écrit (portail/courriel) selon les règles applicables.`,
        `Juridiction. Régi par les lois du Québec et les lois applicables du Canada; tribunaux compétents du Québec.`,
      ],
    },
  ],
};

// ============= ANNEXE B — CONDITIONS SPÉCIFIQUES PAR SERVICE =============

export const ANNEXE_B: AnnexeSection = {
  id: "B",
  title: "ANNEXE B — CONDITIONS SPÉCIFIQUES PAR SERVICE",
  sections: [
    {
      number: "B1",
      title: "Services mobiles (SIM, portabilité, roaming et surconsommation)",
      paragraphs: [
        `Portabilité (transfert de numéro). Le Client peut demander le transfert (portabilité) de son numéro vers Nivra. La portabilité dépend du fournisseur actuel, des informations fournies et des règles applicables. Le Client est responsable de fournir des informations exactes (nom, adresse, numéro, NIP/PIN de portage si requis). Toute erreur, refus ou délai causé par des informations inexactes peut entraîner un retard d'activation ou des frais additionnels indiqués à la commande. Nivra n'est pas responsable des pertes de service imputables au fournisseur cédant, à une demande de portage erronée ou à une résiliation prématurée par le Client avant complétion du transfert.`,
        `SIM / eSIM — activation, remplacement et pertes. Le Client est responsable de la protection de sa carte SIM/eSIM. Des frais peuvent s'appliquer pour : activation, remplacement, changement de SIM, SIM perdue/volée/brisée, ou réémission, tels qu'indiqués au résumé du contrat, à la commande ou à la facture. En cas de perte/vol, le Client doit aviser Nivra immédiatement afin de bloquer la ligne, et demeure responsable des usages effectués avant le blocage, sous réserve des droits prévus par la loi.`,
        `Roaming, hors-forfait et surconsommation. Les frais de roaming, hors-forfait, surconsommation ou services à valeur ajoutée (ex. international, numéros spéciaux, données excédentaires) sont facturés selon le plan choisi et/ou les tarifs applicables au moment de l'utilisation, tels qu'affichés au portail ou transmis par Nivra. En cas de volumes inhabituels ou risque de fraude, Nivra peut appliquer des mesures de protection (blocage temporaire, suspension, vérification d'identité).`,
      ],
    },
    {
      number: "B2",
      title: "Services Internet (vitesse, Wi-Fi, réseau interne, usage raisonnable)",
      paragraphs: [
        `Vitesse "jusqu'à" et facteurs de performance. Les vitesses annoncées sont des vitesses maximales théoriques "jusqu'à". La vitesse réelle peut varier selon : congestion réseau, équipements, distance, qualité du câblage, interférences Wi-Fi, bâtiment, appareils connectés, et configuration du réseau interne. Sauf indication expresse au résumé du contrat (SLA/garantie), le service est fourni en best effort.`,
        `Réseau interne du Client. Le Client est responsable de son réseau interne (routeur personnel, Wi-Fi, câbles, prises, switch, appareils). Nivra n'est pas responsable des limitations de performance dues à l'équipement du Client, à la configuration interne, à des interférences ou à des installations non conformes.`,
        `Usage raisonnable ("fair use"). Si un plan illimité est offert, il demeure soumis à une politique d'usage raisonnable visant à prévenir l'abus, la fraude, l'atteinte à la sécurité du réseau ou la revente non autorisée. En cas d'usage abusif, Nivra peut imposer des mesures de gestion (réduction temporaire, blocage, suspension, vérification).`,
      ],
    },
    {
      number: "B3",
      title: "Services Télévision (chaînes, sélections, modifications et tickets)",
      paragraphs: [
        `Chaînes de base obligatoires. Tous les plans TV incluent automatiquement 25 ou 26 chaînes de base (gratuites et obligatoires) indiquées au moment de la commande et/ou au portail client.`,
        `Chaînes "Free-Choice" selon le plan. Selon le plan, le Client peut sélectionner un nombre déterminé de chaînes "Free-Choice" (gratuites). Les sélections sont consignées au résumé/commande/portail.`,
        `Chaînes Premium et payantes. Les chaînes Premium/payantes sont facturées en supplément, selon les tarifs affichés (ex. 10 $ à 18 $/mois par chaîne ou prix groupé si bundle) au moment de la commande.`,
        `Commandes créées par l'admin. Si la commande est placée par un administrateur, Nivra peut assigner des chaînes "Free-Choice" de façon aléatoire à des fins d'activation initiale. Dans ce cas, le Client peut demander une modification après l'installation/activation, selon les règles du plan.`,
        `Modifications et rôles (admin vs client). Les modifications de chaînes peuvent être restreintes selon l'origine de la commande (admin vs client) et le statut d'installation. Les règles exactes sont celles indiquées au portail et au résumé du contrat.`,
        `Ticket interne après confirmation. Lorsque des sélections/modifications doivent être confirmées par Nivra, un ticket interne est créé avec un ETA de 2 heures à 24 heures et les statuts : Open → In Progress → Completed. Le Client reconnaît que l'activation/modification peut dépendre de systèmes tiers et de fenêtres techniques.`,
      ],
    },
    {
      number: "B4",
      title: "Services de Sécurité (non-urgence, dépendances, tests et fausses alarmes)",
      paragraphs: [
        `Non-urgence. Les services de sécurité (équipements, capteurs, surveillance, etc.) ne remplacent pas les services d'urgence. En cas d'urgence, le Client doit contacter les autorités compétentes (911).`,
        `Dépendances (Internet/électricité). Les services de sécurité peuvent dépendre de l'alimentation électrique, d'Internet, du réseau cellulaire et d'autres facteurs externes. Nivra n'est pas responsable des interruptions causées par une panne d'électricité, une panne Internet, un défaut de réseau ou un problème du réseau interne du Client.`,
        `Installation, tests et fausses alarmes. Le Client s'engage à permettre les tests raisonnables après installation. Toute fausse alarme, déplacement additionnel, réinstallation ou intervention non couverte peut entraîner des frais tels qu'indiqués au résumé du contrat ou à la facture.`,
      ],
    },
  ],
};

// ============= ANNEXE C — POLITIQUE D'INSTALLATION ET RENDEZ-VOUS =============

export const ANNEXE_C: AnnexeSection = {
  id: "C",
  title: "ANNEXE C — POLITIQUE D'INSTALLATION ET RENDEZ-VOUS (TERRAIN)",
  sections: [
    {
      title: "Installation standard vs complexe",
      paragraphs: [
        `Une installation "standard" couvre les opérations normales prévues au plan (connexion de base, activation, vérifications usuelles). Une installation "complexe" peut inclure, sans limitation : câblage additionnel, perçage, traversée de murs/planchers, configuration avancée, déplacement de prises, accès restreint, ou toute situation exigeant du temps/équipement additionnel. Les frais applicables sont ceux indiqués au résumé du contrat, à la commande ou à la facture.`,
      ],
    },
    {
      title: "Prérequis et accès",
      paragraphs: [
        `Le Client doit assurer : accès au logement/local, accès au local technique/panneau, prise électrique fonctionnelle, présence d'une personne autorisée, et autorisation du propriétaire/condo lorsque requis. Les retards/échecs d'installation causés par l'absence de prérequis peuvent entraîner des frais de déplacement et une replanification.`,
      ],
    },
    {
      title: "Rendez-vous, retard et absence (no-show)",
      paragraphs: [
        `Le Client doit être disponible dans la fenêtre prévue. En cas d'absence, d'accès impossible, d'annulation tardive ou de retard important, Nivra peut facturer des frais de déplacement/no-show tels qu'indiqués au résumé du contrat ou à la facture, et reprogrammer l'intervention.`,
      ],
    },
    {
      title: "Installation impossible",
      paragraphs: [
        `Si l'installation est impossible en raison de contraintes techniques, d'accès, d'infrastructure ou d'autorisation, Nivra peut clôturer l'intervention et facturer les frais déjà engagés (déplacement, diagnostic, etc.) selon les montants indiqués au résumé/commande/facture.`,
      ],
    },
  ],
};

// ============= ANNEXE D — MODALITÉS DE PAIEMENT =============

export const ANNEXE_D: AnnexeSection = {
  id: "D",
  title: "ANNEXE D — MODALITÉS DE PAIEMENT (INCLUANT E-TRANSFER)",
  sections: [
    {
      number: "D1",
      title: "Modes de paiement",
      paragraphs: [
        `Les modes de paiement acceptés sont ceux indiqués au portail et/ou au résumé du contrat (carte, virement Interac e-Transfer, etc.). Nivra peut refuser un mode de paiement en cas de risque de fraude ou non-conformité.`,
      ],
    },
    {
      number: "D2",
      title: "e-Transfer — règles de traitement et activation",
      paragraphs: [
        `Instructions. Le Client doit envoyer le virement e-Transfer selon les instructions communiquées par Nivra (nom du bénéficiaire, question/réponse si applicable, montant exact, référence/numéro de facture).`,
        `Statuts e-Transfer (interne). Les paiements e-Transfer peuvent être suivis avec les statuts : Pending, In verification, Complete, Declined, Fraud. La mise à jour des statuts est gérée par Nivra.`,
        `Vérification et activation. Sauf indication contraire au résumé du contrat, l'activation/renouvellement du service se fait après réception et vérification du paiement. Si le Client envoie un mauvais montant, une mauvaise référence, ou une mauvaise réponse, le paiement peut être retardé, refusé ou retourné, et des frais administratifs peuvent s'appliquer.`,
        `Paiement retourné/refusé. Tout paiement retourné, refusé ou annulé peut entraîner une suspension de service et/ou des frais additionnels selon les présents Termes & Conditions et les montants indiqués à la facture.`,
      ],
    },
  ],
};

// ============= ANNEXE E — SUPPORT, TICKETS, SLA =============

export const ANNEXE_E: AnnexeSection = {
  id: "E",
  title: "ANNEXE E — SUPPORT, TICKETS, SLA (OPTIONNEL B2B) ET CLAUSES AVANCÉES",
  sections: [
    {
      number: "E1",
      title: "Support et tickets (portail)",
      paragraphs: [
        `Canaux. Le Client accepte que les communications (avis, factures, notifications, tickets) puissent être transmises via le portail client et/ou par courriel à l'adresse inscrite au dossier.`,
        `Délais de réponse cibles (sans garantie). Nivra vise des délais de réponse raisonnables selon la charge et la priorité du dossier. Ces délais sont des cibles et non une garantie, sauf SLA indiqué au résumé du contrat.`,
        `Obligations du Client. Le Client doit fournir des informations exactes, permettre l'accès lorsque requis, et collaborer au diagnostic (tests, photos, accès au modem/routeur). Les délais peuvent être prolongés si le Client ne répond pas ou ne fournit pas les informations nécessaires.`,
        `Fermeture de ticket. Un ticket peut être fermé si le Client ne répond pas ou ne fournit pas les informations requises après un délai raisonnable (ex. 7 jours), et pourra être rouvert sur demande.`,
      ],
    },
    {
      number: "E2",
      title: "SLA entreprise (uniquement si indiqué au Résumé du contrat)",
      paragraphs: [
        `Si un plan "Entreprise" avec SLA est souscrit, les paramètres (heures de support, priorités P1/P2/P3, temps de réponse/rétablissement, crédits de service) sont définis au Résumé du contrat ou à une annexe SLA dédiée. À défaut, le service demeure en best effort.`,
      ],
    },
    {
      number: "E3",
      title: "Avis électroniques, non-renonciation, preuves, enregistrements",
      paragraphs: [
        `Avis électroniques. Les avis transmis via le portail et/ou par courriel sont réputés valides et reçus selon la date d'envoi/affichage, sous réserve des règles applicables.`,
        `Non-renonciation. Le fait pour Nivra de ne pas appliquer une clause à un moment donné ne constitue pas une renonciation à l'appliquer ultérieurement.`,
        `Preuves techniques. Le Client accepte que les journaux techniques (logs), confirmations d'activation, preuves de livraison, statuts de paiement et tickets puissent servir d'éléments de preuve en cas de contestation, dans la mesure permise par la loi.`,
        `Enregistrements (si applicable). Si Nivra enregistre certains appels pour qualité, conformité ou preuve, un avis sera donné au moment de l'appel lorsque requis.`,
      ],
    },
  ],
};

// ============= EXPORT ALL ANNEXES =============

export const ALL_ANNEXES: AnnexeSection[] = [
  ANNEXE_A,
  ANNEXE_B,
  ANNEXE_C,
  ANNEXE_D,
  ANNEXE_E,
];

// Export annexe titles for Page 1 summary
export const ANNEXE_TITLES = [
  { id: "A", title: "Annexe A — Termes et conditions (Nivra Telecom)" },
  { id: "B", title: "Annexe B — Conditions spécifiques par service" },
  { id: "C", title: "Annexe C — Politique d'installation et rendez-vous" },
  { id: "D", title: "Annexe D — Modalités de paiement (incluant e-Transfer)" },
  { id: "E", title: "Annexe E — Support, tickets, SLA (optionnel B2B) et clauses avancées" },
];
