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
const SUPPORT_EMAIL = "support@nivra-telecom.ca";

/**
 * Pick the right "Mes commissions" portal URL based on the recipient role.
 * Commission emails go to BOTH Field agents (who work in /field) and HR
 * employees (who work in /rh). Sending everyone to /rh was a UX miss — a
 * Field agent landed on a page they don't normally use and got auth errors.
 *
 * The caller passes one of:
 *   v.agent_role: "field" | "employee" | "hr" | "admin" | "technician"
 *   v.recipient_portal: "field" | "rh" | "core" | "tech" (explicit override)
 *   v.portal_url: full URL (highest precedence — caller knows best)
 */
function pickCommissionPortalUrl(v: Record<string, unknown>): string {
  // Caller-provided explicit URL wins.
  if (typeof v.portal_url === "string" && v.portal_url.startsWith("http")) {
    return v.portal_url;
  }
  const portal = String(v.recipient_portal || "").toLowerCase();
  const role = String(v.agent_role || v.role || "").toLowerCase();

  // Explicit portal hint takes precedence.
  if (portal === "field") return `${APP_URL}/field/commissions`;
  if (portal === "tech") return `${APP_URL}/tech`;
  if (portal === "core") return `${APP_URL}/core/commissions`;
  if (portal === "rh") return `${APP_URL}/rh/commissions`;

  // Otherwise infer from role.
  if (role === "field" || role === "field_agent" || role === "sales") {
    return `${APP_URL}/field/commissions`;
  }
  if (role === "technician") return `${APP_URL}/tech`;

  // Default for HR / employee / admin — the historic destination.
  return `${APP_URL}/rh/commissions`;
}

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
  extraBodyHtml?: string;     // optional raw HTML rendered AFTER the CTA block
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
    extraBodyHtml: opts.extraBodyHtml,
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

      const stepCardCss = `margin:0 0 14px 0;padding:16px 18px;background:#ffffff;border:1px solid #ddd6fe;border-left:4px solid #7c3aed;border-radius:8px;`;
      const stepTitleCss = `font-weight:700;color:#1f2937;font-size:15px;margin:0 0 8px 0;line-height:1.4;`;
      const stepBodyCss = `font-size:14px;color:#4b5563;line-height:1.65;margin:0;white-space:pre-line;`;

      const onboardingStepsHtml = `
        <div style="margin:28px 0 12px 0;padding:18px 20px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;">
          <div style="font-weight:800;color:#5b21b6;font-size:17px;margin:0 0 4px 0;">Comment compléter votre inscription</div>
          <div style="font-size:13px;color:#6d28d9;margin:0;">Suivez ces étapes dans l'ordre</div>
        </div>

        <div style="${stepCardCss}">
          <div style="${stepTitleCss}">🔑 Étape 1 — Créez votre mot de passe</div>
          <div style="${stepBodyCss}">Choisissez un mot de passe fort contenant au minimum :
• 8 caractères
• 1 lettre majuscule (ex: A, B, C)
• 1 lettre minuscule (ex: a, b, c)
• 1 chiffre (ex: 1, 2, 3)
• 1 caractère spécial (ex: !, @, #, $)

Exemple : Nivra2026!

Confirmez votre mot de passe en le saisissant une deuxième fois.</div>
        </div>

        <div style="${stepCardCss}">
          <div style="${stepTitleCss}">🔒 Étape 2 — Choisissez votre NIP de sécurité</div>
          <div style="${stepBodyCss}">Créez un NIP à 6 chiffres unique que vous seul connaissez.
Ce NIP vous sera demandé lors de certaines actions sensibles sur votre compte.
Confirmez votre NIP en le saisissant une deuxième fois.

⚠️ Ne partagez jamais votre NIP.</div>
        </div>

        <div style="${stepCardCss}">
          <div style="${stepTitleCss}">📱 Étape 3 — Configurez l'authentification à deux facteurs (2FA)</div>
          <div style="${stepBodyCss}">1. Téléchargez l'application Google Authenticator ou Microsoft Authenticator sur votre téléphone.
2. Ouvrez l'application et scannez le code QR affiché sur votre écran.
3. L'application va générer un code à 6 chiffres.
4. Saisissez ce code dans le champ prévu à cet effet.

✅ Votre 2FA est maintenant configuré.</div>
        </div>

        <div style="${stepCardCss}">
          <div style="${stepTitleCss}">📋 Étape 4 — Lisez et acceptez les conditions</div>
          <div style="${stepBodyCss}">Prenez le temps de lire attentivement :
• Les termes et conditions d'utilisation
• La politique de confidentialité
• Les règles de conformité Nivra Telecom

Cochez la case pour confirmer votre acceptation.</div>
        </div>

        <div style="${stepCardCss}">
          <div style="${stepTitleCss}">✉️ Étape 5 — Vérification par courriel</div>
          <div style="${stepBodyCss}">Pour finaliser votre inscription :
1. Sélectionnez la vérification par courriel comme méthode de double authentification.
2. Vérifiez votre boîte courriel — vous recevrez un NIP à 6 chiffres.
3. Saisissez ce NIP dans le champ prévu à cet effet.

🎉 Votre compte est maintenant activé!</div>
        </div>
      `;

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
          extraBodyHtml: onboardingStepsHtml,
          helpHtml: `Besoin d'aide ? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    // ===================================================================
    // STAFF — Field Sales welcome confirmation (post setup) — Violet Bold
    // ===================================================================
    case "agent_welcome_confirmed": {
      const firstName = esc(v.first_name || v.FIRST_NAME || clientName || "Agent");
      const supervisorName = esc(v.supervisor_name || "Marvens");
      const portalLoginUrl = "https://nivra-telecom.ca/nivra-secure-hub-2617-internal/login";

      const stepCardCss = `margin:0 0 14px 0;padding:16px 18px;background:#ffffff;border:1px solid #ddd6fe;border-left:4px solid #7c3aed;border-radius:8px;`;
      const stepTitleCss = `font-weight:700;color:#1f2937;font-size:15px;margin:0 0 8px 0;line-height:1.4;`;
      const stepBodyCss = `font-size:14px;color:#4b5563;line-height:1.65;margin:0;white-space:pre-line;`;

      const firstStepsHtml = `
        <div style="margin:28px 0 12px 0;padding:18px 20px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;">
          <div style="font-weight:800;color:#5b21b6;font-size:17px;margin:0;">Vos premières étapes</div>
        </div>

        <div style="${stepCardCss}">
          <div style="${stepTitleCss}">🔐 Étape 1 — Connectez-vous à votre portail</div>
          <div style="${stepBodyCss}">Accédez à votre espace de travail :
<a href="${portalLoginUrl}" style="color:#7c3aed;font-weight:600;">${portalLoginUrl}</a>

1. Sélectionnez « Nivra Field »
2. Entrez votre adresse courriel
3. Entrez votre mot de passe
4. Entrez le code de votre application Authenticator
5. Vous êtes dans votre tableau de bord Nivra Field!</div>
        </div>

        <div style="${stepCardCss}">
          <div style="${stepTitleCss}">🎓 Étape 2 — Complétez votre formation Nivra Academy</div>
          <div style="${stepBodyCss}">Dans votre tableau de bord, cliquez sur « Nivra Academy ».
Complétez TOUS les modules de formation dans l'ordre :
• Introduction à Nivra Telecom
• Nos produits et forfaits
• Vos commissions et revenus
• Techniques de vente porte-à-porte
• Comment se présenter
• Politiques internes
• Lois et règlements
• Facturation et contrats

⚠️ La formation est OBLIGATOIRE avant votre première journée terrain.</div>
        </div>

        <div style="${stepCardCss}">
          <div style="${stepTitleCss}">🏆 Étape 3 — Obtenez votre certification</div>
          <div style="${stepBodyCss}">Une fois tous les modules complétés et les quiz réussis (80% minimum), vous obtiendrez votre certificat Nivra Telecom.
Votre superviseur ${supervisorName} vous donnera ensuite votre première journée sur le terrain.

Bonne chance et bienvenue dans l'équipe! 🎉</div>
        </div>
      `;

      return {
        subject: `Bienvenue chez Nivra Telecom, ${firstName}! Votre compte est activé`,
        html: shell({
          preheader: "Votre compte Nivra Field est maintenant activé.",
          badge: "COMPTE ACTIVÉ",
          heroTitle: "Bienvenue dans l'équipe Nivra Telecom!",
          heroSub: "Votre compte est prêt à l'emploi.",
          icon: "check",
          greeting: `Bonjour ${firstName},`,
          bodyText: `Félicitations! Votre compte Nivra Telecom est maintenant activé et prêt à l'emploi.<br/><br/>Votre superviseur <strong>${supervisorName}</strong> vous contactera prochainement pour vous accueillir dans l'équipe et répondre à vos questions.`,
          cardTitle: "Votre compte",
          cardRows: [
            ["Votre rôle", "Agent Terrain — Nivra Telecom"],
            ["Votre superviseur", supervisorName],
            ["Statut du compte", "Activé ✅"],
            ["Prochaine étape", "Compléter la formation"],
          ],
          ctaPrimaryUrl: portalLoginUrl,
          ctaPrimaryLabel: "Accéder à mon portail Nivra Field",
          extraBodyHtml: firstStepsHtml,
          helpHtml: `Pour toute question, contactez votre superviseur ${supervisorName} ou écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>`,
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
    // CLIENT — Invitation to set up online account (sent by staff)
    // ===================================================================
    case "client_account_invite": {
      const setupLink = String(v.setup_link || v.reset_link || v.action_link || "#");
      const firstName = esc(v.first_name || v.FIRST_NAME || clientName || "");
      const emailRow = esc(v.email || v.to_email || "Non disponible");
      return {
        subject: "Activez votre compte en ligne — Nivra Télécom",
        html: shell({
          preheader: "Définissez votre mot de passe pour accéder à votre espace client Nivra.",
          badge: "ACTIVATION DE COMPTE",
          heroTitle: "Activez votre compte en ligne",
          heroSub: "Définissez votre mot de passe pour accéder à votre espace client.",
          icon: "star",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Un compte en ligne Nivra a été créé pour vous. Cliquez sur le bouton ci-dessous pour <strong>définir votre mot de passe</strong> et accéder à votre espace client : factures, paiements, services, support et plus encore.<br/><br/><strong style="color:#7c3aed;">Ce lien est valide 1 heure.</strong>`,
          cardTitle: "Détails de votre compte",
          cardRows: [
            ["Courriel", emailRow],
            ["Portail", "Espace client Nivra"],
            ["Validité du lien", "1 heure"],
          ],
          ctaPrimaryUrl: setupLink,
          ctaPrimaryLabel: "Définir mon mot de passe",
          helpHtml: `Si vous n'attendiez pas cette invitation, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Email address changed by staff (notice to new address)
    // ===================================================================
    case "client_email_changed_notice": {
      const firstName = esc(v.first_name || v.FIRST_NAME || clientName || "");
      const oldEmail = esc(v.old_email || "Précédent courriel");
      const newEmail = esc(v.new_email || v.to_email || "");
      return {
        subject: "Votre adresse courriel a été mise à jour — Nivra Télécom",
        html: shell({
          preheader: "Confirmation de mise à jour de votre adresse courriel.",
          badge: "COURRIEL MIS À JOUR",
          heroTitle: "Votre courriel a été mis à jour",
          heroSub: "Voici la confirmation du changement.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Sur demande, nous avons mis à jour l'adresse courriel associée à votre compte Nivra. Vous devez désormais utiliser la nouvelle adresse pour vous connecter.`,
          cardTitle: "Détails du changement",
          cardRows: [
            ["Ancienne adresse", oldEmail],
            ["Nouvelle adresse", newEmail],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/portal/auth",
          ctaPrimaryLabel: "Accéder à mon espace client",
          helpVariant: "warning",
          helpHtml: `Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Mobile top-up confirmation (recharge prépayée)
    // ===================================================================
    case "client_mobile_topup_confirmation": {
      const firstName = esc(v.first_name || clientName || "");
      const amount = esc(v.amount || "0,00 $");
      const msisdn = esc(v.msisdn || "Non spécifié");
      const ref = esc(v.payment_reference || "—");
      const method = esc(v.payment_method || "—");
      return {
        subject: `Recharge confirmée — ${amount}`,
        html: shell({
          preheader: `Votre recharge mobile de ${amount} a été appliquée.`,
          badge: "RECHARGE CONFIRMÉE",
          heroTitle: "Recharge appliquée à votre compte",
          heroSub: "Votre solde a été mis à jour.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons que votre recharge mobile a été appliquée avec succès à votre ligne. Vous pouvez consulter le détail dans votre espace client.`,
          cardTitle: "Détails de la recharge",
          cardRows: [
            ["Numéro mobile", msisdn],
            ["Montant", amount],
            ["Méthode de paiement", method],
            ["Référence", ref],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Mobile add-on activated or cancelled
    // ===================================================================
    case "client_mobile_addon_change": {
      const firstName = esc(v.first_name || clientName || "");
      const addonName = esc(v.addon_name || "Option mobile");
      const change = String(v.change_type || "activated");
      const price = esc(v.monthly_price || "0,00 $");
      const isActivation = change === "activated";
      return {
        subject: isActivation
          ? `Option ajoutée — ${addonName}`
          : `Option retirée — ${addonName}`,
        html: shell({
          preheader: isActivation
            ? `L'option ${addonName} a été ajoutée à votre forfait.`
            : `L'option ${addonName} a été retirée de votre forfait.`,
          badge: isActivation ? "OPTION AJOUTÉE" : "OPTION RETIRÉE",
          heroTitle: isActivation ? "Option ajoutée à votre forfait" : "Option retirée de votre forfait",
          heroSub: isActivation
            ? "Elle est active immédiatement."
            : "Le retrait est effectif immédiatement.",
          icon: isActivation ? "check" : "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: isActivation
            ? `Nous confirmons l'ajout de l'option suivante à votre ligne mobile. Le coût sera reflété sur votre prochaine facture.`
            : `Nous confirmons le retrait de l'option suivante de votre ligne mobile. Elle ne sera plus facturée à partir du prochain cycle.`,
          cardTitle: "Détails de l'option",
          cardRows: [
            ["Option", addonName],
            ["Tarif mensuel", price],
            ["Statut", isActivation ? "Active" : "Annulée"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — SIM action (suspended, replaced, swap-eSIM, etc.)
    // ===================================================================
    case "client_mobile_sim_action": {
      const firstName = esc(v.first_name || clientName || "");
      const actionLabel = esc(v.action_label || "Mise à jour SIM");
      const reason = esc(v.reason || "—");
      const msisdn = esc(v.msisdn || "—");
      const isCritical = String(v.is_critical || "false") === "true";
      return {
        subject: `Sécurité de votre ligne — ${actionLabel}`,
        html: shell({
          preheader: `Votre ligne mobile : ${actionLabel}.`,
          badge: isCritical ? "ACTION DE SÉCURITÉ" : "MISE À JOUR LIGNE",
          heroTitle: `Votre ligne mobile : ${actionLabel}`,
          heroSub: isCritical
            ? "Une action de sécurité a été appliquée."
            : "La mise à jour a été appliquée.",
          icon: isCritical ? "warning" : "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: isCritical
            ? `Pour protéger votre ligne mobile, l'action suivante a été appliquée à votre compte. Si vous n'êtes pas à l'origine de cette demande, contactez-nous immédiatement.`
            : `Nous confirmons la mise à jour suivante sur votre ligne mobile.`,
          cardTitle: "Détails de l'action",
          cardRows: [
            ["Numéro mobile", msisdn],
            ["Action", actionLabel],
            ["Raison", reason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpVariant: isCritical ? "warning" : undefined,
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }


    // ===================================================================
    // CLIENT — TV plan change (upgrade / downgrade / lateral)
    // ===================================================================
    case "client_tv_plan_change": {
      const firstName = esc(v.first_name || clientName || "");
      const prev = esc(v.previous_plan_name || "—");
      const next = esc(v.new_plan_name || "—");
      const price = esc(v.new_monthly_price || "0,00 $");
      const eff = esc(v.effective_date || "");
      const changeType = String(v.change_type || "upgrade");
      const labelMap: Record<string, string> = {
        upgrade: "Mise à niveau de votre forfait TV",
        downgrade: "Modification de votre forfait TV",
        lateral: "Modification de votre forfait TV",
        reactivation: "Réactivation de votre forfait TV",
        cancellation: "Annulation de votre forfait TV",
      };
      const heroTitle = labelMap[changeType] || "Modification de votre forfait TV";
      return {
        subject: `Votre forfait TV — ${next}`,
        html: shell({
          preheader: `Votre nouveau forfait TV : ${next}.`,
          badge: "FORFAIT TV MIS À JOUR",
          heroTitle,
          heroSub: "Le changement a été appliqué.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la modification de votre forfait télévision. Les changements sont effectifs à compter de la date indiquée et seront reflétés sur votre prochaine facture.`,
          cardTitle: "Détails du changement",
          cardRows: [
            ["Ancien forfait", prev],
            ["Nouveau forfait", next],
            ["Tarif mensuel", price],
            ["Date effective", eff],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — TV themed pack activated / cancelled
    // ===================================================================
    case "client_tv_pack_change": {
      const firstName = esc(v.first_name || clientName || "");
      const addonName = esc(v.addon_name || "Bouquet TV");
      const change = String(v.change_type || "activated");
      const price = esc(v.monthly_price || "0,00 $");
      const isActivation = change === "activated";
      return {
        subject: isActivation
          ? `Bouquet TV ajouté — ${addonName}`
          : `Bouquet TV retiré — ${addonName}`,
        html: shell({
          preheader: isActivation
            ? `Le bouquet ${addonName} a été ajouté à votre forfait TV.`
            : `Le bouquet ${addonName} a été retiré de votre forfait TV.`,
          badge: isActivation ? "BOUQUET AJOUTÉ" : "BOUQUET RETIRÉ",
          heroTitle: isActivation ? "Bouquet ajouté à votre forfait TV" : "Bouquet retiré de votre forfait TV",
          heroSub: isActivation
            ? "Il est disponible immédiatement."
            : "Le retrait est effectif immédiatement.",
          icon: isActivation ? "check" : "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: isActivation
            ? `Nous confirmons l'ajout du bouquet thématique suivant à votre service TV. Le coût sera reflété sur votre prochaine facture.`
            : `Nous confirmons le retrait du bouquet suivant. Il ne sera plus facturé à partir du prochain cycle.`,
          cardTitle: "Détails du bouquet",
          cardRows: [
            ["Bouquet", addonName],
            ["Tarif mensuel", price],
            ["Statut", isActivation ? "Actif" : "Annulé"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — TV VOD / PPV purchase
    // ===================================================================
    case "client_tv_vod_purchase": {
      const firstName = esc(v.first_name || clientName || "");
      const title = esc(v.title || "Contenu à la demande");
      const ctype = esc(v.content_type || "movie");
      const amount = esc(v.amount || "0,00 $");
      const method = esc(v.payment_method || "—");
      const ref = esc(v.payment_reference || "—");
      return {
        subject: `Achat confirmé — ${title}`,
        html: shell({
          preheader: `Votre achat « ${title} » a été enregistré.`,
          badge: "ACHAT CONFIRMÉ",
          heroTitle: "Votre achat à la demande est confirmé",
          heroSub: "Le contenu est disponible sur votre décodeur.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons l'achat suivant. Si l'achat est facturé sur votre prochaine facture, le montant y apparaîtra clairement.`,
          cardTitle: "Détails de l'achat",
          cardRows: [
            ["Titre", title],
            ["Type", ctype],
            ["Montant", amount],
            ["Méthode", method],
            ["Référence", ref],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — TV terminal action (reboot, factory_reset, etc.)
    // ===================================================================
    case "client_tv_terminal_action": {
      const firstName = esc(v.first_name || clientName || "");
      const actionLabel = esc(v.action_label || "Action sur le terminal TV");
      const serial = esc(v.terminal_serial || "—");
      const reason = esc(v.reason || "—");
      const isCritical = String(v.is_critical || "false") === "true";
      return {
        subject: `Terminal TV — ${actionLabel}`,
        html: shell({
          preheader: `Votre terminal TV : ${actionLabel}.`,
          badge: isCritical ? "ACTION DE SÉCURITÉ" : "INTERVENTION TERMINAL",
          heroTitle: `Votre terminal TV : ${actionLabel}`,
          heroSub: isCritical
            ? "Une action sensible a été appliquée."
            : "L'intervention a été appliquée.",
          icon: isCritical ? "warning" : "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: isCritical
            ? `Une intervention sensible a été appliquée à votre terminal TV. Si vous n'êtes pas à l'origine de cette demande, contactez-nous immédiatement.`
            : `Nous confirmons l'intervention suivante sur votre terminal TV. Aucune action n'est requise de votre part.`,
          cardTitle: "Détails de l'intervention",
          cardRows: [
            ["Terminal", serial],
            ["Action", actionLabel],
            ["Raison", reason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpVariant: isCritical ? "warning" : undefined,
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — TV parental controls updated
    // ===================================================================
    case "client_tv_parental_controls": {
      const firstName = esc(v.first_name || clientName || "");
      const enabled = String(v.enabled || "false") === "true";
      const rating = esc(v.max_rating || "PG-13");
      const blockedCount = esc(v.blocked_count || "0");
      const pinChanged = String(v.pin_changed || "false") === "true";
      return {
        subject: enabled
          ? "Contrôle parental TV — Activé"
          : "Contrôle parental TV — Désactivé",
        html: shell({
          preheader: enabled
            ? "Le contrôle parental est activé sur votre compte TV."
            : "Le contrôle parental a été désactivé sur votre compte TV.",
          badge: "SÉCURITÉ TV",
          heroTitle: enabled ? "Contrôle parental activé" : "Contrôle parental désactivé",
          heroSub: enabled
            ? "Les paramètres sont effectifs immédiatement."
            : "Aucune restriction de contenu n'est désormais appliquée.",
          icon: enabled ? "shield" : "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la mise à jour du contrôle parental sur votre service télévision. Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement.`,
          cardTitle: "Paramètres appliqués",
          cardRows: [
            ["Statut", enabled ? "Activé" : "Désactivé"],
            ["Classification max", rating],
            ["Chaînes bloquées", blockedCount],
            ["NIP modifié", pinChanged ? "Oui" : "Non"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Internet plan change
    // ===================================================================
    case "client_internet_plan_change": {
      const firstName = esc(v.first_name || clientName || "");
      const prevPlan = esc(v.previous_plan_name || "—");
      const newPlan = esc(v.new_plan_name || "Forfait Internet");
      const price = esc(v.new_monthly_price || "0,00 $");
      const speed = esc(v.new_speed_mbps || "—");
      const eff = esc(v.effective_date || "");
      const ctype = String(v.change_type || "upgrade");
      const label = ctype === "downgrade" ? "Rétrogradation" : ctype === "lateral" ? "Changement latéral" : "Mise à niveau";
      return {
        subject: `Forfait Internet mis à jour — ${newPlan}`,
        html: shell({
          preheader: `Votre nouveau forfait Internet : ${newPlan}.`,
          badge: "FORFAIT INTERNET MIS À JOUR",
          heroTitle: "Votre forfait Internet a été modifié",
          heroSub: `${label} effective le ${eff}.`,
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la modification de votre forfait Internet. Le nouveau tarif sera reflété sur votre prochaine facture.`,
          cardTitle: "Détails du changement",
          cardRows: [
            ["Ancien forfait", prevPlan],
            ["Nouveau forfait", newPlan],
            ["Vitesse (Mbps)", speed],
            ["Tarif mensuel", price],
            ["Date d'effet", eff],
            ["Type", label],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Internet modem action (reboot, factory_reset, etc.)
    // ===================================================================
    case "client_internet_modem_action": {
      const firstName = esc(v.first_name || clientName || "");
      const actionLabel = esc(v.action_label || "Action sur le modem");
      const serial = esc(v.modem_serial || "—");
      const mac = esc(v.modem_mac || "—");
      const reason = esc(v.reason || "—");
      const isCritical = String(v.is_critical || "false") === "true";
      return {
        subject: `Modem Internet — ${actionLabel}`,
        html: shell({
          preheader: `Votre modem Internet : ${actionLabel}.`,
          badge: isCritical ? "ACTION DE SÉCURITÉ" : "INTERVENTION MODEM",
          heroTitle: `Votre modem : ${actionLabel}`,
          heroSub: isCritical ? "Une action sensible a été appliquée." : "L'intervention a été appliquée.",
          icon: isCritical ? "warning" : "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: isCritical
            ? `Une intervention sensible a été appliquée à votre modem Internet. Si vous n'êtes pas à l'origine de cette demande, contactez-nous immédiatement.`
            : `Nous confirmons l'intervention suivante sur votre modem Internet. Votre connexion peut être brièvement interrompue.`,
          cardTitle: "Détails de l'intervention",
          cardRows: [
            ["Numéro de série", serial],
            ["Adresse MAC", mac],
            ["Action", actionLabel],
            ["Raison", reason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpVariant: isCritical ? "warning" : undefined,
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Internet line diagnostic results
    // ===================================================================
    case "client_internet_diagnostic": {
      const firstName = esc(v.first_name || clientName || "");
      const dtype = esc(v.diagnostic_type || "full");
      const link = esc(v.link_status || "—");
      const dl = esc(v.download_mbps || "—");
      const ul = esc(v.upload_mbps || "—");
      const lat = esc(v.latency_ms || "—");
      const loss = esc(v.packet_loss_pct || "—");
      const notes = esc(v.notes || "—");
      return {
        subject: "Résultats du diagnostic Internet",
        html: shell({
          preheader: "Le diagnostic de votre ligne Internet est disponible.",
          badge: "DIAGNOSTIC INTERNET",
          heroTitle: "Résultats du diagnostic de ligne",
          heroSub: "Voici l'état de votre connexion.",
          icon: "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Un diagnostic a été effectué sur votre ligne Internet par notre équipe technique. Vous trouverez ci-dessous les résultats.`,
          cardTitle: "Résultats",
          cardRows: [
            ["Type de diagnostic", dtype],
            ["État du lien", link],
            ["Téléchargement (Mbps)", dl],
            ["Téléversement (Mbps)", ul],
            ["Latence (ms)", lat],
            ["Perte de paquets (%)", loss],
            ["Notes", notes],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Internet WiFi configuration updated
    // ===================================================================
    case "client_internet_wifi_change": {
      const firstName = esc(v.first_name || clientName || "");
      const ssid24 = esc(v.ssid_24 || "—");
      const ssid5 = esc(v.ssid_5 || "—");
      const band = esc(v.band_mode || "dual");
      const guestOn = String(v.guest_enabled || "false") === "true";
      const guestSsid = esc(v.guest_ssid || "—");
      return {
        subject: "Configuration WiFi mise à jour",
        html: shell({
          preheader: "Vos paramètres WiFi ont été modifiés.",
          badge: "WIFI MIS À JOUR",
          heroTitle: "Votre configuration WiFi a été modifiée",
          heroSub: "Les changements sont effectifs immédiatement.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la mise à jour de la configuration WiFi de votre service Internet. Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement.`,
          cardTitle: "Paramètres appliqués",
          cardRows: [
            ["Bande", band],
            ["Réseau 2,4 GHz (SSID)", ssid24],
            ["Réseau 5 GHz (SSID)", ssid5],
            ["Réseau invité", guestOn ? "Activé" : "Désactivé"],
            ["SSID invité", guestSsid],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Static IP assigned / released
    // ===================================================================
    case "client_internet_static_ip": {
      const firstName = esc(v.first_name || clientName || "");
      const mode = String(v.mode || "assigned");
      const isAssigned = mode === "assigned";
      const ip = esc(v.ip_address || "—");
      const price = esc(v.monthly_price || "0,00 $");
      const reason = esc(v.reason || "—");
      return {
        subject: isAssigned ? `Adresse IP statique attribuée — ${ip}` : "Adresse IP statique libérée",
        html: shell({
          preheader: isAssigned
            ? `Votre adresse IP statique ${ip} est active.`
            : `Votre adresse IP statique a été libérée.`,
          badge: isAssigned ? "IP STATIQUE ACTIVE" : "IP STATIQUE LIBÉRÉE",
          heroTitle: isAssigned ? "Adresse IP statique attribuée" : "Adresse IP statique libérée",
          heroSub: isAssigned ? "Le service est actif immédiatement." : "Le service est interrompu.",
          icon: isAssigned ? "check" : "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: isAssigned
            ? `Nous confirmons l'attribution d'une adresse IP statique à votre ligne Internet. Le tarif mensuel sera ajouté à votre prochaine facture.`
            : `Nous confirmons la libération de votre adresse IP statique. Aucun tarif mensuel ne sera plus facturé à partir du prochain cycle.`,
          cardTitle: "Détails",
          cardRows: [
            ["Adresse IP", ip],
            ["Tarif mensuel", price],
            ["Statut", isAssigned ? "Active" : "Libérée"],
            ["Raison", reason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Payment method added / removed / set default
    // ===================================================================
    case "client_payment_method_change": {
      const firstName = esc(v.first_name || clientName || "");
      const change = String(v.change_type || "added");
      const methodLabel = esc(v.method_label || "Méthode de paiement");
      const last4 = esc(v.last4 || "—");
      const isDefault = String(v.is_default || "false") === "true";
      const titleMap: Record<string, string> = {
        added: "Méthode de paiement ajoutée",
        removed: "Méthode de paiement retirée",
        default_set: "Méthode de paiement par défaut mise à jour",
      };
      const badgeMap: Record<string, string> = {
        added: "MÉTHODE AJOUTÉE",
        removed: "MÉTHODE RETIRÉE",
        default_set: "PAR DÉFAUT MISE À JOUR",
      };
      const title = titleMap[change] || "Modification méthode de paiement";
      return {
        subject: title,
        html: shell({
          preheader: `${title} : ${methodLabel}${last4 !== "—" ? ` •••• ${last4}` : ""}`,
          badge: badgeMap[change] || "MÉTHODE DE PAIEMENT",
          heroTitle: title,
          heroSub: "Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement.",
          icon: change === "removed" ? "warning" : "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la mise à jour suivante de vos méthodes de paiement.`,
          cardTitle: "Détails",
          cardRows: [
            ["Méthode", methodLabel],
            ["4 derniers chiffres", last4],
            ["Définie par défaut", isDefault ? "Oui" : "Non"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpVariant: change === "removed" ? "warning" : undefined,
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Auto-pay toggled
    // ===================================================================
    case "client_autopay_change": {
      const firstName = esc(v.first_name || clientName || "");
      const enabled = String(v.enabled || "false") === "true";
      const offset = esc(v.charge_day_offset || "0");
      const reason = esc(v.reason || "—");
      return {
        subject: enabled ? "Paiement automatique activé" : "Paiement automatique désactivé",
        html: shell({
          preheader: enabled
            ? "Vos factures seront prélevées automatiquement."
            : "Vous devrez payer vos factures manuellement.",
          badge: enabled ? "PAIEMENT AUTO ACTIVÉ" : "PAIEMENT AUTO DÉSACTIVÉ",
          heroTitle: enabled ? "Paiement automatique activé" : "Paiement automatique désactivé",
          heroSub: enabled
            ? "Vos factures seront prélevées automatiquement à la date d'échéance."
            : "Veuillez régler vos prochaines factures depuis votre espace client.",
          icon: enabled ? "check" : "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la mise à jour de votre préférence de paiement automatique.`,
          cardTitle: "Paramètres",
          cardRows: [
            ["Statut", enabled ? "Activé" : "Désactivé"],
            ["Décalage du jour de prélèvement", offset],
            ["Note", reason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Payment plan created
    // ===================================================================
    case "client_payment_plan_created": {
      const firstName = esc(v.first_name || clientName || "");
      const total = esc(v.total_amount || "0,00 $");
      const count = esc(v.installment_count || "0");
      const each = esc(v.installment_amount || "0,00 $");
      const freq = esc(v.frequency || "monthly");
      const first = esc(v.first_due_date || "");
      const freqLabel = freq === "weekly" ? "hebdomadaire" : freq === "biweekly" ? "aux deux semaines" : "mensuelle";
      return {
        subject: `Plan de paiement confirmé — ${count} versements`,
        html: shell({
          preheader: `Votre plan de paiement de ${total} est actif.`,
          badge: "PLAN DE PAIEMENT ACTIF",
          heroTitle: "Plan de paiement confirmé",
          heroSub: "Votre solde sera réparti selon le calendrier ci-dessous.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la mise en place d'un plan de paiement échelonné. Veuillez régler chaque versement à la date prévue pour éviter toute interruption de service.`,
          cardTitle: "Détails du plan",
          cardRows: [
            ["Montant total", total],
            ["Nombre de versements", count],
            ["Montant par versement", each],
            ["Fréquence", freqLabel],
            ["Premier versement", first],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Payment plan cancelled
    // ===================================================================
    case "client_payment_plan_cancelled": {
      const firstName = esc(v.first_name || clientName || "");
      const total = esc(v.total_amount || "0,00 $");
      const count = esc(v.installment_count || "0");
      const reason = esc(v.reason || "—");
      return {
        subject: "Plan de paiement annulé",
        html: shell({
          preheader: "Votre plan de paiement a été annulé.",
          badge: "PLAN ANNULÉ",
          heroTitle: "Plan de paiement annulé",
          heroSub: "Le solde restant redevient exigible selon vos factures.",
          icon: "warning",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons l'annulation de votre plan de paiement échelonné. Veuillez consulter votre espace client pour connaître votre solde actuel.`,
          cardTitle: "Détails",
          cardRows: [
            ["Montant total initial", total],
            ["Nombre de versements prévus", count],
            ["Raison", reason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpVariant: "warning",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Billing settings change (cycle day / format / language)
    // ===================================================================
    case "client_billing_settings_change": {
      const firstName = esc(v.first_name || clientName || "");
      const day = esc(v.billing_day_of_month || "1");
      const format = String(v.delivery_format || "electronic");
      const lang = String(v.language || "fr");
      const billingEmail = esc(v.email_for_billing || "—");
      return {
        subject: "Préférences de facturation mises à jour",
        html: shell({
          preheader: "Vos préférences de facturation ont été modifiées.",
          badge: "FACTURATION MISE À JOUR",
          heroTitle: "Vos préférences de facturation ont été modifiées",
          heroSub: "Les changements s'appliquent dès le prochain cycle.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la mise à jour de vos préférences de facturation. Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement.`,
          cardTitle: "Paramètres appliqués",
          cardRows: [
            ["Jour de facturation", day],
            ["Format", format === "paper" ? "Papier (poste)" : "Électronique (courriel)"],
            ["Langue", lang === "en" ? "English" : "Français"],
            ["Courriel de facturation", billingEmail],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Direct refund processed
    // ===================================================================
    case "client_direct_refund_processed": {
      const firstName = esc(v.first_name || clientName || "");
      const amount = esc(v.amount || "0,00 $");
      const method = esc(v.refund_method || "—");
      const ref = esc(v.external_reference || "—");
      const reason = esc(v.reason || "—");
      return {
        subject: `Remboursement traité — ${amount}`,
        html: shell({
          preheader: `Un remboursement de ${amount} a été traité sur votre compte.`,
          badge: "REMBOURSEMENT TRAITÉ",
          heroTitle: "Votre remboursement a été traité",
          heroSub: "Le montant sera crédité selon le mode choisi.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons le traitement du remboursement suivant. Selon la méthode utilisée, le délai d'apparition sur votre compte peut varier de quelques minutes à quelques jours ouvrables.`,
          cardTitle: "Détails du remboursement",
          cardRows: [
            ["Montant", amount],
            ["Méthode", method],
            ["Référence externe", ref],
            ["Raison", reason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }







    // ===================================================================
    // CLIENT — Equipment assigned (from canonical catalog only)
    // ===================================================================
    case "client_equipment_assigned": {
      const firstName = esc(v.first_name || clientName || "");
      const name = esc(v.equipment_name || "Équipement");
      const price = esc(v.equipment_price || "0,00 $");
      return {
        subject: `Équipement assigné — ${name}`,
        html: shell({
          preheader: `${name} a été ajouté à votre compte.`,
          badge: "ÉQUIPEMENT ASSIGNÉ",
          heroTitle: "Votre équipement a été assigné",
          heroSub: "Le tarif sera appliqué selon le catalogue Nivra.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons l'assignation de l'équipement <strong>${name}</strong> à votre compte. Le tarif applicable est défini par le catalogue Nivra.`,
          cardTitle: "Détails",
          cardRows: [
            ["Équipement", name],
            ["Tarif", price],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Equipment returned
    // ===================================================================
    case "client_equipment_returned": {
      const firstName = esc(v.first_name || clientName || "");
      const name = esc(v.equipment_name || "Équipement");
      const condition = esc(v.condition || "good");
      const reason = esc(v.reason || "—");
      return {
        subject: `Retour d'équipement enregistré — ${name}`,
        html: shell({
          preheader: `Le retour de votre ${name} a été enregistré.`,
          badge: "RETOUR ENREGISTRÉ",
          heroTitle: "Retour d'équipement confirmé",
          heroSub: "Merci d'avoir retourné votre équipement.",
          icon: "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la réception du retour de votre équipement. Si des frais s'appliquent en fonction de l'état constaté, ils apparaîtront sur votre prochaine facture.`,
          cardTitle: "Détails du retour",
          cardRows: [
            ["Équipement", name],
            ["État constaté", condition],
            ["Note", reason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — TV channels selection updated
    // ===================================================================
    case "client_tv_channels_updated": {
      const firstName = esc(v.first_name || clientName || "");
      const count = esc(v.channel_count || "0");
      const total = esc(v.total_price || "0,00 $");
      const names = esc(v.channel_names || "—");
      return {
        subject: `Votre sélection de chaînes TV a été mise à jour`,
        html: shell({
          preheader: `Nouvelle sélection : ${count} chaîne(s) — ${total} / mois.`,
          badge: "CHAÎNES TV MISES À JOUR",
          heroTitle: "Sélection de chaînes confirmée",
          heroSub: `${count} chaîne(s) actives sur votre service TV.`,
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons la mise à jour de votre sélection de chaînes TV. Le nouveau tarif mensuel sera reflété sur votre prochaine facture.`,
          cardTitle: "Détails de la sélection",
          cardRows: [
            ["Nombre de chaînes", count],
            ["Total mensuel chaînes", total],
            ["Aperçu", names],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mon compte",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Referral qualified (3 cycles paid, reward pending)
    // ===================================================================
    case "client_referral_qualified": {
      const firstName = esc(v.first_name || clientName || "");
      const referredName = esc(v.referred_name || "votre filleul");
      const rewardAmount = esc(v.reward_amount || "25,00 $");
      return {
        subject: `Votre parrainage est qualifié — récompense à venir`,
        html: shell({
          preheader: `Bravo ! Votre parrainage est officiellement qualifié.`,
          badge: "PARRAINAGE QUALIFIÉ",
          heroTitle: "Parrainage qualifié",
          heroSub: `${referredName} a complété les 3 cycles requis.`,
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Excellente nouvelle : votre parrainage est désormais qualifié. Votre récompense de <strong>${rewardAmount}</strong> sera émise sous peu par notre équipe.`,
          cardTitle: "Détails du parrainage",
          cardRows: [
            ["Filleul", referredName],
            ["Récompense", rewardAmount],
            ["Statut", "Qualifié — émission en cours"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mes parrainages",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Referral reward issued
    // ===================================================================
    case "client_referral_reward_issued": {
      const firstName = esc(v.first_name || clientName || "");
      const referredName = esc(v.referred_name || "votre filleul");
      const rewardAmount = esc(v.reward_amount || "25,00 $");
      const rewardType = esc(v.reward_type || "Carte cadeau Visa/Mastercard");
      const reference = esc(v.reward_reference || "—");
      return {
        subject: `Votre récompense de parrainage a été émise`,
        html: shell({
          preheader: `Votre récompense de ${rewardAmount} est en route.`,
          badge: "RÉCOMPENSE ÉMISE",
          heroTitle: "Récompense de parrainage émise",
          heroSub: `${rewardAmount} — ${rewardType}.`,
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Votre récompense de parrainage pour <strong>${referredName}</strong> a été émise. Vous recevrez les détails de livraison par courriel séparé.`,
          cardTitle: "Détails de la récompense",
          cardRows: [
            ["Filleul", referredName],
            ["Type", rewardType],
            ["Montant", rewardAmount],
            ["Référence", reference],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mes parrainages",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Referral disqualified
    // ===================================================================
    case "client_referral_disqualified": {
      const firstName = esc(v.first_name || clientName || "");
      const referredName = esc(v.referred_name || "votre filleul");
      const reason = esc(v.reason || "Conditions du programme non remplies.");
      return {
        subject: `Mise à jour de votre parrainage`,
        html: shell({
          preheader: `Information importante sur l'un de vos parrainages.`,
          badge: "PARRAINAGE — MISE À JOUR",
          heroTitle: "Statut de parrainage modifié",
          heroSub: `Le parrainage de ${referredName} n'est plus admissible.`,
          icon: "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous vous informons que votre parrainage concernant <strong>${referredName}</strong> ne peut pas être validé.`,
          cardTitle: "Détails",
          cardRows: [
            ["Filleul", referredName],
            ["Raison", reason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mes parrainages",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Support ticket opened by staff
    // ===================================================================
    case "client_ticket_opened": {
      const firstName = esc(v.first_name || clientName || "");
      const subject = esc(v.subject || "Votre demande");
      const message = esc(v.message || "");
      const ticketNumber = esc(v.ticket_number || "—");
      const priority = esc(v.priority || "normal");
      return {
        subject: `Ticket ouvert — ${subject}`,
        html: shell({
          preheader: `Votre demande #${ticketNumber} a été enregistrée.`,
          badge: "TICKET OUVERT",
          heroTitle: "Nous avons reçu votre demande",
          heroSub: `Référence #${ticketNumber}`,
          icon: "info",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Un ticket support a été ouvert à votre nom. Notre équipe vous répondra dans les meilleurs délais. Vous pouvez répondre à ce courriel pour ajouter des informations.`,
          cardTitle: "Détails du ticket",
          cardRows: [
            ["Numéro", `#${ticketNumber}`],
            ["Sujet", subject],
            ["Priorité", priority],
            ["Message", message || "—"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mes tickets",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Account reminder sent by staff
    // ===================================================================
    case "client_account_reminder": {
      const firstName = esc(v.first_name || clientName || "");
      const subject = esc(v.subject || "Rappel important");
      const message = esc(v.message || "");
      const reminderType = String(v.reminder_type || "general");
      const ticketNumber = esc(v.ticket_number || "—");
      const typeLabel =
        reminderType === "billing_overdue"  ? "Facture en retard" :
        reminderType === "appointment"      ? "Rendez-vous à venir" :
        reminderType === "kyc"              ? "Pièce d'identité requise" :
        reminderType === "equipment_return" ? "Retour d'équipement" :
                                              "Rappel général";
      return {
        subject: `Rappel — ${subject}`,
        html: shell({
          preheader: `${typeLabel} — action peut être requise.`,
          badge: "RAPPEL IMPORTANT",
          heroTitle: typeLabel,
          heroSub: subject,
          icon: "warning",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous vous transmettons ce rappel concernant votre compte Nivra. Merci de prendre les mesures appropriées dès que possible.`,
          cardTitle: "Détails du rappel",
          cardRows: [
            ["Type", typeLabel],
            ["Référence", `#${ticketNumber}`],
            ["Message", message || "—"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Accéder à mon compte",
          helpVariant: "warning",
          helpHtml: `Pour toute question, contactez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Appointment scheduled by staff
    // ===================================================================
    case "client_appointment_scheduled": {
      const firstName = esc(v.first_name || clientName || "");
      const title = esc(v.title || "Rendez-vous Nivra");
      const number = esc(v.appointment_number || "—");
      const when = esc(v.scheduled_at || "—");
      const serviceType = esc(v.service_type || "—");
      const address = esc(v.service_address || "—");
      return {
        subject: `Rendez-vous confirmé — ${when}`,
        html: shell({
          preheader: `Votre rendez-vous Nivra est confirmé pour le ${when}.`,
          badge: "RENDEZ-VOUS CONFIRMÉ",
          heroTitle: "Rendez-vous planifié",
          heroSub: when,
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons votre rendez-vous avec Nivra. Si vous devez le reporter ou l'annuler, contactez-nous au moins 24 heures à l'avance.`,
          cardTitle: "Détails du rendez-vous",
          cardRows: [
            ["Référence", `#${number}`],
            ["Objet", title],
            ["Date et heure", when],
            ["Type de service", serviceType],
            ["Adresse", address],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Voir mes rendez-vous",
          helpHtml: `Pour modifier ce rendez-vous, écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Collections: friendly overdue reminder
    // ===================================================================
    case "client_collections_reminder": {
      const firstName = esc(v.first_name || clientName || "");
      const subject = esc(v.subject || "Rappel de facture");
      const message = esc(v.message || "");
      const invoiceNumber = esc(v.invoice_number || "—");
      const amountDue = esc(v.amount_due || "—");
      const dueDate = esc(v.due_date || "—");
      return {
        subject: `Rappel — Facture #${invoiceNumber}`,
        html: shell({
          preheader: `Solde impayé de ${amountDue} — facture #${invoiceNumber}.`,
          badge: "RAPPEL DE FACTURE",
          heroTitle: "Solde impayé",
          heroSub: `Facture #${invoiceNumber}`,
          icon: "warning",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Notre système indique qu'un solde demeure impayé sur votre compte Nivra. Merci de régler cette facture dès que possible pour éviter des frais additionnels ou une interruption de service.`,
          cardTitle: "Détails de la facture",
          cardRows: [
            ["Numéro", `#${invoiceNumber}`],
            ["Solde dû", amountDue],
            ["Échéance initiale", dueDate],
            ["Message", message || "—"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail/factures`,
          ctaPrimaryLabel: "Payer ma facture",
          helpVariant: "warning",
          helpHtml: `Une question? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Collections: promise to pay confirmed
    // ===================================================================
    case "client_collections_promise": {
      const firstName = esc(v.first_name || clientName || "");
      const invoiceNumber = esc(v.invoice_number || "—");
      const amountPromised = esc(v.amount_promised || "—");
      const promiseDate = esc(v.promise_date || "—");
      const message = esc(v.message || "");
      return {
        subject: `Engagement de paiement — Facture #${invoiceNumber}`,
        html: shell({
          preheader: `Engagement de ${amountPromised} pour le ${promiseDate}.`,
          badge: "ENGAGEMENT ENREGISTRÉ",
          heroTitle: "Engagement de paiement confirmé",
          heroSub: `Pour le ${promiseDate}`,
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous confirmons votre engagement à régler le solde ci-dessous à la date convenue. Aucune autre action n'est requise pour le moment — merci de respecter cette échéance afin d'éviter toute escalade.`,
          cardTitle: "Détails de l'engagement",
          cardRows: [
            ["Facture", `#${invoiceNumber}`],
            ["Montant promis", amountPromised],
            ["Date prévue", promiseDate],
            ["Note", message || "—"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail/factures`,
          ctaPrimaryLabel: "Voir ma facture",
          helpHtml: `Pour toute question, écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Collections: payment plan accepted
    // ===================================================================
    case "client_collections_payment_plan": {
      const firstName = esc(v.first_name || clientName || "");
      const invoiceNumber = esc(v.invoice_number || "—");
      const installments = esc(v.installments || "—");
      const installmentAmount = esc(v.installment_amount || "—");
      const planTotal = esc(v.plan_total || "—");
      const message = esc(v.message || "");
      return {
        subject: `Plan de paiement — Facture #${invoiceNumber}`,
        html: shell({
          preheader: `${installments} versements de ${installmentAmount}.`,
          badge: "PLAN DE PAIEMENT",
          heroTitle: "Votre plan de paiement est en place",
          heroSub: `${installments} versements de ${installmentAmount}`,
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous avons mis en place un plan de paiement pour la facture ci-dessous. Veuillez respecter chaque échéance pour maintenir vos services en règle.`,
          cardTitle: "Détails du plan",
          cardRows: [
            ["Facture", `#${invoiceNumber}`],
            ["Versements", installments],
            ["Montant par versement", installmentAmount],
            ["Total du plan", planTotal],
            ["Note", message || "—"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail/factures`,
          ctaPrimaryLabel: "Voir ma facture",
          helpHtml: `Pour toute question, écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — Dispute status update (under_review / awaiting_client / resolved)
    // ===================================================================
    case "client_dispute_status_update": {
      const firstName = esc(v.first_name || clientName || "");
      const disputeNumber = esc(v.dispute_number || "—");
      const statusLabel = esc(v.status_label || "Mise à jour");
      const newStatus = String(v.new_status || "");
      const reasonLabel = esc(v.reason_label || "—");
      const publicMessage = esc(v.public_message || "");
      const isApproved = newStatus === "resolved_approved";
      const isRejected = newStatus === "resolved_rejected";
      const isAwaiting = newStatus === "awaiting_client";
      const badge =
        isApproved ? "LITIGE APPROUVÉ" :
        isRejected ? "LITIGE REFUSÉ" :
        isAwaiting ? "ACTION REQUISE" :
                     "LITIGE EN ANALYSE";
      const icon =
        isApproved ? "check" :
        isRejected ? "alert" :
        isAwaiting ? "warning" :
                     "info";
      const helpVariant: "warning" | undefined =
        (isRejected || isAwaiting) ? "warning" : undefined;
      return {
        subject: `Litige #${disputeNumber} — ${statusLabel}`,
        html: shell({
          preheader: `Mise à jour de votre litige #${disputeNumber}.`,
          badge,
          heroTitle: `Litige #${disputeNumber}`,
          heroSub: statusLabel,
          icon,
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: isAwaiting
            ? `Nous avons besoin d'informations complémentaires pour traiter votre litige. Merci de répondre depuis votre portail ou par courriel dans les meilleurs délais.`
            : `Le statut de votre litige de facturation a été mis à jour. Vous trouverez les détails ci-dessous.`,
          cardTitle: "Détails du litige",
          cardRows: [
            ["Référence", `#${disputeNumber}`],
            ["Statut", statusLabel],
            ["Motif", reasonLabel],
            ["Message", publicMessage || "—"],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail/factures`,
          ctaPrimaryLabel: "Voir mes litiges",
          helpVariant,
          helpHtml: `Pour toute question, écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — KYC verification requested by staff
    // ===================================================================
    case "client_kyc_requested": {
      const firstName = esc(v.first_name || clientName || "");
      const idTypeLabel = esc(v.id_type_label || "Pièce d'identité");
      const reason = esc(v.reason || "Vérification d'identité requise");
      const expiresAt = esc(v.expires_at || "—");
      return {
        subject: "Vérification d'identité requise — Nivra",
        html: shell({
          preheader: `Action requise — vérification d'identité avant le ${expiresAt}.`,
          badge: "VÉRIFICATION REQUISE",
          heroTitle: "Vérification d'identité requise",
          heroSub: `Avant le ${expiresAt}`,
          icon: "warning",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Pour finaliser ou maintenir vos services Nivra, nous devons vérifier votre identité. Merci de soumettre les documents demandés depuis votre portail dans les plus brefs délais.`,
          cardTitle: "Détails de la demande",
          cardRows: [
            ["Type de pièce", idTypeLabel],
            ["Motif", reason],
            ["Échéance", expiresAt],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail/identite`,
          ctaPrimaryLabel: "Soumettre mes documents",
          helpVariant: "warning",
          helpHtml: `Une question? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — KYC approved
    // ===================================================================
    case "client_kyc_approved": {
      const firstName = esc(v.first_name || clientName || "");
      const message = esc(v.message || "Votre identité a été vérifiée avec succès.");
      return {
        subject: "Identité vérifiée — Nivra",
        html: shell({
          preheader: "Votre identité a été vérifiée avec succès.",
          badge: "IDENTITÉ VÉRIFIÉE",
          heroTitle: "Vérification approuvée",
          heroSub: "Vos services sont en règle.",
          icon: "check",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Bonne nouvelle — votre vérification d'identité est complétée. Aucune autre action n'est requise de votre part.`,
          cardTitle: "Détails",
          cardRows: [
            ["Statut", "Approuvé"],
            ["Note", message],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail`,
          ctaPrimaryLabel: "Accéder à mon compte",
          helpHtml: `Pour toute question, écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — KYC rejected
    // ===================================================================
    case "client_kyc_rejected": {
      const firstName = esc(v.first_name || clientName || "");
      const rejectionReason = esc(v.rejection_reason || "Documents non conformes");
      return {
        subject: "Vérification d'identité — Action requise",
        html: shell({
          preheader: "Votre vérification d'identité a été refusée.",
          badge: "VÉRIFICATION REFUSÉE",
          heroTitle: "Documents non acceptés",
          heroSub: "Une nouvelle soumission est requise.",
          icon: "alert",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Nous n'avons pas pu valider votre identité avec les documents soumis. Merci d'en soumettre de nouveaux selon les indications ci-dessous.`,
          cardTitle: "Motif du refus",
          cardRows: [
            ["Détails", rejectionReason],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail/identite`,
          ctaPrimaryLabel: "Soumettre à nouveau",
          helpVariant: "warning",
          helpHtml: `Une question? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // CLIENT — KYC additional documents required
    // ===================================================================
    case "client_kyc_additional_docs": {
      const firstName = esc(v.first_name || clientName || "");
      const instructions = esc(v.instructions || "Documents complémentaires requis");
      const requiredDocsList = esc(v.required_docs_list || "—");
      return {
        subject: "Documents complémentaires requis — Nivra",
        html: shell({
          preheader: "Nous avons besoin de documents supplémentaires.",
          badge: "ACTION REQUISE",
          heroTitle: "Documents complémentaires requis",
          heroSub: "Pour finaliser la vérification",
          icon: "warning",
          greeting: `Bonjour ${firstName || "Client"},`,
          bodyText: `Pour compléter votre vérification d'identité, nous avons besoin des éléments suivants. Merci de les soumettre dès que possible depuis votre portail.`,
          cardTitle: "Instructions",
          cardRows: [
            ["Documents demandés", requiredDocsList],
            ["Précisions", instructions],
          ],
          ctaPrimaryUrl: `${APP_URL}/portail/identite`,
          ctaPrimaryLabel: "Soumettre les documents",
          helpVariant: "warning",
          helpHtml: `Une question? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#7c3aed;">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

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
      // Route the CTA to the agent's actual portal, not the generic /rh page.
      // Field agents land in /field/commissions, HR/employees in /rh/commissions.
      // Caller can override via v.portal_url if they have a more specific URL.
      const rhPortal = pickCommissionPortalUrl(v);
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
      const rhPortal = pickCommissionPortalUrl(v);
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
          icon: "alert",
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
          icon: "alert",
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

    case "plan_change_rejected": {
      const toPlan = esc(v.requested_plan_name || "—");
      const reason = esc(v.reason || (isEn ? "Not specified" : "Non précisée"));
      return {
        subject: isEn
          ? `Plan change request reviewed — Nivra Telecom`
          : `Votre demande de changement de forfait — Nivra Telecom`,
        html: shell({
          preheader: isEn
            ? `Your plan change request was not approved.`
            : `Votre demande de changement de forfait n'a pas été approuvée.`,
          badge: t("DEMANDE EXAMINÉE", "REQUEST REVIEWED", lang),
          heroTitle: t("Demande non approuvée", "Request not approved", lang),
          icon: "alert",
          greeting,
          bodyText: isEn
            ? `After review, your request to switch to ${toPlan} could not be approved at this time. Our support team can help you find an alternative.`
            : `Après examen, votre demande de passage à ${toPlan} n'a pas pu être approuvée pour le moment. Notre équipe de support peut vous aider à trouver une alternative.`,
          cardTitle: t("Détails", "Details", lang),
          cardRows: [
            [t("Forfait demandé", "Requested plan", lang), toPlan],
            [t("Motif", "Reason", lang), reason],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: t("Contacter le support", "Contact support", lang),
          helpHtml: isEn
            ? `Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Besoin d'aide ? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
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

    case "service_pause_rejected": {
      const reason = esc(v.reason || (isEn ? "Not specified" : "Non précisée"));
      return {
        subject: isEn
          ? `Service pause request reviewed — Nivra Telecom`
          : `Votre demande de suspension — Nivra Telecom`,
        html: shell({
          preheader: isEn
            ? `Your pause request was not approved.`
            : `Votre demande de suspension n'a pas été approuvée.`,
          badge: t("DEMANDE EXAMINÉE", "REQUEST REVIEWED", lang),
          heroTitle: t("Demande non approuvée", "Request not approved", lang),
          icon: "alert",
          greeting,
          bodyText: isEn
            ? `After review, your service pause request could not be approved. Our support team can help you find an alternative.`
            : `Après examen, votre demande de suspension de service n'a pas pu être approuvée. Notre équipe de support peut vous aider à trouver une alternative.`,
          cardTitle: t("Détails", "Details", lang),
          cardRows: [
            [t("Motif", "Reason", lang), reason],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: t("Contacter le support", "Contact support", lang),
          helpHtml: isEn
            ? `Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Besoin d'aide ? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "service_pause_resumed": {
      const resumedAt = esc(v.resumed_at || (isEn ? "today" : "aujourd'hui"));
      return {
        subject: isEn
          ? `Your service has been resumed — Nivra Telecom`
          : `Votre service a été repris — Nivra Telecom`,
        html: shell({
          preheader: isEn
            ? `Your service is active again.`
            : `Votre service est de nouveau actif.`,
          badge: t("SERVICE REPRIS", "SERVICE RESUMED", lang),
          heroTitle: t("Service réactivé ✓", "Service resumed ✓", lang),
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Good news — your service has been resumed on ${resumedAt}. You can now use your services normally and billing resumes at the next cycle.`
            : `Bonne nouvelle — votre service a été repris le ${resumedAt}. Vous pouvez maintenant utiliser vos services normalement et la facturation reprend au prochain cycle.`,
          cardTitle: t("Résumé", "Summary", lang),
          cardRows: [
            [t("Date de reprise", "Resume date", lang), resumedAt],
          ],
          ctaPrimaryUrl: `${portalUrl}/services`,
          ctaPrimaryLabel: t("Voir mes services", "View my services", lang),
          helpHtml: isEn
            ? `Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Une question ? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
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
    // REFERRAL — qualified notification (after 2 paid cycles)
    // ===================================================================
    case "referral_qualified_notification": {
      const methodRaw = String(v.payment_method || "paypal");
      const methodLabel = methodRaw === "interac"
        ? (isEn ? "Interac e-Transfer" : "Interac e-Transfer")
        : methodRaw === "gift_card"
        ? (isEn ? "Visa/Mastercard gift card" : "Carte-cadeau Visa/Mastercard")
        : "PayPal";
      return {
        subject: isEn
          ? `Your referral is qualified — 25$/mo for 10 months`
          : `Votre parrainage est qualifié — 25 $/mois pendant 10 mois`,
        html: shell({
          preheader: isEn
            ? `Your referral has completed 2 paid cycles. Reward starts now.`
            : `Votre filleul a complété 2 cycles payés. La récompense démarre maintenant.`,
          badge: t("PARRAINAGE QUALIFIÉ", "REFERRAL QUALIFIED", lang),
          heroTitle: t("Félicitations 🎉", "Congratulations 🎉", lang),
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Your referral has reached the 2-paid-cycles milestone. You'll now receive 25$/month for 10 months (250$ total) via ${methodLabel}.`
            : `Votre filleul a atteint le seuil de 2 cycles payés. Vous recevrez maintenant 25 $/mois pendant 10 mois (250 $ au total) via ${methodLabel}.`,
          cardTitle: t("Détails de la récompense", "Reward details", lang),
          cardRows: [
            [t("Récompense mensuelle", "Monthly reward", lang), money(25)],
            [t("Durée", "Duration", lang), t("10 mois", "10 months", lang)],
            [t("Total", "Total", lang), money(250)],
            [t("Mode de versement", "Payout method", lang), methodLabel],
          ],
          ctaPrimaryUrl: `${portalUrl}/referrals`,
          ctaPrimaryLabel: t("Voir mes parrainages", "View my referrals", lang),
        }),
      };
    }

    // ===================================================================
    // REFERRAL — reward issued
    // ===================================================================
    case "referral_reward_issued": {
      const amt = money(v.reward_amount ?? 25);
      const methodRaw = String(v.payment_method || "paypal");
      const methodLabel = methodRaw === "interac"
        ? "Interac e-Transfer"
        : methodRaw === "gift_card"
        ? (isEn ? "Visa/Mastercard gift card" : "Carte-cadeau Visa/Mastercard")
        : "PayPal";
      return {
        subject: isEn ? `Your referral reward has been issued` : `Votre récompense de parrainage est émise`,
        html: shell({
          preheader: isEn ? `You earned ${amt} for your referral.` : `Vous avez gagné ${amt} pour votre parrainage.`,
          badge: t("RÉCOMPENSE ÉMISE", "REWARD ISSUED", lang),
          heroTitle: t("Merci pour votre parrainage ✓", "Thanks for your referral ✓", lang),
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Great news — your referral has qualified. A reward of ${amt} has been issued via ${methodLabel}.`
            : `Excellente nouvelle — votre filleul est qualifié. Une récompense de ${amt} a été émise via ${methodLabel}.`,
          cardTitle: t("Détails", "Details", lang),
          cardRows: [
            [t("Récompense", "Reward", lang), amt],
            [t("Type", "Type", lang), t("Crédit parrainage", "Referral credit", lang)],
            [t("Mode de versement", "Payout method", lang), methodLabel],
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

    // ===================================================================
    // TICKET REPLY (support reply to client) — bilingual
    // ===================================================================
    case "ticket_reply": {
      const ticketNumber = esc(v.ticket_number || v.ticket_id || "—");
      const replyContent = esc(v.reply_content || "");
      const subjectLine = esc(v.subject || (isEn ? "Support update" : "Mise à jour support"));
      const replyDate = fmtDate(v.reply_date) || fmtDate(new Date().toISOString());
      const ctaUrl = String(v.portal_url || portalUrl) + "/portal/support";
      return {
        subject: isEn
          ? `Reply on your ticket ${ticketNumber}`
          : `Réponse à votre billet ${ticketNumber}`,
        html: shell({
          preheader: isEn
            ? `A support agent replied to ticket ${ticketNumber}.`
            : `Un agent support a répondu au billet ${ticketNumber}.`,
          badge: isEn ? "SUPPORT REPLY" : "RÉPONSE SUPPORT",
          heroTitle: isEn ? "New reply on your ticket" : "Nouvelle réponse sur votre billet",
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Our support team replied to your ticket. The full conversation is available in your portal.`
            : `Notre équipe support a répondu à votre billet. La conversation complète est disponible dans votre portail.`,
          cardTitle: isEn ? "Reply details" : "Détails de la réponse",
          cardRows: [
            [isEn ? "Ticket" : "Billet", ticketNumber],
            [isEn ? "Subject" : "Sujet", subjectLine],
            [isEn ? "Date" : "Date", replyDate],
            [isEn ? "Message" : "Message", replyContent || (isEn ? "(empty)" : "(vide)")],
          ],
          ctaPrimaryUrl: ctaUrl,
          ctaPrimaryLabel: isEn ? "View ticket" : "Voir le billet",
        }),
      };
    }

    // ===================================================================
    // ALL DOCUMENTS SENT (order documents bundle) — bilingual
    // ===================================================================
    case "all_documents_sent": {
      const orderNumber = esc(v.order_number || v.order_id || "—");
      const documentTypes = esc(v.document_types || (isEn ? "Order documents" : "Documents de commande"));
      const ctaUrl = String(v.portal_url || portalUrl) + "/portal/documents";
      return {
        subject: isEn
          ? `Your documents for order ${orderNumber}`
          : `Vos documents pour la commande ${orderNumber}`,
        html: shell({
          preheader: isEn
            ? `All documents for order ${orderNumber} have been sent.`
            : `Tous les documents pour la commande ${orderNumber} ont été envoyés.`,
          badge: isEn ? "DOCUMENTS SENT" : "DOCUMENTS ENVOYÉS",
          heroTitle: isEn ? "Your order documents are ready" : "Vos documents de commande sont prêts",
          icon: "check",
          greeting,
          bodyText: isEn
            ? `All documents related to your order are now available. You will find each one as an attachment or in your portal.`
            : `Tous les documents liés à votre commande sont maintenant disponibles. Vous les trouverez en pièces jointes ou dans votre portail.`,
          cardTitle: isEn ? "Order details" : "Détails de la commande",
          cardRows: [
            [isEn ? "Order" : "Commande", `#${String(orderNumber).replace(/^#/, "")}`],
            [isEn ? "Documents included" : "Documents inclus", documentTypes],
          ],
          ctaPrimaryUrl: ctaUrl,
          ctaPrimaryLabel: isEn ? "View my documents" : "Voir mes documents",
        }),
      };
    }

    // ===================================================================
    // TECHNICIAN ASSIGNED — bilingual
    // ===================================================================
    case "technician_assigned": {
      const techName = esc(v.technician_name || (isEn ? "Your technician" : "Votre technicien"));
      const apptDate = fmtDate(v.appointment_date) || (isEn ? "To be confirmed" : "À confirmer");
      const apptWindow = esc(v.appointment_window || "");
      const ctaUrl = String(v.portal_url || portalUrl) + "/portal/appointments";
      return {
        subject: isEn
          ? `Technician assigned for order ${orderNum}`
          : `Technicien assigné pour la commande ${orderNum}`,
        html: shell({
          preheader: isEn
            ? `${techName} has been assigned to your installation.`
            : `${techName} a été assigné à votre installation.`,
          badge: isEn ? "TECHNICIAN ASSIGNED" : "TECHNICIEN ASSIGNÉ",
          heroTitle: isEn ? "Your technician is on the way" : "Votre technicien arrive bientôt",
          icon: "check",
          greeting,
          bodyText: isEn
            ? `A technician has been assigned to your service installation. You will receive an SMS the day of the appointment with arrival details.`
            : `Un technicien a été assigné à l'installation de votre service. Vous recevrez un SMS le jour du rendez-vous avec les détails d'arrivée.`,
          cardTitle: isEn ? "Appointment details" : "Détails du rendez-vous",
          cardRows: [
            [isEn ? "Order" : "Commande", orderNum],
            [isEn ? "Technician" : "Technicien", techName],
            [isEn ? "Date" : "Date", apptDate],
            ...(apptWindow ? [[isEn ? "Window" : "Plage horaire", apptWindow] as [string, string]] : []),
          ],
          ctaPrimaryUrl: ctaUrl,
          ctaPrimaryLabel: isEn ? "View appointment" : "Voir le rendez-vous",
        }),
      };
    }

    // ===================================================================
    // ONBOARDING DAY 1 — Welcome + setup guide
    // ===================================================================
    case "onboarding_day1": {
      return {
        subject: isEn
          ? "Welcome to Nivra! Here's how to get started 🎉"
          : "Bienvenue chez Nivra! Voici comment démarrer 🎉",
        html: shell({
          preheader: isEn ? "Your getting started guide" : "Votre guide de démarrage",
          badge: isEn ? "WELCOME" : "BIENVENUE",
          heroTitle: isEn ? "Welcome to Nivra 🎉" : "Bienvenue chez Nivra 🎉",
          icon: "check",
          greeting,
          bodyText: isEn
            ? `Your Nivra service is active. Three things to do right now: <strong>1)</strong> sign in to your portal, <strong>2)</strong> verify your equipment, <strong>3)</strong> bookmark our support page.`
            : `Votre service Nivra est actif. Trois choses à faire dès maintenant : <strong>1)</strong> connectez-vous à votre portail, <strong>2)</strong> vérifiez votre équipement, <strong>3)</strong> mettez en favori notre page de support.`,
          cardTitle: isEn ? "Your account" : "Votre compte",
          cardRows: [
            [isEn ? "Account number" : "Numéro de compte", accountNum],
            [isEn ? "Portal" : "Portail", portalUrl],
            [isEn ? "Support" : "Support", SUPPORT_EMAIL],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: isEn ? "Access my portal" : "Accéder à mon portail",
        }),
      };
    }

    // ===================================================================
    // ONBOARDING DAY 3 — Tips + FAQ
    // ===================================================================
    case "onboarding_day3": {
      return {
        subject: isEn
          ? "Tips to get the most out of Nivra 💡"
          : "Conseils pour profiter au maximum de Nivra 💡",
        html: shell({
          preheader: isEn ? "Pro tips for your service" : "Astuces pour votre service",
          badge: isEn ? "TIPS" : "CONSEILS",
          heroTitle: isEn ? "Get more from Nivra 💡" : "Tirez le maximum de Nivra 💡",
          icon: "star",
          greeting,
          bodyText: isEn
            ? `Run a speed test to confirm your line is delivering full speed. Manage your plan, billing and address from your online portal at any time.`
            : `Lancez un test de vitesse pour confirmer que votre ligne livre la pleine vitesse. Gérez votre forfait, votre facturation et votre adresse depuis votre portail en ligne à tout moment.`,
          cardTitle: "FAQ",
          cardRows: [
            [isEn ? "Speed test" : "Test de vitesse", "https://nivra-telecom.ca/test-vitesse"],
            ["FAQ", "https://nivra-telecom.ca/faq"],
            [isEn ? "Support" : "Support", SUPPORT_EMAIL],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/faq",
          ctaPrimaryLabel: isEn ? "Open the FAQ" : "Ouvrir la FAQ",
        }),
      };
    }

    // ===================================================================
    // ONBOARDING DAY 7 — Satisfaction check (NPS)
    // ===================================================================
    case "onboarding_day7": {
      const npsUrl = String(v.nps_url || (v.nps_token ? `https://nivra-telecom.ca/nps/${v.nps_token}` : "https://nivra-telecom.ca/contact"));
      return {
        subject: isEn
          ? "How's your experience going? 🙏"
          : "Comment se passe votre expérience? 🙏",
        html: shell({
          preheader: isEn ? "30 seconds of your time" : "30 secondes de votre temps",
          badge: isEn ? "YOUR OPINION MATTERS" : "VOTRE AVIS COMPTE",
          heroTitle: isEn ? "How are we doing? 🙏" : "Comment ça se passe? 🙏",
          icon: "star",
          greeting,
          bodyText: isEn
            ? `It has been a week with Nivra. Tell us in one click how it's going — your feedback drives every improvement we make.`
            : `Cela fait une semaine avec Nivra. Dites-nous en un clic comment cela se passe — votre avis nous aide à nous améliorer.`,
          cardTitle: isEn ? "Your account" : "Votre compte",
          cardRows: [
            [isEn ? "Account number" : "Numéro de compte", accountNum],
          ],
          ctaPrimaryUrl: npsUrl,
          ctaPrimaryLabel: isEn ? "Share my feedback" : "Donner mon avis",
        }),
      };
    }

    // ===================================================================
    // ONBOARDING DAY 30 — 1 month anniversary + referral
    // ===================================================================
    case "onboarding_day30": {
      const referralLink = String(v.referral_link || "https://nivra-telecom.ca/commander");
      return {
        subject: isEn ? "1 month with Nivra — Thank you! 🎁" : "1 mois avec Nivra — Merci! 🎁",
        html: shell({
          preheader: isEn ? "A small thank-you offer" : "Un petit cadeau pour vous remercier",
          badge: isEn ? "THANK YOU" : "MERCI",
          heroTitle: isEn ? "1 month together 🎁" : "1 mois ensemble 🎁",
          icon: "star",
          greeting,
          bodyText: isEn
            ? `Thank you for trusting Nivra for the past month. Share Nivra with friends and family — when they sign up, you both win.`
            : `Merci de faire confiance à Nivra depuis un mois. Partagez Nivra avec vos proches — quand ils s'abonnent, vous gagnez tous les deux.`,
          cardTitle: isEn ? "Your account" : "Votre compte",
          cardRows: [
            [isEn ? "Account number" : "Numéro de compte", accountNum],
            [isEn ? "Refer & earn" : "Programme de parrainage", referralLink],
          ],
          ctaPrimaryUrl: referralLink,
          ctaPrimaryLabel: isEn ? "Refer a friend" : "Parrainer un ami",
        }),
      };
    }

    // ===================================================================
    // NPS SURVEY
    // ===================================================================
    case "nps_survey": {
      const npsUrl = String(v.nps_url || (v.nps_token ? `https://nivra-telecom.ca/nps/${v.nps_token}` : "https://nivra-telecom.ca/contact"));
      return {
        subject: isEn
          ? "30 seconds to help us improve 🙏"
          : "30 secondes pour nous aider à nous améliorer 🙏",
        html: shell({
          preheader: isEn ? "We'd love your feedback" : "Votre avis nous intéresse",
          badge: isEn ? "YOUR OPINION MATTERS" : "VOTRE AVIS COMPTE",
          heroTitle: isEn ? "Rate your Nivra experience" : "Évaluez votre expérience Nivra",
          icon: "star",
          greeting,
          bodyText: isEn
            ? `On a scale from 0 to 10, how likely are you to recommend Nivra to a friend? Just one click — that's all we need.`
            : `Sur une échelle de 0 à 10, à quel point recommanderiez-vous Nivra à un ami? Un seul clic — c'est tout ce qu'il nous faut.`,
          ctaPrimaryUrl: npsUrl,
          ctaPrimaryLabel: isEn ? "Share my feedback" : "Donner mon avis",
        }),
      };
    }

    // ===================================================================
    // RECRUITMENT — AI INTERVIEW SYSTEM
    // ===================================================================
    case "interview_invitation": {
      const firstName = esc(v.first_name || clientName);
      const interviewUrl = String(v.interview_url || `${APP_URL}/entrevue`);
      const isEnglish = lang === "en";
      const cardRows: [string, string][] = isEnglish
        ? [
            ["Position", "Field Agent — Door-to-Door Sales"],
            ["Compensation", "Commission only"],
            ["Duration", "Approximately 15 minutes"],
            ["Language", "English"],
          ]
        : [
            ["Poste", "Agent Terrain — Vente Porte-à-Porte"],
            ["Rémunération", "Commission uniquement"],
            ["Durée", "Environ 15 minutes"],
            ["Langue", "Français"],
          ];
      return {
        subject: isEnglish
          ? "Invitation — Virtual Interview Field Agent Nivra Telecom"
          : "Invitation — Entrevue virtuelle Agent Terrain Nivra Telecom",
        html: shell({
          preheader: isEnglish
            ? "Your virtual interview is ready to start."
            : "Votre entrevue virtuelle est prête à débuter.",
          badge: isEnglish ? "INTERVIEW INVITATION" : "INVITATION ENTREVUE",
          heroTitle: isEnglish
            ? "Your virtual interview is waiting!"
            : "Votre entrevue virtuelle vous attend!",
          icon: "star",
          greeting: isEnglish ? `Hello ${firstName},` : `Bonjour ${firstName},`,
          bodyText: isEnglish
            ? "Thank you for your interest in the Field Agent position at Nivra Telecom. We have received your application and would like to invite you to complete a virtual interview with our intelligent HR assistant. The interview takes about 15 minutes. Answer at your own pace."
            : "Merci pour votre intérêt pour le poste d'Agent Terrain chez Nivra Telecom. Nous avons bien reçu votre candidature et nous souhaitons vous inviter à passer une entrevue virtuelle avec notre assistant RH intelligent. L'entrevue dure environ 15 minutes. Répondez à votre rythme.",
          cardTitle: isEnglish ? "Interview details" : "Détails de l'entrevue",
          cardRows,
          ctaPrimaryUrl: interviewUrl,
          ctaPrimaryLabel: isEnglish ? "Start my interview" : "Commencer mon entrevue",
          helpHtml: isEnglish
            ? "This link is personal and unique to your application. Do not share it."
            : "Ce lien est personnel et unique à votre candidature. Ne le partagez pas.",
        }),
      };
    }

    case "interview_completed_admin": {
      const firstName = esc(v.first_name || "Candidat");
      const lastName = esc(v.last_name || "");
      const score = esc(v.score ?? "?");
      const recommendation = esc(v.recommendation || "neutral");
      const summary = esc(v.summary || "Aucun résumé disponible.");
      const candidateEmail = esc(v.candidate_email || "");
      const candidateCity = esc(v.candidate_city || "");
      const strengths = Array.isArray(v.strengths) ? (v.strengths as string[]) : [];
      const concerns = Array.isArray(v.concerns) ? (v.concerns as string[]) : [];
      const redFlags = Array.isArray(v.red_flags) ? (v.red_flags as string[]) : [];
      const qa = Array.isArray(v.qa) ? (v.qa as Array<{ q: string; a: string; score?: number; feedback?: string }>) : [];

      const renderList = (items: string[], color: string) =>
        items.length === 0
          ? `<em style="color:${BRAND_TEXT_MUTED};">Aucun</em>`
          : `<ul style="margin:6px 0 0 0;padding-left:18px;color:${color};">${items
              .map((s) => `<li style="margin:4px 0;">${esc(s)}</li>`)
              .join("")}</ul>`;

      const qaHtml = qa
        .map(
          (item, i) => `
          <div style="margin:14px 0;padding:12px;border:1px solid ${BRAND_CARD_BORDER};border-radius:8px;background:#fff;">
            <div style="font-weight:600;color:${BRAND_DARK};font-size:13px;">Q${i + 1}. ${esc(item.q)}</div>
            <div style="margin-top:6px;color:${BRAND_TEXT_BODY};font-size:13px;white-space:pre-wrap;">${esc(item.a)}</div>
            ${item.score !== undefined ? `<div style="margin-top:6px;font-size:12px;color:${BRAND_PRIMARY};font-weight:600;">Score IA: ${esc(item.score)}/10</div>` : ""}
            ${item.feedback ? `<div style="margin-top:4px;font-size:12px;color:${BRAND_TEXT_MUTED};font-style:italic;">${esc(item.feedback)}</div>` : ""}
          </div>`,
        )
        .join("");

      const extraHtml = `
        <div style="margin:18px 0;padding:16px;background:${BRAND_HERO_BG};border-radius:8px;border:1px solid ${BRAND_CARD_BORDER};">
          <div style="font-weight:700;color:${BRAND_DARK};margin-bottom:8px;">Résumé IA</div>
          <div style="color:${BRAND_TEXT_BODY};font-size:14px;line-height:1.6;">${summary}</div>
        </div>
        <div style="margin:14px 0;">
          <div style="font-weight:700;color:#059669;margin-bottom:4px;">Points forts</div>
          ${renderList(strengths, "#065f46")}
        </div>
        <div style="margin:14px 0;">
          <div style="font-weight:700;color:#d97706;margin-bottom:4px;">Préoccupations</div>
          ${renderList(concerns, "#92400e")}
        </div>
        <div style="margin:14px 0;">
          <div style="font-weight:700;color:#dc2626;margin-bottom:4px;">Drapeaux rouges</div>
          ${renderList(redFlags, "#991b1b")}
        </div>
        <div style="margin:20px 0 8px 0;font-weight:700;color:${BRAND_DARK};font-size:16px;">Questions et réponses</div>
        ${qaHtml}
      `;

      return {
        subject: `[Entrevue complétée] ${firstName} ${lastName} — Score: ${score}/10`,
        html: shell({
          preheader: `Rapport entrevue ${firstName} ${lastName}`,
          badge: "RAPPORT ENTREVUE",
          heroTitle: "Entrevue complétée — Action requise",
          heroSub: `Score global: ${score}/10`,
          icon: "check",
          greeting: "Bonjour équipe RH,",
          bodyText: `Le candidat <strong>${firstName} ${lastName}</strong> a complété son entrevue virtuelle. Voici le rapport complet généré par l'assistant IA.`,
          cardTitle: "Informations candidat",
          cardRows: [
            ["Nom", `${firstName} ${lastName}`],
            ["Courriel", candidateEmail],
            ["Ville", candidateCity || "Non spécifiée"],
            ["Score global", `${score}/10`],
            ["Recommandation", recommendation],
          ],
          afterCardText: extraHtml,
          ctaPrimaryUrl: `${APP_URL}/hr/recruitment`,
          ctaPrimaryLabel: "Voir le dossier complet",
          helpHtml: `Action requise: examiner ce candidat et décider de l'accepter ou non.`,
        }),
      };
    }

    case "applicant_accepted": {
      const firstName = esc(v.first_name || clientName);
      const isEnglish = lang === "en";
      return {
        subject: isEnglish
          ? "Congratulations! You are accepted at Nivra Telecom"
          : "Félicitations! Vous êtes accepté chez Nivra Telecom",
        html: shell({
          preheader: isEnglish
            ? "Welcome to the Nivra team."
            : "Bienvenue dans l'équipe Nivra.",
          badge: isEnglish ? "APPLICATION ACCEPTED" : "CANDIDATURE ACCEPTÉE",
          heroTitle: isEnglish
            ? "Welcome to the Nivra team!"
            : "Bienvenue dans l'équipe Nivra!",
          icon: "check",
          greeting: isEnglish ? `Hello ${firstName},` : `Bonjour ${firstName},`,
          bodyText: isEnglish
            ? "Congratulations! After reviewing your interview, we are excited to offer you a position as Field Agent at Nivra Telecom. The next step is to sign your commission agreement and complete onboarding. Our HR team will contact you shortly with your starter kit, territory and training schedule."
            : "Félicitations! Après examen de votre entrevue, nous sommes ravis de vous offrir un poste d'Agent Terrain chez Nivra Telecom. La prochaine étape est de signer votre entente de commission et compléter l'intégration. Notre équipe RH vous contactera sous peu avec votre trousse de départ, votre territoire et l'horaire de formation.",
          cardTitle: isEnglish ? "Next steps" : "Prochaines étapes",
          cardRows: isEnglish
            ? [
                ["1.", "Sign your commission agreement"],
                ["2.", "Complete onboarding training"],
                ["3.", "Receive your territory assignment"],
                ["4.", "Start earning commissions on every sale"],
              ]
            : [
                ["1.", "Signer votre entente de commission"],
                ["2.", "Compléter la formation d'intégration"],
                ["3.", "Recevoir votre assignation de territoire"],
                ["4.", "Commencer à gagner des commissions sur chaque vente"],
              ],
          ctaPrimaryUrl: `${APP_URL}/hub`,
          ctaPrimaryLabel: isEnglish ? "Sign my contract" : "Signer mon contrat",
          helpHtml: isEnglish
            ? `Questions? Write to <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Des questions? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "applicant_rejected": {
      const firstName = esc(v.first_name || clientName);
      const isEnglish = lang === "en";
      return {
        subject: isEnglish
          ? "Thank you for applying at Nivra Telecom"
          : "Merci pour votre candidature chez Nivra Telecom",
        html: shell({
          preheader: isEnglish
            ? "Thank you for your interest in Nivra."
            : "Merci pour votre intérêt envers Nivra.",
          badge: isEnglish ? "APPLICATION REVIEWED" : "CANDIDATURE EXAMINÉE",
          heroTitle: isEnglish ? "Thank you for applying" : "Merci pour votre candidature",
          icon: "star",
          greeting: isEnglish ? `Hello ${firstName},` : `Bonjour ${firstName},`,
          bodyText: isEnglish
            ? "Thank you for taking the time to apply for the Field Agent position at Nivra Telecom and for completing the virtual interview. After careful review, we have decided not to move forward with your application at this time. This decision was not easy and does not reflect on your value as a professional. We encourage you to reapply in approximately three months as our hiring needs evolve. We sincerely appreciate the time and energy you invested in this process and wish you great success in your career."
            : "Merci d'avoir pris le temps de postuler pour le poste d'Agent Terrain chez Nivra Telecom et d'avoir complété l'entrevue virtuelle. Après une analyse attentive, nous avons décidé de ne pas aller de l'avant avec votre candidature pour le moment. Cette décision n'a pas été facile et ne reflète en rien votre valeur professionnelle. Nous vous encourageons à postuler à nouveau dans environ trois mois, nos besoins de recrutement évoluant régulièrement. Nous apprécions sincèrement le temps et l'énergie investis dans ce processus et vous souhaitons un grand succès dans votre carrière.",
          ctaPrimaryUrl: `${APP_URL}/emplois`,
          ctaPrimaryLabel: isEnglish ? "View future openings" : "Voir les futurs postes",
          helpHtml: isEnglish
            ? `Questions? Write to <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Des questions? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "onboarding_form_invitation": {
      const firstName = esc(v.first_name || clientName);
      const onboardingUrl = String(v.onboarding_url || `${APP_URL}/onboarding`);
      const isEnglish = lang === "en";
      return {
        subject: isEnglish
          ? "Action required — Nivra Telecom Onboarding Form"
          : "Action requise — Formulaire d'embauche Nivra Telecom",
        html: shell({
          preheader: isEnglish
            ? "Complete your onboarding file to finalize your hiring."
            : "Complétez votre dossier d'embauche pour finaliser votre embauche.",
          badge: isEnglish ? "ONBOARDING FORM" : "FORMULAIRE D EMBAUCHE",
          heroTitle: isEnglish
            ? "Congratulations! Complete your file"
            : "Félicitations! Complétez votre dossier",
          icon: "check",
          greeting: isEnglish ? `Hello ${firstName},` : `Bonjour ${firstName},`,
          bodyText: isEnglish
            ? "Your application at Nivra Telecom has been accepted. To finalize your hiring, please complete your onboarding form online. This form is secured and encrypted. Only the Nivra Telecom HR team will have access to your information. The link expires in 7 days."
            : "Votre candidature chez Nivra Telecom a été acceptée. Pour finaliser votre embauche, veuillez compléter votre formulaire d'embauche en ligne. Ce formulaire est sécurisé et chiffré. Seule l'équipe RH de Nivra Telecom aura accès à vos informations. Le lien expire dans 7 jours.",
          cardTitle: isEnglish ? "What you need to know" : "Ce que vous devez savoir",
          cardRows: isEnglish
            ? [
                ["Deadline", "7 days to complete"],
                ["Security", "Encrypted and confidential"],
                ["Required documents", "Government ID + Void cheque"],
              ]
            : [
                ["Délai", "7 jours pour compléter"],
                ["Sécurité", "Chiffré et confidentiel"],
                ["Documents requis", "Pièce d'identité + Spécimen de chèque"],
              ],
          ctaPrimaryUrl: onboardingUrl,
          ctaPrimaryLabel: isEnglish ? "Complete my form" : "Compléter mon formulaire",
          helpHtml: isEnglish
            ? `Questions? Write to <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Des questions? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "onboarding_form_submitted_admin": {
      const fullName = esc(v.full_legal_name || `${v.first_name || ""} ${v.last_name || ""}`.trim() || "Candidat");
      const submitEmail = esc(v.email || "");
      const phone = esc(v.phone || "—");
      const address = esc([v.address_street, v.address_city, v.address_province, v.address_postal].filter(Boolean).join(", ") || "—");
      const residential = esc(v.residential_status || "—");
      const reviewUrl = `${APP_URL}/core/hr/interviews`;
      return {
        subject: `[Formulaire soumis] ${fullName} — Dossier d'embauche complet`,
        html: shell({
          preheader: `Nouveau formulaire d'embauche soumis: ${fullName}`,
          badge: "FORMULAIRE SOUMIS",
          heroTitle: "Nouveau dossier d'embauche à réviser",
          icon: "check",
          greeting: "Bonjour équipe RH,",
          bodyText: `Un candidat vient de soumettre son formulaire d'embauche complet. Toutes les informations et documents sont disponibles dans le portail Nivra Core pour révision.`,
          cardTitle: "Informations soumises",
          cardRows: [
            ["Nom légal", fullName],
            ["Courriel", submitEmail],
            ["Téléphone", phone],
            ["Adresse", address],
            ["Statut résidentiel", residential],
          ],
          ctaPrimaryUrl: reviewUrl,
          ctaPrimaryLabel: "Réviser le dossier",
          helpHtml: `Les documents (ID, permis de travail, spécimen de chèque) sont accessibles via le portail Nivra Core uniquement.`,
        }),
      };
    }

    case "onboarding_form_confirmation_employee": {
      const firstName = esc(v.first_name || clientName);
      const isEnglish = lang === "en";
      return {
        subject: isEnglish
          ? "Your file has been received — Nivra Telecom"
          : "Votre dossier est bien reçu — Nivra Telecom",
        html: shell({
          preheader: isEnglish
            ? "We have received your onboarding file."
            : "Nous avons reçu votre dossier d'embauche.",
          badge: isEnglish ? "FILE RECEIVED" : "DOSSIER REÇU",
          heroTitle: isEnglish ? "Thank you! File received" : "Merci! Dossier reçu",
          icon: "check",
          greeting: isEnglish ? `Hello ${firstName},` : `Bonjour ${firstName},`,
          bodyText: isEnglish
            ? "We have received your complete onboarding file. Our HR team will review your information and contact you within 24 to 48 hours with your next steps: training, territory assignment, and starter kit."
            : "Nous avons bien reçu votre dossier d'embauche complet. Notre équipe RH va réviser vos informations et vous contactera sous 24 à 48 heures avec les prochaines étapes: formation, assignation de territoire et trousse de départ.",
          cardTitle: isEnglish ? "Next steps" : "Prochaines étapes",
          cardRows: isEnglish
            ? [
                ["1.", "HR review of your file"],
                ["2.", "Confirmation call within 24-48h"],
                ["3.", "Onboarding training scheduling"],
                ["4.", "Territory assignment"],
              ]
            : [
                ["1.", "Révision de votre dossier par RH"],
                ["2.", "Appel de confirmation sous 24-48h"],
                ["3.", "Planification de la formation d'intégration"],
                ["4.", "Assignation de votre territoire"],
              ],
          helpHtml: isEnglish
            ? `Questions? Write to <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`
            : `Des questions? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    // ===================================================================
    // CLIENT REVIEWS — activation / deactivation / internal notification
    // ===================================================================
    case "review_request_activation": {
      const firstName = esc(v.first_name || clientName);
      const googleReviewUrl = "https://g.page/r/Cc0xn5zgYussEBM/review";
      return {
        subject: "Comment s'est passée votre installation? — Nivra Telecom",
        html: shell({
          preheader: "Votre avis Google nous aide à améliorer notre service.",
          badge: "VOTRE AVIS COMPTE",
          heroTitle: "Bienvenue chez Nivra! Comment ça s'est passé?",
          icon: "star",
          greeting: `Bonjour ${firstName},`,
          bodyText:
            "Merci de faire confiance à Nivra Telecom. Votre avis sur Google nous aide à améliorer notre service et à aider d'autres Québécois à nous trouver. Cela prend moins de 2 minutes.",
          ctaPrimaryUrl: googleReviewUrl,
          ctaPrimaryLabel: "Laisser mon avis Google",
        }),
      };
    }

    case "review_request_deactivation": {
      const firstName = esc(v.first_name || clientName);
      const reviewUrl = String(v.review_url || `${APP_URL}/avis`);
      const googleReviewUrl = String(v.google_review_url || "https://g.page/r/Cc0xn5zgYussEBM/review");
      return {
        subject: "Merci d'avoir été client Nivra — Votre avis nous importe",
        html: shell({
          preheader: "Votre feedback nous aide à nous améliorer.",
          badge: "VOTRE AVIS COMPTE",
          heroTitle: "Merci pour votre confiance",
          icon: "info",
          greeting: `Bonjour ${firstName},`,
          bodyText:
            "Vous avez récemment mis fin à votre service Nivra Telecom. Votre feedback nous aide à nous améliorer. Cela prend 2 minutes.",
          cardTitle: "Informations",
          cardRows: [
            ["Temps requis", "Moins de 2 minutes"],
            ["Votre avis est", "Confidentiel"],
          ],
          ctaPrimaryUrl: reviewUrl,
          ctaPrimaryLabel: "Partager mon expérience",
          ctaSecondaryUrl: googleReviewUrl,
          ctaSecondaryLabel: "Laisser un avis Google",
          helpHtml: `Des questions? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "review_submitted_internal": {
      const firstName = esc(v.first_name || "Client");
      const rating = esc(v.rating || "");
      const triggerType = esc(v.trigger_type || "");
      const reviewId = esc(v.review_id || "");
      const adminUrl = `${APP_URL}/core/reviews`;
      return {
        subject: `[Avis reçu] ${firstName} — ${rating} étoiles`,
        html: shell({
          preheader: `Nouvel avis client reçu — ${rating}/5`,
          badge: "NOUVEL AVIS CLIENT",
          heroTitle: "Un client a soumis un avis",
          icon: "info",
          greeting: "Équipe Nivra,",
          bodyText: `Un nouvel avis client vient d'être soumis. Note: ${rating}/5 étoiles.`,
          cardTitle: "Détails",
          cardRows: [
            ["Client", firstName],
            ["Note globale", `${rating} / 5`],
            ["Type", triggerType === "activation" ? "Activation" : "Résiliation"],
            ["Référence", reviewId],
          ],
          ctaPrimaryUrl: adminUrl,
          ctaPrimaryLabel: "Voir l'avis dans Nivra Core",
          helpHtml: `Géré depuis <a href="${adminUrl}" style="color:${BRAND_PRIMARY};">Nivra Core → Avis clients</a>`,
        }),
      };
    }



    // ===================================================================
    // COMPLAINTS — confirmation / assigned / status / response / resolved / escalated
    // ===================================================================
    case "complaint_confirmation": {
      const firstName = esc(v.first_name || clientName || "Client");
      const ticket = esc(v.ticket_number || "");
      const category = esc(v.category_label || v.category || "");
      const priority = esc(v.priority_label || v.priority || "Normale");
      const sla = esc(v.sla_label || "72 heures");
      const portalUrl = String(v.tracking_url || v.portal_url || (v.public_token ? `${APP_URL}/plainte/suivi/${v.public_token}` : `${APP_URL}/plainte`));
      return {
        subject: `Votre plainte a été reçue — ${ticket} — Nivra Telecom`,
        html: shell({
          preheader: "Nous avons bien reçu votre plainte et nous la traiterons rapidement.",
          badge: "PLAINTE REÇUE",
          heroTitle: "Nous avons reçu votre plainte",
          icon: "check",
          greeting: `Bonjour ${firstName},`,
          bodyText:
            "Votre plainte a été enregistrée et sera traitée selon nos délais de service. Vous recevrez une notification par courriel à chaque étape.",
          cardTitle: "Détails de votre plainte",
          cardRows: [
            ["Numéro de ticket", ticket],
            ["Catégorie", category],
            ["Priorité", priority],
            ["Délai de traitement", sla],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Suivre ma plainte",
          helpHtml: `Des questions? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "complaint_assigned": {
      const ticket = esc(v.ticket_number || "");
      const client = esc(v.client_name || "Client");
      const category = esc(v.category_label || v.category || "");
      const priority = esc(v.priority_label || v.priority || "Normale");
      const sla = esc(v.sla_deadline || "");
      const coreUrl = String(v.core_complaint_url || `${APP_URL}/core/complaints`);
      return {
        subject: `[Plainte assignée] ${ticket} — Priorité ${priority}`,
        html: shell({
          preheader: `Une plainte vous a été assignée — ${ticket}`,
          badge: "PLAINTE ASSIGNÉE",
          heroTitle: "Une plainte vous a été assignée",
          icon: "info",
          greeting: "Bonjour,",
          bodyText:
            "Une plainte client vient de vous être assignée. Merci de la prendre en charge dans les délais SLA.",
          cardTitle: "Informations",
          cardRows: [
            ["Ticket", ticket],
            ["Client", client],
            ["Catégorie", category],
            ["Priorité", priority],
            ["Délai SLA", sla],
          ],
          ctaPrimaryUrl: coreUrl,
          ctaPrimaryLabel: "Voir la plainte",
          helpHtml: `Géré depuis <a href="${coreUrl}" style="color:${BRAND_PRIMARY};">Nivra Core → Plaintes</a>`,
        }),
      };
    }

    case "complaint_status_update": {
      const firstName = esc(v.first_name || clientName || "Client");
      const ticket = esc(v.ticket_number || "");
      const newStatus = esc(v.new_status_label || v.new_status || "");
      const portalUrl = String(v.tracking_url || v.portal_url || (v.public_token ? `${APP_URL}/plainte/suivi/${v.public_token}` : `${APP_URL}/plainte`));
      return {
        subject: `Mise à jour — ${ticket} — Nivra Telecom`,
        html: shell({
          preheader: `Statut de votre plainte mis à jour — ${newStatus}`,
          badge: "MISE À JOUR",
          heroTitle: "Statut de votre plainte mis à jour",
          icon: "info",
          greeting: `Bonjour ${firstName},`,
          bodyText:
            "Le statut de votre plainte vient d'être mis à jour. Vous pouvez en consulter les détails sur votre espace client.",
          cardTitle: "Détails",
          cardRows: [
            ["Ticket", ticket],
            ["Nouveau statut", newStatus],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Voir le statut",
          helpHtml: `Des questions? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "complaint_response": {
      const firstName = esc(v.first_name || clientName || "Client");
      const ticket = esc(v.ticket_number || "");
      const previewRaw = String(v.response_preview || "");
      const preview = esc(previewRaw.slice(0, 200));
      const portalUrl = String(v.tracking_url || v.portal_url || (v.public_token ? `${APP_URL}/plainte/suivi/${v.public_token}` : `${APP_URL}/plainte`));
      return {
        subject: `Réponse de Nivra Telecom — ${ticket}`,
        html: shell({
          preheader: "Notre équipe vient de vous répondre.",
          badge: "RÉPONSE DE NIVRA",
          heroTitle: "L'équipe Nivra vous a répondu",
          icon: "info",
          greeting: `Bonjour ${firstName},`,
          bodyText: preview
            ? `« ${preview}${previewRaw.length > 200 ? "…" : ""} »`
            : "Notre équipe vient de publier une réponse sur votre plainte. Consultez-la dans votre espace.",
          cardTitle: "Référence",
          cardRows: [["Ticket", ticket]],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Lire la réponse",
          helpHtml: `Des questions? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "complaint_resolved": {
      const firstName = esc(v.first_name || clientName || "Client");
      const ticket = esc(v.ticket_number || "");
      const resolvedDate = esc(v.resolved_date || "");
      const resolution = esc(v.resolution_summary || "");
      const portalUrl = String(v.tracking_url || v.portal_url || (v.public_token ? `${APP_URL}/plainte/suivi/${v.public_token}` : `${APP_URL}/plainte`));
      const googleReviewUrl = String(v.google_review_url || "https://g.page/r/Cc0xn5zgYussEBM/review");
      return {
        subject: `Votre plainte est résolue — ${ticket} — Nivra Telecom`,
        html: shell({
          preheader: "Bonne nouvelle : votre plainte vient d'être résolue.",
          badge: "PLAINTE RÉSOLUE",
          heroTitle: "Votre plainte a été résolue!",
          icon: "check",
          greeting: `Bonjour ${firstName},`,
          bodyText: resolution || "Notre équipe a résolu votre plainte. Merci de votre patience.",
          cardTitle: "Détails",
          cardRows: [
            ["Ticket", ticket],
            ["Résolu le", resolvedDate],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Confirmer la résolution",
          ctaSecondaryUrl: googleReviewUrl,
          ctaSecondaryLabel: "Laisser un avis Google",
          helpHtml: `Si le problème persiste, écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>`,
        }),
      };
    }

    case "complaint_escalated": {
      const ticket = esc(v.ticket_number || "");
      const client = esc(v.client_name || v.submitted_by_name || "Client");
      const email = esc(v.submitted_by_email || "");
      const phone = esc(v.submitted_by_phone || "—");
      const category = esc(v.category_label || v.category || "");
      const priority = esc(v.priority_label || v.priority || "");
      const subjectLine = esc(v.subject || "");
      const description = esc(String(v.description || "").slice(0, 600));
      const coreUrl = String(v.core_complaint_url || `${APP_URL}/core/complaints`);
      return {
        subject: `[URGENT] Plainte escaladée — ${ticket}`,
        html: shell({
          preheader: `Plainte escaladée — ${ticket} — action requise`,
          badge: "ESCALADE URGENTE",
          heroTitle: "Action requise — Plainte escaladée",
          icon: "alert",
          greeting: "Équipe Nivra,",
          bodyText: `Sujet: ${subjectLine}\n\n${description}`,
          cardTitle: "Détails complets",
          cardRows: [
            ["Ticket", ticket],
            ["Client", client],
            ["Courriel", email],
            ["Téléphone", phone],
            ["Catégorie", category],
            ["Priorité", priority],
          ],
          ctaPrimaryUrl: coreUrl,
          ctaPrimaryLabel: "Traiter immédiatement",
          helpHtml: `Géré depuis <a href="${coreUrl}" style="color:${BRAND_PRIMARY};">Nivra Core → Plaintes</a>`,
        }),
      };
    }

    // ===================================================================
    // AI AGENTS — site monitor + analytics digests
    // ===================================================================
    case "site_health_alert": {
      const score = Number(v.health_score ?? 0);
      const criticalCount = Number(v.critical_count ?? 0);
      const totalIssues = Number(v.total_issues ?? 0);
      const summary = esc(v.summary ?? "Problèmes critiques détectés sur la plateforme.");
      const issues = Array.isArray(v.issues) ? (v.issues as Array<{ title?: string; description?: string }>) : [];
      const issuesHtml = issues.slice(0, 10).map((i) =>
        `<li style="margin-bottom:8px;"><strong style="color:#1a1a2e;">${esc(i.title ?? "")}</strong>${i.description ? `<br/><span style="color:${BRAND_TEXT_MUTED};">${esc(i.description)}</span>` : ""}</li>`
      ).join("");
      return {
        subject: `[ALERTE CRITIQUE] Problème détecté — Nivra Telecom`,
        html: shell({
          preheader: `${criticalCount} problème(s) critique(s) détecté(s) — action requise.`,
          badge: "ALERTE SYSTÈME",
          heroTitle: "Action requise — Problème détecté",
          heroSub: `Score de santé : ${score}/100`,
          icon: "warn",
          greeting: `Bonjour ${clientName},`,
          bodyText: summary,
          cardTitle: "Synthèse",
          cardRows: [
            ["Score de santé", `${score}/100`],
            ["Problèmes critiques", String(criticalCount)],
            ["Total des alertes", String(totalIssues)],
            ["Détecté le", fmtDate(new Date().toISOString())],
          ],
          ctaPrimaryUrl: `${APP_URL}/core/monitor`,
          ctaPrimaryLabel: "Voir le tableau de bord",
          helpHtml: issues.length > 0
            ? `<strong style="color:#1a1a2e;">Problèmes critiques :</strong><ul style="padding-left:20px;margin:8px 0 0 0;color:${BRAND_TEXT_BODY};">${issuesHtml}</ul>`
            : `Connectez-vous au tableau de bord pour les détails.`,
        }),
      };
    }

    case "weekly_analytics_report": {
      const periodStart = fmtDate(v.period_start);
      const periodEnd = fmtDate(v.period_end);
      const mrr = money(v.mrr);
      const revenue = money(v.revenue);
      const newClients = String(v.new_clients ?? 0);
      const newOrders = String(v.new_orders ?? 0);
      const activeClients = String(v.active_clients ?? 0);
      const complaints = String(v.total_complaints ?? 0);
      const aiSummary = esc(v.ai_summary ?? "Rapport généré.");
      const recos = Array.isArray(v.recommendations) ? (v.recommendations as string[]) : [];
      const recosHtml = recos.slice(0, 5).map((r) => `<li style="margin-bottom:6px;">${esc(r)}</li>`).join("");
      return {
        subject: `Rapport hebdomadaire Nivra — Semaine du ${periodEnd}`,
        html: shell({
          preheader: `MRR ${mrr} — ${newClients} nouveaux clients, ${newOrders} commandes.`,
          badge: "RAPPORT HEBDOMADAIRE",
          heroTitle: `Votre rapport Nivra — Semaine du ${periodEnd}`,
          heroSub: `${periodStart} → ${periodEnd}`,
          icon: "check",
          greeting,
          bodyText: aiSummary,
          cardTitle: "Indicateurs clés",
          cardRows: [
            ["MRR actuel", mrr],
            ["Revenu de la période", revenue],
            ["Clients actifs", activeClients],
            ["Nouveaux clients", newClients],
            ["Nouvelles commandes", newOrders],
            ["Plaintes ouvertes", complaints],
          ],
          ctaPrimaryUrl: `${APP_URL}/core/analytics-ai`,
          ctaPrimaryLabel: "Voir le rapport complet",
          helpHtml: recos.length > 0
            ? `<strong style="color:#1a1a2e;">Recommandations prioritaires :</strong><ol style="padding-left:20px;margin:8px 0 0 0;color:${BRAND_TEXT_BODY};">${recosHtml}</ol>`
            : `Connectez-vous au tableau de bord pour les détails.`,
        }),
      };
    }

    case "daily_analytics_report": {
      const periodEnd = fmtDate(v.period_end);
      const mrr = money(v.mrr);
      const revenue = money(v.revenue);
      const newClients = String(v.new_clients ?? 0);
      const newOrders = String(v.new_orders ?? 0);
      const complaints = String(v.total_complaints ?? 0);
      const aiSummary = esc(v.ai_summary ?? "Rapport quotidien.");
      return {
        subject: `Rapport quotidien Nivra — ${periodEnd}`,
        html: shell({
          preheader: `${newOrders} commandes, ${newClients} nouveaux clients aujourd'hui.`,
          badge: "RAPPORT QUOTIDIEN",
          heroTitle: `Rapport du jour — ${periodEnd}`,
          heroSub: "Activité des dernières 24 heures",
          icon: "check",
          greeting,
          bodyText: aiSummary,
          cardTitle: "Aujourd'hui",
          cardRows: [
            ["Revenu (24h)", revenue],
            ["MRR actuel", mrr],
            ["Nouvelles commandes", newOrders],
            ["Nouveaux clients", newClients],
            ["Plaintes reçues", complaints],
          ],
          ctaPrimaryUrl: `${APP_URL}/core/analytics-ai`,
          ctaPrimaryLabel: "Voir les détails",
        }),
      };
    }

    // ===================================================================
    // AI AGENTS GROUP 2 — Marketing / Billing / Retention
    // ===================================================================
    case "marketing_promotion": {
      const heroTitle = esc(v.hero_title ?? v.subject ?? "Offre exclusive Nivra");
      const bodyHtml = String(v.body_html ?? "Une offre personnalisée vous attend.");
      const offerDetails = esc(v.offer_details ?? "Offre spéciale");
      const promoCode = esc(v.promo_code ?? "");
      const validUntil = fmtDate(v.offer_valid_until);
      return {
        subject: heroTitle,
        html: shell({
          preheader: `${offerDetails} — valide jusqu'au ${validUntil}.`,
          badge: "OFFRE EXCLUSIVE",
          heroTitle,
          icon: "star",
          greeting,
          bodyText: bodyHtml,
          cardTitle: "Votre offre",
          cardRows: [
            ["Offre", offerDetails],
            ["Code promo", promoCode || "—"],
            ["Valide jusqu'au", validUntil],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Profiter de l'offre",
          helpHtml: `Vous recevez cet email car vous êtes client Nivra Telecom. Pour vous désabonner, contactez <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    case "payment_reminder_7": {
      const planName = esc(v.plan_name ?? "Votre forfait");
      const amount = money(v.amount);
      const renewal = fmtDate(v.renewal_date);
      return {
        subject: "Votre service Nivra se renouvelle dans 7 jours",
        html: shell({
          preheader: `Renouvellement le ${renewal} — ${amount}.`,
          badge: "RENOUVELLEMENT À VENIR",
          heroTitle: "Votre service se renouvelle dans 7 jours",
          icon: "check",
          greeting,
          bodyText: "Assurez-vous que votre compte PayPal dispose des fonds nécessaires pour un renouvellement sans interruption.",
          cardTitle: "Détails du renouvellement",
          cardRows: [
            ["Forfait", planName],
            ["Montant", `${amount} + taxes`],
            ["Date de renouvellement", renewal],
            ["Mode de paiement", "PayPal automatique"],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Gérer mon compte",
        }),
      };
    }

    case "payment_reminder_3": {
      const planName = esc(v.plan_name ?? "Votre forfait");
      const amount = money(v.amount);
      const renewal = fmtDate(v.renewal_date);
      return {
        subject: "Rappel important — Renouvellement dans 3 jours",
        html: shell({
          preheader: `Action requise avant le ${renewal}.`,
          badge: "RAPPEL IMPORTANT",
          heroTitle: "Renouvellement dans 3 jours",
          icon: "warn",
          greeting,
          bodyText: "Votre renouvellement approche. Vérifiez dès maintenant que votre moyen de paiement est à jour pour éviter toute interruption de service.",
          cardTitle: "Détails",
          cardRows: [
            ["Forfait", planName],
            ["Montant", `${amount} + taxes`],
            ["Date de renouvellement", renewal],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Vérifier mon paiement",
          helpVariant: "warning",
        }),
      };
    }

    case "payment_failed_notice": {
      const amount = money(v.amount);
      const planName = esc(v.plan_name ?? "");
      return {
        subject: "Paiement échoué — Action requise",
        html: shell({
          preheader: `Échec du paiement de ${amount}.`,
          badge: "PAIEMENT ÉCHOUÉ",
          heroTitle: "Problème avec votre paiement",
          icon: "x",
          greeting,
          bodyText: "Nous n'avons pas pu traiter votre paiement. Sans mise à jour rapide, votre service Nivra pourrait être suspendu.",
          cardTitle: "Détails",
          cardRows: [
            ["Montant", amount],
            ["Forfait", planName || "—"],
            ["Statut", "Paiement échoué"],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Mettre à jour mon paiement",
          helpVariant: "warning",
          helpHtml: `Besoin d'aide ? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    case "grace_period_offer": {
      const amount = money(v.amount);
      const deadline = fmtDate(v.deadline);
      return {
        subject: "On vous donne 48 heures supplémentaires",
        html: shell({
          preheader: `Délai accordé jusqu'au ${deadline}.`,
          badge: "OFFRE SPÉCIALE",
          heroTitle: "On vous donne 48 heures supplémentaires",
          icon: "check",
          greeting,
          bodyText: "Nous savons que ça peut arriver. Voici 48 heures supplémentaires pour régler votre paiement et garder votre service Nivra actif.",
          cardTitle: "Détails",
          cardRows: [
            ["Montant dû", amount],
            ["Délai accordé", deadline],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Effectuer mon paiement",
        }),
      };
    }

    case "retention_offer": {
      const heroTitle = esc(v.hero_title ?? "Une offre rien que pour vous");
      const bodyHtml = String(v.body_html ?? "Nous tenons à vous garder dans la famille Nivra.");
      const offerType = esc(v.offer_type ?? "");
      const offerValue = esc(v.offer_value ?? "");
      const urgency = String(v.urgency_days ?? 7);
      return {
        subject: heroTitle,
        html: shell({
          preheader: `Offre personnalisée — valide ${urgency} jours.`,
          badge: "OFFRE PERSONNALISÉE",
          heroTitle,
          icon: "star",
          greeting,
          bodyText: bodyHtml,
          cardTitle: "Votre offre",
          cardRows: [
            ["Type", offerType || "Offre spéciale"],
            ["Valeur", String(offerValue || "—")],
            ["Validité", `${urgency} jours`],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: esc(v.cta_label ?? "Voir mon offre"),
          helpHtml: `Pour vous désabonner des offres : <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    case "winback_offer": {
      return {
        subject: "On vous manque — Revenez chez Nivra",
        html: shell({
          preheader: "Offre exclusive de retour.",
          badge: "ON VOUS MANQUE!",
          heroTitle: "Revenez chez Nivra — Offre exclusive",
          icon: "star",
          greeting,
          bodyText: "Depuis votre départ, nous avons amélioré nos forfaits et notre support local. On aimerait vous revoir parmi nos clients — voici une offre spéciale pour votre retour.",
          cardTitle: "Pourquoi revenir ?",
          cardRows: [
            ["Aucun contrat", "Toujours"],
            ["Support local", "Québécois"],
            ["Offre de retour", "Activation gratuite"],
          ],
          ctaPrimaryUrl: `${APP_URL}/commander`,
          ctaPrimaryLabel: "Revenir chez Nivra",
        }),
      };
    }

    // ===================================================================
    // AI AGENTS GROUP 3 — Support / CRM / Recruitment / Sales
    // ===================================================================
    case "support_ai_response": {
      const ticketNumber = esc(v.ticket_number ?? "");
      const aiResponse = String(v.ai_response ?? "Merci pour votre message. Nous reviendrons vers vous sous peu.");
      return {
        subject: `Réponse — Ticket ${ticketNumber}`,
        html: shell({
          preheader: `Réponse à votre demande — Ticket ${ticketNumber}`,
          badge: "RÉPONSE SUPPORT NIVRA",
          heroTitle: "Réponse à votre demande",
          icon: "check",
          greeting,
          bodyText: aiResponse,
          cardTitle: "Détails du ticket",
          cardRows: [
            ["Numéro de ticket", ticketNumber || "—"],
            ["Statut", "Répondu"],
          ],
          ctaPrimaryUrl: `${APP_URL}/plainte`,
          ctaPrimaryLabel: "Répondre ou poser une question",
          helpHtml: `Si cette réponse ne résout pas votre problème, soumettez une plainte en cliquant sur le bouton ci-dessus, ou écrivez à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    case "support_escalation_alert": {
      const ticketNumber = esc(v.ticket_number ?? "");
      const fromName = esc(v.from_name ?? "Client");
      const fromEmail = esc(v.from_email ?? "");
      const category = esc(v.category ?? "other");
      const priority = esc(v.priority ?? "normal");
      const sentiment = esc(v.sentiment ?? "neutral");
      const reason = esc(v.escalation_reason ?? "Confiance insuffisante");
      const origBody = esc(v.original_body ?? "").replace(/\n/g, "<br/>");
      const origSubject = esc(v.original_subject ?? "");
      return {
        subject: `[ESCALADE] Ticket ${ticketNumber} — ${category}`,
        html: shell({
          preheader: `Escalade ${priority} — ${category} — ${fromName}`,
          badge: "ESCALADE SUPPORT",
          heroTitle: "Ticket escaladé — Action requise",
          icon: "warn",
          greeting: "Équipe Nivra,",
          bodyText: "Un ticket support a été escaladé par l'IA et nécessite une intervention humaine.",
          cardTitle: "Détails du ticket",
          cardRows: [
            ["Ticket", ticketNumber],
            ["Client", `${fromName} (${fromEmail})`],
            ["Catégorie", category],
            ["Priorité", priority],
            ["Sentiment", sentiment],
            ["Raison escalade", reason],
            ["Sujet original", origSubject || "—"],
          ],
          ctaPrimaryUrl: `${APP_URL}/core/support-ai`,
          ctaPrimaryLabel: "Traiter ce ticket",
          helpHtml: `<strong style="color:#1a1a2e;">Email original :</strong><div style="margin-top:8px;padding:12px;background:${BRAND_HERO_BG};border-radius:6px;color:${BRAND_TEXT_BODY};">${origBody}</div>`,
        }),
      };
    }

    case "crm_morning_briefing": {
      const available = String(v.available ?? 0);
      const callbacks = String(v.callbacks ?? 0);
      const objectives = esc(v.objectives ?? "30 appels — 3 ventes");
      const summary = esc(v.summary ?? "Bonne journée!");
      const strategy = esc(v.strategy ?? "");
      const scripts = Array.isArray(v.scripts) ? (v.scripts as string[]) : [];
      const topPriorities = Array.isArray(v.top_priorities) ? (v.top_priorities as string[]) : [];
      const topContacts = Array.isArray(v.top_contacts) ? (v.top_contacts as any[]) : [];
      const firstName = esc(v.first_name ?? "Agent");
      const scriptsHtml = scripts.slice(0, 3).map((s) => `<li style="margin-bottom:6px;">${esc(s)}</li>`).join("");
      const contactsHtml = topContacts.slice(0, 10).map((c: any, i: number) =>
        `<li style="margin-bottom:6px;"><strong>${esc(c.full_name ?? c.first_name ?? c.email ?? "")}</strong>${c.city ? ` — ${esc(c.city)}` : ""}${topPriorities[i] ? `<br/><span style="color:${BRAND_TEXT_MUTED};">${esc(topPriorities[i])}</span>` : ""}</li>`
      ).join("");
      return {
        subject: `Briefing CRM du matin — ${new Date().toLocaleDateString("fr-CA")}`,
        html: shell({
          preheader: `${available} contacts disponibles — ${callbacks} rappels aujourd'hui.`,
          badge: "BRIEFING CRM DU MATIN",
          heroTitle: `Bonjour ${firstName}! Voici vos priorités du jour`,
          icon: "star",
          greeting,
          bodyText: summary + (strategy ? `<br/><br/><strong>Stratégie :</strong> ${strategy}` : ""),
          cardTitle: "Vos chiffres",
          cardRows: [
            ["Contacts disponibles", available],
            ["Rappels aujourd'hui", callbacks],
            ["Objectif du jour", objectives],
          ],
          ctaPrimaryUrl: `${APP_URL}/field/crm`,
          ctaPrimaryLabel: "Ouvrir le CRM",
          helpHtml: (contactsHtml ? `<strong style="color:#1a1a2e;">Top 10 contacts prioritaires :</strong><ol style="padding-left:20px;margin:8px 0 16px 0;color:${BRAND_TEXT_BODY};">${contactsHtml}</ol>` : "")
            + (scriptsHtml ? `<strong style="color:#1a1a2e;">Scripts d'approche :</strong><ul style="padding-left:20px;margin:8px 0 0 0;color:${BRAND_TEXT_BODY};">${scriptsHtml}</ul>` : ""),
        }),
      };
    }

    case "interview_invitation": {
      const interviewUrl = esc(v.interview_url ?? `${APP_URL}/`);
      const daysValid = String(v.days_valid ?? 7);
      return {
        subject: "Invitation à votre entrevue Nivra Telecom",
        html: shell({
          preheader: `Votre lien d'entrevue est prêt — valide ${daysValid} jours.`,
          badge: "INVITATION ENTREVUE",
          heroTitle: "Bienvenue chez Nivra Telecom!",
          icon: "star",
          greeting,
          bodyText: "Nous avons reçu votre candidature et souhaitons en savoir plus. Complétez votre entrevue en ligne de 15 minutes au moment qui vous convient.",
          cardTitle: "Détails de l'entrevue",
          cardRows: [
            ["Durée", "15 minutes"],
            ["Format", "En ligne, à votre rythme"],
            ["Lien valide", `${daysValid} jours`],
          ],
          ctaPrimaryUrl: interviewUrl,
          ctaPrimaryLabel: "Commencer mon entrevue",
        }),
      };
    }

    case "interview_reminder": {
      const interviewUrl = esc(v.interview_url ?? `${APP_URL}/`);
      const daysValid = String(v.days_valid ?? 3);
      return {
        subject: "Rappel — Votre entrevue Nivra vous attend",
        html: shell({
          preheader: `Votre lien expire dans ${daysValid} jours.`,
          badge: "RAPPEL ENTREVUE",
          heroTitle: "Votre entrevue vous attend!",
          icon: "warn",
          greeting,
          bodyText: "Nous n'avons pas encore reçu votre entrevue. Votre lien personnalisé reste actif mais expire bientôt — ne manquez pas cette opportunité.",
          cardTitle: "Détails",
          cardRows: [
            ["Lien valide encore", `${daysValid} jours`],
            ["Durée", "15 minutes"],
          ],
          ctaPrimaryUrl: interviewUrl,
          ctaPrimaryLabel: "Commencer mon entrevue",
        }),
      };
    }

    case "interview_rejection_polite": {
      return {
        subject: "Suivi de votre candidature Nivra Telecom",
        html: shell({
          preheader: "Suivi de votre candidature.",
          badge: "SUIVI CANDIDATURE",
          heroTitle: "Merci pour votre intérêt",
          icon: "check",
          greeting,
          bodyText: "Nous vous remercions sincèrement d'avoir postulé chez Nivra Telecom. Après examen attentif de votre candidature, nous ne sommes malheureusement pas en mesure d'aller de l'avant à ce moment-ci. Nous vous souhaitons beaucoup de succès dans vos démarches professionnelles.",
          cardTitle: "Pour la suite",
          cardRows: [
            ["Statut", "Candidature non retenue"],
            ["Réessayer", "Possible dans 6 mois"],
          ],
          ctaPrimaryUrl: `${APP_URL}/`,
          ctaPrimaryLabel: "Visiter Nivra Telecom",
        }),
      };
    }

    case "recruitment_pipeline_summary": {
      const pipelineDate = fmtDate(v.pipeline_date);
      return {
        subject: `Pipeline recrutement — ${pipelineDate}`,
        html: shell({
          preheader: `${v.new_count ?? 0} nouveaux candidats — ${v.pending_decision ?? 0} en attente.`,
          badge: "PIPELINE RECRUTEMENT",
          heroTitle: `Résumé du pipeline — ${pipelineDate}`,
          icon: "check",
          greeting: "Équipe RH,",
          bodyText: "Voici l'état actuel du pipeline de recrutement.",
          cardTitle: "Indicateurs",
          cardRows: [
            ["Nouveaux candidats", String(v.new_count ?? 0)],
            ["Invitations envoyées", String(v.invited_count ?? 0)],
            ["Entrevues complétées", String(v.completed_count ?? 0)],
            ["En attente de décision", String(v.pending_decision ?? 0)],
            ["Acceptés cette semaine", String(v.hired_week ?? 0)],
          ],
          ctaPrimaryUrl: `${APP_URL}/hr/interviews`,
          ctaPrimaryLabel: "Gérer les candidats",
        }),
      };
    }

    case "sales_opportunity_offer": {
      const heroTitle = esc(v.hero_title ?? "Une offre pour vous");
      const hook = esc(v.hook ?? "");
      const bodyHtml = String(v.body_html ?? "Découvrez votre offre personnalisée.");
      const currentPlan = esc(v.current_plan ?? "—");
      const currentPrice = money(v.current_price);
      const offerLabel = esc(v.offer_label ?? "Offre spéciale");
      const newPlanValue = esc(v.new_plan_value ?? "");
      const urgency = String(v.urgency_days ?? 14);
      const portalUrlSafe = esc(v.portal_url ?? portalUrl);
      return {
        subject: heroTitle,
        html: shell({
          preheader: `${offerLabel} — valide ${urgency} jours.`,
          badge: "OFFRE POUR VOUS",
          heroTitle,
          icon: "star",
          greeting,
          bodyText: (hook ? `<strong>${hook}</strong><br/><br/>` : "") + bodyHtml,
          cardTitle: "Votre offre",
          cardRows: [
            ["Forfait actuel", `${currentPlan} (${currentPrice})`],
            ["Offre", offerLabel],
            ["Valeur ajoutée", newPlanValue || "—"],
            ["Validité", `${urgency} jours`],
          ],
          ctaPrimaryUrl: portalUrlSafe,
          ctaPrimaryLabel: "Voir l'offre",
          helpHtml: `Vous recevez cet email car vous êtes client Nivra Telecom. Pour vous désabonner des offres, contactez <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    case "sync_alert": {
      const affectedOrders = String(v.affected_orders ?? 0);
      const incompleteProfiles = String(v.incomplete_profiles ?? 0);
      const unlinkedComplaints = String(v.unlinked_complaints ?? 0);
      const autoFixes = String(v.auto_fixes ?? 0);
      const recs = Array.isArray(v.recommendations) ? (v.recommendations as string[]) : [];
      const recsHtml = recs.slice(0, 6).map((r) =>
        `<li style="margin-bottom:6px;color:${BRAND_TEXT_BODY};">${esc(r)}</li>`
      ).join("");
      return {
        subject: "Alerte synchronisation — Nivra Telecom",
        html: shell({
          preheader: `${affectedOrders} commande(s), ${incompleteProfiles} profil(s) incomplet(s).`,
          badge: "ALERTE SYNCHRONISATION",
          heroTitle: "Problèmes de sync détectés",
          icon: "warn",
          greeting,
          bodyText: "L'agent de synchronisation a détecté des incohérences entre les portails qui requièrent votre attention.",
          cardTitle: "Synthèse",
          cardRows: [
            ["Commandes affectées", affectedOrders],
            ["Profils incomplets", incompleteProfiles],
            ["Plaintes non liées", unlinkedComplaints],
            ["Corrections auto", autoFixes],
          ],
          ctaPrimaryUrl: `${APP_URL}/core/sync-monitor`,
          ctaPrimaryLabel: "Voir le rapport",
          helpHtml: recsHtml
            ? `<strong style="color:#1a1a2e;">Recommandations :</strong><ul style="padding-left:20px;margin:8px 0 0 0;">${recsHtml}</ul>`
            : "",
        }),
      };
    }

    case "agent_supervisor_alert": {
      const globalHealth = String(v.global_health ?? 0);
      const activeCount = String(v.active_count ?? 0);
      const errorCount = String(v.error_count ?? 0);
      const failing = Array.isArray(v.failing_agents) ? (v.failing_agents as Array<Record<string, unknown>>) : [];
      const failingHtml = failing.slice(0, 10).map((f) =>
        `<li style="margin-bottom:6px;color:${BRAND_TEXT_BODY};"><strong>${esc(String(f.display_name ?? f.agent ?? ""))}</strong> — santé ${esc(String(f.health ?? "?"))}/100${f.last_error ? ` — <em>${esc(String(f.last_error))}</em>` : ""}</li>`
      ).join("");
      return {
        subject: "Alerte superviseur IA — Action requise",
        html: shell({
          preheader: `Santé globale ${globalHealth}/100 — ${errorCount} agent(s) en erreur.`,
          badge: "ALERTE SUPERVISEUR IA",
          heroTitle: "Agent(s) en difficulté — Action requise",
          icon: "warn",
          greeting,
          bodyText: "Le superviseur des agents IA a détecté un ou plusieurs agents en difficulté. Une revue est requise.",
          cardTitle: "Synthèse",
          cardRows: [
            ["Agents actifs", activeCount],
            ["Agents en erreur", errorCount],
            ["Score santé global", `${globalHealth}/100`],
          ],
          ctaPrimaryUrl: `${APP_URL}/core/agents`,
          ctaPrimaryLabel: "Voir le centre de contrôle",
          helpHtml: failingHtml
            ? `<strong style="color:#1a1a2e;">Agents en difficulté :</strong><ul style="padding-left:20px;margin:8px 0 0 0;">${failingHtml}</ul>`
            : "",
        }),
      };
    }

    case "sale_assigned_notification": {
      const agentName = String(v.agent_name ?? "agent");
      const customerName = String(v.customer_name ?? "");
      const planName = String(v.plan_name ?? "Service Nivra");
      const commissionAmount = String(v.commission_amount ?? 0);
      const orderReference = String(v.order_reference ?? "");
      return {
        subject: "Nouvelle vente confirmée — Nivra Telecom",
        html: shell({
          preheader: `Vente confirmée pour ${customerName} — commission ${commissionAmount}$.`,
          badge: "NOUVELLE VENTE CONFIRMÉE",
          heroTitle: "Félicitations! Vente confirmée",
          icon: "ok",
          greeting: `Bonjour ${esc(agentName)},`,
          bodyText: "Votre vente a été confirmée et votre commission a été calculée.",
          cardTitle: "Détails de la vente",
          cardRows: [
            ["Client", customerName],
            ["Référence", orderReference],
            ["Forfait", planName],
            ["Commission", `${commissionAmount}$`],
            ["Statut", "En attente de versement"],
          ],
          ctaPrimaryUrl: `${APP_URL}/field/commissions`,
          ctaPrimaryLabel: "Voir mes commissions",
          helpHtml: `Pour toute question, écrivez à <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};">${SUPPORT_EMAIL}</a>.`,
        }),
      };
    }

    // ===================================================================
    // TECHNICIAN INSTALLATION FLOW (tech portal triggers)
    // ===================================================================
    case "tech_en_route": {
      const techName = esc(v.tech_name || "Votre technicien");
      const eta = esc(v.eta || "sous peu");
      const techPhone = esc(v.tech_phone || SUPPORT_EMAIL);
      return {
        subject: "Votre technicien Nivra est en route",
        html: shell({
          preheader: `${techName} est en route vers votre domicile.`,
          badge: "TECHNICIEN EN ROUTE",
          heroTitle: "Votre technicien est en route!",
          icon: "truck",
          greeting,
          bodyText: "Votre technicien Nivra Telecom est en route vers votre domicile. Veuillez vous assurer d'être présent à l'adresse d'installation.",
          cardTitle: "Détails de l'arrivée",
          cardRows: [
            ["Technicien", techName],
            ["Heure d'arrivée estimée", eta],
            ["Contact", techPhone],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Contacter le support",
        }),
      };
    }

    case "tech_next": {
      const techName = esc(v.tech_name || "Votre technicien");
      const eta = esc(v.eta || "30-45 minutes");
      return {
        subject: "Votre installation Nivra est la prochaine",
        html: shell({
          preheader: "Vous êtes le prochain rendez-vous d'installation.",
          badge: "VOUS ÊTES LE PROCHAIN",
          heroTitle: "Votre installation est la prochaine!",
          icon: "calendar",
          greeting,
          bodyText: "Votre technicien terminera l'installation en cours et sera chez vous dans environ 30 à 45 minutes. Merci de votre patience.",
          cardTitle: "Prochaine étape",
          cardRows: [
            ["Technicien", techName],
            ["Arrivée estimée", eta],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Contacter le support",
        }),
      };
    }

    case "tech_missed": {
      const scheduled = fmtDate(v.scheduled_date);
      return {
        subject: "Rendez-vous d'installation manqué — Nivra Telecom",
        html: shell({
          preheader: "Nous n'avons pas pu effectuer votre installation aujourd'hui.",
          badge: "RENDEZ-VOUS MANQUÉ",
          heroTitle: "Rendez-vous d'installation manqué",
          icon: "alert",
          greeting,
          bodyText: "Nous n'avons malheureusement pas pu effectuer votre installation aujourd'hui. Veuillez contacter Nivra Telecom dans les meilleurs délais afin de replanifier votre rendez-vous.",
          cardTitle: "Référence",
          cardRows: [
            ["Date prévue", scheduled],
            ["Commande", `#${String(orderNum).replace(/^#/, "")}`],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Contacter le support",
        }),
      };
    }

    case "tech_arrived": {
      const techName = esc(v.tech_name || "Votre technicien");
      const arrival = esc(v.arrival_time || new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }));
      return {
        subject: "Votre technicien est arrivé — Nivra Telecom",
        html: shell({
          preheader: `${techName} est arrivé à votre porte.`,
          badge: "TECHNICIEN ARRIVÉ 📍",
          heroTitle: "Votre technicien est à votre porte!",
          icon: "truck",
          greeting,
          bodyText: "Votre technicien Nivra Telecom est arrivé à votre domicile. Veuillez lui ouvrir la porte afin de commencer l'installation.",
          cardTitle: "Détails de l'arrivée",
          cardRows: [
            ["Technicien", techName],
            ["Heure d'arrivée", arrival],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Contacter le support",
        }),
      };
    }

    case "tech_in_progress": {
      const techName = esc(v.tech_name || "Votre technicien");
      const start = esc(v.start_time || new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }));
      return {
        subject: "Installation en cours — Nivra Telecom",
        html: shell({
          preheader: "Votre installation a commencé.",
          badge: "INSTALLATION EN COURS 🔧",
          heroTitle: "Votre installation est en cours!",
          icon: "check",
          greeting,
          bodyText: "Votre technicien Nivra Telecom est en train d'installer votre service. Durée estimée: 30 à 60 minutes.",
          cardTitle: "Suivi de l'installation",
          cardRows: [
            ["Technicien", techName],
            ["Début de l'installation", start],
            ["Durée estimée", "30-60 minutes"],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Contacter le support",
        }),
      };
    }

    case "tech_rescheduled": {
      const techName = esc(v.tech_name || "Votre technicien");
      const newDate = fmtDate(v.new_date || v.scheduled_date);
      const newTime = esc(v.new_time || v.scheduled_time || "à confirmer");
      return {
        subject: "Installation replanifiée — Nivra Telecom",
        html: shell({
          preheader: "Votre rendez-vous d'installation a été replanifié.",
          badge: "RENDEZ-VOUS REPLANIFIÉ 📅",
          heroTitle: "Votre installation a été replanifiée",
          icon: "calendar",
          greeting,
          bodyText: "Votre rendez-vous d'installation a été replanifié. Vous trouverez ci-dessous les nouveaux détails. Pour toute question, contactez notre équipe support.",
          cardTitle: "Nouveau rendez-vous",
          cardRows: [
            ["Nouvelle date", newDate],
            ["Nouvelle heure", newTime],
            ["Technicien", techName],
          ],
          ctaPrimaryUrl: `mailto:${SUPPORT_EMAIL}`,
          ctaPrimaryLabel: "Contacter le support",
        }),
      };
    }

    case "tech_completed": {
      const planName = esc(v.plan_name || "Forfait Nivra");
      const renewal = esc(v.renewal_date || fmtDate(new Date(Date.now() + 30*86400000).toISOString()));
      const speed = esc(v.speed || "Optimale");
      const today = fmtDate(new Date().toISOString());
      return {
        subject: "Votre service Nivra est maintenant actif",
        html: shell({
          preheader: "Installation complétée — votre service est actif.",
          badge: "INSTALLATION COMPLÉTÉE",
          heroTitle: "Votre service Nivra est actif!",
          icon: "check",
          greeting,
          bodyText: "Votre installation a été complétée avec succès par notre technicien. Votre service est maintenant actif et prêt à être utilisé. Votre avis nous aide à grandir — laissez-nous une note Google!",
          cardTitle: "Détails du service",
          cardRows: [
            ["Forfait activé", planName],
            ["Date d'activation", today],
            ["Prochain renouvellement", renewal],
            ["Vitesse mesurée", speed],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Accéder à mon compte",
          ctaSecondaryUrl: "https://g.page/r/Cc0xn5zgYussEBM/review",
          ctaSecondaryLabel: "Laisser un avis Google",
        }),
      };
    }

    // ===================================================================
    // CLIENT PROFILE ACTIONS (Core admin triggers)
    // ===================================================================
    case "password_reset_request": {
      const resetUrl = String(v.reset_url || `${APP_URL}/portail/creer-mot-de-passe`);
      return {
        subject: "Réinitialisez votre mot de passe Nivra",
        html: shell({
          preheader: "Lien de réinitialisation de mot de passe à l'intérieur.",
          badge: "RÉINITIALISATION MOT DE PASSE",
          heroTitle: "Réinitialisez votre mot de passe",
          icon: "pen",
          greeting,
          bodyText: "Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe. Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce courriel.",
          ctaPrimaryUrl: resetUrl,
          ctaPrimaryLabel: "Réinitialiser mon mot de passe",
        }),
      };
    }

    case "account_summary": {
      const planName = esc(v.plan_name || "Aucun forfait actif");
      const monthly = money(v.monthly_amount);
      const renewal = fmtDate(v.renewal_date);
      const status = esc(v.status || "Actif");
      return {
        subject: "Résumé de votre compte Nivra Telecom",
        html: shell({
          preheader: "Voici un résumé de votre compte.",
          badge: "RÉSUMÉ DE VOTRE COMPTE",
          heroTitle: "Votre compte Nivra Telecom",
          icon: "doc",
          greeting,
          bodyText: "Voici un résumé à jour de votre compte Nivra Telecom.",
          cardTitle: "Détails du compte",
          cardRows: [
            ["Forfait actif", planName],
            ["Prix mensuel", `${monthly} + taxes`],
            ["Prochain renouvellement", renewal],
            ["Statut", status],
            ["Mode de paiement", "PayPal"],
          ],
          ctaPrimaryUrl: portalUrl,
          ctaPrimaryLabel: "Accéder à mon compte",
        }),
      };
    }

    // ===================================================================
    // HUNGRY SALES AGENTS (Agents 13-18)
    // ===================================================================
    case "crm_promo_blast": {
      const subject = String(v.subject || "Internet GIGA 60$/mois — Sans contrat, sans crédit");
      const heroTitle = String(v.hero_title || subject);
      const bodyText = String(v.body_fr || "Découvrez l'Internet GIGA 940 Mbps à 60$/mois, sans contrat et sans vérification de crédit.");
      const ctaLabel = String(v.cta_label || "Voir nos forfaits");
      const firstName = String(v.first_name || clientName);
      const unsubscribeUrl = esc(String(v.unsubscribe_url || "https://nivra-telecom.ca/contact"));
      return {
        subject,
        html: shell({
          preheader: "Offre exclusive Nivra Telecom — Internet GIGA sans contrat.",
          badge: "OFFRE EXCLUSIVE",
          heroTitle,
          icon: "spark",
          greeting: `Bonjour ${firstName},`,
          bodyText,
          cardTitle: "Nos offres réelles",
          cardRows: [
            ["Internet GIGA 940 Mbps", "60$/mois"],
            ["Sans contrat", "Aucun engagement"],
            ["Sans crédit", "Tout le monde accepté"],
            ["Alternative à Bell", "Économisez 35$/mois"],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/forfaits",
          ctaPrimaryLabel: ctaLabel,
          ctaSecondaryUrl: "https://nivra-telecom.ca/forfaits",
          ctaSecondaryLabel: "Voir tous nos forfaits",
          helpHtml: `Vous recevez ce courriel car vous avez fait affaire avec Nivra Telecom au Québec. <a href="${unsubscribeUrl}" style="color:#7c3aed;text-decoration:underline;">Me désabonner en un clic</a>. Nivra Telecom · ${SUPPORT_EMAIL}`,
        }),
      };
    }

    case "crm_followup": {
      const subject = String(v.subject || "On pensait à vous — Internet sans contrat");
      const heroTitle = String(v.hero_title || subject);
      const bodyText = String(v.body_fr || "Vous avez montré de l'intérêt pour Nivra Telecom. On voulait s'assurer que vous n'avez pas raté nos offres sans contrat et sans crédit.");
      const ctaLabel = String(v.cta_label || "Reprendre où vous étiez");
      const firstName = String(v.first_name || clientName);
      const unsubscribeUrl = esc(String(v.unsubscribe_url || "https://nivra-telecom.ca/contact"));
      return {
        subject,
        html: shell({
          preheader: "Un petit rappel amical de Nivra Telecom.",
          badge: "ON PENSAIT À VOUS",
          heroTitle,
          icon: "heart",
          greeting: `Bonjour ${firstName},`,
          bodyText,
          cardTitle: "Pourquoi Nivra ?",
          cardRows: [
            ["Liberté totale", "Aucun contrat"],
            ["Accessible à tous", "Sans vérification crédit"],
            ["Support local", "Équipe québécoise"],
            ["Internet GIGA", "60$/mois"],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/forfaits",
          ctaPrimaryLabel: ctaLabel,
          ctaSecondaryUrl: "https://nivra-telecom.ca/contact",
          ctaSecondaryLabel: "Parler à un humain",
          helpHtml: `Vous recevez ce courriel car vous avez exprimé de l'intérêt pour Nivra Telecom. <a href="${unsubscribeUrl}" style="color:#7c3aed;text-decoration:underline;">Me désabonner en un clic</a>. Nivra Telecom · ${SUPPORT_EMAIL}`,
        }),
      };
    }

    case "crm_sequence_social": {
      const subject = String(v.subject || "Ce que nos clients disent — Nivra Telecom");
      const heroTitle = String(v.hero_title || "Ils ont fait le saut. Vous?");
      const bodyText = String(v.body_fr || "Plusieurs Québécois ont quitté Bell ou Vidéotron pour Nivra ces dernières semaines. Voici ce qu'ils nous disent.");
      const ctaLabel = String(v.cta_label || "Découvrir les témoignages");
      const firstName = String(v.first_name || clientName);
      const unsubscribeUrl = esc(String(v.unsubscribe_url || "https://nivra-telecom.ca/contact"));
      return {
        subject,
        html: shell({
          preheader: "Témoignages de clients récents qui ont basculé chez Nivra.",
          badge: "VOIX DES CLIENTS",
          heroTitle,
          icon: "heart",
          greeting: `Bonjour ${firstName},`,
          bodyText,
          cardTitle: "Ce qu'ils nous disent",
          cardRows: [
            ["Marc — Montréal", "35$/mois économisés vs Bell"],
            ["Sophie — Laval", "Activation sans vérif. crédit"],
            ["Driss — St-Laurent", "GIGA stable, support local FR"],
            ["Sans contrat", "Liberté garantie"],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/forfaits",
          ctaPrimaryLabel: ctaLabel,
          ctaSecondaryUrl: "https://nivra-telecom.ca/contact",
          ctaSecondaryLabel: "Parler à un humain",
          helpHtml: `Touche 2/4 d'une courte séquence d'information envoyée aux personnes qui ont fait affaire avec Nivra. <a href="${unsubscribeUrl}" style="color:#7c3aed;text-decoration:underline;">Me désabonner en un clic</a>. Nivra Telecom · ${SUPPORT_EMAIL}`,
        }),
      };
    }

    case "crm_sequence_savings": {
      const subject = String(v.subject || "720$/an d'économies vs Bell — calcul réel");
      const heroTitle = String(v.hero_title || "Combien Bell vous coûte de trop?");
      const bodyText = String(v.body_fr || "Voici un calcul simple. Bell facture en moyenne 100$ à 120$ par mois pour Internet seul. Nivra GIGA 940 Mbps est à 60$/mois. La différence, c'est 720$ par année qui restent dans votre compte.");
      const ctaLabel = String(v.cta_label || "Voir l'économie complète");
      const firstName = String(v.first_name || clientName);
      const unsubscribeUrl = esc(String(v.unsubscribe_url || "https://nivra-telecom.ca/contact"));
      return {
        subject,
        html: shell({
          preheader: "Combien Bell vous coûte de trop chaque mois? Calcul honnête.",
          badge: "CALCUL D'ÉCONOMIE",
          heroTitle,
          icon: "spark",
          greeting: `Bonjour ${firstName},`,
          bodyText,
          cardTitle: "Comparaison directe (Internet seul)",
          cardRows: [
            ["Bell — Forfait GIGA", "~100-120$/mois"],
            ["Nivra — GIGA 940 Mbps", "60$/mois"],
            ["Économie mensuelle", "40 à 60$"],
            ["Économie annuelle", "480 à 720$"],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/forfaits",
          ctaPrimaryLabel: ctaLabel,
          ctaSecondaryUrl: "https://nivra-telecom.ca/contact",
          ctaSecondaryLabel: "Essayer un mois",
          helpHtml: `Touche 3/4 d'une courte séquence d'information. <a href="${unsubscribeUrl}" style="color:#7c3aed;text-decoration:underline;">Me désabonner en un clic</a>. Nivra Telecom · ${SUPPORT_EMAIL}`,
        }),
      };
    }

    case "crm_lead_welcome": {
      const subject = String(v.subject || "Bienvenue chez Nivra Telecom!");
      const heroTitle = String(v.hero_title || "Merci pour votre intérêt");
      const firstName = String(v.first_name || clientName);
      const city = String(v.city || "");
      const bodyText = String(
        v.body_fr ||
        `Merci d'avoir manifesté votre intérêt pour Nivra Telecom${city ? " à " + city : ""}. ` +
        "On a bien reçu votre demande. Un membre de l'équipe vous contactera très rapidement avec les prochaines étapes pour activer votre forfait GIGA 60$/mois — sans contrat, sans vérification de crédit."
      );
      const unsubscribeUrl = esc(String(v.unsubscribe_url || "https://nivra-telecom.ca/contact"));
      return {
        subject,
        html: shell({
          preheader: "Bienvenue chez Nivra Telecom. On vous écrit dans la minute.",
          badge: "BIENVENUE",
          heroTitle,
          icon: "spark",
          greeting: `Bonjour ${firstName},`,
          bodyText,
          cardTitle: "Ce que vous avez réservé",
          cardRows: [
            ["Internet GIGA 940 Mbps", "60$/mois"],
            ["Sans contrat", "Aucun engagement"],
            ["Sans vérif. crédit", "Tout le monde accepté"],
            ["Support local", "Équipe québécoise"],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/forfaits",
          ctaPrimaryLabel: "Voir tous nos forfaits",
          ctaSecondaryUrl: "https://nivra-telecom.ca/contact",
          ctaSecondaryLabel: "Parler à un humain",
          helpHtml: `Vous recevez ce courriel suite à votre demande sur notre site. <a href="${unsubscribeUrl}" style="color:#7c3aed;text-decoration:underline;">Me désabonner</a>. Nivra Telecom · ${SUPPORT_EMAIL}`,
        }),
      };
    }

    case "crm_sequence_lastcall": {
      const subject = String(v.subject || "Dernière relance — on respecte votre boîte courriel");
      const heroTitle = String(v.hero_title || "On respecte votre boîte courriel");
      const bodyText = String(v.body_fr || "Voici notre dernière relance. Si Nivra ne vous intéresse pas en ce moment, c'est tout à fait correct. On arrête après celui-ci. Vous pouvez toujours revenir quand vous voulez — la porte reste ouverte.");
      const ctaLabel = String(v.cta_label || "Réserver ma place");
      const firstName = String(v.first_name || clientName);
      const unsubscribeUrl = esc(String(v.unsubscribe_url || "https://nivra-telecom.ca/contact"));
      return {
        subject,
        html: shell({
          preheader: "Dernier message de notre séquence. Aucune pression.",
          badge: "DERNIÈRE RELANCE",
          heroTitle,
          icon: "heart",
          greeting: `Bonjour ${firstName},`,
          bodyText,
          cardTitle: "Pour rappel",
          cardRows: [
            ["Internet GIGA 940 Mbps", "60$/mois"],
            ["Sans contrat", "Aucun engagement"],
            ["Sans vérif. crédit", "Tout le monde accepté"],
            ["Support local", "Équipe québécoise"],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/forfaits",
          ctaPrimaryLabel: ctaLabel,
          ctaSecondaryUrl: "https://nivra-telecom.ca/contact",
          ctaSecondaryLabel: "Parler à un humain",
          helpHtml: `Dernière touche de notre séquence — vous ne recevrez plus d'emails marketing de notre part par la suite. <a href="${unsubscribeUrl}" style="color:#7c3aed;text-decoration:underline;">Me désabonner en un clic</a>. Nivra Telecom · ${SUPPORT_EMAIL}`,
        }),
      };
    }

    case "google_ads_alert": {
      const campaignName = esc(v.campaign_name || "Campagne inconnue");
      const status = esc(v.status || "—");
      const issue = String(v.issue_description || "Problème détecté sur la campagne.");
      const recommendation = String(v.recommendation || "Vérifier dans Google Ads.");
      return {
        subject: `⚠ Alerte Google Ads — ${campaignName}`,
        html: shell({
          preheader: "Une campagne Google Ads requiert votre attention.",
          badge: "ALERTE GOOGLE ADS",
          heroTitle: "Action requise — Google Ads",
          icon: "warn",
          greeting,
          bodyText: issue,
          cardTitle: "Détails de l'alerte",
          cardRows: [
            ["Campagne", campaignName],
            ["Statut", status],
            ["Problème", esc(issue)],
            ["Recommandation", esc(recommendation)],
          ],
          ctaPrimaryUrl: "https://ads.google.com",
          ctaPrimaryLabel: "Voir Google Ads",
          helpVariant: "warning",
          helpHtml: "Cette alerte a été générée automatiquement par l'agent Google Ads Monitor.",
        }),
      };
    }

    case "seo_weekly_report": {
      const indexedCount = esc(v.indexed_count ?? "—");
      const avgMs = esc(v.avg_load_ms ?? "—");
      const seoScore = esc(v.seo_score ?? "—");
      const topRec = String(v.top_recommendation || "Continuer la production de contenu local.");
      return {
        subject: `Rapport SEO hebdomadaire — Score ${seoScore}/100`,
        html: shell({
          preheader: "Votre rapport SEO de la semaine.",
          badge: "RAPPORT SEO HEBDOMADAIRE",
          heroTitle: "Rapport SEO — Nivra Telecom",
          icon: "doc",
          greeting,
          bodyText: "Voici le résumé de la performance SEO de la semaine.",
          cardTitle: "Indicateurs clés",
          cardRows: [
            ["Pages indexées", String(indexedCount)],
            ["Vitesse moyenne", `${avgMs} ms`],
            ["Score SEO", `${seoScore}/100`],
            ["Recommandation", esc(topRec)],
          ],
          ctaPrimaryUrl: "https://search.google.com/search-console",
          ctaPrimaryLabel: "Ouvrir Search Console",
        }),
      };
    }

    case "directories_reminder": {
      const pendingList = Array.isArray(v.pending_directories)
        ? v.pending_directories as Array<{ name: string; url: string }>
        : [];
      const rows: Array<[string, string]> = pendingList.slice(0, 10).map((d) => [esc(d.name), esc(d.url)]);
      const pendingCount = pendingList.length;
      return {
        subject: `Action requise — Soumettre Nivra dans ${pendingCount} répertoires gratuits`,
        html: shell({
          preheader: "Améliorez la visibilité locale de Nivra en quelques clics.",
          badge: "ACTION REQUISE — RÉPERTOIRES",
          heroTitle: "Soumettez Nivra dans ces répertoires gratuits",
          icon: "spark",
          greeting,
          bodyText: "Voici les répertoires gratuits où Nivra Telecom devrait être listé pour améliorer sa visibilité en ligne. Cliquez sur les liens pour soumettre manuellement.",
          cardTitle: `${pendingCount} répertoires en attente`,
          cardRows: rows.length > 0 ? rows : [["Aucun répertoire en attente", "—"]],
          ctaPrimaryUrl: "https://nivra-telecom.ca/core/agents",
          ctaPrimaryLabel: "Commencer les soumissions",
        }),
      };
    }

    case "social_post_ready": {
      const postType = esc(v.post_type || "promotion");
      const hashtags = Array.isArray(v.hashtags) ? (v.hashtags as string[]).join(" ") : String(v.hashtags || "");
      const preview = String(v.post_text || "").slice(0, 300);
      return {
        subject: `Nouveau post réseaux sociaux à approuver (${postType})`,
        html: shell({
          preheader: "Un post Facebook/Instagram est prêt pour approbation.",
          badge: "POST RÉSEAUX SOCIAUX PRÊT",
          heroTitle: "Nouveau post à approuver",
          icon: "spark",
          greeting,
          bodyText: preview,
          cardTitle: "Détails du post",
          cardRows: [
            ["Plateforme", "Facebook + Instagram"],
            ["Type", postType],
            ["Hashtags", esc(hashtags)],
            ["Généré par", "Nova (Gemini)"],
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/core/social-media",
          ctaPrimaryLabel: "Approuver et publier",
          ctaSecondaryUrl: "https://nivra-telecom.ca/core/social-media",
          ctaSecondaryLabel: "Voir tous les posts",
        }),
      };
    }

    case "autopay_upcoming_debit": {
      // J-3 advance notice to autopay subscribers. Sent by billing-generate-renewals
      // 3 days before the cycle ends so customers know exactly what will be
      // debited from their PayPal pre-authorization. Reduces surprise chargebacks.
      // Variables:
      //   client_name, debit_amount, debit_date, payment_method_label,
      //   invoice_number, plan_name, subtotal, discount_lines[]
      const debitAmount = String(v.debit_amount || v.amount || "—");
      const debitDate = String(v.debit_date || v.due_date || "—");
      const paymentLabel = String(v.payment_method_label || "PayPal pré-autorisé");
      const invoiceNumber = String(v.invoice_number || "—");
      const planName = String(v.plan_name || "Service Nivra");
      const subtotal = String(v.subtotal || debitAmount);
      const discountLines = Array.isArray(v.discount_lines) ? (v.discount_lines as Array<{ label: string; amount: number }>) : [];

      const rows: [string, string][] = [
        ["Forfait", esc(planName)],
        ["Sous-total", `${esc(subtotal)} $`],
      ];
      for (const d of discountLines) {
        rows.push([esc(d.label), `−${esc(String(d.amount))} $`]);
      }
      rows.push(["Date de débit", esc(debitDate)]);
      rows.push(["Méthode", esc(paymentLabel)]);

      return {
        subject: `Débit automatique de ${debitAmount} $ prévu le ${debitDate} — Facture ${invoiceNumber}`,
        html: shell({
          preheader: `Votre prélèvement automatique de ${debitAmount} $ aura lieu le ${debitDate}.`,
          badge: "PRÉLÈVEMENT À VENIR",
          heroTitle: `${debitAmount} $ seront débités le ${debitDate}`,
          icon: "card",
          greeting,
          bodyText:
            "Ceci est un avis amical de 3 jours avant votre prélèvement automatique mensuel. " +
            "Aucune action n'est requise — le débit se fera tout seul via PayPal. " +
            "Si vous voulez modifier votre méthode de paiement ou annuler le prélèvement automatique, " +
            "vous pouvez le faire dans votre portail client avant la date.",
          cardTitle: `Détails — Facture ${invoiceNumber}`,
          cardRows: rows,
          ctaPrimaryUrl: "https://nivra-telecom.ca/portal/billing",
          ctaPrimaryLabel: "Voir ma facture",
          ctaSecondaryUrl: "https://nivra-telecom.ca/portal/payment-method",
          ctaSecondaryLabel: "Gérer le prélèvement automatique",
        }),
      };
    }

    case "autopay_health_alert": {
      // Internal ops alert when the autopay system shows abnormal failure
      // rates. Sent by autopay-health-check edge function (daily cron).
      // Variables:
      //   failure_rate_percent, failed_count, total_count, window_hours,
      //   sample_errors[] (optional list of last few error messages)
      const failureRate = String(v.failure_rate_percent || "0");
      const failedCount = String(v.failed_count || "0");
      const totalCount = String(v.total_count || "0");
      const windowHours = String(v.window_hours || "24");
      const sampleErrors = Array.isArray(v.sample_errors) ? (v.sample_errors as string[]) : [];

      return {
        subject: `[ALERTE] Autopay : ${failureRate}% d'échecs sur les ${windowHours} dernières heures`,
        html: shell({
          preheader: `${failedCount} échecs sur ${totalCount} tentatives d'autopay.`,
          badge: "ALERTE OPS",
          heroTitle: `Taux d'échec autopay : ${failureRate}%`,
          icon: "alert",
          greeting: "Équipe Nivra,",
          bodyText:
            `Le système autopay a enregistré ${failedCount} échec(s) sur ${totalCount} tentative(s) ` +
            `dans les dernières ${windowHours} heures. Ce taux dépasse le seuil d'alerte. ` +
            `Vérifiez le statut PayPal, les credentials, et les comptes clients affectés.`,
          cardTitle: "Métriques",
          cardRows: [
            ["Taux d'échec", `${esc(failureRate)} %`],
            ["Échecs", esc(failedCount)],
            ["Total tentatives", esc(totalCount)],
            ["Fenêtre", `${esc(windowHours)} h`],
            ...(sampleErrors.length > 0
              ? ([["Exemple d'erreur", esc(sampleErrors[0].slice(0, 200))]] as [string, string][])
              : []),
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/core/billing/autopay",
          ctaPrimaryLabel: "Voir les tentatives en échec",
          ctaSecondaryUrl: "https://www.paypal.com/businessmanage/account/transactions",
          ctaSecondaryLabel: "Vérifier PayPal",
        }),
      };
    }

    case "appointment_updated": {
      // Used by appointment-rescheduled / appointment-status-update flows.
      // Variables: { client_name, appointment_date, appointment_time,
      //              technician_name, service_address, status_label, notes? }
      const apptDate = String(v.appointment_date || v.new_date || "—");
      const apptTime = String(v.appointment_time || v.new_time || "—");
      const techName = String(v.technician_name || "—");
      const serviceAddr = String(v.service_address || v.address || "—");
      const statusLabel = String(v.status_label || v.status || "Mis à jour");
      const notes = v.notes ? String(v.notes) : "";
      return {
        subject: `Mise à jour de votre rendez-vous Nivra — ${statusLabel}`,
        html: shell({
          preheader: "Votre rendez-vous a été modifié.",
          badge: "RENDEZ-VOUS",
          heroTitle: "Mise à jour de votre rendez-vous",
          icon: "calendar",
          greeting,
          bodyText:
            "Voici les détails de votre rendez-vous mis à jour. " +
            "Si vous avez des questions, répondez simplement à ce courriel.",
          cardTitle: "Nouveaux détails",
          cardRows: [
            ["Statut", esc(statusLabel)],
            ["Date", esc(apptDate)],
            ["Heure", esc(apptTime)],
            ["Technicien assigné", esc(techName)],
            ["Adresse de service", esc(serviceAddr)],
            ...(notes ? [["Notes", esc(notes)] as [string, string]] : []),
          ],
          ctaPrimaryUrl: "https://nivra-telecom.ca/portal/appointments",
          ctaPrimaryLabel: "Voir mes rendez-vous",
          ctaSecondaryUrl: "https://nivra-telecom.ca/contact",
          ctaSecondaryLabel: "Nous contacter",
        }),
      };
    }

    default:
      return null;
    }
}






