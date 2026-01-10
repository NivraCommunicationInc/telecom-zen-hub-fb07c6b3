import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Status labels and descriptions
const STATUS_INFO: Record<string, { label: string; description: string; previewText: string }> = {
  installation_scheduled: {
    label: "Installation planifiée",
    description: "Votre installation a été planifiée et un technicien vous sera assigné.",
    previewText: "Votre installation est planifiée - Nivra Télécom",
  },
  technician_en_route: {
    label: "Technicien en route",
    description: "Notre technicien est en route vers votre adresse. Merci de vous assurer que quelqu'un sera présent.",
    previewText: "Notre technicien arrive bientôt - Nivra Télécom",
  },
  installation_in_progress: {
    label: "Installation en cours",
    description: "L'installation de vos services est actuellement en cours.",
    previewText: "Installation en cours chez vous - Nivra Télécom",
  },
  installation_completed: {
    label: "Installation terminée",
    description: "Félicitations! L'installation de vos services est maintenant complétée. Vous pouvez commencer à profiter de vos services.",
    previewText: "Installation terminée avec succès - Nivra Télécom",
  },
  completed: {
    label: "Commande complétée",
    description: "Votre commande est maintenant complètement finalisée. Merci de faire confiance à Nivra Télécom!",
    previewText: "Votre commande est finalisée - Nivra Télécom",
  },
};

const buildEmailHtml = (params: {
  clientFirstName: string;
  orderNumber: string;
  status: string;
  serviceAddress?: string;
  scheduledDateTime?: string;
  technicianName?: string;
  portalUrl: string;
}): string => {
  const { clientFirstName, orderNumber, status, serviceAddress, scheduledDateTime, technicianName, portalUrl } = params;
  const statusInfo = STATUS_INFO[status] || { label: status, description: "", previewText: "" };

  // Color based on status
  const statusColor = status === "installation_completed" || status === "completed" ? "#10b981" : "#3b82f6";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusInfo.label} - Nivra Télécom</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <!-- Preview text (hidden but shown in email clients) -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    ${statusInfo.previewText}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
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
                Mise à jour de votre commande
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
                      ${serviceAddress ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #666; font-size: 14px;">Adresse d'installation</span>
                        </td>
                        <td align="right" style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #333; font-size: 14px;">${serviceAddress}</span>
                        </td>
                      </tr>
                      ` : ""}
                      ${scheduledDateTime ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #666; font-size: 14px;">Date/heure planifiée</span>
                        </td>
                        <td align="right" style="padding: 8px 0; border-bottom: 1px solid #eee;">
                          <span style="color: #333; font-size: 14px; font-weight: 500;">${scheduledDateTime}</span>
                        </td>
                      </tr>
                      ` : ""}
                      ${technicianName ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">Technicien</span>
                        </td>
                        <td align="right" style="padding: 8px 0;">
                          <span style="color: #333; font-size: 14px;">${technicianName}</span>
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

interface InstallationStatusEmailRequest {
  order_id: string;
  client_email: string;
  client_first_name?: string;
  order_number: string;
  new_status: string;
  old_status?: string;
  service_address?: string;
  scheduled_date_time?: string;
  technician_name?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] send-installation-status-email invoked`);

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

    const body: InstallationStatusEmailRequest = await req.json();
    const {
      order_id,
      client_email,
      client_first_name,
      order_number,
      new_status,
      old_status,
      service_address,
      scheduled_date_time,
      technician_name,
    } = body;

    console.log(`[${requestId}] Sending installation status email: order=${order_number}, status=${new_status}`);

    if (!order_id || !client_email || !order_number || !new_status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this status is one we send emails for
    if (!STATUS_INFO[new_status]) {
      console.log(`[${requestId}] Status ${new_status} not configured for emails, skipping`);
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true, 
        reason: "Status not configured for email notification" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency check - use email_queue to track sent emails
    const idempotencyKey = `installation_status_${order_id}_${new_status}`;
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

    const statusInfo = STATUS_INFO[new_status];
    // Use environment variable for base URL with fallback to /portal (not /client)
    const siteBaseUrl = Deno.env.get("SITE_URL") || Deno.env.get("VITE_SITE_URL") || "https://nivratelecom.ca";
    const portalUrl = `${siteBaseUrl}/portal`;

    const emailHtml = buildEmailHtml({
      clientFirstName: client_first_name || "Client",
      orderNumber: order_number,
      status: new_status,
      serviceAddress: service_address,
      scheduledDateTime: scheduled_date_time,
      technicianName: technician_name,
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
        template_key: "installation_status",
        to_email: client_email,
        status: "failed",
        last_error: JSON.stringify(emailResult.error),
        template_vars: { order_id, order_number, new_status, old_status },
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
      template_key: "installation_status",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailResult.data?.id,
      template_vars: { order_id, order_number, new_status, old_status },
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
