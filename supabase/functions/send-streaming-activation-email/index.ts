import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Streaming status labels and descriptions
const STATUS_INFO: Record<string, { label: string; description: string; previewText: string }> = {
  link_sent: {
    label: "Lien d'activation envoyé",
    description: "Votre lien d'activation pour le service de streaming a été envoyé. Utilisez le code promo ci-dessous pour activer votre abonnement.",
    previewText: "Votre lien d'activation streaming est prêt - Nivra Télécom",
  },
  link_reissued: {
    label: "Lien réémis",
    description: "Un nouveau lien d'activation a été généré pour vous. L'ancien lien a été désactivé.",
    previewText: "Nouveau lien d'activation streaming - Nivra Télécom",
  },
  activated: {
    label: "Service activé",
    description: "Votre service de streaming est maintenant activé! Vous pouvez commencer à profiter de votre contenu.",
    previewText: "Service streaming activé - Nivra Télécom",
  },
  expired: {
    label: "Lien expiré",
    description: "Votre lien d'activation a expiré. Veuillez contacter notre support pour obtenir un nouveau lien.",
    previewText: "Lien d'activation expiré - Nivra Télécom",
  },
};

const buildEmailHtml = (params: {
  clientFirstName: string;
  serviceName: string;
  status: string;
  activationLink?: string;
  promoCode?: string;
  expiresAt?: string;
  portalUrl: string;
}): string => {
  const { clientFirstName, serviceName, status, activationLink, promoCode, expiresAt, portalUrl } = params;
  const statusInfo = STATUS_INFO[status] || { label: status, description: "", previewText: "" };

  // Color based on status
  let statusColor = "#3b82f6"; // blue default
  if (status === "activated") statusColor = "#10b981"; // green
  if (status === "expired") statusColor = "#ef4444"; // red
  if (status === "link_sent" || status === "link_reissued") statusColor = "#8b5cf6"; // purple

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
                Streaming+ — ${serviceName}
              </h2>
              
              <p style="margin: 0 0 16px 0; color: #333; font-size: 16px; line-height: 1.6;">
                Bonjour <strong>${clientFirstName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; color: #333; font-size: 16px; line-height: 1.6;">
                ${statusInfo.description}
              </p>
              
              ${promoCode ? `
              <!-- Promo Code Box -->
              <div style="text-align: center; margin-bottom: 24px; padding: 24px; background: linear-gradient(135deg, #8b5cf620 0%, #a855f720 100%); border-radius: 12px; border: 2px dashed #8b5cf6;">
                <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Code Promo</p>
                <p style="margin: 0; color: #8b5cf6; font-size: 28px; font-weight: 700; letter-spacing: 2px; font-family: monospace;">${promoCode}</p>
              </div>
              ` : ""}
              
              <!-- Service Details Box -->
              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #666; font-size: 14px;">Service</span>
                        </td>
                        <td align="right" style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #1a1a2e; font-size: 14px; font-weight: 600;">${serviceName}</span>
                        </td>
                      </tr>
                      ${expiresAt ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">Expire le</span>
                        </td>
                        <td align="right" style="padding: 8px 0;">
                          <span style="color: #f59e0b; font-size: 14px; font-weight: 500;">${expiresAt}</span>
                        </td>
                      </tr>
                      ` : ""}
                    </table>
                  </td>
                </tr>
              </table>
              
              ${activationLink && (status === "link_sent" || status === "link_reissued") ? `
              <!-- Activation Button -->
              <table role="presentation" style="width: 100%; margin-bottom: 16px;">
                <tr>
                  <td align="center">
                    <a href="${activationLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Activer mon abonnement
                    </a>
                  </td>
                </tr>
              </table>
              ` : ""}
              
              <!-- Portal Button -->
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

interface StreamingActivationEmailRequest {
  client_id: string;
  client_email: string;
  client_first_name?: string;
  client_phone?: string; // For SMS
  token_id: string;
  service_name: string;
  status: string;
  activation_link?: string;
  promo_code?: string;
  expires_at?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] send-streaming-activation-email invoked`);

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

    const body: StreamingActivationEmailRequest = await req.json();
    const {
      client_id,
      client_email,
      client_first_name,
      client_phone,
      token_id,
      service_name,
      status,
      activation_link,
      promo_code,
      expires_at,
    } = body;

    console.log(`[${requestId}] Sending streaming activation email: service=${service_name}, status=${status}`);

    if (!client_id || !client_email || !token_id || !service_name || !status) {
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
    const idempotencyKey = `streaming_activation_${token_id}_${status}`;
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
      serviceName: service_name,
      status,
      activationLink: activation_link,
      promoCode: promo_code,
      expiresAt: expires_at,
      portalUrl,
    });

    const emailResult = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivratelecom.ca>",
      to: [client_email],
      subject: `${statusInfo.label} — ${service_name} | Nivra Télécom`,
      html: emailHtml,
    });

    if (emailResult.error) {
      console.error(`[${requestId}] Resend error:`, emailResult.error);
      
      await supabase.from("email_queue").insert({
        event_key: idempotencyKey,
        template_key: "streaming_activation",
        to_email: client_email,
        status: "failed",
        last_error: JSON.stringify(emailResult.error),
        template_vars: { client_id, token_id, service_name, status, promo_code },
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
      template_key: "streaming_activation",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailResult.data?.id,
      template_vars: { client_id, token_id, service_name, status, promo_code },
    });

    // Send SMS for activated status (non-blocking)
    // Fetch phone if not provided
    let phoneForSms = client_phone;
    let clientIdForSms = client_id;

    if (!phoneForSms) {
      console.log(`[${requestId}] No phone provided, fetching from profiles...`);
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, client_email, client_id);
      phoneForSms = phoneResult.phone || undefined;
      clientIdForSms = phoneResult.clientId || client_id;
      if (phoneForSms) {
        console.log(`[${requestId}] Found phone from profiles`);
      }
    }

    if (phoneForSms && toE164(phoneForSms) && status === "activated") {
      const clientName = client_first_name || "Client";
      const smsResult = await sendSmsNotification({
        to: phoneForSms,
        message: SMS_TEMPLATES.streamingActivated({
          clientName,
          serviceName: service_name,
        }),
        clientId: clientIdForSms,
        eventType: "streaming_activated",
        eventKey: `streaming_${token_id}_activated`,
      });
      console.log(`[${requestId}] Streaming SMS result:`, JSON.stringify(smsResult));
    } else if (!phoneForSms) {
      console.log(`[${requestId}] No valid phone for SMS`);
    }

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
