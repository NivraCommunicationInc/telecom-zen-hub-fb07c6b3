import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_TEMPLATE_MAP: Record<string, { templateKey: string; label: string }> = {
  active: { templateKey: "service_activated", label: "Service actif" },
  paused: { templateKey: "service_suspended", label: "Service suspendu" },
  cancelled: { templateKey: "cancellation_completed", label: "Service annulé" },
  technical_issue: { templateKey: "ticket_created", label: "Problème technique" },
  resumed: { templateKey: "service_reactivated", label: "Service rétabli" },
};

interface ServiceStatusEmailRequest {
  client_id: string;
  client_email: string;
  client_first_name?: string;
  client_phone?: string;
  service_instance_id: string;
  service_name: string;
  service_type: string;
  new_status: string;
  old_status?: string;
  reason?: string;
  order_id?: string; // Optional — when present, attach order summary PDF on activation
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ServiceStatusEmailRequest = await req.json();
    const { client_id, client_email, client_first_name, client_phone, service_instance_id, service_name, service_type, new_status, reason } = body;

    console.log(`[${requestId}] Service status email: service=${service_name}, status=${new_status}`);

    if (!client_id || !client_email || !service_instance_id || !service_name || !new_status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusConfig = STATUS_TEMPLATE_MAP[new_status];
    if (!statusConfig) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Status not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventKey = `service_status_${service_instance_id}_${new_status}`;

    // FIX 4: attach order summary PDF for service activation (non-blocking)
    let attachments: Array<{ filename: string; content: string; contentType: string }> | undefined;
    if (body.order_id && (new_status === "active" || new_status === "resumed")) {
      try {
        const { buildSummaryPdfAttachment } = await import("../_shared/pdfFromDb.ts");
        const pdf = await buildSummaryPdfAttachment(body.order_id, "confirmation-activation");
        if (pdf) attachments = [pdf];
      } catch (e) {
        console.warn(`[${requestId}] Activation summary PDF generation failed:`, e);
      }
    }

    const result = await queueRenderedEmail({
      eventKey,
      templateKey: statusConfig.templateKey,
      toEmail: client_email,
      templateVars: {
        client_name: client_first_name || "Client",
        service_name,
        service_type,
        status_label: statusConfig.label,
        reason: reason || "",
        portal_path: "/portal/services",
      },
      attachments,
    });

    console.log(`[${requestId}] Email ${result.alreadyQueued ? "already queued" : "queued"} template: ${statusConfig.templateKey}${attachments ? " (with summary PDF)" : ""}`);

    // SMS
    let phoneForSms = client_phone;
    if (!phoneForSms) {
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, client_email, client_id);
      phoneForSms = phoneResult.phone || undefined;
    }

    if (phoneForSms && toE164(phoneForSms)) {
      let smsMessage: string | null = null;
      switch (new_status) {
        case "active": case "resumed":
          smsMessage = SMS_TEMPLATES.serviceActivated({ clientName: client_first_name || "Client", serviceName: service_name });
          break;
        case "suspended": case "cancelled":
          smsMessage = SMS_TEMPLATES.serviceSuspended({ clientName: client_first_name || "Client", serviceName: service_name });
          break;
      }
      if (smsMessage) {
        await sendSmsNotification({ to: phoneForSms, message: smsMessage, clientId: client_id, eventType: `service_${new_status}`, eventKey: `service_${service_instance_id}_${new_status}` });
      }
    }

    return new Response(JSON.stringify({ success: true, queued: true, template: statusConfig.templateKey }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
