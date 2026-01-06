import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (amount: number): string => {
  const formatted = (amount || 0).toFixed(2);
  return `${formatted}$`;
};

// Mask email for logging (privacy)
const maskEmail = (email: string): string => {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  const maskedLocal = local.length > 2 ? local.slice(0, 2) + "***" : "***";
  return `${maskedLocal}@${domain}`;
};

// Build hardcoded HTML email (NO RESEND TEMPLATE)
const buildOrderConfirmationHtml = (params: {
  orderNumber: string;
  clientFirstName: string;
  servicesList: string;
  deliveryType: string;
  monthlyTotal: string;
  oneTimeTotal: string;
}): string => {
  const { orderNumber, clientFirstName, servicesList, deliveryType, monthlyTotal, oneTimeTotal } = params;
  
  // Convert services list to HTML (each line becomes a list item)
  const servicesHtml = servicesList
    .split("\n")
    .filter(line => line.trim())
    .map(line => `<li style="margin-bottom: 8px; color: #333;">${line.replace(/^•\s*/, '')}</li>`)
    .join("");

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de commande - Nivra Télécom</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background-color: #1a1a2e; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Nivra Télécom
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; color: #1a1a2e; font-size: 22px; font-weight: 600;">
                Confirmation de commande
              </h2>
              
              <p style="margin: 0 0 16px 0; color: #333; font-size: 16px; line-height: 1.6;">
                Bonjour <strong>${clientFirstName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; color: #333; font-size: 16px; line-height: 1.6;">
                Merci pour votre commande! Voici le récapitulatif de votre commande <strong>#${orderNumber}</strong>.
              </p>
              
              <!-- Order Details Box -->
              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px 0; color: #1a1a2e; font-size: 16px; font-weight: 600;">
                      Services commandés
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
                      ${servicesHtml || '<li style="color: #666;">Services en cours de traitement</li>'}
                    </ul>
                  </td>
                </tr>
              </table>
              
              <!-- Totals -->
              <table role="presentation" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #666; font-size: 14px;">Mode de livraison</span>
                  </td>
                  <td align="right" style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #333; font-size: 14px; font-weight: 500;">${deliveryType}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #666; font-size: 14px;">Total mensuel (taxes incl.)</span>
                  </td>
                  <td align="right" style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #1a1a2e; font-size: 16px; font-weight: 600;">${monthlyTotal}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #666; font-size: 14px;">Total unique (taxes incl.)</span>
                  </td>
                  <td align="right" style="padding: 12px 0;">
                    <span style="color: #1a1a2e; font-size: 16px; font-weight: 600;">${oneTimeTotal}</span>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 24px 0; color: #666; font-size: 14px; line-height: 1.6;">
                Un membre de notre équipe vous contactera sous peu pour confirmer les prochaines étapes.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="https://nivratelecom.ca/client" style="display: inline-block; padding: 14px 32px; background-color: #1a1a2e; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
                      Accéder à mon espace client
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-align: center;">
                Nivra Télécom — Services de télécommunications prépayées
              </p>
              <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
                Questions? Contactez-nous à support@nivratelecom.ca
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

// =============================================
// MAIN HANDLER
// =============================================

interface OrderConfirmationRequest {
  order_id: string;
  client_email: string;
  client_first_name?: string;
  order_number: string;
  services: Array<{ name: string; price: number; period?: string }>;
  monthly_total_tax_in: number;
  one_time_total: number;
  delivery_method?: string;
  payment_reference?: string;
  force?: boolean; // Admin-only: bypass idempotency for testing
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] ========================================`);
  console.log(`[${requestId}] send-order-confirmation invoked (HARDCODED HTML)`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Common log structure helper
  const logResult = (status: "sent" | "skipped_already_sent" | "error", extra: Record<string, unknown> = {}) => {
    console.log(`[${requestId}] RESULT:`, JSON.stringify({ 
      request_id: requestId, 
      status, 
      ...extra 
    }));
  };

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supportEmail = Deno.env.get("SUPPORT_EMAIL") || "support@nivratelecom.ca";

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
      order_number,
      services,
      monthly_total_tax_in,
      one_time_total,
      delivery_method,
      force = false,
    } = body;

    console.log(`[${requestId}] Request: order_id=${order_id}, order_number=${order_number}, force=${force}`);
    console.log(`[${requestId}] to_email=${maskEmail(client_email)}`);

    // Validate required fields
    if (!order_id || !client_email || !order_number) {
      console.error(`[${requestId}] Missing required fields: order_id=${!!order_id}, client_email=${!!client_email}, order_number=${!!order_number}`);
      logResult("error", { error: "Missing required fields", order_id, order_number });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IDEMPOTENCY CHECK: Check if email was already sent for this order (skip if force=true)
    if (!force) {
      const { data: existingOrder, error: checkError } = await supabase
        .from("orders")
        .select("confirmation_email_sent_at")
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

      if (existingOrder?.confirmation_email_sent_at) {
        console.log(`[${requestId}] Email already sent at ${existingOrder.confirmation_email_sent_at}`);
        logResult("skipped_already_sent", { 
          order_id, 
          order_number, 
          to_email: maskEmail(client_email),
          sent_at: existingOrder.confirmation_email_sent_at 
        });
        return new Response(JSON.stringify({ 
          success: true, 
          already_sent: true,
          status: "skipped_already_sent",
          sent_at: existingOrder.confirmation_email_sent_at,
          message: "Email already sent for this order (use force=true to resend)"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.log(`[${requestId}] force=true, bypassing idempotency check`);
    }

    // Build delivery type label (human-readable)
    const deliveryTypeLabel = (() => {
      switch (delivery_method) {
        case "technician": return "Installation par technicien";
        case "uber": return "Express Uber (10h)";
        case "auto": return "Auto-installation avec livraison";
        case "shipHome": return "Expédition à domicile (3-5 jours)";
        case "standard": return "Livraison standard (24-78h)";
        default: return delivery_method || "Standard";
      }
    })();

    // Build services list as multi-line string with bullets
    const servicesList = (services || [])
      .map(s => {
        const periodLabel = s.period === "30 jours" ? "/30 jours" : "/mois";
        return `• ${s.name} — ${formatCurrency(s.price)}${periodLabel}`;
      })
      .join("\n");

    // Build the hardcoded HTML email
    const emailHtml = buildOrderConfirmationHtml({
      orderNumber: order_number,
      clientFirstName: client_first_name || "Client",
      servicesList: servicesList || "• Services commandés",
      deliveryType: deliveryTypeLabel,
      monthlyTotal: formatCurrency(monthly_total_tax_in),
      oneTimeTotal: formatCurrency(one_time_total),
    });

    // Build email subject
    const emailSubject = `Confirmation de commande — ${order_number} | Nivra Télécom`;
    
    // Determine from email
    const fromEmail = supportEmail.includes("@") ? supportEmail : "noreply@nivratelecom.ca";
    
    console.log(`[${requestId}] Sending email via Resend (HARDCODED HTML - NO TEMPLATE)...`);
    console.log(`[${requestId}] from: Nivra Telecom <${fromEmail}>`);
    console.log(`[${requestId}] subject: ${emailSubject}`);

    // Send email via Resend using HARDCODED HTML (NOT template)
    const emailPayload = {
      from: `Nivra Telecom <${fromEmail}>`,
      to: [client_email],
      subject: emailSubject,
      html: emailHtml,
    };

    console.log(`[${requestId}] Resend payload (without sensitive data):`, JSON.stringify({
      from: emailPayload.from,
      to: [maskEmail(client_email)],
      subject: emailPayload.subject,
      html_length: emailHtml.length,
      method: "hardcoded_html",
    }));

    const emailResult = await resend.emails.send(emailPayload);

    console.log(`[${requestId}] Resend API response:`, JSON.stringify(emailResult));

    if (emailResult.error) {
      console.error(`[${requestId}] Resend error:`, JSON.stringify(emailResult.error));
      console.error(`[${requestId}] Error details:`, {
        name: (emailResult.error as any)?.name,
        message: (emailResult.error as any)?.message,
        statusCode: (emailResult.error as any)?.statusCode,
      });
      
      // Log to email_queue for retry/tracking
      await supabase.from("email_queue").insert({
        event_key: `order_confirmation_${order_id}`,
        template_key: "order_confirmation_html",
        to_email: client_email,
        status: "failed",
        last_error: JSON.stringify(emailResult.error),
      });

      logResult("error", {
        order_id,
        order_number,
        to_email: maskEmail(client_email),
        method: "hardcoded_html",
        error: emailResult.error,
      });

      return new Response(JSON.stringify({ 
        success: false, 
        status: "error",
        error: "Email sending failed",
        details: emailResult.error,
        request_id: requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendMessageId = emailResult.data?.id;
    console.log(`[${requestId}] ✅ Email sent successfully via HARDCODED HTML`);
    console.log(`[${requestId}] resend_message_id=${resendMessageId}`);

    // Mark email as sent (idempotency) IMMEDIATELY after successful send
    const { error: updateError } = await supabase
      .from("orders")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", order_id);

    if (updateError) {
      console.warn(`[${requestId}] Failed to update confirmation_email_sent_at:`, updateError);
      // Non-blocking — email was still sent
    } else {
      console.log(`[${requestId}] confirmation_email_sent_at updated`);
    }

    // Log success to email_queue for audit
    await supabase.from("email_queue").insert({
      event_key: `order_confirmation_${order_id}`,
      template_key: "order_confirmation_html",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: resendMessageId || null,
    });

    logResult("sent", {
      order_id,
      order_number,
      to_email: maskEmail(client_email),
      method: "hardcoded_html",
      resend_message_id: resendMessageId,
      forced: force,
    });

    console.log(`[${requestId}] ========================================`);

    return new Response(JSON.stringify({ 
      success: true,
      status: "sent",
      message_id: resendMessageId,
      method: "hardcoded_html",
      request_id: requestId,
      forced: force,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    console.error(`[${requestId}] Error stack:`, (error as Error)?.stack);
    logResult("error", { 
      error: (error as Error)?.message || "Unknown error",
      stack: (error as Error)?.stack 
    });
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred",
      status: "error",
      request_id: requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
