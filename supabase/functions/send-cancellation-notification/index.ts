import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendTemplateEmail, formatDateForTemplate, EMAIL_SENDER, RESEND_TEMPLATES, ResendTemplateKey } from "../_shared/resendTemplates.ts";

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

// Service type labels
const serviceTypeLabels: Record<string, string> = {
  mobile: "Mobile",
  internet: "Internet",
  tv: "Télévision",
  security: "Sécurité",
  streaming: "Streaming",
  bundle: "Forfait combiné",
};

// Template mapping for cancellation events
const CANCELLATION_TEMPLATE_MAP: Record<string, string> = {
  cancellation_received: "service_cancellation_requested",
  cancellation_scheduled: "service_cancellation",
  cancellation_completed: "service_cancelled_90_days",
  cancellation_declined: "service_cancellation_request",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const data: CancellationEmailData = await req.json();
    const serviceLabel = serviceTypeLabels[data.service_type] || data.service_type;

    console.log(`[send-cancellation-notification] Sending ${data.template} to ${data.to_email?.substring(0, 3)}***`);

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivratelecom.ca";

    // Determine which Resend template to use
    const templateKey = CANCELLATION_TEMPLATE_MAP[data.template] as ResendTemplateKey || "service_cancellation_requested" as ResendTemplateKey;

    // Build subject based on template type
    const subjects: Record<string, string> = {
      cancellation_received: `Demande d'annulation reçue - ${data.request_number}`,
      cancellation_scheduled: `Annulation planifiée - ${data.request_number}`,
      cancellation_completed: `Annulation complétée - ${data.request_number}`,
      cancellation_declined: `Demande d'annulation refusée - ${data.request_number}`,
    };

    const emailResult = await sendTemplateEmail({
      resendApiKey,
      templateKey,
      to: data.to_email,
      variables: {
        CLIENT_FIRST_NAME: data.client_name || "Client",
        REQUEST_NUMBER: data.request_number,
        SERVICE_TYPE: serviceLabel,
        EFFECTIVE_DATE: data.effective_date ? formatDateForTemplate(data.effective_date) : "—",
        DECLINE_REASON: data.decline_reason || "",
        PUBLIC_MESSAGE: data.public_message || "",
        PORTAL_LINK: `${siteBaseUrl}/portal`,
      },
      subject: subjects[data.template],
    });

    if (!emailResult.success) {
      console.error("[send-cancellation-notification] Email failed:", emailResult.error);
      throw new Error(emailResult.error);
    }

    console.log(`[send-cancellation-notification] Email sent successfully: ${emailResult.id}`);

    return new Response(JSON.stringify({ success: true, id: emailResult.id }), {
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
