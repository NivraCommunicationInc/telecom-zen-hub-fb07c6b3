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
// EMAIL HTML TEMPLATE — Uses shared corporate template
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
    supportEmail,
    promoCode,
  } = params;

  const hasFirstMonthFree = isFirstMonthFreePromo(promoCode);

  // === Services table rows ===
  const servicesHtml = services.map((service) => 
    infoRow(escapeHtml(service.name), `${formatCurrencySimple(service.price)}/${service.period || "mois"}`)
  ).join("");

  // === One-time fees rows ===
  let oneTimeFeesHtml = "";
  if (oneTimeFees && oneTimeFees.length > 0) {
    const feesRows = oneTimeFees.map((fee) =>
      infoRow(escapeHtml(fee.label), formatCurrencySimple(fee.amount))
    ).join("");

    // Calculate equipment taxes
    const equipTotal = oneTimeTotal || oneTimeFees.reduce((sum, f) => sum + f.amount, 0);
    const equipTps = Math.round(equipTotal * 0.05 * 100) / 100;
    const equipTvq = Math.round(equipTotal * 0.09975 * 100) / 100;
    const equipGrandTotal = Math.round((equipTotal + equipTps + equipTvq) * 100) / 100;

    oneTimeFeesHtml = `
      ${sectionHeader('Frais uniques (équipement)', 'warning')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 8px; padding: 4px 20px; margin-bottom: 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${feesRows}
            ${infoRow('TPS (5%)', formatCurrencySimple(equipTps))}
            ${infoRow('TVQ (9.975%)', formatCurrencySimple(equipTvq))}
          </tbody>
        </table>
      </div>
      ${amountBox('Total équipement', formatCurrencySimple(equipGrandTotal), 'Taxes incluses')}
    `;
  }

  // === Delivery section ===
  let deliveryHtml = "";
  if (deliveryMethod || deliveryAddress) {
    const deliveryRows = [
      deliveryMethod ? infoRow('Méthode', escapeHtml(deliveryMethod)) : '',
      deliveryAddress ? infoRow('Adresse', `${escapeHtml(deliveryAddress.street)}, ${escapeHtml(deliveryAddress.city)}, ${escapeHtml(deliveryAddress.province)} ${escapeHtml(deliveryAddress.postalCode)}`) : '',
    ].filter(Boolean).join("");

    deliveryHtml = `
      ${sectionHeader('Livraison & Installation', 'purple')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 8px; padding: 4px 20px; margin-bottom: 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>${deliveryRows}</tbody>
        </table>
      </div>
    `;
  }

  // === Payment info ===
  let paymentInfoHtml = "";
  if (paymentReference || paymentMethod) {
    const payRows = [
      paymentReference ? infoRow('Réf. paiement', escapeHtml(paymentReference)) : '',
      paymentMethod ? infoRow('Méthode de paiement', escapeHtml(paymentMethod)) : '',
    ].filter(Boolean).join("");
    paymentInfoHtml = `
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 8px; padding: 4px 20px; margin-bottom: 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>${payRows}</tbody>
        </table>
      </div>
    `;
  }

  // === Pricing section — correct math ===
  // Service subtotal = sum of service prices
  const serviceSubtotal = services.reduce((sum, s) => sum + (s.price || 0), 0);
  // Correct taxes on services only
  const serviceTps = Math.round(serviceSubtotal * 0.05 * 100) / 100;
  const serviceTvq = Math.round(serviceSubtotal * 0.09975 * 100) / 100;
  const serviceTotalWithTax = Math.round((serviceSubtotal + serviceTps + serviceTvq) * 100) / 100;

  // === First month free section ===
  let firstMonthFreeHtml = "";
  let pricingSummaryHtml = "";

  if (hasFirstMonthFree) {
    // Equipment total with taxes
    const equipTotal = oneTimeTotal || (oneTimeFees || []).reduce((sum, f) => sum + f.amount, 0);
    const equipTps = Math.round(equipTotal * 0.05 * 100) / 100;
    const equipTvq = Math.round(equipTotal * 0.09975 * 100) / 100;
    const equipGrandTotal = Math.round((equipTotal + equipTps + equipTvq) * 100) / 100;

    firstMonthFreeHtml = `
      ${alertBox('success', '🎁', 'Premier mois gratuit', `Votre code ${promoCode} vous offre le premier mois de service entièrement gratuit!`)}
    `;

    pricingSummaryHtml = `
      ${sectionHeader('Récapitulatif mensuel', 'success')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 8px; padding: 4px 20px; margin-bottom: 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Service mensuel', formatCurrencySimple(serviceSubtotal))}
            <tr>
              <td style="color: ${colors.success}; font-size: 14px; font-weight: 600; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">Rabais premier mois (${escapeHtml(promoCode!)})</td>
              <td style="color: ${colors.success}; font-size: 14px; font-weight: 600; text-align: right; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">-${formatCurrencySimple(serviceSubtotal)}</td>
            </tr>
            ${infoRow('Sous-total service (1er mois)', '0,00$')}
          </tbody>
        </table>
      </div>

      ${amountBox('Total payé aujourd\'hui', formatCurrencySimple(equipGrandTotal > 0 ? equipGrandTotal : 0), 'Équipement uniquement — service gratuit le 1er mois')}

      <div style="margin-top: 16px; background-color: ${colors.successBg}; border: 1px solid ${colors.successBorder}; border-radius: 8px; padding: 16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="color: ${colors.successText}; font-size: 14px; font-weight: 600;">Premier mois de service</td>
            <td style="color: ${colors.success}; font-size: 16px; font-weight: 700; text-align: right;">GRATUIT</td>
          </tr>
          <tr>
            <td style="color: ${colors.textMuted}; font-size: 13px; padding-top: 8px;">À partir du 2e mois</td>
            <td style="color: ${colors.textPrimary}; font-size: 14px; font-weight: 600; text-align: right; padding-top: 8px;">${formatCurrencySimple(serviceTotalWithTax)}/mois</td>
          </tr>
        </table>
      </div>
    `;
  } else {
    pricingSummaryHtml = `
      ${sectionHeader('Récapitulatif mensuel', 'primary')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 8px; padding: 4px 20px; margin-bottom: 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${infoRow('Sous-total', formatCurrencySimple(serviceSubtotal))}
            ${infoRow('TPS (5%)', formatCurrencySimple(serviceTps))}
            ${infoRow('TVQ (9.975%)', formatCurrencySimple(serviceTvq))}
          </tbody>
        </table>
      </div>
      ${amountBox('Total mensuel', `${formatCurrencySimple(serviceTotalWithTax)}/mois`, 'Taxes incluses')}
    `;
  }

  // === Build full email using corporate template ===
  const preheader = hasFirstMonthFree
    ? `🎉 Bienvenue chez Nivra! Premier mois gratuit. Commande #${orderNumber} confirmée.`
    : `Merci ${clientFirstName}! Commande #${orderNumber} confirmée. Total: ${formatCurrencySimple(serviceTotalWithTax)}/mois`;

  const bodyContent = `
    ${header()}
    ${statusBanner('success', '✓', 'Commande confirmée!', `Merci pour votre confiance, ${escapeHtml(clientFirstName)}`)}
    ${contentWrapper(`
      <!-- Order details -->
      ${infoRow('Commande', '#' + escapeHtml(orderNumber))}
      ${infoRow('Date', formatDate(orderDate))}
      ${paymentInfoHtml}

      ${firstMonthFreeHtml}

      <!-- Services -->
      ${sectionHeader('Vos services', 'primary')}
      <div style="background-color: ${colors.bgSection}; border: 1px solid ${colors.borderLight}; border-radius: 8px; padding: 4px 20px; margin-bottom: 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tbody>
            ${servicesHtml}
          </tbody>
        </table>
      </div>

      <!-- Pricing -->
      ${pricingSummaryHtml}

      <!-- One-time fees -->
      ${oneTimeFeesHtml}

      <!-- Delivery -->
      ${deliveryHtml}

      <!-- CTA -->
      <div style="text-align: center; margin-top: 32px;">
        ${button('Accéder à mon portail client →', portalLink, 'primary')}
      </div>

      <!-- Help -->
      ${helpSection(supportEmail)}
    `)}
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
      supportPhone: Deno.env.get("SUPPORT_PHONE") || "",
      supportEmail: Deno.env.get("SUPPORT_EMAIL") || "support@nivra-telecom.ca",
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
