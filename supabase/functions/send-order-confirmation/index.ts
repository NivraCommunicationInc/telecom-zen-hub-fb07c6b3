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
  portalLink: string;
  supportEmail: string;
  promoCode?: string;
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
    services,
    oneTimeFees,
    oneTimeTotal,
    deliveryAddress,
    portalLink,
    supportEmail,
    promoCode,
  } = params;

  const hasFirstMonthFree = isFirstMonthFreePromo(promoCode);

  // === Calculate service pricing ===
  const serviceSubtotal = services.reduce((sum, s) => sum + (s.price || 0), 0);
  const serviceTps = Math.round(serviceSubtotal * 0.05 * 100) / 100;
  const serviceTvq = Math.round(serviceSubtotal * 0.09975 * 100) / 100;
  const serviceTotalWithTax = Math.round((serviceSubtotal + serviceTps + serviceTvq) * 100) / 100;

  // === Calculate equipment pricing ===
  const equipTotal = oneTimeTotal || (oneTimeFees || []).reduce((sum, f) => sum + f.amount, 0);
  const equipTps = Math.round(equipTotal * 0.05 * 100) / 100;
  const equipTvq = Math.round(equipTotal * 0.09975 * 100) / 100;
  const equipGrandTotal = Math.round((equipTotal + equipTps + equipTvq) * 100) / 100;

  // === Service line ===
  const serviceName = services.length > 0 ? services[0].name : 'Internet';
  const servicePrice = services.length > 0 ? services[0].price : 0;

  // === Delivery address ===
  const fullAddress = deliveryAddress
    ? `${escapeHtml(deliveryAddress.street)}, ${escapeHtml(deliveryAddress.city)}, ${escapeHtml(deliveryAddress.province)} ${escapeHtml(deliveryAddress.postalCode)}`
    : '';

  // === First month free section ===
  const firstMonthSection = hasFirstMonthFree ? `
    <tr><td style="padding:0 40px 24px;">
      <div style="background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:24px 28px;">
        <p style="margin:0 0 4px;font-size:14px;color:#059669;">🎁</p>
        <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#065F46;">Votre premier mois offert</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#333333;">
          En tant que nouveau client Nivra Telecom, votre premier mois de service est entièrement gratuit. 
          Aucun montant ne sera débité pour votre service Internet durant les 30 prochains jours. 
          Votre facturation régulière débutera automatiquement à votre deuxième mois.
        </p>
      </div>
    </td></tr>
  ` : '';

  // === Financial summary ===
  let financialSummary = '';
  if (hasFirstMonthFree) {
    financialSummary = `
      <tr><td style="padding:0 40px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${sLabel('Résumé de votre commande')}</tr></table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          ${finRow('Forfait mensuel', formatCurrencySimple(servicePrice))}
          <tr>
            <td style="color:#059669;font-size:14px;line-height:1.7;padding:8px 0;border-bottom:1px solid #EEEEEE;font-family:'Courier New',Courier,monospace;">Premier mois offert</td>
            <td style="color:#059669;font-size:14px;font-weight:700;text-align:right;padding:8px 0;border-bottom:1px solid #EEEEEE;font-family:'Courier New',Courier,monospace;">-${formatCurrencySimple(servicePrice)}</td>
          </tr>
          ${dividerLine}
          ${finRow('Service ce mois-ci', '0,00 $', { bold: true })}
        </table>

        ${equipTotal > 0 ? `
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${sLabel('Équipement (frais uniques)')}</tr></table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
            ${(oneTimeFees || []).map(f => finRow(f.label, formatCurrencySimple(f.amount))).join('')}
            ${finRow('TPS (5%)', formatCurrencySimple(equipTps))}
            ${finRow('TVQ (9,975%)', formatCurrencySimple(equipTvq))}
            ${dividerLine}
          </table>
        ` : ''}

        <div style="background-color:#E6F0FA;border:2px solid #0066CC;border-radius:8px;padding:20px 24px;margin-bottom:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
            <tr>
              <td style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#666666;font-weight:600;">Total payé aujourd'hui</td>
              <td style="text-align:right;"><span style="font-size:24px;font-weight:700;color:#0066CC;">${formatCurrencySimple(equipGrandTotal)}</span></td>
            </tr>
          </table>
        </div>

        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:16px;">
          <tr>
            <td style="color:#059669;font-size:14px;font-weight:600;padding:8px 0;">Premier mois de service</td>
            <td style="color:#059669;font-size:16px;font-weight:700;text-align:right;padding:8px 0;">GRATUIT</td>
          </tr>
          <tr>
            <td style="color:#666666;font-size:13px;padding:4px 0;">À partir du 2e mois</td>
            <td style="color:#333333;font-size:14px;font-weight:600;text-align:right;padding:4px 0;">${formatCurrencySimple(serviceSubtotal)}/mois</td>
          </tr>
          <tr>
            <td></td>
            <td style="color:#666666;font-size:12px;text-align:right;padding:2px 0;">(taxes incluses: ${formatCurrencySimple(serviceTotalWithTax)}$/mois)</td>
          </tr>
        </table>
      </td></tr>
    `;
  } else {
    financialSummary = `
      <tr><td style="padding:0 40px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${sLabel('Résumé de votre commande')}</tr></table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          ${finRow('Forfait mensuel', formatCurrencySimple(serviceSubtotal))}
          ${finRow('TPS (5%)', formatCurrencySimple(serviceTps))}
          ${finRow('TVQ (9,975%)', formatCurrencySimple(serviceTvq))}
          ${dividerLine}
          ${finRow('Total mensuel', `${formatCurrencySimple(serviceTotalWithTax)}/mois`, { bold: true, color: '#0066CC', size: '16px' })}
        </table>

        ${equipTotal > 0 ? `
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${sLabel('Équipement (frais uniques)')}</tr></table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
            ${(oneTimeFees || []).map(f => finRow(f.label, formatCurrencySimple(f.amount))).join('')}
            ${finRow('TPS (5%)', formatCurrencySimple(equipTps))}
            ${finRow('TVQ (9,975%)', formatCurrencySimple(equipTvq))}
            ${dividerLine}
          </table>

          <div style="background-color:#E6F0FA;border:2px solid #0066CC;border-radius:8px;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#666666;font-weight:600;">Total payé aujourd'hui</td>
                <td style="text-align:right;"><span style="font-size:24px;font-weight:700;color:#0066CC;">${formatCurrencySimple(Math.round((serviceSubtotal + equipTotal + serviceTps + serviceTvq + equipTps + equipTvq) * 100) / 100)}</span></td>
              </tr>
            </table>
          </div>
        ` : ''}
      </td></tr>
    `;
  }

  // === Equipment shipping section ===
  const equipmentSection = (oneTimeFees && oneTimeFees.length > 0) ? `
    <tr><td style="padding:0 40px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${sLabel('📦 Votre équipement en route')}</tr></table>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#333333;">
        Votre équipement Nivra sera expédié à votre adresse dans les 24 à 48 heures ouvrables. 
        Un courriel de suivi avec votre numéro de colis vous sera envoyé dès l'expédition.
      </p>
      ${fullAddress ? `
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#666666;font-weight:600;">Adresse de livraison</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#333333;">${fullAddress}</p>
      ` : ''}
    </td></tr>
  ` : '';

  // === Info section ===
  const infoSection = `
    <tr><td style="padding:0 40px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${sLabel('ℹ️ Ce que vous devez savoir')}</tr></table>
      
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#333333;">Annulation sans frais</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#333333;">
        Vous pouvez annuler votre service à tout moment depuis votre espace client. 
        L'annulation prend effet à la fin de votre cycle de facturation en cours.
      </p>

      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#333333;">Garantie équipement</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#333333;">
        Si vous n'êtes pas entièrement satisfait, retournez votre équipement dans les 30 jours 
        suivant la livraison pour un remboursement complet des frais d'équipement.
      </p>
    </td></tr>
  `;

  // === Support section ===
  const supportSection = `
    <tr><td style="padding:0 40px 32px;">
      <div style="background-color:#F3F4F6;border-radius:8px;padding:24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1A1A1A;">Une question? Notre équipe est là.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td>
              <a href="mailto:${supportEmail}" style="display:inline-block;padding:10px 24px;background-color:#0066CC;color:#FFFFFF;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px;">
                ✉️&nbsp;${supportEmail}
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-size:12px;color:#6B7280;">Disponible 7 jours sur 7, de 8 h à 20 h (HE)</p>
      </div>
    </td></tr>
  `;

  // === Preheader ===
  const preheader = hasFirstMonthFree
    ? `Bienvenue chez Nivra! Votre premier mois de service Internet est offert gratuitement.`
    : `Merci ${clientFirstName}! Commande #${orderNumber} confirmée. Total: ${formatCurrencySimple(serviceTotalWithTax)}/mois`;

  // === Welcome text ===
  const welcomeText = hasFirstMonthFree
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#333333;">
        Votre premier mois de service Internet est offert gratuitement, en guise de bienvenue dans la famille Nivra Telecom.
      </p>`
    : '';

  // === Service plan ===
  const planSection = `
    <tr><td style="padding:0 40px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${sLabel('Votre forfait')}</tr></table>
      <p style="margin:0;font-size:16px;font-weight:600;color:#1A1A1A;">
        ${services.map(s => `${escapeHtml(s.name)} — ${formatCurrencySimple(s.price)}$/mois`).join('<br>')}
      </p>
    </td></tr>
  `;

  // === Build full email ===
  const bodyContent = `
    ${header()}
    <!-- Confirmation banner -->
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0 0 8px;font-size:28px;color:#059669;">✓</p>
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A1A1A;">Commande confirmée</h2>
        <p style="margin:0 0 4px;font-size:16px;line-height:1.7;color:#333333;">
          Bienvenue chez Nivra Telecom, ${escapeHtml(clientFirstName)}.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4A4A4A;">
          Votre service sera activé sous 24 à 48 heures suivant la réception de votre équipement.
        </p>
        ${welcomeText}
      </td>
    </tr>

    <!-- Order ref -->
    <tr><td style="padding:16px 40px 24px;">
      <p style="margin:0;font-size:12px;color:#6B7280;">Commande #${escapeHtml(orderNumber)} · ${formatDate(orderDate)}</p>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #EEEEEE;margin:0;"></td></tr>

    <!-- First month free -->
    ${firstMonthSection}

    <!-- Plan -->
    ${planSection}

    <!-- Financial summary -->
    ${financialSummary}

    <!-- Divider -->
    <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #EEEEEE;margin:0 0 24px;"></td></tr>

    <!-- Equipment -->
    ${equipmentSection}

    <!-- Info -->
    ${infoSection}

    <!-- CTA -->
    <tr><td style="padding:0 40px 24px;text-align:center;">
      ${button('Accéder à mon espace client →', portalLink, 'primary')}
    </td></tr>

    <!-- Support -->
    ${supportSection}

    <!-- Footer -->
    ${footer(supportEmail)}
  `;

  return emailDocument(
    `Confirmation de commande #${escapeHtml(orderNumber)} | Nivra Telecom`,
    preheader,
    bodyContent
  );
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
      ? `🎉 Bienvenue chez Nivra Telecom — Votre premier mois est gratuit! (Commande #${order_number})`
      : `Confirmation de commande #${order_number} | Nivra Telecom`;

    // Generate full HTML email
    const htmlBody = generateOrderConfirmationHtml({
      clientFirstName: client_first_name || "Client",
      orderNumber: order_number,
      orderDate,
      paymentReference: effectivePaymentRef || undefined,
      paymentMethod: effectivePaymentMethod || undefined,
      services: services || [],
      subtotal: canonicalSubtotal,
      tpsAmount: canonicalTps,
      tvqAmount: canonicalTvq,
      totalWithTax: canonicalTotalPayable,
      oneTimeFees: one_time_fees,
      oneTimeTotal: canonicalOneTime,
      deliveryMethod: delivery_method ? getDeliveryMethodLabel(delivery_method) : undefined,
      deliveryAddress: delivery_address,
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
