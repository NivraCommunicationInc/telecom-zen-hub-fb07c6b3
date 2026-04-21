import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend, enqueueEmail } from "../_shared/ResendProxy.ts";
import { sendSmsNotification, SMS_TEMPLATES, toE164 } from "../_shared/smsHelper.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  emailDocument, header, statusBanner, contentWrapper, footer, button,
  sectionHeader, helpSection, infoRow, amountBox, alertBox,
  colors, escapeHtml, formatCurrencySimple, formatDate
} from "../_shared/emailTemplates/components.ts";

// ============================================================
// TYPES
// ============================================================

interface OneTimeFee {
  label: string;
  amount: number;
}

interface ServiceInput {
  name: string;
  price: number;
  period?: string;
  details?: string;
  description?: string;
}

interface DeliveryAddress {
  street: string;
  city: string;
  province: string;
  postalCode: string;
}

interface InstallationInfo {
  scheduled_date: string;       // ISO date or formatted string
  scheduled_time?: string;      // e.g. "10h00 - 12h00"
  technician_name?: string;
  service_address: string;
  service_city?: string;
  service_province?: string;
  service_postal_code?: string;
  installation_fee?: number;
  notes?: string;
}

interface AlternativeShipping {
  recipient_name?: string;
  address_line: string;
  apartment?: string;
  city: string;
  province: string;
  postal_code: string;
  instructions?: string;
}

interface InstallationDetailsForEmail {
  coax_available?: string;
  occupancy_status?: string;
  access_notes?: string;
}

interface OrderConfirmationRequest {
  order_id: string;
  client_email: string;
  client_first_name?: string;
  client_phone?: string;
  client_id?: string;
  order_number: string;
  order_date?: string;
  services: ServiceInput[];
  subtotal?: number;
  tps_amount?: number;
  tvq_amount?: number;
  monthly_total_tax_in?: number;
  one_time_fees?: OneTimeFee[];
  one_time_total?: number;
  delivery_method?: string;
  delivery_address?: DeliveryAddress;
  installation?: InstallationInfo;
  payment_reference?: string;
  payment_method?: string;
  promo_code?: string;
  // Phase 2 — checkout enhancements (auto-hydrated from order if omitted)
  alternative_shipping?: AlternativeShipping;
  activation_preference?: "ASAP" | "SCHEDULED";
  requested_activation_date?: string;
  installation_details?: InstallationDetailsForEmail;
  force?: boolean;
}

// ============================================================
// HELPERS
// ============================================================

const maskEmail = (email: string): string => {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  const maskedLocal = local.length > 2 ? local.slice(0, 2) + "***" : "***";
  return `${maskedLocal}@${domain}`;
};

const getDeliveryMethodLabel = (method?: string): string => {
  switch (method) {
    case "technician": return "Installation par technicien";
    case "uber": return "Express Uber (10h)";
    case "auto": return "Auto-installation avec livraison";
    case "shipHome": return "Expédition à domicile (3-5 jours)";
    case "standard": return "Livraison standard (24-78h)";
    case "pickup": return "Ramassage en magasin";
    default: return method || "Standard";
  }
};

const calculateTaxes = (totalWithTax: number) => {
  const subtotal = totalWithTax / 1.14975;
  const tps = subtotal * 0.05;
  const tvq = subtotal * 0.09975;
  return { subtotal, tps, tvq };
};

// ============================================================
// PROMO HELPERS
// ============================================================

const FIRST_MONTH_FREE_CODES = ['BIENVENUE2026', 'NIVRA2026'];

function isFirstMonthFreePromo(promoCode?: string | null): boolean {
  if (!promoCode) return false;
  return FIRST_MONTH_FREE_CODES.includes(promoCode.trim().toUpperCase());
}

// ============================================================
// EMAIL HTML TEMPLATE — Premium Telecom Quality (Bell/Telus/Rogers)
// ============================================================

interface EmailTemplateParams {
  clientFirstName: string;
  orderNumber: string;
  orderDate: string;
  paymentReference?: string;
  paymentMethod?: string;
  services: ServiceInput[];
  subtotal: number;
  tpsAmount: number;
  tvqAmount: number;
  totalWithTax: number;
  oneTimeFees?: OneTimeFee[];
  oneTimeTotal?: number;
  deliveryMethod?: string;
  deliveryAddress?: DeliveryAddress;
  installation?: InstallationInfo;
  portalLink: string;
  supportEmail: string;
  promoCode?: string;
  // Phase 2 — checkout enhancements (optional, displayed only when present)
  alternativeShipping?: AlternativeShipping;
  activationPreference?: "ASAP" | "SCHEDULED";
  requestedActivationDate?: string;
  installationDetails?: InstallationDetailsForEmail;
}

// --- Premium typography helpers ---
const sLabel = (text: string) =>
  `<td style="color:#666666;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;padding:0 0 16px;">${text}</td>`;

const finRow = (label: string, value: string, opts?: { bold?: boolean; color?: string; size?: string }) => {
  const c = opts?.color || '#333333';
  const w = opts?.bold ? '700' : '400';
  const s = opts?.size || '14px';
  return `<tr>
    <td style="color:#333333;font-size:14px;line-height:1.7;padding:8px 0;border-bottom:1px solid #EEEEEE;font-family:'Courier New',Courier,monospace;">${escapeHtml(label)}</td>
    <td style="color:${c};font-size:${s};font-weight:${w};text-align:right;padding:8px 0;border-bottom:1px solid #EEEEEE;font-family:'Courier New',Courier,monospace;">${escapeHtml(value)}</td>
  </tr>`;
};

const dividerLine = `<tr><td colspan="2" style="border-bottom:2px solid #EEEEEE;padding:0;height:1px;"></td></tr>`;

function generateOrderConfirmationHtml(params: EmailTemplateParams): string {
  const {
    clientFirstName,
    orderNumber,
    orderDate,
    paymentMethod,
    services,
    subtotal: canonicalSubtotal,
    tpsAmount: canonicalTps,
    tvqAmount: canonicalTvq,
    totalWithTax: canonicalTotal,
    oneTimeFees,
    oneTimeTotal,
    deliveryAddress,
    installation,
    portalLink,
    supportEmail,
    promoCode,
    alternativeShipping,
    activationPreference,
    requestedActivationDate,
    installationDetails,
  } = params;

  const hasFirstMonthFree = isFirstMonthFreePromo(promoCode);

  // ============================================================
  // CANONICAL MATH — use values from pricing_snapshot/invoice
  // (passed in by the caller). NEVER recompute here.
  // ============================================================
  const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

  // Service subtotal/taxes — pulled directly from canonical breakdown
  const equipTotal = round2(oneTimeTotal || (oneTimeFees || []).reduce((sum, f) => sum + (Number(f.amount) || 0), 0));
  const serviceSubtotal = round2(Math.max(0, canonicalSubtotal - equipTotal));
  // Split canonical tax proportionally between service vs equipment
  const baseForSplit = (serviceSubtotal + equipTotal) || 1;
  const serviceTps = round2((canonicalTps * serviceSubtotal) / baseForSplit);
  const serviceTvq = round2((canonicalTvq * serviceSubtotal) / baseForSplit);
  const equipTps = round2(canonicalTps - serviceTps);
  const equipTvq = round2(canonicalTvq - serviceTvq);
  const serviceTotalWithTax = round2(serviceSubtotal + serviceTps + serviceTvq);
  const equipGrandTotal = round2(equipTotal + equipTps + equipTvq);

  const serviceName = services.length > 0 ? services[0].name : 'Internet';
  const servicePrice = services.length > 0 ? services[0].price : 0;

  const fullAddress = deliveryAddress
    ? `${escapeHtml(deliveryAddress.street)}, ${escapeHtml(deliveryAddress.city)}, ${escapeHtml(deliveryAddress.province)} ${escapeHtml(deliveryAddress.postalCode)}`
    : '';
  const fullName = deliveryAddress
    ? `${escapeHtml(clientFirstName)}`
    : escapeHtml(clientFirstName);

  const fmtPrice = (n: number) => n.toFixed(2).replace('.', ',');
  const formattedDate = formatDate(orderDate);
  const payLabel = escapeHtml(paymentMethod || 'PayPal');

  const preheader = hasFirstMonthFree
    ? `Bienvenue chez Nivra! Votre premier mois de service Internet est offert gratuitement.`
    : `Merci ${clientFirstName}! Commande #${orderNumber} confirmée.`;

  // === First month free banner ===
  const firstMonthBanner = hasFirstMonthFree ? `
    <div style="padding:24px 32px;background:#fff5e6;border-left:4px solid #FF9500;margin:0">
      <div style="margin-bottom:8px">
        <span style="font-size:20px">🎁</span>
        <span style="font-size:15px;font-weight:700;color:#B36200;margin-left:10px">Votre premier mois offert</span>
      </div>
      <div style="font-size:13px;color:#7A4500;line-height:1.7">En tant que nouveau client Nivra Telecom, votre premier mois de service est entièrement gratuit. Aucun montant ne sera débité pour votre service Internet durant les 30 prochains jours. Votre facturation régulière débutera automatiquement à votre deuxième mois.</div>
    </div>` : '';

  // === Financial rows — TABLE-based for email client compatibility ===
  const finRowHtml = (label: string, value: string, opts?: { green?: boolean; bold?: boolean; greenBg?: boolean; thickBorder?: boolean }) => {
    const bg = opts?.greenBg ? 'background:#f0fff8;' : '';
    const labelColor = opts?.green ? '#00875A' : '#555';
    const valColor = opts?.green ? '#00875A' : '#555';
    const fw = (opts?.bold || opts?.green) ? '600' : '400';
    const border = opts?.thickBorder ? 'border-bottom:2px solid #eee;' : 'border-bottom:1px solid #eee;';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${bg}${border}">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:${labelColor};font-weight:${fw}">${label}</td>
        <td style="padding:12px 16px;font-size:13px;color:${valColor};font-weight:${fw};text-align:right;white-space:nowrap">${value}</td>
      </tr>
    </table>`;
  };

  // === Itemized service rows (one per service) ===
  const serviceRowsHtml = (services || [])
    .map((s) => finRowHtml(escapeHtml(s.name || 'Forfait'), `${fmtPrice(Number(s.price) || 0)} $`))
    .join('');

  let financialBlock = '';
  if (hasFirstMonthFree) {
    financialBlock = `
      ${serviceRowsHtml}
      ${finRowHtml('Sous-total services', `${fmtPrice(serviceSubtotal)} $`)}
      ${finRowHtml('Premier mois offert', `-${fmtPrice(serviceSubtotal)} $`, { green: true, greenBg: true })}
      ${finRowHtml('Service ce mois-ci', '0,00 $', { bold: true, thickBorder: true })}
      ${equipTotal > 0 ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #eee">
          <tr><td style="padding:10px 16px;font-size:10px;color:#aaa;letter-spacing:1.5px;text-transform:uppercase">Équipement (frais uniques)</td></tr>
        </table>
        ${(oneTimeFees || []).map(f => finRowHtml(escapeHtml(f.label), `${fmtPrice(Number(f.amount) || 0)} $`)).join('')}
        ${finRowHtml('Sous-total équipement', `${fmtPrice(equipTotal)} $`)}
        ${finRowHtml('TPS (5%)', `${fmtPrice(equipTps)} $`)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #0057B8">
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#555">TVQ (9,975%)</td>
            <td style="padding:12px 16px;font-size:13px;color:#555;text-align:right;white-space:nowrap">${fmtPrice(equipTvq)} $</td>
          </tr>
        </table>
      ` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0057B8">
        <tr>
          <td style="padding:16px">
            <div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1.5px;text-transform:uppercase">Total payé aujourd'hui</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px">Équipement uniquement — service gratuit ce mois</div>
          </td>
          <td style="padding:16px;text-align:right;white-space:nowrap">
            <span style="font-size:26px;font-weight:700;color:#fff">${fmtPrice(canonicalTotal)} $</span>
          </td>
        </tr>
      </table>`;
  } else {
    financialBlock = `
      ${serviceRowsHtml}
      ${finRowHtml('Sous-total services', `${fmtPrice(serviceSubtotal)} $`)}
      ${finRowHtml('TPS (5%)', `${fmtPrice(serviceTps)} $`)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #eee">
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#555">TVQ (9,975%)</td>
          <td style="padding:12px 16px;font-size:13px;color:#555;text-align:right;white-space:nowrap">${fmtPrice(serviceTvq)} $</td>
        </tr>
      </table>
      ${finRowHtml('Total mensuel récurrent', `${fmtPrice(serviceTotalWithTax)} $`, { bold: true, thickBorder: true })}
      ${equipTotal > 0 ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #eee">
          <tr><td style="padding:10px 16px;font-size:10px;color:#aaa;letter-spacing:1.5px;text-transform:uppercase">Équipement (frais uniques)</td></tr>
        </table>
        ${(oneTimeFees || []).map(f => finRowHtml(escapeHtml(f.label), `${fmtPrice(Number(f.amount) || 0)} $`)).join('')}
        ${finRowHtml('Sous-total équipement', `${fmtPrice(equipTotal)} $`)}
        ${finRowHtml('TPS (5%)', `${fmtPrice(equipTps)} $`)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #0057B8">
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#555">TVQ (9,975%)</td>
            <td style="padding:12px 16px;font-size:13px;color:#555;text-align:right;white-space:nowrap">${fmtPrice(equipTvq)} $</td>
          </tr>
        </table>
      ` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0057B8">
        <tr>
          <td style="padding:16px">
            <div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1.5px;text-transform:uppercase">Total payé aujourd'hui</div>
          </td>
          <td style="padding:16px;text-align:right;white-space:nowrap">
            <span style="font-size:26px;font-weight:700;color:#fff">${fmtPrice(canonicalTotal)} $</span>
          </td>
        </tr>
      </table>`;
  }

  // === After-total summary (first month free only) ===
  const afterTotalSummary = hasFirstMonthFree ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:#f0fff8;border-radius:6px;border:1px solid #b7ebd6">
      <tr>
        <td style="padding:12px 16px">
          <div style="font-size:13px;font-weight:600;color:#00875A">Premier mois de service</div>
          <div style="font-size:12px;color:#555;margin-top:2px">À partir du 2e mois</div>
        </td>
        <td style="padding:12px 16px;text-align:right">
          <div style="font-size:14px;font-weight:700;color:#00875A">GRATUIT</div>
          <div style="font-size:13px;font-weight:600;color:#0d1f3c">${fmtPrice(serviceTotalWithTax)} $/mois</div>
        </td>
      </tr>
    </table>` : '';

  // === Equipment section ===
  const hasInstallation = !!installation;
  const equipmentSection = (!hasInstallation && oneTimeFees && oneTimeFees.length > 0) ? `
    <div style="padding:0 32px 24px">
      <div style="font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">Votre équipement en route</div>
      <div style="background:#f8f9ff;border-radius:8px;padding:16px;border:1px solid #e8ecff">
        <div style="font-size:13px;color:#444;line-height:1.7;margin-bottom:12px">Votre équipement Nivra sera expédié à votre adresse dans les <strong>24 à 48 heures ouvrables</strong>. Un courriel de suivi avec votre numéro de colis vous sera envoyé dès l'expédition.</div>
        ${fullAddress ? `
          <div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Adresse de livraison</div>
          <div style="font-size:13px;color:#0d1f3c;font-weight:600">${escapeHtml(clientFirstName)}</div>
          <div style="font-size:13px;color:#555">${fullAddress}</div>
        ` : ''}
      </div>
    </div>` : '';

  // === Installation section ===
  const formatInstallDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return dateStr; }
  };

  const installationAddress = installation
    ? [installation.service_address, installation.service_city, installation.service_province || 'QC', installation.service_postal_code].filter(Boolean).join(', ')
    : '';

  const installationSection = hasInstallation ? `
    <div style="padding:0 32px 24px">
      <div style="font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">🛠 Installation par technicien</div>
      <div style="background:#f0f7ff;border-radius:8px;overflow:hidden;border:1px solid #c4dcf0">
        <!-- Date & Time highlight -->
        <div style="background:#0057B8;padding:20px 20px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle">
              <div style="font-size:10px;color:rgba(255,255,255,0.7);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Date du rendez-vous</div>
              <div style="font-size:18px;font-weight:700;color:#fff">${escapeHtml(formatInstallDate(installation!.scheduled_date))}</div>
              ${installation!.scheduled_time ? `<div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px">${escapeHtml(installation!.scheduled_time)}</div>` : ''}
            </td>
            <td style="text-align:right;vertical-align:middle">
              <div style="width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;line-height:48px;text-align:center">
                <span style="font-size:22px">📅</span>
              </div>
            </td>
          </tr></table>
        </div>
        <!-- Details -->
        <div style="padding:16px 20px">
          ${installation!.technician_name ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
              <tr>
                <td style="width:28px;vertical-align:top;padding-top:2px"><span style="font-size:14px">👤</span></td>
                <td>
                  <div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px">Technicien</div>
                  <div style="font-size:13px;font-weight:600;color:#0d1f3c">${escapeHtml(installation!.technician_name)}</div>
                </td>
              </tr>
            </table>
          ` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
            <tr>
              <td style="width:28px;vertical-align:top;padding-top:2px"><span style="font-size:14px">📍</span></td>
              <td>
                <div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px">Adresse d'installation</div>
                <div style="font-size:13px;font-weight:600;color:#0d1f3c">${escapeHtml(installationAddress)}</div>
              </td>
            </tr>
          </table>
          ${installation!.installation_fee !== undefined ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px">
              <tr>
                <td style="width:28px;vertical-align:top;padding-top:2px"><span style="font-size:14px">💲</span></td>
                <td>
                  <div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px">Frais d'installation</div>
                  <div style="font-size:13px;font-weight:600;color:#0d1f3c">${installation!.installation_fee === 0 ? 'GRATUIT' : `${fmtPrice(installation!.installation_fee!)} $`}</div>
                </td>
              </tr>
            </table>
          ` : ''}
          ${installation!.notes ? `
            <div style="margin-top:12px;padding:10px 12px;background:#fff5e6;border-radius:6px;border:1px solid #ffe0a6">
              <div style="font-size:12px;color:#B36200;line-height:1.6">💡 ${escapeHtml(installation!.notes)}</div>
            </div>
          ` : ''}
          <div style="margin-top:16px;padding:12px;background:#fff;border-radius:6px;border:1px solid #e8e8e8">
            <div style="font-size:12px;color:#666;line-height:1.6">
              <strong>Ce que vous devez préparer :</strong><br>
              • Assurez-vous qu'un adulte (18+) est présent à l'adresse<br>
              • Dégagez l'accès au point d'entrée du câble<br>
              • Le technicien vous contactera 30 minutes avant son arrivée
            </div>
          </div>
        </div>
      </div>
    </div>` : '';

  // === Build full HTML ===
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>Confirmation de commande</title>
<!--[if mso]><style>body,table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
<style>*{box-sizing:border-box}body{margin:0;padding:0;-webkit-text-size-adjust:100%}</style>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif">
<!--[if !mso]><!--><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div><!--<![endif]-->

<div style="background:#f0f2f5;padding:24px;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">

<!-- HEADER -->
<div style="background:#0057B8;padding:28px 32px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle">
      <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">Nivra Telecom</div>
      <div style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;margin-top:2px">TÉLÉCOMMUNICATIONS</div>
    </td>
    <td style="text-align:right;vertical-align:middle">
      <div style="width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-flex;align-items:center;justify-content:center">
        <div style="color:#fff;font-size:20px;font-weight:700">N</div>
      </div>
    </td>
  </tr></table>
</div>

<!-- CONFIRMATION BANNER -->
<div style="background:#f8fffe;border-bottom:3px solid #00B37D;padding:32px;text-align:center">
  <div style="width:56px;height:56px;background:#00B37D;border-radius:50%;margin:0 auto 16px;line-height:56px;text-align:center">
    <span style="color:#fff;font-size:26px;font-weight:700">✓</span>
  </div>
  <div style="font-size:24px;font-weight:700;color:#0d1f3c;margin-bottom:6px">Commande confirmée</div>
  <div style="font-size:15px;color:#555;line-height:1.5">Bienvenue chez Nivra Telecom, <strong>${escapeHtml(clientFirstName)}</strong>.<br>Votre service sera activé sous 24 à 48 heures suivant la réception de votre équipement.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;background:#fff;border-radius:6px;border:1px solid #e8e8e8"><tr>
    <td style="padding:10px 20px;text-align:left">
      <div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase">Commande</div>
      <div style="font-size:13px;font-weight:700;color:#0d1f3c">#${escapeHtml(orderNumber)}</div>
    </td>
    <td style="width:1px;background:#e8e8e8;padding:0"></td>
    <td style="padding:10px 20px;text-align:left">
      <div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase">Date</div>
      <div style="font-size:13px;font-weight:700;color:#0d1f3c">${formattedDate}</div>
    </td>
    <td style="width:1px;background:#e8e8e8;padding:0"></td>
    <td style="padding:10px 20px;text-align:left">
      <div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase">Paiement</div>
      <div style="font-size:13px;font-weight:700;color:#0d1f3c">${payLabel}</div>
    </td>
  </tr></table>
</div>

<!-- FIRST MONTH FREE -->
${firstMonthBanner}

<!-- PLAN -->
<div style="padding:24px 32px">
  <div style="font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">Votre forfait</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border-radius:8px;border:1px solid #e8ecff"><tr>
    <td style="padding:14px 16px;vertical-align:middle">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:40px;height:40px;background:#0057B8;border-radius:8px;text-align:center;vertical-align:middle">
          <span style="color:#fff;font-size:16px">📡</span>
        </td>
        <td style="padding-left:12px">
          <div style="font-size:14px;font-weight:700;color:#0d1f3c">${escapeHtml(serviceName)}</div>
          <div style="font-size:12px;color:#888">Sans contrat · Activation sous 24h</div>
        </td>
      </tr></table>
    </td>
    <td style="padding:14px 16px;text-align:right;vertical-align:middle">
      <div style="font-size:18px;font-weight:700;color:#0057B8">${fmtPrice(servicePrice)}$</div>
      <div style="font-size:11px;color:#999">/mois</div>
    </td>
  </tr></table>
</div>

<!-- FINANCIAL SUMMARY -->
<div style="padding:0 32px 24px">
  <div style="font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">Résumé de votre commande</div>
  <div style="background:#fafafa;border-radius:8px;overflow:hidden;border:1px solid #eeeeee">
    ${financialBlock}
  </div>
  ${afterTotalSummary}
</div>

<!-- EQUIPMENT / INSTALLATION -->
${equipmentSection}
${installationSection}

<!-- INFO CARDS -->
<div style="padding:0 32px 24px">
  <div style="font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">Ce que vous devez savoir</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="width:50%;padding-right:6px;vertical-align:top">
      <div style="padding:16px;background:#fafafa;border-radius:8px;border:1px solid #eee">
        <div style="font-size:13px;font-weight:700;color:#0d1f3c;margin-bottom:6px">Annulation sans frais</div>
        <div style="font-size:12px;color:#666;line-height:1.6">Annulez à tout moment depuis votre espace client. Effectif à la fin de votre cycle de facturation.</div>
      </div>
    </td>
    <td style="width:50%;padding-left:6px;vertical-align:top">
      <div style="padding:16px;background:#fafafa;border-radius:8px;border:1px solid #eee">
        <div style="font-size:13px;font-weight:700;color:#0d1f3c;margin-bottom:6px">Garantie équipement</div>
        <div style="font-size:12px;color:#666;line-height:1.6">Retournez l'équipement sous 30 jours pour un remboursement complet garanti.</div>
      </div>
    </td>
  </tr></table>
</div>

<!-- CTA -->
<div style="padding:0 32px 32px;text-align:center">
  <a href="${portalLink}" style="display:inline-block;background:#0057B8;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Accéder à mon espace client →</a>
</div>

<!-- SUPPORT -->
<div style="padding:20px 32px;background:#f5f7fa;border-top:1px solid #eee;text-align:center">
  <div style="font-size:14px;font-weight:700;color:#0d1f3c;margin-bottom:4px">Une question? Notre équipe est là.</div>
  <div style="font-size:13px;color:#888;margin-bottom:12px">Disponible 7 jours sur 7, de 8 h à 20 h (HE)</div>
  <a href="mailto:${supportEmail}" style="display:inline-block;background:#0d1f3c;color:#fff;font-size:13px;font-weight:600;padding:10px 24px;border-radius:50px;text-decoration:none">${supportEmail}</a>
</div>

<!-- FOOTER -->
<div style="background:#0d1f3c;padding:28px 32px;text-align:center">
  <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:4px">Nivra Telecom</div>
  <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:16px">Fournisseur de services Internet et TV sans contrat au Québec</div>
  <div style="margin-bottom:16px">
    <a href="https://nivra-telecom.ca" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">Site web</a>
    <span style="color:rgba(255,255,255,0.2)"> | </span>
    <a href="https://nivra-telecom.ca/plans" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">Forfaits</a>
    <span style="color:rgba(255,255,255,0.2)"> | </span>
    <a href="https://nivra-telecom.ca/faq" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">FAQ</a>
    <span style="color:rgba(255,255,255,0.2)"> | </span>
    <a href="https://nivra-telecom.ca/privacy" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">Confidentialité</a>
    <span style="color:rgba(255,255,255,0.2)"> | </span>
    <a href="https://nivra-telecom.ca/terms" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">Conditions</a>
    <span style="color:rgba(255,255,255,0.2)"> | </span>
    <a href="https://crtc.gc.ca" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">CRTC</a>
  </div>
  <div style="font-size:11px;color:rgba(255,255,255,0.25)">© 2025 Nivra Communications Inc. Tous droits réservés.</div>
</div>

</div>
</div>
</body>
</html>`;
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] ========================================`);
  console.log(`[${requestId}] send-order-confirmation invoked (HTML TEMPLATE v2)`);

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const logResult = (status: "sent" | "skipped_already_sent" | "error", extra: Record<string, unknown> = {}) => {
    console.log(`[${requestId}] RESULT:`, JSON.stringify({ request_id: requestId, status, ...extra }));
  };

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey) {
      console.error(`[${requestId}] RESEND_API_KEY not configured`);
      logResult("error", { error: "RESEND_API_KEY not configured" });
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Supabase credentials not configured`);
      logResult("error", { error: "Supabase credentials not configured" });
      return new Response(JSON.stringify({ error: "Database service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body: OrderConfirmationRequest = await req.json();
    const {
      order_id,
      client_email,
      client_first_name,
      client_phone,
      client_id,
      order_number,
      order_date,
      services,
      subtotal: providedSubtotal,
      tps_amount: providedTps,
      tvq_amount: providedTvq,
      monthly_total_tax_in,
      one_time_fees,
      one_time_total,
      delivery_method,
      delivery_address,
      installation,
    payment_reference,
    payment_method,
    promo_code,
    force = false,
    } = body;

    console.log(`[${requestId}] Request: order_id=${order_id}, order_number=${order_number}, force=${force}`);
    console.log(`[${requestId}] to_email=${maskEmail(client_email)}`);
    console.log(`[${requestId}] services_count=${services?.length || 0}`);

    if (!order_id || !client_email || !order_number) {
      console.error(`[${requestId}] Missing required fields`);
      logResult("error", { error: "Missing required fields", order_id, order_number });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: orderData, error: checkError } = await supabase
      .from("orders")
      .select("confirmation_email_sent_at, client_phone, user_id, created_at, payment_method, payment_reference, total_amount, pricing_snapshot, promo_code")
      .eq("id", order_id)
      .single();

    if (checkError) {
      console.error(`[${requestId}] Error checking order:`, checkError);
      logResult("error", { error: "Order not found", order_id });
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile + account for PDF attachment data (phone, address)
    const userId = client_id || orderData?.user_id;
    let profilePhone = "";
    let profileAddress = "";
    let accountNumber = "";
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", userId)
        .maybeSingle();
      profilePhone = profile?.phone || "";

      const { data: account } = await supabase
        .from("accounts")
        .select("account_number, primary_service_address, primary_service_city, primary_service_province, primary_service_postal_code, billing_address, billing_city, billing_province, billing_postal_code")
        .eq("client_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (account) {
        accountNumber = account.account_number || "";
        const addr = account.primary_service_address || account.billing_address || "";
        const city = account.primary_service_city || account.billing_city || "";
        const prov = account.primary_service_province || account.billing_province || "QC";
        const postal = account.primary_service_postal_code || account.billing_postal_code || "";
        profileAddress = [addr, city, prov, postal].filter(Boolean).join(", ");
      }
    }
    const { data: latestInvoice } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, total, amount_paid, balance_due")
      .eq("order_id", order_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let latestPayment: { provider_payment_id?: string | null; reference?: string | null; method?: string | null; amount?: number | null } | null = null;
    let canonicalInvoiceLines: Array<{ description: string; unit_price: number; quantity: number; line_total: number; line_type: string }> = [];
    if (latestInvoice?.id) {
      const { data } = await supabase
        .from("billing_payments")
        .select("provider_payment_id, reference, method, amount")
        .eq("invoice_id", latestInvoice.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      latestPayment = data;

      // CANONICAL: Always read real invoice lines from DB. Never fabricate fees/equipment.
      const { data: lines } = await supabase
        .from("billing_invoice_lines")
        .select("description, unit_price, quantity, line_total, line_type")
        .eq("invoice_id", latestInvoice.id)
        .order("created_at", { ascending: true });
      canonicalInvoiceLines = (lines || []) as any[];
    }


    if (!force && orderData?.confirmation_email_sent_at) {
      console.log(`[${requestId}] Email already sent at ${orderData.confirmation_email_sent_at}`);
      logResult("skipped_already_sent", {
        order_id,
        order_number,
        to_email: maskEmail(client_email),
        sent_at: orderData.confirmation_email_sent_at,
      });
      return new Response(JSON.stringify({
        success: true,
        already_sent: true,
        status: "skipped_already_sent",
        sent_at: orderData.confirmation_email_sent_at,
        message: "Email already sent for this order (use force=true to resend)",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toNum = (value: unknown): number => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
    };

    const pricingSnapshot = (orderData?.pricing_snapshot || {}) as Record<string, any>;
    const fallbackTaxes = calculateTaxes(Number(monthly_total_tax_in || 0));

    const canonicalSubtotal = toNum(pricingSnapshot?.taxable_base ?? pricingSnapshot?.subtotal ?? providedSubtotal ?? fallbackTaxes.subtotal);
    const canonicalTps = toNum(pricingSnapshot?.tps_amount ?? providedTps ?? fallbackTaxes.tps);
    const canonicalTvq = toNum(pricingSnapshot?.tvq_amount ?? providedTvq ?? fallbackTaxes.tvq);
    const canonicalTotalPayable = toNum(pricingSnapshot?.grand_total ?? latestInvoice?.total ?? orderData?.total_amount ?? monthly_total_tax_in);
    const canonicalAmountPaidTotal = toNum(latestInvoice?.amount_paid);
    const canonicalBalanceDue = toNum(latestInvoice?.balance_due ?? Math.max(canonicalTotalPayable - canonicalAmountPaidTotal, 0));
    const latestPaymentAmount = toNum(latestPayment?.amount);
    const canonicalAmountPaidToday = latestPaymentAmount > 0
      ? latestPaymentAmount
      : (canonicalAmountPaidTotal > 0 ? canonicalAmountPaidTotal : canonicalTotalPayable);
    const canonicalRecurring = toNum(pricingSnapshot?.recurring_subtotal);
    const canonicalOneTime = toNum(pricingSnapshot?.one_time_subtotal ?? one_time_total ?? 0);
    const canonicalDiscount = toNum(
      pricingSnapshot?.discount_total_combined ??
      ((Number(pricingSnapshot?.promo_discount || 0) + Number(pricingSnapshot?.welcome_discount || 0))),
    );

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivra-telecom.ca";

    console.log(`[${requestId}] Generating HTML and queueing via pgmq...`);

    const eventKeyBase = `order_confirmation_${order_id}`;
    const eventKey = force
      ? `manual_order_confirmation_${order_id}_${Date.now()}`
      : eventKeyBase;

    const orderDate = body.order_date || orderData?.created_at || new Date().toISOString();
    const effectivePromoCode = promo_code || orderData?.promo_code || null;
    const effectivePaymentRef = payment_reference || latestPayment?.provider_payment_id || latestPayment?.reference || orderData?.payment_reference || null;
    const effectivePaymentMethod = payment_method || latestPayment?.method || orderData?.payment_method || null;

    const hasFirstMonthFree = isFirstMonthFreePromo(effectivePromoCode);
    const emailSubject = hasFirstMonthFree
      ? `Bienvenue chez Nivra Telecom (commande #${order_number})`
      : `Votre commande est confirmée (#${order_number})`;

    // CANONICAL: Build services + one_time_fees STRICTLY from billing_invoice_lines.
    // Never trust caller-provided arrays — they may be stale or fabricated.
    const canonicalServices = canonicalInvoiceLines
      .filter(l => l.line_type === 'service')
      .map(l => ({ name: l.description, price: Number(l.line_total) || 0, period: 'mois' }));

    const canonicalOneTimeFees = canonicalInvoiceLines
      .filter(l => l.line_type === 'equipment' || l.line_type === 'fee')
      .map(l => ({ label: l.description, amount: Number(l.line_total) || 0 }));

    // Fallback to caller-provided values ONLY if DB has no lines (legacy orders)
    const finalServices = canonicalServices.length > 0 ? canonicalServices : (services || []);
    const finalOneTimeFees = canonicalOneTimeFees.length > 0 ? canonicalOneTimeFees : (one_time_fees || []);
    const finalOneTimeTotal = canonicalOneTimeFees.length > 0
      ? canonicalOneTimeFees.reduce((s, f) => s + f.amount, 0)
      : canonicalOneTime;

    // Generate full HTML email
    const htmlBody = generateOrderConfirmationHtml({
      clientFirstName: client_first_name || "Client",
      orderNumber: order_number,
      orderDate,
      paymentReference: effectivePaymentRef || undefined,
      paymentMethod: effectivePaymentMethod || undefined,
      services: finalServices,
      subtotal: canonicalSubtotal,
      tpsAmount: canonicalTps,
      tvqAmount: canonicalTvq,
      totalWithTax: canonicalTotalPayable,
      oneTimeFees: finalOneTimeFees,
      oneTimeTotal: finalOneTimeTotal,
      deliveryMethod: delivery_method ? getDeliveryMethodLabel(delivery_method) : undefined,
      deliveryAddress: delivery_address,
      installation: installation,
      portalLink: `${siteBaseUrl}/portal/orders/${order_id}`,
      supportEmail: "support@nivra-telecom.ca",
      promoCode: effectivePromoCode || undefined,
    });

    // Enqueue main email via pgmq (actually delivered by process-email-queue)
    const enqueueResult = await enqueueEmail({
      to: client_email,
      templateKey: "order_submitted",
      eventKey,
      subject: emailSubject,
      html: htmlBody,
      fromEmail: "Nivra Telecom <noreply@nivra-telecom.ca>",
      messageType: "order_confirmation",
      entityType: "order",
      entityId: order_id,
      maxAttempts: 3,
    });

    if (!enqueueResult.success) {
      console.error(`[${requestId}] Failed to enqueue email:`, enqueueResult.error);
      logResult("error", {
        order_id,
        order_number,
        to_email: maskEmail(client_email),
        error: enqueueResult.error || "Failed to enqueue email",
      });
      return new Response(JSON.stringify({
        success: false,
        status: "error",
        error: "Failed to queue email",
        details: enqueueResult.error,
        request_id: requestId,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] ✅ Email enqueued to pgmq: ${enqueueResult.id}`);

    // BCC copy for first-month-free promo orders
    if (hasFirstMonthFree) {
      const bccEventKey = `${eventKey}_bcc_support`;
      const bccResult = await enqueueEmail({
        to: "support@nivra-telecom.ca",
        templateKey: "order_submitted",
        eventKey: bccEventKey,
        subject: `[BCC] ${emailSubject}`,
        html: htmlBody,
        fromEmail: "Nivra Telecom <noreply@nivra-telecom.ca>",
        messageType: "order_confirmation_bcc",
        entityType: "order",
        entityId: order_id,
        maxAttempts: 3,
      });
      if (bccResult.success) {
        console.log(`[${requestId}] ✅ BCC copy enqueued to pgmq`);
      } else {
        console.warn(`[${requestId}] BCC enqueue failed:`, bccResult.error);
      }
    }

    // Update order to mark confirmation as queued
    const { error: updateError } = await supabase
      .from("orders")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", order_id);

    if (updateError) {
      console.warn(`[${requestId}] Failed to update confirmation_email_sent_at:`, updateError);
    }

    logResult("sent", {
      order_id,
      order_number,
      to_email: maskEmail(client_email),
      method: "pgmq",
      message_id: enqueueResult.id,
      forced: force,
    });

    // Send SMS notification
    const phoneForSms = client_phone || orderData?.client_phone;
    const clientIdForSms = client_id || orderData?.user_id;
    if (phoneForSms && toE164(phoneForSms)) {
      console.log(`[${requestId}] Sending SMS notification...`);
      const smsResult = await sendSmsNotification({
        to: phoneForSms,
        message: SMS_TEMPLATES.orderConfirmation({
          orderNumber: order_number,
          clientName: client_first_name || "Client",
          monthlyTotal: formatCurrencySimple(monthly_total_tax_in),
        }),
        clientId: clientIdForSms,
        eventType: "order_confirmation",
        eventKey: eventKeyBase,
      });
      console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
    }

    console.log(`[${requestId}] ========================================`);

    return new Response(JSON.stringify({
      success: true,
      status: "queued",
      message_id: enqueueResult.id,
      order_number,
      method: "pgmq",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${requestId}] Exception:`, error);
    logResult("error", { error: (error as Error)?.message });
    return new Response(JSON.stringify({
      error: "An unexpected error occurred",
      request_id: requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
