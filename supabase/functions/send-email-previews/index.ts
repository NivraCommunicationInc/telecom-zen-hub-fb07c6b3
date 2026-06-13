// ============================================================
// NIVRA TELECOM - SEND ALL EMAIL TEMPLATE PREVIEWS
// Sends preview of all email templates to a specified email
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "../_shared/ResendProxy.ts";

// Import all templates
import * as marketing from '../_shared/emailTemplates/marketing.ts';
import * as onboarding from '../_shared/emailTemplates/onboarding.ts';
import * as orders from '../_shared/emailTemplates/orders.ts';
import * as portability from '../_shared/emailTemplates/portability.ts';
import * as billing from '../_shared/emailTemplates/billing.ts';
import * as account from '../_shared/emailTemplates/account.ts';
import * as service from '../_shared/emailTemplates/service.ts';
import * as support from '../_shared/emailTemplates/support.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default params for all templates
const baseParams = {
  supportEmail: "support@nivra-telecom.ca",
};

// Sample data for templates
const sampleData = {
  clientName: "Jean-FranÃ§ois Tremblay",
  clientEmail: "jf.tremblay@example.com",
  accountNumber: "NVR-2024-0001234",
  orderNumber: "CMD-2024-0567",
  invoiceNumber: "FAC-2024-0890",
  phoneNumber: "(514) 555-1234",
  portalUrl: "https://nivra-telecom.ca/portal",
};

// All email templates to send
const getTemplates = () => [
  // ============ MARKETING (8) ============
  {
    category: "01 - MARKETING",
    name: "DÃ©couvrez Nivra",
    subject: "ðŸ“§ [Preview] DÃ©couvrez Nivra TÃ©lÃ©com",
    html: marketing.discoverNivra({ ...baseParams, recipientName: sampleData.clientName }),
  },
  {
    category: "01 - MARKETING",
    name: "Offre de bienvenue",
    subject: "ðŸ“§ [Preview] Offre de bienvenue - 50%",
    html: marketing.welcomeOffer({ 
      ...baseParams, 
      recipientName: sampleData.clientName,
      discountPercent: 50,
      promoCode: "BIENVENUE50",
      expiryDate: "31 janvier 2025"
    }),
  },
  {
    category: "01 - MARKETING",
    name: "Campagne saisonniÃ¨re",
    subject: "ðŸ“§ [Preview] Campagne Black Friday",
    html: marketing.seasonalCampaign({
      ...baseParams,
      recipientName: sampleData.clientName,
      campaignTitle: "Black Friday ðŸ–¤",
      campaignSubtitle: "Jusqu'Ã  70% de rabais!",
      bannerIcon: "ðŸ–¤",
      offerTitle: "Offre Black Friday Exclusive",
      offerDescription: "Profitez de nos meilleurs prix de l'annÃ©e sur tous les forfaits mobiles!",
      promoCode: "BLACK70",
      expiryDate: "30 novembre 2024",
    }),
  },
  {
    category: "01 - MARKETING",
    name: "Panier abandonnÃ©",
    subject: "ðŸ“§ [Preview] Panier abandonnÃ©",
    html: marketing.abandonedCart({
      ...baseParams,
      recipientName: sampleData.clientName,
      cartItems: [
        { name: "Forfait Essentiel 8GB", price: 35 },
        { name: "Option appels internationaux", price: 10 },
      ],
      cartTotal: 45,
    }),
  },
  {
    category: "01 - MARKETING",
    name: "Newsletter",
    subject: "ðŸ“§ [Preview] Newsletter Nivra",
    html: marketing.newsletter({
      ...baseParams,
      recipientName: sampleData.clientName,
      subject: "Nouvelles du mois",
      previewText: "DÃ©couvrez nos nouveautÃ©s!",
       sections: [
         { title: "Nouveau: Forfait IllimitÃ©+", content: "Nous lanÃ§ons notre forfait le plus gÃ©nÃ©reux avec donnÃ©es illimitÃ©es!", ctaText: "Voir le forfait", ctaUrl: "https://nivra-telecom.ca/mobile" },
         { title: "Couverture Ã©tendue", content: "Notre rÃ©seau couvre maintenant 99% du territoire quÃ©bÃ©cois.", ctaText: "Voir la carte", ctaUrl: "https://nivra-telecom.ca/coverage" },
       ],
    }),
  },
  {
    category: "01 - MARKETING",
    name: "Invitation parrainage",
    subject: "ðŸ“§ [Preview] Parrainage",
    html: marketing.referralInvite({
      ...baseParams,
      referrerName: "Marie Dupont",
      recipientName: sampleData.clientName,
      referralCode: "MARIE2024",
      referralBenefit: "2 mois gratuits",
    }),
  },
  {
    category: "01 - MARKETING",
    name: "Proposition personnalisÃ©e",
    subject: "ðŸ“§ [Preview] Proposition personnalisÃ©e",
    html: marketing.personalizedProposal({
      ...baseParams,
      recipientName: sampleData.clientName,
      agentName: "Sophie Martin",
      proposalSummary: "Suite Ã  notre discussion, voici une offre sur mesure pour vos besoins.",
      services: [
        { name: "Internet Fibre 500Mbps", price: 65, description: "TÃ©lÃ©chargement ultra-rapide" },
        { name: "Mobile 20GB", price: 45, description: "DonnÃ©es partout au Canada" },
      ],
      totalMonthly: 110,
      validUntil: "15 fÃ©vrier 2025",
    }),
  },
  {
    category: "01 - MARKETING",
    name: "Demande d'avis",
    subject: "ðŸ“§ [Preview] Demande d'avis",
    html: marketing.feedbackRequest({
      ...baseParams,
      clientName: sampleData.clientName,
    }),
  },

  // ============ ONBOARDING (7) ============
  {
    category: "02 - ONBOARDING",
    name: "Compte crÃ©Ã©",
    subject: "ðŸ“§ [Preview] Compte crÃ©Ã©",
    html: onboarding.accountCreated({
      ...baseParams,
      clientName: sampleData.clientName,
      clientEmail: sampleData.clientEmail,
      accountNumber: sampleData.accountNumber,
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "VÃ©rification OTP",
    subject: "ðŸ“§ [Preview] Code OTP",
    html: onboarding.emailVerificationOtp({
      ...baseParams,
      clientName: sampleData.clientName,
      otpCode: "847291",
      expiresInMinutes: 10,
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "VÃ©rification lien",
    subject: "ðŸ“§ [Preview] VÃ©rification email",
    html: onboarding.emailVerificationLink({
      ...baseParams,
      clientName: sampleData.clientName,
      verificationUrl: "https://nivra-telecom.ca/verify?token=abc123def456",
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "Bienvenue",
    subject: "ðŸ“§ [Preview] Bienvenue chez Nivra",
    html: onboarding.welcomeToNivra({
      ...baseParams,
      clientName: sampleData.clientName,
      accountNumber: sampleData.accountNumber,
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "RÃ©capitulatif forfait",
    subject: "ðŸ“§ [Preview] RÃ©capitulatif forfait",
    html: onboarding.planSummary({
      ...baseParams,
      clientName: sampleData.clientName,
      planName: "Forfait Essentiel 8GB",
      planDetails: "Parfait pour un usage quotidien",
      monthlyPrice: 35,
      features: ["8 GB de donnÃ©es", "Appels illimitÃ©s Canada-wide", "Textos illimitÃ©s", "Messagerie vocale visuelle"],
      startDate: "15 janvier 2025",
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "Conditions acceptÃ©es",
    subject: "ðŸ“§ [Preview] Conditions acceptÃ©es",
    html: onboarding.termsAccepted({
      ...baseParams,
      clientName: sampleData.clientName,
      acceptedAt: "14 janvier 2025 Ã  15h32",
      termsVersion: "2.1",
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "Paiement prÃ©autorisÃ© confirmÃ©",
    subject: "ðŸ“§ [Preview] Paiement prÃ©autorisÃ©",
    html: onboarding.preauthorizedPaymentConfirmed({
      ...baseParams,
      clientName: sampleData.clientName,
      paymentMethod: "Carte Visa",
      lastFourDigits: "4521",
      billingDay: 15,
      monthlyAmount: 45,
    }),
  },

  // ============ ORDERS (6) ============
  {
    category: "03 - COMMANDES",
    name: "Suivi commande",
    subject: "ðŸ“§ [Preview] Suivi commande",
    html: orders.orderTracking({
      ...baseParams,
      clientName: sampleData.clientName,
      orderNumber: sampleData.orderNumber,
      status: "shipped",
      trackingNumber: "CP123456789CA",
      carrier: "Postes Canada",
      estimatedDelivery: "18 janvier 2025",
    }),
  },
  {
    category: "03 - COMMANDES",
    name: "SIM expÃ©diÃ©e",
    subject: "ðŸ“§ [Preview] SIM expÃ©diÃ©e",
    html: orders.simShipped({
      ...baseParams,
      clientName: sampleData.clientName,
      orderNumber: sampleData.orderNumber,
      simType: "physical",
      trackingNumber: "CP987654321CA",
      carrier: "Postes Canada",
      estimatedDelivery: "20 janvier 2025",
      deliveryAddress: { street: "123 Rue Principale", city: "MontrÃ©al", province: "QC", postalCode: "H2X 1Y6" },
    }),
  },
  {
    category: "03 - COMMANDES",
    name: "Technicien planifiÃ©",
    subject: "ðŸ“§ [Preview] RDV technicien",
    html: orders.technicianScheduled({
      ...baseParams,
      clientName: sampleData.clientName,
      appointmentDate: "22 janvier 2025",
      appointmentTime: "10h00 - 12h00",
      technicianName: "Marc Gagnon",
      serviceAddress: { street: "456 Avenue du Parc", city: "Laval", province: "QC", postalCode: "H7N 3T4" },
      serviceType: "Installation Internet Fibre",
      appointmentNumber: "RDV-2025-0042",
    }),
  },
  {
    category: "03 - COMMANDES",
    name: "Rappel RDV",
    subject: "ðŸ“§ [Preview] Rappel rendez-vous",
    html: orders.appointmentReminder({
      ...baseParams,
      clientName: sampleData.clientName,
      appointmentDate: "22 janvier 2025",
      appointmentTime: "10h00 - 12h00",
      technicianName: "Marc Gagnon",
      serviceAddress: { street: "456 Avenue du Parc", city: "Laval", province: "QC", postalCode: "H7N 3T4" },
      serviceType: "Installation Internet Fibre",
      appointmentNumber: "RDV-2025-0042",
    }),
  },
  {
    category: "03 - COMMANDES",
    name: "Activation rÃ©ussie",
    subject: "ðŸ“§ [Preview] Service activÃ©",
    html: orders.activationSuccess({
      ...baseParams,
      clientName: sampleData.clientName,
      serviceName: "Forfait Essentiel 8GB",
      phoneNumber: sampleData.phoneNumber,
      activationDate: "15 janvier 2025",
    }),
  },
  {
    category: "03 - COMMANDES",
    name: "Guide dÃ©marrage",
    subject: "ðŸ“§ [Preview] Guide dÃ©marrage",
    html: orders.quickStartGuide({
      ...baseParams,
      clientName: sampleData.clientName,
      serviceName: "Mobile Nivra",
      steps: [
        { title: "InsÃ©rez votre SIM", description: "Ã‰teignez votre tÃ©lÃ©phone et insÃ©rez la carte SIM Nivra." },
        { title: "RedÃ©marrez", description: "Allumez votre tÃ©lÃ©phone et attendez la connexion au rÃ©seau." },
        { title: "Configurez l'APN", description: "Allez dans ParamÃ¨tres > RÃ©seau mobile > Noms des points d'accÃ¨s." },
        { title: "Testez!", description: "Effectuez un appel test et naviguez sur internet." },
      ],
    }),
  },

  // ============ PORTABILITY (5) ============
  {
    category: "04 - PORTABILITÃ‰",
    name: "Demande reÃ§ue",
    subject: "ðŸ“§ [Preview] PortabilitÃ© reÃ§ue",
    html: portability.portingRequestReceived({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      currentProvider: "Bell MobilitÃ©",
      requestDate: "14 janvier 2025",
      estimatedCompletion: "21 janvier 2025",
    }),
  },
  {
    category: "04 - PORTABILITÃ‰",
    name: "En cours",
    subject: "ðŸ“§ [Preview] PortabilitÃ© en cours",
    html: portability.portingInProgress({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      currentProvider: "Bell MobilitÃ©",
      estimatedCompletion: "21 janvier 2025",
    }),
  },
  {
    category: "04 - PORTABILITÃ‰",
    name: "ApprouvÃ©e",
    subject: "ðŸ“§ [Preview] PortabilitÃ© approuvÃ©e",
    html: portability.portingApproved({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      transferDate: "21 janvier 2025",
    }),
  },
  {
    category: "04 - PORTABILITÃ‰",
    name: "ComplÃ©tÃ©e",
    subject: "ðŸ“§ [Preview] PortabilitÃ© complÃ©tÃ©e",
    html: portability.portingCompleted({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      completionDate: "21 janvier 2025",
    }),
  },
  {
    category: "04 - PORTABILITÃ‰",
    name: "ProblÃ¨me",
    subject: "ðŸ“§ [Preview] ProblÃ¨me portabilitÃ©",
    html: portability.portingIssue({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      issueDescription: "Les informations du compte ne correspondent pas aux donnÃ©es de votre ancien fournisseur.",
      requiredDocuments: ["Copie de votre derniÃ¨re facture Bell", "PiÃ¨ce d'identitÃ© avec photo"],
    }),
  },

  // ============ BILLING (12) ============
  {
    category: "05 - FACTURATION",
    name: "Facture mensuelle",
    subject: "ðŸ“§ [Preview] Facture mensuelle",
    html: billing.monthlyInvoice({
      ...baseParams,
      clientName: sampleData.clientName,
      invoiceNumber: sampleData.invoiceNumber,
      invoiceDate: "1er fÃ©vrier 2025",
      dueDate: "15 fÃ©vrier 2025",
      services: [
        { name: "Forfait Essentiel 8GB", price: 35 },
        { name: "Option appels internationaux", price: 10 },
      ],
      subtotal: 45,
      tpsAmount: 2.25,
      tvqAmount: 4.49,
      totalAmount: 51.74,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "ReÃ§u paiement",
    subject: "ðŸ“§ [Preview] ReÃ§u de paiement",
    html: billing.paymentReceipt({
      ...baseParams,
      clientName: sampleData.clientName,
      paymentDate: "15 fÃ©vrier 2025",
      amount: 51.74,
      paymentMethod: "Carte Visa ****4521",
      invoiceNumber: sampleData.invoiceNumber,
      transactionId: "TRX-2025-789456",
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "PrÃ©lÃ¨vement rÃ©ussi",
    subject: "ðŸ“§ [Preview] PrÃ©lÃ¨vement rÃ©ussi",
    html: billing.preauthorizedPaymentSuccess({
      ...baseParams,
      clientName: sampleData.clientName,
      paymentDate: "15 fÃ©vrier 2025",
      amount: 51.74,
      invoiceNumber: sampleData.invoiceNumber,
      nextPaymentDate: "15 mars 2025",
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Paiement Ã©chouÃ©",
    subject: "ðŸ“§ [Preview] Paiement Ã©chouÃ©",
    html: billing.paymentFailed({
      ...baseParams,
      clientName: sampleData.clientName,
      amount: 51.74,
      failureDate: "15 fÃ©vrier 2025",
      failureReason: "Fonds insuffisants sur la carte.",
      retryDate: "18 fÃ©vrier 2025",
      invoiceNumber: sampleData.invoiceNumber,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Nouvelle tentative",
    subject: "ðŸ“§ [Preview] Nouvelle tentative",
    html: billing.paymentRetry({
      ...baseParams,
      clientName: sampleData.clientName,
      amount: 51.74,
      retryDate: "18 fÃ©vrier 2025",
      invoiceNumber: sampleData.invoiceNumber,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Solde en retard",
    subject: "ðŸ“§ [Preview] Solde en retard",
    html: billing.overdueBalance({
      ...baseParams,
      clientName: sampleData.clientName,
      overdueAmount: 51.74,
      daysOverdue: 7,
      invoiceNumber: sampleData.invoiceNumber,
      dueDate: "15 fÃ©vrier 2025",
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Avis suspension",
    subject: "ðŸ“§ [Preview] Avis de suspension",
    html: billing.suspensionWarning({
      ...baseParams,
      clientName: sampleData.clientName,
      overdueAmount: 51.74,
      suspensionDate: "1er mars 2025",
      invoiceNumber: sampleData.invoiceNumber,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Service suspendu",
    subject: "ðŸ“§ [Preview] Service suspendu",
    html: billing.serviceSuspended({
      ...baseParams,
      clientName: sampleData.clientName,
      overdueAmount: 51.74,
      suspendedDate: "1er mars 2025",
      invoiceNumber: sampleData.invoiceNumber,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Service rÃ©activÃ©",
    subject: "ðŸ“§ [Preview] Service rÃ©activÃ©",
    html: billing.serviceReactivated({
      ...baseParams,
      clientName: sampleData.clientName,
      reactivationDate: "2 mars 2025",
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "CrÃ©dit appliquÃ©",
    subject: "ðŸ“§ [Preview] CrÃ©dit appliquÃ©",
    html: billing.creditApplied({
      ...baseParams,
      clientName: sampleData.clientName,
      creditAmount: 15.00,
      creditReason: "Compensation pour interruption de service",
      newBalance: 36.74,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Rappel de paiement",
    subject: "ðŸ“§ [Preview] Rappel de paiement",
    html: billing.paymentReminder({
      ...baseParams,
      clientName: sampleData.clientName,
      invoiceNumber: sampleData.invoiceNumber,
      amount: 51.74,
      dueDate: "15 fÃ©vrier 2025",
      daysUntilDue: 3,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Mode de paiement modifiÃ©",
    subject: "ðŸ“§ [Preview] Mode de paiement modifiÃ©",
    html: billing.paymentMethodChanged({
      ...baseParams,
      clientName: sampleData.clientName,
      newPaymentMethod: "Carte Visa",
      lastFourDigits: "4521",
      changedAt: "15 mars 2025 Ã  14h30",
    }),
  },

  // ============ ACCOUNT & SECURITY (6) ============
  {
    category: "06 - COMPTE",
    name: "Compte bloquÃ©",
    subject: "ðŸ“§ [Preview] Compte bloquÃ©",
    html: account.accountBlocked({
      ...baseParams,
      clientName: sampleData.clientName,
      blockReason: "Plusieurs tentatives de connexion Ã©chouÃ©es dÃ©tectÃ©es",
      blockedAt: "15 janvier 2025 Ã  14h30",
    }),
  },
  {
    category: "06 - COMPTE",
    name: "Compte dÃ©bloquÃ©",
    subject: "ðŸ“§ [Preview] Compte dÃ©bloquÃ©",
    html: account.accountUnblocked({
      ...baseParams,
      clientName: sampleData.clientName,
      unblockedAt: "16 janvier 2025 Ã  10h00",
    }),
  },
  {
    category: "06 - COMPTE",
    name: "AccÃ¨s en ligne bloquÃ©",
    subject: "ðŸ“§ [Preview] AccÃ¨s en ligne bloquÃ©",
    html: account.onlineAccessBlocked({
      ...baseParams,
      clientName: sampleData.clientName,
      blockReason: "ActivitÃ© suspecte dÃ©tectÃ©e sur votre compte",
      blockedAt: "15 janvier 2025 Ã  14h30",
    }),
  },
  {
    category: "06 - COMPTE",
    name: "RÃ©initialisation mot de passe",
    subject: "ðŸ“§ [Preview] RÃ©initialisation mot de passe",
    html: account.passwordReset({
      ...baseParams,
      clientName: sampleData.clientName,
      resetUrl: "https://nivra-telecom.ca/reset?token=abc123",
      requestedAt: "15 janvier 2025 Ã  14h30",
      expiresInHours: 24,
    }),
  },
  {
    category: "06 - COMPTE",
    name: "Mot de passe modifiÃ©",
    subject: "ðŸ“§ [Preview] Mot de passe modifiÃ©",
    html: account.passwordChanged({
      ...baseParams,
      clientName: sampleData.clientName,
      changedAt: "15 janvier 2025 Ã  14h45",
    }),
  },
  {
    category: "06 - COMPTE",
    name: "Connexion suspecte",
    subject: "ðŸ“§ [Preview] Connexion suspecte",
    html: account.suspiciousLogin({
      ...baseParams,
      clientName: sampleData.clientName,
      loginTime: "15 janvier 2025 Ã  03h15",
      ipAddress: "185.234.56.78",
      location: "Paris, France",
      device: "Chrome sur Windows",
    }),
  },

  // ============ SERVICE LIFECYCLE (7) ============
  {
    category: "07 - SERVICES",
    name: "Demande d'annulation reÃ§ue",
    subject: "ðŸ“§ [Preview] Demande d'annulation reÃ§ue",
    html: service.cancellationRequestReceived({
      ...baseParams,
      clientName: sampleData.clientName,
      serviceName: "Forfait Essentiel 8GB",
      requestDate: "15 janvier 2025",
      effectiveDate: "15 fÃ©vrier 2025",
      requestNumber: "ANN-2025-0042",
      cancellationReason: "DÃ©mÃ©nagement hors QuÃ©bec",
    }),
  },
  {
    category: "07 - SERVICES",
    name: "Service annulÃ©",
    subject: "ðŸ“§ [Preview] Service annulÃ©",
    html: service.serviceCancelled({
      ...baseParams,
      clientName: sampleData.clientName,
      serviceName: "Forfait Essentiel 8GB",
      cancellationDate: "15 fÃ©vrier 2025",
      finalBillAmount: 17.87,
      refundAmount: 12.50,
    }),
  },
  {
    category: "07 - SERVICES",
    name: "Service suspendu",
    subject: "ðŸ“§ [Preview] Service suspendu",
    html: service.serviceSuspended({
      ...baseParams,
      clientName: sampleData.clientName,
      serviceName: "Forfait Essentiel 8GB",
      suspensionDate: "1er mars 2025",
      suspensionReason: "Facture impayÃ©e depuis plus de 30 jours",
      amountDue: 51.74,
    }),
  },
  {
    category: "07 - SERVICES",
    name: "Service rÃ©activÃ©",
    subject: "ðŸ“§ [Preview] Service rÃ©activÃ©",
    html: service.serviceReactivated({
      ...baseParams,
      clientName: sampleData.clientName,
      serviceName: "Forfait Essentiel 8GB",
      reactivationDate: "2 mars 2025",
    }),
  },
  {
    category: "07 - SERVICES",
    name: "Changement de forfait",
    subject: "ðŸ“§ [Preview] Changement de forfait",
    html: service.planChangeConfirmed({
      ...baseParams,
      clientName: sampleData.clientName,
      oldPlan: "Forfait Essentiel 8GB",
      newPlan: "Forfait Premium 25GB",
      effectiveDate: "1er fÃ©vrier 2025",
      newMonthlyPrice: 55,
      proratedAmount: 8.50,
    }),
  },
  {
    category: "07 - SERVICES",
    name: "SIM perdue dÃ©clarÃ©e",
    subject: "ðŸ“§ [Preview] SIM perdue dÃ©clarÃ©e",
    html: service.simLostReported({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      reportedAt: "15 janvier 2025 Ã  14h30",
      replacementFee: 10,
    }),
  },
  {
    category: "07 - SERVICES",
    name: "SIM remplacement expÃ©diÃ©e",
    subject: "ðŸ“§ [Preview] SIM remplacement expÃ©diÃ©e",
    html: service.replacementSimShipped({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      trackingNumber: "CP123456789CA",
      carrier: "Postes Canada",
      estimatedDelivery: "20 janvier 2025",
    }),
  },

  // ============ SUPPORT TICKETS (5) ============
  {
    category: "08 - SUPPORT",
    name: "Ticket crÃ©Ã©",
    subject: "ðŸ“§ [Preview] Ticket crÃ©Ã©",
    html: support.ticketCreated({
      ...baseParams,
      clientName: sampleData.clientName,
      ticketNumber: "TKT-2025-0789",
      subject: "ProblÃ¨me de connexion internet intermittent",
      category: "Internet",
      priority: "Urgent",
      createdAt: "15 janvier 2025 Ã  14h30",
    }),
  },
  {
    category: "08 - SUPPORT",
    name: "Ticket mis Ã  jour",
    subject: "ðŸ“§ [Preview] Ticket mis Ã  jour",
    html: support.ticketUpdated({
      ...baseParams,
      clientName: sampleData.clientName,
      ticketNumber: "TKT-2025-0789",
      subject: "ProblÃ¨me de connexion internet intermittent",
      updateMessage: "Bonjour Jean-FranÃ§ois,\n\nNous avons analysÃ© votre connexion et identifiÃ© un problÃ¨me avec le routeur. Un technicien vous contactera sous 24h pour planifier une intervention.\n\nMerci de votre patience!",
      updatedBy: "Sophie Martin - Support technique",
      updatedAt: "15 janvier 2025 Ã  16h45",
    }),
  },
  {
    category: "08 - SUPPORT",
    name: "Ticket rÃ©solu",
    subject: "ðŸ“§ [Preview] Ticket rÃ©solu",
    html: support.ticketResolved({
      ...baseParams,
      clientName: sampleData.clientName,
      ticketNumber: "TKT-2025-0789",
      subject: "ProblÃ¨me de connexion internet intermittent",
      resolution: "Le problÃ¨me a Ã©tÃ© rÃ©solu suite au remplacement du routeur dÃ©fectueux. Votre connexion devrait maintenant Ãªtre stable. N'hÃ©sitez pas Ã  nous recontacter si le problÃ¨me persiste.",
      resolvedAt: "17 janvier 2025 Ã  11h00",
    }),
  },
  {
    category: "08 - SUPPORT",
    name: "Ticket fermÃ© automatiquement",
    subject: "ðŸ“§ [Preview] Ticket fermÃ© automatiquement",
    html: support.ticketAutoClosed({
      ...baseParams,
      clientName: sampleData.clientName,
      ticketNumber: "TKT-2025-0789",
      subject: "ProblÃ¨me de connexion internet intermittent",
      closedAt: "24 janvier 2025",
    }),
  },
  {
    category: "08 - SUPPORT",
    name: "Demande de documents",
    subject: "ðŸ“§ [Preview] Demande de documents",
    html: support.documentRequest({
      ...baseParams,
      clientName: sampleData.clientName,
      ticketNumber: "TKT-2025-0790",
      requestReason: "Pour traiter votre demande de portabilitÃ©",
      requiredDocuments: ["Copie de votre derniÃ¨re facture de l'ancien fournisseur", "PiÃ¨ce d'identitÃ© avec photo", "Preuve de rÃ©sidence rÃ©cente"],
      uploadUrl: "https://nivra-telecom.ca/portal/upload?token=SAMPLE_TOKEN",
      deadline: "22 janvier 2025",
    }),
  },
];

// Handler
const handler = async (req: Request): Promise<Response> => {
  console.log("ðŸ“§ Send Email Previews - Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetEmail } = await req.json();
    
    if (!targetEmail) {
      throw new Error("targetEmail is required");
    }
    
    console.log(`ðŸ“§ Sending all email previews to: ${targetEmail}`);
    
    const templates = getTemplates();
    const results: Array<{ name: string; success: boolean; error?: string }> = [];
    let successCount = 0;
    let failCount = 0;
    
    // Send emails with a small delay between each to avoid rate limits
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      
      try {
        console.log(`ðŸ“§ Sending ${i + 1}/${templates.length}: ${template.category} - ${template.name}`);
        
        const { error } = await resend.emails.send({
          from: "Nivra TÃ©lÃ©com <support@nivra-telecom.ca>",
          to: [targetEmail],
          subject: `[${i + 1}/${templates.length}] ${template.category} | ${template.name}`,
          html: template.html,
        });
        
        if (error) {
          console.error(`âŒ Failed to send ${template.name}:`, error);
          results.push({ name: `${template.category} - ${template.name}`, success: false, error: error.message });
          failCount++;
        } else {
          console.log(`âœ… Sent: ${template.name}`);
          results.push({ name: `${template.category} - ${template.name}`, success: true });
          successCount++;
        }
        
        // Delay to avoid rate limits (600ms between emails = ~1.6 req/sec, under 2/sec limit)
        if (i < templates.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }
        
      } catch (err) {
        console.error(`âŒ Error sending ${template.name}:`, err);
        results.push({ name: `${template.category} - ${template.name}`, success: false, error: err.message });
        failCount++;
      }
    }
    
    console.log(`ðŸ“§ Complete! Sent: ${successCount}, Failed: ${failCount}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `${successCount} emails sent successfully, ${failCount} failed`,
        totalTemplates: templates.length,
        successCount,
        failCount,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
    
  } catch (error) {
    console.error("âŒ Error in send-email-previews:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
