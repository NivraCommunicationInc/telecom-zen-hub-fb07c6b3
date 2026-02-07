/**
 * Nivra Contract Annexes - Terms & Conditions
 * Moved from pdfEngine/ to pdf/ for unified engine
 */

export interface AnnexeSection {
  title: string;
  sections: {
    number?: string;
    title: string;
    paragraphs: string[];
  }[];
}

// Annexe A: Terms & Conditions
export const ANNEXE_A: AnnexeSection = {
  title: "ANNEXE A — CONDITIONS GÉNÉRALES DE SERVICE",
  sections: [
    {
      number: "1",
      title: "Définitions",
      paragraphs: [
        "« Abonné » ou « Client » désigne toute personne physique ou morale ayant souscrit aux services de télécommunications offerts par Nivra Telecom.",
        "« Service » désigne tout service de télécommunications fourni par Nivra Telecom, incluant mais non limité à: Internet résidentiel, télévision IP, téléphonie mobile, services de sécurité, et services de streaming.",
        "« Équipement » désigne tout matériel fourni, loué ou vendu par Nivra Telecom au Client pour l'utilisation des Services.",
      ],
    },
    {
      number: "2",
      title: "Acceptation des conditions",
      paragraphs: [
        "En souscrivant aux Services de Nivra Telecom, le Client confirme avoir lu, compris et accepté les présentes conditions générales.",
        "Nivra Telecom se réserve le droit de modifier les présentes conditions avec un préavis de 30 jours.",
      ],
    },
    {
      number: "3",
      title: "Facturation et paiement",
      paragraphs: [
        "Les Services sont offerts sur une base prépayée uniquement. Le paiement doit être effectué avant l'activation ou le renouvellement des Services.",
        "Les méthodes de paiement acceptées sont: Virement Interac et PayPal.",
        "Aucun crédit n'est accordé. Le service est activé uniquement après confirmation du paiement.",
      ],
    },
  ],
};

// Annexe B: Service-Specific Conditions
export const ANNEXE_B: AnnexeSection = {
  title: "ANNEXE B — CONDITIONS SPÉCIFIQUES PAR SERVICE",
  sections: [
    {
      number: "1",
      title: "Internet Résidentiel",
      paragraphs: [
        "Les vitesses annoncées sont des vitesses maximales théoriques. Les performances réelles peuvent varier selon divers facteurs.",
        "L'installation d'un routeur Nivra est requise pour bénéficier du support technique complet.",
        "Le service TV IPTV nécessite un forfait Internet actif de Nivra Telecom.",
      ],
    },
    {
      number: "2",
      title: "Services Mobiles",
      paragraphs: [
        "Les forfaits mobiles sont prépayés et renouvelables tous les 30 jours.",
        "La carte SIM reste la propriété de Nivra Telecom et ne peut être utilisée avec d'autres fournisseurs.",
        "Le transfert de numéro (portabilité) est soumis à des délais de traitement de 3-5 jours ouvrables.",
      ],
    },
  ],
};

// Annexe C: Installation & Appointments
export const ANNEXE_C: AnnexeSection = {
  title: "ANNEXE C — INSTALLATION ET RENDEZ-VOUS",
  sections: [
    {
      number: "1",
      title: "Frais d'installation",
      paragraphs: [
        "Des frais d'installation standard s'appliquent pour les services nécessitant une visite technique.",
        "Le Client doit être présent ou avoir un représentant majeur sur place lors de l'installation.",
        "Les modifications d'horaire moins de 24 heures avant le rendez-vous peuvent entraîner des frais.",
      ],
    },
    {
      number: "2",
      title: "Équipements",
      paragraphs: [
        "Le Client est responsable de l'équipement fourni jusqu'à sa restitution.",
        "Tout équipement endommagé ou non retourné sera facturé au prix de remplacement.",
      ],
    },
  ],
};

// Annexe D: Payment Terms
export const ANNEXE_D: AnnexeSection = {
  title: "ANNEXE D — CONDITIONS DE PAIEMENT",
  sections: [
    {
      number: "1",
      title: "Mode de paiement",
      paragraphs: [
        "Paiement par virement Interac: envoyer à Paiement@nivra-telecom.ca",
        "Paiement par PayPal: disponible lors de la commande en ligne.",
        "Aucun paiement par carte de crédit ou débit direct n'est accepté.",
      ],
    },
    {
      number: "2",
      title: "Politique de non-renouvellement",
      paragraphs: [
        "En l'absence de paiement avant la date d'échéance, le service sera suspendu automatiquement.",
        "Aucuns frais de retard ne s'appliquent — le service est simplement suspendu.",
        "La réactivation nécessite le paiement complet de la facture de renouvellement.",
      ],
    },
  ],
};

// Annexe E: Support, SLA, Advanced Clauses
export const ANNEXE_E: AnnexeSection = {
  title: "ANNEXE E — SUPPORT ET ENGAGEMENTS DE SERVICE",
  sections: [
    {
      number: "1",
      title: "Support technique",
      paragraphs: [
        "Le support est disponible du lundi au vendredi, de 9h à 18h (heure de l'Est).",
        "Les demandes de support sont traitées via le portail client ou par courriel.",
        "Les temps de réponse varient selon la priorité du problème signalé.",
      ],
    },
    {
      number: "2",
      title: "Garantie et responsabilité",
      paragraphs: [
        "Nivra Telecom ne garantit pas une disponibilité de service de 100%.",
        "En cas d'interruption prolongée (plus de 48 heures), un crédit proportionnel peut être accordé.",
        "La responsabilité de Nivra Telecom est limitée au montant du service affecté.",
      ],
    },
  ],
};

export const ANNEXE_TITLES = {
  A: "Conditions Générales",
  B: "Conditions par Service",
  C: "Installation",
  D: "Paiement",
  E: "Support et SLA",
};
