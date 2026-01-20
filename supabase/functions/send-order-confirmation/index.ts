import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
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
  monthly_total_tax_in: number;
  one_time_fees?: OneTimeFee[];
  one_time_total: number;
  delivery_method?: string;
  delivery_address?: DeliveryAddress;
  payment_reference?: string;
  payment_method?: string;
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
  } = params;

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
    Merci ${escapeHtml(clientFirstName)}! Votre commande #${escapeHtml(orderNumber)} est confirmée. Total mensuel: ${formatCurrencySimple(totalWithTax)} &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
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
                          <a href="https://nivratelecom.ca" style="color: #64748b; font-size: 12px; text-decoration: none;">Site web</a>
                        </td>
                        <td style="color: #475569; padding: 0 8px;">|</td>
                        <td style="padding: 0 8px;">
                          <a href="https://nivratelecom.ca/privacy" style="color: #64748b; font-size: 12px; text-decoration: none;">Confidentialité</a>
                        </td>
                        <td style="color: #475569; padding: 0 8px;">|</td>
                        <td style="padding: 0 8px;">
                          <a href="https://nivratelecom.ca/terms" style="color: #64748b; font-size: 12px; text-decoration: none;">Conditions</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #1e293b; padding-top: 20px; text-align: center;">
                    <p style="color: #64748b; font-size: 11px; line-height: 1.6; margin: 0;">
                      © ${new Date().getFullYear()} Nivra Télécom Inc. Tous droits réservés.<br>
                      Cet email a été envoyé suite à votre commande sur nivratelecom.ca<br>
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
      .select("confirmation_email_sent_at, client_phone, user_id, created_at")
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

    // Calculate taxes if not provided
    const taxes = calculateTaxes(monthly_total_tax_in);
    const finalSubtotal = providedSubtotal ?? taxes.subtotal;
    const finalTps = providedTps ?? taxes.tps;
    const finalTvq = providedTvq ?? taxes.tvq;

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivratelecom.ca";

    console.log(`[${requestId}] Generating HTML email...`);

    const html = generateOrderConfirmationHtml({
      clientFirstName: client_first_name || "Client",
      orderNumber: order_number,
      orderDate: order_date || orderData?.created_at || new Date().toISOString(),
      paymentReference: payment_reference,
      paymentMethod: payment_method,
      services: services || [],
      subtotal: finalSubtotal,
      tpsAmount: finalTps,
      tvqAmount: finalTvq,
      totalWithTax: monthly_total_tax_in,
      oneTimeFees: one_time_fees,
      oneTimeTotal: one_time_total,
      deliveryMethod: getDeliveryMethodLabel(delivery_method),
      deliveryAddress: delivery_address,
      portalLink: `${siteBaseUrl}/portal/orders/${order_id}`,
      supportPhone: "438-544-2233",
      supportEmail: "support@nivratelecom.ca",
    });

    console.log(`[${requestId}] Sending email via Resend...`);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Nivra Télécom <Support@nivratelecom.ca>",
      replyTo: "support@nivratelecom.ca",
      to: [client_email],
      subject: `Confirmation de commande #${order_number} — Nivra Télécom`,
      html,
    });

    if (emailError) {
      console.error(`[${requestId}] Resend error:`, emailError);
      
      await supabase.from("email_queue").insert({
        event_key: `order_confirmation_${order_id}`,
        template_key: "order_confirmation",
        to_email: client_email,
        status: "failed",
        last_error: emailError.message || JSON.stringify(emailError),
      });

      logResult("error", {
        order_id,
        order_number,
        to_email: maskEmail(client_email),
        error: emailError.message,
      });

      return new Response(JSON.stringify({
        success: false,
        status: "error",
        error: "Email sending failed",
        details: emailError.message,
        request_id: requestId,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] ✅ Email sent successfully`);
    console.log(`[${requestId}] resend_message_id=${emailData?.id}`);

    const { error: updateError } = await supabase
      .from("orders")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", order_id);

    if (updateError) {
      console.warn(`[${requestId}] Failed to update confirmation_email_sent_at:`, updateError);
    }

    await supabase.from("email_queue").insert({
      event_key: `order_confirmation_${order_id}`,
      template_key: "order_confirmation",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailData?.id || null,
    });

    logResult("sent", {
      order_id,
      order_number,
      to_email: maskEmail(client_email),
      method: "html_template_v2",
      resend_message_id: emailData?.id,
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
        eventKey: `order_confirmation_${order_id}`,
      });
      console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
    }

    console.log(`[${requestId}] ========================================`);

    return new Response(JSON.stringify({
      success: true,
      status: "sent",
      message_id: emailData?.id,
      order_number,
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
