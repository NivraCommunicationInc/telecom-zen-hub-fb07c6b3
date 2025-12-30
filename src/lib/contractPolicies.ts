// Centralized policies that are used both on the website and in contracts
// When these are updated, contracts will automatically use the latest version

export const BUSINESS_INFO = {
  name: "Nivra Télécom",
  legalName: "Nivra Télécom Inc.",
  address: "Montréal, QC, Canada",
  phone: "438-544-2233",
  email: "Nivratelecom@gmail.com",
  website: "www.nivra.ca",
  neq: "À compléter", // Numéro d'entreprise du Québec
};

export const CONTRACT_TERMS = {
  version: "2.0",
  lastUpdated: new Date().toISOString().split('T')[0],
  
  services: [
    "Analyse des besoins en télécommunications du client",
    "Comparaison des offres disponibles sur le marché",
    "Recommandations personnalisées et impartiales",
    "Accompagnement dans les démarches auprès des fournisseurs",
    "Suivi et optimisation des services télécom",
  ],
  
  paymentTerms: {
    dueDays: 30,
    lateInterestRate: 5, // 5% per month
    currency: "CAD",
    acceptedMethods: ["Carte de crédit", "Virement bancaire", "Chèque"],
  },
  
  cancellation: {
    noticeDays: 30,
    earlyTerminationFee: "Frais calculés au prorata des services restants",
  },
  
  confidentiality: `
Le Prestataire s'engage à maintenir la confidentialité de toutes les informations 
fournies par le Client dans le cadre de ce contrat. Aucune information personnelle 
ou commerciale ne sera partagée avec des tiers sans le consentement explicite du Client,
sauf si requis par la loi.
  `.trim(),
  
  independence: `
Nivra Télécom est un courtier 100% indépendant. Nous ne recevons aucune commission, 
rémunération ou compensation de la part des fournisseurs de télécommunications. 
Nos honoraires sont payés directement par nos clients, ce qui garantit notre 
impartialité totale dans nos recommandations.
  `.trim(),
  
  liability: `
Le Prestataire fournit des conseils et recommandations basés sur les informations 
disponibles au moment de la consultation. Le Prestataire ne garantit pas les résultats 
spécifiques et n'est pas responsable des décisions prises par les fournisseurs de 
télécommunications ou des changements dans leurs offres. La responsabilité du 
Prestataire est limitée au montant des honoraires payés par le Client.
  `.trim(),
  
  jurisdiction: `
Ce contrat est régi par les lois de la province de Québec et les lois fédérales 
du Canada applicables. Tout litige sera soumis à la compétence exclusive des 
tribunaux du Québec.
  `.trim(),
  
  dataProtection: `
Le Prestataire s'engage à protéger les données personnelles du Client conformément 
à la Loi sur la protection des renseignements personnels dans le secteur privé du Québec 
et à la Loi 25. Les données seront utilisées uniquement pour la prestation des services 
convenus et seront conservées de manière sécurisée.
  `.trim(),
};

export const LATE_PAYMENT_POLICY = `
POLITIQUE DE PAIEMENT EN RETARD

1. Tout paiement non reçu dans les ${CONTRACT_TERMS.paymentTerms.dueDays} jours suivant 
   la date de facturation est considéré en retard.

2. Un intérêt de ${CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois sera appliqué 
   sur tout solde impayé, calculé à partir de la date d'échéance.

3. En cas de non-paiement après 60 jours, les services pourront être suspendus.

4. Tous les frais de recouvrement engagés seront à la charge du Client.

5. Le Client accepte de recevoir des rappels de paiement par courriel et téléphone.
`.trim();

export const CLIENT_OBLIGATIONS = [
  "Fournir des informations exactes et complètes concernant ses besoins télécom",
  "Mettre à jour ses informations si nécessaire",
  "Respecter les délais de paiement convenus",
  "Collaborer de bonne foi avec le Prestataire",
  "Informer le Prestataire de tout changement significatif dans ses besoins",
];

export const PROVIDER_OBLIGATIONS = [
  "Fournir des conseils professionnels et impartiaux",
  "Maintenir la confidentialité des informations du Client",
  "Respecter les délais de service convenus",
  "Informer le Client de toute modification des conditions",
  "Agir dans le meilleur intérêt du Client",
];
