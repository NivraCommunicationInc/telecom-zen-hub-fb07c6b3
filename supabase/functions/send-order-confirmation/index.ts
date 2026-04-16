import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { sendSmsNotification, SMS_TEMPLATES, toE164 } from "../_shared/smsHelper.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

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
  payment_reference?: string;
  payment_method?: string;
  promo_code?: string;
  force?: boolean;
}

// ============================================================
// HELPERS
// ============================================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount || 0);
};

const formatCurrencySimple = (amount: number): string => {
  const formatted = (amount || 0).toFixed(2);
  return `${formatted}$`;
};

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

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// ============================================================
// EMAIL HTML TEMPLATE
// ============================================================

const FIRST_MONTH_FREE_CODES = ['BIENVENUE2026', 'NIVRA2026'];

function isFirstMonthFreePromo(promoCode?: string | null): boolean {
  if (!promoCode) return false;
  return FIRST_MONTH_FREE_CODES.includes(promoCode.trim().toUpperCase());
}

function generateFirstMonthFreeSection(promoCode: string, monthlyTotal: string): string {
  return `
    <!-- First Month Free Section -->
    <div style="margin-top: 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="padding-bottom: 16px;">
            <div style="display: flex; align-items: center;">
              <div style="width: 4px; height: 24px; background: linear-gradient(180deg, #10b981 0%, #059669 100%); border-radius: 2px; margin-right: 12px;"></div>
              <h3 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0;">🎁 Premier mois gratuit</h3>
            </div>
          </td>
        </tr>
      </table>
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px;">
        <ul style="color: #065f46; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Vous avez payé uniquement les frais d'équipement aujourd'hui</li>
          <li>Votre premier mois de service est entièrement crédité (code: <strong>${promoCode}</strong>)</li>
          <li>La facturation normale de ${monthlyTotal}/mois commence au 2e mois</li>
        </ul>
      </div>
    </div>

    <!-- Equipment Section -->
    <div style="margin-top: 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="display: flex; align-items: center;">
              <div style="width: 4px; height: 24px; background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%); border-radius: 2px; margin-right: 12px;"></div>
              <h3 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0;">📦 Votre équipement</h3>
            </div>
          </td>
        </tr>
      </table>
      <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px;">
        <ul style="color: #78350f; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Livré sous 3-5 jours ouvrables</li>
          <li>Instructions d'installation incluses dans la boîte</li>
        </ul>
      </div>
    </div>

    <!-- Equipment Refund Section -->
    <div style="margin-top: 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="display: flex; align-items: center;">
              <div style="width: 4px; height: 24px; background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%); border-radius: 2px; margin-right: 12px;"></div>
              <h3 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0;">↩ Remboursement équipement</h3>
            </div>
          </td>
        </tr>
      </table>
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px;">
        <ul style="color: #1e3a5a; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Retournez l'équipement sous 30 jours en bon état</li>
          <li>Remboursement complet des frais d'équipement garanti</li>
          <li>Contactez <a href="mailto:support@nivra-telecom.ca" style="color: #2563eb;">support@nivra-telecom.ca</a> pour initier le retour</li>
        </ul>
      </div>
    </div>

    <!-- Cancellation Section -->
    <div style="margin-top: 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="padding-bottom: 12px;">
            <div style="display: flex; align-items: center;">
              <div style="width: 4px; height: 24px; background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%); border-radius: 2px; margin-right: 12px;"></div>
              <h3 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0;">⚠️ Annulation</h3>
            </div>
          </td>
        </tr>
      </table>
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px;">
        <ul style="color: #7f1d1d; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Annulez à tout moment depuis votre espace client</li>
          <li>Aucun frais de résiliation</li>
          <li>Effectif à la fin du cycle de facturation en cours</li>
        </ul>
      </div>
    </div>
  `;
}

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
  portalLink: string;
  supportPhone: string;
  supportEmail: string;
  promoCode?: string;
}

function generateOrderConfirmationHtml(params: EmailTemplateParams): string {
  const {
    clientFirstName,
    orderNumber,
    orderDate,
    paymentReference,
    paymentMethod,
    services,
    subtotal,
    tpsAmount,
    tvqAmount,
    totalWithTax,
    oneTimeFees,
    oneTimeTotal,
    deliveryMethod,
    deliveryAddress,
    portalLink,
    supportPhone,
    supportEmail,
    promoCode,
  } = params;

  const hasFirstMonthFree = isFirstMonthFreePromo(promoCode);
  const firstMonthFreeHtml = hasFirstMonthFree
    ? generateFirstMonthFreeSection(promoCode!, formatCurrencySimple(subtotal))
    : "";

  // Generate services HTML - Professional telecom style
  const servicesHtml = services.map((service, index) => `
    <tr style="${index > 0 ? 'border-top: 1px solid #e2e8f0;' : ''}">
      <td style="padding: 16px 0;">
        <div style="display: flex; align-items: flex-start;">
          <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-radius: 10px; display: inline-block; text-align: center; line-height: 40px; margin-right: 16px; flex-shrink: 0;">
            <span style="color: #ffffff; font-size: 18px;">📱</span>
          </div>
          <div style="flex: 1;">
            <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin: 0 0 4px 0; line-height: 1.4;">${escapeHtml(service.name)}</p>
            ${service.details ? `<p style="color: #64748b; font-size: 13px; margin: 0 0 2px 0; line-height: 1.4;">${escapeHtml(service.details)}</p>` : ""}
            ${service.description ? `<p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.4;">${escapeHtml(service.description)}</p>` : ""}
          </div>
        </div>
      </td>
      <td style="padding: 16px 0; text-align: right; vertical-align: top; white-space: nowrap;">
        <span style="color: #0f172a; font-size: 18px; font-weight: 700;">${formatCurrencySimple(service.price)}</span>
        <span style="color: #64748b; font-size: 13px; font-weight: 400;">/${service.period || "mois"}</span>
      </td>
    </tr>
  `).join("");

  // Generate one-time fees HTML - Premium style
  let oneTimeFeesHtml = "";
  if (oneTimeFees && oneTimeFees.length > 0) {
    const feesRows = oneTimeFees.map((fee, index) => `
      <tr style="${index > 0 ? 'border-top: 1px solid #e2e8f0;' : ''}">
        <td style="color: #475569; font-size: 14px; padding: 12px 0;">${escapeHtml(fee.label)}</td>
        <td style="color: #0f172a; font-size: 14px; font-weight: 600; text-align: right; padding: 12px 0;">${formatCurrencySimple(fee.amount)}</td>
      </tr>
    `).join("");

    oneTimeFeesHtml = `
      <!-- One-Time Fees Section -->
      <div style="margin-top: 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="padding-bottom: 16px;">
              <div style="display: flex; align-items: center;">
                <div style="width: 4px; height: 24px; background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%); border-radius: 2px; margin-right: 12px;"></div>
                <h3 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">Frais uniques</h3>
              </div>
            </td>
          </tr>
        </table>
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tbody>
              ${feesRows}
              ${oneTimeTotal !== undefined ? `
                <tr style="border-top: 2px solid #f59e0b;">
                  <td style="color: #92400e; font-size: 15px; font-weight: 700; padding: 16px 0 0 0;">Total frais uniques</td>
                  <td style="color: #92400e; font-size: 18px; font-weight: 700; text-align: right; padding: 16px 0 0 0;">${formatCurrencySimple(oneTimeTotal)}</td>
                </tr>
              ` : ""}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Generate delivery section HTML - Premium card style
  let deliveryHtml = "";
  if (deliveryMethod || deliveryAddress) {
    deliveryHtml = `
      <!-- Delivery Section -->
      <div style="margin-top: 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="padding-bottom: 16px;">
              <div style="display: flex; align-items: center;">
                <div style="width: 4px; height: 24px; background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 2px; margin-right: 12px;"></div>
                <h3 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">Livraison & Installation</h3>
              </div>
            </td>
          </tr>
        </table>
        <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border: 1px solid #ddd6fe; border-radius: 12px; padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            ${deliveryMethod ? `
              <tr>
                <td style="padding-bottom: 12px;">
                  <div style="display: flex; align-items: center;">
                    <div style="width: 36px; height: 36px; background-color: #ffffff; border-radius: 8px; display: inline-block; text-align: center; line-height: 36px; margin-right: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                      <span style="font-size: 16px;">🚚</span>
                    </div>
                    <div>
                      <p style="color: #6b7280; font-size: 12px; font-weight: 500; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.5px;">Méthode</p>
                      <p style="color: #0f172a; font-size: 15px; font-weight: 600; margin: 0;">${escapeHtml(deliveryMethod)}</p>
                    </div>
                  </div>
                </td>
              </tr>
            ` : ""}
            ${deliveryAddress ? `
              <tr>
                <td style="padding-top: ${deliveryMethod ? '12px' : '0'};">
                  <div style="display: flex; align-items: flex-start;">
                    <div style="width: 36px; height: 36px; background-color: #ffffff; border-radius: 8px; display: inline-block; text-align: center; line-height: 36px; margin-right: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                      <span style="font-size: 16px;">📍</span>
                    </div>
                    <div>
                      <p style="color: #6b7280; font-size: 12px; font-weight: 500; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.5px;">Adresse de livraison</p>
                      <p style="color: #0f172a; font-size: 15px; font-weight: 600; margin: 0; line-height: 1.5;">
                        ${escapeHtml(deliveryAddress.street)}<br>
                        ${escapeHtml(deliveryAddress.city)}, ${escapeHtml(deliveryAddress.province)} ${escapeHtml(deliveryAddress.postalCode)}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ` : ""}
          </table>
        </div>
      </div>
    `;
  }

  // Build payment info - Compact inline style
  const paymentInfoHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
      <tr>
        <td style="padding: 4px 0;">
          <span style="color: #64748b; font-size: 13px;">Commande:</span>
          <span style="color: #0f172a; font-size: 13px; font-weight: 600; margin-left: 8px;">#${escapeHtml(orderNumber)}</span>
        </td>
        <td style="padding: 4px 0; text-align: right;">
          <span style="color: #64748b; font-size: 13px;">Date:</span>
          <span style="color: #0f172a; font-size: 13px; font-weight: 600; margin-left: 8px;">${formatDate(orderDate)}</span>
        </td>
      </tr>
      ${paymentReference || paymentMethod ? `
        <tr>
          ${paymentReference ? `
            <td style="padding: 4px 0;">
              <span style="color: #64748b; font-size: 13px;">Réf. paiement:</span>
              <span style="color: #0f172a; font-size: 13px; font-weight: 600; margin-left: 8px;">${escapeHtml(paymentReference)}</span>
            </td>
          ` : '<td></td>'}
          ${paymentMethod ? `
            <td style="padding: 4px 0; text-align: right;">
              <span style="color: #64748b; font-size: 13px;">Méthode:</span>
              <span style="color: #0f172a; font-size: 13px; font-weight: 600; margin-left: 8px;">${escapeHtml(paymentMethod)}</span>
            </td>
          ` : '<td></td>'}
        </tr>
      ` : ''}
    </table>
  `;

  return `
<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
  <title>Confirmation de commande #${escapeHtml(orderNumber)} | Nivra</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    table { border-collapse: collapse; }
    td { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    
    table { border-collapse: collapse !important; }
    
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    
    .button:hover {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
      transform: translateY(-1px);
    }
    
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 0 16px !important; }
      .header-padding { padding: 24px 20px !important; }
      .content-padding { padding: 24px 20px !important; }
      .mobile-full { width: 100% !important; display: block !important; }
      .mobile-center { text-align: center !important; }
      .mobile-hide { display: none !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">

  <!-- Preheader Text (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${hasFirstMonthFree
      ? `🎉 Bienvenue chez Nivra! Votre premier mois est gratuit. Commande #${escapeHtml(orderNumber)} confirmée.`
      : `Merci ${escapeHtml(clientFirstName)}! Votre commande #${escapeHtml(orderNumber)} est confirmée. Total mensuel: ${formatCurrencySimple(totalWithTax)}`} &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
  </div>

  <!-- Wrapper Table -->
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f1f5f9;">
    <tr>
      <td style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" class="container" style="max-width: 640px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);">
          
          <!-- Header - Premium Gradient -->
          <tr>
            <td class="header-padding" style="background: linear-gradient(135deg, #0c1929 0%, #1e3a5f 50%, #0c4a6e 100%); padding: 40px 48px; text-align: center; position: relative;">
              <!-- Decorative Elements -->
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #0ea5e9 0%, #06b6d4 50%, #14b8a6 100%);"></div>
              
              <!-- Logo -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="text-align: center;">
                    <h1 style="margin: 0; font-size: 36px; font-weight: 800; letter-spacing: -0.03em;">
                      <span style="color: #ffffff;">Nivra</span>
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #22d3ee;">Télécommunications</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Success Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 24px 48px; border-bottom: 1px solid #a7f3d0;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="text-align: center;">
                    <div style="display: inline-block; background-color: #ffffff; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25); margin-bottom: 16px;">
                      <span style="font-size: 28px;">✓</span>
                    </div>
                    <h2 style="color: #065f46; font-size: 22px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: -0.02em;">Commande confirmée!</h2>
                    <p style="color: #047857; font-size: 15px; margin: 0; font-weight: 500;">Merci pour votre confiance, ${escapeHtml(clientFirstName)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Info Bar -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 48px; border-bottom: 1px solid #e2e8f0;">
              ${paymentInfoHtml}
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="content-padding" style="padding: 40px 48px;">
              
              <!-- Services Section -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="padding-bottom: 20px;">
                    <div style="display: flex; align-items: center;">
                      <div style="width: 4px; height: 24px; background: linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%); border-radius: 2px; margin-right: 12px;"></div>
                      <h3 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">Vos services</h3>
                    </div>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tbody>
                    ${servicesHtml}
                  </tbody>
                </table>
              </div>

              <!-- Pricing Section -->
              <div style="margin-top: 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding-bottom: 20px;">
                      <div style="display: flex; align-items: center;">
                        <div style="width: 4px; height: 24px; background: linear-gradient(180deg, #10b981 0%, #059669 100%); border-radius: 2px; margin-right: 12px;"></div>
                        <h3 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">Récapitulatif mensuel</h3>
                      </div>
                    </td>
                  </tr>
                </table>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                    <tbody>
                      <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">Sous-total</td>
                        <td style="color: #0f172a; font-size: 14px; font-weight: 600; text-align: right; padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">${formatCurrencySimple(subtotal)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">TPS (5%)</td>
                        <td style="color: #0f172a; font-size: 14px; font-weight: 500; text-align: right; padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">${formatCurrencySimple(tpsAmount)}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 14px 20px;">TVQ (9.975%)</td>
                        <td style="color: #0f172a; font-size: 14px; font-weight: 500; text-align: right; padding: 14px 20px;">${formatCurrencySimple(tvqAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <!-- Total Row - Premium Style -->
                  <div style="background: linear-gradient(135deg, #0c1929 0%, #1e3a5f 100%); padding: 20px 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td>
                          <p style="color: #94a3b8; font-size: 13px; font-weight: 500; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Total mensuel</p>
                          <p style="color: #ffffff; font-size: 11px; margin: 0;">Taxes incluses</p>
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                          <span style="color: #22d3ee; font-size: 28px; font-weight: 800; letter-spacing: -0.02em;">${formatCurrencySimple(totalWithTax)}</span>
                          <span style="color: #94a3b8; font-size: 14px; font-weight: 500;">/mois</span>
                        </td>
                      </tr>
                    </table>
                  </div>
                </div>
              </div>

              ${oneTimeFeesHtml}

              ${firstMonthFreeHtml}

              ${deliveryHtml}

              <!-- CTA Button -->
              <div style="margin-top: 40px; text-align: center;">
                <a href="${portalLink}" class="button" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 10px; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.35); transition: all 0.2s ease;">
                  Accéder à mon portail client →
                </a>
              </div>

              <!-- Help Section -->
              <div style="margin-top: 40px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 12px; padding: 24px; text-align: center;">
                <p style="color: #0369a1; font-size: 15px; font-weight: 600; margin: 0 0 8px 0;">Besoin d'aide?</p>
                <p style="color: #0284c7; font-size: 14px; margin: 0 0 16px 0;">Notre équipe est disponible pour vous assister</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="text-align: center; padding: 8px;">
                      <a href="tel:+1${supportPhone.replace(/[^0-9]/g, "")}" style="display: inline-block; background-color: #ffffff; color: #0284c7; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 8px; border: 1px solid #7dd3fc;">
                        📞 ${supportPhone}
                      </a>
                    </td>
                    <td style="text-align: center; padding: 8px;">
                      <a href="mailto:${supportEmail}" style="display: inline-block; background-color: #ffffff; color: #0284c7; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 8px; border: 1px solid #7dd3fc;">
                        ✉️ ${supportEmail}
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 32px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="text-align: center; padding-bottom: 24px;">
                    <h4 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">Nivra</h4>
                    <p style="color: #22d3ee; font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0 0;">Télécommunications</p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-bottom: 20px;">
                    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0;">
                      Fournisseur de services de télécommunications prépayés au Québec.<br>
                      Simple, rapide, sans engagement.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-bottom: 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="https://nivra-telecom.ca" style="color: #64748b; font-size: 12px; text-decoration: none;">Site web</a>
                        </td>
                        <td style="color: #475569; padding: 0 8px;">|</td>
                        <td style="padding: 0 8px;">
                          <a href="https://nivra-telecom.ca/privacy" style="color: #64748b; font-size: 12px; text-decoration: none;">Confidentialité</a>
                        </td>
                        <td style="color: #475569; padding: 0 8px;">|</td>
                        <td style="padding: 0 8px;">
                          <a href="https://nivra-telecom.ca/terms" style="color: #64748b; font-size: 12px; text-decoration: none;">Conditions</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #1e293b; padding-top: 20px; text-align: center;">
                    <p style="color: #64748b; font-size: 11px; line-height: 1.6; margin: 0;">
                      © ${new Date().getFullYear()} Nivra Télécom Inc. Tous droits réservés.<br>
                      Cet email a été envoyé suite à votre commande sur nivra-telecom.ca<br>
                      <span style="color: #475569;">NEQ: 1234567890</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End Main Container -->

      </td>
    </tr>
  </table>
  <!-- End Wrapper -->

</body>
</html>
  `.trim();
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
    if (latestInvoice?.id) {
      const { data } = await supabase
        .from("billing_payments")
        .select("provider_payment_id, reference, method, amount")
        .eq("invoice_id", latestInvoice.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      latestPayment = data;
    }

    const phoneForSms = client_phone || orderData?.client_phone;
    const clientIdForSms = client_id || orderData?.user_id;

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

    console.log(`[${requestId}] Queueing email via email_queue...`);

    const eventKeyBase = `order_confirmation_${order_id}`;
    const eventKey = force
      ? `manual_order_confirmation_${order_id}_${Date.now()}`
      : eventKeyBase;

    const serviceType = services && services.length > 0
      ? services.map((s) => s.name).join(", ")
      : "Service Nivra";

    const queuePayload = {
      event_key: eventKey,
      to_email: client_email,
      template_key: "order_submitted",
      template_vars: {
        manual_send: force,
        client_name: client_first_name || "Client",
        client_email,
        client_phone: client_phone || orderData?.client_phone || profilePhone || "",
        client_address: delivery_address
          ? `${delivery_address.street}, ${delivery_address.city}, ${delivery_address.province} ${delivery_address.postalCode}`
          : profileAddress || "",
        order_id,
        order_number,
        invoice_id: latestInvoice?.id || null,
        invoice_number: latestInvoice?.invoice_number || null,
        service_type: serviceType,
        total_amount: canonicalAmountPaidToday,
        subtotal: canonicalSubtotal,
        tps_amount: canonicalTps,
        tvq_amount: canonicalTvq,
        taxes_total: toNum(canonicalTps + canonicalTvq),
        one_time_total: canonicalOneTime,
        one_time_charges: canonicalOneTime,
        monthly_recurring_amount: canonicalRecurring,
        discount_amount: canonicalDiscount,
        total_payable: canonicalTotalPayable,
        amount_paid_today: canonicalAmountPaidToday,
        amount_paid_total: canonicalAmountPaidTotal,
        amount_due_today: canonicalBalanceDue,
        balance_due: canonicalBalanceDue,
        delivery_method: getDeliveryMethodLabel(delivery_method),
        delivery_address: delivery_address
          ? `${delivery_address.street}, ${delivery_address.city}, ${delivery_address.province} ${delivery_address.postalCode}`
          : null,
        payment_reference: payment_reference || latestPayment?.provider_payment_id || latestPayment?.reference || orderData?.payment_reference || null,
        payment_method: payment_method || latestPayment?.method || orderData?.payment_method || null,
        portal_path: `/portal/orders/${order_id}`,
        // PDF attachment data
        account_number: accountNumber,
        services: services || [],
      },
      status: "queued",
      attempts: 0,
      max_attempts: 3,
    };

    const { data: queuedEmail, error: queueInsertError } = await supabase
      .from("email_queue")
      .insert(queuePayload)
      .select("id")
      .maybeSingle();

    let queuedEmailId = queuedEmail?.id ?? null;

    if (queueInsertError && queueInsertError.code !== "PGRST116") {
      console.error(`[${requestId}] Failed to queue email:`, queueInsertError);
      logResult("error", {
        order_id,
        order_number,
        to_email: maskEmail(client_email),
        error: queueInsertError.message,
      });
      return new Response(JSON.stringify({
        success: false,
        status: "error",
        error: "Failed to queue email",
        details: queueInsertError.message,
        request_id: requestId,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!queuedEmailId) {
      const { data: existingQueuedEmail, error: lookupError } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", eventKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError || !existingQueuedEmail?.id) {
        const details = lookupError?.message || "No queued email row returned after insert";
        console.error(`[${requestId}] Failed to resolve queued email ID:`, lookupError || details);
        logResult("error", {
          order_id,
          order_number,
          to_email: maskEmail(client_email),
          error: details,
        });
        return new Response(JSON.stringify({
          success: false,
          status: "error",
          error: "Failed to resolve queued email",
          details,
          request_id: requestId,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      queuedEmailId = existingQueuedEmail.id;
    }

    console.log(`[${requestId}] ✅ Email queued successfully: ${queuedEmailId}`);

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
      method: "email_queue",
      email_queue_id: queuedEmailId,
      forced: force,
    });

    // Send SMS notification
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
      email_queue_id: queuedEmailId,
      order_number,
      method: "email_queue",
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
