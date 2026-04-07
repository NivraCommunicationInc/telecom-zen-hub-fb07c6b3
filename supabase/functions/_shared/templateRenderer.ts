/**
 * Shared email template renderer for send-* edge functions.
 * Uses the ORIGINAL professional corporate blue design from baseStyles/components.
 * Renders template_key + template_vars into HTML, then enqueues to pgmq.
 */

import { enqueueEmail, type EnqueueResult } from "./ResendProxy.ts";
import {
  emailDocument, header, statusBanner, contentWrapper, footer,
  greeting, bodyText, button, helpSection, sectionHeader, infoRow,
  divider, amountBox, alertBox,
  colors, fonts, escapeHtml, formatCurrency, formatDate, formatDateTime
} from "./emailTemplates/components.ts";

const SUPPORT_EMAIL = "Support@nivra-telecom.ca";

const joinUrl = (baseUrl: string, path: string): string => {
  const base = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${base}/${cleanPath}`;
};

// Build a details table using the original style
const detailsTable = (items: Array<{ label: string; value: string }>): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 16px 0;">
    ${items.map(item => infoRow(item.label, item.value)).join("")}
  </table>
`;

// ── Template rendering using ORIGINAL corporate blue design ────────

const BASE_URL = "https://nivra-telecom.ca";

interface TemplateRenderResult {
  subject: string;
  html: string;
}

// Build email using original components (corporate blue #0066CC design)
function buildEmail(
  title: string,
  preheader: string,
  bannerType: "success" | "warning" | "error" | "info",
  bannerIcon: string,
  bannerTitle: string,
  bannerSubtitle: string,
  vars: Record<string, any>,
  details: Array<{ label: string; value: string }>,
  ctaText: string,
  ctaUrl: string,
  extraContent?: string
): string {
  return emailDocument(title, preheader,
    header() +
    statusBanner(bannerType, bannerIcon, bannerTitle, bannerSubtitle) +
    contentWrapper(
      greeting(vars.client_name || "Client") +
      bodyText(bannerSubtitle) +
      detailsTable(details) +
      (extraContent || "") +
      `<div style="text-align: center; margin-top: 24px;">${button(ctaText, ctaUrl)}</div>` +
      helpSection(SUPPORT_EMAIL)
    ) +
    footer(SUPPORT_EMAIL)
  );
}

export function renderTemplate(templateKey: string, vars: Record<string, any>): TemplateRenderResult | null {
  const portalUrl = joinUrl(BASE_URL, vars.portal_path || "/portal");
  const invoicesUrl = joinUrl(BASE_URL, "/portal/invoices");

  const templates: Record<string, () => TemplateRenderResult> = {
    // Installation
    installation_scheduled: () => ({
      subject: `Nivra — Installation planifiée (#${vars.order_number || ""})`,
      html: buildEmail("Installation planifiée", "Votre installation est planifiée", "info", "📅", "Installation planifiée",
        `Votre installation est planifiée${vars.scheduled_date_time ? ` pour le ${vars.scheduled_date_time}` : ""}.`,
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.technician_name ? [{ label: "Technicien", value: vars.technician_name }] : []),
          ...(vars.scheduled_date_time ? [{ label: "Date et heure", value: vars.scheduled_date_time }] : []),
          ...(vars.service_address ? [{ label: "Adresse", value: vars.service_address }] : []),
        ], "Voir ma commande", portalUrl),
    }),

    technician_assigned: () => ({
      subject: `Nivra — Technicien assigné (#${vars.order_number || ""})`,
      html: buildEmail("Technicien assigné", "Un technicien a été assigné", "info", "👷", "Technicien assigné",
        `Un technicien${vars.technician_name ? ` (${vars.technician_name})` : ""} a été assigné à votre installation.`,
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.technician_name ? [{ label: "Technicien", value: vars.technician_name }] : []),
          ...(vars.scheduled_date_time ? [{ label: "Date prévue", value: vars.scheduled_date_time }] : []),
        ], "Voir ma commande", portalUrl),
    }),

    technician_en_route: () => ({
      subject: `Nivra — Technicien en route (#${vars.order_number || ""})`,
      html: buildEmail("Technicien en route", "Votre technicien est en route", "warning", "🚗", "Technicien en route!",
        `${vars.technician_name || "Votre technicien"} est en route vers votre adresse.`,
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.technician_name ? [{ label: "Technicien", value: vars.technician_name }] : []),
          ...(vars.service_address ? [{ label: "Adresse", value: vars.service_address }] : []),
        ], "Suivre ma commande", portalUrl),
    }),

    installation_in_progress: () => ({
      subject: `Nivra — Installation en cours (#${vars.order_number || ""})`,
      html: buildEmail("Installation en cours", "Votre installation est en cours", "info", "🔧", "Installation en cours",
        "Votre installation est actuellement en cours. Veuillez rester disponible.",
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.technician_name ? [{ label: "Technicien", value: vars.technician_name }] : []),
        ], "Voir ma commande", portalUrl),
    }),

    installation_completed: () => ({
      subject: `Nivra — Installation terminée (#${vars.order_number || ""})`,
      html: buildEmail("Installation terminée", "Votre installation est complétée", "success", "✅", "Installation terminée!",
        "Votre installation est complétée avec succès. Votre service est maintenant actif!",
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          { label: "Statut", value: "Complétée" },
        ], "Voir mes services", portalUrl),
    }),

    // Porting
    porting_initiated: () => ({
      subject: `Nivra — Transfert de numéro initié`,
      html: buildEmail("Transfert initié", "Le transfert de votre numéro a été initié", "info", "📱", "Transfert de numéro initié",
        `Le transfert du ${vars.phone_number || "votre numéro"} a été initié.`,
        vars, [
          { label: "Numéro", value: vars.phone_number || "N/A" },
          ...(vars.estimated_date ? [{ label: "Date estimée", value: vars.estimated_date }] : []),
        ], "Suivre le transfert", portalUrl),
    }),

    porting_completed: () => ({
      subject: `Nivra — Transfert de numéro complété!`,
      html: buildEmail("Transfert complété", "Le transfert de votre numéro est complété", "success", "✅", "Transfert complété!",
        `Le transfert du ${vars.phone_number || "votre numéro"} est complété avec succès!`,
        vars, [
          { label: "Numéro", value: vars.phone_number || "N/A" },
          { label: "Statut", value: "Transféré" },
        ], "Voir mon compte", portalUrl),
    }),

    porting_failed: () => ({
      subject: `Nivra — Problème avec le transfert de numéro`,
      html: buildEmail("Problème de transfert", "Le transfert a rencontré un problème", "error", "❌", "Problème de transfert",
        `Le transfert du ${vars.phone_number || "votre numéro"} a rencontré un problème.${vars.failure_reason ? ` Raison: ${vars.failure_reason}` : ""}`,
        vars, [
          { label: "Numéro", value: vars.phone_number || "N/A" },
          ...(vars.failure_reason ? [{ label: "Raison", value: vars.failure_reason }] : []),
        ], "Contacter le support", portalUrl),
    }),

    // Orders
    order_submitted: () => ({
      subject: `Nivra — Commande reçue (#${vars.order_number || ""})`,
      html: buildEmail("Commande reçue", "Votre commande a été soumise", "success", "✅", "Commande reçue!",
        "Votre commande a été soumise avec succès et est en cours de traitement.",
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ], "Voir ma commande", portalUrl),
    }),

    order_processed: () => ({
      subject: `Nivra — Commande en traitement (#${vars.order_number || ""})`,
      html: buildEmail("Commande en traitement", "Votre commande est en traitement", "info", "📦", "Commande en traitement",
        "Votre commande est maintenant en cours de traitement.",
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          { label: "Statut", value: "En traitement" },
        ], "Suivre ma commande", portalUrl),
    }),

    order_shipped: () => ({
      subject: `Nivra — Commande expédiée (#${vars.order_number || ""})`,
      html: buildEmail("Commande expédiée", "Votre commande a été expédiée", "success", "🚚", "Commande expédiée!",
        "Votre commande a été expédiée.",
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.tracking_number ? [{ label: "Nº suivi", value: vars.tracking_number }] : []),
        ], "Voir ma commande", portalUrl),
    }),

    order_completed: () => ({
      subject: `Nivra — Commande terminée (#${vars.order_number || ""})`,
      html: buildEmail("Commande complétée", "Votre commande est complétée", "success", "✅", "Commande complétée!",
        "Votre commande a été complétée avec succès. Merci!",
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          { label: "Statut", value: "Complétée" },
        ], "Voir mes commandes", portalUrl),
    }),

    order_cancelled: () => ({
      subject: `Nivra — Commande annulée (#${vars.order_number || ""})`,
      html: buildEmail("Commande annulée", "Votre commande a été annulée", "error", "❌", "Commande annulée",
        "Votre commande a été annulée.",
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
        ], "Contacter le support", portalUrl),
    }),

    order_confirmation: () => ({
      subject: `Nivra — Confirmation de commande (#${vars.order_number || ""})`,
      html: buildEmail("Commande confirmée", "Votre commande est confirmée", "success", "✅", "Commande confirmée!",
        "Votre commande a été confirmée et sera traitée sous peu.",
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
        ], "Voir ma commande", portalUrl),
    }),

    shipment_created: () => ({
      subject: `Nivra — Expédition créée (#${vars.order_number || ""})`,
      html: buildEmail("Expédition préparée", "L'expédition a été créée", "info", "📦", "Expédition préparée",
        "L'expédition de votre commande a été créée.",
        vars, [
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.tracking_number ? [{ label: "Nº suivi", value: vars.tracking_number }] : []),
        ], "Suivre ma commande", portalUrl),
    }),

    // Billing
    payment_confirmed: () => ({
      subject: `Nivra — Paiement confirmé`,
      html: buildEmail("Paiement confirmé", "Votre paiement a été confirmé", "success", "✅", "Paiement reçu!",
        "Votre paiement a été confirmé. Merci!",
        vars, [
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ], "Voir mes factures", invoicesUrl),
    }),

    payment_receipt: () => ({
      subject: `Nivra — Reçu de paiement`,
      html: buildEmail("Reçu de paiement", "Votre reçu est disponible", "success", "🧾", "Reçu de paiement",
        "Votre reçu de paiement est disponible.",
        vars, [
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.amount ? [{ label: "Montant payé", value: formatCurrency(vars.amount) }] : []),
        ], "Voir mes factures", invoicesUrl),
    }),

    payment_failed: () => ({
      subject: `Nivra — Échec du paiement`,
      html: buildEmail("Paiement échoué", "Votre paiement n'a pas pu être traité", "error", "❌", "Paiement échoué",
        "Votre paiement n'a pas pu être traité.",
        vars, [
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ], "Réessayer le paiement", invoicesUrl),
    }),

    invoice_created: () => ({
      subject: `Nivra — Nouvelle facture (#${vars.invoice_number || ""})`,
      html: buildEmail("Nouvelle facture", "Une nouvelle facture a été générée", "info", "📄", "Nouvelle facture",
        "Une nouvelle facture a été générée.",
        vars, [
          { label: "Nº facture", value: vars.invoice_number || "N/A" },
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ], "Voir ma facture", invoicesUrl),
    }),

    invoice_sent: () => ({
      subject: `Nivra — Facture envoyée (#${vars.invoice_number || ""})`,
      html: buildEmail("Facture envoyée", "Votre facture a été envoyée", "info", "📧", "Facture envoyée",
        "Votre facture a été envoyée.",
        vars, [
          { label: "Nº facture", value: vars.invoice_number || "N/A" },
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ], "Voir ma facture", invoicesUrl),
    }),

    payment_reminder_7days: () => ({
      subject: `Nivra — Rappel de paiement`,
      html: buildEmail("Rappel de paiement", "Votre paiement arrive à échéance", "warning", "⏰", "Rappel de paiement",
        "Votre paiement arrive à échéance dans 7 jours.",
        vars, [
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.amount ? [{ label: "Montant dû", value: formatCurrency(vars.amount) }] : []),
          ...(vars.due_date ? [{ label: "Date d'échéance", value: vars.due_date }] : []),
        ], "Payer maintenant", invoicesUrl),
    }),

    // Contracts
    contract_ready: () => ({
      subject: `Nivra — Contrat prêt à signer`,
      html: buildEmail("Contrat disponible", "Votre contrat est prêt", "info", "📝", "Contrat disponible",
        "Votre contrat est prêt à être signé.",
        vars, [
          ...(vars.contract_number ? [{ label: "Nº contrat", value: vars.contract_number }] : []),
        ], "Voir le contrat", portalUrl),
    }),

    contract_ready_for_signature: () => ({
      subject: `Nivra — Contrat prêt pour signature`,
      html: buildEmail("Signature requise", "Votre contrat attend votre signature", "info", "✍️", "Signature requise",
        "Votre contrat est prêt et attend votre signature.",
        vars, [
          ...(vars.contract_number ? [{ label: "Nº contrat", value: vars.contract_number }] : []),
        ], "Signer le contrat", portalUrl),
    }),

    contract_signed: () => ({
      subject: `Nivra — Contrat signé`,
      html: buildEmail("Contrat signé", "Votre contrat a été signé", "success", "✅", "Contrat signé!",
        "Votre contrat a été signé avec succès.",
        vars, [
          ...(vars.contract_number ? [{ label: "Nº contrat", value: vars.contract_number }] : []),
        ], "Voir mes contrats", portalUrl),
    }),

    // Tickets
    ticket_created: () => ({
      subject: `Nivra — Ticket de support créé`,
      html: buildEmail("Ticket créé", "Votre demande de support a été reçue", "info", "🎫", "Ticket créé",
        "Votre demande de support a été reçue.",
        vars, [
          ...(vars.ticket_number ? [{ label: "Nº ticket", value: vars.ticket_number }] : []),
          ...(vars.subject ? [{ label: "Sujet", value: vars.subject }] : []),
        ], "Voir mon ticket", portalUrl),
    }),

    ticket_status_update: () => ({
      subject: `Nivra — Mise à jour ticket #${vars.ticket_number || ""}`,
      html: buildEmail("Ticket mis à jour", "Votre ticket a été mis à jour", "info", "🔄", "Ticket mis à jour",
        `Votre ticket a été mis à jour : ${vars.status_label || vars.new_status || ""}.`,
        vars, [
          ...(vars.ticket_number ? [{ label: "Nº ticket", value: vars.ticket_number }] : []),
          ...(vars.status_label ? [{ label: "Statut", value: vars.status_label }] : []),
        ], "Voir mon ticket", portalUrl),
    }),

    ticket_resolved: () => ({
      subject: `Nivra — Ticket résolu #${vars.ticket_number || ""}`,
      html: buildEmail("Ticket résolu", "Votre demande a été résolue", "success", "✅", "Ticket résolu",
        "Votre demande de support a été résolue.",
        vars, [
          ...(vars.ticket_number ? [{ label: "Nº ticket", value: vars.ticket_number }] : []),
        ], "Voir mon ticket", portalUrl),
    }),

    // Appointments
    appointment_scheduled: () => ({
      subject: `Nivra — Rendez-vous confirmé`,
      html: buildEmail("Rendez-vous confirmé", "Votre rendez-vous est planifié", "success", "📅", "Rendez-vous confirmé",
        "Votre rendez-vous a été planifié avec succès.",
        vars, [
          ...(vars.scheduled_at ? [{ label: "Date et heure", value: formatDateTime(vars.scheduled_at) }] : []),
          ...(vars.service_address ? [{ label: "Adresse", value: vars.service_address }] : []),
          ...(vars.order_number ? [{ label: "Nº commande", value: vars.order_number }] : []),
        ], "Voir mes rendez-vous", portalUrl),
    }),

    appointment_updated: () => ({
      subject: `Nivra — Rendez-vous modifié`,
      html: buildEmail("Rendez-vous modifié", "Votre rendez-vous a été mis à jour", "warning", "📅", "Rendez-vous modifié",
        "Votre rendez-vous a été mis à jour.",
        vars, [
          ...(vars.scheduled_at ? [{ label: "Nouvelle date", value: formatDateTime(vars.scheduled_at) }] : []),
          ...(vars.service_address ? [{ label: "Adresse", value: vars.service_address }] : []),
        ], "Voir mes rendez-vous", portalUrl),
    }),

    appointment_confirmed: () => ({
      subject: `Nivra — Rendez-vous confirmé`,
      html: buildEmail("Rendez-vous confirmé", "Votre rendez-vous est confirmé", "success", "📅", "Rendez-vous confirmé",
        "Votre rendez-vous a été confirmé.",
        vars, [
          ...(vars.scheduled_at ? [{ label: "Date et heure", value: formatDateTime(vars.scheduled_at) }] : []),
        ], "Voir mes rendez-vous", portalUrl),
    }),

    appointment_cancelled: () => ({
      subject: `Nivra — Rendez-vous annulé`,
      html: buildEmail("Rendez-vous annulé", "Votre rendez-vous a été annulé", "error", "❌", "Rendez-vous annulé",
        "Votre rendez-vous a été annulé.",
        vars, [
          ...(vars.cancellation_reason ? [{ label: "Raison", value: vars.cancellation_reason }] : []),
        ], "Replanifier", portalUrl),
    }),

    // Welcome / Account
    welcome_new_client: () => ({
      subject: `Nivra — Bienvenue chez Nivra Telecom!`,
      html: buildEmail("Bienvenue!", "Bienvenue chez Nivra Telecom", "success", "🎉", "Bienvenue!",
        "Votre compte Nivra Telecom a été créé avec succès.",
        vars, [
          ...(vars.account_number ? [{ label: "Nº client", value: vars.account_number }] : []),
          ...(vars.email ? [{ label: "Email", value: vars.email }] : []),
        ], "Accéder au portail", joinUrl(BASE_URL, "/portal")),
    }),

    // Service status
    service_activated: () => ({
      subject: `Nivra — Service activé`,
      html: buildEmail("Service activé", "Votre service est maintenant actif", "success", "✅", "Service activé!",
        "Votre service est maintenant actif.",
        vars, [
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ], "Voir mes services", portalUrl),
    }),

    service_suspended: () => ({
      subject: `Nivra — Service suspendu`,
      html: buildEmail("Service suspendu", "Votre service a été suspendu", "warning", "⚠️", "Service suspendu",
        "Votre service a été temporairement suspendu.",
        vars, [
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
          ...(vars.reason ? [{ label: "Raison", value: vars.reason }] : []),
        ], "Voir mes services", portalUrl),
    }),

    service_reactivated: () => ({
      subject: `Nivra — Service rétabli`,
      html: buildEmail("Service rétabli", "Votre service a été rétabli", "success", "✅", "Service rétabli",
        "Votre service a été rétabli avec succès.",
        vars, [
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ], "Voir mes services", portalUrl),
    }),

    // Cancellation
    cancellation_received: () => ({
      subject: `Nivra — Demande d'annulation reçue`,
      html: buildEmail("Demande reçue", "Demande d'annulation reçue", "warning", "📋", "Demande reçue",
        "Nous avons bien reçu votre demande d'annulation.",
        vars, [
          ...(vars.request_number ? [{ label: "Nº demande", value: vars.request_number }] : []),
          ...(vars.service_type ? [{ label: "Service", value: vars.service_type }] : []),
        ], "Voir ma demande", portalUrl),
    }),

    cancellation_scheduled: () => ({
      subject: `Nivra — Annulation planifiée`,
      html: buildEmail("Annulation planifiée", "Votre annulation a été planifiée", "info", "📅", "Annulation planifiée",
        "Votre annulation a été planifiée.",
        vars, [
          ...(vars.request_number ? [{ label: "Nº demande", value: vars.request_number }] : []),
          ...(vars.service_type ? [{ label: "Service", value: vars.service_type }] : []),
          ...(vars.effective_date ? [{ label: "Date effective", value: vars.effective_date }] : []),
        ], "Voir ma demande", portalUrl),
    }),

    cancellation_completed: () => ({
      subject: `Nivra — Annulation complétée`,
      html: buildEmail("Annulation confirmée", "Votre service a été annulé", "info", "📋", "Annulation confirmée",
        "Votre service a été annulé.",
        vars, [
          ...(vars.request_number ? [{ label: "Nº demande", value: vars.request_number }] : []),
          ...(vars.service_type ? [{ label: "Service", value: vars.service_type }] : []),
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ], "Voir mon compte", portalUrl),
    }),

    cancellation_declined: () => ({
      subject: `Nivra — Annulation refusée`,
      html: buildEmail("Annulation refusée", "Votre demande d'annulation a été refusée", "error", "❌", "Annulation refusée",
        "Votre demande d'annulation a été refusée.",
        vars, [
          ...(vars.request_number ? [{ label: "Nº demande", value: vars.request_number }] : []),
          ...(vars.service_type ? [{ label: "Service", value: vars.service_type }] : []),
          ...(vars.decline_reason ? [{ label: "Raison", value: vars.decline_reason }] : []),
        ], "Contacter le support", portalUrl,
        vars.public_message ? `<p style="margin:16px 0; font-size:14px; color:${colors.textSecondary};">${vars.public_message}</p>` : undefined),
    }),

    cancellation_requested: () => ({
      subject: `Nivra — Demande d'annulation reçue`,
      html: buildEmail("Demande d'annulation", "Demande d'annulation reçue", "warning", "📋", "Demande d'annulation reçue",
        "Nous avons bien reçu votre demande d'annulation.",
        vars, [
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ], "Voir ma demande", portalUrl),
    }),

    cancellation_confirmed_legacy: () => ({
      subject: `Nivra — Annulation confirmée`,
      html: buildEmail("Annulation confirmée", "Votre service a été annulé", "info", "📋", "Annulation confirmée",
        "Votre service a été annulé.",
        vars, [
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ], "Voir mon compte", portalUrl),
    }),

    // Payment received
    payment_received: () => ({
      subject: `Nivra — Paiement reçu`,
      html: buildEmail("Paiement reçu", "Nous avons reçu votre paiement", "success", "💳", "Paiement reçu",
        "Nous avons bien reçu votre paiement.",
        vars, [
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.payment_method ? [{ label: "Mode de paiement", value: vars.payment_method }] : []),
        ], "Voir mes factures", invoicesUrl),
    }),

    // Invoice overdue
    invoice_overdue: () => ({
      subject: `Nivra — Facture en souffrance (#${vars.invoice_number || ""})`,
      html: buildEmail("Facture en souffrance", "Votre facture est en retard", "error", "⚠️", "Facture en souffrance",
        "Votre facture est en retard de paiement.",
        vars, [
          { label: "Nº facture", value: vars.invoice_number || "N/A" },
          ...(vars.amount ? [{ label: "Montant dû", value: formatCurrency(vars.amount) }] : []),
          ...(vars.due_date ? [{ label: "Date d'échéance", value: vars.due_date }] : []),
          ...(vars.days_overdue ? [{ label: "Jours de retard", value: `${vars.days_overdue} jours` }] : []),
        ], "Payer maintenant", invoicesUrl),
    }),

    // Channel changes
    channels_change_requested: () => ({
      subject: `Nivra — Changement de chaînes confirmé`,
      html: buildEmail("Chaînes mises à jour", "Votre changement de chaînes a été traité", "success", "📺", "Chaînes mises à jour",
        "Votre demande de changement de chaînes a été traitée.",
        vars, [
          ...(vars.order_number ? [{ label: "Nº commande", value: vars.order_number }] : []),
          ...(vars.channels_list ? [{ label: "Chaînes", value: vars.channels_list }] : []),
          ...(vars.total_amount ? [{ label: "Total", value: formatCurrency(vars.total_amount) }] : []),
        ], "Voir mes chaînes", portalUrl),
    }),
  };

  const renderer = templates[templateKey];
  if (!renderer) return null;

  try {
    return renderer();
  } catch (err) {
    console.error(`[renderTemplate] Error rendering ${templateKey}:`, err);
    return null;
  }
}

// ── Queue with template rendering ──────────────────────────────────

export async function queueRenderedEmail(params: {
  eventKey: string;
  templateKey: string;
  toEmail: string;
  templateVars: Record<string, any>;
  fromEmail?: string;
}): Promise<EnqueueResult> {
  const rendered = renderTemplate(params.templateKey, params.templateVars);

  if (!rendered) {
    console.error(`[queueRenderedEmail] Unknown template: ${params.templateKey}`);
    return { success: false, error: `Unknown template: ${params.templateKey}` };
  }

  return enqueueEmail({
    to: params.toEmail,
    templateKey: params.templateKey,
    subject: rendered.subject,
    html: rendered.html,
    fromEmail: params.fromEmail || "Nivra Telecom <noreply@nivra-telecom.ca>",
    eventKey: params.eventKey,
    templateVars: params.templateVars,
  });
}
