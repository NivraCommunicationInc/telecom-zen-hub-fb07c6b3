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

const templates = {
  cancellation_received: {
    fr: {
      subject: "Demande d'annulation reçue - {{request_number}}",
      previewText: "Nous avons bien reçu votre demande d'annulation de service.",
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
      previewText: "We have received your service cancellation request.",
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
      previewText: "Votre annulation de service a été planifiée.",
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
      previewText: "Your service cancellation has been scheduled.",
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
      previewText: "Votre annulation de service est maintenant complétée.",
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
      previewText: "Your service cancellation is now complete.",
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
      previewText: "Votre demande d'annulation n'a pas pu être approuvée.",
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
      previewText: "Your cancellation request could not be approved.",
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

function replaceVariables(text: string, data: CancellationEmailData): string {
  return text
    .replace(/\{\{client_name\}\}/g, data.client_name)
    .replace(/\{\{request_number\}\}/g, data.request_number)
    .replace(/\{\{service_type\}\}/g, data.service_type)
    .replace(/\{\{effective_date\}\}/g, data.effective_date || "")
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

    const subject = replaceVariables(templateContent.subject, data);
    const body = replaceVariables(templateContent.body, data);
    const previewText = replaceVariables(templateContent.previewText, data);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">${previewText}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Nivra</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 20px;">${templateContent.heading}</h2>
              <div style="color: #374151; font-size: 16px; line-height: 1.6; white-space: pre-line;">${body}</div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Nivra. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const result = await response.json();

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending cancellation email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
