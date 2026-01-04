// Centralized policies that are used both on the website and in contracts
// Prepaid Telecommunications Service Agreement — Province of Québec
// CRTC-Compliant Consumer Protection Template

import { COMPANY_CONTACT, ETRANSFER_CONFIG } from "@/config/company";

export const BUSINESS_INFO = {
  name: COMPANY_CONTACT.companyName,
  legalName: COMPANY_CONTACT.legalName,
  brandName: COMPANY_CONTACT.companyName,
  address: COMPANY_CONTACT.fullAddress,
  phone: COMPANY_CONTACT.supportPhoneDisplay,
  email: COMPANY_CONTACT.supportEmailDisplay,
  paymentEmail: COMPANY_CONTACT.paymentEmail,
  website: COMPANY_CONTACT.website,
  serviceTerritory: COMPANY_CONTACT.serviceTerritory,
  fulfillmentCentre: "Grand Montréal, Québec",
  neq: "À compléter", // Numéro d'entreprise du Québec
};

export const CONTRACT_TERMS = {
  version: "v2.0-PREP-QC-2026",
  lastUpdated: "2026-01-02",
  agreementType: "Prepaid Telecommunications Service Agreement",
  
  // Status flow (Admin-editable)
  statusFlow: ["Pending", "Verification", "Hold/Approved", "Shipped", "Completed"],
  
  services: [
    "Internet",
    "TV + Internet Bundle",
    "Mobile Plan",
    "Streaming+",
    "Accessories / Extras",
  ],
  
  // One-time fees (not plan-dependent)
  fees: {
    activation: 25,
    delivery: 30,
    tvTerminal: 50, // per terminal
    router: 60,
    reactivation: 15, // after suspension
    maxTerminals: 4,
    // Legacy
    simPhysical: 25,
    esim: 25,
    uberExpress: 45,
  },
  
  // Late payment policy
  latePayment: {
    feePercent: 5, // 5% on overdue invoices
    suspensionDays: 30, // suspend after 30 days past due
    reactivationFee: 15,
  },
  
  paymentTerms: {
    dueDays: 30,
    lateInterestRate: 5, // 5% on overdue
    currency: "CAD",
    acceptedMethods: ["Credit Card (processed internally)", "Secure E-Transfer"],
  },
  
  // E-Transfer details
  etransfer: {
    email: ETRANSFER_CONFIG.email,
    securityQuestion: ETRANSFER_CONFIG.securityQuestion,
    securityAnswer: ETRANSFER_CONFIG.securityAnswer,
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
    deliveryOnlyServices: ["Mobile", "Streaming+", "Accessories"],
    // Installation possible
    installationServices: ["Internet", "TV"],
  },
  
  // Number portability
  portability: {
    allowedAreaCodes: ["418", "514", "450", "579", "819", "367", "263", "354", "438", "468"],
    tempPlaceholder: "514-111-1111",
  },
  
  cancellation: {
    noticeDays: 0, // Cancel anytime
    afterDeliveryCharge: "Service remains active until end of paid/prepaid period",
    beforeDeliveryCharge: "Equipment + delivery fees may apply",
    nonReturnFee: "Variable after Admin validation",
    returnDays: 14,
    equipmentRemoval: "Service channels, equipment, and bindings must be removed from the client profile automatically",
    recordPersistence: "All invoices, contracts, and order logs must persist and never disappear from Admin records",
  },
  
  warranty: {
    duration: "1 year",
    doaDays: 14, // DOA exchange window
    coverage: "Manufacturing defects only",
    exclusions: ["Client-caused damage", "Loss or theft", "Liquid damage", "Physical impact", "Unauthorized modifications"],
  },
  
  // Regulatory
  regulatory: {
    ccts: {
      name: "Commission for Complaints for Telecom-television Services",
      website: "https://www.ccts-cprst.ca",
      description: "Free, independent complaint resolution for telecom/TV",
    },
    crtc: {
      name: "Canadian Radio-television and Telecommunications Commission",
      website: "https://crtc.gc.ca",
      codes: ["Wireless Code", "Internet Code", "Television Service Provider Code"],
    },
  },
  
  confidentiality: `
Le Prestataire s'engage à maintenir la confidentialité de toutes les informations 
fournies par le Client dans le cadre de ce contrat. Aucune information personnelle 
ou commerciale ne sera partagée avec des tiers sans le consentement explicite du Client,
sauf si requis par la loi.
  `.trim(),
  
  independence: `
Nivra Communications Inc. is an independent telecommunications service provider with no carrier 
affiliation or commissions. We do not receive any compensation from telecom carriers. 
Our fees are paid directly by our clients, which guarantees our complete impartiality 
in our recommendations.
  `.trim(),
  
  liability: `
To the maximum extent permitted by law, Provider is not liable for indirect, incidental, 
or consequential damages. Provider's direct liability (if any) is limited to the amount 
of fees paid by the Client for the affected service in the 12 months preceding the claim.
  `.trim(),
  
  jurisdiction: `
This Agreement is governed by the laws of Québec and the applicable laws of Canada. 
Any dispute will be submitted to the exclusive jurisdiction of the courts of Québec.
  `.trim(),
  
  dataProtection: `
Provider collects and uses personal information to deliver services, verify identity, 
provision accounts, bill services, and provide support. Provider will handle personal 
information in accordance with applicable privacy laws, including federal privacy 
requirements (PIPEDA) and Québec private-sector privacy rules where applicable.
  `.trim(),
  
  noCreditCheck: `
Aucune vérification de crédit n'est effectuée. Les services sont fournis sur la base 
d'une pré-autorisation de paiement ou d'un dépôt de garantie.
  `.trim(),
  
  fraudAbuse: `
Client agrees not to use services for unlawful activity, fraud, abuse, or activities 
that materially degrade networks. Provider may suspend services for suspected fraud 
or security risks, consistent with applicable law and consumer codes.
  `.trim(),
  
  internalLogs: `
All changes or updates made by Admin, Employees, or Technicians are recorded in 
Admin-private logs, capturing: Actor Role | Name/Email | Timestamp | Field changed | 
Previous → New value | Reason. These logs are used for audit and security purposes.
  `.trim(),
  
  noExternalRedirect: `
No redirect to telecom carriers or third-party sites occurs at any stage. 
The client will never be redirected to external websites for delivery or payment processing.
  `.trim(),
  
  servicesBinding: `
This agreement binds exclusively to the services and equipment selected by the client 
at checkout or modified later through the browser-based client portal. No service plan 
or pricing is inserted manually outside of client-selected placeholders.
  `.trim(),
  
  prepaidBilling: `
Services are billed in advance per service cycle. The next cycle renews only if payment 
is successfully received. You may cancel at any time—if you cancel, service remains 
active until the end of the paid/prepaid period unless otherwise stated in writing.
  `.trim(),
  
  thirdPartyStreaming: `
Streaming+ add-ons may include Amazon Prime, Netflix, Spotify, DAZN, Disney+ or others. 
Provider may bill these as add-ons, but content availability, libraries, and service 
performance are controlled by third parties. Third-party terms may apply in addition 
to this Agreement.
  `.trim(),
  
  tvBundleRule: `
Client cannot subscribe to TV without an active Internet plan from Provider. 
If the Internet plan is cancelled, the TV plan will also be terminated.
  `.trim(),
};

// Access permissions by role
export const ACCESS_PERMISSIONS = {
  admin: {
    role: "Admin",
    access: "Full visibility (payments, logs, invoices)",
    cardAccess: "Full credit card numbers visible",
  },
  employee: {
    role: "Employee",
    access: "Can see last 4 digits of CC, update status",
    cardAccess: "Last 4 digits only",
  },
  technician: {
    role: "Technician",
    access: "Can update order after installation",
    cardAccess: "Last 4 digits only",
  },
};

export const PREPAID_BILLING_SUMMARY = {
  en: `
PREPAID BILLING AND CANCELLATION

• Prepaid: Services are billed in advance per service cycle.
• Cancel anytime: You may cancel at any time. No device financing under this Agreement.
• If you cancel, service remains active until the end of the paid/prepaid period 
  unless otherwise stated in writing.
  `.trim(),
  fr: `
FACTURATION PRÉPAYÉE ET ANNULATION

• Prépayé : Les services sont facturés à l'avance par cycle de service.
• Annulez à tout moment : Vous pouvez annuler à tout moment. Aucun financement d'appareil.
• Si vous annulez, le service reste actif jusqu'à la fin de la période payée/prépayée 
  sauf indication contraire par écrit.
  `.trim(),
};

export const LATE_PAYMENT_POLICY = {
  en: `
LATE PAYMENT & SUSPENSION RULES

• Invoice overdue → late fee may apply (${CONTRACT_TERMS.latePayment.feePercent}%).
• Service suspension after ${CONTRACT_TERMS.latePayment.suspensionDays} days past due.
• Reactivation fee $${CONTRACT_TERMS.latePayment.reactivationFee} applies to restore suspended services.
  `.trim(),
  fr: `
POLITIQUE DE PAIEMENT EN RETARD ET SUSPENSION

• Facture en retard → des frais de retard peuvent s'appliquer (${CONTRACT_TERMS.latePayment.feePercent}%).
• Suspension du service après ${CONTRACT_TERMS.latePayment.suspensionDays} jours de retard.
• Frais de réactivation de ${CONTRACT_TERMS.latePayment.reactivationFee}$ pour rétablir les services suspendus.
  `.trim(),
};

export const REGULATORY_NOTICES = {
  en: `
COMPLAINTS / REGULATORY

If you cannot resolve an issue with us, you may submit a complaint to the CCTS 
(Commission for Complaints for Telecom-television Services) at ${CONTRACT_TERMS.regulatory.ccts.website}.

CRTC also provides complaint/inquiry options at ${CONTRACT_TERMS.regulatory.crtc.website}.

This Agreement is intended to be consistent with applicable CRTC consumer protection codes 
(Wireless Code, Internet Code, Television Service Provider Code). If there is a conflict 
between this Agreement and an applicable code, the applicable code prevails to the extent 
of the conflict.
  `.trim(),
  fr: `
PLAINTES / RÉGLEMENTATION

Si vous ne pouvez pas résoudre un problème avec nous, vous pouvez soumettre une plainte 
au CPRST (Commission des plaintes relatives aux services de télécom-télévision) à ${CONTRACT_TERMS.regulatory.ccts.website}.

Le CRTC offre également des options de plainte/demande à ${CONTRACT_TERMS.regulatory.crtc.website}.

Cet accord vise à être conforme aux codes de protection des consommateurs du CRTC applicables 
(Code sur les services sans fil, Code sur les services Internet, Code des fournisseurs de 
services de télévision).
  `.trim(),
};

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

1. Tous les équipements Nivra (routeur, terminal 4K) sont couverts par 
   une garantie manufacturier d'un (1) an à compter de la date d'activation.

2. La garantie couvre les défauts de fabrication uniquement.

3. Fenêtre d'échange DOA : ${CONTRACT_TERMS.warranty.doaDays} jours à compter de la livraison 
   pour les équipements défectueux (excluant mauvaise utilisation, dommages accidentels, 
   dommages causés par les liquides, modifications non autorisées).

4. En cas de panne couverte, l'équipement sera remplacé sans frais.

5. Le service de garantie peut nécessiter une preuve d'achat et le numéro de série.
  `.trim(),
  en: `
WARRANTY POLICY (LIMITED WARRANTY)

1. All Nivra equipment (Nivra Born WiFi Router, Nivra 4K Smart Terminal) 
   is covered by a 1-year manufacturer warranty from the activation date.

2. Coverage: Manufacturing defects only.

3. DOA Exchange Window: ${CONTRACT_TERMS.warranty.doaDays} days from delivery for defective 
   equipment (excluding misuse, accidental damage, liquid damage, unauthorized modifications).

4. In case of a covered failure, equipment will be replaced at no charge.

5. Warranty service may require proof of purchase and device serial number.
  `.trim(),
};

export const CANCELLATION_POLICY = {
  fr: `
POLITIQUE D'ANNULATION (SANS FINANCEMENT)

1. Le client peut annuler à tout moment via le Portail Client, ticket ou demande écrite au support.

2. Les services étant prépayés, les annulations prennent généralement effet à la fin du cycle payé 
   sauf si la loi l'exige autrement ou si spécifié explicitement dans la confirmation de commande.

3. Aucun financement d'appareil : il n'y a pas de plan de remboursement de solde d'appareil 
   dans le cadre de cet accord.

4. L'équipement Nivra doit être retourné dans les ${CONTRACT_TERMS.cancellation.returnDays} jours 
   suivant l'annulation. Les frais de retour sont à la charge du client.
  `.trim(),
  en: `
CANCELLATION (NO FINANCING)

1. Client may cancel at any time through the Client Portal, ticket, or written request to support.

2. Because services are prepaid, cancellations generally take effect at the end of the paid cycle 
   unless otherwise required by law or explicitly stated in your order confirmation.

3. No device financing: there is no handset/device balance repayment plan under this Agreement.

4. Nivra equipment must be returned within ${CONTRACT_TERMS.cancellation.returnDays} days 
   following cancellation. Return costs are the client's responsibility.
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

export const PRIVACY_ACCESS_TERMS = {
  fullPayment: "Full payment data is private and stored internally.",
  adminCardAccess: "Only Admin sees full credit card numbers.",
  staffCardAccess: "Employees & technicians may see the last 4 digits placeholder only.",
  activityLogs: "All changes or updates made by Admin, Employees, or Technicians are recorded in Admin-private logs, capturing: Actor Role | Name/Email | Timestamp | Field changed | Previous → New value | Reason",
  noPublicData: "No client data is public or shared externally.",
  noRedirect: "No redirect to telecom carriers or third-party sites occurs at any stage.",
};

export const CLIENT_ACKNOWLEDGEMENT = [
  "All selected service plans and equipment bindings displayed in their portal match exactly what is offered publicly on the Nivra website.",
  "Payment for equipment or first service cycle is mandatory before order confirmation.",
  "Services are prepaid and may be cancelled at any time—no device financing.",
  "No external redirect occurs for payment or delivery.",
  "Nivra Communications Inc. is an independent service provider with no carrier affiliation or commissions.",
  "This agreement is governed by the laws of Québec and applicable laws of Canada.",
  "CCTS complaint resolution is available if issues cannot be resolved with Provider.",
];

export const FEES_SUMMARY = {
  activation: { amount: CONTRACT_TERMS.fees.activation, description: "Activation fee" },
  delivery: { amount: CONTRACT_TERMS.fees.delivery, description: "Delivery fee" },
  terminal: { amount: CONTRACT_TERMS.fees.tvTerminal, description: "Nivra 4K Smart Terminal (purchase)" },
  router: { amount: CONTRACT_TERMS.fees.router, description: "Nivra Born WiFi Router (purchase)" },
  reactivation: { amount: CONTRACT_TERMS.fees.reactivation, description: "Reactivation fee (after suspension)" },
  latePayment: { percent: CONTRACT_TERMS.latePayment.feePercent, description: "Late payment fee on overdue invoices" },
};

// Contract ID generator
export const generateContractId = (sequenceNumber: number): string => {
  const year = new Date().getFullYear();
  const paddedNumber = String(sequenceNumber).padStart(5, "0");
  return `NVR-PREP-QC-${year}-${paddedNumber}`;
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
