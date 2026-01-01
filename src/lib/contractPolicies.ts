// Centralized policies that are used both on the website and in contracts
// Customer Service Agreement (CSA) - Licensed Telecommunications Services Provider — Province of Québec

export const BUSINESS_INFO = {
  name: "Nivra Communications",
  legalName: "Nivra Communications Inc.",
  address: "2352 Rue Monet, Laval, QC H7E 0E5",
  phone: "438-544-2233",
  email: "support@nivratelecom.com",
  paymentEmail: "Nivratelecom@gmail.com",
  website: "www.nivra.ca",
  neq: "À compléter", // Numéro d'entreprise du Québec
};

export const CONTRACT_TERMS = {
  version: "v1.0-QC-2026",
  lastUpdated: "2026-01-01",
  agreementType: "Customer Service Agreement (CSA)",
  
  // Status flow
  statusFlow: ["Pending", "Verification", "Hold/Approved", "Shipped", "Completed"],
  
  services: [
    "Internet",
    "TV Bundle",
    "Mobile Plan",
    "Security",
    "Streaming",
    "Accessories",
  ],
  
  // One-time fees (not plan-dependent)
  fees: {
    simPhysical: 30,
    esim: 25,
    router: 60,
    tvTerminal: 50, // per terminal, max 4
    uberExpress: 45,
    maxTerminals: 4,
  },
  
  paymentTerms: {
    dueDays: 30,
    lateInterestRate: 5, // 5% per month
    currency: "CAD",
    acceptedMethods: ["Visa", "Mastercard", "Amex", "E-Transfer"],
  },
  
  // E-Transfer details
  etransfer: {
    email: "Nivratelecom@gmail.com",
    securityQuestion: "What is my Nivra?",
    securityAnswer: "Telecom",
  },
  
  // Delivery SLA
  delivery: {
    standardDays: "24 to 78 business hours",
    uberExpress: "10 hours",
    eligibleCities: [
      "Montréal", "Laval", "Terrebonne", "Mascouche", 
      "Repentigny", "Longueuil", "Saint-Hubert", "Brossard"
    ],
    // Delivery-only categories
    deliveryOnlyServices: ["Mobile", "Streaming", "Accessories"],
    // Installation possible
    installationServices: ["Internet", "TV"],
  },
  
  // Number portability
  portability: {
    allowedAreaCodes: ["418", "514", "450", "579", "819", "367", "263", "354", "468"],
    tempPlaceholder: "514-111-1111",
  },
  
  cancellation: {
    noticeDays: 30,
    afterDeliveryCharge: "1 month of service",
    beforeDeliveryCharge: "Equipment + delivery fees apply",
    nonReturnFee: "Variable after Admin validation",
    returnDays: 14,
  },
  
  warranty: {
    duration: "1 year",
    coverage: "Manufacturing defects only",
    exclusions: ["Client-caused damage", "Loss or theft", "Liquid damage", "Physical impact"],
  },
  
  confidentiality: `
Le Prestataire s'engage à maintenir la confidentialité de toutes les informations 
fournies par le Client dans le cadre de ce contrat. Aucune information personnelle 
ou commerciale ne sera partagée avec des tiers sans le consentement explicite du Client,
sauf si requis par la loi.
  `.trim(),
  
  independence: `
Nivra Communications est un courtier 100% indépendant. Nous ne recevons aucune commission, 
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
  
  noCreditCheck: `
Aucune vérification de crédit n'est effectuée. Les services sont fournis sur la base 
d'une pré-autorisation de paiement ou d'un dépôt de garantie.
  `.trim(),
  
  fraudAbuse: `
Le Client s'engage à ne pas utiliser les services à des fins illégales, frauduleuses 
ou abusives. Tout comportement frauduleux entraînera la résiliation immédiate du 
contrat et pourrait faire l'objet de poursuites judiciaires.
  `.trim(),
  
  internalLogs: `
Le Prestataire conserve des journaux internes de toutes les modifications apportées 
aux comptes clients, incluant l'identité de l'acteur, la date, l'heure et la nature 
des changements. Ces journaux sont utilisés à des fins d'audit et de sécurité.
  `.trim(),
  
  noExternalRedirect: `
Le client ne sera jamais redirigé vers des sites tiers de transporteurs pour la 
livraison ou le traitement des paiements.
  `.trim(),
};

// Access permissions by role
export const ACCESS_PERMISSIONS = {
  admin: {
    role: "Admin",
    access: "Full visibility (payments, logs, invoices)",
  },
  employee: {
    role: "Employee",
    access: "Can see last 4 digits of CC, update status",
  },
  technician: {
    role: "Technician",
    access: "Can update order after installation",
  },
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

export const LATE_PAYMENT_POLICY_EN = `
LATE PAYMENT POLICY

1. Any payment not received within ${CONTRACT_TERMS.paymentTerms.dueDays} days following 
   the invoice date is considered late.

2. Interest of ${CONTRACT_TERMS.paymentTerms.lateInterestRate}% per month will be applied 
   to any unpaid balance, calculated from the due date.

3. In case of non-payment after 60 days, services may be suspended.

4. All collection fees incurred will be the responsibility of the Client.

5. The Client agrees to receive payment reminders by email and phone.
`.trim();

export const CLIENT_OBLIGATIONS = [
  "Fournir des informations exactes et complètes concernant ses besoins télécom",
  "Mettre à jour ses informations si nécessaire",
  "Respecter les délais de paiement convenus",
  "Collaborer de bonne foi avec le Prestataire",
  "Informer le Prestataire de tout changement significatif dans ses besoins",
];

export const CLIENT_OBLIGATIONS_EN = [
  "Provide accurate and complete information regarding telecom needs",
  "Update information as necessary",
  "Respect agreed payment deadlines",
  "Collaborate in good faith with the Provider",
  "Inform the Provider of any significant changes in needs",
];

export const PROVIDER_OBLIGATIONS = [
  "Fournir des conseils professionnels et impartiaux",
  "Maintenir la confidentialité des informations du Client",
  "Respecter les délais de service convenus",
  "Informer le Client de toute modification des conditions",
  "Agir dans le meilleur intérêt du Client",
];

export const PROVIDER_OBLIGATIONS_EN = [
  "Provide professional and impartial advice",
  "Maintain confidentiality of Client information",
  "Respect agreed service deadlines",
  "Inform the Client of any changes to terms",
  "Act in the best interest of the Client",
];

export const WARRANTY_POLICY = {
  fr: `
POLITIQUE DE GARANTIE

1. Tous les équipements Nivra (routeur, terminal 4K, SIM/eSIM) sont couverts par 
   une garantie manufacturier d'un (1) an à compter de la date d'activation.

2. La garantie couvre les défauts de fabrication et les pannes non causées par 
   une mauvaise utilisation.

3. Les dommages causés par le client (chutes, liquides, modifications non autorisées) 
   ne sont pas couverts par la garantie.

4. En cas de panne couverte, l'équipement sera remplacé sans frais.

5. L'équipement doit être retourné dans son emballage d'origine si disponible.
  `.trim(),
  en: `
WARRANTY POLICY

1. All Nivra equipment (router, 4K terminal, SIM/eSIM) is covered by a 
   manufacturer warranty of one (1) year from the activation date.

2. The warranty covers manufacturing defects and failures not caused by 
   misuse.

3. Damage caused by the client (drops, liquids, unauthorized modifications) 
   is not covered under warranty.

4. In case of a covered failure, equipment will be replaced at no charge.

5. Equipment must be returned in its original packaging if available.
  `.trim(),
};

export const CANCELLATION_POLICY = {
  fr: `
POLITIQUE D'ANNULATION

1. Le client peut annuler ses services en tout temps avant l'installation 
   sans frais ni pénalité.

2. Après l'installation, des frais équivalents à un (1) mois de service 
   seront facturés.

3. L'équipement Nivra doit être retourné dans les ${CONTRACT_TERMS.cancellation.returnDays} jours suivant 
   l'annulation. Les frais de retour sont à la charge du client.

4. Un préavis de ${CONTRACT_TERMS.cancellation.noticeDays} jours est requis 
   pour toute annulation après l'installation.

5. Les crédits en compte ne sont pas remboursables après annulation.
  `.trim(),
  en: `
CANCELLATION POLICY

1. The client may cancel services at any time before installation 
   without fees or penalties.

2. After installation, fees equivalent to one (1) month of service 
   will be charged.

3. Nivra equipment must be returned within ${CONTRACT_TERMS.cancellation.returnDays} days following 
   cancellation. Return costs are the client's responsibility.

4. A notice period of ${CONTRACT_TERMS.cancellation.noticeDays} days is required 
   for any cancellation after installation.

5. Account credits are non-refundable after cancellation.
  `.trim(),
};

export const NO_CREDIT_CHECK_POLICY = {
  fr: `
POLITIQUE SANS VÉRIFICATION DE CRÉDIT

Nivra Communications n'effectue aucune vérification de crédit. L'accès aux services 
est basé sur une pré-autorisation de carte de crédit ou un dépôt de garantie. 
Cette politique permet à tous les clients d'accéder à nos services sans 
impact sur leur dossier de crédit.
  `.trim(),
  en: `
NO CREDIT CHECK POLICY

Nivra Communications does not perform any credit checks. Access to services 
is based on a credit card pre-authorization or security deposit. 
This policy allows all clients to access our services without 
impacting their credit file.
  `.trim(),
};

// Contract ID generator
export const generateContractId = (sequenceNumber: number): string => {
  const year = new Date().getFullYear();
  const paddedNumber = String(sequenceNumber).padStart(5, "0");
  return `NVR-CSA-QC-${year}-${paddedNumber}`;
};

// Order Reference generator
export const generateOrderReference = (sequenceNumber: number): string => {
  const paddedNumber = String(sequenceNumber).padStart(5, "0");
  return `NVR-ORD-${paddedNumber}`;
};

// Payment Reference generator
export const generatePaymentReference = (sequenceNumber: number): string => {
  const year = new Date().getFullYear();
  const paddedNumber = String(sequenceNumber).padStart(5, "0");
  return `NVR-PAY-QC-${year}-${paddedNumber}`;
};
