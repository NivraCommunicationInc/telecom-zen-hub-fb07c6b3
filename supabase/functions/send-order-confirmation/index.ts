import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

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
  console.log(`[${requestId}] send-order-confirmation invoked`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendTemplateId = Deno.env.get("RESEND_TEMPLATE_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supportEmail = Deno.env.get("SUPPORT_EMAIL") || "Support@nivratelecom.ca";

    if (!resendApiKey) {
      console.error(`[${requestId}] RESEND_API_KEY not configured`);
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendTemplateId) {
      console.error(`[${requestId}] RESEND_TEMPLATE_ID not configured`);
      return new Response(JSON.stringify({ error: "Email template not configured" }), {
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
    console.log(`[${requestId}] Request body (order_id: ${body.order_id}, order_number: ${body.order_number}, force: ${body.force || false})`);

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

    // Validate required fields
    if (!order_id || !client_email || !order_number) {
      console.error(`[${requestId}] Missing required fields`);
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
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingOrder?.confirmation_email_sent_at) {
        console.log(`[${requestId}] Email already sent at ${existingOrder.confirmation_email_sent_at}, skipping (use force=true to override)`);
        return new Response(JSON.stringify({ 
          success: true, 
          already_sent: true,
          sent_at: existingOrder.confirmation_email_sent_at,
          message: "Email already sent for this order"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.log(`[${requestId}] Force mode enabled, bypassing idempotency check`);
    }

    // Build template variables - must match Resend template placeholders EXACTLY
    const deliveryTypeLabel = delivery_method === "technician" 
      ? "Installation par technicien" 
      : delivery_method === "uber" 
        ? "Livraison Uber Express"
        : delivery_method === "auto"
          ? "Auto-installation"
          : delivery_method || "Standard";

    // Build services list as comma-separated string
    const servicesList = (services || [])
      .map(s => `${s.name} (${formatCurrency(s.price)}${s.period ? `/${s.period}` : ''})`)
      .join(", ");

    // Template variables matching Resend template placeholders
    const templateVariables = {
      ORDER_NUMBER: order_number,
      CLIENT_FIRST_NAME: client_first_name || "Client",
      SERVICES_LIST: servicesList || "Services commandés",
      DELIVERY_TYPE: deliveryTypeLabel,
      TOTAL_MONTHLY_TAX_INCL: formatCurrency(monthly_total_tax_in),
      TOTAL_ONE_TIME_TAX_INCL: formatCurrency(one_time_total),
    };

    // Log template info (mask email for privacy)
    const maskedEmail = client_email.replace(/(.{2})(.*)(@.*)/, "$1***$3");
    console.log(`[${requestId}] Template ID: ${resendTemplateId}`);
    console.log(`[${requestId}] Template variables keys: ${Object.keys(templateVariables).join(", ")}`);
    console.log(`[${requestId}] Template variables values:`, JSON.stringify({
      ...templateVariables,
      _to: maskedEmail,
    }));

    // Send email via Resend using template API (correct format)
    console.log(`[${requestId}] Sending templated email to ${maskedEmail}`);
    
    const fromEmail = supportEmail.includes("@") ? supportEmail : "noreply@nivratelecom.ca";
    
    const emailResult = await resend.emails.send({
      from: `Nivra Telecom <${fromEmail}>`,
      to: [client_email],
      subject: `Confirmation de commande — ${order_number}`,
      // Use Resend template feature with correct API format
      // DO NOT include html, text, or react when using template
      template: {
        id: resendTemplateId,
        variables: templateVariables,
      },
    } as any); // Type cast needed as resend types may not include template

    console.log(`[${requestId}] Resend API response:`, JSON.stringify(emailResult));

    if (emailResult.error) {
      console.error(`[${requestId}] Resend error:`, JSON.stringify(emailResult.error));
      
      // Log to email_queue for retry/tracking
      await supabase.from("email_queue").insert({
        event_key: `order_confirmation_${order_id}`,
        template_key: "nivra_order_confirmation_fr",
        to_email: client_email,
        status: "failed",
        last_error: JSON.stringify(emailResult.error),
        template_vars: templateVariables as any,
      });

      return new Response(JSON.stringify({ 
        success: false, 
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
    console.log(`[${requestId}] Resend message ID: ${resendMessageId}`);

    // Mark email as sent (idempotency) IMMEDIATELY after successful send
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
      provider_message_id: resendMessageId || null,
      template_vars: templateVariables as any,
    });

    return new Response(JSON.stringify({ 
      success: true,
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
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred",
      request_id: requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
