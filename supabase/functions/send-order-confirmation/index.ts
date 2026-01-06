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
  console.log(`[${requestId}] send-order-confirmation invoked`);

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
    const resendTemplateId = Deno.env.get("RESEND_TEMPLATE_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supportEmail = Deno.env.get("SUPPORT_EMAIL") || "Support@nivratelecom.ca";

    if (!resendApiKey) {
      console.error(`[${requestId}] RESEND_API_KEY not configured`);
      logResult("error", { error: "RESEND_API_KEY not configured" });
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendTemplateId) {
      console.error(`[${requestId}] RESEND_TEMPLATE_ID not configured`);
      logResult("error", { error: "RESEND_TEMPLATE_ID not configured" });
      return new Response(JSON.stringify({ error: "Email template not configured" }), {
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

    // Build SERVICES_LIST as multi-line string with bullets
    // Format: "• Service Name — XX.XX$/mois"
    const servicesList = (services || [])
      .map(s => {
        const periodLabel = s.period === "30 jours" ? "/30 jours" : "/mois";
        return `• ${s.name} — ${formatCurrency(s.price)}${periodLabel}`;
      })
      .join("\n");

    // Template variables matching Resend template placeholders EXACTLY (case sensitive)
    const templateVariables = {
      ORDER_NUMBER: order_number,
      CLIENT_FIRST_NAME: client_first_name || "Client",
      SERVICES_LIST: servicesList || "• Services commandés",
      DELIVERY_TYPE: deliveryTypeLabel,
      TOTAL_MONTHLY_TAX_INCL: formatCurrency(monthly_total_tax_in),
      TOTAL_ONE_TIME_TAX_INCL: formatCurrency(one_time_total),
    };

    // Log template info
    console.log(`[${requestId}] template_id_used=${resendTemplateId}`);
    console.log(`[${requestId}] variables_keys=${Object.keys(templateVariables).join(", ")}`);
    console.log(`[${requestId}] Template variables:`, JSON.stringify(templateVariables, null, 2));

    // Build email subject matching template
    const emailSubject = `Confirmation de commande — ${order_number} | Nivra Télécom`;
    
    // Determine from email
    const fromEmail = supportEmail.includes("@") ? supportEmail : "noreply@nivratelecom.ca";
    
    console.log(`[${requestId}] Sending email via Resend Templates API...`);
    console.log(`[${requestId}] from: Nivra Telecom <${fromEmail}>`);
    console.log(`[${requestId}] subject: ${emailSubject}`);

    // Send email via Resend using TEMPLATE API
    // DO NOT include html, text, or react when using template
    const emailPayload = {
      from: `Nivra Telecom <${fromEmail}>`,
      to: [client_email],
      subject: emailSubject,
      template: {
        id: resendTemplateId,
        variables: templateVariables,
      },
    };

    console.log(`[${requestId}] Resend payload (without sensitive data):`, JSON.stringify({
      from: emailPayload.from,
      to: [maskEmail(client_email)],
      subject: emailPayload.subject,
      template: { id: resendTemplateId, variables_keys: Object.keys(templateVariables) }
    }));

    // Type cast needed as resend types may not include template
    const emailResult = await resend.emails.send(emailPayload as any);

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
        template_key: "nivra_order_confirmation_fr",
        to_email: client_email,
        status: "failed",
        last_error: JSON.stringify(emailResult.error),
        template_vars: templateVariables as any,
      });

      logResult("error", {
        order_id,
        order_number,
        to_email: maskEmail(client_email),
        template_id_used: resendTemplateId,
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
    console.log(`[${requestId}] ✅ Email sent successfully via TEMPLATE`);
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
      template_key: "nivra_order_confirmation_fr",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: resendMessageId || null,
      template_vars: templateVariables as any,
    });

    logResult("sent", {
      order_id,
      order_number,
      to_email: maskEmail(client_email),
      template_id_used: resendTemplateId,
      variables_keys: Object.keys(templateVariables),
      resend_message_id: resendMessageId,
      forced: force,
    });

    console.log(`[${requestId}] ========================================`);

    return new Response(JSON.stringify({ 
      success: true,
      status: "sent",
      message_id: resendMessageId,
      template_id: resendTemplateId,
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
