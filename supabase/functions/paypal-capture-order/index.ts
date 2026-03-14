import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CapturePayPalOrderRequest {
  paypal_order_id: string;
  invoice_id?: string;
  order_id?: string;
  customer_id?: string;
}

function normalizeEmail(email: string | undefined | null): string {
  return (email || "").trim().toLowerCase();
}

async function ensureBillingCustomer(
  supabase: ReturnType<typeof createClient>,
  email: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<string | null> {
  const normEmail = normalizeEmail(email);
  if (!normEmail) return null;

  const { data: existing } = await supabase
    .from("billing_customers")
    .select("id")
    .eq("email", normEmail)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: newCustomer, error } = await supabase
    .from("billing_customers")
    .insert({
      email: normEmail,
      first_name: firstName || "Client",
      last_name: lastName || "PayPal",
      phone: phone || "",
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[PayPal Capture] Failed to create billing_customer:", error);
    return null;
  }
  return newCustomer.id;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) throw new Error("Failed to get PayPal access token");
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CapturePayPalOrderRequest = await req.json();
    console.log("[PayPal Capture] ▶ Capturing order:", body.paypal_order_id, "invoice_id:", body.invoice_id);

    if (!body.paypal_order_id) throw new Error("Missing paypal_order_id");

    const accessToken = await getPayPalAccessToken();

    // ── Step 1: Capture the PayPal order ────────────────────────────
    const captureResponse = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${body.paypal_order_id}/capture`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!captureResponse.ok) {
      const error = await captureResponse.text();
      console.error("[PayPal Capture] ✗ Capture API error:", error);
      throw new Error(`PayPal capture failed: ${error}`);
    }

    const captureData = await captureResponse.json();

    // ── Step 2: Extract & validate capture data ──────────────────
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id;
    const amountValue = capture?.amount?.value;
    const currencyCode = capture?.amount?.currency_code;
    const customId = captureData.purchase_units?.[0]?.custom_id;
    const amount = parseFloat(amountValue || "0");
    const paypalOrderStatus = captureData.status;

    const captureProof = {
      paypal_order_id: body.paypal_order_id,
      paypal_order_status: paypalOrderStatus,
      capture_id: captureId,
      capture_status: capture?.status,
      amount_value: amountValue,
      currency_code: currencyCode,
      custom_id: customId,
      payer_email: normalizeEmail(captureData.payer?.email_address),
      payer_name: `${captureData.payer?.name?.given_name || ""} ${captureData.payer?.name?.surname || ""}`.trim(),
    };
    console.log("[PayPal Capture] ★ CAPTURE PROOF:", JSON.stringify(captureProof));

    if (paypalOrderStatus !== "COMPLETED") {
      throw new Error(`Payment not completed: ${paypalOrderStatus}`);
    }
    if (!captureId) {
      throw new Error("No capture ID in PayPal response");
    }

    // Extract payer info
    const payerEmail = normalizeEmail(captureData.payer?.email_address);
    const payerFirstName = captureData.payer?.name?.given_name || "";
    const payerLastName = captureData.payer?.name?.surname || "";
    const payerPhone = captureData.payer?.phone?.phone_number?.national_number || "";

    // Ensure billing_customer exists
    let linkedCustomerId: string | null = body.customer_id || null;
    if (payerEmail && !linkedCustomerId) {
      linkedCustomerId = await ensureBillingCustomer(supabase, payerEmail, payerFirstName, payerLastName, payerPhone);
    }

    // Resolve invoice_id: request body > PayPal custom_id
    const invoiceId = body.invoice_id || customId;

    // ── Step 3: Apply payment via transactional DB function ──────
    let paymentResult: any = null;
    let invoiceUpdated = false;
    let updatedInvoice: any = null;

    if (invoiceId) {
      // Try V2 billing_invoices first
      const { data: v2Invoice } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total, customer:billing_customers(email, first_name, last_name)")
        .eq("id", invoiceId)
        .maybeSingle();

      if (v2Invoice) {
        // ★ USE THE TRANSACTIONAL DB FUNCTION ★
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "apply_payment_to_invoice",
          {
            p_invoice_id: v2Invoice.id,
            p_amount: amount,
            p_method: "paypal",
            p_provider: "paypal",
            p_provider_payment_id: captureId,
            p_provider_order_id: body.paypal_order_id,
            p_source: "portal",
            p_created_by_name: "PayPal Capture",
            p_created_by_role: "system",
            p_customer_id: linkedCustomerId,
          }
        );

        if (rpcError) {
          console.error("[PayPal Capture] ✗ apply_payment_to_invoice error:", rpcError);
          throw new Error(`Failed to apply payment: ${rpcError.message}`);
        }

        paymentResult = rpcResult;
        invoiceUpdated = paymentResult?.success === true;

        if (invoiceUpdated) {
          console.log("[PayPal Capture] ✓ Payment applied via DB function:", paymentResult);

          updatedInvoice = {
            id: v2Invoice.id,
            invoice_number: paymentResult.invoice_number || v2Invoice.invoice_number,
            total: v2Invoice.total,
            amount_paid: paymentResult.new_amount_paid,
            balance_due: paymentResult.new_balance_due,
            status: paymentResult.invoice_status,
            paid_at: paymentResult.is_fully_paid ? new Date().toISOString() : null,
          };

          // Queue confirmation email
          const customerEmail = v2Invoice.customer?.email;
          const customerName = `${v2Invoice.customer?.first_name || ""} ${v2Invoice.customer?.last_name || ""}`.trim();

          if (customerEmail && !paymentResult.already_processed) {
            await supabase.from("email_queue").insert({
              event_key: `paypal_payment_${captureId}`,
              to_email: normalizeEmail(customerEmail),
              template_key: "payment_confirmed",
              template_vars: {
                client_name: customerName || "Client",
                amount: amount.toFixed(2),
                invoice_number: v2Invoice.invoice_number,
                payment_method: "PayPal",
                reference: captureId,
              },
              status: "queued",
              attempts: 0,
              max_attempts: 5,
            });
            console.log("[PayPal Capture] ✓ Confirmation email queued to:", customerEmail);
          }
        }
      } else {
        // Legacy billing table access has been permanently removed.
        // All invoices must exist in billing_invoices (canonical Core table).
        console.warn("[PayPal Capture] ⚠ Invoice ID not found in billing_invoices — no legacy fallback. invoice_id:", invoiceId);
      }
    }

    // ── Update orders table if order_id provided ─────────────────
    if (body.order_id) {
      await supabase
        .from("orders")
        .update({
          payment_status: "captured",
          payment_method: "paypal",
          payment_reference: captureId,
        })
        .eq("id", body.order_id);
    }

    // ── Activity log ─────────────────────────────────────────────
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "paypal_capture",
      entity_id: body.order_id || invoiceId || null,
      action: "completed",
      details: {
        ...captureProof,
        invoice_updated: invoiceUpdated,
        linked_customer_id: linkedCustomerId,
        db_function_result: paymentResult,
      },
    });

    console.log("[PayPal Capture] ★ COMPLETE — capture_id:", captureId, "invoice_updated:", invoiceUpdated);

    return new Response(
      JSON.stringify({
        success: true,
        capture_id: captureId,
        amount,
        currency: currencyCode,
        status: "COMPLETED",
        payer_email: payerEmail,
        linked_customer_id: linkedCustomerId,
        invoice_updated: invoiceUpdated,
        already_processed: paymentResult?.already_processed || false,
        updated_invoice: updatedInvoice,
        capture_proof: captureProof,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[PayPal Capture] ✗ Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
