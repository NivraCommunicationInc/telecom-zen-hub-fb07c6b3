// Centralized policies that are used both on the website and in contracts
// Prepaid Telecommunications Service Agreement — Province of Québec
// CRTC-Compliant Consumer Protection Template

import { COMPANY_CONTACT, ETRANSFER_CONFIG } from "@/config/company";

export const BUSINESS_INFO = {
  name: COMPANY_CONTACT.companyName,
  legalName: COMPANY_CONTACT.legalName,
  brandName: COMPANY_CONTACT.companyName,
  address: COMPANY_CONTACT.fullAddress,
  phone: "", // Phone removed - support via chat/tickets
  email: COMPANY_CONTACT.supportEmailDisplay,
  paymentEmail: COMPANY_CONTACT.paymentEmail,
  website: COMPANY_CONTACT.website,
  serviceTerritory: COMPANY_CONTACT.serviceTerritory,
  fulfillmentCentre: "Grand Montréal, Québec",
  neq: COMPANY_CONTACT.neq,
  tpsNumber: COMPANY_CONTACT.tpsNumber,
  tvqNumber: COMPANY_CONTACT.tvqNumber,
  privacyOfficer: COMPANY_CONTACT.privacyOfficer,
  privacyOfficerEmail: COMPANY_CONTACT.privacyOfficerEmail,
};

export const CONTRACT_TERMS = {
  version: "v2.0-PREP-QC-2026",
  lastUpdated: "2026-06-05",
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
    activationSingle: 10, // 1 service type (updated 2026-04)
    activationMultiple: 45, // 2+ service types (bundled cap)
    delivery: 20, // auto-installation shipping (updated 2026-04)
    tvTerminal: 50, // per terminal
    router: 60,
    maxTerminals: 4,
    // Legacy
    simPhysical: 25,
    esim: 25,
    uberExpress: 45,
  },
  
  // Prepaid Billing Cycle Rules
  billingCycle: {
    invoiceGeneratedDaysBefore: 5, // Invoice issued J-5 (5 days before Bill Cycle date)
    renewalAtBillCycle: true, // Service renews on Bill Cycle date if paid
    etransferGraceHours: 24, // Grace window for e-transfer "in verification" at J0
    defaultBillCycleDay: "account_creation_day", // Day of month from account creation
    fallbackBillCycleDay: "activation_or_first_invoice", // If no creation date
    billCycleDayClamp: true, // If month doesn't have day 29-31, use last day of month
  },
  
  // Prepaid non-renewal (replaces suspension concept)
  nonRenewal: {
    effectAt: "bill_cycle", // Non-renewal at Bill Cycle date (J0) if unpaid
    numberLossDays: 90, // After 90 days without renewal, number may be unrecoverable
    statusLabels: {
      active: "Actif",
      renewalDue: "Renouvellement dû",
      inVerification: "En vérification",
      expired: "Expiré (non-renouvelé)",
    },
  },

  // Dispute/Chargeback penalties ONLY (not for normal non-renewal)
  disputeChargeback: {
    interestRate: 5, // 5% per month on amounts owed from dispute
    reactivationFee: 15, // $15 reconnection fee after dispute resolution
    appliesTo: "bank_dispute_chargeback_only", // ONLY for disputes/chargebacks
  },
  
  paymentTerms: {
    dueDays: 0, // Prepaid: payment due BEFORE Bill Cycle date
    currency: "CAD",
    acceptedMethods: ["PayPal (carte de crédit, débit, compte PayPal)", "Virement Interac (e-Transfer)"],
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
    returnDays: 30, // 30-day satisfaction guarantee window
    equipmentRemoval: "Service channels, equipment, and bindings must be removed from the client profile automatically",
    recordPersistence: "All invoices, contracts, and order logs must persist and never disappear from Admin records",
  },

  // 30-Day Satisfaction Guarantee (Money-Back)
  satisfactionGuarantee: {
    enabled: true,
    days: 30,
    refundable: ["Equipment fees (WiFi router, TV terminal)"],
    nonRefundable: ["Activation fee ($10)", "Delivery fee ($20)", "Technician installation fee (if applicable)"],
    nivraPaysReturnShipping: true,
    refundProcessingDays: "3 to 5 business days after equipment receipt",
    requirement: "Equipment must be returned in good condition, in original packaging, with all accessories included.",
  },

  warranty: {
    duration: "1 year",
    doaDays: 30, // Aligned with satisfaction guarantee window
    coverage: "Manufacturing defects only",
    exclusions: ["Client-caused damage", "Loss or theft", "Liquid damage", "Physical impact", "Unauthorized modifications"],
  },
  
  // Regulatory
  regulatory: {
    ccts: {
      name: "Commission for Complaints for Telecom-television Services",
      nameFr: "Commission des plaintes relatives aux services de télécom-télévision",
      website: "https://www.ccts-cprst.ca",
      description: "Free, independent complaint resolution for telecom/TV",
      memberNumber: COMPANY_CONTACT.cctsNumber,
    },
    crtc: {
      name: "Canadian Radio-television and Telecommunications Commission",
      website: "https://crtc.gc.ca",
      codes: ["Wireless Code", "Internet Code", "Television Service Provider Code"],
    },
    internetCode: {
      noticeDays: 30,
      bandwidthAlertThresholds: [75, 90, 100], // % of monthly cap
      dataCapPage: "/frais-possibles",
    },
    wirelessCode: {
      portDeadlineHours: 2.5 * 24, // 2.5 business days
      unlockFee: 0, // Must be $0 per CRTC Wireless Code
      contractMaxMonths: 0, // Prepaid: no term contract
    },
    itmp: {
      page: "/pratiques-reseau",
      description: "Internet Traffic Management Practices — disclosed per CRTC requirement",
    },
  },

  // Pre-Authorized Debit (Payments Canada Rule H1)
  pad: {
    agreementPage: "/accord-preautorise-debit",
    noticeDaysBeforeFirstDebit: 10,
    noticeDaysForChange: 10,
    revocationNoticeDays: 30,
    reimbursementWindow: 90,
    processorName: "PayPal Billing Agreements",
    rule: "Payments Canada Rule H1",
  },

  // Service Level Agreement
  sla: {
    page: "/niveaux-de-service",
    uptimeTargetPercent: 99.5,
    plannedMaintenanceWindowFr: "Dimanche 2h–6h (heure de l'Est)",
    plannedMaintenanceWindowEn: "Sunday 2AM–6AM (Eastern Time)",
    incidentResponseMinutes: {
      critical: 60,
      high: 240,
      medium: 1440, // 24h
    },
    creditEligibilityPercent: 99.0, // Uptime below this triggers credit
    maxCreditPercent: 50, // Max 50% of monthly fee
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

export const PREPAID_BILLING_CYCLE = {
  en: `
PREPAID BILLING CYCLE

• Each account has a Bill Cycle Day (day of month for renewal).
• Invoice is generated ${CONTRACT_TERMS.billingCycle.invoiceGeneratedDaysBefore} days before Bill Cycle (J-5).
• Payment must be received and confirmed BEFORE Bill Cycle date (J0) to renew service.
• If not paid by Bill Cycle (J0), service is not renewed (Expired/Non-renewed).
• E-Transfer in verification at J0: short grace window (${CONTRACT_TERMS.billingCycle.etransferGraceHours}h max) before expiration.
• After 90 days without renewal, the phone number may become unrecoverable (new number required).
• No interest or reconnection fee applies for normal prepaid non-renewal. Penalties apply ONLY for bank disputes/chargebacks.
  `.trim(),
  fr: `
CYCLE DE FACTURATION PRÉPAYÉ

• Chaque compte a un « Bill Cycle Day » (jour du mois pour le renouvellement).
• La facture est émise ${CONTRACT_TERMS.billingCycle.invoiceGeneratedDaysBefore} jours avant le Bill Cycle (J-5).
• Le paiement doit être reçu et confirmé AVANT la date du Bill Cycle (J0) pour renouveler le service.
• Si non payé au Bill Cycle (J0), le service n'est pas renouvelé (Expiré/Non-renouvelé).
• E-Transfer en vérification au J0 : fenêtre de grâce courte (${CONTRACT_TERMS.billingCycle.etransferGraceHours}h max) avant expiration.
• Après 90 jours sans renouvellement, le numéro de téléphone peut devenir irrécupérable (nouveau numéro requis).
• Aucun intérêt ni frais de réactivation ne s'applique pour un non-renouvellement prépayé normal. Pénalités applicables UNIQUEMENT pour contestations bancaires/chargebacks.
  `.trim(),
};

export const LATE_PAYMENT_POLICY = {
  en: `
PREPAID NON-RENEWAL (NO INTEREST/FEE FOR NORMAL NON-PAYMENT)

• If invoice is unpaid at Bill Cycle (J0), service is not renewed (prepaid non-renewal).
• No interest and no reconnection fee applies simply because payment was not received by Bill Cycle.
• After 90 days without renewal, the phone number may become unrecoverable (new number required).
• No interest or reactivation fee applies simply because an e-Transfer is "In verification".

BANK DISPUTE / CHARGEBACK (PENALTIES APPLY):
• If a bank dispute or chargeback is initiated, service may be suspended during investigation.
• If dispute is confirmed against the client OR Nivra is debited, interest of ${CONTRACT_TERMS.disputeChargeback.interestRate}% per month applies on amounts owed until paid in full.
• After full payment and resolution, a reconnection fee of $${CONTRACT_TERMS.disputeChargeback.reactivationFee} may apply.
  `.trim(),
  fr: `
NON-RENOUVELLEMENT PRÉPAYÉ (AUCUN INTÉRÊT/FRAIS POUR NON-PAIEMENT NORMAL)

• Si la facture est impayée au Bill Cycle (J0), le service n'est pas renouvelé (non-renouvellement prépayé).
• Aucun intérêt ni frais de réactivation ne s'applique simplement parce que le paiement n'a pas été reçu au Bill Cycle.
• Après 90 jours sans renouvellement, le numéro de téléphone peut devenir irrécupérable (nouveau numéro requis).
• Aucun intérêt ni frais de réactivation ne s'applique simplement parce qu'un e-Transfer est « En vérification ».

CONTESTATION BANCAIRE / CHARGEBACK (PÉNALITÉS APPLICABLES) :
• Si une contestation bancaire ou un chargeback est initié, le service peut être suspendu pendant l'enquête.
• Si la contestation est confirmée contre le client OU si Nivra est débité, un intérêt de ${CONTRACT_TERMS.disputeChargeback.interestRate}% par mois s'applique sur les montants dus jusqu'au paiement complet.
• Après paiement complet et résolution, des frais de réactivation de ${CONTRACT_TERMS.disputeChargeback.reactivationFee}$ peuvent s'appliquer.
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
  activationSingle: { amount: CONTRACT_TERMS.fees.activationSingle, description: "Activation fee (1 service)" },
  activationMultiple: { amount: CONTRACT_TERMS.fees.activationMultiple, description: "Activation fee (2+ services)" },
  delivery: { amount: CONTRACT_TERMS.fees.delivery, description: "Delivery fee" },
  terminal: { amount: CONTRACT_TERMS.fees.tvTerminal, description: "Nivra 4K Smart Terminal (purchase)" },
  router: { amount: CONTRACT_TERMS.fees.router, description: "Nivra Born WiFi Router (purchase)" },
  reactivation: { amount: CONTRACT_TERMS.disputeChargeback.reactivationFee, description: "Reactivation fee (dispute/chargeback only)" },
  disputeInterest: { percent: CONTRACT_TERMS.disputeChargeback.interestRate, description: "Interest on amounts owed from bank dispute/chargeback (dispute/chargeback only)" },
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
