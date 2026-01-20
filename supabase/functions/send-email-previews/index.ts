// ============================================================
// NIVRA TELECOM - SEND ALL EMAIL TEMPLATE PREVIEWS
// Sends preview of all email templates to a specified email
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

// Import all templates
import * as marketing from '../_shared/emailTemplates/marketing.ts';
import * as onboarding from '../_shared/emailTemplates/onboarding.ts';
import * as orders from '../_shared/emailTemplates/orders.ts';
import * as portability from '../_shared/emailTemplates/portability.ts';
import * as billing from '../_shared/emailTemplates/billing.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default params for all templates
const baseParams = {
  supportPhone: "(438) 394-9110",
  supportEmail: "support@nivratelecom.ca",
};

// Sample data for templates
const sampleData = {
  clientName: "Jean-François Tremblay",
  clientEmail: "jf.tremblay@example.com",
  accountNumber: "NVR-2024-0001234",
  orderNumber: "CMD-2024-0567",
  invoiceNumber: "FAC-2024-0890",
  phoneNumber: "(514) 555-1234",
  portalUrl: "https://nivratelecom.ca/portal",
};

// All email templates to send
const getTemplates = () => [
  // ============ MARKETING (8) ============
  {
    category: "01 - MARKETING",
    name: "Découvrez Nivra",
    subject: "📧 [Preview] Découvrez Nivra Télécom",
    html: marketing.discoverNivra({ ...baseParams, recipientName: sampleData.clientName }),
  },
  {
    category: "01 - MARKETING",
    name: "Offre de bienvenue",
    subject: "📧 [Preview] Offre de bienvenue - 50%",
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
    name: "Campagne saisonnière",
    subject: "📧 [Preview] Campagne Black Friday",
    html: marketing.seasonalCampaign({
      ...baseParams,
      recipientName: sampleData.clientName,
      campaignTitle: "Black Friday 🖤",
      campaignSubtitle: "Jusqu'à 70% de rabais!",
      bannerIcon: "🖤",
      offerTitle: "Offre Black Friday Exclusive",
      offerDescription: "Profitez de nos meilleurs prix de l'année sur tous les forfaits mobiles!",
      promoCode: "BLACK70",
      expiryDate: "30 novembre 2024",
    }),
  },
  {
    category: "01 - MARKETING",
    name: "Panier abandonné",
    subject: "📧 [Preview] Panier abandonné",
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
    subject: "📧 [Preview] Newsletter Nivra",
    html: marketing.newsletter({
      ...baseParams,
      recipientName: sampleData.clientName,
      subject: "Nouvelles du mois",
      previewText: "Découvrez nos nouveautés!",
      sections: [
        { title: "Nouveau: Forfait Illimité+", content: "Nous lançons notre forfait le plus généreux avec données illimitées!", ctaText: "Voir le forfait", ctaUrl: "https://nivratelecom.ca/mobile" },
        { title: "Couverture étendue", content: "Notre réseau couvre maintenant 99% du territoire québécois.", ctaText: "Voir la carte", ctaUrl: "https://nivratelecom.ca/coverage" },
      ],
    }),
  },
  {
    category: "01 - MARKETING",
    name: "Invitation parrainage",
    subject: "📧 [Preview] Parrainage",
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
    name: "Proposition personnalisée",
    subject: "📧 [Preview] Proposition personnalisée",
    html: marketing.personalizedProposal({
      ...baseParams,
      recipientName: sampleData.clientName,
      agentName: "Sophie Martin",
      proposalSummary: "Suite à notre discussion, voici une offre sur mesure pour vos besoins.",
      services: [
        { name: "Internet Fibre 500Mbps", price: 65, description: "Téléchargement ultra-rapide" },
        { name: "Mobile 20GB", price: 45, description: "Données partout au Canada" },
      ],
      totalMonthly: 110,
      validUntil: "15 février 2025",
    }),
  },
  {
    category: "01 - MARKETING",
    name: "Témoignages clients",
    subject: "📧 [Preview] Témoignages clients",
    html: marketing.testimonials({
      ...baseParams,
      recipientName: sampleData.clientName,
      testimonials: [
        { name: "Pierre L.", location: "Montréal", text: "Service impeccable et prix imbattables!", rating: 5 },
        { name: "Catherine B.", location: "Québec", text: "Enfin un fournisseur qui écoute ses clients.", rating: 5 },
      ],
    }),
  },

  // ============ ONBOARDING (7) ============
  {
    category: "02 - ONBOARDING",
    name: "Compte créé",
    subject: "📧 [Preview] Compte créé",
    html: onboarding.accountCreated({
      ...baseParams,
      clientName: sampleData.clientName,
      clientEmail: sampleData.clientEmail,
      accountNumber: sampleData.accountNumber,
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "Vérification OTP",
    subject: "📧 [Preview] Code OTP",
    html: onboarding.emailVerificationOtp({
      ...baseParams,
      clientName: sampleData.clientName,
      otpCode: "847291",
      expiresInMinutes: 10,
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "Vérification lien",
    subject: "📧 [Preview] Vérification email",
    html: onboarding.emailVerificationLink({
      ...baseParams,
      clientName: sampleData.clientName,
      verificationUrl: "https://nivratelecom.ca/verify?token=abc123def456",
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "Bienvenue",
    subject: "📧 [Preview] Bienvenue chez Nivra",
    html: onboarding.welcomeToNivra({
      ...baseParams,
      clientName: sampleData.clientName,
      accountNumber: sampleData.accountNumber,
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "Récapitulatif forfait",
    subject: "📧 [Preview] Récapitulatif forfait",
    html: onboarding.planSummary({
      ...baseParams,
      clientName: sampleData.clientName,
      planName: "Forfait Essentiel 8GB",
      planDetails: "Parfait pour un usage quotidien",
      monthlyPrice: 35,
      features: ["8 GB de données", "Appels illimités Canada-wide", "Textos illimités", "Messagerie vocale visuelle"],
      startDate: "15 janvier 2025",
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "Conditions acceptées",
    subject: "📧 [Preview] Conditions acceptées",
    html: onboarding.termsAccepted({
      ...baseParams,
      clientName: sampleData.clientName,
      acceptedAt: "14 janvier 2025 à 15h32",
      termsVersion: "2.1",
    }),
  },
  {
    category: "02 - ONBOARDING",
    name: "Paiement préautorisé confirmé",
    subject: "📧 [Preview] Paiement préautorisé",
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
    subject: "📧 [Preview] Suivi commande",
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
    name: "SIM expédiée",
    subject: "📧 [Preview] SIM expédiée",
    html: orders.simShipped({
      ...baseParams,
      clientName: sampleData.clientName,
      orderNumber: sampleData.orderNumber,
      simType: "physical",
      trackingNumber: "CP987654321CA",
      carrier: "Postes Canada",
      estimatedDelivery: "20 janvier 2025",
      deliveryAddress: { street: "123 Rue Principale", city: "Montréal", province: "QC", postalCode: "H2X 1Y6" },
    }),
  },
  {
    category: "03 - COMMANDES",
    name: "Technicien planifié",
    subject: "📧 [Preview] RDV technicien",
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
    subject: "📧 [Preview] Rappel rendez-vous",
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
    name: "Activation réussie",
    subject: "📧 [Preview] Service activé",
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
    name: "Guide démarrage",
    subject: "📧 [Preview] Guide démarrage",
    html: orders.quickStartGuide({
      ...baseParams,
      clientName: sampleData.clientName,
      serviceName: "Mobile Nivra",
      steps: [
        { title: "Insérez votre SIM", description: "Éteignez votre téléphone et insérez la carte SIM Nivra." },
        { title: "Redémarrez", description: "Allumez votre téléphone et attendez la connexion au réseau." },
        { title: "Configurez l'APN", description: "Allez dans Paramètres > Réseau mobile > Noms des points d'accès." },
        { title: "Testez!", description: "Effectuez un appel test et naviguez sur internet." },
      ],
    }),
  },

  // ============ PORTABILITY (5) ============
  {
    category: "04 - PORTABILITÉ",
    name: "Demande reçue",
    subject: "📧 [Preview] Portabilité reçue",
    html: portability.portingRequestReceived({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      currentProvider: "Bell Mobilité",
      requestDate: "14 janvier 2025",
      estimatedCompletion: "21 janvier 2025",
    }),
  },
  {
    category: "04 - PORTABILITÉ",
    name: "En cours",
    subject: "📧 [Preview] Portabilité en cours",
    html: portability.portingInProgress({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      currentProvider: "Bell Mobilité",
      estimatedCompletion: "21 janvier 2025",
    }),
  },
  {
    category: "04 - PORTABILITÉ",
    name: "Approuvée",
    subject: "📧 [Preview] Portabilité approuvée",
    html: portability.portingApproved({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      transferDate: "21 janvier 2025",
    }),
  },
  {
    category: "04 - PORTABILITÉ",
    name: "Complétée",
    subject: "📧 [Preview] Portabilité complétée",
    html: portability.portingCompleted({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      completionDate: "21 janvier 2025",
    }),
  },
  {
    category: "04 - PORTABILITÉ",
    name: "Problème",
    subject: "📧 [Preview] Problème portabilité",
    html: portability.portingIssue({
      ...baseParams,
      clientName: sampleData.clientName,
      phoneNumber: sampleData.phoneNumber,
      issueDescription: "Les informations du compte ne correspondent pas aux données de votre ancien fournisseur.",
      requiredDocuments: ["Copie de votre dernière facture Bell", "Pièce d'identité avec photo"],
    }),
  },

  // ============ BILLING (12) ============
  {
    category: "05 - FACTURATION",
    name: "Facture mensuelle",
    subject: "📧 [Preview] Facture mensuelle",
    html: billing.monthlyInvoice({
      ...baseParams,
      clientName: sampleData.clientName,
      invoiceNumber: sampleData.invoiceNumber,
      invoiceDate: "1er février 2025",
      dueDate: "15 février 2025",
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
    name: "Reçu paiement",
    subject: "📧 [Preview] Reçu de paiement",
    html: billing.paymentReceipt({
      ...baseParams,
      clientName: sampleData.clientName,
      paymentDate: "15 février 2025",
      amount: 51.74,
      paymentMethod: "Carte Visa ****4521",
      invoiceNumber: sampleData.invoiceNumber,
      transactionId: "TRX-2025-789456",
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Prélèvement réussi",
    subject: "📧 [Preview] Prélèvement réussi",
    html: billing.preauthorizedPaymentSuccess({
      ...baseParams,
      clientName: sampleData.clientName,
      paymentDate: "15 février 2025",
      amount: 51.74,
      invoiceNumber: sampleData.invoiceNumber,
      nextPaymentDate: "15 mars 2025",
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Paiement échoué",
    subject: "📧 [Preview] Paiement échoué",
    html: billing.paymentFailed({
      ...baseParams,
      clientName: sampleData.clientName,
      amount: 51.74,
      failureDate: "15 février 2025",
      failureReason: "Fonds insuffisants sur la carte.",
      retryDate: "18 février 2025",
      invoiceNumber: sampleData.invoiceNumber,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Nouvelle tentative",
    subject: "📧 [Preview] Nouvelle tentative",
    html: billing.paymentRetry({
      ...baseParams,
      clientName: sampleData.clientName,
      amount: 51.74,
      retryDate: "18 février 2025",
      invoiceNumber: sampleData.invoiceNumber,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Solde en retard",
    subject: "📧 [Preview] Solde en retard",
    html: billing.overdueBalance({
      ...baseParams,
      clientName: sampleData.clientName,
      overdueAmount: 51.74,
      daysOverdue: 7,
      invoiceNumber: sampleData.invoiceNumber,
      dueDate: "15 février 2025",
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Avis suspension",
    subject: "📧 [Preview] Avis de suspension",
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
    subject: "📧 [Preview] Service suspendu",
    html: billing.serviceSuspended({
      ...baseParams,
      clientName: sampleData.clientName,
      overdueAmount: 51.74,
      suspensionDate: "1er mars 2025",
      servicesAffected: ["Forfait Mobile Essentiel 8GB", "Option appels internationaux"],
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Service rétabli",
    subject: "📧 [Preview] Service rétabli",
    html: billing.serviceRestored({
      ...baseParams,
      clientName: sampleData.clientName,
      paymentAmount: 51.74,
      paymentDate: "2 mars 2025",
      servicesRestored: ["Forfait Mobile Essentiel 8GB", "Option appels internationaux"],
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Crédit appliqué",
    subject: "📧 [Preview] Crédit appliqué",
    html: billing.creditApplied({
      ...baseParams,
      clientName: sampleData.clientName,
      creditAmount: 15.00,
      reason: "Compensation pour interruption de service",
      newBalance: 36.74,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Ajustement facture",
    subject: "📧 [Preview] Ajustement facture",
    html: billing.invoiceAdjustment({
      ...baseParams,
      clientName: sampleData.clientName,
      invoiceNumber: sampleData.invoiceNumber,
      originalAmount: 51.74,
      adjustedAmount: -10.00,
      adjustmentReason: "Correction suite à votre demande - Option internationale retirée",
      newTotal: 41.74,
    }),
  },
  {
    category: "05 - FACTURATION",
    name: "Remboursement",
    subject: "📧 [Preview] Remboursement",
    html: billing.refundProcessed({
      ...baseParams,
      clientName: sampleData.clientName,
      refundAmount: 25.00,
      refundMethod: "Carte Visa ****4521",
      refundReason: "Annulation de service",
      refundDate: "15 mars 2025",
    }),
  },
];

// Handler
const handler = async (req: Request): Promise<Response> => {
  console.log("📧 Send Email Previews - Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetEmail } = await req.json();
    
    if (!targetEmail) {
      throw new Error("targetEmail is required");
    }
    
    console.log(`📧 Sending all email previews to: ${targetEmail}`);
    
    const templates = getTemplates();
    const results: Array<{ name: string; success: boolean; error?: string }> = [];
    let successCount = 0;
    let failCount = 0;
    
    // Send emails with a small delay between each to avoid rate limits
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      
      try {
        console.log(`📧 Sending ${i + 1}/${templates.length}: ${template.category} - ${template.name}`);
        
        const { error } = await resend.emails.send({
          from: "Nivra Télécom <notification@nivratelecom.ca>",
          to: [targetEmail],
          subject: `[${i + 1}/${templates.length}] ${template.category} | ${template.name}`,
          html: template.html,
        });
        
        if (error) {
          console.error(`❌ Failed to send ${template.name}:`, error);
          results.push({ name: `${template.category} - ${template.name}`, success: false, error: error.message });
          failCount++;
        } else {
          console.log(`✅ Sent: ${template.name}`);
          results.push({ name: `${template.category} - ${template.name}`, success: true });
          successCount++;
        }
        
        // Delay to avoid rate limits (600ms between emails = ~1.6 req/sec, under 2/sec limit)
        if (i < templates.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }
        
      } catch (err: any) {
        console.error(`❌ Error sending ${template.name}:`, err);
        results.push({ name: `${template.category} - ${template.name}`, success: false, error: err.message });
        failCount++;
      }
    }
    
    console.log(`📧 Complete! Sent: ${successCount}, Failed: ${failCount}`);
    
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
    
  } catch (error: any) {
    console.error("❌ Error in send-email-previews:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
