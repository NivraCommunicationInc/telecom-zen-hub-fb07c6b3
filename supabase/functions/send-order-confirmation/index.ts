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

  // Generate services HTML
  const servicesHtml = services.map((service) => `
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
      <p style="color: #111827; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">${escapeHtml(service.name)}</p>
      ${service.details ? `<p style="color: #6b7280; font-size: 13px; margin: 0 0 8px 0;">${escapeHtml(service.details)}</p>` : ""}
      ${service.description ? `<p style="color: #6b7280; font-size: 13px; margin: 0 0 8px 0;">${escapeHtml(service.description)}</p>` : ""}
      <p style="color: #059669; font-size: 16px; font-weight: 700; margin: 0;">
        ${formatCurrency(service.price)}/${service.period || "mois"}
      </p>
    </div>
  `).join("");

  // Generate one-time fees HTML
  let oneTimeFeesHtml = "";
  if (oneTimeFees && oneTimeFees.length > 0) {
    const feesRows = oneTimeFees.map((fee) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">${escapeHtml(fee.label)}</td>
        <td style="color: #111827; font-size: 14px; text-align: right; padding: 8px 0;">${formatCurrency(fee.amount)}</td>
      </tr>
    `).join("");

    oneTimeFeesHtml = `
      <p style="color: #0a1628; font-size: 16px; font-weight: 600; margin: 24px 0 16px 0; padding: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
        Frais uniques
      </p>
      <table style="width: 100%; margin-top: 16px;">
        <tbody>
          ${feesRows}
          ${oneTimeTotal !== undefined ? `
            <tr>
              <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 8px 0;">Total frais uniques</td>
              <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; padding: 8px 0;">${formatCurrency(oneTimeTotal)}</td>
            </tr>
          ` : ""}
        </tbody>
      </table>
    `;
  }

  // Generate delivery section HTML
  let deliveryHtml = "";
  if (deliveryMethod || deliveryAddress) {
    deliveryHtml = `
      <hr style="border-color: #e5e7eb; margin: 32px 0;" />
      <h2 style="color: #0a1628; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; padding: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
        🚚 Livraison / Installation
      </h2>
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        ${deliveryMethod ? `<p style="color: #374151; font-size: 15px; line-height: 24px; margin: 0 0 8px 0;"><strong>Méthode:</strong> ${escapeHtml(deliveryMethod)}</p>` : ""}
        ${deliveryAddress ? `
          <p style="color: #374151; font-size: 15px; line-height: 24px; margin: 0;">
            <strong>Adresse:</strong><br />
            ${escapeHtml(deliveryAddress.street)}<br />
            ${escapeHtml(deliveryAddress.city)}, ${escapeHtml(deliveryAddress.province)} ${escapeHtml(deliveryAddress.postalCode)}
          </p>
        ` : ""}
      </div>
    `;
  }

  // Build payment info rows
  let paymentInfoRows = `
    <tr>
      <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Numéro de commande</td>
      <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">${escapeHtml(orderNumber)}</td>
    </tr>
    <tr>
      <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Date de commande</td>
      <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">${formatDate(orderDate)}</td>
    </tr>
  `;
  
  if (paymentReference) {
    paymentInfoRows += `
      <tr>
        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Référence de paiement</td>
        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">${escapeHtml(paymentReference)}</td>
      </tr>
    `;
  }
  
  if (paymentMethod) {
    paymentInfoRows += `
      <tr>
        <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Mode de paiement</td>
        <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">${escapeHtml(paymentMethod)}</td>
      </tr>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de commande #${escapeHtml(orderNumber)}</title>
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; margin: 0; padding: 40px 20px;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 0; max-width: 600px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background-color: #0a1628; padding: 32px 40px; text-align: center;">
      <p style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">Nivra</p>
      <p style="color: #10b981; font-size: 14px; font-weight: 500; margin: 4px 0 0 0; letter-spacing: 2px; text-transform: uppercase;">Télécom</p>
    </div>

    <!-- Main Content -->
    <div style="padding: 40px;">
      
      <!-- Success Badge -->
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="background-color: #d1fae5; color: #047857; font-size: 14px; font-weight: 600; padding: 8px 16px; border-radius: 20px; display: inline-block;">✓ Commande confirmée</span>
      </div>

      <h1 style="color: #0a1628; font-size: 24px; font-weight: 700; margin: 0 0 8px 0; padding: 0; text-align: center;">
        Merci pour votre commande, ${escapeHtml(clientFirstName)}!
      </h1>
      
      <p style="color: #374151; font-size: 15px; line-height: 24px; margin: 0 0 24px 0; text-align: center;">
        Votre commande a été reçue et est en cours de traitement. Vous trouverez ci-dessous tous les détails.
      </p>

      <!-- Order Info Box -->
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%;">
          ${paymentInfoRows}
        </table>
      </div>

      <hr style="border-color: #e5e7eb; margin: 32px 0;" />

      <!-- Services Section -->
      <h2 style="color: #0a1628; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; padding: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
        📦 Vos services
      </h2>

      ${servicesHtml}

      <hr style="border-color: #e5e7eb; margin: 32px 0;" />

      <!-- Pricing Breakdown -->
      <h2 style="color: #0a1628; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; padding: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
        💳 Récapitulatif des frais mensuels
      </h2>

      <table style="width: 100%; margin-top: 16px;">
        <tbody>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Sous-total</td>
            <td style="color: #111827; font-size: 14px; text-align: right; padding: 8px 0;">${formatCurrency(subtotal)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">TPS (5%)</td>
            <td style="color: #111827; font-size: 14px; text-align: right; padding: 8px 0;">${formatCurrency(tpsAmount)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">TVQ (9.975%)</td>
            <td style="color: #111827; font-size: 14px; text-align: right; padding: 8px 0;">${formatCurrency(tvqAmount)}</td>
          </tr>
        </tbody>
      </table>

      <table style="width: 100%;">
        <tbody>
          <tr style="background-color: #0a1628; border-radius: 8px;">
            <td style="color: #ffffff; font-size: 16px; font-weight: 600; padding: 16px; border-radius: 8px 0 0 8px;">Total mensuel</td>
            <td style="color: #10b981; font-size: 20px; font-weight: 700; text-align: right; padding: 16px; border-radius: 0 8px 8px 0;">${formatCurrency(totalWithTax)}</td>
          </tr>
        </tbody>
      </table>

      ${oneTimeFeesHtml}

      ${deliveryHtml}

      <!-- CTA Button -->
      <a href="${portalLink}" style="background-color: #10b981; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: block; padding: 16px 32px; margin-top: 32px;">
        Voir ma commande dans le portail
      </a>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 32px 40px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; line-height: 20px; margin: 0 0 8px 0;">
        Des questions? Contactez-nous!
      </p>
      <p style="color: #6b7280; font-size: 13px; line-height: 20px; margin: 0 0 16px 0;">
        📞 <a href="tel:+1${supportPhone.replace(/[^0-9]/g, "")}" style="color: #10b981; text-decoration: none;">${supportPhone}</a>
        · ✉️ <a href="mailto:${supportEmail}" style="color: #10b981; text-decoration: none;">${supportEmail}</a>
      </p>
      <hr style="border-color: #e5e7eb; margin: 16px 0;" />
      <p style="color: #6b7280; font-size: 11px; line-height: 20px; margin: 0 0 4px 0;">
        © ${new Date().getFullYear()} Nivra Télécom Inc. Tous droits réservés.
      </p>
      <p style="color: #6b7280; font-size: 11px; line-height: 20px; margin: 0;">
        Cet email a été envoyé à la suite de votre commande sur nivratelecom.ca
      </p>
    </div>
  </div>
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
