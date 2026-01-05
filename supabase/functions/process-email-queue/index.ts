import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface EmailQueueItem {
  id: string;
  event_key: string;
  to_email: string;
  template_key: string;
  template_vars: Record<string, any>;
  status: string;
  attempts: number;
  max_attempts: number;
}

// =============================================
// SHARED EMAIL LAYOUT COMPONENTS
// =============================================

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
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(amount || 0);

const formatDate = (dateStr: string, includeTime = false) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (includeTime) {
    return date.toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' });
  }
  return date.toLocaleDateString('fr-CA', { dateStyle: 'long' });
};

// URL joining helper - guarantees exactly one slash between base and path
const joinUrl = (baseUrl: string, path: string): string => {
  const base = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
  const cleanPath = path.replace(/^\/+/, ''); // Remove leading slashes
  const result = `${base}/${cleanPath}`;
  
  // Validation: check for common URL joining errors
  if (result.includes('.appclient') || result.includes('.caclient') || result.includes('.app/client') === false && result.includes('.app') && result.includes('client')) {
    console.error(`[URL ERROR] Invalid URL detected: ${result}`);
  }
  
  return result;
};

// Professional email wrapper with header and footer
const wrapEmail = (content: string, ctaUrl?: string, ctaText?: string, supportEmail?: string, supportPhone?: string) => {
  const email = supportEmail || "Support@nivratelecom.ca";
  const phone = supportPhone || "438-544-2233";
  const phoneDigits = phone.replace(/[^0-9]/g, '');
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Nivra Telecom</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:${emailStyles.bgColor}; font-family:${emailStyles.fontFamily};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${emailStyles.bgColor};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px; width:100%;">
          
          <!-- HEADER -->
          <tr>
            <td style="background-color:${emailStyles.cardBg}; border-radius:12px 12px 0 0; padding:0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="height:4px; background:linear-gradient(90deg, ${emailStyles.accent}, #14b8a6); border-radius:12px 12px 0 0;"></td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td>
                          <h1 style="margin:0; font-size:26px; font-weight:700; color:${emailStyles.accent}; letter-spacing:-0.5px;">Nivra Telecom</h1>
                          <p style="margin:4px 0 0; font-size:13px; color:${emailStyles.textMuted};">Votre service, simplifié.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- MAIN CONTENT -->
          <tr>
            <td style="background-color:${emailStyles.cardBg}; padding:0 32px 32px;">
              ${content}
            </td>
          </tr>
          
          <!-- CTA BUTTON -->
          ${ctaUrl ? `
          <tr>
            <td style="background-color:${emailStyles.cardBg}; padding:0 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius:8px; background-color:${emailStyles.accent};">
                          <a href="${ctaUrl}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                            ${ctaText || "Ouvrir le portail"}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:12px;">
                    <p style="margin:0; font-size:12px; color:${emailStyles.textMuted};">
                      <a href="${ctaUrl}" style="color:${emailStyles.textMuted}; text-decoration:underline;">${ctaUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- FOOTER -->
          <tr>
            <td style="background-color:${emailStyles.cardBg}; border-radius:0 0 12px 12px; padding:24px 32px; border-top:1px solid ${emailStyles.border};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 6px; font-size:13px; font-weight:600; color:${emailStyles.textPrimary};">
                      Nivra Telecom
                    </p>
                    <p style="margin:0 0 6px; font-size:12px; color:${emailStyles.textMuted};">
                      Laval, QC, Canada
                    </p>
                    <p style="margin:0 0 12px; font-size:13px; color:${emailStyles.textSecondary};">
                      <a href="mailto:${email}" style="color:${emailStyles.accent}; text-decoration:none;">${email}</a> 
                      &nbsp;|&nbsp; 
                      <a href="tel:${phoneDigits}" style="color:${emailStyles.accent}; text-decoration:none;">${phone}</a>
                    </p>
                    <p style="margin:0; font-size:11px; color:${emailStyles.textMuted};">
                      Vous recevez cet email suite à une action sur votre compte Nivra Telecom.<br>
                      <em>You are receiving this email because of an action on your Nivra Telecom account.</em>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Reusable details card component
const detailsCard = (items: Array<{ label: string; value: string }>) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fafafa; border-radius:8px; border:1px solid ${emailStyles.border}; margin:20px 0;">
    ${items.map((item, idx) => `
      <tr>
        <td style="padding:14px 16px; ${idx < items.length - 1 ? `border-bottom:1px solid ${emailStyles.border};` : ''}">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size:13px; color:${emailStyles.textMuted}; width:40%;">${item.label}</td>
              <td style="font-size:14px; color:${emailStyles.textPrimary}; font-weight:500; text-align:right;">${item.value}</td>
            </tr>
          </table>
        </td>
      </tr>
    `).join('')}
  </table>`;

// Status badge component
const statusBadge = (type: 'success' | 'warning' | 'error' | 'info', icon: string, titleFr: string, titleEn: string, messageFr: string, messageEn: string) => {
  const colors = {
    success: { bg: emailStyles.successBg, border: emailStyles.success, text: '#065f46' },
    warning: { bg: emailStyles.warningBg, border: emailStyles.warning, text: '#92400e' },
    error: { bg: emailStyles.errorBg, border: emailStyles.error, text: '#991b1b' },
    info: { bg: emailStyles.infoBg, border: emailStyles.info, text: '#075985' },
  };
  const c = colors[type];
  
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
      <tr>
        <td style="background-color:${c.bg}; border-left:4px solid ${c.border}; border-radius:0 8px 8px 0; padding:16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size:18px; font-weight:600; color:${c.text};">
                ${icon} ${titleFr}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px; color:${c.text}; padding-top:6px;">
                ${messageFr}
              </td>
            </tr>
            <tr>
              <td style="font-size:13px; color:${c.text}; opacity:0.8; padding-top:8px; font-style:italic;">
                ${messageEn}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
};

// Greeting component
const greeting = (name?: string) => `
  <p style="margin:0 0 4px; font-size:16px; color:${emailStyles.textPrimary};">
    Bonjour${name ? ` <strong>${name}</strong>` : ''}, <span style="color:${emailStyles.textMuted}; font-size:14px;">/ Hello${name ? ` ${name}` : ''},</span>
  </p>`;

// =============================================
// EMAIL TEMPLATES
// =============================================

interface EmailConfig {
  baseUrl: string;
  supportEmail: string;
  supportPhone: string;
}

const emailTemplates: Record<string, { subject: string; getHtml: (vars: Record<string, any>, config: EmailConfig) => string }> = {
  
  // TEST EMAIL
  test_email: {
    subject: "Nivra — Test du système de courriel",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting()}
      ${statusBadge('success', '✅', 'Système fonctionnel', 'System working', 
        'Le système d\'envoi de courriels Nivra fonctionne correctement.',
        'The Nivra email system is working correctly.'
      )}
      ${detailsCard([
        { label: 'Destinataire / Recipient', value: vars.to_email || 'N/A' },
        { label: 'Envoyé le / Sent at', value: formatDate(new Date().toISOString(), true) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Ceci est un email de test à des fins de vérification interne.<br>
        <em style="color:${emailStyles.textMuted};">This is a test email for internal verification purposes.</em>
      </p>
    `, joinUrl(config.baseUrl, "/admin/email-activity"), "Voir l'activité / View activity", config.supportEmail, config.supportPhone),
  },

  // ACCOUNT CREATED
  account_created: {
    subject: "Nivra — Bienvenue chez Nivra Telecom!",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '🎉', 'Compte créé avec succès!', 'Account created successfully!',
        'Votre compte Nivra Telecom a été créé. Vous pouvez maintenant accéder à votre portail client.',
        'Your Nivra Telecom account has been created. You can now access your client portal.'
      )}
      ${detailsCard([
        { label: 'Numéro client / Client #', value: vars.client_number || 'À venir' },
        { label: 'Email', value: vars.email || vars.client_email || 'N/A' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Accédez à votre portail pour gérer vos services, factures et plus encore.<br>
        <em style="color:${emailStyles.textMuted};">Access your portal to manage your services, invoices and more.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal"), "Accéder au portail / Access portal", config.supportEmail, config.supportPhone),
  },

  // EMAIL VERIFIED
  email_verified: {
    subject: "Nivra — Email vérifié",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Email vérifié!', 'Email verified!',
        'Votre adresse email a été vérifiée avec succès.',
        'Your email address has been successfully verified.'
      )}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Vous pouvez maintenant profiter de toutes les fonctionnalités de votre compte.<br>
        <em style="color:${emailStyles.textMuted};">You can now enjoy all the features of your account.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal"), "Ouvrir le portail / Open portal", config.supportEmail, config.supportPhone),
  },

  // PASSWORD RESET
  password_reset: {
    subject: "Nivra — Réinitialisation de mot de passe",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🔐', 'Demande de réinitialisation', 'Password reset request',
        'Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.',
        'A password reset request was made for your account.'
      )}
      <p style="margin:20px 0; font-size:14px; color:${emailStyles.textSecondary};">
        Si vous n'avez pas fait cette demande, ignorez cet email.<br>
        <em style="color:${emailStyles.textMuted};">If you did not make this request, please ignore this email.</em>
      </p>
    `, vars.reset_link || joinUrl(config.baseUrl, "/reset-password"), "Réinitialiser / Reset password", config.supportEmail, config.supportPhone),
  },

  // ORDER SUBMITTED
  order_submitted: {
    subject: "Nivra — Commande reçue (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Commande reçue!', 'Order received!',
        'Votre commande a été soumise avec succès et est en cours de traitement.',
        'Your order has been submitted successfully and is being processed.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || vars.order_id?.substring(0, 8) || 'N/A' },
        { label: 'Service', value: vars.service_type || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.total_amount) },
        { label: 'Date', value: formatDate(new Date().toISOString()) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Suivez votre commande dans votre portail client.<br>
        <em style="color:${emailStyles.textMuted};">Track your order in your client portal.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Voir ma commande / View my order", config.supportEmail, config.supportPhone),
  },

  // ORDER PROCESSED
  order_processed: {
    subject: "Nivra — Commande en traitement (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📦', 'Commande en traitement', 'Order processing',
        'Votre commande est maintenant en cours de traitement par notre équipe.',
        'Your order is now being processed by our team.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Statut / Status', value: 'En traitement / Processing' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Suivre ma commande / Track order", config.supportEmail, config.supportPhone),
  },

  // ORDER SHIPPED
  order_shipped: {
    subject: "Nivra — Commande expédiée (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '🚚', 'Commande expédiée!', 'Order shipped!',
        'Votre commande a été expédiée et est en route vers vous.',
        'Your order has been shipped and is on its way to you.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Nº suivi / Tracking #', value: vars.tracking_number || 'N/A' },
        ...(vars.tracking_url ? [{ label: 'Lien suivi / Tracking link', value: `<a href="${vars.tracking_url}" style="color:${emailStyles.accent};">Suivre / Track</a>` }] : []),
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Voir ma commande / View order", config.supportEmail, config.supportPhone),
  },

  // ORDER COMPLETED
  order_completed: {
    subject: "Nivra — Commande terminée (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Commande complétée!', 'Order completed!',
        'Votre commande a été complétée avec succès. Merci de votre confiance!',
        'Your order has been completed successfully. Thank you for your trust!'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Statut / Status', value: 'Complétée / Completed' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom!<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom!</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Voir mes commandes / View orders", config.supportEmail, config.supportPhone),
  },

  // ORDER CANCELLED
  order_cancelled: {
    subject: "Nivra — Commande annulée (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Commande annulée', 'Order cancelled',
        'Votre commande a été annulée.',
        'Your order has been cancelled.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Statut / Status', value: 'Annulée / Cancelled' },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Pour toute question, contactez notre support.<br>
        <em style="color:${emailStyles.textMuted};">For any questions, contact our support.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal"), "Contacter support / Contact support", config.supportEmail, config.supportPhone),
  },

  // SHIPPING CREATED
  shipping_created: {
    subject: "Nivra — Expédition créée (#{{order_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📦', 'Expédition préparée', 'Shipment prepared',
        'L\'expédition de votre commande a été créée et sera bientôt en route.',
        'The shipment for your order has been created and will be on its way soon.'
      )}
      ${detailsCard([
        { label: 'Nº commande / Order #', value: vars.order_number || 'N/A' },
        { label: 'Adresse / Address', value: vars.shipping_address || 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/orders"), "Suivre ma commande / Track order", config.supportEmail, config.supportPhone),
  },

  // INVOICE CREATED
  invoice_created: {
    subject: "Nivra — Nouvelle facture (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📄', 'Nouvelle facture', 'New invoice',
        'Une nouvelle facture a été générée pour votre compte.',
        'A new invoice has been generated for your account.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir ma facture / View invoice", config.supportEmail, config.supportPhone),
  },

  // PAYMENT RECEIVED
  payment_received: {
    subject: "Nivra — Paiement reçu (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Paiement reçu!', 'Payment received!',
        'Nous avons bien reçu votre paiement. Merci!',
        'We have received your payment. Thank you!'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant payé / Amount paid', value: formatCurrency(vars.amount) },
        { label: 'Date', value: formatDate(new Date().toISOString()) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom!<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom!</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir mes factures / View invoices", config.supportEmail, config.supportPhone),
  },

  // PAYMENT STATUS CHANGED
  payment_status_changed: {
    subject: "Nivra — Mise à jour de paiement (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '💳', 'Statut de paiement mis à jour', 'Payment status updated',
        `Le statut de votre paiement a été mis à jour: ${vars.status || 'N/A'}`,
        `Your payment status has been updated: ${vars.status || 'N/A'}`
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Nouveau statut / New status', value: vars.status || 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Voir mes factures / View invoices", config.supportEmail, config.supportPhone),
  },

  // INVOICE OVERDUE
  invoice_overdue: {
    subject: "Nivra — Facture en retard (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '⚠️', 'Facture en retard', 'Invoice overdue',
        'Votre facture est maintenant en retard. Veuillez effectuer le paiement dès que possible.',
        'Your invoice is now overdue. Please make the payment as soon as possible.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant dû / Amount due', value: formatCurrency(vars.amount) },
        { label: 'Échéance / Due date', value: vars.due_date ? formatDate(vars.due_date) : 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Payer maintenant / Pay now", config.supportEmail, config.supportPhone),
  },

  // PAYMENT FAILED
  payment_failed: {
    subject: "Nivra — Échec du paiement (#{{invoice_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Paiement non réussi', 'Payment failed',
        'Votre paiement n\'a pas pu être traité. Veuillez vérifier vos informations.',
        'Your payment could not be processed. Please verify your information.'
      )}
      ${detailsCard([
        { label: 'Nº facture / Invoice #', value: vars.invoice_number || 'N/A' },
        { label: 'Montant / Amount', value: formatCurrency(vars.amount) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Veuillez mettre à jour votre méthode de paiement et réessayer.<br>
        <em style="color:${emailStyles.textMuted};">Please update your payment method and try again.</em>
      </p>
    `, joinUrl(config.baseUrl, "/portal/invoices"), "Réessayer / Retry", config.supportEmail, config.supportPhone),
  },

  // TICKET CREATED
  ticket_created: {
    subject: "Nivra — Ticket de support créé (#{{ticket_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '🎫', 'Ticket créé', 'Ticket created',
        'Votre demande de support a été reçue. Notre équipe vous répondra sous peu.',
        'Your support request has been received. Our team will respond shortly.'
      )}
      ${detailsCard([
        { label: 'Nº ticket / Ticket #', value: vars.ticket_number || 'N/A' },
        { label: 'Sujet / Subject', value: vars.subject || 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/tickets"), "Voir mon ticket / View ticket", config.supportEmail, config.supportPhone),
  },

  // TICKET REPLY
  ticket_reply: {
    subject: "Nivra — Nouvelle réponse à votre ticket (#{{ticket_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '💬', 'Nouvelle réponse', 'New reply',
        'Vous avez reçu une nouvelle réponse à votre ticket de support.',
        'You have received a new reply to your support ticket.'
      )}
      ${detailsCard([
        { label: 'Nº ticket / Ticket #', value: vars.ticket_number || 'N/A' },
      ])}
      ${vars.reply_preview ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
          <tr>
            <td style="background-color:#fafafa; border-radius:8px; padding:16px; border-left:3px solid ${emailStyles.accent};">
              <p style="margin:0; font-size:14px; color:${emailStyles.textSecondary}; font-style:italic;">
                "${vars.reply_preview.length > 150 ? vars.reply_preview.substring(0, 150) + '...' : vars.reply_preview}"
              </p>
            </td>
          </tr>
        </table>
      ` : ''}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/tickets"), "Voir la réponse / View reply", config.supportEmail, config.supportPhone),
  },

  // APPOINTMENT SCHEDULED
  appointment_scheduled: {
    subject: "Nivra — Rendez-vous confirmé",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '📅', 'Rendez-vous confirmé', 'Appointment confirmed',
        'Votre rendez-vous a été planifié avec succès.',
        'Your appointment has been scheduled successfully.'
      )}
      ${detailsCard([
        { label: 'Titre / Title', value: vars.title || 'N/A' },
        { label: 'Date et heure / Date & time', value: vars.scheduled_at ? formatDate(vars.scheduled_at, true) : 'À confirmer / TBD' },
        ...(vars.service_address ? [{ label: 'Adresse / Address', value: vars.service_address }] : []),
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/appointments"), "Voir mes rendez-vous / View appointments", config.supportEmail, config.supportPhone),
  },

  // APPOINTMENT UPDATED
  appointment_updated: {
    subject: "Nivra — Rendez-vous mis à jour",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('warning', '📅', 'Rendez-vous modifié', 'Appointment updated',
        'Votre rendez-vous a été modifié. Veuillez vérifier les nouveaux détails.',
        'Your appointment has been updated. Please check the new details.'
      )}
      ${detailsCard([
        { label: 'Titre / Title', value: vars.title || 'N/A' },
        { label: 'Nouvelle date / New date', value: vars.scheduled_at ? formatDate(vars.scheduled_at, true) : 'À confirmer / TBD' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/appointments"), "Voir mes rendez-vous / View appointments", config.supportEmail, config.supportPhone),
  },

  // APPOINTMENT CANCELLED
  appointment_cancelled: {
    subject: "Nivra — Rendez-vous annulé",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('error', '❌', 'Rendez-vous annulé', 'Appointment cancelled',
        'Votre rendez-vous a été annulé.',
        'Your appointment has been cancelled.'
      )}
      ${detailsCard([
        { label: 'Titre / Title', value: vars.title || 'N/A' },
        ...(vars.cancellation_reason ? [{ label: 'Raison / Reason', value: vars.cancellation_reason }] : []),
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Pour reprogrammer, veuillez nous contacter au ${config.supportPhone}.<br>
        <em style="color:${emailStyles.textMuted};">To reschedule, please contact us at ${config.supportPhone}.</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/appointments"), "Reprogrammer / Reschedule", config.supportEmail, config.supportPhone),
  },

  // CONTRACT READY
  contract_ready: {
    subject: "Nivra — Contrat prêt à signer",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('info', '📝', 'Contrat disponible', 'Contract ready',
        'Votre contrat est prêt à être signé. Veuillez le consulter dans votre portail.',
        'Your contract is ready to be signed. Please review it in your portal.'
      )}
      ${detailsCard([
        { label: 'Nº contrat / Contract #', value: vars.contract_number || 'N/A' },
        { label: 'Nom / Name', value: vars.contract_name || 'N/A' },
      ])}
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/contracts"), "Voir le contrat / View contract", config.supportEmail, config.supportPhone),
  },

  // CONTRACT SIGNED
  contract_signed: {
    subject: "Nivra — Contrat signé (#{{contract_number}})",
    getHtml: (vars, config) => wrapEmail(`
      ${greeting(vars.client_name)}
      ${statusBadge('success', '✅', 'Contrat signé!', 'Contract signed!',
        'Votre contrat a été signé avec succès. Une copie est disponible dans votre portail.',
        'Your contract has been signed successfully. A copy is available in your portal.'
      )}
      ${detailsCard([
        { label: 'Nº contrat / Contract #', value: vars.contract_number || 'N/A' },
        { label: 'Signé le / Signed on', value: formatDate(vars.signed_at || new Date().toISOString()) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Merci de faire confiance à Nivra Telecom!<br>
        <em style="color:${emailStyles.textMuted};">Thank you for trusting Nivra Telecom!</em>
      </p>
    `, joinUrl(config.baseUrl, vars.portal_path || "/portal/contracts"), "Voir mes contrats / View contracts", config.supportEmail, config.supportPhone),
  },
};

// =============================================
// MAIN SERVER HANDLER
// =============================================

Deno.serve(async (req) => {
  const corsPreflightResponse = handleCorsPreflightRequest(req);
  if (corsPreflightResponse) return corsPreflightResponse;
  
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFromAddress = "Nivra Telecom <support@nivratelecom.ca>";
  const emailReplyTo = "support@nivratelecom.ca";
  const supportEmail = Deno.env.get("SUPPORT_EMAIL") || "Support@nivratelecom.ca";
  const supportPhone = Deno.env.get("SUPPORT_PHONE") || "438-544-2233";
  
  // Validate APP_BASE_URL - must be single valid URL, never ALLOWED_ORIGINS
  const rawAppBaseUrl = Deno.env.get("APP_BASE_URL");
  let appBaseUrl = "https://nivratelecom.ca"; // Safe default
  
  if (rawAppBaseUrl) {
    // Check for comma (multiple URLs) or invalid URL format
    if (rawAppBaseUrl.includes(",")) {
      console.error(`[EMAIL CONFIG ERROR] APP_BASE_URL contains multiple URLs: "${rawAppBaseUrl}". Using fallback.`);
    } else {
      try {
        new URL(rawAppBaseUrl); // Validate URL format
        appBaseUrl = rawAppBaseUrl.replace(/\/+$/, ""); // Remove trailing slashes
      } catch {
        console.error(`[EMAIL CONFIG ERROR] APP_BASE_URL is not a valid URL: "${rawAppBaseUrl}". Using fallback.`);
      }
    }
  } else {
    console.warn("[EMAIL CONFIG] APP_BASE_URL not set, using fallback: https://nivratelecom.ca");
  }
  
  const emailConfig: EmailConfig = {
    baseUrl: appBaseUrl,
    supportEmail,
    supportPhone,
  };

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Check if this is a test email request
    const url = new URL(req.url);
    if (url.searchParams.get("test") === "true") {
      const body = await req.json();
      const testEmail = body.to_email;
      
      if (!testEmail) {
        return new Response(JSON.stringify({ error: "to_email required for test" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const template = emailTemplates.test_email;
      
      // Replace template variables in subject
      let subject = template.subject;
      
      const html = template.getHtml({ to_email: testEmail }, emailConfig);

      console.log(`Sending test email to: ${testEmail}`);

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
          body: JSON.stringify({
            from: emailFromAddress,
            reply_to: emailReplyTo,
            to: [testEmail],
            subject,
          html,
        }),
      });

      const result = await emailResponse.json();

      if (!emailResponse.ok) {
        console.error("Test email failed:", result);
        return new Response(JSON.stringify({ 
          success: false, 
          error: result.message || "Failed to send test email",
          details: result
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Test email sent successfully:", result);

      return new Response(JSON.stringify({
        success: true,
        recipient: testEmail,
        template: "test_email",
        provider_message_id: result.id,
        from: emailFromAddress,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process email queue
    const { data: queuedEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "queued")
      .lte("next_retry_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error("Error fetching email queue:", fetchError);
      throw fetchError;
    }

    console.log(`Processing ${queuedEmails?.length || 0} queued emails`);

    const results = [];

    for (const email of queuedEmails || []) {
      // Mark as processing
      await supabase
        .from("email_queue")
        .update({ status: "processing" })
        .eq("id", email.id);

      try {
        const template = emailTemplates[email.template_key];
        
        if (!template) {
          throw new Error(`Unknown template: ${email.template_key}`);
        }

        const html = template.getHtml(email.template_vars || {}, emailConfig);
        
        // Replace template variables in subject
        let subject = template.subject;
        const vars = email.template_vars || {};
        if (vars.order_number) subject = subject.replace('{{order_number}}', vars.order_number);
        if (vars.invoice_number) subject = subject.replace('{{invoice_number}}', vars.invoice_number);
        if (vars.ticket_number) subject = subject.replace('{{ticket_number}}', vars.ticket_number);
        if (vars.contract_number) subject = subject.replace('{{contract_number}}', vars.contract_number);

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: emailFromAddress,
            reply_to: emailReplyTo,
            to: [email.to_email],
            subject,
            html,
          }),
        });

        const result = await emailResponse.json();

        if (!emailResponse.ok) {
          throw new Error(result.message || "Failed to send email");
        }

        // Mark as sent
        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: result.id,
            attempts: email.attempts + 1,
          })
          .eq("id", email.id);

        results.push({ id: email.id, status: "sent", provider_id: result.id });
        console.log(`Email sent: ${email.id} to ${email.to_email}`);

      } catch (sendError: any) {
        const newAttempts = email.attempts + 1;
        const maxAttempts = email.max_attempts || 5;
        const nextStatus = newAttempts >= maxAttempts ? "failed" : "queued";
        
        // Exponential backoff: 1min, 2min, 4min, 8min, 16min
        const backoffMinutes = Math.pow(2, newAttempts - 1);
        const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

        await supabase
          .from("email_queue")
          .update({
            status: nextStatus,
            attempts: newAttempts,
            last_error: sendError.message,
            next_retry_at: nextRetry,
          })
          .eq("id", email.id);

        results.push({ id: email.id, status: nextStatus, error: sendError.message });
        console.error(`Email failed: ${email.id}`, sendError.message);
      }
    }

    // Cleanup old rate limits (ignore errors)
    try {
      await supabase.rpc("cleanup_old_rate_limits");
    } catch (e) {
      // Ignore cleanup errors
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error processing email queue:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
