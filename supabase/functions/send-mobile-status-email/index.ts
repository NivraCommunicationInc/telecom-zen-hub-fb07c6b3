import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mobile status labels and descriptions
const STATUS_INFO: Record<string, { label: string; description: string; previewText: string }> = {
  number_assigned: {
    label: "Numéro attribué",
    description: "Votre numéro de téléphone mobile a été attribué à votre compte.",
    previewText: "Votre numéro de téléphone est maintenant attribué - Nivra Télécom",
  },
  port_in_initiated: {
    label: "Transfert de numéro initié",
    description: "Le transfert de votre numéro vers Nivra Télécom a été initié. Ce processus peut prendre de 1 à 3 jours ouvrables.",
    previewText: "Transfert de numéro en cours - Nivra Télécom",
  },
  port_in_completed: {
    label: "Transfert de numéro complété",
    description: "Le transfert de votre numéro vers Nivra Télécom est maintenant complété. Vous pouvez utiliser votre ligne normalement.",
    previewText: "Transfert de numéro réussi - Nivra Télécom",
  },
  sim_shipped: {
    label: "Carte SIM expédiée",
    description: "Votre carte SIM a été expédiée. Vous pouvez suivre la livraison avec le numéro de suivi ci-dessous.",
    previewText: "Votre carte SIM est en route - Nivra Télécom",
  },
  sim_delivered: {
    label: "Carte SIM livrée",
    description: "Votre carte SIM a été livrée. Suivez les instructions d'activation dans votre espace client.",
    previewText: "Carte SIM livrée - Nivra Télécom",
  },
  activated: {
    label: "Ligne activée",
    description: "Votre ligne mobile est maintenant activée et prête à l'utilisation!",
    previewText: "Ligne mobile activée - Nivra Télécom",
  },
};

const buildEmailHtml = (params: {
  clientFirstName: string;
  orderNumber: string;
  phoneNumber?: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  portalUrl: string;
}): string => {
  const { clientFirstName, orderNumber, phoneNumber, status, carrier, trackingNumber, estimatedDelivery, portalUrl } = params;
  const statusInfo = STATUS_INFO[status] || { label: status, description: "", previewText: "" };

  // Color based on status
  let statusColor = "#3b82f6"; // blue default
  if (status === "activated" || status === "port_in_completed") statusColor = "#10b981"; // green
  if (status === "sim_shipped") statusColor = "#6366f1"; // indigo
  if (status === "port_in_initiated") statusColor = "#f59e0b"; // amber

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusInfo.label} - Nivra Télécom</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <!-- Preview text -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    ${statusInfo.previewText}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

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
              <!-- Status Badge -->
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; padding: 8px 16px; background-color: ${statusColor}20; color: ${statusColor}; border-radius: 20px; font-size: 14px; font-weight: 600;">
                  ${statusInfo.label}
                </span>
              </div>

              <h2 style="margin: 0 0 24px 0; color: #1a1a2e; font-size: 22px; font-weight: 600; text-align: center;">
                Mise à jour de votre service mobile
              </h2>
              
              <p style="margin: 0 0 16px 0; color: #333; font-size: 16px; line-height: 1.6;">
                Bonjour <strong>${clientFirstName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; color: #333; font-size: 16px; line-height: 1.6;">
                ${statusInfo.description}
              </p>
              
              <!-- Order Details Box -->
              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #666; font-size: 14px;">Numéro de commande</span>
                        </td>
                        <td align="right" style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #1a1a2e; font-size: 14px; font-weight: 600;">#${orderNumber}</span>
                        </td>
                      </tr>
                      ${phoneNumber ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #666; font-size: 14px;">Numéro de téléphone</span>
                        </td>
                        <td align="right" style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #333; font-size: 14px; font-weight: 600;">${phoneNumber}</span>
                        </td>
                      </tr>
                      ` : ""}
                      ${carrier ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #666; font-size: 14px;">Transporteur</span>
                        </td>
                        <td align="right" style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #333; font-size: 14px;">${carrier}</span>
                        </td>
                      </tr>
                      ` : ""}
                      ${trackingNumber ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #666; font-size: 14px;">Numéro de suivi</span>
                        </td>
                        <td align="right" style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #3b82f6; font-size: 14px; font-weight: 500;">${trackingNumber}</span>
                        </td>
                      </tr>
                      ` : ""}
                      ${estimatedDelivery ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">Livraison estimée</span>
                        </td>
                        <td align="right" style="padding: 8px 0;">
                          <span style="color: #333; font-size: 14px;">${estimatedDelivery}</span>
                        </td>
                      </tr>
                      ` : ""}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" style="display: inline-block; padding: 14px 32px; background-color: #1a1a2e; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
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

interface MobileStatusEmailRequest {
  client_id: string;
  client_email: string;
  client_first_name?: string;
  order_id: string;
  order_number: string;
  phone_number?: string;
  status: string;
  carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] send-mobile-status-email invoked`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Missing required environment variables`);
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body: MobileStatusEmailRequest = await req.json();
    const {
      client_id,
      client_email,
      client_first_name,
      order_id,
      order_number,
      phone_number,
      status,
      carrier,
      tracking_number,
      estimated_delivery,
    } = body;

    console.log(`[${requestId}] Sending mobile status email: order=${order_number}, status=${status}`);

    if (!client_id || !client_email || !order_id || !order_number || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this status is one we send emails for
    if (!STATUS_INFO[status]) {
      console.log(`[${requestId}] Status ${status} not configured for emails, skipping`);
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true, 
        reason: "Status not configured for email notification" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency check
    const idempotencyKey = `mobile_status_${order_id}_${status}`;
    const { data: existingEmail } = await supabase
      .from("email_queue")
      .select("id, sent_at")
      .eq("event_key", idempotencyKey)
      .eq("status", "sent")
      .maybeSingle();

    if (existingEmail) {
      console.log(`[${requestId}] Email already sent for this status change`);
      return new Response(JSON.stringify({ 
        success: true, 
        already_sent: true, 
        sent_at: existingEmail.sent_at 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusInfo = STATUS_INFO[status];
    const siteBaseUrl = Deno.env.get("SITE_URL") || Deno.env.get("VITE_SITE_URL") || "https://nivratelecom.ca";
    const portalUrl = `${siteBaseUrl}/portal`;

    const emailHtml = buildEmailHtml({
      clientFirstName: client_first_name || "Client",
      orderNumber: order_number,
      phoneNumber: phone_number,
      status,
      carrier,
      trackingNumber: tracking_number,
      estimatedDelivery: estimated_delivery,
      portalUrl,
    });

    const emailResult = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivratelecom.ca>",
      to: [client_email],
      subject: `${statusInfo.label} — Commande #${order_number} | Nivra Télécom`,
      html: emailHtml,
    });

    if (emailResult.error) {
      console.error(`[${requestId}] Resend error:`, emailResult.error);
      
      await supabase.from("email_queue").insert({
        event_key: idempotencyKey,
        template_key: "mobile_status",
        to_email: client_email,
        status: "failed",
        last_error: JSON.stringify(emailResult.error),
        template_vars: { client_id, order_id, order_number, status, phone_number },
      });

      return new Response(JSON.stringify({ 
        success: false, 
        error: "Email sending failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] Email sent successfully: ${emailResult.data?.id}`);

    // Log successful send
    await supabase.from("email_queue").insert({
      event_key: idempotencyKey,
      template_key: "mobile_status",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailResult.data?.id,
      template_vars: { client_id, order_id, order_number, status, phone_number },
    });

    return new Response(JSON.stringify({ 
      success: true,
      message_id: emailResult.data?.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred",
      request_id: requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
