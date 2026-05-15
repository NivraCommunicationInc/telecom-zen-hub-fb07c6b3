/**
 * RÈGLE ABSOLUE — TEMPLATES EMAIL
 *
 * 1. Utiliser shell() Violet Bold pour TOUS les emails
 * 2. JAMAIS de HTML inline
 * 3. JAMAIS afficher "---", undefined, null ou vide
 * 4. TOUJOURS utiliser formatMoney() pour les montants
 * 5. TOUJOURS utiliser fmtDate() pour les dates
 * 6. TOUJOURS avoir un fallback significatif
 * 7. Cette règle s'applique à TOUS les emails
 *    présents et futurs sans exception
 */

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

/**
 * Robust monetary formatter — French Canadian (fr-CA).
 * Always returns a non-empty, human-readable string.
 *  - null / undefined / "" / NaN  → "0,00 $"
 *  - 129.9                         → "129,90 $"
 * Never returns "---", "undefined", "null", or empty.
 */
export function formatMoney(amount: unknown): string {
  if (amount === null || amount === undefined || amount === "") return "0,00 $";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (!isFinite(num) || isNaN(num)) return "0,00 $";
  return num.toLocaleString("fr-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " $";
}

/**
 * Robust date formatter — French Canadian (fr-CA).
 * Always returns a non-empty, human-readable string.
 *  - null / undefined / invalid  → "Date non disponible"
 *  - "2026-04-27"                 → "27 avril 2026"
 * Never returns "---", "Invalid Date", "undefined", or empty.
 */
export function fmtDate(d: unknown): string {
  if (d === null || d === undefined || d === "") return "Bientôt";
  const s = String(d).trim();
  if (!s) return "Bientôt";
  // Already a human-readable / pre-formatted string (contains French month
  // names, weekday names, or any non-ISO words) — return as-is.
  const FRENCH_TOKENS = /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|jours?|heures?|à compter)/i;
  if (FRENCH_TOKENS.test(s)) return s;
  try {
    const date = new Date(s);
    if (isNaN(date.getTime())) return s; // unparseable → return original string, never "Date non disponible"
    return date.toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

// Backwards-compatible alias used throughout this file.
const money = formatMoney;

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

// All rendering is delegated to the central Nivra shell so every email in
// the system shares the exact same "Service Activé" violet design.
import { violetShell } from "./violetEmailShell.ts";

function shell(opts: ShellOpts): string {
  // `bodyText` is treated as already-safe HTML by callers in this file
  // (they pass plain text or pre-escaped strings). The central shell expects
  // `bodyHtml`, so we forward it as-is.
  return violetShell({
    preheader: opts.preheader,
    badge: opts.badge,
    heroTitle: opts.heroTitle,
    heroSub: opts.heroSub,
    greeting: opts.greeting,
    bodyHtml: opts.bodyText,
    cardTitle: opts.cardTitle,
    cardRows: opts.cardRows,
    cardEmphasizeLast: opts.cardEmphasizeLast,
    ctaPrimaryUrl: opts.ctaPrimaryUrl,
    ctaPrimaryLabel: opts.ctaPrimaryLabel,
    ctaSecondaryUrl: opts.ctaSecondaryUrl,
    ctaSecondaryLabel: opts.ctaSecondaryLabel,
    helpHtml: opts.helpHtml,
    helpVariant: opts.helpVariant,
    afterCardHtml: opts.afterCardText,
  });
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
  const orderNum = esc(v.order_number || v.ORDER_NUMBER || v.order_id || "N/A");
  const accountNum = esc(v.account_number || v.ACCOUNT_NUMBER || "Non spécifié");

  switch (templateKey) {
    // ===================================================================
    // HUB BOUTIQUE — order status update
    // ===================================================================
    case "hub_order_status_update": {
      const hubOrderNum = esc(v.order_number || "ORD-XXXXX");
      const product = esc(v.product_name || "Votre article");
      const sizeLabel = esc(v.size || "");
      const newStatus = esc(v.new_status || "Mis à jour");
      const trackingNum = esc(v.tracking_number || "");
      const trackingUrl = String(v.tracking_url || "");
      const deliveryName = esc(v.delivery_name || "");
      const deliveryAddress = esc(v.delivery_address || "");

      const cardRows: [string, string][] = [
        ["Numéro de commande", `#${String(hubOrderNum).replace(/^#/, "")}`],
        ["Produit", sizeLabel ? `${product} — ${sizeLabel}` : product],
        ["Statut", newStatus],
      ];
      if (trackingNum) cardRows.push(["Numéro de suivi", trackingNum]);
      if (deliveryAddress) cardRows.push(["Livraison à", `${deliveryName ? deliveryName + " — " : ""}${deliveryAddress}`]);

      return {
        subject: `Mise à jour commande ${hubOrderNum} — Nivra Telecom`,
        html: shell({
          preheader: `Mise à jour de votre commande Nivra ${hubOrderNum}.`,
          badge: "COMMANDE NIVRA",
          heroTitle: "Statut de votre commande mis à jour",
          heroSub: `Commande ${hubOrderNum}`,
          icon: "check",
          greeting: `Bonjour ${deliveryName || clientName},`,
          bodyText: `Le statut de votre commande Nivra a été mis à jour.`,
          cardTitle: "Détails de la commande",
          cardRows,
          ctaPrimaryUrl: trackingUrl || portalUrl,
          ctaPrimaryLabel: trackingUrl ? "Suivre ma commande" : "Voir mon portail",
          helpHtml: `Questions ? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

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
      const invoiceNum = esc(v.invoice_number || v.INVOICE_NUMBER || "En cours");
      const amount = money(v.amount_paid_today ?? v.amount ?? v.total_payable ?? v.AMOUNT);
      const reference = esc(v.reference || v.payment_reference || "Non disponible");
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
      const invoiceNum = esc(v.invoice_number || v.INVOICE_NUMBER || "En cours");
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
      const invoiceNum = esc(v.invoice_number || "En cours");
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
      const invoiceNum = esc(v.invoice_number || v.INVOICE_NUMBER || "En cours");
      const total = money(v.total ?? v.amount ?? v.AMOUNT);
      const days = esc(v.days_overdue || v.DAYS_OVERDUE || "0");
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
      const invoiceNum = esc(v.invoice_number || "En cours");
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
      const invoiceNum = esc(v.invoice_number || "En cours");
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
      const phone = esc(v.phone_number || v.PHONE_NUMBER || "Non disponible");
      const iccid = esc(v.iccid || v.ICCID || "Non disponible");
      const carrier = esc(v.carrier || v.CARRIER || "Nivra Telecom");
      const plan = esc(v.plan || v.PLAN || "Non disponible");
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
      const phone = esc(v.phone_number || v.PHONE_NUMBER || "Non disponible");
      const eid = esc(v.eid || v.EID || "Non disponible");
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
      const phone = esc(v.phone_number || "Non disponible");
      const currentOp = esc(v.current_operator || "Non disponible");
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
      const phone = esc(v.phone_number || "Non disponible");
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
      const phone = esc(v.phone_number || "Non disponible");
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
      const time = esc(v.appointment_time || v.APPOINTMENT_TIME || v.time || "Non disponible");
      const tech = esc(v.technician_name || v.TECHNICIAN_NAME || "À confirmer");
      const address = esc(v.address || v.APPOINTMENT_ADDRESS_LINE1 || "Non disponible");
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
      const time = esc(v.appointment_time || v.time || "Non disponible");
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
      const time = esc(v.time || v.appointment_time || "Non disponible");
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
      const carrier = esc(v.carrier || v.shipping_carrier || "Non disponible");
      const tracking = esc(v.tracking_number || "Non disponible");
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
      const service = esc(v.service || v.service_type || v.plan_name || v.SERVICES_LIST || "Service Nivra");
      const phone = v.phone_number || v.PHONE_NUMBER;
      const iccid = v.iccid || v.ICCID;
      const carrier = v.carrier || v.CARRIER;
      const rows: Array<[string, string]> = [
        ["Service", String(service)],
        ["Compte", `#${String(accountNum).replace(/^#/, "")}`],
        ["Date activation", fmtDate(v.activated_at || new Date().toISOString())],
        ["Cycle de facturation", esc(v.billing_cycle || "Mensuel")],
      ];
      if (phone) rows.splice(1, 0, ["Numéro", esc(phone)]);
      if (iccid) rows.splice(2, 0, ["ICCID", esc(iccid)]);
      if (carrier) rows.push(["Opérateur", esc(carrier)]);
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
          cardRows: rows,
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
      const contractUrl = "https://nivra-telecom.ca/portal/contracts";
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
      const contractUrl = "https://nivra-telecom.ca/portal/contracts";
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
      const quoteNum = esc(v.quote_number || "Non disponible");
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
      const ticketNum = esc(v.ticket_number || v.TICKET_NUMBER || "Non disponible");
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

    case "kyc_request_client": {
      const idType = esc(v.requested_id_type || v.id_type || "Pièce d'identité");
      const reason = esc(v.reason || v.notes || "Vérification requise");
      const verificationUrl = String(v.verification_url || `${portalUrl}/identite`);
      return {
        subject: "Vérification d'identité requise — Nivra",
        html: shell({
          preheader: "Une vérification d'identité est requise pour votre dossier Nivra.",
          badge: "VÉRIFICATION KYC",
          heroTitle: "Vérification d'identité requise",
          heroSub: "Veuillez compléter la demande dans votre espace client.",
          icon: "doc",
          greeting,
          bodyText: "Une vérification d'identité est nécessaire pour continuer le traitement de votre dossier.",
          cardTitle: "Détails de la demande",
          cardRows: [
            ["Type de pièce", String(idType)],
            ["Raison", String(reason)],
            ["Date", fmtDate(new Date().toISOString())],
          ],
          ctaPrimaryUrl: verificationUrl,
          ctaPrimaryLabel: "Compléter la vérification",
        }),
      };
    }

    case "ticket_assigned_notification":
    case "ticket_assigned": {
      const ticketNum = esc(v.ticket_number || v.TICKET_NUMBER || "Non disponible");
      const subject = esc(v.subject || v.SUBJECT || "Nouveau ticket");
      const priority = esc(v.priority || "normal");
      const clientLine = esc(v.client_label || v.client_name || v.client_email || "Non disponible");
      const desc = String(v.description || v.DESCRIPTION || "").slice(0, 600);
      const assigneeName = String(v.assignee_name || v.client_name || "Agent");
      return {
        subject: `Nouveau ticket assigné — ${ticketNum}`,
        html: shell({
          preheader: `Ticket ${ticketNum} vous a été assigné.`,
          badge: "TICKET ASSIGNÉ",
          heroTitle: "Un nouveau ticket vous a été assigné",
          heroSub: "Veuillez en prendre connaissance dès que possible.",
          icon: "alert",
          greeting: `Bonjour ${assigneeName},`,
          bodyText: desc ? `<strong>Description:</strong> ${esc(desc)}` : "Consultez le ticket pour plus de détails.",
          cardTitle: "Détails du ticket",
          cardRows: [
            ["Numéro", String(ticketNum)],
            ["Sujet", String(subject)],
            ["Priorité", String(priority).toUpperCase()],
            ["Client", String(clientLine)],
          ],
          ctaPrimaryUrl: `${APP_URL}/employee/support`,
          ctaPrimaryLabel: "Voir le ticket",
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

    // -------------------------------------------------------------------
    // AUTOPAY — Activation confirmation (sent after PayPal subscription is verified ACTIVE)
    // -------------------------------------------------------------------
    case "autopay_activated": {
      const subId = String(v.paypal_subscription_id || v.subscription_id || "");
      const subRef = subId ? subId.slice(-8).toUpperCase() : "N/A";
      const activatedAt = fmtDate(v.activated_at || new Date().toISOString());
      const manageUrl = String(v.manage_url || `${portalUrl}/paiement`);
      const detailsBody =
        `<strong style="color:#1a1a2e;">Votre paiement pré-autorisé est maintenant actif.</strong><br/><br/>` +
        `Vos factures mensuelles seront prélevées automatiquement sur votre mode de paiement PayPal.<br/><br/>` +
        `<strong style="color:#7c3aed;">Vous bénéficiez d'un rabais de 5,00 $/mois</strong> tant que ` +
        `votre paiement automatique est actif. Ce rabais est appliqué automatiquement sur chaque facture mensuelle.<br/><br/>` +
        `<strong style="color:#1a1a2e;">Comment ça fonctionne :</strong> chaque mois, votre facture est générée ` +
        `5 jours avant votre date de cycle. Le paiement est prélevé automatiquement avant votre date d'échéance. ` +
        `Vous recevrez un reçu de paiement par courriel après chaque prélèvement.<br/><br/>` +
        `<strong style="color:#1a1a2e;">Comment désactiver :</strong> rendez-vous dans votre portail client à la ` +
        `section <em>Mode de paiement</em>. Le rabais de 5 $/mois sera retiré automatiquement au prochain cycle de facturation.`;
      return {
        subject: `Paiement automatique activé — Nivra Telecom`,
        html: shell({
          preheader: `Votre paiement pré-autorisé Nivra est actif. Rabais de 5 $/mois appliqué.`,
          badge: "PAIEMENT AUTOMATIQUE ACTIVÉ",
          heroTitle: "Paiement automatique activé ✓",
          heroSub: "Vos prochaines factures seront prélevées automatiquement.",
          icon: "check",
          greeting,
          bodyText: detailsBody,
          cardTitle: "Détails de votre abonnement",
          cardRows: [
            ["Date d'activation", activatedAt],
            ["Référence PayPal", subRef],
            ["Compte", `#${String(accountNum).replace(/^#/, "")}`],
            ["Rabais mensuel", "5,00 $"],
          ],
          ctaPrimaryUrl: manageUrl,
          ctaPrimaryLabel: "Voir mon mode de paiement",
        }),
      };
    }

    // -------------------------------------------------------------------
    // AUTOPAY — Cancellation confirmation
    // -------------------------------------------------------------------
    case "autopay_cancelled":
    case "paypal_autopay_cancelled": {
      const cancelledAt = fmtDate(v.cancelled_at || new Date().toISOString());
      const billingUrl = String(v.billing_url || `${portalUrl}/facturation`);
      const cancelBody =
        `<strong style="color:#1a1a2e;">Votre paiement automatique a été désactivé.</strong><br/><br/>` +
        `Le rabais de 5,00 $/mois sera retiré à compter de votre prochain cycle de facturation.<br/><br/>` +
        `Vos prochaines factures devront être payées manuellement via votre portail client. ` +
        `Vous pouvez réactiver le paiement automatique à tout moment depuis la section ` +
        `<em>Mode de paiement</em> de votre portail.`;
      return {
        subject: `Paiement automatique désactivé — Nivra Telecom`,
        html: shell({
          preheader: `Votre paiement automatique Nivra a été désactivé.`,
          badge: "PAIEMENT AUTOMATIQUE DÉSACTIVÉ",
          heroTitle: "Paiement automatique désactivé",
          heroSub: "Vos prochaines factures devront être payées manuellement.",
          icon: "alert",
          greeting,
          bodyText: cancelBody,
          cardTitle: "Détails",
          cardRows: [
            ["Date de désactivation", cancelledAt],
            ["Compte", `#${String(accountNum).replace(/^#/, "")}`],
            ["Rabais mensuel", "Retiré au prochain cycle"],
          ],
          ctaPrimaryUrl: billingUrl,
          ctaPrimaryLabel: "Payer ma prochaine facture",
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
    // OVERDUE — Daily reminder (one email per unpaid invoice per day)
    // ===================================================================
    case "overdue_invoice_daily_reminder": {
      const invoiceNumber = esc(v.invoice_number || "En cours");
      const invoiceBalance = money(v.invoice_balance ?? 0);
      const totalAccountBalance = money(v.total_account_balance ?? 0);
      const daysOverdue = Number(v.days_overdue ?? 0);
      const dueDate = fmtDate(v.due_date);
      const payUrl = String(v.pay_balance_url || `${portalUrl}/billing`);
      const firstName = esc(v.customer_first_name || "");
      const customGreeting = firstName ? `Bonjour ${firstName},` : greeting;

      const overdueLabel = daysOverdue <= 0
        ? "Paiement dû aujourd'hui"
        : daysOverdue === 1
          ? "1 jour de retard"
          : `${daysOverdue} jours de retard`;

      return {
        subject: `Rappel — Facture ${invoiceNumber} en attente de paiement`,
        html: shell({
          preheader: `Facture ${invoiceNumber} — solde ${invoiceBalance}`,
          badge: "RAPPEL DE PAIEMENT",
          heroTitle: "Facture en attente de paiement",
          icon: "alert",
          greeting: customGreeting,
          bodyText: `Votre facture <strong>${invoiceNumber}</strong> est en attente de paiement (${overdueLabel}). Si vous avez plusieurs factures impayées, vous pouvez régler la totalité de votre solde en un seul paiement PayPal.`,
          cardTitle: "Détails de la facture",
          cardRows: [
            ["Facture", invoiceNumber],
            ["Solde de cette facture", invoiceBalance],
            ["Échéance", dueDate],
            ["Statut", overdueLabel],
            ["Solde total du compte", totalAccountBalance],
          ],
          ctaPrimaryUrl: payUrl,
          ctaPrimaryLabel: "Payer la balance complète",
        }),
      };
    }

    // ===================================================================
    // PHONE SALES (hardware orders)
    // ===================================================================
    case "phone_order_confirmed": {
      const brand = esc(v.brand || "Non disponible");
      const model = esc(v.model || "Non disponible");
      const amount = money(v.amount ?? v.total ?? v.total_payable);
      const kycUrl = String(v.kyc_url || `${portalUrl}/identite`);
      return {
        subject: `Commande confirmée — ${brand} ${model}`,
        html: shell({
          preheader: `Votre commande #${String(orderNum).replace(/^#/, "")} a été reçue.`,
          badge: "COMMANDE REÇUE",
          heroTitle: "Votre commande d'appareil est confirmée",
          icon: "phone",
          greeting,
          bodyText: `Votre commande #${String(orderNum).replace(/^#/, "")} pour ${brand} ${model} a été reçue et payée. Une vérification d'identité est requise avant l'expédition.`,
          cardTitle: "Détails de la commande",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Appareil", `${brand} ${model}`],
            ["Montant", amount],
            ["Statut", "En attente de vérification"],
          ],
          ctaPrimaryUrl: kycUrl,
          ctaPrimaryLabel: "Vérifier mon identité",
        }),
      };
    }

    case "phone_kyc_reminder": {
      const kycUrl = String(v.kyc_url || `${portalUrl}/identite`);
      return {
        subject: `Vérification d'identité requise — Commande #${String(orderNum).replace(/^#/, "")}`,
        html: shell({
          preheader: `Votre commande attend votre vérification d'identité.`,
          badge: "ACTION REQUISE",
          heroTitle: "Vérification d'identité en attente",
          icon: "alert",
          greeting,
          bodyText: `Votre commande #${String(orderNum).replace(/^#/, "")} attend votre vérification d'identité. Elle ne pourra être expédiée qu'une fois cette étape complétée.`,
          ctaPrimaryUrl: kycUrl,
          ctaPrimaryLabel: "Compléter ma vérification",
        }),
      };
    }

    case "phone_approved_shipping": {
      const carrier = esc(v.carrier || "Postes Canada");
      const tracking = esc(v.tracking_number || "Non disponible");
      const trackingUrl = String(v.tracking_url || `${portalUrl}/phones`);
      return {
        subject: `Votre appareil est en route 📦`,
        html: shell({
          preheader: `Votre appareil a été expédié.`,
          badge: "EN COURS D'EXPÉDITION",
          heroTitle: "Votre appareil est en route",
          icon: "truck",
          greeting,
          bodyText: "Votre appareil a été expédié et est en route vers vous.",
          cardTitle: "Détails d'expédition",
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

    case "phone_blocked": {
      return {
        subject: `Commande non traitée — Remboursement initié`,
        html: shell({
          preheader: `Votre commande n'a pas pu être traitée. Remboursement en cours.`,
          badge: "COMMANDE ANNULÉE",
          heroTitle: "Votre commande n'a pas pu être traitée",
          icon: "x",
          greeting,
          bodyText: "Suite à une vérification, votre commande n'a pas pu être traitée. Un remboursement a été initié via PayPal et apparaîtra dans 3 à 5 jours ouvrables.",
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Nous contacter",
        }),
      };
    }

    case "phone_return_requested_ack": {
      const brand = esc(v.brand || "Non disponible");
      const model = esc(v.model || "Non disponible");
      return {
        subject: `Demande de retour reçue — ${brand} ${model}`,
        html: shell({
          preheader: `Nous avons bien reçu votre demande de retour.`,
          badge: "DEMANDE REÇUE",
          heroTitle: "Demande de retour reçue",
          icon: "doc",
          greeting,
          bodyText: `Nous avons bien reçu votre demande de retour pour la commande #${String(orderNum).replace(/^#/, "")} (${brand} ${model}). Notre équipe l'examinera sous 24 à 48 heures.`,
          ctaPrimaryUrl: `${portalUrl}/phones`,
          ctaPrimaryLabel: "Voir ma commande",
        }),
      };
    }

    case "phone_return_confirmed": {
      return {
        subject: `Retour accepté — Étiquette à venir`,
        html: shell({
          preheader: `Votre demande de retour est acceptée.`,
          badge: "RETOUR CONFIRMÉ",
          heroTitle: "Votre demande de retour est acceptée",
          icon: "check",
          greeting,
          bodyText: "Vous recevrez une étiquette de retour prépayée par email dans les 24 à 48 heures. Le remboursement sera traité dès la réception de l'appareil dans nos entrepôts.",
          ctaPrimaryUrl: `${portalUrl}/phones`,
          ctaPrimaryLabel: "Voir ma commande",
        }),
      };
    }

    case "phone_refund_processed": {
      const amount = money(v.amount ?? v.refund_amount ?? v.total);
      return {
        subject: `Remboursement traité — ${amount}`,
        html: shell({
          preheader: `Votre remboursement de ${amount} a été traité.`,
          badge: "REMBOURSEMENT TRAITÉ",
          heroTitle: "Votre remboursement a été traité",
          icon: "check",
          greeting,
          bodyText: `Votre remboursement a été émis avec succès. Il apparaîtra sur votre compte PayPal ou votre relevé bancaire dans 3 à 5 jours ouvrables.`,
          cardTitle: "Détails du remboursement",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Montant", amount],
            ["Méthode", "PayPal"],
            ["Date", fmtDate(new Date().toISOString())],
          ],
          ctaPrimaryUrl: `${portalUrl}/phones`,
          ctaPrimaryLabel: "Voir mes commandes",
        }),
      };
    }

    // ===================================================================
    // STAFF — Field Sales invitation (Violet Bold)
    // ===================================================================
    case "staff_invitation_field_sales": {
      const firstName = esc(v.first_name || v.FIRST_NAME || "");
      const inviteUrl = String(v.invite_url || v.INVITE_URL || v.setup_link || "#");
      return {
        subject: "Invitation — Portail Nivra Field & RH",
        html: shell({
          preheader: "Vous avez été invité à rejoindre l'équipe terrain Nivra Telecom.",
          badge: "INVITATION — REPRÉSENTANT TERRAIN",
          heroTitle: "Bienvenue chez Nivra Telecom",
          heroSub: "Vous avez été ajouté comme représentant terrain.",
          icon: "star",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Vous avez été invité à rejoindre l'équipe terrain de Nivra Telecom à titre de représentant Field Sales.<br/><br/>Créez votre compte pour accéder au <strong>Portail Nivra Field</strong> et au <strong>Portail RH</strong> avec les mêmes identifiants.<br/><br/><strong style="color:#7c3aed;">Ce lien est valide 72 heures.</strong>`,
          cardTitle: "Détails de votre accès",
          cardRows: [
            ["Rôle", "Représentant terrain — Field Sales"],
            ["Portails", "Nivra Field + Portail RH"],
            ["Lien valide", "72 heures"],
          ],
          ctaPrimaryUrl: inviteUrl,
          ctaPrimaryLabel: "Créer mon compte",
        }),
      };
    }

    // ===================================================================
    // STAFF — Generic internal invitation (Violet Bold)
    // ===================================================================
    case "staff_invitation": {
      const firstName = esc(v.first_name || v.FIRST_NAME || "");
      const inviteUrl = String(v.invite_url || v.INVITE_URL || v.setup_link || "#");
      const roleLabel = esc(v.role_label || v.ROLE_LABEL || "Membre du personnel");
      return {
        subject: "Invitation interne Nivra — Activez votre compte",
        html: shell({
          preheader: "Vous avez été invité à activer votre compte interne Nivra Telecom.",
          badge: "INVITATION — ACCÈS INTERNE",
          heroTitle: "Bienvenue chez Nivra Telecom",
          heroSub: "Activez votre compte pour accéder à votre portail.",
          icon: "star",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Vous avez été invité à activer votre compte interne Nivra Telecom à titre de <strong>${roleLabel}</strong>.<br/><br/>Créez votre mot de passe et votre NIP pour accéder à votre portail.<br/><br/><strong style="color:#7c3aed;">Ce lien est valide 48 heures.</strong>`,
          cardTitle: "Détails de votre accès",
          cardRows: [
            ["Rôle", roleLabel],
            ["Lien valide", "48 heures"],
          ],
          ctaPrimaryUrl: inviteUrl,
          ctaPrimaryLabel: "Activer mon compte",
        }),
      };
    }

    // ===================================================================
    // PASSWORD RESET — Client portal, Hub (admin/employee/technician/field_sales)
    // ===================================================================
    case "password_reset":
    case "client_password_reset":
    case "staff_password_reset": {
      const resetLink = String(v.reset_link || v.reset_url || v.action_link || "#");
      const audience = String(v.audience || (templateKey === "client_password_reset" ? "client" : templateKey === "staff_password_reset" ? "staff" : "client"));
      const portalLabel = esc(v.portal_label || (audience === "staff" ? "votre portail interne Nivra" : "votre espace client Nivra"));
      const firstName = esc(v.first_name || v.FIRST_NAME || clientName);
      return {
        subject: "Réinitialisation de votre mot de passe — Nivra Télécom",
        html: shell({
          preheader: "Réinitialisez votre mot de passe Nivra en toute sécurité.",
          badge: "RÉINITIALISATION DE MOT DE PASSE",
          heroTitle: "Réinitialisez votre mot de passe",
          heroSub: "Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.",
          icon: "alert",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous avons reçu une demande de réinitialisation du mot de passe associé à ${portalLabel}.<br/><br/>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. <strong style="color:#7c3aed;">Ce lien est valide 1 heure.</strong>`,
          cardTitle: "Détails de la demande",
          cardRows: [
            ["Compte", esc(v.email || v.to_email || "Non disponible")],
            ["Type", audience === "staff" ? "Portail interne" : "Espace client"],
            ["Validité", "1 heure"],
          ],
          ctaPrimaryUrl: resetLink,
          ctaPrimaryLabel: "Réinitialiser mon mot de passe",
          helpVariant: "warning",
          helpHtml: `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message ou contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // STAFF — Welcome email after onboarding completion (Violet Bold)
    // ===================================================================
    case "staff_account_created": {
      const firstName = esc(v.first_name || v.FIRST_NAME || "");
      const portalUrlIn = String(v.portal_url || v.PORTAL_URL || "https://nivra-telecom.ca/hub/login");
      const roleLabel = esc(v.role_label || v.ROLE_LABEL || "Membre du personnel");
      return {
        subject: "Votre compte Nivra est activé",
        html: shell({
          preheader: "Votre compte interne Nivra Telecom est prêt.",
          badge: "COMPTE ACTIVÉ",
          heroTitle: "Bienvenue dans l'équipe Nivra",
          heroSub: "Votre compte est maintenant actif.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Collègue"},`,
          bodyText: `Votre compte interne Nivra Telecom à titre de <strong>${roleLabel}</strong> a été configuré avec succès.<br/><br/>Vous pouvez désormais vous connecter à votre portail à tout moment avec votre mot de passe et votre NIP.`,
          cardTitle: "Détails de votre accès",
          cardRows: [
            ["Rôle", roleLabel],
            ["Connexion", "https://nivra-telecom.ca/hub/login"],
            ["Support", SUPPORT_EMAIL],
          ],
          ctaPrimaryUrl: portalUrlIn,
          ctaPrimaryLabel: "Accéder à mon portail",
          helpHtml: `Pour toute question, écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // STAFF — Profile updated by an admin (Violet Bold)
    // ===================================================================
    case "profile_updated_notification": {
      const firstName = esc(v.first_name || v.FIRST_NAME || "");
      const portalUrlIn = String(v.portal_url || v.PORTAL_URL || "https://nivra-telecom.ca/hub/login");
      const updatedFields = esc(
        Array.isArray(v.updated_fields)
          ? (v.updated_fields as unknown[]).join(", ")
          : String(v.updated_fields || "Non disponible")
      );
      const updatedAt = esc(v.updated_at || new Date().toISOString().slice(0, 10));
      return {
        subject: "Votre profil Nivra a été mis à jour",
        html: shell({
          preheader: "Un administrateur a modifié votre profil interne Nivra.",
          badge: "MISE À JOUR DE PROFIL",
          heroTitle: "Votre profil a été modifié",
          heroSub: "Une mise à jour vient d'être appliquée à votre compte.",
          icon: "alert",
          greeting: `Bonjour ${firstName || "Collègue"},`,
          bodyText: `Un administrateur Nivra a apporté des modifications à votre profil le <strong>${updatedAt}</strong>.<br/><br/>Si vous n'avez pas autorisé ce changement, contactez immédiatement le support.`,
          cardTitle: "Détails de la mise à jour",
          cardRows: [
            ["Date", updatedAt],
            ["Champs modifiés", updatedFields],
            ["Support", SUPPORT_EMAIL],
          ],
          ctaPrimaryUrl: portalUrlIn,
          ctaPrimaryLabel: "Voir mon profil",
          helpVariant: "warning",
          helpHtml: `Si cette modification ne vient pas de vous, écrivez-nous immédiatement à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
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

    // ===================================================================
    // FIELD SALES — PayPal payment link sent by agent
    // ===================================================================
    case "payment_link_employee":
    case "field_payment_link": {
      const total = money(v.total ?? v.amount ?? v.total_amount);
      const approvalUrl = String(v.approval_url || v.approvalUrl || v.paypal_url || v.payment_url || "#");
      const orderRef = esc(v.order_number || v.ORDER_NUMBER || v.order_id || orderNum || `SUB-${Date.now().toString(36).toUpperCase().slice(0, 8)}`);
      const agentName = esc(v.agent_name || "Votre conseiller Nivra");
      const summary = esc(v.summary || v.services || v.plan_name || v.SERVICES_LIST || "Voir détails de la commande");
      const equipment = esc(v.equipment || "Aucun équipement");
      const validUntil = esc(v.valid_until || "24 heures à compter de ce courriel");
      const discountLabel = v.discount_label ? esc(String(v.discount_label)) : null;
      const rows: Array<[string, string]> = [
        ["Numéro de soumission", `#${String(orderRef).replace(/^#/, "")}`],
        ["Forfaits", String(summary)],
        ["Équipement", String(equipment)],
      ];
      if (discountLabel) rows.push(["Rabais appliqué", String(discountLabel)]);
      else if (v.discount && Number(v.discount) > 0) rows.push(["Rabais appliqué", `-${money(v.discount)}`]);
      if (v.subtotal) rows.push(["Sous-total", money(v.subtotal)]);
      if (v.tps) rows.push(["TPS (5%)", money(v.tps)]);
      if (v.tvq) rows.push(["TVQ (9,975%)", money(v.tvq)]);
      rows.push(["Total à payer", String(total)]);
      rows.push(["Méthode", "PayPal"]);
      rows.push(["Lien valide jusqu'au", String(validUntil)]);
      rows.push(["Agent responsable", String(agentName)]);
      return {
        subject: `Votre lien de paiement PayPal — ${total}`,
        html: shell({
          preheader: `Finalisez votre commande Nivra de ${total} via PayPal — lien valable 24 heures.`,
          badge: "PAIEMENT EN ATTENTE",
          heroTitle: "Votre lien de paiement est prêt",
          heroSub: `Montant : ${total}`,
          icon: "doc",
          greeting,
          bodyText: `${agentName} vient de préparer votre commande Nivra. Pour la finaliser, cliquez sur le bouton ci-dessous pour payer en toute sécurité avec PayPal (carte de crédit acceptée, aucun compte PayPal requis).`,
          cardTitle: "Récapitulatif",
          cardRows: rows,
          ctaPrimaryUrl: approvalUrl,
          ctaPrimaryLabel: "Payer maintenant avec PayPal",
          helpVariant: "warning",
          helpHtml: `<strong>Lien valable 24 heures.</strong> Passé ce délai, contactez ${agentName} ou écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // FIELD SALES — Daily payment reminder for unpaid orders
    // ===================================================================
    case "field_payment_reminder": {
      const total = money(v.total ?? v.amount ?? v.total_amount);
      const approvalUrl = String(v.payment_url || v.approval_url || v.approvalUrl || "#");
      const orderRef = esc(v.order_number || v.order_id || orderNum);
      const agentName = esc(v.agent_name || "Nivra Telecom");
      const summary = esc(v.summary || v.services || "Services Nivra");
      const validUntil = esc(v.valid_until || "Bientôt");
      const reminderIdx = Number(v.reminder_index) || 1;
      return {
        subject: "Votre commande Nivra attend votre paiement",
        html: shell({
          preheader: `Rappel ${reminderIdx}/3 — finalisez votre commande Nivra de ${total}.`,
          badge: "ACTION REQUISE",
          heroTitle: "Complétez votre commande",
          heroSub: `Montant : ${total}`,
          icon: "alert",
          greeting,
          bodyText: `Votre commande Nivra n'a pas encore été réglée. Pour ne pas la perdre, finalisez le paiement maintenant en cliquant ci-dessous (PayPal — carte de crédit acceptée, aucun compte requis).`,
          cardTitle: "Récapitulatif",
          cardRows: [
            ["Commande", `#${String(orderRef).replace(/^#/, "")}`],
            ["Services commandés", String(summary)],
            ["Total TTC", String(total)],
            ["Lien valide jusqu'au", String(validUntil)],
            ["Support", "support@nivra-telecom.ca"],
          ],
          ctaPrimaryUrl: approvalUrl,
          ctaPrimaryLabel: "Payer maintenant",
          helpVariant: "warning",
          helpHtml: `<strong>Rappel ${reminderIdx} sur 3.</strong> Sans paiement, votre commande sera annulée automatiquement.`,
        }),
      };
    }

    // ===================================================================
    // HR / RH — Employee notifications (paie, horaire, commissions)
    // All templates use the canonical violet shell. Callers pass
    // `client_name` = employee name and `portal_url` = RH portal.
    // ===================================================================
    case "hr_payslip_issued":
    case "hr_payroll_issued": {
      const periodLabel = esc(v.period_label || v.period || "Période courante");
      const grossAmount = money(v.gross_amount ?? v.gross ?? v.amount);
      const netAmount = money(v.net_amount ?? v.net ?? v.amount);
      const payDate = fmtDate(v.pay_date || v.paid_at || new Date().toISOString());
      const rhPortal = String(v.portal_url || `${APP_URL}/rh/paie`);
      return {
        subject: `Nouvelle fiche de paie — ${periodLabel}`,
        html: shell({
          preheader: `Votre fiche de paie pour ${periodLabel} est disponible.`,
          badge: "FICHE DE PAIE",
          heroTitle: "Votre paie a été traitée",
          heroSub: `Net : ${netAmount}`,
          icon: "doc",
          greeting,
          bodyText: `Votre fiche de paie pour la période <strong style="color:#1a1a2e;">${periodLabel}</strong> vient d'être émise et est désormais consultable dans votre espace RH.`,
          cardTitle: "Détails de la paie",
          cardRows: [
            ["Période", String(periodLabel)],
            ["Date de versement", payDate],
            ["Salaire brut", String(grossAmount)],
            ["Salaire net", String(netAmount)],
          ],
          ctaPrimaryUrl: rhPortal,
          ctaPrimaryLabel: "Consulter ma fiche de paie",
        }),
      };
    }

    case "hr_payroll_paid": {
      const periodLabel = esc(v.period_label || v.period || "Période courante");
      const netAmount = money(v.net_amount ?? v.net ?? v.amount);
      const payMethod = esc(v.payment_method || "Dépôt direct");
      const rhPortal = String(v.portal_url || `${APP_URL}/rh/paie`);
      return {
        subject: `Paiement effectué — ${netAmount}`,
        html: shell({
          preheader: `Votre paie de ${netAmount} a été versée.`,
          badge: "PAIEMENT EFFECTUÉ",
          heroTitle: "Votre paie a été versée",
          heroSub: `Montant net : ${netAmount}`,
          icon: "check",
          greeting,
          bodyText: `Le paiement de votre fiche de paie pour <strong style="color:#1a1a2e;">${periodLabel}</strong> vient d'être effectué.`,
          cardTitle: "Récapitulatif",
          cardRows: [
            ["Période", String(periodLabel)],
            ["Méthode", String(payMethod)],
            ["Date", fmtDate(v.paid_at || new Date().toISOString())],
            ["Montant net", String(netAmount)],
          ],
          ctaPrimaryUrl: rhPortal,
          ctaPrimaryLabel: "Voir l'historique",
        }),
      };
    }

    case "hr_schedule_created":
    case "hr_shift_created": {
      const shiftDate = fmtDate(v.shift_date || v.date);
      const startTime = esc(v.start_time || "Non disponible");
      const endTime = esc(v.end_time || "Non disponible");
      const location = esc(v.location || v.role || "Nivra");
      const rhPortal = String(v.portal_url || `${APP_URL}/rh/horaire`);
      return {
        subject: `Nouveau quart assigné — ${shiftDate}`,
        html: shell({
          preheader: `Un nouveau quart vous a été assigné le ${shiftDate}.`,
          badge: "NOUVEAU QUART",
          heroTitle: "Nouveau quart à votre horaire",
          heroSub: shiftDate,
          icon: "calendar",
          greeting,
          bodyText: `Un nouveau quart de travail vient d'être ajouté à votre horaire.`,
          cardTitle: "Détails du quart",
          cardRows: [
            ["Date", shiftDate],
            ["Début", String(startTime)],
            ["Fin", String(endTime)],
            ["Poste / lieu", String(location)],
          ],
          ctaPrimaryUrl: rhPortal,
          ctaPrimaryLabel: "Voir mon horaire",
        }),
      };
    }

    case "hr_schedule_updated":
    case "hr_shift_updated": {
      const shiftDate = fmtDate(v.shift_date || v.date);
      const startTime = esc(v.start_time || "Non disponible");
      const endTime = esc(v.end_time || "Non disponible");
      const rhPortal = String(v.portal_url || `${APP_URL}/rh/horaire`);
      return {
        subject: `Quart modifié — ${shiftDate}`,
        html: shell({
          preheader: `Votre quart du ${shiftDate} a été modifié.`,
          badge: "HORAIRE MODIFIÉ",
          heroTitle: "Votre horaire a été modifié",
          heroSub: shiftDate,
          icon: "calendar",
          greeting,
          bodyText: `Un quart à votre horaire vient d'être mis à jour. Veuillez prendre note des nouvelles informations.`,
          cardTitle: "Nouveau détail",
          cardRows: [
            ["Date", shiftDate],
            ["Début", String(startTime)],
            ["Fin", String(endTime)],
          ],
          ctaPrimaryUrl: rhPortal,
          ctaPrimaryLabel: "Consulter mon horaire",
          helpVariant: "warning",
          helpHtml: `Si ce changement vous pose problème, contactez votre superviseur ou écrivez à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    case "hr_schedule_deleted":
    case "hr_shift_deleted": {
      const shiftDate = fmtDate(v.shift_date || v.date);
      const rhPortal = String(v.portal_url || `${APP_URL}/rh/horaire`);
      return {
        subject: `Quart annulé — ${shiftDate}`,
        html: shell({
          preheader: `Votre quart du ${shiftDate} a été annulé.`,
          badge: "QUART ANNULÉ",
          heroTitle: "Un quart a été retiré de votre horaire",
          heroSub: shiftDate,
          icon: "x",
          greeting,
          bodyText: `Le quart prévu le <strong style="color:#1a1a2e;">${shiftDate}</strong> a été annulé. Vous n'avez plus à vous présenter pour cette période.`,
          ctaPrimaryUrl: rhPortal,
          ctaPrimaryLabel: "Voir mon horaire à jour",
        }),
      };
    }

    case "hr_commission_generated": {
      const amount = money(v.amount ?? v.commission_amount);
      const description = esc(v.description || v.product || "Commission de vente");
      const rhPortal = String(v.portal_url || `${APP_URL}/rh/commissions`);
      return {
        subject: `Nouvelle commission générée — ${amount}`,
        html: shell({
          preheader: `Une nouvelle commission de ${amount} vous a été attribuée.`,
          badge: "COMMISSION GÉNÉRÉE",
          heroTitle: "Une nouvelle commission s'ajoute à votre solde",
          heroSub: `Montant : ${amount}`,
          icon: "star",
          greeting,
          bodyText: `Félicitations ! Une nouvelle commission vient d'être enregistrée à votre nom.`,
          cardTitle: "Détails",
          cardRows: [
            ["Description", String(description)],
            ["Date", fmtDate(v.created_at || new Date().toISOString())],
            ["Statut", "En attente de validation"],
            ["Montant", String(amount)],
          ],
          ctaPrimaryUrl: rhPortal,
          ctaPrimaryLabel: "Voir mes commissions",
        }),
      };
    }

    case "hr_commission_paid": {
      const amount = money(v.amount ?? v.commission_amount);
      const periodLabel = esc(v.period_label || v.period || "");
      const rhPortal = String(v.portal_url || `${APP_URL}/rh/commissions`);
      return {
        subject: `Commission payée — ${amount}`,
        html: shell({
          preheader: `Votre commission de ${amount} a été versée.`,
          badge: "COMMISSION PAYÉE",
          heroTitle: "Votre commission a été versée",
          heroSub: `Montant : ${amount}`,
          icon: "check",
          greeting,
          bodyText: `Le versement de votre commission a été traité avec succès.`,
          cardTitle: "Récapitulatif",
          cardRows: [
            periodLabel ? ["Période", String(periodLabel)] : null,
            ["Date de versement", fmtDate(v.paid_at || new Date().toISOString())],
            ["Méthode", esc(v.payment_method || "Dépôt direct")],
            ["Montant", String(amount)],
          ].filter(Boolean) as Array<[string, string]>,
          ctaPrimaryUrl: rhPortal,
          ctaPrimaryLabel: "Voir l'historique",
        }),
      };
    }

    case "hr_commission_validated": {
      const amount = money(v.amount ?? v.commission_amount);
      const rhPortal = String(v.portal_url || `${APP_URL}/rh/commissions`);
      return {
        subject: `Commission validée — ${amount}`,
        html: shell({
          preheader: `Votre commission de ${amount} a été validée.`,
          badge: "COMMISSION VALIDÉE",
          heroTitle: "Votre commission a été validée",
          heroSub: `Montant : ${amount}`,
          icon: "check",
          greeting,
          bodyText: `Votre commission a été approuvée par les RH et sera versée selon le calendrier de paie en vigueur.`,
          ctaPrimaryUrl: rhPortal,
          ctaPrimaryLabel: "Voir mes commissions",
        }),
      };
    }

    // ===================================================================
    // FIELD QUOTE — Soumission préparée par un agent terrain
    // ===================================================================
    case "transaction_cancelled": {
      const orderRef = esc(v.order_number || v.order_id || orderNum);
      const reason = esc(v.reason || "Annulation par l'agent");
      const total = money(v.total ?? v.amount ?? 0);
      return {
        subject: `Votre transaction Nivra a été annulée`,
        html: shell({
          preheader: `Votre transaction Nivra ${orderRef} a été annulée.`,
          badge: "TRANSACTION ANNULÉE",
          heroTitle: "Transaction annulée",
          heroSub: `Aucun montant ne sera prélevé.`,
          icon: "alert",
          greeting,
          bodyText: `Votre transaction a été annulée par notre équipe. Aucun montant n'a été prélevé sur votre compte. Si vous souhaitez recommencer, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
          cardTitle: "Détails",
          cardRows: [
            ["Référence", `#${String(orderRef).replace(/^#/, "")}`],
            ["Montant prévu", String(total)],
            ["Motif", String(reason)],
            ["Statut", "Annulée"],
          ],
          helpVariant: "info",
          helpHtml: `Pour toute question, écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    case "quote_client":
    case "field_quote": {
      const agentName = esc(v.agent_name || v.AGENT_NAME || "Votre conseiller Nivra");
      const rawQuoteNum = String(v.quote_number || v.QUOTE_NUMBER || v.order_number || "").trim();
      const quoteNum = esc(rawQuoteNum || `SUB-${Date.now().toString(36).toUpperCase().slice(0, 8)}`);
      const services = esc(
        v.services_summary || v.SERVICES_LIST || v.services || v.plan_name ||
        "Voir détails de la commande"
      );
      const equipment = esc(
        v.equipment_summary || v.EQUIPMENT_LIST || v.equipment || "Aucun équipement"
      );
      const subtotal = money(v.subtotal ?? 0);
      const discount = money(v.discount ?? 0);
      const activationFee = money(v.activation_fee ?? 0);
      const total = money(v.total ?? v.amount ?? 0);
      const validUntil = fmtDate(
        v.valid_until_iso || v.valid_until ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      );
      const completeUrl = String(
        v.complete_url ||
          v.payment_url ||
          v.quote_url ||
          `${APP_URL}/soumission/${esc(v.quote_id || v.public_token || "")}`,
      );
      const discountLabel = v.discount_label ? esc(String(v.discount_label)) : null;
      const rows: Array<[string, string]> = [
        ["Numéro de soumission", `#${String(quoteNum).replace(/^#/, "")}`],
        ["Préparée par", String(agentName)],
        ["Forfaits", String(services)],
        ["Équipement", String(equipment)],
      ];
      if (discountLabel) rows.push(["Rabais appliqué", String(discountLabel)]);
      else if (v.discount && Number(v.discount) > 0) rows.push(["Rabais", `- ${discount}`]);
      if (v.activation_fee && Number(v.activation_fee) > 0)
        rows.push(["Frais d'activation", String(activationFee)]);
      if (v.subtotal !== undefined && v.subtotal !== null) rows.push(["Sous-total", String(subtotal)]);
      if (v.tps) rows.push(["TPS (5%)", money(v.tps)]);
      if (v.tvq) rows.push(["TVQ (9,975%)", money(v.tvq)]);
      rows.push(["Total (taxes incluses)", String(total)]);
      rows.push(["Valide jusqu'au", String(validUntil)]);
      return {
        subject: `Votre soumission Nivra Telecom — Valide 7 jours`,
        html: shell({
          preheader: `Votre soumission est prête. Valide jusqu'au ${validUntil}.`,
          badge: "SOUMISSION — VALIDE 7 JOURS",
          heroTitle: "Votre soumission est prête",
          heroSub: `Préparée par ${agentName}`,
          icon: "doc",
          greeting,
          bodyText: `Votre conseiller <strong style="color:#1a1a2e;">${agentName}</strong> a préparé une soumission personnalisée pour vous. Pour compléter votre commande, cliquez le bouton ci-dessous.`,
          cardTitle: "Résumé de la soumission",
          cardRows: rows,
          ctaPrimaryUrl: completeUrl,
          ctaPrimaryLabel: "Compléter ma commande",
          afterCardText: `Cette soumission est valide jusqu'au <strong style="color:#7c3aed;">${validUntil}</strong>.`,
        }),
      };
    }

    // ===================================================================
    // INVOICE SENT — Facture émise et disponible
    // ===================================================================
    case "invoice_sent": {
      const invoiceNum = esc(v.invoice_number || v.INVOICE_NUMBER || "En cours");
      const period = esc(v.period || v.billing_period || "Non disponible");
      const subtotal = money(v.subtotal);
      const tps = money(v.tps ?? v.gst);
      const tvq = money(v.tvq ?? v.qst);
      const total = money(v.total ?? v.amount_due ?? v.amount);
      const dueDate = fmtDate(v.due_date || v.payment_due_date);
      const invoiceUrl = String(
        v.invoice_url || v.portal_url
          ? `${String(v.portal_url || PORTAL_URL).replace(/\/$/, "")}/facturation`
          : `${PORTAL_URL}/facturation`,
      );
      return {
        subject: `Votre facture Nivra Telecom — ${invoiceNum}`,
        html: shell({
          preheader: `Votre facture ${invoiceNum} est disponible.`,
          badge: "FACTURE",
          heroTitle: "Votre facture est disponible",
          heroSub: `Facture ${invoiceNum}`,
          icon: "doc",
          greeting,
          bodyText: `Votre facture <strong style="color:#1a1a2e;">${invoiceNum}</strong> est maintenant disponible dans votre portail client.`,
          cardTitle: "Détails de la facture",
          cardRows: [
            ["Numéro", String(invoiceNum)],
            ["Période", String(period)],
            ["Sous-total", String(subtotal)],
            ["TPS (5 %)", String(tps)],
            ["TVQ (9,975 %)", String(tvq)],
            ["Échéance", String(dueDate)],
            ["Total à payer", String(total)],
          ],
          ctaPrimaryUrl: invoiceUrl,
          ctaPrimaryLabel: "Voir ma facture",
        }),
      };
    }

    // ===================================================================
    // ORDER PROCESSING — Commande en traitement
    // ===================================================================
    case "order_processing": {
      const services = esc(v.services_summary || v.SERVICES_LIST || v.plan_name || "Non disponible");
      const estActivation = fmtDate(v.estimated_activation_date || v.activation_date);
      const ordersUrl = `${String(v.portal_url || PORTAL_URL).replace(/\/$/, "")}/commandes`;
      return {
        subject: `Votre commande est en traitement — Nivra Telecom`,
        html: shell({
          preheader: `Nous préparons votre commande ${orderNum}.`,
          badge: "COMMANDE EN TRAITEMENT",
          heroTitle: "Nous préparons votre commande",
          heroSub: `Commande #${String(orderNum).replace(/^#/, "")}`,
          icon: "doc",
          greeting,
          bodyText: `Votre commande est en cours de traitement. Notre équipe prépare votre équipement et planifie votre activation.`,
          cardTitle: "Détails de la commande",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Services", String(services)],
            ["Activation prévue", String(estActivation)],
          ],
          ctaPrimaryUrl: ordersUrl,
          ctaPrimaryLabel: "Voir ma commande",
          afterCardText: `Vous recevrez un autre courriel dès l'expédition de votre équipement.`,
        }),
      };
    }

    // ===================================================================
    // SHIPMENT CREATED — Étiquette d'expédition générée
    // ===================================================================
    case "shipment_created": {
      const carrier = esc(v.carrier || v.CARRIER || "Postes Canada");
      const tracking = esc(v.tracking_number || v.TRACKING_NUMBER || "Non disponible");
      const pickupDate = fmtDate(v.pickup_date || v.created_at || new Date().toISOString());
      const deliveryWindow = esc(
        v.delivery_window || v.estimated_delivery || "3 à 5 jours ouvrables",
      );
      const trackingUrl = String(
        v.tracking_url ||
          (v.tracking_number
            ? `https://www.canadapost-postescanada.ca/track-reperage/fr#/details/${esc(v.tracking_number)}`
            : `${PORTAL_URL}/commandes`),
      );
      return {
        subject: `Expédition créée pour votre commande — Nivra Telecom`,
        html: shell({
          preheader: `Votre colis a été pris en charge par ${carrier}.`,
          badge: "EXPÉDITION CRÉÉE",
          heroTitle: "Votre colis a été pris en charge",
          heroSub: `Transporteur : ${carrier}`,
          icon: "truck",
          greeting,
          bodyText: `Bonne nouvelle ! Une étiquette d'expédition a été créée pour votre commande <strong style="color:#1a1a2e;">${orderNum}</strong>.`,
          cardTitle: "Détails de l'expédition",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Transporteur", String(carrier)],
            ["Numéro de suivi", String(tracking)],
            ["Date de prise en charge", String(pickupDate)],
            ["Livraison estimée", String(deliveryWindow)],
          ],
          ctaPrimaryUrl: trackingUrl,
          ctaPrimaryLabel: "Suivre mon colis",
        }),
      };
    }

    // ===================================================================
    // ORDER SHIPPED — Colis en route vers le client
    // ===================================================================
    case "order_shipped": {
      const carrier = esc(v.carrier || v.CARRIER || "Postes Canada");
      const tracking = esc(v.tracking_number || v.TRACKING_NUMBER || "Non disponible");
      const estDelivery = fmtDate(
        v.estimated_delivery_date || v.estimated_delivery || v.delivery_date,
      );
      const trackingUrl = String(
        v.tracking_url ||
          (v.tracking_number
            ? `https://www.canadapost-postescanada.ca/track-reperage/fr#/details/${esc(v.tracking_number)}`
            : `${PORTAL_URL}/commandes`),
      );
      return {
        subject: `Votre commande est en route — Nivra Telecom`,
        html: shell({
          preheader: `Votre équipement Nivra est en route !`,
          badge: "COMMANDE EXPÉDIÉE",
          heroTitle: "Votre équipement est en route !",
          heroSub: `Transporteur : ${carrier}`,
          icon: "truck",
          greeting,
          bodyText: `Votre commande <strong style="color:#1a1a2e;">${orderNum}</strong> a été expédiée. Vous pouvez suivre votre colis avec les informations ci-dessous.`,
          cardTitle: "Suivi de livraison",
          cardRows: [
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
            ["Transporteur", String(carrier)],
            ["Numéro de suivi", String(tracking)],
            ["Livraison estimée", String(estDelivery)],
          ],
          ctaPrimaryUrl: trackingUrl,
          ctaPrimaryLabel: "Suivre ma livraison",
          afterCardText: `Une fois votre équipement reçu, suivez les instructions d'installation incluses dans la boîte ou consultez votre portail client.`,
        }),
      };
    }

    // ===================================================================
    // SERVICE CANCELLED — Confirmation après approbation
    // ===================================================================
    case "service_cancelled": {
      const serviceName = esc(v.service_name || v.plan_name || "Service Nivra");
      const cancellationDate = fmtDate(v.cancellation_date || v.effective_date || new Date().toISOString());
      const refundRaw = Number(v.refund_amount ?? 0);
      const refundLine = refundRaw > 0 ? money(refundRaw) : "Aucun remboursement";
      return {
        subject: `Confirmation d'annulation — Nivra Telecom`,
        html: shell({
          preheader: `Votre service ${serviceName} a été annulé.`,
          badge: "SERVICE ANNULÉ",
          heroTitle: "Votre service a été annulé",
          heroSub: "Nous regrettons de vous voir partir.",
          icon: "x",
          greeting,
          bodyText: `Votre demande d'annulation a été traitée. Voici les détails ci-dessous.`,
          cardTitle: "Détails",
          cardRows: [
            ["Service", String(serviceName)],
            ["Date d'annulation", String(cancellationDate)],
            ["Remboursement", String(refundLine)],
            ["Prochaines étapes", "Aucune action requise. Conservez ce courriel pour vos dossiers."],
          ],
          cardEmphasizeLast: false,
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Nous contacter",
          afterCardText: refundRaw > 0
            ? `Le remboursement sera traité sous 5 à 10 jours ouvrables.`
            : undefined,
        }),
      };
    }

    // ===================================================================
    // ACCOUNT CLOSURE REQUESTED — Demande de fermeture de compte
    // ===================================================================
    case "account_closure_requested": {
      const reason = esc(v.reason || "Demande du client");
      const refundRaw = Number(v.refund_amount ?? 0);
      const subsCount = Number(v.subscriptions_count ?? 0);
      return {
        subject: `Demande de fermeture de compte Nivra`,
        html: shell({
          preheader: `Votre demande de fermeture de compte a été reçue.`,
          badge: "FERMETURE DE COMPTE",
          heroTitle: "Votre demande a été reçue",
          heroSub: "Traitement sous 3 à 5 jours ouvrables.",
          icon: "doc",
          greeting,
          bodyText: `Nous avons bien reçu votre demande de fermeture de compte. Notre équipe la traitera dans les plus brefs délais.`,
          cardTitle: "Récapitulatif",
          cardRows: [
            ["Raison", String(reason)],
            ["Services à résilier", String(subsCount || "Non disponible")],
            ["Remboursement estimé", refundRaw > 0 ? money(refundRaw) : "Aucun"],
            ["Délai de traitement", "3 à 5 jours ouvrables"],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Contacter le support",
          afterCardText: `Si vous avez des questions, écrivez-nous à <strong style="color:#7c3aed;">${SUPPORT_EMAIL}</strong>.`,
        }),
      };
    }

    // ===================================================================
    // FIELD COMMISSION APPROVED — agent commission notification
    // ===================================================================
    case "commission_approved": {
      const agentName = String(v.agent_name || v.client_name || "Agent");
      const orderNo = esc(v.order_number || "N/A");
      const amount = money(v.amount);
      const statusLabel = esc(v.status_label || "Approuvée");
      return {
        subject: `Votre commission a été approuvée`,
        html: shell({
          preheader: `Bonne nouvelle — votre commission ${amount} est approuvée.`,
          badge: "COMMISSION APPROUVÉE",
          heroTitle: "Bonne nouvelle !",
          heroSub: "Votre commission vient d'être approuvée.",
          icon: "star",
          greeting: `Bonjour ${agentName},`,
          bodyText: `Félicitations — votre commission est désormais approuvée et sera traitée selon le calendrier de paie.`,
          cardTitle: "Détails de la commission",
          cardRows: [
            ["Commande", `#${String(orderNo).replace(/^#/, "")}`],
            ["Montant", String(amount)],
            ["Statut", String(statusLabel)],
          ],
          ctaPrimaryUrl: `${APP_URL}/field/commissions`,
          ctaPrimaryLabel: "Voir mes commissions",
        }),
      };
    }

    // ===================================================================
    // INTERNAL EMAIL COMPOSE — staff-to-anyone messaging from Core/Employee
    // ===================================================================
    case "internal_email_compose": {
      const customSubject = String(v.subject || "Message de Nivra Telecom");
      const messageBody = String(v.message_html || v.message || "");
      const senderName = esc(v.sender_name || "Équipe Nivra");
      return {
        subject: customSubject,
        html: shell({
          preheader: customSubject,
          badge: "MESSAGE DE NIVRA TELECOM",
          heroTitle: customSubject,
          icon: "doc",
          greeting,
          bodyText: messageBody,
          afterCardText: `Cordialement,<br/><strong>${senderName}</strong><br/>Nivra Telecom`,
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Répondre",
          helpHtml: `<strong style="color:#7c3aed;">${SUPPORT_EMAIL}</strong> · <a href="${APP_URL}" style="color:#7c3aed;">nivra-telecom.ca</a> · Québec, Canada`,
        }),
      };
    }

    default:
      return null;
  }
}
