import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================
// EMAIL STYLING (matching existing templates)
// =============================================

const emailStyles = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  bgColor: "#f4f4f5",
  cardBg: "#ffffff",
  textPrimary: "#18181b",
  textSecondary: "#52525b",
  textMuted: "#71717a",
  accent: "#0d9488",
  accentLight: "#ccfbf1",
  success: "#059669",
  successBg: "#d1fae5",
  border: "#e4e4e7",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

// URL joining helper
const joinUrl = (baseUrl: string, path: string): string => {
  const base = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${base}/${cleanPath}`;
};

const wrapEmail = (content: string, ctaUrl?: string, ctaText?: string, supportEmail?: string, supportPhone?: string) => {
  const email = supportEmail || "Support@nivratelecom.ca";
  const phone = supportPhone || "438-544-2233";
  const phoneDigits = phone.replace(/[^0-9]/g, "");

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Nivra Telecom</title>
</head>
<body style="margin:0; padding:0; background-color:${emailStyles.bgColor}; font-family:${emailStyles.fontFamily};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${emailStyles.bgColor};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px; width:100%;">
          
          <!-- HEADER -->
          <tr>
            <td style="background-color:${emailStyles.cardBg}; border-radius:12px 12px 0 0; padding:0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="height:4px; background:linear-gradient(90deg, ${emailStyles.accent}, #14b8a6); border-radius:12px 12px 0 0;"></td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 20px;">
                    <h1 style="margin:0; font-size:26px; font-weight:700; color:${emailStyles.accent}; letter-spacing:-0.5px;">Nivra Telecom</h1>
                    <p style="margin:4px 0 0; font-size:13px; color:${emailStyles.textMuted};">Votre service, simplifié.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- MAIN CONTENT -->
          <tr>
            <td style="background-color:${emailStyles.cardBg}; padding:0 32px 32px;">
              ${content}
            </td>
          </tr>
          
          <!-- CTA BUTTON -->
          ${ctaUrl ? `
          <tr>
            <td style="background-color:${emailStyles.cardBg}; padding:0 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius:8px; background-color:${emailStyles.accent};">
                          <a href="${ctaUrl}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                            ${ctaText || "Ouvrir le portail"}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          
          <!-- FOOTER -->
          <tr>
            <td style="background-color:${emailStyles.cardBg}; border-radius:0 0 12px 12px; padding:24px 32px; border-top:1px solid ${emailStyles.border};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 6px; font-size:13px; font-weight:600; color:${emailStyles.textPrimary};">
                      Nivra Telecom
                    </p>
                    <p style="margin:0 0 6px; font-size:12px; color:${emailStyles.textMuted};">
                      Laval, QC, Canada
                    </p>
                    <p style="margin:0 0 12px; font-size:13px; color:${emailStyles.textSecondary};">
                      <a href="mailto:${email}" style="color:${emailStyles.accent}; text-decoration:none;">${email}</a> 
                      &nbsp;|&nbsp; 
                      <a href="tel:${phoneDigits}" style="color:${emailStyles.accent}; text-decoration:none;">${phone}</a>
                    </p>
                    <p style="margin:0; font-size:11px; color:${emailStyles.textMuted};">
                      Vous recevez cet email suite à une action sur votre compte Nivra Telecom.<br>
                      <em>You are receiving this email because of an action on your Nivra Telecom account.</em>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const statusBadge = (icon: string, titleFr: string, messageFr: string, messageEn: string) => {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
      <tr>
        <td style="background-color:${emailStyles.successBg}; border-left:4px solid ${emailStyles.success}; border-radius:0 8px 8px 0; padding:16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size:18px; font-weight:600; color:#065f46;">
                ${icon} ${titleFr}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px; color:#065f46; padding-top:6px;">
                ${messageFr}
              </td>
            </tr>
            <tr>
              <td style="font-size:13px; color:#065f46; opacity:0.8; padding-top:8px; font-style:italic;">
                ${messageEn}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
};

const greeting = (name?: string) => `
  <p style="margin:0 0 4px; font-size:16px; color:${emailStyles.textPrimary};">
    Bonjour${name ? ` <strong>${name}</strong>` : ""}, <span style="color:${emailStyles.textMuted}; font-size:14px;">/ Hello${name ? ` ${name}` : ""},</span>
  </p>`;

const detailsCard = (items: Array<{ label: string; value: string }>) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fafafa; border-radius:8px; border:1px solid ${emailStyles.border}; margin:20px 0;">
    ${items.map((item, idx) => `
      <tr>
        <td style="padding:14px 16px; ${idx < items.length - 1 ? `border-bottom:1px solid ${emailStyles.border};` : ""}">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size:13px; color:${emailStyles.textMuted}; width:40%;">${item.label}</td>
              <td style="font-size:14px; color:${emailStyles.textPrimary}; font-weight:500; text-align:right;">${item.value}</td>
            </tr>
          </table>
        </td>
      </tr>
    `).join("")}
  </table>`;

// =============================================
// SERVICE LINE RENDERING
// =============================================

const servicesTable = (services: Array<{ name: string; price: number; period?: string }>) => {
  if (!services || services.length === 0) return "";
  
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0; border:1px solid ${emailStyles.border}; border-radius:8px; overflow:hidden;">
    <tr>
      <td style="background-color:${emailStyles.accent}; color:#fff; padding:12px 16px; font-size:14px; font-weight:600;">
        Services commandés / Ordered services
      </td>
    </tr>
    ${services.map((s, idx) => `
      <tr>
        <td style="padding:12px 16px; border-bottom:${idx < services.length - 1 ? `1px solid ${emailStyles.border}` : 'none'}; background-color:#fff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="font-size:14px; color:${emailStyles.textPrimary};">${s.name}</td>
              <td style="font-size:14px; color:${emailStyles.accent}; font-weight:600; text-align:right;">
                ${formatCurrency(s.price)}${s.period ? `/${s.period}` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join("")}
  </table>`;
};

// =============================================
// MAIN HANDLER
// =============================================

interface OrderConfirmationRequest {
  order_id: string;
  client_email: string;
  client_name?: string;
  order_number: string;
  services: Array<{ name: string; price: number; period?: string }>;
  monthly_total_tax_in: number;
  one_time_total: number;
  delivery_method?: string;
  payment_reference?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] send-order-confirmation invoked`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://nivratelecom.ca";
    const supportEmail = Deno.env.get("SUPPORT_EMAIL") || "Support@nivratelecom.ca";
    const supportPhone = Deno.env.get("SUPPORT_PHONE") || "438-544-2233";

    if (!resendApiKey) {
      console.error(`[${requestId}] RESEND_API_KEY not configured`);
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Supabase credentials not configured`);
      return new Response(JSON.stringify({ error: "Database service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body: OrderConfirmationRequest = await req.json();
    console.log(`[${requestId}] Request body:`, JSON.stringify(body));

    const {
      order_id,
      client_email,
      client_name,
      order_number,
      services,
      monthly_total_tax_in,
      one_time_total,
      delivery_method,
      payment_reference,
    } = body;

    // Validate required fields
    if (!order_id || !client_email || !order_number) {
      console.error(`[${requestId}] Missing required fields`);
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IDEMPOTENCY CHECK: Check if email was already sent for this order
    const { data: existingOrder, error: checkError } = await supabase
      .from("orders")
      .select("confirmation_email_sent_at")
      .eq("id", order_id)
      .single();

    if (checkError) {
      console.error(`[${requestId}] Error checking order:`, checkError);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingOrder?.confirmation_email_sent_at) {
      console.log(`[${requestId}] Email already sent at ${existingOrder.confirmation_email_sent_at}, skipping`);
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        message: "Email already sent for this order"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email content
    const deliveryMethodLabel = delivery_method === "technician" 
      ? "Installation par technicien" 
      : delivery_method === "uber" 
        ? "Livraison Uber Express"
        : delivery_method === "auto"
          ? "Auto-installation"
          : delivery_method || "Standard";

    const emailContent = `
      ${greeting(client_name)}
      ${statusBadge("✅", "Commande confirmée!", 
        "Votre commande a été reçue et est en cours de traitement.",
        "Your order has been received and is being processed."
      )}
      ${detailsCard([
        { label: "Nº commande / Order #", value: order_number },
        { label: "Mode de livraison / Delivery", value: deliveryMethodLabel },
        ...(payment_reference ? [{ label: "Réf. paiement / Payment ref", value: payment_reference }] : []),
      ])}
      ${servicesTable(services || [])}
      ${detailsCard([
        { label: "Total mensuel estimé (taxes incl.)", value: formatCurrency(monthly_total_tax_in) + "/mois" },
        { label: "Frais uniques (taxes incl.)", value: formatCurrency(one_time_total) },
      ])}
      <p style="margin:20px 0 0; font-size:14px; color:${emailStyles.textSecondary};">
        Notre équipe traitera votre commande dans les meilleurs délais. Vous recevrez une confirmation dès que votre service sera activé.<br><br>
        <em style="color:${emailStyles.textMuted};">Our team will process your order as soon as possible. You will receive a confirmation once your service is activated.</em>
      </p>
    `;

    const htmlContent = wrapEmail(
      emailContent,
      joinUrl(appBaseUrl, "/portal/orders"),
      "Voir ma commande / View order",
      supportEmail,
      supportPhone
    );

    // Send email via Resend
    console.log(`[${requestId}] Sending email to ${client_email}`);
    const emailResult = await resend.emails.send({
      from: `Nivra Telecom <${supportEmail.includes("@") ? supportEmail : "noreply@nivratelecom.ca"}>`,
      to: [client_email],
      subject: `Confirmation de commande — ${order_number}`,
      html: htmlContent,
    });

    console.log(`[${requestId}] Resend response:`, JSON.stringify(emailResult));

    if (emailResult.error) {
      console.error(`[${requestId}] Resend error:`, emailResult.error);
      
      // Log to email_queue for retry/tracking
      await supabase.from("email_queue").insert({
        event_key: `order_confirmation_${order_id}`,
        template_key: "nivra_order_confirmation_fr",
        to_email: client_email,
        status: "failed",
        last_error: JSON.stringify(emailResult.error),
        template_vars: body as any,
      });

      return new Response(JSON.stringify({ 
        success: false, 
        error: "Email sending failed",
        request_id: requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark email as sent (idempotency)
    const { error: updateError } = await supabase
      .from("orders")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", order_id);

    if (updateError) {
      console.warn(`[${requestId}] Failed to update confirmation_email_sent_at:`, updateError);
      // Non-blocking — email was still sent
    }

    // Log success to email_queue for audit
    await supabase.from("email_queue").insert({
      event_key: `order_confirmation_${order_id}`,
      template_key: "nivra_order_confirmation_fr",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailResult.data?.id || null,
      template_vars: body as any,
    });

    console.log(`[${requestId}] Email sent successfully, message_id: ${emailResult.data?.id}`);

    return new Response(JSON.stringify({ 
      success: true,
      message_id: emailResult.data?.id,
      request_id: requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred",
      request_id: requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
