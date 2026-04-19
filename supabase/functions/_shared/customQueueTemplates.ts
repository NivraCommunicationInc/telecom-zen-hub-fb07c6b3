/**
 * Inlined HTML templates for emails inserted directly into the
 * `email_queue` table (status='queued') by various edge functions.
 *
 * The custom queue processor (`email-queue-drain`) calls `renderQueueTemplate`
 * to produce the final HTML + subject, then forwards the email through
 * `enqueueEmail` (ResendProxy → pgmq → process-email-queue → Lovable Email).
 *
 * Design = Nivra "Violet Brand" template (#7c3aed) — table-based for
 * email-client compatibility (Gmail, Outlook, Apple Mail).
 */

const APP_URL = "https://nivra-telecom.ca";
const PORTAL_URL = `${APP_URL}/portail`;
const SUPPORT_EMAIL = "support@nivratelecom.ca";

// Brand palette — "Violet Bold" template (matches uploaded reference)
const BRAND_PRIMARY = "#7c3aed";       // primary violet
const BRAND_DARK = "#1e1b4b";          // deep indigo (header / footer / titles)
const BRAND_HERO_BG = "#f5f3ff";       // hero light lavender
const BRAND_CARD_BORDER = "#ede9fe";   // card border lavender
const BRAND_CARD_BG_LAST = "#f5f3ff";  // last (emphasized) row background
const BRAND_TEXT_BODY = "#4b5563";     // body text
const BRAND_TEXT_MUTED = "#6b7280";    // muted labels
const BRAND_TEXT_FOOT = "#a5b4fc";     // footer accent text
const BRAND_TEXT_FOOT_LOW = "#6b7280"; // footer copyright
const BRAND_DIVIDER = "#2d2b55";       // footer divider

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
  if (!isFinite(n)) return String(v ?? "—");
  return n.toFixed(2).replace(".", ",") + " $";
};

const fmtDate = (v: unknown): string => {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("fr-CA", { dateStyle: "long" });
};

// ---------------------------------------------------------------------------
// SVG icons (kept simple for email-client compatibility)
// ---------------------------------------------------------------------------
const ICONS = {
  check: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12l2 2 4-4" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="#7c3aed" stroke-width="1.8"/></svg>`,
  alert: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 8v5M12 16.5h.01" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="#7c3aed" stroke-width="1.8"/></svg>`,
  doc: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 4h6l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="#7c3aed" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 4v4h4" stroke="#7c3aed" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  truck: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" stroke="#7c3aed" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="18" r="1.8" stroke="#7c3aed" stroke-width="1.8"/><circle cx="17" cy="18" r="1.8" stroke="#7c3aed" stroke-width="1.8"/></svg>`,
  calendar: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="6" width="16" height="14" rx="2" stroke="#7c3aed" stroke-width="1.8"/><path d="M8 3v4M16 3v4M4 11h16" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  phone: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="3" width="10" height="18" rx="2" stroke="#7c3aed" stroke-width="1.8"/><path d="M11 17h2" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  pen: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" stroke="#7c3aed" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  star: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l2.6 5.6 6.1.7-4.6 4.2 1.3 6L12 16.7 6.6 19.5l1.3-6L3.3 9.3l6.1-.7L12 3z" stroke="#7c3aed" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  x: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 9l6 6M15 9l-6 6" stroke="#7c3aed" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="#7c3aed" stroke-width="1.8"/></svg>`,
};

type IconKey = keyof typeof ICONS;

// ---------------------------------------------------------------------------
// Shell — Nivra violet brand template (table-based, inline CSS only)
// ---------------------------------------------------------------------------

interface ShellOpts {
  preheader?: string;
  badge: string;          // e.g. "COMMANDE REÇUE"
  heroTitle: string;
  heroSub?: string;
  icon?: IconKey;         // defaults to "check"
  greeting?: string;      // "Bonjour {name},"
  bodyText?: string;      // intro paragraph (HTML allowed)
  cardTitle?: string;     // card header label (uppercased)
  cardRows?: Array<[string, string]>; // [label, value]
  cardEmphasizeLast?: boolean; // default true (matches reference)
  ctaPrimaryUrl?: string;
  ctaPrimaryLabel?: string;
  ctaSecondaryUrl?: string;
  ctaSecondaryLabel?: string;
  helpHtml?: string;          // inner HTML of help-box
  helpVariant?: "info" | "warning"; // border-left color
  afterCardText?: string;     // optional paragraph between card and CTA
}

function rowsBlock(rows: Array<[string, string]>, emphasizeLast: boolean): string {
  return rows.map(([label, value], i) => {
    const isLast = emphasizeLast && i === rows.length - 1;
    if (isLast) {
      return `<tr><td style="padding:12px 18px;background:${BRAND_CARD_BG_LAST};font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${BRAND_DARK};border-top:1px solid ${BRAND_CARD_BORDER};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
          <td style="color:${BRAND_DARK};font-size:13px;font-weight:700;">${esc(label)}</td>
          <td align="right" style="color:${BRAND_DARK};font-size:13px;font-weight:700;">${esc(value)}</td>
        </tr></table>
      </td></tr>`;
    }
    return `<tr><td style="padding:10px 18px;border-bottom:1px solid ${BRAND_HERO_BG};font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;font-size:13px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
        <td style="color:${BRAND_TEXT_MUTED};font-size:13px;">${esc(label)}</td>
        <td align="right" style="color:${BRAND_DARK};font-size:13px;font-weight:500;">${esc(value)}</td>
      </tr></table>
    </td></tr>`;
  }).join("");
}

function shell(opts: ShellOpts): string {
  const {
    preheader = "",
    badge,
    heroTitle,
    heroSub,
    icon = "check",
    greeting,
    bodyText,
    cardTitle,
    cardRows,
    cardEmphasizeLast = true,
    ctaPrimaryUrl,
    ctaPrimaryLabel,
    ctaSecondaryUrl,
    ctaSecondaryLabel,
    helpHtml,
    helpVariant = "info",
    afterCardText,
  } = opts;

  const helpBorder = helpVariant === "warning" ? "#f59e0b" : BRAND_PRIMARY;
  const fontStack = "'Helvetica Neue',Arial,Helvetica,sans-serif";

  const cardHtml = (cardTitle && cardRows && cardRows.length > 0)
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#ffffff;border:1.5px solid ${BRAND_CARD_BORDER};border-radius:12px;margin:20px 0;border-collapse:separate;overflow:hidden;">
        <tr><td style="background:${BRAND_DARK};padding:10px 18px;font-family:${fontStack};">
          <div style="font-size:10px;font-weight:700;color:${BRAND_TEXT_FOOT};text-transform:uppercase;letter-spacing:2px;">${esc(cardTitle)}</div>
        </td></tr>
        ${rowsBlock(cardRows, cardEmphasizeLast)}
      </table>`
    : "";

  const ctaPrimary = (ctaPrimaryUrl && ctaPrimaryLabel)
    ? `<a href="${esc(ctaPrimaryUrl)}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;padding:15px 44px;border-radius:99px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.5px;font-family:${fontStack};">${esc(ctaPrimaryLabel)}</a>`
    : "";

  const ctaSecondary = (ctaSecondaryUrl && ctaSecondaryLabel)
    ? `<a href="${esc(ctaSecondaryUrl)}" style="display:inline-block;background:transparent;color:${BRAND_PRIMARY};padding:13px 32px;border-radius:99px;font-weight:600;font-size:13px;text-decoration:none;border:2px solid ${BRAND_PRIMARY};margin-left:10px;font-family:${fontStack};">${esc(ctaSecondaryLabel)}</a>`
    : "";

  const ctaBlock = (ctaPrimary || ctaSecondary)
    ? `<div style="text-align:center;margin:28px 0;">${ctaPrimary}${ctaSecondary}</div>`
    : "";

  const helpBlock = helpHtml
    ? `<div style="background:#faf9ff;border-left:4px solid ${helpBorder};padding:14px 18px;font-size:13px;color:${BRAND_TEXT_BODY};margin-top:8px;line-height:1.6;font-family:${fontStack};">${helpHtml}</div>`
    : `<div style="background:#faf9ff;border-left:4px solid ${BRAND_PRIMARY};padding:14px 18px;font-size:13px;color:${BRAND_TEXT_BODY};margin-top:8px;line-height:1.6;font-family:${fontStack};"><strong style="color:${BRAND_DARK};">Besoin d'aide ?</strong> Écrivez-nous à <strong style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</strong> — réponse en moins de 2h.</div>`;

  const greetingBlock = greeting
    ? `<div style="font-size:15px;color:${BRAND_DARK};margin-bottom:14px;font-weight:700;font-family:${fontStack};">${esc(greeting)}</div>`
    : "";

  const bodyTextBlock = bodyText
    ? `<div style="font-size:14px;color:${BRAND_TEXT_BODY};line-height:1.8;margin-bottom:20px;font-family:${fontStack};">${bodyText}</div>`
    : "";

  const afterCardBlock = afterCardText
    ? `<div style="font-size:14px;color:${BRAND_TEXT_BODY};line-height:1.8;margin-bottom:20px;font-family:${fontStack};">${afterCardText}</div>`
    : "";

  const heroSubBlock = heroSub
    ? `<div style="font-size:14px;color:${BRAND_TEXT_MUTED};max-width:420px;margin:0 auto;line-height:1.6;font-family:${fontStack};">${esc(heroSub)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(heroTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:${fontStack};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#ffffff;">
<tr><td align="center" style="padding:0;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;">

<!-- Top bar gradient (Violet Bold) -->
<tr><td style="height:5px;background:${BRAND_PRIMARY};line-height:5px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>

<!-- Header -->
<tr><td style="background:${BRAND_DARK};padding:24px 32px;font-family:${fontStack};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
    <td style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:2px;">NIVRA<span style="color:${BRAND_PRIMARY};">.</span></td>
    <td align="right" style="color:${BRAND_TEXT_FOOT};font-size:11px;">Sans contrat · Support québécois</td>
  </tr></table>
</td></tr>

<!-- Hero -->
<tr><td style="background:${BRAND_HERO_BG};padding:48px 32px;text-align:center;font-family:${fontStack};">
  <div style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;font-size:10px;font-weight:700;padding:4px 14px;border-radius:99px;letter-spacing:2px;margin-bottom:16px;">${esc(badge)}</div>
  <div style="font-size:28px;font-weight:800;color:${BRAND_DARK};line-height:1.2;margin-bottom:10px;">${esc(heroTitle)}</div>
  ${heroSubBlock}
</td></tr>

<!-- Body -->
<tr><td style="background:#ffffff;padding:36px 32px;font-family:${fontStack};">
  ${greetingBlock}
  ${bodyTextBlock}
  ${cardHtml}
  ${afterCardBlock}
  ${ctaBlock}
  ${helpBlock}
</td></tr>

<!-- Footer -->
<tr><td style="background:${BRAND_DARK};padding:28px 32px;text-align:center;font-family:${fontStack};">
  <div style="color:#ffffff;font-size:14px;font-weight:800;letter-spacing:2px;margin-bottom:14px;">NIVRA TELECOM</div>
  <div style="height:1px;background:${BRAND_DIVIDER};margin:12px 0;line-height:1px;font-size:0;">&nbsp;</div>
  <div style="margin-bottom:12px;">
    <a href="${PORTAL_URL}" style="color:${BRAND_TEXT_FOOT};font-size:11px;text-decoration:none;margin:0 8px;">Mon compte</a>
    <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_TEXT_FOOT};font-size:11px;text-decoration:none;margin:0 8px;">Support</a>
    <a href="${APP_URL}/legal/confidentialite" style="color:${BRAND_TEXT_FOOT};font-size:11px;text-decoration:none;margin:0 8px;">Confidentialité</a>
    <a href="${APP_URL}/desabonnement" style="color:${BRAND_TEXT_FOOT};font-size:11px;text-decoration:none;margin:0 8px;">Se désabonner</a>
  </div>
  <div style="font-size:11px;color:${BRAND_TEXT_FOOT_LOW};line-height:1.6;">© 2026 Nivra Telecom. Tous droits réservés.<br>Ce message a été envoyé car vous êtes client Nivra Telecom.</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RenderResult {
  html: string;
  subject: string;
}

export function renderQueueTemplate(
  templateKey: string,
  vars: Record<string, unknown>,
): RenderResult | null {
  const v = vars || {};
  const clientName = String(
    v.client_name || v.first_name || v.CLIENT_FIRST_NAME || v.CLIENT_NAME || "Client",
  );
  const greeting = `Bonjour ${clientName},`;
  const portalUrl = String(v.portal_url || v.PORTAL_URL || PORTAL_URL);
  const orderNum = esc(v.order_number || v.ORDER_NUMBER || v.order_id || "—");
  const accountNum = esc(v.account_number || v.ACCOUNT_NUMBER || "—");

  switch (templateKey) {
    // ===================================================================
    // ORDERS
    // ===================================================================
    case "order_submitted":
    case "order_confirmation":
    case "order_confirmed": {
      const planName = esc(v.plan_name || v.SERVICES_LIST || "Service Nivra");
      const total = money(v.monthly_total_tax_in ?? v.amount_paid_today ?? v.total ?? v.amount ?? v.MONTHLY_TOTAL);
      return {
        subject: `Commande reçue — ${orderNum}`,
        html: shell({
          preheader: `Votre commande Nivra ${orderNum} a été reçue.`,
          badge: "COMMANDE REÇUE",
          heroTitle: "Votre commande a été reçue",
          heroSub: "Nous traitons votre demande avec priorité.",
          icon: "check",
          greeting,
          bodyText: `Merci pour votre confiance. Voici le résumé de votre commande <strong style="color:#1a1a2e;">${orderNum}</strong>.`,
          cardTitle: "Détails",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Date", fmtDate(v.created_at || v.order_date || new Date().toISOString())],
            ["Service", String(planName)],
            ["Montant", String(total)],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Suivre ma commande",
        }),
      };
    }

    case "order_modified": {
      const change = esc(v.modification || v.change || "Modification de la commande");
      return {
        subject: `Commande modifiée — ${orderNum}`,
        html: shell({
          preheader: `Votre commande ${orderNum} a été mise à jour.`,
          badge: "COMMANDE MODIFIÉE",
          heroTitle: "Votre commande a été mise à jour",
          icon: "doc",
          greeting,
          bodyText: "Une modification a été appliquée à votre commande.",
          cardTitle: "Détails",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Modification", String(change)],
            ["Date", fmtDate(v.modified_at || new Date().toISOString())],
          ],
          afterCardText: `Contactez-nous à <strong style="color:#7c3aed;">${SUPPORT_EMAIL}</strong> si vous n'avez pas demandé cette modification.`,
        }),
      };
    }

    case "order_cancelled":
    case "order_canceled": {
      const reason = esc(v.reason || v.cancellation_reason || "Annulation à votre demande");
      return {
        subject: `Commande annulée — ${orderNum}`,
        html: shell({
          preheader: `Votre commande ${orderNum} a été annulée.`,
          badge: "COMMANDE ANNULÉE",
          heroTitle: "Votre commande a été annulée",
          heroSub: "Nous sommes désolés de vous voir partir.",
          icon: "x",
          greeting,
          bodyText: "Votre commande a été annulée comme demandé.",
          cardTitle: "Détails",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Date", fmtDate(v.cancelled_at || new Date().toISOString())],
            ["Raison", String(reason)],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Nous contacter",
        }),
      };
    }

    case "order_completed": {
      return {
        subject: `Commande complétée — ${orderNum}`,
        html: shell({
          preheader: `Votre commande ${orderNum} est complétée.`,
          badge: "COMMANDE COMPLÉTÉE",
          heroTitle: "Votre commande est complétée",
          icon: "check",
          greeting,
          bodyText: "Toutes les étapes de votre commande sont terminées.",
          cardTitle: "Résumé",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Date de complétion", fmtDate(v.completed_at || new Date().toISOString())],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Accéder à mon espace client",
        }),
      };
    }

    // ===================================================================
    // PAYMENTS / BILLING
    // ===================================================================
    case "payment_confirmed":
    case "payment_receipt":
    case "payment_received": {
      const invoiceNum = esc(v.invoice_number || v.INVOICE_NUMBER || "—");
      const amount = money(v.amount_paid_today ?? v.amount ?? v.total_payable ?? v.AMOUNT);
      const reference = esc(v.reference || v.payment_reference || "—");
      const method = esc(v.payment_method || v.PAYMENT_METHOD || "PayPal");
      const invoiceUrl = String(v.invoice_url || `${portalUrl}/facturation`);
      return {
        subject: `Paiement reçu — Merci`,
        html: shell({
          preheader: `Votre paiement de ${amount} a été reçu.`,
          badge: "PAIEMENT CONFIRMÉ",
          heroTitle: "Paiement reçu — Merci",
          icon: "check",
          greeting,
          bodyText: "Nous confirmons la réception de votre paiement.",
          cardTitle: "Détails",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Montant", amount],
            ["Méthode", String(method)],
            ["Référence", String(reference)],
            ["Date", fmtDate(v.payment_date || v.PAYMENT_DATE || new Date().toISOString())],
          ],
          ctaPrimaryUrl: invoiceUrl,
          ctaPrimaryLabel: "Voir ma facture",
        }),
      };
    }

    case "invoice_created":
    case "billing_renewal": {
      const invoiceNum = esc(v.invoice_number || v.INVOICE_NUMBER || "—");
      const total = money(v.total ?? v.amount ?? v.AMOUNT);
      const dueDate = fmtDate(v.due_date || v.DUE_DATE);
      return {
        subject: `Nouvelle facture — ${invoiceNum}`,
        html: shell({
          preheader: `Facture ${invoiceNum} de ${total}.`,
          badge: "NOUVELLE FACTURE",
          heroTitle: "Nouvelle facture disponible",
          icon: "doc",
          greeting,
          bodyText: "Votre nouvelle facture est disponible dans votre espace client.",
          cardTitle: "Détails de la facture",
          cardRows: [
            ["Numéro de facture", String(invoiceNum)],
            ["Date d'échéance", dueDate],
            ["Cycle", `${fmtDate(v.cycle_start)} → ${fmtDate(v.cycle_end)}`],
            ["Montant", total],
          ],
          ctaPrimaryUrl: `${portalUrl}/facturation`,
          ctaPrimaryLabel: "Payer maintenant",
        }),
      };
    }

    case "payment_reminder":
    case "payment_reminder_7days":
    case "payment_reminder_3days":
    case "payment_reminder_1day":
    case "payment_due_today": {
      const invoiceNum = esc(v.invoice_number || "—");
      const total = money(v.total ?? v.amount);
      const dueDate = fmtDate(v.due_date);
      const labels: Record<string, string> = {
        payment_reminder_7days: "Rappel — 7 jours",
        payment_reminder_3days: "Rappel — 3 jours",
        payment_reminder_1day: "Rappel — Demain",
        payment_due_today: "Échéance aujourd'hui",
      };
      const badge = (labels[templateKey] || "RAPPEL DE PAIEMENT").toUpperCase();
      return {
        subject: `Rappel — Facture ${invoiceNum}`,
        html: shell({
          preheader: `Votre facture ${invoiceNum} arrive à échéance.`,
          badge,
          heroTitle: "Rappel de paiement",
          heroSub: "Votre facture arrive à échéance prochainement.",
          icon: "alert",
          greeting,
          bodyText: "Pour éviter toute interruption de service, veuillez régler votre facture.",
          cardTitle: "Facture à payer",
          cardRows: [
            ["Numéro de facture", String(invoiceNum)],
            ["Date d'échéance", dueDate],
            ["Montant dû", total],
          ],
          ctaPrimaryUrl: `${portalUrl}/facturation`,
          ctaPrimaryLabel: "Payer maintenant",
        }),
      };
    }

    case "payment_overdue":
    case "invoice_overdue": {
      const invoiceNum = esc(v.invoice_number || v.INVOICE_NUMBER || "—");
      const total = money(v.total ?? v.amount ?? v.AMOUNT);
      const days = esc(v.days_overdue || v.DAYS_OVERDUE || "—");
      return {
        subject: `Facture en retard — ${invoiceNum}`,
        html: shell({
          preheader: `Votre facture ${invoiceNum} est en retard.`,
          badge: "FACTURE EN RETARD",
          heroTitle: "Votre facture est en retard",
          heroSub: "Une action est requise pour éviter la suspension du service.",
          icon: "alert",
          greeting,
          bodyText: "Votre facture est en retard. Veuillez la régler rapidement.",
          cardTitle: "Détails de la facture",
          cardRows: [
            ["Facture", String(invoiceNum)],
            ["Jours de retard", String(days)],
            ["Date d'échéance", fmtDate(v.due_date || v.DUE_DATE)],
            ["Montant dû", total],
          ],
          ctaPrimaryUrl: `${portalUrl}/facturation`,
          ctaPrimaryLabel: "Payer maintenant",
          helpVariant: "warning",
          helpHtml: `<strong style="color:#1a1a2e;">Attention :</strong> Sans paiement rapide, votre service pourrait être suspendu.`,
        }),
      };
    }

    case "payment_failed":
    case "paypal_charge_failed_retry": {
      const amount = money(v.amount ?? v.total ?? v.amount_due ?? v.AMOUNT);
      const paymentUrl = String(v.payment_url || `${portalUrl}/facturation`);
      return {
        subject: `Action requise — Paiement non traité`,
        html: shell({
          preheader: `Votre paiement n'a pas été traité.`,
          badge: "ACTION REQUISE",
          heroTitle: "Votre paiement n'a pas été traité",
          icon: "alert",
          greeting,
          bodyText: "Le traitement de votre paiement a échoué. Mettez à jour votre méthode de paiement pour éviter toute interruption.",
          cardTitle: "Détails",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Montant dû", amount],
          ],
          ctaPrimaryUrl: paymentUrl,
          ctaPrimaryLabel: "Mettre à jour mon paiement",
          helpVariant: "warning",
          helpHtml: `<strong style="color:#1a1a2e;">Important :</strong> Sans mise à jour, votre service pourrait être suspendu.`,
        }),
      };
    }

    case "invoice_voided": {
      const invoiceNum = esc(v.invoice_number || "—");
      return {
        subject: `Facture annulée — ${invoiceNum}`,
        html: shell({
          preheader: `Votre facture ${invoiceNum} a été annulée.`,
          badge: "FACTURE ANNULÉE",
          heroTitle: "Votre facture a été annulée",
          icon: "x",
          greeting,
          bodyText: "La facture mentionnée a été annulée. Aucun montant n'est dû.",
          cardTitle: "Facture annulée",
          cardRows: [
            ["Numéro", String(invoiceNum)],
            ["Date d'annulation", fmtDate(v.voided_at || new Date().toISOString())],
          ],
        }),
      };
    }

    case "invoice_suspension_warning": {
      const invoiceNum = esc(v.invoice_number || "—");
      const total = money(v.total ?? v.amount);
      return {
        subject: `Avertissement — Risque de suspension`,
        html: shell({
          preheader: `Votre service risque la suspension.`,
          badge: "AVERTISSEMENT",
          heroTitle: "Risque de suspension de service",
          heroSub: "Votre facture impayée peut entraîner la suspension de vos services.",
          icon: "alert",
          greeting,
          bodyText: "Veuillez régler votre facture pour éviter toute interruption.",
          cardTitle: "Facture impayée",
          cardRows: [
            ["Numéro", String(invoiceNum)],
            ["Date d'échéance", fmtDate(v.due_date)],
            ["Montant dû", total],
          ],
          ctaPrimaryUrl: `${portalUrl}/facturation`,
          ctaPrimaryLabel: "Payer maintenant",
          helpVariant: "warning",
          helpHtml: `<strong style="color:#1a1a2e;">Attention :</strong> Sans paiement, votre service sera suspendu.`,
        }),
      };
    }

    case "service_suspended": {
      return {
        subject: `Service suspendu`,
        html: shell({
          preheader: `Votre service a été suspendu.`,
          badge: "SERVICE SUSPENDU",
          heroTitle: "Votre service a été suspendu",
          heroSub: "Votre service est interrompu en raison d'un solde impayé.",
          icon: "alert",
          greeting,
          bodyText: "Pour réactiver votre service, veuillez régler votre solde.",
          cardTitle: "Détails",
          cardRows: [
            ["Compte", `#${String(accountNum).replace(/^#/, "")}`],
            ["Date de suspension", fmtDate(v.suspended_at || new Date().toISOString())],
            ["Solde dû", money(v.balance_due ?? v.amount)],
          ],
          ctaPrimaryUrl: `${portalUrl}/facturation`,
          ctaPrimaryLabel: "Régler maintenant",
          helpVariant: "warning",
          helpHtml: `<strong style="color:#1a1a2e;">Réactivation :</strong> Le service est réactivé automatiquement après réception du paiement.`,
        }),
      };
    }

    case "service_reactivated": {
      return {
        subject: `Service réactivé`,
        html: shell({
          preheader: `Votre service a été réactivé.`,
          badge: "SERVICE RÉACTIVÉ",
          heroTitle: "Votre service a été réactivé",
          icon: "check",
          greeting,
          bodyText: "Bonne nouvelle — votre service est de nouveau actif.",
          cardTitle: "Détails",
          cardRows: [
            ["Compte", `#${String(accountNum).replace(/^#/, "")}`],
            ["Date de réactivation", fmtDate(v.reactivated_at || new Date().toISOString())],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Accéder à mon espace client",
        }),
      };
    }

    // ===================================================================
    // KYC / IDENTITY
    // ===================================================================
    case "kyc_document_required":
    case "identity_verification_requested": {
      const verificationUrl = String(v.verification_url || `${portalUrl}/kyc`);
      const expires = fmtDate(v.expires_at || v.EXPIRES_AT);
      return {
        subject: `Vérification d'identité requise — Commande ${orderNum}`,
        html: shell({
          preheader: `Soumettez votre pièce d'identité pour activer votre service.`,
          badge: "VÉRIFICATION REQUISE",
          heroTitle: "Vérification d'identité requise",
          heroSub: "Pour activer votre service, nous devons vérifier votre identité.",
          icon: "doc",
          greeting,
          bodyText: "Soumettez une pièce d'identité valide (passeport, permis de conduire ou carte d'identité).",
          cardTitle: "Détails",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Expire le", expires],
          ],
          ctaPrimaryUrl: verificationUrl,
          ctaPrimaryLabel: "Soumettre mes documents",
        }),
      };
    }

    case "kyc_approved":
    case "identity_verified": {
      return {
        subject: `Votre identité a été vérifiée — Nivra`,
        html: shell({
          preheader: `Votre identité a été vérifiée avec succès.`,
          badge: "IDENTITÉ VÉRIFIÉE",
          heroTitle: "Votre identité a été vérifiée",
          heroSub: "Votre dossier est complet.",
          icon: "check",
          greeting,
          bodyText: "Merci d'avoir soumis vos documents. Tout est en ordre.",
          cardTitle: "Détails",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Statut", "Approuvé"],
            ["Date", fmtDate(v.verified_at || new Date().toISOString())],
          ],
        }),
      };
    }

    case "kyc_rejected":
    case "identity_rejected": {
      const verificationUrl = String(v.verification_url || `${portalUrl}/kyc`);
      const reason = esc(v.reason || v.rejection_reason || "Document non valide");
      return {
        subject: `Action requise — Document d'identité refusé`,
        html: shell({
          preheader: `Votre document n'a pas pu être vérifié.`,
          badge: "ACTION REQUISE",
          heroTitle: "Document d'identité refusé",
          icon: "alert",
          greeting,
          bodyText: "Veuillez soumettre un nouveau document pour finaliser votre vérification.",
          cardTitle: "Détails",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Raison", String(reason)],
          ],
          ctaPrimaryUrl: verificationUrl,
          ctaPrimaryLabel: "Resoumettre",
        }),
      };
    }

    // ===================================================================
    // SIM / MOBILE / PORT-IN
    // ===================================================================
    case "sim_activated": {
      const phone = esc(v.phone_number || v.PHONE_NUMBER || "—");
      const iccid = esc(v.iccid || v.ICCID || "—");
      const carrier = esc(v.carrier || v.CARRIER || "Nivra Telecom");
      const plan = esc(v.plan || v.PLAN || "—");
      return {
        subject: `Votre SIM Nivra est active — ${phone}`,
        html: shell({
          preheader: `Votre SIM ${phone} est active.`,
          badge: "SIM ACTIVÉE",
          heroTitle: "Votre SIM Nivra est active",
          icon: "phone",
          greeting,
          bodyText: "Votre carte SIM est maintenant active. Voici vos informations.",
          cardTitle: "Détails",
          cardRows: [
            ["Numéro", String(phone)],
            ["ICCID", String(iccid)],
            ["Opérateur", String(carrier)],
            ["Forfait", String(plan)],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Mon compte",
        }),
      };
    }

    case "esim_ready": {
      const phone = esc(v.phone_number || v.PHONE_NUMBER || "—");
      const eid = esc(v.eid || v.EID || "—");
      return {
        subject: `Votre eSIM est prête à installer`,
        html: shell({
          preheader: `Votre eSIM est prête.`,
          badge: "ESIM PRÊTE",
          heroTitle: "Votre eSIM est prête à installer",
          heroSub: "Scannez le QR code pour activer votre eSIM.",
          icon: "phone",
          greeting,
          bodyText: "<strong style=\"color:#1a1a2e;\">Instructions :</strong> Allez dans Réglages → Données cellulaires → Ajouter un forfait → Scanner le QR code.",
          cardTitle: "Détails",
          cardRows: [
            ["EID", String(eid)],
            ["Numéro", String(phone)],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Voir mes instructions",
        }),
      };
    }

    case "portin_initiated": {
      const phone = esc(v.phone_number || "—");
      const currentOp = esc(v.current_operator || "—");
      return {
        subject: `Transfert de votre numéro en cours`,
        html: shell({
          preheader: `Transfert de ${phone} en cours.`,
          badge: "TRANSFERT EN COURS",
          heroTitle: "Transfert de votre numéro en cours",
          heroSub: "Gardez votre ancienne SIM active jusqu'à confirmation du transfert.",
          icon: "phone",
          greeting,
          bodyText: "Nous avons reçu votre demande de transfert. Le processus est en cours.",
          cardTitle: "Détails du transfert",
          cardRows: [
            ["Numéro", String(phone)],
            ["Opérateur actuel", String(currentOp)],
            ["Délai estimé", "2 à 4 heures ouvrables"],
          ],
          helpVariant: "warning",
          helpHtml: `<strong style="color:#1a1a2e;">Important :</strong> Ne résiliez pas votre ancien forfait avant de recevoir la confirmation.`,
        }),
      };
    }

    case "portin_completed": {
      const phone = esc(v.phone_number || "—");
      return {
        subject: `Votre numéro ${phone} a été transféré`,
        html: shell({
          preheader: `Transfert complété.`,
          badge: "TRANSFERT COMPLÉTÉ",
          heroTitle: "Votre numéro a été transféré",
          icon: "check",
          greeting,
          bodyText: "Bonne nouvelle — votre numéro est maintenant actif sur le réseau Nivra.",
          cardTitle: "Détails",
          cardRows: [
            ["Numéro", String(phone)],
            ["Statut", "Actif"],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Mon compte",
        }),
      };
    }

    case "portin_failed": {
      const phone = esc(v.phone_number || "—");
      const reason = esc(v.reason || "Transfert refusé par l'opérateur d'origine");
      return {
        subject: `Problème avec le transfert de votre numéro`,
        html: shell({
          preheader: `Le transfert de ${phone} a échoué.`,
          badge: "TRANSFERT ÉCHOUÉ",
          heroTitle: "Problème avec le transfert de votre numéro",
          icon: "alert",
          greeting,
          bodyText: "Le transfert n'a pas pu être complété. Notre équipe peut vous aider à résoudre le problème.",
          cardTitle: "Détails",
          cardRows: [
            ["Numéro", String(phone)],
            ["Raison", String(reason)],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Contacter le support",
        }),
      };
    }

    // ===================================================================
    // APPOINTMENTS
    // ===================================================================
    case "appointment_scheduled":
    case "appointment_confirmed": {
      const date = fmtDate(v.appointment_date || v.APPOINTMENT_DATE || v.date || v.scheduled_at);
      const time = esc(v.appointment_time || v.APPOINTMENT_TIME || v.time || "—");
      const tech = esc(v.technician_name || v.TECHNICIAN_NAME || "À confirmer");
      const address = esc(v.address || v.APPOINTMENT_ADDRESS_LINE1 || "—");
      return {
        subject: `Installation confirmée — ${date}`,
        html: shell({
          preheader: `Votre installation est confirmée pour le ${date}.`,
          badge: "RENDEZ-VOUS CONFIRMÉ",
          heroTitle: `Installation confirmée — ${date}`,
          icon: "calendar",
          greeting,
          bodyText: "Votre installation est confirmée. Voici les détails.",
          cardTitle: "Détails",
          cardRows: [
            ["Date", date],
            ["Heure", String(time)],
            ["Technicien", String(tech)],
            ["Adresse", String(address)],
          ],
        }),
      };
    }

    case "appointment_reminder":
    case "appointment_reminder_24h": {
      const date = fmtDate(v.appointment_date || v.date);
      const time = esc(v.appointment_time || v.time || "—");
      const tech = esc(v.technician_name || "À confirmer");
      return {
        subject: `Rappel — Installation demain à ${time}`,
        html: shell({
          preheader: `Votre installation est demain à ${time}.`,
          badge: "RAPPEL — DEMAIN",
          heroTitle: "Votre installation est demain",
          icon: "calendar",
          greeting,
          bodyText: "Petit rappel — votre rendez-vous d'installation est demain.",
          cardTitle: "Détails",
          cardRows: [
            ["Date", date],
            ["Heure", String(time)],
            ["Technicien", String(tech)],
          ],
        }),
      };
    }

    case "appointment_reminder_2h":
    case "technician_on_the_way": {
      const tech = esc(v.technician_name || "À confirmer");
      const eta = esc(v.eta || v.arrival_time || "Dans environ 2 heures");
      return {
        subject: `Votre technicien arrive bientôt`,
        html: shell({
          preheader: `Le technicien arrive bientôt.`,
          badge: "DANS 2 HEURES",
          heroTitle: "Votre technicien arrive bientôt",
          icon: "calendar",
          greeting,
          bodyText: "Notre technicien sera bientôt chez vous.",
          cardTitle: "Détails",
          cardRows: [
            ["Technicien", String(tech)],
            ["Heure estimée", String(eta)],
          ],
        }),
      };
    }

    case "appointment_missed_by_client": {
      const date = fmtDate(v.date || v.appointment_date);
      const time = esc(v.time || v.appointment_time || "—");
      const rebookingUrl = String(v.rebooking_url || `${portalUrl}/rendez-vous`);
      return {
        subject: `Rendez-vous manqué — Replanifiez votre installation`,
        html: shell({
          preheader: `Notre technicien s'est présenté mais personne n'était disponible.`,
          badge: "RENDEZ-VOUS MANQUÉ",
          heroTitle: "Nous avons raté votre rendez-vous",
          icon: "alert",
          greeting,
          bodyText: "Vous pouvez replanifier votre installation à tout moment depuis votre espace client.",
          cardTitle: "Détails",
          cardRows: [
            ["Date", date],
            ["Heure", String(time)],
          ],
          ctaPrimaryUrl: rebookingUrl,
          ctaPrimaryLabel: "Replanifier",
        }),
      };
    }

    case "appointment_cancelled_by_nivra": {
      return {
        subject: `Votre rendez-vous a été annulé`,
        html: shell({
          preheader: `Votre rendez-vous a été annulé par Nivra.`,
          badge: "ANNULÉ",
          heroTitle: "Votre rendez-vous a été annulé",
          icon: "x",
          greeting,
          bodyText: "Notre équipe vous contactera sous 24h.",
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Nous contacter",
        }),
      };
    }

    // ===================================================================
    // EQUIPMENT / SHIPPING
    // ===================================================================
    case "equipment_shipped": {
      const carrier = esc(v.carrier || v.shipping_carrier || "—");
      const tracking = esc(v.tracking_number || "—");
      const trackingUrl = String(v.tracking_url || `${portalUrl}/livraison`);
      return {
        subject: `Votre équipement est en route`,
        html: shell({
          preheader: `Votre équipement Nivra est en livraison.`,
          badge: "EN LIVRAISON",
          heroTitle: "Votre équipement est en route",
          icon: "truck",
          greeting,
          bodyText: "Votre équipement vient d'être expédié.",
          cardTitle: "Détails",
          cardRows: [
            ["Transporteur", String(carrier)],
            ["Suivi", String(tracking)],
            ["Délai estimé", "3 à 5 jours ouvrables"],
          ],
          ctaPrimaryUrl: trackingUrl,
          ctaPrimaryLabel: "Suivre mon colis",
        }),
      };
    }

    case "equipment_delivered": {
      return {
        subject: `Votre équipement a été livré`,
        html: shell({
          preheader: `Votre équipement Nivra est arrivé.`,
          badge: "LIVRÉ",
          heroTitle: "Votre équipement a été livré",
          icon: "check",
          greeting,
          bodyText: "Votre équipement Nivra est arrivé. Suivez le guide d'installation inclus dans la boîte.",
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Guide d'installation",
        }),
      };
    }

    // ===================================================================
    // SERVICE / WELCOME
    // ===================================================================
    case "service_activated":
    case "installation_completed": {
      const service = esc(v.service || v.plan_name || v.SERVICES_LIST || "Service Nivra");
      return {
        subject: `Votre service est maintenant actif`,
        html: shell({
          preheader: `Votre service ${service} est actif.`,
          badge: "SERVICE ACTIF",
          heroTitle: "Votre service est maintenant actif",
          icon: "check",
          greeting,
          bodyText: `Bonne nouvelle — votre service <strong style="color:#1a1a2e;">${service}</strong> est maintenant actif.`,
          cardTitle: "Détails",
          cardRows: [
            ["Service", String(service)],
            ["Compte", `#${String(accountNum).replace(/^#/, "")}`],
            ["Date activation", fmtDate(v.activated_at || new Date().toISOString())],
            ["Cycle de facturation", esc(v.billing_cycle || "Mensuel")],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Mon espace client",
        }),
      };
    }

    case "welcome_to_nivra":
    case "welcome_new_client":
    case "account_created": {
      const service = esc(v.service_type || v.plan_name || v.SERVICES_LIST || "Service Nivra");
      const billingDate = fmtDate(v.billing_date || v.next_billing_date);
      return {
        subject: `Bienvenue chez Nivra — Tout ce qu'il faut savoir`,
        html: shell({
          preheader: `Bienvenue chez Nivra Telecom.`,
          badge: "BIENVENUE",
          heroTitle: "Bienvenue chez Nivra Telecom",
          heroSub: "Nous sommes ravis de vous avoir parmi nous.",
          icon: "star",
          greeting,
          bodyText: "Votre compte est prêt. Connectez-vous pour tout gérer.",
          cardTitle: "Détails",
          cardRows: [
            ["Compte", `#${String(accountNum).replace(/^#/, "")}`],
            ["Service", String(service)],
            ["Date de facturation", billingDate],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Mon espace client",
        }),
      };
    }

    // ===================================================================
    // CONTRACTS
    // ===================================================================
    case "contract_ready":
    case "contract_ready_to_sign":
    case "contract_signature_request": {
      const contractUrl = String(v.contract_url || v.signature_url || `${portalUrl}/contrats`);
      const service = esc(v.service || v.plan_name || "Service Nivra");
      return {
        subject: `Votre contrat est prêt à signer`,
        html: shell({
          preheader: `Votre contrat Nivra est disponible.`,
          badge: "SIGNATURE REQUISE",
          heroTitle: "Votre contrat est prêt à signer",
          icon: "pen",
          greeting,
          bodyText: "Votre contrat de service Nivra est disponible.",
          cardTitle: "Détails",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Service", String(service)],
            ["Expire dans", "7 jours"],
          ],
          ctaPrimaryUrl: contractUrl,
          ctaPrimaryLabel: "Signer mon contrat",
        }),
      };
    }

    case "contract_reminder": {
      const contractUrl = String(v.contract_url || `${portalUrl}/contrats`);
      return {
        subject: `Votre contrat attend votre signature`,
        html: shell({
          preheader: `Votre contrat expire bientôt.`,
          badge: "RAPPEL SIGNATURE",
          heroTitle: "Votre contrat attend votre signature",
          icon: "pen",
          greeting,
          bodyText: "Votre contrat expire bientôt. Signez-le pour éviter tout délai d'activation.",
          ctaPrimaryUrl: contractUrl,
          ctaPrimaryLabel: "Signer maintenant",
        }),
      };
    }

    case "contract_signed":
    case "contract_signed_confirmation": {
      return {
        subject: `Contrat signé — Merci`,
        html: shell({
          preheader: `Votre contrat a été signé.`,
          badge: "CONTRAT SIGNÉ",
          heroTitle: "Contrat signé — Merci",
          icon: "check",
          greeting,
          bodyText: "Une copie de votre contrat est disponible dans votre espace client.",
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Voir mon contrat",
        }),
      };
    }

    case "contract_signed_admin_alert": {
      return {
        subject: `[Admin] Contrat signé — ${clientName}`,
        html: shell({
          preheader: `Notification interne — contrat signé.`,
          badge: "NOTIFICATION INTERNE",
          heroTitle: "Contrat signé",
          icon: "doc",
          bodyText: `Le client <strong style="color:#1a1a2e;">${esc(clientName)}</strong> a signé son contrat.`,
          cardTitle: "Détails",
          cardRows: [
            ["Client", String(esc(clientName))],
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Date", fmtDate(v.signed_at || new Date().toISOString())],
          ],
        }),
      };
    }

    // ===================================================================
    // QUOTES / TICKETS / MISC
    // ===================================================================
    case "quote_sent": {
      const quoteNum = esc(v.quote_number || "—");
      const total = money(v.total ?? v.amount);
      const quoteUrl = String(v.quote_url || `${APP_URL}/soumission/${esc(v.quote_id || "")}`);
      return {
        subject: `Votre soumission Nivra — ${quoteNum}`,
        html: shell({
          preheader: `Votre soumission ${quoteNum} est prête.`,
          badge: "SOUMISSION ENVOYÉE",
          heroTitle: "Votre soumission est prête",
          icon: "doc",
          greeting,
          bodyText: "Voici votre soumission personnalisée.",
          cardTitle: "Détails",
          cardRows: [
            ["Numéro", String(quoteNum)],
            ["Total estimé", total],
          ],
          ctaPrimaryUrl: quoteUrl,
          ctaPrimaryLabel: "Voir ma soumission",
        }),
      };
    }

    case "ticket_created": {
      const ticketNum = esc(v.ticket_number || v.TICKET_NUMBER || "—");
      const subject = esc(v.subject || v.SUBJECT || "Votre demande");
      return {
        subject: `Demande reçue — ${ticketNum}`,
        html: shell({
          preheader: `Votre demande ${ticketNum} a été reçue.`,
          badge: "DEMANDE REÇUE",
          heroTitle: "Nous avons reçu votre demande",
          icon: "doc",
          greeting,
          bodyText: "Notre équipe vous répondra dans les meilleurs délais.",
          cardTitle: "Détails",
          cardRows: [
            ["Numéro", String(ticketNum)],
            ["Sujet", String(subject)],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Suivre ma demande",
        }),
      };
    }

    case "autopay_activation_invitation": {
      const setupUrl = String(v.setup_url || `${portalUrl}/paiement`);
      return {
        subject: `Activez le paiement automatique`,
        html: shell({
          preheader: `Activez le paiement automatique Nivra.`,
          badge: "PAIEMENT AUTOMATIQUE",
          heroTitle: "Activez le paiement automatique",
          heroSub: "Ne ratez plus jamais une facture.",
          icon: "check",
          greeting,
          bodyText: "Activez le paiement automatique pour simplifier votre gestion mensuelle.",
          ctaPrimaryUrl: setupUrl,
          ctaPrimaryLabel: "Activer maintenant",
        }),
      };
    }

    // ===================================================================
    // ADMIN ALERTS (internal notifications)
    // ===================================================================
    case "admin_alert_suspended":
    case "admin_alert_cancelled":
    case "admin_alert_chargeback":
    case "admin_alert_anonymization":
    case "admin_overdue_daily_digest": {
      const labelMap: Record<string, { badge: string; title: string }> = {
        admin_alert_suspended: { badge: "ALERTE — SUSPENSION", title: "Compte suspendu" },
        admin_alert_cancelled: { badge: "ALERTE — ANNULATION", title: "Compte annulé" },
        admin_alert_chargeback: { badge: "ALERTE — CHARGEBACK", title: "Chargeback signalé" },
        admin_alert_anonymization: { badge: "ALERTE — ANONYMISATION", title: "Compte anonymisé" },
        admin_overdue_daily_digest: { badge: "DIGEST QUOTIDIEN", title: "Factures en retard — résumé" },
      };
      const m = labelMap[templateKey];
      const detail = esc(v.detail || v.summary || v.message || "Voir les détails dans le tableau de bord.");
      return {
        subject: `[Admin] ${m.title}`,
        html: shell({
          preheader: m.title,
          badge: m.badge,
          heroTitle: m.title,
          icon: "alert",
          bodyText: detail,
          cardTitle: "Référence",
          cardRows: [
            ["Client", String(esc(clientName))],
            ["Compte", `#${String(accountNum).replace(/^#/, "")}`],
            ["Date", fmtDate(new Date().toISOString())],
          ],
          ctaPrimaryUrl: `${APP_URL}/core`,
          ctaPrimaryLabel: "Ouvrir Nivra Core",
        }),
      };
    }

    // ===================================================================
    // GENERIC FALLBACK
    // ===================================================================
    case "order_update":
    case "custom_html": {
      const subject = String(v.subject || v._subject || "Mise à jour Nivra");
      const message = String(v.message || v.body || "Une mise à jour concernant votre compte est disponible.");
      return {
        subject,
        html: shell({
          preheader: subject,
          badge: "MISE À JOUR",
          heroTitle: subject,
          icon: "doc",
          greeting,
          bodyText: esc(message),
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Accéder à mon espace client",
        }),
      };
    }

    default:
      return null;
  }
}
