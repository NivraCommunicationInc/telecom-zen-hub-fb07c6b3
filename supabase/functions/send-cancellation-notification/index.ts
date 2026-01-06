import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancellationEmailData {
  template: "cancellation_received" | "cancellation_scheduled" | "cancellation_completed" | "cancellation_declined";
  to_email: string;
  client_name: string;
  request_number: string;
  service_type: string;
  effective_date?: string;
  decline_reason?: string;
  public_message?: string;
  language?: "fr" | "en";
}

// Service type labels for human-readable output
const serviceTypeLabels: Record<string, { fr: string; en: string }> = {
  mobile: { fr: "Mobile", en: "Mobile" },
  internet: { fr: "Internet", en: "Internet" },
  tv: { fr: "Télévision", en: "Television" },
  security: { fr: "Sécurité", en: "Security" },
  streaming: { fr: "Streaming", en: "Streaming" },
  bundle: { fr: "Forfait combiné", en: "Bundle" },
};

const templates = {
  cancellation_received: {
    fr: {
      subject: "Demande d'annulation reçue - {{request_number}}",
      previewText: "Nivra a reçu votre demande d'annulation {{service_type}}. Référence: {{request_number}}",
      heading: "Demande d'annulation reçue",
      body: `Bonjour {{client_name}},

Nous avons bien reçu votre demande d'annulation pour votre service {{service_type}}.

Numéro de demande: {{request_number}}

Notre équipe examinera votre demande dans les plus brefs délais. Vous recevrez une confirmation par courriel une fois le traitement effectué.

Si vous avez des questions, n'hésitez pas à nous contacter.

Cordialement,
L'équipe Nivra`,
    },
    en: {
      subject: "Cancellation Request Received - {{request_number}}",
      previewText: "Nivra received your {{service_type}} cancellation request. Reference: {{request_number}}",
      heading: "Cancellation Request Received",
      body: `Hello {{client_name}},

We have received your cancellation request for your {{service_type}} service.

Request Number: {{request_number}}

Our team will review your request as soon as possible. You will receive a confirmation email once processing is complete.

If you have any questions, please don't hesitate to contact us.

Best regards,
The Nivra Team`,
    },
  },
  cancellation_scheduled: {
    fr: {
      subject: "Annulation planifiée - {{request_number}}",
      previewText: "Votre annulation {{service_type}} est confirmée pour le {{effective_date}}. Réf: {{request_number}}",
      heading: "Annulation planifiée",
      body: `Bonjour {{client_name}},

Votre demande d'annulation pour votre service {{service_type}} a été approuvée.

Numéro de demande: {{request_number}}
Date d'annulation effective: {{effective_date}}

{{public_message}}

Votre service restera actif jusqu'à la date effective. Après cette date, vous n'aurez plus accès au service.

Si vous avez des questions, n'hésitez pas à nous contacter.

Cordialement,
L'équipe Nivra`,
    },
    en: {
      subject: "Cancellation Scheduled - {{request_number}}",
      previewText: "Your {{service_type}} cancellation is confirmed for {{effective_date}}. Ref: {{request_number}}",
      heading: "Cancellation Scheduled",
      body: `Hello {{client_name}},

Your cancellation request for your {{service_type}} service has been approved.

Request Number: {{request_number}}
Effective Cancellation Date: {{effective_date}}

{{public_message}}

Your service will remain active until the effective date. After this date, you will no longer have access to the service.

If you have any questions, please don't hesitate to contact us.

Best regards,
The Nivra Team`,
    },
  },
  cancellation_completed: {
    fr: {
      subject: "Annulation complétée - {{request_number}}",
      previewText: "Votre service {{service_type}} a été annulé avec succès. Merci d'avoir été client Nivra.",
      heading: "Annulation complétée",
      body: `Bonjour {{client_name}},

Votre annulation de service {{service_type}} est maintenant complétée.

Numéro de demande: {{request_number}}
Date d'annulation: {{effective_date}}

{{public_message}}

Nous vous remercions d'avoir été client chez Nivra. Si vous souhaitez réactiver vos services à l'avenir, nous serons heureux de vous accueillir à nouveau.

Cordialement,
L'équipe Nivra`,
    },
    en: {
      subject: "Cancellation Completed - {{request_number}}",
      previewText: "Your {{service_type}} service has been successfully cancelled. Thank you for being a Nivra customer.",
      heading: "Cancellation Completed",
      body: `Hello {{client_name}},

Your {{service_type}} service cancellation is now complete.

Request Number: {{request_number}}
Cancellation Date: {{effective_date}}

{{public_message}}

Thank you for being a Nivra customer. If you wish to reactivate your services in the future, we would be happy to welcome you back.

Best regards,
The Nivra Team`,
    },
  },
  cancellation_declined: {
    fr: {
      subject: "Demande d'annulation refusée - {{request_number}}",
      previewText: "Votre demande d'annulation {{service_type}} n'a pas pu être approuvée. Contactez-nous.",
      heading: "Demande refusée",
      body: `Bonjour {{client_name}},

Nous avons examiné votre demande d'annulation pour votre service {{service_type}}.

Numéro de demande: {{request_number}}

Malheureusement, votre demande n'a pas pu être approuvée pour la raison suivante:

{{decline_reason}}

{{public_message}}

Si vous avez des questions ou souhaitez discuter de votre situation, n'hésitez pas à nous contacter.

Cordialement,
L'équipe Nivra`,
    },
    en: {
      subject: "Cancellation Request Declined - {{request_number}}",
      previewText: "Your {{service_type}} cancellation request could not be approved. Please contact us.",
      heading: "Request Declined",
      body: `Hello {{client_name}},

We have reviewed your cancellation request for your {{service_type}} service.

Request Number: {{request_number}}

Unfortunately, your request could not be approved for the following reason:

{{decline_reason}}

{{public_message}}

If you have any questions or would like to discuss your situation, please don't hesitate to contact us.

Best regards,
The Nivra Team`,
    },
  },
};

function getServiceTypeLabel(serviceType: string, language: "fr" | "en"): string {
  return serviceTypeLabels[serviceType]?.[language] || serviceType;
}

function replaceVariables(text: string, data: CancellationEmailData, language: "fr" | "en"): string {
  const serviceLabel = getServiceTypeLabel(data.service_type, language);
  return text
    .replace(/\{\{client_name\}\}/g, data.client_name || "Client")
    .replace(/\{\{request_number\}\}/g, data.request_number || "")
    .replace(/\{\{service_type\}\}/g, serviceLabel)
    .replace(/\{\{effective_date\}\}/g, data.effective_date || "—")
    .replace(/\{\{decline_reason\}\}/g, data.decline_reason || "")
    .replace(/\{\{public_message\}\}/g, data.public_message || "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: CancellationEmailData = await req.json();
    const language = data.language || "fr";
    const templateContent = templates[data.template]?.[language];

    if (!templateContent) {
      throw new Error(`Template ${data.template} not found for language ${language}`);
    }

    console.log(`[send-cancellation-notification] Sending ${data.template} to ${data.to_email?.substring(0, 3)}***`);

    const subject = replaceVariables(templateContent.subject, data, language);
    const body = replaceVariables(templateContent.body, data, language);
    const previewText = replaceVariables(templateContent.previewText, data, language);
    // Ensure preview text is under 90 chars
    const truncatedPreview = previewText.length > 90 ? previewText.substring(0, 87) + "..." : previewText;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const htmlBody = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td><![endif]-->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${truncatedPreview}&#847;&zwnj;&nbsp;&#8199;&nbsp;&#65279;&nbsp;&#847;&zwnj;&nbsp;&#8199;&nbsp;&#65279;&nbsp;&#847;&zwnj;&nbsp;</div>
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Nivra</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin: 0 0 24px; font-size: 22px; font-weight: 600;">${templateContent.heading}</h2>
              <div style="color: #374151; font-size: 16px; line-height: 1.7; white-space: pre-line;">${body}</div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px;">
                © ${new Date().getFullYear()} Nivra. ${language === "fr" ? "Tous droits réservés." : "All rights reserved."}
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                ${language === "fr" ? "Ce courriel a été envoyé automatiquement. Veuillez ne pas y répondre directement." : "This email was sent automatically. Please do not reply directly."}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <!--[if mso | IE]></td></tr></table><![endif]-->
</body>
</html>`;

    // Plain text version for email clients that don't render HTML
    const plainText = `${templateContent.heading}\n\n${body}\n\n---\n© ${new Date().getFullYear()} Nivra`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Nivra <noreply@nivra.ca>",
        to: [data.to_email],
        subject: subject,
        html: htmlBody,
        text: plainText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[send-cancellation-notification] Resend error:", errorText);
      throw new Error(`Resend API error: ${errorText}`);
    }

    const emailResult = await response.json();
    console.log(`[send-cancellation-notification] Email sent successfully: ${emailResult?.id}`);

    return new Response(JSON.stringify({ success: true, id: emailResult?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[send-cancellation-notification] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});