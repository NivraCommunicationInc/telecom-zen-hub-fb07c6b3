import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceBillingRateLimit } from "../_shared/billingRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChargeSubscriptionRequest {
  subscription_id: string;
  invoice_id: string;
  amount: number;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[PayPal] Token error:", error);
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Charge a PayPal subscription for recurring billing
 * Uses PayPal Billing Agreement to create a payment
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = await enforceBillingRateLimit(req, "paypal-charge-subscription", corsHeaders);
  if (rl) return rl;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ChargeSubscriptionRequest = await req.json();
    console.log("[PayPal Charge] Processing subscription:", body.subscription_id);

    if (!body.subscription_id || !body.invoice_id || !body.amount) {
      throw new Error("Missing required fields: subscription_id, invoice_id, amount");
    }

    // Get subscription details with PayPal subscription ID
    const { data: subscription, error: subError } = await supabase
      .from("billing_subscriptions")
      .select(`
        *,
        customer:billing_customers(id, email, first_name, last_name)
      `)
      .eq("id", body.subscription_id)
      .single();

    if (subError || !subscription) {
      throw new Error(`Subscription not found: ${body.subscription_id}`);
    }

    // Check if subscription has a PayPal billing agreement
    const paypalSubscriptionId = subscription.paypal_subscription_id;
    
    if (!paypalSubscriptionId) {
      // No PayPal agreement - create manual invoice for Interac payment
      console.log("[PayPal Charge] No PayPal subscription ID, using Interac method");
      return new Response(
        JSON.stringify({
          success: false,
          method: "interac",
          message: "Subscription does not have PayPal auto-billing enabled",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getPayPalAccessToken();

    // Get subscription status from PayPal
    const subStatusResponse = await fetch(
      `https://api-m.paypal.com/v1/billing/subscriptions/${paypalSubscriptionId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!subStatusResponse.ok) {
      const error = await subStatusResponse.text();
      console.error("[PayPal Charge] Subscription status error:", error);
      throw new Error(`Failed to get PayPal subscription status: ${error}`);
    }

    const subStatus = await subStatusResponse.json();
    console.log("[PayPal Charge] PayPal subscription status:", subStatus.status);

    // Only charge if subscription is ACTIVE
    if (subStatus.status !== "ACTIVE") {
      return new Response(
        JSON.stringify({
          success: false,
          error: `PayPal subscription is not active: ${subStatus.status}`,
          status: subStatus.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For PayPal subscriptions, PayPal handles the billing automatically
    // We just need to check if a payment was made and record it
    const transactionsResponse = await fetch(
      `https://api-m.paypal.com/v1/billing/subscriptions/${paypalSubscriptionId}/transactions?start_time=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}&end_time=${new Date().toISOString()}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!transactionsResponse.ok) {
      const error = await transactionsResponse.text();
      console.error("[PayPal Charge] Transactions fetch error:", error);
    }

    const transactions = await transactionsResponse.json();
    const latestTransaction = transactions.transactions?.[0];

    if (latestTransaction && latestTransaction.status === "COMPLETED") {
      const captureId = latestTransaction.id;
      const amount = parseFloat(latestTransaction.amount_with_breakdown?.gross_amount?.value || body.amount);

      // Record the payment
      const { error: paymentError } = await supabase
        .from("billing_payments")
        .insert({
          invoice_id: body.invoice_id,
          customer_id: subscription.customer_id,
          amount: amount,
          method: "paypal",
          provider: "paypal",
          provider_payment_id: captureId,
          status: "confirmed",
          received_at: new Date().toISOString(),
          source: "live",
        });

      if (paymentError) {
        console.error("[PayPal Charge] Payment record error:", paymentError);
      } else {
        // Update invoice to paid
        const { data: invoice } = await supabase
          .from("billing_invoices")
          .select("id, order_id, invoice_number, total, amount_paid")
          .eq("id", body.invoice_id)
          .single();

        if (invoice) {
          const newAmountPaid = (invoice.amount_paid || 0) + amount;
          const newBalanceDue = invoice.total - newAmountPaid;

          await supabase
            .from("billing_invoices")
            .update({
              amount_paid: newAmountPaid,
              balance_due: newBalanceDue,
              status: newBalanceDue <= 0 ? "paid" : "pending",
              paid_at: newBalanceDue <= 0 ? new Date().toISOString() : null,
              payment_method: "paypal",
            })
            .eq("id", body.invoice_id);
        }

        // Queue confirmation email (with receipt PDF, non-blocking)
        if (subscription.customer) {
          const { buildReceiptPdfAttachment } = await import("../_shared/pdfFromDb.ts");
          const pdfAttachment = await buildReceiptPdfAttachment(body.invoice_id, "recu-paiement");

          await supabase.from("email_queue").insert({
            event_key: `paypal_auto_${captureId}`,
            to_email: subscription.customer.email,
            template_key: "payment_confirmed",
            template_vars: {
              client_name: `${subscription.customer.first_name} ${subscription.customer.last_name}`,
              amount: amount.toFixed(2),
              amount_paid_today: amount.toFixed(2),
              total_payable: Number(invoice?.total || body.amount).toFixed(2),
              invoice_id: body.invoice_id,
              invoice_number: invoice?.invoice_number || undefined,
              order_id: invoice?.order_id || undefined,
              payment_method: "PayPal (Prélèvement automatique)",
              reference: captureId,
            },
            attachments: pdfAttachment ? [pdfAttachment] : null,
            status: "queued",
            attempts: 0,
            max_attempts: 5,
          });
        }

        console.log("[PayPal Charge] Payment recorded successfully:", captureId);

        return new Response(
          JSON.stringify({
            success: true,
            capture_id: captureId,
            amount,
            method: "paypal_auto",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // No completed transaction found - PayPal will charge automatically
    return new Response(
      JSON.stringify({
        success: true,
        message: "PayPal subscription is active, payment will be processed automatically by PayPal",
        status: subStatus.status,
        next_billing_time: subStatus.billing_info?.next_billing_time,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[PayPal Charge] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
