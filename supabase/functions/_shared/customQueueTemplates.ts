/**
 * Inlined HTML templates for emails inserted directly into the
 * `email_queue` table (status='queued') by various edge functions.
 *
 * The custom queue processor (`email-queue-drain`) calls `renderQueueTemplate`
 * to produce the final HTML + subject, then forwards the email through
 * `enqueueEmail` (ResendProxy → pgmq → process-email-queue → Lovable Email).
 *
 * Design = Nivra "Corporate Blue #0066CC" template style, matching
 * the canonical templates in _shared/email-templates.ts.
 */

const APP_URL = "https://nivra-telecom.ca";
const SUPPORT_EMAIL = "support@nivra-telecom.ca";

const esc = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const money = (v: unknown): string => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  if (!isFinite(n)) return String(v ?? "");
  return n.toFixed(2) + " $ CAD";
};

const fmtDate = (v: unknown): string => {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("fr-CA", { dateStyle: "long" });
};

// Shared layout (header + body + footer).
function shell(opts: {
  title: string;
  bodyHtml: string;
  preheader?: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const { title, bodyHtml, preheader = "", ctaUrl, ctaLabel } = opts;
  const cta = ctaUrl && ctaLabel
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
         <tr><td bgcolor="#0066CC" style="border-radius:6px;">
           <a href="${esc(ctaUrl)}" style="display:inline-block; padding:14px 28px; font-family:Arial,sans-serif; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:6px;">${esc(ctaLabel)}</a>
         </td></tr>
       </table>`
    : "";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFB; font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none !important; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden;">${esc(preheader)}</span>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F8FAFB;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px; width:100%; background-color:#ffffff; border:1px solid #E5E7EB; border-radius:8px;">
        <tr>
          <td style="padding:28px 32px; border-bottom:3px solid #0066CC;">
            <h1 style="margin:0; font-size:26px; font-weight:700; color:#0066CC;">Nivra Telecom</h1>
            <p style="margin:4px 0 0; font-size:11px; color:#6B7280; text-transform:uppercase; letter-spacing:1px;">Télécommunications</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${bodyHtml}
            ${cta}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px; background-color:#1F2937; border-radius:0 0 8px 8px;">
            <p style="margin:0 0 6px; color:#D1D5DB; font-size:12px;">
              Une question ? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#93C5FD;">${SUPPORT_EMAIL}</a>
            </p>
            <p style="margin:0; color:#9CA3AF; font-size:11px;">
              Nivra Telecom — Québec, Canada — <a href="${APP_URL}" style="color:#93C5FD;">${APP_URL}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function rowsTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse; margin:16px 0;">
    ${rows.map(([k, v]) => `
      <tr>
        <td style="padding:8px 0; border-bottom:1px solid #E5E7EB; color:#6B7280; font-size:13px;">${esc(k)}</td>
        <td style="padding:8px 0; border-bottom:1px solid #E5E7EB; color:#1A1A1A; font-size:14px; text-align:right; font-weight:600;">${esc(v)}</td>
      </tr>`).join("")}
  </table>`;
}

export interface RenderResult {
  html: string;
  subject: string;
}

export function renderQueueTemplate(
  templateKey: string,
  vars: Record<string, unknown>,
): RenderResult | null {
  const v = vars || {};
  const clientName = String(v.client_name || v.first_name || "Client");

  switch (templateKey) {
    case "order_submitted":
    case "order_confirmation": {
      const orderNum = esc(v.order_number || v.order_id || "—");
      const planName = esc(v.plan_name || "Service Nivra");
      const total = money(v.monthly_total_tax_in ?? v.amount_paid_today ?? v.total ?? v.amount);
      return {
        subject: `Commande confirmée — ${orderNum}`,
        html: shell({
          title: "Commande confirmée",
          preheader: `Merci ${clientName}, votre commande Nivra est confirmée.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#1A1A1A; font-size:22px;">Merci ${esc(clientName)} !</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Nous avons bien reçu votre commande. Notre équipe la traite et vous écrira dès que votre équipement est expédié.
            </p>
            ${rowsTable([
              ["Numéro de commande", String(orderNum)],
              ["Forfait", String(planName)],
              ["Montant payé", String(total)],
            ])}
            <p style="margin:16px 0 0; color:#6B7280; font-size:13px;">
              Vous pouvez suivre votre commande dans votre espace client.
            </p>
          `,
          ctaUrl: `${APP_URL}/portail`,
          ctaLabel: "Accéder à mon espace client",
        }),
      };
    }

    case "payment_confirmed": {
      const invoiceNum = esc(v.invoice_number || "—");
      const amount = money(v.amount_paid_today ?? v.amount ?? v.total_payable);
      const reference = esc(v.reference || "—");
      const method = esc(v.payment_method || "PayPal");
      return {
        subject: `Paiement confirmé — ${invoiceNum}`,
        html: shell({
          title: "Paiement confirmé",
          preheader: `Votre paiement de ${amount} a été reçu.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#059669; font-size:22px;">✓ Paiement reçu</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, nous confirmons la réception de votre paiement.
            </p>
            ${rowsTable([
              ["Facture", String(invoiceNum)],
              ["Montant", amount],
              ["Méthode", String(method)],
              ["Référence", String(reference)],
            ])}
          `,
          ctaUrl: `${APP_URL}/portail/facturation`,
          ctaLabel: "Voir mes factures",
        }),
      };
    }

    case "invoice_created":
    case "billing_renewal": {
      const invoiceNum = esc(v.invoice_number || "—");
      const total = money(v.total ?? v.amount);
      const dueDate = fmtDate(v.due_date);
      return {
        subject: `Nouvelle facture — ${invoiceNum}`,
        html: shell({
          title: "Nouvelle facture",
          preheader: `Facture ${invoiceNum} de ${total}.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#1A1A1A; font-size:22px;">Nouvelle facture disponible</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre nouvelle facture est disponible dans votre espace client.
            </p>
            ${rowsTable([
              ["Numéro de facture", String(invoiceNum)],
              ["Montant", total],
              ["Date d'échéance", dueDate],
              ["Cycle", `${fmtDate(v.cycle_start)} → ${fmtDate(v.cycle_end)}`],
            ])}
          `,
          ctaUrl: `${APP_URL}/portail/facturation`,
          ctaLabel: "Payer maintenant",
        }),
      };
    }

    case "payment_reminder_7days":
    case "payment_reminder_3days":
    case "payment_reminder_1day":
    case "payment_due_today": {
      const days = templateKey === "payment_due_today"
        ? "aujourd'hui"
        : templateKey === "payment_reminder_1day"
          ? "demain"
          : templateKey === "payment_reminder_3days"
            ? "dans 3 jours"
            : "dans 7 jours";
      const total = money(v.total ?? v.amount);
      const invoiceNum = esc(v.invoice_number || "—");
      return {
        subject: `Rappel — votre facture est due ${days}`,
        html: shell({
          title: "Rappel de paiement",
          preheader: `Facture ${invoiceNum} due ${days}.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#D97706; font-size:22px;">Rappel — paiement à venir</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre facture est due ${days}. Pour éviter toute interruption de service, payez dès maintenant.
            </p>
            ${rowsTable([
              ["Facture", String(invoiceNum)],
              ["Montant dû", total],
              ["Échéance", fmtDate(v.due_date)],
            ])}
          `,
          ctaUrl: String(v.payment_link || `${APP_URL}/portail/facturation`),
          ctaLabel: "Payer ma facture",
        }),
      };
    }

    case "payment_overdue": {
      const total = money(v.total ?? v.amount);
      const invoiceNum = esc(v.invoice_number || "—");
      return {
        subject: `Action requise — facture en retard ${invoiceNum}`,
        html: shell({
          title: "Facture en retard",
          preheader: `Facture ${invoiceNum} de ${total} en retard.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#DC2626; font-size:22px;">⚠ Paiement en retard</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre facture est en retard. Sans paiement, votre service sera suspendu prochainement.
            </p>
            ${rowsTable([
              ["Facture", String(invoiceNum)],
              ["Montant dû", total],
              ["Échéance dépassée", fmtDate(v.due_date)],
            ])}
          `,
          ctaUrl: String(v.payment_link || `${APP_URL}/portail/facturation`),
          ctaLabel: "Régulariser maintenant",
        }),
      };
    }

    case "payment_failed": {
      return {
        subject: `Échec du paiement — commande ${esc(v.order_number || "")}`,
        html: shell({
          title: "Paiement échoué",
          preheader: "Votre paiement n'a pas pu être traité.",
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#DC2626; font-size:22px;">Paiement non traité</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, le paiement de votre commande n'a pas pu être traité.
              ${v.reason ? `Raison : ${esc(v.reason)}.` : ""}
            </p>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Pour finaliser votre commande, veuillez réessayer le paiement depuis votre espace client.
            </p>
          `,
          ctaUrl: `${APP_URL}/portail/facturation`,
          ctaLabel: "Réessayer le paiement",
        }),
      };
    }

    case "welcome_new_client": {
      const portalUrl = String(v.portal_url || `${APP_URL}/portail`);
      return {
        subject: "Bienvenue chez Nivra Telecom",
        html: shell({
          title: "Bienvenue chez Nivra",
          preheader: "Votre espace client est prêt.",
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#0066CC; font-size:22px;">Bienvenue ${esc(clientName)} !</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Votre compte client Nivra est créé. Vous pouvez désormais consulter vos factures, gérer votre service et soumettre vos demandes d'activation depuis votre espace client.
            </p>
            <p style="margin:0 0 16px; color:#6B7280; font-size:13px;">
              Courriel : <strong>${esc(v.email || "")}</strong>
            </p>
          `,
          ctaUrl: portalUrl,
          ctaLabel: "Accéder à mon espace client",
        }),
      };
    }

    case "contract_ready": {
      return {
        subject: "Votre contrat est prêt",
        html: shell({
          title: "Contrat prêt",
          preheader: "Votre contrat de service est disponible.",
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#1A1A1A; font-size:22px;">Votre contrat est prêt</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre contrat de service Nivra est disponible dans votre espace client. Veuillez le consulter et le signer pour finaliser votre commande.
            </p>
          `,
          ctaUrl: `${APP_URL}/portail`,
          ctaLabel: "Voir mon contrat",
        }),
      };
    }

    case "ticket_created": {
      return {
        subject: `Demande reçue — ${esc(v.ticket_number || v.subject || "support")}`,
        html: shell({
          title: "Demande reçue",
          preheader: "Votre demande a été enregistrée.",
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#1A1A1A; font-size:22px;">Nous avons reçu votre demande</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, notre équipe a bien reçu votre demande et vous répondra dans les meilleurs délais (max 24h, 7j/7).
            </p>
            ${v.ticket_number ? rowsTable([["Numéro de demande", String(v.ticket_number)]]) : ""}
          `,
          ctaUrl: `${APP_URL}/support`,
          ctaLabel: "Centre d'aide",
        }),
      };
    }

    case "order_completed": {
      return {
        subject: "Votre commande est complétée",
        html: shell({
          title: "Commande complétée",
          preheader: "Merci pour votre confiance.",
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#059669; font-size:22px;">✓ Commande complétée</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre commande est complétée. Bienvenue dans la famille Nivra !
            </p>
          `,
          ctaUrl: `${APP_URL}/portail`,
          ctaLabel: "Mon espace client",
        }),
      };
    }

    case "quote_sent": {
      const quoteNum = esc(v.quote_number || v.quote_id || "—");
      const total = money(v.total ?? v.amount);
      return {
        subject: `Votre soumission Nivra — ${quoteNum}`,
        html: shell({
          title: "Soumission Nivra",
          preheader: `Votre soumission ${quoteNum} est prête.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#0066CC; font-size:22px;">Votre soumission est prête</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre soumission Nivra est disponible. Cliquez sur le bouton ci-dessous pour la consulter et finaliser votre commande.
            </p>
            ${rowsTable([
              ["Numéro de soumission", String(quoteNum)],
              ["Total", total],
            ])}
          `,
          ctaUrl: String(v.quote_link || `${APP_URL}/portail`),
          ctaLabel: "Voir ma soumission",
        }),
      };
    }

    // ─── B2: Autopay activation invitation (sent at J+25, ~5 days before renewal) ───
    case "autopay_activation_invitation": {
      const planName = esc(v.plan_name || "votre forfait Nivra");
      const monthlyTotal = money(v.monthly_total ?? v.total ?? v.amount);
      const renewalDate = fmtDate(v.next_renewal_date);
      const activationLink = String(v.activation_link || `${APP_URL}/portail/facturation`);
      return {
        subject: `Évitez les coupures — activez le paiement automatique`,
        html: shell({
          title: "Activez le paiement automatique",
          preheader: `Votre prochain renouvellement est le ${renewalDate}.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#0066CC; font-size:22px;">Activez le paiement automatique</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre forfait <strong>${planName}</strong> se renouvelle automatiquement le <strong>${renewalDate}</strong>.
              Pour éviter toute interruption de service, activez le paiement automatique sécurisé via PayPal.
            </p>
            ${rowsTable([
              ["Forfait", String(planName)],
              ["Renouvellement", renewalDate],
              ["Montant mensuel", monthlyTotal],
            ])}
            <p style="margin:16px 0; color:#4A4A4A; font-size:14px; line-height:1.6;">
              ✓ Paiement automatique chaque mois<br>
              ✓ Sans compte PayPal requis (carte de crédit/débit acceptée)<br>
              ✓ Annulable à tout moment dans votre espace client
            </p>
          `,
          ctaUrl: activationLink,
          ctaLabel: "Activer le paiement automatique",
        }),
      };
    }

    // ─── B2: Failed PayPal charge retry notification ───
    case "paypal_charge_failed_retry": {
      const invoiceNum = esc(v.invoice_number || "—");
      const total = money(v.total ?? v.amount);
      const retryDate = fmtDate(v.retry_date);
      return {
        subject: `Paiement automatique échoué — nouvelle tentative ${retryDate}`,
        html: shell({
          title: "Paiement automatique échoué",
          preheader: `Nouvelle tentative le ${retryDate}.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#D97706; font-size:22px;">Paiement automatique échoué</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, le paiement automatique de votre facture n'a pas pu être traité.
              Nous réessaierons automatiquement le <strong>${retryDate}</strong>.
            </p>
            ${rowsTable([
              ["Facture", String(invoiceNum)],
              ["Montant", total],
              ["Prochaine tentative", retryDate],
            ])}
            <p style="margin:16px 0; color:#4A4A4A; font-size:14px; line-height:1.6;">
              Pour éviter toute interruption, vous pouvez aussi payer manuellement dès maintenant via votre espace client.
            </p>
          `,
          ctaUrl: `${APP_URL}/portail/facturation`,
          ctaLabel: "Payer maintenant",
        }),
      };
    }

    // ─── J+3: Suspension warning (P0 GAP #1) ───
    case "invoice_suspension_warning": {
      const invoiceNum = esc(v.invoice_number || "—");
      const total = money(v.total ?? v.amount);
      const suspensionDate = fmtDate(v.suspension_date);
      return {
        subject: `⚠️ Votre service sera suspendu dans 2 jours (#${invoiceNum})`,
        html: shell({
          title: "Avertissement de suspension imminente",
          preheader: `Service suspendu dans 2 jours si non payé.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#DC2626; font-size:22px;">⚠️ Suspension dans 2 jours</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre facture de <strong>${total}</strong> est en souffrance depuis 3 jours.
              Si le paiement n'est pas reçu dans les 2 prochains jours, votre service sera <strong>suspendu automatiquement</strong> le ${suspensionDate}.
            </p>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Payez maintenant pour éviter l'interruption de votre service.
            </p>
            ${rowsTable([
              ["Facture", String(invoiceNum)],
              ["Montant dû", total],
              ["Suspension prévue", suspensionDate],
            ])}
          `,
          ctaUrl: String(v.payment_link || `${APP_URL}/portail/facturation`),
          ctaLabel: "Payer maintenant",
        }),
      };
    }

    // ─── ADMIN ALERT: Suspension at J+5 ───
    case "admin_alert_suspended": {
      const invoiceNum = esc(v.invoice_number || "—");
      const total = money(v.total ?? v.amount);
      return {
        subject: `🔴 Service suspendu — ${esc(v.client_full_name || clientName)}`,
        html: shell({
          title: "Alerte: Service suspendu",
          preheader: `Compte ${esc(v.account_number || "")} suspendu (J+5).`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#DC2626; font-size:22px;">🔴 Service suspendu (J+5)</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Le service du client <strong>${esc(v.client_full_name || clientName)}</strong> vient d'être suspendu automatiquement après 5 jours de non-paiement.
            </p>
            ${rowsTable([
              ["Client", esc(v.client_full_name || clientName)],
              ["Courriel", esc(v.client_email || "—")],
              ["Compte", esc(v.account_number || "—")],
              ["Facture", String(invoiceNum)],
              ["Montant", total],
              ["Échéance", fmtDate(v.due_date)],
            ])}
            <p style="margin:16px 0; color:#6B7280; font-size:13px;">
              Fenêtre de réactivation jusqu'au <strong>${fmtDate(v.void_date)}</strong> (J+10).
            </p>
          `,
          ctaUrl: `${APP_URL}/admin/recouvrement`,
          ctaLabel: "Voir le compte",
        }),
      };
    }

    // ─── ADMIN ALERT: Cancellation at J+10 ───
    case "admin_alert_cancelled": {
      const invoiceNum = esc(v.invoice_number || "—");
      const total = money(v.total ?? v.amount);
      return {
        subject: `⚫ Abonnement annulé — ${esc(v.client_full_name || clientName)}`,
        html: shell({
          title: "Alerte: Abonnement annulé",
          preheader: `Compte ${esc(v.account_number || "")} annulé (J+10).`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#1A1A1A; font-size:22px;">⚫ Abonnement annulé (J+10)</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              L'abonnement du client <strong>${esc(v.client_full_name || clientName)}</strong> a été annulé automatiquement.
              La facture a été marquée comme nulle (aucune dette).
            </p>
            ${rowsTable([
              ["Client", esc(v.client_full_name || clientName)],
              ["Courriel", esc(v.client_email || "—")],
              ["Compte", esc(v.account_number || "—")],
              ["Facture annulée", String(invoiceNum)],
              ["Montant initial", total],
              ["Échéance dépassée", fmtDate(v.due_date)],
            ])}
          `,
          ctaUrl: `${APP_URL}/admin/recouvrement`,
          ctaLabel: "Voir le dossier",
        }),
      };
    }

    // ─── ADMIN DAILY DIGEST 8h AM ───
    case "admin_overdue_daily_digest": {
      const total = String(v.total_overdue_count ?? 0);
      const warningCount = String(v.warning_count ?? 0);
      const urgentCount = String(v.urgent_count ?? 0);
      const suspendedCount = String(v.suspended_count ?? 0);
      const totalAmount = money(v.total_amount_overdue);
      const reportDate = fmtDate(v.report_date);
      return {
        subject: `📊 Rapport souffrance — ${total} compte${Number(total) > 1 ? "s" : ""} en retard`,
        html: shell({
          title: "Rapport quotidien — Comptes en souffrance",
          preheader: `${total} compte(s) en retard ce matin.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#0066CC; font-size:22px;">📊 Rapport quotidien — Souffrance</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Rapport au <strong>${reportDate}</strong>. ${total} compte${Number(total) > 1 ? "s" : ""} en retard de paiement.
            </p>
            ${rowsTable([
              ["⚠️ Avertissement (J0–J+2)", warningCount],
              ["🟠 Urgent (J+3–J+4)", urgentCount],
              ["🔴 Suspendus (J+5+)", suspendedCount],
              ["Total à recouvrer", totalAmount],
            ])}
            <p style="margin:16px 0; color:#6B7280; font-size:13px;">
              Consultez la section Recouvrement dans Nivra Core pour le détail.
            </p>
          `,
          ctaUrl: `${APP_URL}/admin/recouvrement`,
          ctaLabel: "Ouvrir Recouvrement",
        }),
      };
    }

    // ─── B2: Service suspended (J+5) ───
    case "service_suspended": {
      const invoiceNum = esc(v.invoice_number || "—");
      const total = money(v.total ?? v.amount);
      const voidDate = fmtDate(v.void_date);
      return {
        subject: `Service suspendu — paiement requis avant ${voidDate}`,
        html: shell({
          title: "Service suspendu",
          preheader: `Réactivez avant ${voidDate}.`,
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#DC2626; font-size:22px;">⚠ Service suspendu</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre service Nivra est <strong>temporairement suspendu</strong> faute de paiement.
              Vous pouvez encore réactiver votre service en payant la facture avant le <strong>${voidDate}</strong>.
            </p>
            ${rowsTable([
              ["Facture", String(invoiceNum)],
              ["Montant dû", total],
              ["Date limite réactivation", voidDate],
            ])}
          `,
          ctaUrl: String(v.payment_link || `${APP_URL}/portail/facturation`),
          ctaLabel: "Payer et réactiver",
        }),
      };
    }

    // ─── B2: Invoice voided after J+10 ───
    case "invoice_voided": {
      const invoiceNum = esc(v.invoice_number || "—");
      return {
        subject: `Facture ${invoiceNum} annulée`,
        html: shell({
          title: "Facture annulée",
          preheader: "Aucune dette restante.",
          bodyHtml: `
            <h2 style="margin:0 0 16px; color:#1A1A1A; font-size:22px;">Facture annulée</h2>
            <p style="margin:0 0 16px; color:#4A4A4A; font-size:15px; line-height:1.6;">
              Bonjour ${esc(clientName)}, votre facture <strong>${invoiceNum}</strong> a été annulée
              car la fenêtre de réactivation est expirée. Vous n'avez aucune dette à régler.
            </p>
            <p style="margin:16px 0; color:#4A4A4A; font-size:14px; line-height:1.6;">
              Pour reprendre votre service, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#0066CC;">${SUPPORT_EMAIL}</a>.
            </p>
          `,
          ctaUrl: `${APP_URL}/support`,
          ctaLabel: "Nous contacter",
        }),
      };
    }
  }

  return null;
}
