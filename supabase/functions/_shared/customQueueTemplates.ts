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

/**
 * Universal safe-string helper — guarantees no user-facing placeholder
 * characters (undefined, null, NaN, [object Object], empty) ever appear in
 * an email. Apply to ALL dynamic text values rendered in templates.
 */
export const safe = (val: unknown, fallback = "Non disponible"): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return fallback;
  const str = String(val).trim();
  if (
    !str ||
    str === "undefined" ||
    str === "null" ||
    str === "NaN" ||
    str === "[object Object]"
  ) {
    return fallback;
  }
  return str;
};

/**
 * Discount line formatter — ALWAYS includes label + amount + duration when
 * known. Never renders a bare "-10,00 $" string. Use in every template that
 * surfaces a discount/credit (payment_link_employee, order_confirmation,
 * quote_client, payment_receipt, contract_generated, …).
 */
export const formatDiscount = (discount: any): string => {
  if (!discount) return "";
  const amount = money(
    discount.amount ?? discount.monthly_amount ?? 0,
  );
  const months = Number(
    discount.duration_months ?? discount.duration ?? discount.months_total ?? 0,
  );
  const remaining = Number(
    discount.months_remaining ?? months ?? 0,
  );
  const label = safe(discount.name ?? discount.label ?? "Rabais", "Rabais");
  if (months > 0) {
    return `${label} — ${amount}/mois pendant ${months} mois (${remaining} mois restants)`;
  }
  return `${label} — ${amount}/mois`;
};

/**
 * Contract / official-document discount formatter. Branches by discount.type
 * and applies_to to produce a single human-readable line. Use in
 * contract_generated, order_confirmation, payment_receipt cards.
 */
export const formatDiscountForContract = (d: any): string => {
  if (!d) return "";
  const amt = Number(d.amount ?? d.monthly_amount ?? 0);
  const months = Number(d.duration_months ?? d.months_total ?? 0);
  const name = safe(d.name ?? d.label ?? "Rabais", "Rabais");
  if (d.type === "remove_fee" && d.applies_to === "installation")
    return "Installation gratuite ✓ (frais annulés)";
  if (d.type === "remove_fee" && d.applies_to === "activation")
    return "Activation gratuite ✓ (frais annulés)";
  if (d.type === "first_month_free")
    return `1er mois offert ✓ — ${amt.toFixed(2)} $/mois`;
  if (d.type === "one_time")
    return `Promotion unique — ${amt.toFixed(2)} $`;
  if (d.is_permanent)
    return `Rabais permanent ${name} — ${amt.toFixed(2)} $/mois`;
  return months > 0
    ? `${name} — ${amt.toFixed(2)} $/mois × ${months} mois`
    : `${name} — ${amt.toFixed(2)} $/mois`;
};

/**
 * Build cardRows entries from an array of billing_invoice_lines (or
 * normalized discount objects). Each line with line_type === 'discount'
 * renders as a negative amount row. Safe to pass empty/undefined.
 */
export const buildDiscountRowsFromInvoiceLines = (
  lines: any[] | undefined | null,
): Array<[string, string]> => {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((l) => String(l?.line_type) === "discount")
    .map((l) => {
      const desc = safe(l?.description, "Rabais");
      const amt = Number(l?.line_total ?? l?.unit_price ?? 0);
      const formatted = amt === 0
        ? "0,00 $ ✓"
        : `-${money(Math.abs(amt))}`;
      return [desc, formatted] as [string, string];
    });
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

export type EmailLang = "fr" | "en";

/** Bilingual helper — returns the EN string when lang==='en', else FR. */
const t = (fr: string, en: string, lang: EmailLang): string =>
  lang === "en" ? en : fr;

export function renderQueueTemplate(
  templateKey: string,
  vars: Record<string, unknown>,
  lang: EmailLang = "fr",
): RenderResult | null {
  const isEn = lang === "en";
  const v = vars || {};
  const clientName = String(
    v.client_name || v.first_name || v.CLIENT_FIRST_NAME || v.CLIENT_NAME || "Client",
  );
  const greeting = isEn ? `Hello ${clientName},` : `Bonjour ${clientName},`;
  const portalUrl = String(v.portal_url || v.PORTAL_URL || PORTAL_URL);
  const orderNum = esc(v.order_number || v.ORDER_NUMBER || v.order_id || "N/A");
  const accountNum = esc(v.account_number || v.ACCOUNT_NUMBER || (isEn ? "Not specified" : "Non spécifié"));

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

    case "order_confirmation": {
      const cClientName = esc(v.client_name || v.first_name || "Client");
      const cOrderNum = esc(v.order_number || v.ORDER_NUMBER || "N/A");
      const cServices = esc(v.services || t("Voir détails de la commande","See order details", lang));
      const cEquipment = esc(v.equipment || t("Aucun équipement","No equipment", lang));
      const cDiscount = v.discount ? esc(String(v.discount)) : null;
      const cSubtotal = money(v.subtotal || 0);
      const cTps = money(v.tps || 0);
      const cTvq = money(v.tvq || 0);
      const cTotal = money(v.total || v.amount || 0);
      const cPaymentStatus = esc(v.payment_status || t("En attente de traitement","Pending processing", lang));
      const cAgentName = esc(v.agent_name || t("Votre conseiller Nivra","Your Nivra advisor", lang));
      const cAgentNumber = esc(v.agent_number || "N/A");
      const cAgentDisplay = v.agent_number
        ? `${cAgentName} — ${cAgentNumber}`
        : cAgentName;
      const cPaymentUrl = String(v.payment_url || v.payer_url || `${PORTAL_URL}/facturation`);

      const cRows: Array<[string, string]> = [
        [t("Numéro de commande","Order number", lang), `#${cOrderNum}`],
        [t("Votre représentant","Your representative", lang), cAgentDisplay],
        [t("Forfaits","Plans", lang), cServices],
        [t("Équipement","Equipment", lang), cEquipment],
      ];
      if (cDiscount) cRows.push([t("Rabais appliqué","Discount applied", lang), cDiscount]);
      for (const r of buildDiscountRowsFromInvoiceLines(v.invoice_lines || v.discount_lines)) {
        cRows.push(r);
      }
      if (v.discount_data) {
        cRows.push([t("Rabais","Discount", lang), formatDiscountForContract(v.discount_data)]);
      }
      cRows.push(
        [t("Sous-total","Subtotal", lang), cSubtotal],
        ["TPS (5%)", cTps],
        ["TVQ (9,975%)", cTvq],
        ["TOTAL", cTotal],
        [t("Statut paiement","Payment status", lang), cPaymentStatus],
      );

      return {
        subject: t("Confirmation de commande — Nivra Telecom","Order Confirmation — Nivra Telecom", lang),
        html: shell({
          preheader: t("Votre commande Nivra a été enregistrée.","Your Nivra order has been registered.", lang),
          badge: t("COMMANDE REÇUE","ORDER RECEIVED", lang),
          heroTitle: t("Votre commande a été enregistrée","Your order has been registered", lang),
          heroSub: `${t("Commande","Order", lang)} #${cOrderNum}`,
          icon: "check",
          greeting: t(`Bonjour ${cClientName},`, `Hello ${cClientName},`, lang),
          bodyText: t(
            `Votre commande a bien été enregistrée. Le paiement par carte sera traité par notre équipe dans les 48 heures ouvrables. Vous recevrez une confirmation dès que le paiement sera complété.`,
            `Your order has been registered. Card payment will be processed by our team within 48 business hours. You will receive a confirmation as soon as the payment is completed.`,
            lang,
          ),
          cardTitle: t("Récapitulatif de votre commande","Order summary", lang),
          cardRows: cRows,
          ctaPrimaryUrl: cPaymentUrl,
          ctaPrimaryLabel: t("Voir ma commande","View my order", lang),
          helpHtml: t(`Questions ? Contactez-nous à ${SUPPORT_EMAIL}`, `Questions? Contact us at ${SUPPORT_EMAIL}`, lang),
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
      const invoiceNum = esc(v.invoice_number || v.INVOICE_NUMBER || t("En cours","In progress", lang));
      const amount = money(v.amount_paid_today ?? v.amount ?? v.total_payable ?? v.AMOUNT);
      const reference = esc(v.reference || v.payment_reference || t("Non disponible","Not available", lang));
      const method = esc(v.payment_method || v.PAYMENT_METHOD || "PayPal");
      const invoiceUrl = String(v.invoice_url || `${portalUrl}/facturation`);
      const prRows: Array<[string, string]> = [
        [t("Commande","Order", lang), `#${String(orderNum).replace(/^#/, "")}`],
        [t("Facture","Invoice", lang), `#${invoiceNum}`],
      ];
      for (const r of buildDiscountRowsFromInvoiceLines(v.invoice_lines || v.discount_lines)) {
        prRows.push(r);
      }
      if (v.discount_data) {
        prRows.push([t("Rabais","Discount", lang), formatDiscountForContract(v.discount_data)]);
      }
      if (v.subtotal !== undefined && v.subtotal !== null) prRows.push([t("Sous-total HT","Subtotal (pre-tax)", lang), money(v.subtotal)]);
      if (v.tps !== undefined && v.tps !== null) prRows.push(["TPS (5%)", money(v.tps)]);
      if (v.tvq !== undefined && v.tvq !== null) prRows.push(["TVQ (9,975%)", money(v.tvq)]);
      prRows.push(
        [t("Montant payé","Amount paid", lang), amount],
        [t("Méthode","Method", lang), String(method)],
        [t("Référence","Reference", lang), String(reference)],
        [t("Date","Date", lang), fmtDate(v.payment_date || v.PAYMENT_DATE || new Date().toISOString())],
      );
      return {
        subject: t("Paiement reçu — Merci","Payment Received — Thank You", lang),
        html: shell({
          preheader: t(`Votre paiement de ${amount} a été reçu.`, `Your payment of ${amount} has been received.`, lang),
          badge: t("PAIEMENT CONFIRMÉ","PAYMENT CONFIRMED", lang),
          heroTitle: t("Paiement reçu — Merci","Payment received — Thank you", lang),
          icon: "check",
          greeting,
          bodyText: t("Nous confirmons la réception de votre paiement.","We confirm receipt of your payment.", lang),
          cardTitle: t("Détails","Details", lang),
          cardRows: prRows,
          ctaPrimaryUrl: invoiceUrl,
          ctaPrimaryLabel: t("Voir ma facture","View my invoice", lang),
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
      const service = esc(v.service_type || v.plan_name || v.SERVICES_LIST || t("Service Nivra","Nivra service", lang));
      const billingDate = fmtDate(v.billing_date || v.next_billing_date);
      return {
        subject: t("Bienvenue chez Nivra — Tout ce qu'il faut savoir","Welcome to Nivra — Everything you need to know", lang),
        html: shell({
          preheader: t("Bienvenue chez Nivra Telecom.","Welcome to Nivra Telecom.", lang),
          badge: t("BIENVENUE","WELCOME", lang),
          heroTitle: t("Bienvenue chez Nivra Telecom","Welcome to Nivra Telecom", lang),
          heroSub: t("Nous sommes ravis de vous avoir parmi nous.","We're thrilled to have you with us.", lang),
          icon: "star",
          greeting,
          bodyText: t("Votre compte est prêt. Connectez-vous pour tout gérer.","Your account is ready. Sign in to manage everything.", lang),
          cardTitle: t("Détails","Details", lang),
          cardRows: [
            [t("Compte","Account", lang), `#${String(accountNum).replace(/^#/, "")}`],
            [t("Service","Service", lang), String(service)],
            [t("Date de facturation","Billing date", lang), billingDate],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: t("Mon espace client","My client portal", lang),
        }),
      };
    }

    // ===================================================================
    // CONTRACTS
    // ===================================================================
    case "contract_ready":
    case "contract_sign_request":
    case "contract_ready_to_sign":
    case "contract_signature_request": {
      const contractUrl = String(
        v.sign_url || v.SIGN_URL ||
        v.signature_url || v.SIGNATURE_URL ||
        v.contract_url || v.CONTRACT_URL ||
        "https://nivra-telecom.ca/portal/contracts"
      );
      const services = safe(
        v.services || v.service || v.plan_name || v.services_summary,
        t("Vos services Nivra","Your Nivra services", lang),
      );
      const agentName = safe(v.agent_name, t("Votre conseiller Nivra","Your Nivra advisor", lang));
      const agentNumber = safe(v.agent_number, "");
      const agentDisplay = agentNumber && agentNumber !== t("Non disponible","Not available", lang)
        ? `${agentName} — ${agentNumber}`
        : agentName;
      const validUntil = v.token_expires_at
        ? fmtDate(v.token_expires_at)
        : t("7 jours","7 days", lang);
      return {
        subject: t("Signez votre contrat Nivra Telecom","Sign your Nivra Telecom contract", lang),
        html: shell({
          preheader: t("Votre contrat est prêt à signer.","Your contract is ready to sign.", lang),
          badge: t("SIGNATURE REQUISE","SIGNATURE REQUIRED", lang),
          heroTitle: t("Votre contrat est prêt à signer","Your contract is ready to sign", lang),
          heroSub: `${t("Commande","Order", lang)} #${String(orderNum).replace(/^#/, "")}`,
          icon: "pen",
          greeting,
          bodyText: t(
            "Nivra Communication Inc. a signé sa partie du contrat. Il ne reste qu'à apposer votre signature pour finaliser votre entente de service.",
            "Nivra Communication Inc. has signed its part of the contract. All that remains is your signature to finalize your service agreement.",
            lang,
          ),
          cardTitle: t("Détails de votre contrat","Contract details", lang),
          cardRows: [
            [t("Numéro de commande","Order number", lang), `#${String(orderNum).replace(/^#/, "")}`],
            [t("Services","Services", lang), services],
            [t("Votre représentant","Your representative", lang), agentDisplay],
            [t("Valide jusqu'au","Valid until", lang), validUntil],
          ],
          ctaPrimaryUrl: contractUrl,
          ctaPrimaryLabel: t("Signer mon contrat","Sign my contract", lang),
          helpHtml: t(
            `Questions ? Contactez-nous à <a href="mailto:support@nivra-telecom.ca">support@nivra-telecom.ca</a>`,
            `Questions? Contact us at <a href="mailto:support@nivra-telecom.ca">support@nivra-telecom.ca</a>`,
            lang,
          ),
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
      const agentNumber = esc(v.agent_number || v.AGENT_NUMBER || "En cours d'attribution");
      const proEmail = esc(v.professional_email || v.PROFESSIONAL_EMAIL || "À venir");
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
            ["Numéro d'agent", agentNumber],
            ["Courriel professionnel", `${proEmail} (à venir)`],
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
      const orderNo = esc(v.order_number || v.ORDER_NUMBER || v.order_id || "Voir votre portail");
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

    case "discount_expiring_soon": {
      const fullName = safe(
        v.client_full_name ?? `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim(),
        "Client",
      );
      const discountLabel = safe(v.discount_label ?? v.discount_name, t("Rabais promotionnel","Promotional discount", lang));
      const discountAmount = money(v.discount_amount ?? 0);
      const fullPrice = money(v.full_price ?? v.next_amount ?? 0);
      const endDate = fmtDate(v.end_date ?? v.next_invoice_date);
      return {
        subject: t("Votre rabais Nivra expire bientôt","Your Nivra discount expires soon", lang),
        html: shell({
          preheader: t("Votre rabais se termine après votre prochaine facture.","Your discount ends after your next invoice.", lang),
          badge: t("AVIS IMPORTANT","IMPORTANT NOTICE", lang),
          heroTitle: t("Votre rabais se termine le mois prochain","Your discount ends next month", lang),
          icon: "alert",
          greeting: t(`Bonjour ${fullName},`, `Hello ${fullName},`, lang),
          bodyText: t(
            `Votre ${discountLabel} de ${discountAmount}/mois se terminera après votre prochaine facture. À partir du ${endDate}, votre mensualité sera de <strong>${fullPrice}</strong>.`,
            `Your ${discountLabel} of ${discountAmount}/month will end after your next invoice. Starting ${endDate}, your monthly amount will be <strong>${fullPrice}</strong>.`,
            lang,
          ),
          ctaPrimaryUrl: PORTAL_URL,
          ctaPrimaryLabel: t("Voir mon compte","View my account", lang),
          helpHtml: `<strong style="color:#7c3aed;">${SUPPORT_EMAIL}</strong> · <a href="${APP_URL}" style="color:#7c3aed;">nivra-telecom.ca</a>`,
        }),
      };
    }

    case "discount_expired": {
      const fullName = safe(
        v.client_full_name ?? `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim(),
        "Client",
      );
      const discountLabel = safe(v.discount_label ?? v.discount_name, t("Rabais promotionnel","Promotional discount", lang));
      const discountAmount = money(v.discount_amount ?? 0);
      const months = safe(v.duration_months, "");
      const newAmount = money(v.new_amount ?? v.full_price ?? 0);
      return {
        subject: t("Votre rabais Nivra a expiré","Your Nivra discount has expired", lang),
        html: shell({
          preheader: t("Votre période de rabais est maintenant terminée.","Your discount period has now ended.", lang),
          badge: t("RABAIS EXPIRÉ","DISCOUNT EXPIRED", lang),
          heroTitle: t("Votre période de rabais est terminée","Your discount period has ended", lang),
          icon: "alert",
          greeting: t(`Bonjour ${fullName},`, `Hello ${fullName},`, lang),
          bodyText: t(
            `Votre ${discountLabel} de ${discountAmount}/mois${months ? ` pendant ${months} mois` : ""} est maintenant terminé. Votre prochain paiement sera de <strong>${newAmount}</strong>.`,
            `Your ${discountLabel} of ${discountAmount}/month${months ? ` for ${months} months` : ""} has now ended. Your next payment will be <strong>${newAmount}</strong>.`,
            lang,
          ),
          ctaPrimaryUrl: PORTAL_URL,
          ctaPrimaryLabel: t("Voir mon compte","View my account", lang),
          helpHtml: `<strong style="color:#7c3aed;">${SUPPORT_EMAIL}</strong> · <a href="${APP_URL}" style="color:#7c3aed;">nivra-telecom.ca</a>`,
        }),
      };
    }

    case "contract_generated": {
      const fullName = safe(
        v.client_full_name ??
          `${v.customer_first_name ?? v.first_name ?? ""} ${v.customer_last_name ?? v.last_name ?? ""}`.trim(),
        "Client",
      );
      const orderNumber = safe(v.order_number, "");
      const agentName = safe(v.agent_name, "votre conseiller Nivra");
      const agentNumber = safe(v.agent_number, "");
      const agentDisplay = agentNumber && agentNumber !== "N/A"
        ? `${agentName} — ${agentNumber}`
        : agentName;
      const cardRows: Array<[string, string]> = [];
      if (orderNumber) cardRows.push(["Numéro de commande", `#${orderNumber}`]);
      cardRows.push(["Votre représentant", agentDisplay]);
      // Discount section — official contract document MUST list every rabais.
      const contractDiscounts: any[] = Array.isArray(v.discounts)
        ? v.discounts
        : (v.discount_data ? [v.discount_data] : []);
      for (const d of contractDiscounts) {
        cardRows.push(["Rabais appliqué", formatDiscountForContract(d)]);
        const months = Number(d?.duration_months ?? d?.months_total ?? 0);
        const isPerm = !!d?.is_permanent;
        cardRows.push([
          "Durée du rabais",
          isPerm ? "Permanent" : (months > 0 ? `${months} mois` : "Une fois"),
        ]);
        if (d?.monthly_price !== undefined && d?.monthly_price !== null) {
          const monthlyAfter = Math.max(0, Number(d.monthly_price) - Number(d.amount || 0));
          cardRows.push(["Prix mensuel après rabais", `${monthlyAfter.toFixed(2)} $/mois`]);
        }
      }
      for (const r of buildDiscountRowsFromInvoiceLines(v.invoice_lines || v.discount_lines)) {
        cardRows.push(r);
      }
      return {
        subject: `Votre contrat de service Nivra${orderNumber ? ` — ${orderNumber}` : ""}`,
        html: shell({
          preheader: "Votre contrat de service est maintenant disponible.",
          badge: "CONTRAT DE SERVICE",
          heroTitle: "Votre contrat est prêt",
          icon: "document",
          greeting: `Bonjour ${fullName},`,
          bodyText: `Votre contrat de service Nivra${orderNumber ? ` (commande <strong>${orderNumber}</strong>)` : ""} a été généré suite à votre rencontre avec ${agentDisplay}. Vous pouvez le consulter en tout temps dans votre espace client.`,
          cardTitle: "Détails",
          cardRows,
          ctaPrimaryUrl: PORTAL_URL,
          ctaPrimaryLabel: "Voir mon contrat",
          helpHtml: `<strong style="color:#7c3aed;">${SUPPORT_EMAIL}</strong> · <a href="${APP_URL}" style="color:#7c3aed;">nivra-telecom.ca</a>`,
        }),
      };
    }

    // ===================================================================
    // SUPPORT — AI assistant reply (sent to the client)
    // ===================================================================
    case "support_ai_reply": {
      const ticketNumber = esc(v.ticket_number || "TKT-XXXXXXXX");
      const accountNumber = esc(v.account_number || "Inconnu");
      const originalSubject = esc(v.original_subject || v.subject || "votre demande");
      const aiResponse = String(v.ai_response || "");
      // Convert plain-text AI response into safe HTML paragraphs
      const bodyHtml = aiResponse
        .split(/\n{2,}/)
        .map((para) =>
          `<p style="margin:0 0 12px 0; line-height:1.55; color:${BRAND_TEXT_BODY};">${esc(para).replace(/\n/g, "<br>")}</p>`,
        )
        .join("");
      return {
        subject: `RE: ${originalSubject} - Ticket ${ticketNumber}`,
        html: shell({
          preheader: `Réponse à votre demande de support (ticket ${ticketNumber}).`,
          badge: "SUPPORT NIVRA",
          heroTitle: "Réponse à votre demande",
          heroSub: `Ticket ${ticketNumber}`,
          icon: "info",
          greeting: `Bonjour ${esc(clientName)},`,
          bodyText: bodyHtml,
          cardTitle: "Détails du ticket",
          cardRows: [
            ["Numéro de ticket", ticketNumber],
            ["Compte", accountNumber],
          ],
          ctaPrimaryUrl: `${APP_URL}/support`,
          ctaPrimaryLabel: "Voir mon dossier",
          helpHtml: `Pour répondre, écrivez simplement à cet email. Notre équipe est là pour vous: <strong style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</strong>`,
        }),
      };
    }

    // ===================================================================
    // SUPPORT — escalation alert (sent to admin)
    // ===================================================================
    case "support_escalation": {
      const ticketNumber = esc(v.ticket_number || "TKT-XXXXXXXX");
      const clientNameEsc = esc(v.client_name || "Client inconnu");
      const clientEmail = esc(v.client_email || "");
      const accountNumber = esc(v.account_number || "Inconnu");
      const subjectEsc = esc(v.subject || "(sans objet)");
      const rawBody = String(v.body || "");
      const bodyTrunc = esc(rawBody.length > 500 ? rawBody.slice(0, 500) + "..." : rawBody);
      const aiReason = esc(v.ai_reason || "Aucune analyse disponible");
      return {
        subject: `[ESCALADE] Ticket ${ticketNumber} - ${clientEmail}`,
        html: shell({
          preheader: `Nouvelle escalade support à traiter: ${clientEmail}`,
          badge: "ESCALADE SUPPORT",
          heroTitle: "Nouveau ticket à traiter",
          heroSub: `Ticket ${ticketNumber}`,
          icon: "alert",
          greeting: `Bonjour équipe,`,
          bodyText: `Un ticket support a été escaladé par l'agent IA et requiert une intervention humaine.`,
          cardTitle: "Détails du ticket",
          cardRows: [
            ["Ticket", ticketNumber],
            ["Client", clientNameEsc],
            ["Courriel", clientEmail],
            ["Compte", accountNumber],
            ["Sujet", subjectEsc],
            ["Message", bodyTrunc],
            ["Analyse IA", aiReason],
          ],
          ctaPrimaryUrl: `${APP_URL}/core/support`,
          ctaPrimaryLabel: "Voir le ticket dans Core",
          helpHtml: `Délai de réponse cible: 2 heures. Connexion via <a href="${APP_URL}/hub" style="color:${BRAND_PRIMARY};">${APP_URL}/hub</a>`,
        }),
      };
    }

    // ===================================================================
    // TRAINING — Certificate issued
    // ===================================================================
    case "training_certificate": {
      const agentName = esc(v.agent_name || clientName);
      const agentNumber = esc(v.agent_number || "N/A");
      const dateFr = esc(v.date_fr || fmtDate(v.issued_at) || fmtDate(new Date().toISOString()));
      const totalPoints = esc(v.total_points ?? 0);
      const badgeLevel = esc(v.badge_level || "Agent Certifié");
      const modulesCount = esc(v.modules_completed || "8/8");
      return {
        subject: "🏆 Votre certificat de formation Nivra",
        html: shell({
          preheader: "Félicitations — votre certificat de formation Nivra est prêt.",
          badge: "CERTIFICAT OFFICIEL",
          heroTitle: "Formation complétée avec succès!",
          heroSub: "Agent certifié Nivra Telecom",
          greeting: `Félicitations ${agentName}!`,
          bodyText: "Vous avez complété avec succès la formation officielle Nivra Telecom. Votre certificat est disponible en téléchargement ci-dessous.",
          cardTitle: "Détails de la certification",
          cardRows: [
            ["Agent", `${agentName} · ${agentNumber}`],
            ["Date de certification", dateFr],
            ["Modules complétés", String(modulesCount)],
            ["Points totaux", `${totalPoints} pts`],
            ["Niveau", badgeLevel],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Voir mon certificat",
          helpHtml: `Questions ? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    // ===================================================================
    // PAYSTUB NOTIFICATION (weekly Friday payroll)
    // ===================================================================
    case "paystub_notification": {
      const agentName = esc(v.agent_name || clientName);
      const agentNumber = esc(v.agent_number || "");
      const periodStart = fmtDate(v.period_start);
      const periodEnd = fmtDate(v.period_end);
      const payDate = fmtDate(v.pay_date);
      const regularPay = formatMoney(v.regular_hours_pay);
      const overtimePay = formatMoney(v.overtime_hours_pay);
      const commissionGross = formatMoney(v.commission_gross);
      const bonusAmount = formatMoney(v.bonus_amount);
      const allocationTotal = formatMoney(v.allocation_total);
      const totalGross = formatMoney(v.total_gross);
      const federalTax = formatMoney(v.federal_tax);
      const quebecTax = formatMoney(v.quebec_tax);
      const rrq = formatMoney(v.rrq);
      const ae = formatMoney(v.ae);
      const rqap = formatMoney(v.rqap);
      const disability = formatMoney(v.disability_insurance);
      const totalDeductions = formatMoney(v.total_deductions);
      const netPay = formatMoney(v.net_pay);
      const payMethodMap: Record<string, string> = {
        interac: "Virement Interac",
        direct_deposit: "Dépôt direct",
        paypal: "PayPal",
      };
      const payMethod = payMethodMap[String(v.payment_method || "interac")] || String(v.payment_method || "Interac");
      const paystubUrl = String(v.paystub_url || v.portal_url || PORTAL_URL);

      const cardRows: [string, string][] = [
        ["Agent", agentNumber ? `${agentName} — ${agentNumber}` : agentName],
        ["Période", `${periodStart} au ${periodEnd}`],
        ["Date de paie", payDate],
        ["Heures régulières", regularPay],
        ["Heures supplémentaires", overtimePay],
        ["Commissions brutes", commissionGross],
        ["Bonus", bonusAmount],
        ["Allocations / suppléments", allocationTotal],
        ["Total brut", totalGross],
        ["Impôt fédéral", federalTax],
        ["Impôt provincial QC", quebecTax],
        ["RRQ", rrq],
        ["AE", ae],
        ["RQAP", rqap],
        ["Assurance invalidité", disability],
        ["Total déductions", totalDeductions],
        ["Méthode", payMethod],
        ["NET À PAYER", netPay],
      ];

      return {
        subject: t(`Votre paie Nivra — ${payDate}`, `Your Nivra paystub — ${payDate}`, lang),
        html: shell({
          preheader: t(`Votre paie pour la période du ${periodStart} au ${periodEnd}.`, `Your pay for the period of ${periodStart} to ${periodEnd}.`, lang),
          badge: t("PAIE DISPONIBLE","PAYSTUB AVAILABLE", lang),
          heroTitle: t("Votre paie a été traitée","Your pay has been processed", lang),
          heroSub: t(`Période du ${periodStart} au ${periodEnd}`, `Period from ${periodStart} to ${periodEnd}`, lang),
          greeting: t(`Bonjour ${agentName},`, `Hello ${agentName},`, lang),
          bodyText: t(
            `Votre paie pour la période du ${periodStart} au ${periodEnd} a été traitée. Votre talon de paie est disponible ci-dessous avec le détail des gains et des déductions.`,
            `Your pay for the period of ${periodStart} to ${periodEnd} has been processed. Your paystub is available below with the breakdown of earnings and deductions.`,
            lang,
          ),
          cardTitle: t("Détails de votre paie","Paystub details", lang),
          cardRows,
          cardEmphasizeLast: true,
          ctaPrimaryUrl: paystubUrl,
          ctaPrimaryLabel: "Voir mon talon de paie",
          helpHtml: `Questions ? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    // ===================================================================
    // PAYMENT CONFIRMATION (HR — paystub disbursement)
    // ===================================================================
    case "payment_confirmation": {
      const agentName = esc(v.agent_name || clientName);
      const agentNumber = esc(v.agent_number || "");
      const payDate = fmtDate(v.pay_date);
      const paymentDate = fmtDate(v.payment_date);
      const periodStart = fmtDate(v.period_start);
      const periodEnd = fmtDate(v.period_end);
      const netAmount = formatMoney(v.net_amount);
      const totalGross = formatMoney(v.total_gross);
      const totalDeductions = formatMoney(v.total_deductions);
      const methodLabelMap: Record<string, string> = {
        interac: "Virement Interac e-Transfer",
        direct_deposit: "Dépôt direct bancaire",
        paypal: "PayPal",
        cheque: "Chèque papier",
        cash: "Comptant",
        other: "Autre",
      };
      const method = methodLabelMap[String(v.payment_method || "interac")] || String(v.payment_method || "Interac");
      const reference = esc(v.payment_reference || "");
      const confirmationNumber = esc(v.confirmation_number || "");
      const portalUrl = String(v.portal_url || PORTAL_URL);

      const cardRows: [string, string][] = [
        ["N° avis", confirmationNumber || "—"],
        ["Agent", agentNumber ? `${agentName} — ${agentNumber}` : agentName],
        ["Période", `${periodStart} au ${periodEnd}`],
        ["Date de paie", payDate],
        ["Date du versement", paymentDate],
        ["Méthode", method],
        ...(reference ? ([["Référence", reference]] as [string, string][]) : []),
        ["Salaire brut", totalGross],
        ["Total déductions", totalDeductions],
        ["MONTANT VERSÉ (NET)", netAmount],
      ];

      return {
        subject: `Confirmation de paiement Nivra — ${paymentDate} (${netAmount})`,
        html: shell({
          preheader: `Votre paie nette de ${netAmount} a été versée par ${method}.`,
          badge: "PAIEMENT EFFECTUÉ",
          heroTitle: "Votre paie a été versée",
          heroSub: `${netAmount} versé(s) le ${paymentDate}`,
          greeting: `Bonjour ${agentName},`,
          bodyText: `Nous confirmons que votre paie nette pour la période du ${periodStart} au ${periodEnd} a été versée le ${paymentDate} par ${method}. Vous trouverez en pièce jointe votre avis de paiement officiel et votre talon de paie correspondant.`,
          cardTitle: "Détails du versement",
          cardRows,
          cardEmphasizeLast: true,
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Voir mes paies",
          helpHtml: `Une question sur ce versement ? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    // ===================================================================
    // ORDER STATUS — generic update (Feature 1)
    // ===================================================================
    case "order_status_update": {
      const oNum = esc(v.order_number || "N/A");
      const rawStatus = String(v.status || v.status_label || "").toLowerCase();
      const statusLabels: Record<string, { fr: string; en: string }> = {
        confirmed: { fr: "Commande confirmée ✓", en: "Order Confirmed ✓" },
        processing: { fr: "En préparation", en: "Being Prepared" },
        shipped: { fr: "Expédiée 📦", en: "Shipped 📦" },
        delivered: { fr: "Livrée ✓", en: "Delivered ✓" },
        activated: { fr: "Service activé ✓", en: "Service Activated ✓" },
        cancelled: { fr: "Commande annulée", en: "Order Cancelled" },
      };
      const sLabel =
        statusLabels[rawStatus]?.[lang] ||
        esc(v.status_label || v.status || (isEn ? "Update" : "Mise à jour"));
      const tracking = esc(v.tracking_number || "");
      const carrier = esc(v.carrier || "");
      const rows: [string, string][] = [
        [t("Numéro de commande", "Order number", lang), `#${String(oNum).replace(/^#/, "")}`],
        [t("Nouveau statut", "New status", lang), String(sLabel)],
      ];
      if (tracking) rows.push([t("Numéro de suivi", "Tracking number", lang), tracking]);
      if (carrier) rows.push([t("Transporteur", "Carrier", lang), carrier]);
      return {
        subject: isEn
          ? `Order #${String(oNum).replace(/^#/, "")} — ${sLabel}`
          : `Commande #${String(oNum).replace(/^#/, "")} — ${sLabel}`,
        html: shell({
          preheader: isEn
            ? `Status updated: ${sLabel}.`
            : `Statut mis à jour : ${sLabel}.`,
          badge: t("MISE À JOUR DE COMMANDE", "ORDER UPDATE", lang),
          heroTitle: String(sLabel),
          heroSub: isEn ? `Order #${String(oNum).replace(/^#/, "")}` : `Commande #${String(oNum).replace(/^#/, "")}`,
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Your Nivra order #${String(oNum).replace(/^#/, "")} status has been updated.`
            : `Le statut de votre commande Nivra #${String(oNum).replace(/^#/, "")} vient d'être mis à jour.`,
          cardTitle: t("Détails", "Details", lang),
          cardRows: rows,
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: t("Voir ma commande", "Track my order", lang),
          helpHtml: isEn
            ? `Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Une question ? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    // ===================================================================
    // OUTAGE REPORT — client confirmation (Feature 2)
    // ===================================================================
    case "outage_report_confirmation": {
      const tNum = esc(v.ticket_number || "N/A");
      const type = esc(v.incident_type || "Panne signalée");
      const svc = esc(v.service_name || "Votre service");
      return {
        subject: `Signalement reçu — Ticket ${tNum}`,
        html: shell({
          preheader: `Nous avons reçu votre signalement de panne.`,
          badge: "SIGNALEMENT REÇU",
          heroTitle: "Votre signalement a été reçu",
          heroSub: `Ticket ${tNum}`,
          icon: "check",
          greeting,
          bodyText: `Notre équipe vérifie le problème signalé. Vous serez notifié dès qu'il sera résolu.`,
          cardTitle: "Détails du signalement",
          cardRows: [
            ["Numéro de ticket", tNum],
            ["Service concerné", String(svc)],
            ["Type de problème", String(type)],
          ],
          ctaPrimaryUrl: `${PORTAL_URL}/tickets`,
          ctaPrimaryLabel: "Suivre mon ticket",
          helpHtml: `Urgent ? Écrivez à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "outage_report_admin": {
      const cName = esc(v.client_name || "Client");
      const cAcc = esc(v.account_number || v.client_account_id || "—");
      const tNum = esc(v.ticket_number || "N/A");
      const type = esc(v.incident_type || "Panne");
      const desc = esc(v.description || "(aucune description)");
      const svc = esc(v.service_name || "—");
      return {
        subject: `ALERTE: Signalement client ${cName} (${tNum})`,
        html: shell({
          preheader: `Nouveau signalement client à traiter.`,
          badge: "ALERTE INTERNE",
          heroTitle: "Nouveau signalement client",
          heroSub: `Ticket ${tNum}`,
          icon: "warning",
          greeting: `Bonjour équipe Nivra,`,
          bodyText: `Un client vient de signaler un problème. Détails ci-dessous.`,
          cardTitle: "Signalement",
          cardRows: [
            ["Client", String(cName)],
            ["Compte", String(cAcc)],
            ["Service", String(svc)],
            ["Type", String(type)],
            ["Description", String(desc)],
            ["Ticket", String(tNum)],
          ],
          helpVariant: "warning",
          ctaPrimaryUrl: `${APP_URL}/core/support`,
          ctaPrimaryLabel: "Ouvrir dans Core",
        }),
      };
    }

    // ===================================================================
    // SLA alerts (Feature 4)
    // ===================================================================
    case "sla_breach_alert":
    case "sla_warning": {
      const isBreach = templateKey === "sla_breach_alert";
      const itemType = esc(v.item_type || "Tâche");
      const itemRef = esc(v.item_reference || "—");
      const cName = esc(v.client_name || "—");
      const empName = esc(v.employee_name || "Équipe");
      const deadlineRaw = v.sla_deadline ? new Date(String(v.sla_deadline)) : null;
      const deadline = deadlineRaw && !isNaN(deadlineRaw.getTime())
        ? deadlineRaw.toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })
        : "—";
      return {
        subject: isBreach
          ? `ALERTE SLA dépassé — ${itemType} ${itemRef}`
          : `SLA bientôt expiré — ${itemType} ${itemRef}`,
        html: shell({
          preheader: isBreach ? "SLA dépassé, action requise." : "SLA expire bientôt.",
          badge: isBreach ? "SLA DÉPASSÉ" : "SLA BIENTÔT EXPIRÉ",
          heroTitle: isBreach ? "SLA dépassé" : "Attention : SLA bientôt expiré",
          heroSub: `${itemType} ${itemRef}`,
          icon: "warning",
          greeting: `Bonjour ${empName},`,
          bodyText: isBreach
            ? `Le délai SLA pour cette tâche a été dépassé. Une action immédiate est requise.`
            : `Le délai SLA pour cette tâche approche. Veuillez agir rapidement.`,
          cardTitle: "Détails",
          cardRows: [
            ["Type", String(itemType)],
            ["Référence", String(itemRef)],
            ["Client", String(cName)],
            ["Assigné à", String(empName)],
            ["Échéance SLA", deadline],
          ],
          helpVariant: "warning",
          ctaPrimaryUrl: `${APP_URL}/core/sla`,
          ctaPrimaryLabel: "Ouvrir le tableau SLA",
        }),
      };
    }

    // ===================================================================
    // WEEKLY SALES REPORT — admin digest (Feature 4)
    // ===================================================================
    case "weekly_sales_report": {
      const ps = esc(v.period_start || "");
      const pe = esc(v.period_end || "");
      const totalOrders = esc(String(v.total_orders ?? 0));
      const totalRevenue = esc(v.total_revenue || "0,00 $");
      const totalCommissions = esc(v.total_commissions || "0,00 $");
      const trend = esc(v.revenue_trend_label || "0%");
      const topRows = String(v.top_agents_rows_html || "");
      const planRows = String(v.plan_breakdown_rows_html || "");
      const extraHtml = `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:16px;border-collapse:collapse;font-size:13px;">
          <tr style="background:#f4f6fb"><th align="left" style="padding:8px;border-bottom:1px solid #ddd">Top agents</th><th align="right" style="padding:8px;border-bottom:1px solid #ddd">Ventes</th><th align="right" style="padding:8px;border-bottom:1px solid #ddd">Commission</th></tr>
          ${topRows}
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:16px;border-collapse:collapse;font-size:13px;">
          <tr style="background:#f4f6fb"><th align="left" style="padding:8px;border-bottom:1px solid #ddd">Forfait</th><th align="right" style="padding:8px;border-bottom:1px solid #ddd">Nouveaux abonnés</th></tr>
          ${planRows}
        </table>`;
      return {
        subject: `Rapport hebdomadaire Nivra — Semaine du ${ps}`,
        html: shell({
          preheader: `Rapport des ventes du ${ps} au ${pe}`,
          badge: "RAPPORT HEBDOMADAIRE",
          heroTitle: "Performance de la semaine",
          heroSub: `${ps} → ${pe}`,
          icon: "info",
          greeting: "Bonjour,",
          bodyText: `Voici le résumé des ventes Nivra pour la semaine.`,
          cardTitle: "Indicateurs clés",
          cardRows: [
            ["Période", `${ps} → ${pe}`],
            ["Total des commandes", String(totalOrders)],
            ["Revenu total", String(totalRevenue)],
            ["Commissions totales", String(totalCommissions)],
            ["Tendance vs semaine précédente", String(trend)],
          ],
          extraHtml,
          ctaPrimaryUrl: `${APP_URL}/core/analytics`,
          ctaPrimaryLabel: "Voir le tableau analytique",
          helpHtml: `Questions ? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    // ===================================================================
    // PLAN CHANGE — client self-serve (Feature: change plan online)
    // ===================================================================
    case "plan_change_requested": {
      const fromPlan = esc(v.current_plan_name || (isEn ? "Current plan" : "Forfait actuel"));
      const toPlan = esc(v.requested_plan_name || (isEn ? "New plan" : "Nouveau forfait"));
      const effDate = esc(v.effective_date || (isEn ? "Next renewal" : "Prochain renouvellement"));
      const changeType = String(v.change_type || "change").toLowerCase();
      const typeLabel = t(
        changeType === "upgrade" ? "Mise à niveau" : changeType === "downgrade" ? "Rétrogradation" : "Changement",
        changeType === "upgrade" ? "Upgrade" : changeType === "downgrade" ? "Downgrade" : "Change",
        lang,
      );
      return {
        subject: isEn
          ? `Plan change request received — ${toPlan}`
          : `Demande de changement de forfait reçue — ${toPlan}`,
        html: shell({
          preheader: isEn ? `We received your request.` : `Nous avons bien reçu votre demande.`,
          badge: t("DEMANDE REÇUE", "REQUEST RECEIVED", lang),
          heroTitle: t("Demande enregistrée", "Request received", lang),
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Your plan change request has been received. The change will take effect on ${effDate}. You will be notified once it is approved.`
            : `Votre demande de changement de forfait a été reçue. Le changement sera effectif le ${effDate}. Vous serez notifié dès qu'elle sera approuvée.`,
          cardTitle: t("Détails de la demande", "Request details", lang),
          cardRows: [
            [t("Type", "Type", lang), typeLabel],
            [t("Forfait actuel", "Current plan", lang), fromPlan],
            [t("Nouveau forfait", "New plan", lang), toPlan],
            [t("Effectif dès", "Effective from", lang), effDate],
          ],
          ctaPrimaryUrl: `${portalUrl}/services`,
          ctaPrimaryLabel: t("Voir mes services", "View my services", lang),
          helpHtml: isEn
            ? `Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Besoin d'aide ? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "plan_change_approved": {
      const fromPlan = esc(v.current_plan_name || "—");
      const toPlan = esc(v.requested_plan_name || "—");
      const effDate = esc(v.effective_date || (isEn ? "Next renewal" : "Prochain renouvellement"));
      return {
        subject: isEn
          ? `Plan change approved — ${toPlan}`
          : `Changement de forfait approuvé — ${toPlan}`,
        html: shell({
          preheader: isEn ? `Your new plan is confirmed.` : `Votre nouveau forfait est confirmé.`,
          badge: t("CHANGEMENT APPROUVÉ", "CHANGE APPROVED", lang),
          heroTitle: t("Changement approuvé ✓", "Change approved ✓", lang),
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Great news — your plan change has been approved and will take effect on ${effDate}.`
            : `Bonne nouvelle — votre changement de forfait a été approuvé et sera effectif le ${effDate}.`,
          cardTitle: t("Résumé", "Summary", lang),
          cardRows: [
            [t("Ancien forfait", "Previous plan", lang), fromPlan],
            [t("Nouveau forfait", "New plan", lang), toPlan],
            [t("Effectif dès", "Effective from", lang), effDate],
          ],
          ctaPrimaryUrl: `${portalUrl}/services`,
          ctaPrimaryLabel: t("Voir mes services", "View my services", lang),
          helpHtml: isEn
            ? `Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Une question ? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "plan_change_admin_alert": {
      const clientLabel = esc(v.client_name || "Client");
      const fromPlan = esc(v.current_plan_name || "—");
      const toPlan = esc(v.requested_plan_name || "—");
      return {
        subject: `🔔 Demande de changement de forfait — ${clientLabel}`,
        html: shell({
          preheader: `Nouvelle demande à traiter.`,
          badge: "ALERTE INTERNE",
          heroTitle: "Changement de forfait demandé",
          icon: "alert",
          greeting: `Bonjour,`,
          bodyText: `Le client ${clientLabel} a demandé un changement de forfait.`,
          cardTitle: "Détails",
          cardRows: [
            ["Client", clientLabel],
            ["Forfait actuel", fromPlan],
            ["Nouveau forfait", toPlan],
            ["Compte", accountNum],
          ],
          ctaPrimaryUrl: `${PORTAL_URL.replace(/\/portal$/, '')}/core/clients`,
          ctaPrimaryLabel: "Ouvrir dans Core",
        }),
      };
    }

    // ===================================================================
    // SERVICE PAUSE — client self-serve (Feature: pause service online)
    // ===================================================================
    case "service_pause_requested": {
      const pauseFrom = esc(v.pause_from || "—");
      const pauseUntil = esc(v.pause_until || "—");
      const reason = esc(v.pause_reason || (isEn ? "Not specified" : "Non précisée"));
      return {
        subject: isEn
          ? `Service pause request received`
          : `Demande de suspension reçue`,
        html: shell({
          preheader: isEn
            ? `We received your pause request.`
            : `Nous avons bien reçu votre demande de suspension.`,
          badge: t("DEMANDE REÇUE", "REQUEST RECEIVED", lang),
          heroTitle: t("Demande de suspension reçue", "Pause request received", lang),
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Your request to pause your service has been received. Our team will process it within 24 hours.`
            : `Votre demande de suspension de service a été reçue. Notre équipe la traitera sous 24 heures.`,
          cardTitle: t("Détails", "Details", lang),
          cardRows: [
            [t("Suspension demandée", "Pause requested", lang), pauseFrom],
            [t("Reprise prévue", "Resume planned", lang), pauseUntil],
            [t("Raison", "Reason", lang), reason],
          ],
          ctaPrimaryUrl: `${portalUrl}/services`,
          ctaPrimaryLabel: t("Voir mes services", "View my services", lang),
          helpHtml: isEn
            ? `Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Besoin d'aide ? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "service_pause_approved": {
      const pauseFrom = esc(v.pause_from || "—");
      const pauseUntil = esc(v.pause_until || "—");
      return {
        subject: isEn ? `Service paused — resumes ${pauseUntil}` : `Service suspendu — reprise le ${pauseUntil}`,
        html: shell({
          preheader: isEn
            ? `Your pause is now active.`
            : `Votre suspension est maintenant active.`,
          badge: t("SUSPENSION APPROUVÉE", "PAUSE APPROVED", lang),
          heroTitle: t("Service suspendu ⏸", "Service paused ⏸", lang),
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Your service will be paused from ${pauseFrom} to ${pauseUntil}. No billing during this period. Your service will resume automatically on ${pauseUntil}.`
            : `Votre service sera suspendu du ${pauseFrom} au ${pauseUntil}. Aucune facturation pendant cette période. Votre service reprendra automatiquement le ${pauseUntil}.`,
          cardTitle: t("Période de suspension", "Pause period", lang),
          cardRows: [
            [t("Du", "From", lang), pauseFrom],
            [t("Au", "To", lang), pauseUntil],
          ],
          ctaPrimaryUrl: `${portalUrl}/services`,
          ctaPrimaryLabel: t("Voir mes services", "View my services", lang),
          helpHtml: isEn
            ? `Need to come back earlier? Use the "Resume now" button in the portal.`
            : `Besoin de revenir plus tôt ? Utilisez le bouton "Reprendre maintenant" dans le portail.`,
        }),
      };
    }

    case "service_pause_admin_alert": {
      const clientLabel = esc(v.client_name || "Client");
      const pauseFrom = esc(v.pause_from || "—");
      const pauseUntil = esc(v.pause_until || "—");
      const reason = esc(v.pause_reason || "Non précisée");
      return {
        subject: `⏸ Demande de suspension service — ${clientLabel}`,
        html: shell({
          preheader: `Nouvelle demande à traiter.`,
          badge: "ALERTE INTERNE",
          heroTitle: "Suspension de service demandée",
          icon: "alert",
          greeting: `Bonjour,`,
          bodyText: `Le client ${clientLabel} veut suspendre son service du ${pauseFrom} au ${pauseUntil}.`,
          cardTitle: "Détails",
          cardRows: [
            ["Client", clientLabel],
            ["Compte", accountNum],
            ["Du", pauseFrom],
            ["Au", pauseUntil],
            ["Raison", reason],
          ],
          ctaPrimaryUrl: `${PORTAL_URL.replace(/\/portal$/, '')}/core/pause-requests`,
          ctaPrimaryLabel: "Traiter dans Core",
        }),
      };
    }

    case "service_resumed": {
      const planName = esc(v.plan_name || (isEn ? "your plan" : "votre forfait"));
      return {
        subject: isEn ? `Your service is active again` : `Votre service est de nouveau actif`,
        html: shell({
          preheader: isEn ? `Welcome back.` : `Bon retour.`,
          badge: t("SERVICE ACTIF", "SERVICE ACTIVE", lang),
          heroTitle: t("Service réactivé ✓", "Service resumed ✓", lang),
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Your service (${planName}) has been automatically resumed. Billing will resume on your next cycle.`
            : `Votre service (${planName}) a été automatiquement réactivé. La facturation reprendra à votre prochain cycle.`,
          ctaPrimaryUrl: `${portalUrl}/services`,
          ctaPrimaryLabel: t("Voir mes services", "View my services", lang),
        }),
      };
    }

    // ===================================================================
    // INVENTORY — low stock alert (admin)
    // ===================================================================
    case "inventory_low_stock": {
      const itemLabel = esc(v.item_name || `${v.brand || ""} ${v.model || ""}`.trim() || "Article");
      const sku = esc(v.sku || "—");
      const available = esc(String(v.available_count ?? 0));
      const minThr = esc(String(v.min_stock_threshold ?? 5));
      const statusLabel = String(v.stock_status) === "out_of_stock" ? "RUPTURE" : "CRITIQUE";
      return {
        subject: `⚠️ Stock bas — ${itemLabel}`,
        html: shell({
          preheader: `Stock insuffisant détecté pour ${itemLabel}.`,
          badge: "ALERTE INVENTAIRE",
          heroTitle: "Stock insuffisant détecté",
          icon: "alert",
          greeting: "Bonjour,",
          bodyText: `Le stock de l'article ${itemLabel} est ${statusLabel === "RUPTURE" ? "épuisé" : "sous le seuil critique"}. Veuillez réapprovisionner rapidement.`,
          cardTitle: "Détails de l'inventaire",
          cardRows: [
            ["Article", itemLabel],
            ["SKU", sku],
            ["Disponible", available],
            ["Seuil minimum", minThr],
            ["Statut", statusLabel],
          ],
          ctaPrimaryUrl: `${PORTAL_URL.replace(/\/portal$/, '')}/core/inventory`,
          ctaPrimaryLabel: "Ouvrir l'inventaire",
        }),
      };
    }

    // ===================================================================
    // REFERRAL — reward issued
    // ===================================================================
    case "referral_reward_issued": {
      const amt = money(v.reward_amount ?? 25);
      return {
        subject: isEn ? `Your referral reward has been issued` : `Votre récompense de parrainage est émise`,
        html: shell({
          preheader: isEn ? `You earned ${amt} for your referral.` : `Vous avez gagné ${amt} pour votre parrainage.`,
          badge: t("RÉCOMPENSE ÉMISE", "REWARD ISSUED", lang),
          heroTitle: t("Merci pour votre parrainage ✓", "Thanks for your referral ✓", lang),
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Great news — your referral has qualified. A reward of ${amt} has been issued to your account.`
            : `Excellente nouvelle — votre filleul est qualifié. Une récompense de ${amt} a été émise sur votre compte.`,
          cardTitle: t("Détails", "Details", lang),
          cardRows: [
            [t("Récompense", "Reward", lang), amt],
            [t("Type", "Type", lang), t("Crédit parrainage", "Referral credit", lang)],
          ],
          ctaPrimaryUrl: `${portalUrl}/referrals`,
          ctaPrimaryLabel: t("Voir mes parrainages", "View my referrals", lang),
        }),
      };
    }

    // ===================================================================
    // MAINTENANCE — notification to all clients
    // ===================================================================
    case "maintenance_notification": {
      const startAt = esc(v.scheduled_start_at || "—");
      const duration = esc(v.estimated_duration || (isEn ? "TBD" : "À confirmer"));
      const services = esc(v.affected_services || (isEn ? "Some services" : "Certains services"));
      const mtype = String(v.maintenance_type || "planned");
      const typeLabel = isEn
        ? (mtype === "emergency" ? "Emergency" : mtype === "unplanned" ? "Unplanned" : "Planned")
        : (mtype === "emergency" ? "Urgence" : mtype === "unplanned" ? "Non planifiée" : "Planifiée");
      return {
        subject: isEn
          ? `Scheduled Maintenance — Nivra Telecom ${startAt}`
          : `Maintenance planifiée — Nivra Telecom ${startAt}`,
        html: shell({
          preheader: isEn
            ? `Service maintenance scheduled for ${startAt}.`
            : `Maintenance de service prévue le ${startAt}.`,
          badge: t("AVIS DE MAINTENANCE", "MAINTENANCE NOTICE", lang),
          heroTitle: t("Maintenance planifiée de nos services", "Scheduled Service Maintenance", lang),
          icon: "alert",
          greeting,
          bodyText: isEn
            ? `We're informing you that ${typeLabel.toLowerCase()} maintenance is scheduled for ${startAt}. During this period, ${services} may be temporarily unavailable. We apologize for any inconvenience.`
            : `Nous vous informons qu'une maintenance ${typeLabel.toLowerCase()} est prévue le ${startAt}. Pendant cette période, ${services} pourrait être temporairement indisponible. Nous nous excusons pour tout inconvénient.`,
          cardTitle: t("Détails de la maintenance", "Maintenance details", lang),
          cardRows: [
            [t("Date", "Date", lang), startAt],
            [t("Durée estimée", "Estimated duration", lang), duration],
            [t("Services affectés", "Affected services", lang), services],
            [t("Type", "Type", lang), typeLabel],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/statut",
          ctaPrimaryLabel: t("Voir le statut en direct", "View live status", lang),
        }),
      };
    }

    // ===================================================================
    // EMPLOYEE BADGE READY (bilingual FR/EN)
    // ===================================================================
    case "employee_badge_ready": {
      const fullName = esc(v.full_name || clientName);
      const agentNumber = esc(v.agent_number || "—");
      const roleTitle = esc(isEn ? (v.role_title_en || v.role_title) : v.role_title);
      const ctaUrl = String(v.portal_url || portalUrl) + "/badge";
      return {
        subject: isEn ? "Your Nivra badge is ready" : "Votre badge Nivra est prêt",
        html: shell({
          preheader: isEn
            ? `Your digital Nivra employee badge ${agentNumber} is available.`
            : `Votre badge employé numérique Nivra ${agentNumber} est disponible.`,
          badge: isEn ? "BADGE AVAILABLE" : "BADGE DISPONIBLE",
          heroTitle: isEn ? "Your Nivra badge is ready" : "Votre badge Nivra est prêt",
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Your digital employee badge is now available. Add it to Apple Wallet or Google Wallet, or download the printable PDF version.`
            : `Votre badge employé numérique est maintenant disponible. Ajoutez-le à Apple Wallet ou Google Wallet, ou téléchargez la version PDF imprimable.`,
          cardTitle: isEn ? "Badge details" : "Détails du badge",
          cardRows: [
            [isEn ? "Name" : "Nom", fullName],
            [isEn ? "Role" : "Rôle", roleTitle || (isEn ? "Employee" : "Employé")],
            [isEn ? "Badge number" : "N° badge", agentNumber],
          ],
          ctaPrimaryUrl: ctaUrl,
          ctaPrimaryLabel: isEn ? "View my badge" : "Voir mon badge",
        }),
      };
    }

    default:
      return null;
  }
}

