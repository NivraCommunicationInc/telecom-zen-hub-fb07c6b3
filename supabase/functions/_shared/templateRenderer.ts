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

// ── Template rendering ─────────────────────────────────────────────

const BASE_URL = "https://nivra-telecom.ca";

interface TemplateRenderResult {
  subject: string;
  html: string;
}

export function renderTemplate(templateKey: string, vars: Record<string, any>): TemplateRenderResult | null {
  const portalUrl = joinUrl(BASE_URL, vars.portal_path || "/portal");

  const templates: Record<string, () => TemplateRenderResult> = {
    // Installation
    installation_scheduled: () => ({
      subject: `Nivra — Installation planifiée (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📅", "Installation planifiée", `Votre installation est planifiée${vars.scheduled_date_time ? ` pour le ${vars.scheduled_date_time}` : ""}.`)}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.technician_name ? [{ label: "Technicien", value: vars.technician_name }] : []),
          ...(vars.scheduled_date_time ? [{ label: "Date et heure", value: vars.scheduled_date_time }] : []),
          ...(vars.service_address ? [{ label: "Adresse", value: vars.service_address }] : []),
        ])}
      `, portalUrl, "Voir ma commande"),
    }),

    technician_assigned: () => ({
      subject: `Nivra — Technicien assigné (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "👷", "Technicien assigné", `Un technicien${vars.technician_name ? ` (${vars.technician_name})` : ""} a été assigné à votre installation.`)}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.technician_name ? [{ label: "Technicien", value: vars.technician_name }] : []),
          ...(vars.scheduled_date_time ? [{ label: "Date prévue", value: vars.scheduled_date_time }] : []),
        ])}
      `, portalUrl, "Voir ma commande"),
    }),

    technician_en_route: () => ({
      subject: `Nivra — Technicien en route (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("warning", "🚗", "Technicien en route!", `${vars.technician_name || "Votre technicien"} est en route vers votre adresse.`)}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.technician_name ? [{ label: "Technicien", value: vars.technician_name }] : []),
          ...(vars.service_address ? [{ label: "Adresse", value: vars.service_address }] : []),
        ])}
      `, portalUrl, "Suivre ma commande"),
    }),

    installation_in_progress: () => ({
      subject: `Nivra — Installation en cours (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "🔧", "Installation en cours", "Votre installation est actuellement en cours. Veuillez rester disponible.")}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.technician_name ? [{ label: "Technicien", value: vars.technician_name }] : []),
        ])}
      `, portalUrl, "Voir ma commande"),
    }),

    installation_completed: () => ({
      subject: `Nivra — Installation terminée (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Installation terminée!", "Votre installation est complétée avec succès. Votre service est maintenant actif!")}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          { label: "Statut", value: "✅ Complétée" },
        ])}
      `, portalUrl, "Voir mes services"),
    }),

    // Porting
    porting_initiated: () => ({
      subject: `Nivra — Transfert de numéro initié`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📱", "Transfert de numéro initié", `Le transfert du ${vars.phone_number || "votre numéro"} a été initié.`)}
        ${detailsCard([
          { label: "Numéro", value: vars.phone_number || "N/A" },
          ...(vars.estimated_date ? [{ label: "Date estimée", value: vars.estimated_date }] : []),
        ])}
      `, portalUrl, "Suivre le transfert"),
    }),

    porting_completed: () => ({
      subject: `Nivra — Transfert de numéro complété!`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Transfert complété!", `Le transfert du ${vars.phone_number || "votre numéro"} est complété avec succès!`)}
        ${detailsCard([
          { label: "Numéro", value: vars.phone_number || "N/A" },
          { label: "Statut", value: "✅ Transféré" },
        ])}
      `, portalUrl, "Voir mon compte"),
    }),

    porting_failed: () => ({
      subject: `Nivra — Problème avec le transfert de numéro`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("error", "❌", "Problème de transfert", `Le transfert du ${vars.phone_number || "votre numéro"} a rencontré un problème.${vars.failure_reason ? ` Raison: ${vars.failure_reason}` : ""}`)}
        ${detailsCard([
          { label: "Numéro", value: vars.phone_number || "N/A" },
          ...(vars.failure_reason ? [{ label: "Raison", value: vars.failure_reason }] : []),
        ])}
      `, portalUrl, "Contacter le support"),
    }),

    // Orders
    order_submitted: () => ({
      subject: `Nivra — Commande reçue (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Commande reçue!", "Votre commande a été soumise avec succès et est en cours de traitement.")}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ])}
      `, portalUrl, "Voir ma commande"),
    }),

    order_processed: () => ({
      subject: `Nivra — Commande en traitement (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📦", "Commande en traitement", "Votre commande est maintenant en cours de traitement.")}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          { label: "Statut", value: "En traitement" },
        ])}
      `, portalUrl, "Suivre ma commande"),
    }),

    order_shipped: () => ({
      subject: `Nivra — Commande expédiée (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "🚚", "Commande expédiée!", "Votre commande a été expédiée.")}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.tracking_number ? [{ label: "Nº suivi", value: vars.tracking_number }] : []),
        ])}
      `, portalUrl, "Voir ma commande"),
    }),

    order_completed: () => ({
      subject: `Nivra — Commande terminée (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Commande complétée!", "Votre commande a été complétée avec succès. Merci!")}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          { label: "Statut", value: "Complétée" },
        ])}
      `, portalUrl, "Voir mes commandes"),
    }),

    order_cancelled: () => ({
      subject: `Nivra — Commande annulée (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("error", "❌", "Commande annulée", "Votre commande a été annulée.")}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
        ])}
      `, portalUrl, "Contacter le support"),
    }),

    order_confirmation: () => ({
      subject: `Nivra — Confirmation de commande (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Commande confirmée!", "Votre commande a été confirmée et sera traitée sous peu.")}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
        ])}
      `, portalUrl, "Voir ma commande"),
    }),

    shipment_created: () => ({
      subject: `Nivra — Expédition créée (#${vars.order_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📦", "Expédition préparée", "L'expédition de votre commande a été créée.")}
        ${detailsCard([
          { label: "Nº commande", value: vars.order_number || "N/A" },
          ...(vars.tracking_number ? [{ label: "Nº suivi", value: vars.tracking_number }] : []),
        ])}
      `, portalUrl, "Suivre ma commande"),
    }),

    // Billing
    payment_confirmed: () => ({
      subject: `Nivra — Paiement confirmé`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Paiement reçu!", "Votre paiement a été confirmé. Merci!")}
        ${detailsCard([
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ])}
      `, joinUrl(BASE_URL, "/portal/invoices"), "Voir mes factures"),
    }),

    payment_receipt: () => ({
      subject: `Nivra — Reçu de paiement`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "🧾", "Reçu de paiement", "Votre reçu de paiement est disponible.")}
        ${detailsCard([
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.amount ? [{ label: "Montant payé", value: formatCurrency(vars.amount) }] : []),
        ])}
      `, joinUrl(BASE_URL, "/portal/invoices"), "Voir mes factures"),
    }),

    payment_failed: () => ({
      subject: `Nivra — Échec du paiement`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("error", "❌", "Paiement échoué", "Votre paiement n'a pas pu être traité.")}
        ${detailsCard([
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ])}
      `, joinUrl(BASE_URL, "/portal/invoices"), "Réessayer le paiement"),
    }),

    invoice_created: () => ({
      subject: `Nivra — Nouvelle facture (#${vars.invoice_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📄", "Nouvelle facture", "Une nouvelle facture a été générée.")}
        ${detailsCard([
          { label: "Nº facture", value: vars.invoice_number || "N/A" },
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ])}
      `, joinUrl(BASE_URL, "/portal/invoices"), "Voir ma facture"),
    }),

    invoice_sent: () => ({
      subject: `Nivra — Facture envoyée (#${vars.invoice_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📧", "Facture envoyée", "Votre facture a été envoyée.")}
        ${detailsCard([
          { label: "Nº facture", value: vars.invoice_number || "N/A" },
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
        ])}
      `, joinUrl(BASE_URL, "/portal/invoices"), "Voir ma facture"),
    }),

    payment_reminder_7days: () => ({
      subject: `Nivra — Rappel de paiement`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("warning", "⏰", "Rappel de paiement", "Votre paiement arrive à échéance dans 7 jours.")}
        ${detailsCard([
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.amount ? [{ label: "Montant dû", value: formatCurrency(vars.amount) }] : []),
          ...(vars.due_date ? [{ label: "Date d'échéance", value: vars.due_date }] : []),
        ])}
      `, joinUrl(BASE_URL, "/portal/invoices"), "Payer maintenant"),
    }),

    // Contracts
    contract_ready: () => ({
      subject: `Nivra — Contrat prêt à signer`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📝", "Contrat disponible", "Votre contrat est prêt à être signé.")}
        ${detailsCard([
          ...(vars.contract_number ? [{ label: "Nº contrat", value: vars.contract_number }] : []),
        ])}
      `, portalUrl, "Voir le contrat"),
    }),

    contract_ready_for_signature: () => ({
      subject: `Nivra — Contrat prêt pour signature`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "✍️", "Signature requise", "Votre contrat est prêt et attend votre signature.")}
        ${detailsCard([
          ...(vars.contract_number ? [{ label: "Nº contrat", value: vars.contract_number }] : []),
        ])}
      `, portalUrl, "Signer le contrat"),
    }),

    contract_signed: () => ({
      subject: `Nivra — Contrat signé`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Contrat signé!", "Votre contrat a été signé avec succès.")}
        ${detailsCard([
          ...(vars.contract_number ? [{ label: "Nº contrat", value: vars.contract_number }] : []),
        ])}
      `, portalUrl, "Voir mes contrats"),
    }),

    // Tickets
    ticket_created: () => ({
      subject: `Nivra — Ticket de support créé`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "🎫", "Ticket créé", "Votre demande de support a été reçue.")}
        ${detailsCard([
          ...(vars.ticket_number ? [{ label: "Nº ticket", value: vars.ticket_number }] : []),
          ...(vars.subject ? [{ label: "Sujet", value: vars.subject }] : []),
        ])}
      `, portalUrl, "Voir mon ticket"),
    }),

    ticket_status_update: () => ({
      subject: `Nivra — Mise à jour ticket #${vars.ticket_number || ""}`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "🔄", "Ticket mis à jour", `Votre ticket a été mis à jour : ${vars.status_label || vars.new_status || ""}.`)}
        ${detailsCard([
          ...(vars.ticket_number ? [{ label: "Nº ticket", value: vars.ticket_number }] : []),
          ...(vars.status_label ? [{ label: "Statut", value: vars.status_label }] : []),
        ])}
      `, portalUrl, "Voir mon ticket"),
    }),

    ticket_resolved: () => ({
      subject: `Nivra — Ticket résolu #${vars.ticket_number || ""}`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Ticket résolu", "Votre demande de support a été résolue.")}
        ${detailsCard([
          ...(vars.ticket_number ? [{ label: "Nº ticket", value: vars.ticket_number }] : []),
        ])}
      `, portalUrl, "Voir mon ticket"),
    }),

    // Appointments
    appointment_scheduled: () => ({
      subject: `Nivra — Rendez-vous confirmé`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "📅", "Rendez-vous confirmé", "Votre rendez-vous a été planifié avec succès.")}
        ${detailsCard([
          ...(vars.scheduled_at ? [{ label: "Date et heure", value: formatDate(vars.scheduled_at, true) }] : []),
          ...(vars.service_address ? [{ label: "Adresse", value: vars.service_address }] : []),
          ...(vars.order_number ? [{ label: "Nº commande", value: vars.order_number }] : []),
        ])}
      `, portalUrl, "Voir mes rendez-vous"),
    }),

    appointment_updated: () => ({
      subject: `Nivra — Rendez-vous modifié`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("warning", "📅", "Rendez-vous modifié", "Votre rendez-vous a été mis à jour.")}
        ${detailsCard([
          ...(vars.scheduled_at ? [{ label: "Nouvelle date", value: formatDate(vars.scheduled_at, true) }] : []),
          ...(vars.service_address ? [{ label: "Adresse", value: vars.service_address }] : []),
        ])}
      `, portalUrl, "Voir mes rendez-vous"),
    }),

    appointment_confirmed: () => ({
      subject: `Nivra — Rendez-vous confirmé`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "📅", "Rendez-vous confirmé", "Votre rendez-vous a été confirmé.")}
        ${detailsCard([
          ...(vars.scheduled_at ? [{ label: "Date et heure", value: formatDate(vars.scheduled_at, true) }] : []),
        ])}
      `, portalUrl, "Voir mes rendez-vous"),
    }),

    appointment_cancelled: () => ({
      subject: `Nivra — Rendez-vous annulé`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("error", "❌", "Rendez-vous annulé", "Votre rendez-vous a été annulé.")}
        ${detailsCard([
          ...(vars.cancellation_reason ? [{ label: "Raison", value: vars.cancellation_reason }] : []),
        ])}
      `, portalUrl, "Replanifier"),
    }),

    // Welcome / Account
    welcome_new_client: () => ({
      subject: `Nivra — Bienvenue chez Nivra Telecom!`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "🎉", "Bienvenue!", "Votre compte Nivra Telecom a été créé avec succès.")}
        ${detailsCard([
          ...(vars.account_number ? [{ label: "Nº client", value: vars.account_number }] : []),
          ...(vars.email ? [{ label: "Email", value: vars.email }] : []),
        ])}
      `, joinUrl(BASE_URL, "/portal"), "Accéder au portail"),
    }),

    // Service status
    service_activated: () => ({
      subject: `Nivra — Service activé`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Service activé!", "Votre service est maintenant actif.")}
        ${detailsCard([
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ])}
      `, portalUrl, "Voir mes services"),
    }),

    service_suspended: () => ({
      subject: `Nivra — Service suspendu`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("warning", "⚠️", "Service suspendu", "Votre service a été temporairement suspendu.")}
        ${detailsCard([
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
          ...(vars.reason ? [{ label: "Raison", value: vars.reason }] : []),
        ])}
      `, portalUrl, "Voir mes services"),
    }),

    service_reactivated: () => ({
      subject: `Nivra — Service rétabli`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "✅", "Service rétabli", "Votre service a été rétabli avec succès.")}
        ${detailsCard([
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ])}
      `, portalUrl, "Voir mes services"),
    }),

    // Cancellation
    cancellation_received: () => ({
      subject: `Nivra — Demande d'annulation reçue`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("warning", "📋", "Demande reçue", "Nous avons bien reçu votre demande d'annulation.")}
        ${detailsCard([
          ...(vars.request_number ? [{ label: "Nº demande", value: vars.request_number }] : []),
          ...(vars.service_type ? [{ label: "Service", value: vars.service_type }] : []),
        ])}
      `, portalUrl, "Voir ma demande"),
    }),

    cancellation_scheduled: () => ({
      subject: `Nivra — Annulation planifiée`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📅", "Annulation planifiée", "Votre annulation a été planifiée.")}
        ${detailsCard([
          ...(vars.request_number ? [{ label: "Nº demande", value: vars.request_number }] : []),
          ...(vars.service_type ? [{ label: "Service", value: vars.service_type }] : []),
          ...(vars.effective_date ? [{ label: "Date effective", value: vars.effective_date }] : []),
        ])}
      `, portalUrl, "Voir ma demande"),
    }),

    cancellation_completed: () => ({
      subject: `Nivra — Annulation complétée`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📋", "Annulation confirmée", "Votre service a été annulé.")}
        ${detailsCard([
          ...(vars.request_number ? [{ label: "Nº demande", value: vars.request_number }] : []),
          ...(vars.service_type ? [{ label: "Service", value: vars.service_type }] : []),
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ])}
      `, portalUrl, "Voir mon compte"),
    }),

    cancellation_declined: () => ({
      subject: `Nivra — Annulation refusée`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("error", "❌", "Annulation refusée", "Votre demande d'annulation a été refusée.")}
        ${detailsCard([
          ...(vars.request_number ? [{ label: "Nº demande", value: vars.request_number }] : []),
          ...(vars.service_type ? [{ label: "Service", value: vars.service_type }] : []),
          ...(vars.decline_reason ? [{ label: "Raison", value: vars.decline_reason }] : []),
        ])}
        ${vars.public_message ? `<p style="margin:16px 0; font-size:14px; color:${emailStyles.textSecondary};">${vars.public_message}</p>` : ""}
      `, portalUrl, "Contacter le support"),
    }),

    cancellation_requested: () => ({
      subject: `Nivra — Demande d'annulation reçue`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("warning", "📋", "Demande d'annulation reçue", "Nous avons bien reçu votre demande d'annulation.")}
        ${detailsCard([
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ])}
      `, portalUrl, "Voir ma demande"),
    }),

    cancellation_confirmed_legacy: () => ({
      subject: `Nivra — Annulation confirmée`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📋", "Annulation confirmée", "Votre service a été annulé.")}
        ${detailsCard([
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ])}
      `, portalUrl, "Voir mon compte"),
    }),

    // Payment received
    payment_received: () => ({
      subject: `Nivra — Paiement reçu`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "💳", "Paiement reçu", "Nous avons bien reçu votre paiement.")}
        ${detailsCard([
          ...(vars.amount ? [{ label: "Montant", value: formatCurrency(vars.amount) }] : []),
          ...(vars.invoice_number ? [{ label: "Nº facture", value: vars.invoice_number }] : []),
          ...(vars.payment_method ? [{ label: "Mode de paiement", value: vars.payment_method }] : []),
        ])}
      `, joinUrl(BASE_URL, "/portal/invoices"), "Voir mes factures"),
    }),

    // Invoice overdue
    invoice_overdue: () => ({
      subject: `Nivra — Facture en souffrance (#${vars.invoice_number || ""})`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("error", "⚠️", "Facture en souffrance", "Votre facture est en retard de paiement.")}
        ${detailsCard([
          { label: "Nº facture", value: vars.invoice_number || "N/A" },
          ...(vars.amount ? [{ label: "Montant dû", value: formatCurrency(vars.amount) }] : []),
          ...(vars.due_date ? [{ label: "Date d'échéance", value: vars.due_date }] : []),
          ...(vars.days_overdue ? [{ label: "Jours de retard", value: `${vars.days_overdue} jours` }] : []),
        ])}
      `, joinUrl(BASE_URL, "/portal/invoices"), "Payer maintenant"),
    }),

    // Channel changes
    channels_change_requested: () => ({
      subject: `Nivra — Changement de chaînes confirmé`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("success", "📺", "Chaînes mises à jour", "Votre demande de changement de chaînes a été traitée.")}
        ${detailsCard([
          ...(vars.order_number ? [{ label: "Nº commande", value: vars.order_number }] : []),
          ...(vars.channels_list ? [{ label: "Chaînes", value: vars.channels_list }] : []),
          ...(vars.total_amount ? [{ label: "Total", value: formatCurrency(vars.total_amount) }] : []),
        ])}
      `, portalUrl, "Voir mes chaînes"),
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
