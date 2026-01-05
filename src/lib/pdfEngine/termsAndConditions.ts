/**
 * Nivra Document Engine - Terms and Conditions
 * Complete legal clauses for contracts (French)
 */

import { COMPANY_CONTACT } from "@/config/company";
import { CONTRACT_TERMS } from "../contractPolicies";

export const PDF_TERMS = {
  // Interest & Late Fees
  latePayment: {
    title: "Intérêt et frais de retard",
    content: `Des frais de retard de ${CONTRACT_TERMS.nonRenewal.feePercent}% s'appliquent sur toute facture impayée après la date du Bill Cycle. Ces frais sont calculés sur le solde impayé et ajoutés à votre prochaine facture.`,
  },
  
  // Non-renewal at Bill Cycle (prepaid)
  suspension: {
    title: "Non-renouvellement de service (prépayé)",
    content: `En cas de non-paiement au Bill Cycle (J0), le service n'est pas renouvelé et devient Expiré. La facture est émise ${CONTRACT_TERMS.billingCycle.invoiceGeneratedDaysBefore} jours avant le Bill Cycle. Pour les e-Transfers en vérification au J0, une fenêtre de grâce de ${CONTRACT_TERMS.billingCycle.etransferGraceHours} heures maximum est accordée.`,
  },
  
  // Reactivation fees
  reactivation: {
    title: "Frais de réactivation",
    content: `Des frais de réactivation de ${CONTRACT_TERMS.nonRenewal.reactivationFee}$ s'appliquent pour rétablir un service expiré (non-renouvelé). Le paiement intégral du solde dû est requis avant la réactivation.`,
  },
  
  // Appointment cancellation policy
  appointmentCancellation: {
    title: "Politique d'annulation de rendez-vous",
    content: `Toute annulation de rendez-vous doit être effectuée au moins 24 heures à l'avance. Les annulations tardives ou absences sans préavis peuvent entraîner des frais de déplacement de 50$. Pour modifier un rendez-vous, contactez-nous via le portail client ou par téléphone.`,
  },
  
  // Equipment warranty
  warranty: {
    title: "Garantie équipement",
    content: `Tous les équipements Nivra (routeur, terminal 4K) sont couverts par une garantie manufacturier d'un (1) an à compter de la date d'activation. La garantie couvre les défauts de fabrication uniquement. Fenêtre d'échange DOA : ${CONTRACT_TERMS.warranty.doaDays} jours. Exclusions : dommages causés par le client, perte, vol, dommages liquides, modifications non autorisées.`,
  },
  
  // Identity validation
  identityValidation: {
    title: "Validation d'identité",
    content: `Une (1) pièce d'identité valide avec photo est requise pour valider toute commande. Les documents acceptés incluent : permis de conduire, passeport, carte d'assurance maladie du Québec (avec restrictions). La vérification peut être effectuée en ligne via le portail client sécurisé.`,
  },
  
  // Privacy and data protection
  privacy: {
    title: "Protection des renseignements personnels",
    content: `Nivra Communications Inc. s'engage à protéger vos renseignements personnels conformément aux lois canadiennes et québécoises en vigueur (PIPEDA, Loi 25). Vos données sont utilisées uniquement pour fournir et améliorer nos services. L'accès au portail client est contrôlé par rôles avec authentification sécurisée.`,
  },
  
  // No credit check
  noCreditCheck: {
    title: "Aucune vérification de crédit",
    content: `Nivra Communications n'effectue aucune vérification de crédit. Vos services sont accessibles sans impact sur votre dossier de crédit. Cette politique est idéale pour les étudiants, nouveaux arrivants, ou personnes avec un crédit limité. L'accès est basé sur une pré-autorisation de paiement ou un dépôt de garantie.`,
  },
  
  // French language policy
  frenchLanguage: {
    title: "Politique de langue française",
    content: `Tous les contrats, factures et communications sont disponibles en français. Le service à la clientèle est offert en français et en anglais. Les termes et conditions prévalent en français en cas de divergence avec une version anglaise.`,
  },
  
  // Confidentiality and terms of use
  confidentiality: {
    title: "Confidentialité et conditions d'utilisation",
    content: `Le client s'engage à ne pas partager ses identifiants d'accès au portail. Toute utilisation abusive ou frauduleuse peut entraîner la suspension immédiate des services. Les conditions d'utilisation complètes sont disponibles sur ${COMPANY_CONTACT.website}.`,
  },
  
  // Refund policy
  refund: {
    title: "Politique de remboursement",
    content: `Les remboursements approuvés sont traités dans un délai de 3 à 5 jours ouvrables après confirmation. Les services prépayés non utilisés peuvent être remboursés selon les conditions applicables. Les frais d'équipement non retourné ne sont pas remboursables.`,
  },
  
  // Security warning
  security: {
    title: "Avertissement de sécurité",
    content: `Nivra ne vous demandera JAMAIS votre numéro d'assurance sociale (NAS) ou vos informations de carte de crédit complètes par courriel ou téléphone. Utilisez uniquement les canaux sécurisés : portail client ou paiement en magasin. Signalez toute tentative suspecte à ${COMPANY_CONTACT.supportEmailDisplay}.`,
  },
  
  // Streaming+ terms
  streamingPlus: {
    title: "Services Streaming+",
    content: `Les abonnements Streaming+ (Netflix, Amazon Prime, Disney+, etc.) sont facturés mensuellement et restent actifs jusqu'à annulation. L'annulation prend effet à la fin de la période de facturation en cours. Les modifications de services peuvent être effectuées via le portail client.`,
  },
  
  // Security PIN
  securityPin: {
    title: "NIP de sécurité",
    content: `Un NIP de sécurité à 4 chiffres est obligatoire pour accéder à votre compte et autoriser les modifications. Vous pouvez désigner un « Autre utilisateur autorisé » dans votre portail client. Ne partagez jamais votre NIP par courriel ou messagerie non sécurisée.`,
  },
  
  // Portal access restrictions
  portalAccess: {
    title: "Accès au portail client",
    content: `L'accès au portail client peut être restreint ou bloqué en cas d'abus, tentative de fraude, ou pour des raisons de sécurité. Nivra se réserve le droit de suspendre l'accès sans préavis en cas de comportement suspect.`,
  },
  
  // Prepaid billing
  prepaidBilling: {
    title: "Services prépayés (Bill Cycle)",
    content: `Les services sont facturés à l'avance par cycle de service. La facture est émise ${CONTRACT_TERMS.billingCycle.invoiceGeneratedDaysBefore} jours avant le Bill Cycle. Le paiement doit être confirmé AVANT le Bill Cycle (J0) pour renouveler le service. Si non payé au J0, le service devient Expiré.`,
  },
  
  // Jurisdiction
  jurisdiction: {
    title: "Juridiction",
    content: `Ce contrat est régi par les lois du Québec et les lois applicables du Canada. Tout litige sera soumis à la juridiction exclusive des tribunaux du Québec.`,
  },
};

// Get all terms as an array for easy iteration
export const getAllTerms = (): Array<{ title: string; content: string }> => {
  return Object.values(PDF_TERMS);
};

// Get essential terms only (shorter list for compact view)
export const getEssentialTerms = (): Array<{ title: string; content: string }> => {
  return [
    PDF_TERMS.prepaidBilling,
    PDF_TERMS.latePayment,
    PDF_TERMS.suspension,
    PDF_TERMS.reactivation,
    PDF_TERMS.warranty,
    PDF_TERMS.noCreditCheck,
    PDF_TERMS.identityValidation,
    PDF_TERMS.securityPin,
    PDF_TERMS.privacy,
    PDF_TERMS.security,
    PDF_TERMS.jurisdiction,
  ];
};
