/**
 * Shared email template renderer for send-* edge functions.
 * Renders template_key + template_vars into HTML using the same
 * templates as send-template-test, then enqueues to pgmq via ResendProxy.
 */

import { enqueueEmail, type EnqueueResult } from "./ResendProxy.ts";

// ── Inline email layout (same as send-template-test) ──────────────

const emailStyles = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  bgColor: "#f4f4f5",
  cardBg: "#ffffff",
  textPrimary: "#18181b",
  textSecondary: "#52525b",
  textMuted: "#71717a",
  accent: "#0d9488",
  accentLight: "#ccfbf1",
  success: "#059669",
  successBg: "#d1fae5",
  warning: "#d97706",
  warningBg: "#fef3c7",
  error: "#dc2626",
  errorBg: "#fee2e2",
  info: "#0284c7",
  infoBg: "#e0f2fe",
  border: "#e4e4e7",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

const formatDate = (dateStr: string, includeTime = false) => {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (includeTime) return date.toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });
  return date.toLocaleDateString("fr-CA", { dateStyle: "long" });
};

const joinUrl = (baseUrl: string, path: string): string => {
  const base = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${base}/${cleanPath}`;
};

const wrapEmail = (content: string, ctaUrl?: string, ctaText?: string) => {
  const email = "Support@nivra-telecom.ca";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Nivra Telecom</title></head>
<body style="margin:0; padding:0; background-color:${emailStyles.bgColor}; font-family:${emailStyles.fontFamily};">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${emailStyles.bgColor};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px; width:100%;">
<tr><td style="background-color:${emailStyles.cardBg}; border-radius:12px 12px 0 0; padding:0;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
<tr><td style="height:4px; background:linear-gradient(90deg, ${emailStyles.accent}, #14b8a6); border-radius:12px 12px 0 0;"></td></tr>
<tr><td style="padding:28px 32px 20px;"><h1 style="margin:0; font-size:26px; font-weight:700; color:${emailStyles.accent};">Nivra Telecom</h1><p style="margin:4px 0 0; font-size:13px; color:${emailStyles.textMuted};">Votre service, simplifié.</p></td></tr>
</table></td></tr>
<tr><td style="background-color:${emailStyles.cardBg}; padding:0 32px 32px;">${content}</td></tr>
${ctaUrl ? `<tr><td style="background-color:${emailStyles.cardBg}; padding:0 32px 32px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:8px; background-color:${emailStyles.accent};"><a href="${ctaUrl}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">${ctaText || "Ouvrir le portail"}</a></td></tr></table></td></tr></table></td></tr>` : ""}
<tr><td style="background-color:${emailStyles.cardBg}; border-radius:0 0 12px 12px; padding:24px 32px; border-top:1px solid ${emailStyles.border};"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center"><p style="margin:0 0 6px; font-size:13px; font-weight:600; color:${emailStyles.textPrimary};">Nivra Telecom</p><p style="margin:0 0 6px; font-size:12px; color:${emailStyles.textMuted};">Laval, QC, Canada</p><p style="margin:0 0 12px; font-size:13px; color:${emailStyles.textSecondary};"><a href="mailto:${email}" style="color:${emailStyles.accent}; text-decoration:none;">${email}</a></p><p style="margin:0; font-size:11px; color:${emailStyles.textMuted};">Vous recevez cet email suite à une action sur votre compte Nivra Telecom.</p></td></tr></table></td></tr>
</table></td></tr></table></body></html>`;
};

const greeting = (name?: string) => `<p style="margin:0 0 4px; font-size:16px; color:${emailStyles.textPrimary};">Bonjour${name ? ` <strong>${name}</strong>` : ""},</p>`;

const statusBadge = (type: "success" | "warning" | "error" | "info", icon: string, titleFr: string, messageFr: string) => {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    success: { bg: emailStyles.successBg, border: emailStyles.success, text: "#065f46" },
    warning: { bg: emailStyles.warningBg, border: emailStyles.warning, text: "#92400e" },
    error: { bg: emailStyles.errorBg, border: emailStyles.error, text: "#991b1b" },
    info: { bg: emailStyles.infoBg, border: emailStyles.info, text: "#075985" },
  };
  const c = colors[type];
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;"><tr><td style="background-color:${c.bg}; border-left:4px solid ${c.border}; border-radius:0 8px 8px 0; padding:16px 20px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="font-size:18px; font-weight:600; color:${c.text};">${icon} ${titleFr}</td></tr><tr><td style="font-size:14px; color:${c.text}; padding-top:6px;">${messageFr}</td></tr></table></td></tr></table>`;
};

const detailsCard = (items: Array<{ label: string; value: string }>) => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fafafa; border-radius:8px; border:1px solid ${emailStyles.border}; margin:20px 0;">
${items.map((item, idx) => `<tr><td style="padding:14px 16px; ${idx < items.length - 1 ? `border-bottom:1px solid ${emailStyles.border};` : ""}"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="font-size:13px; color:${emailStyles.textMuted}; width:40%;">${item.label}</td><td style="font-size:14px; color:${emailStyles.textPrimary}; font-weight:500; text-align:right;">${item.value}</td></tr></table></td></tr>`).join("")}
</table>`;

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

    // Cancellation
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

    cancellation_confirmed: () => ({
      subject: `Nivra — Annulation confirmée`,
      html: wrapEmail(`
        ${greeting(vars.client_name)}
        ${statusBadge("info", "📋", "Annulation confirmée", "Votre service a été annulé.")}
        ${detailsCard([
          ...(vars.service_name ? [{ label: "Service", value: vars.service_name }] : []),
        ])}
      `, portalUrl, "Voir mon compte"),
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
