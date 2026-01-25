import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CapturePayPalOrderRequest {
  paypal_order_id: string;
  invoice_id?: string;
  customer_id?: string;
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
    throw new Error("Failed to get PayPal access token");
  }

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
    console.log("[PayPal] Capturing order:", body.paypal_order_id);

    if (!body.paypal_order_id) {
      throw new Error("Missing paypal_order_id");
    }

    const accessToken = await getPayPalAccessToken();

    // Capture the PayPal order
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
      console.error("[PayPal] Capture error:", error);
      throw new Error(`PayPal capture failed: ${error}`);
    }

    const captureData = await captureResponse.json();
    console.log("[PayPal] Capture result:", captureData.status);

    if (captureData.status !== "COMPLETED") {
      throw new Error(`Payment not completed: ${captureData.status}`);
    }

    // Extract payment details
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id;
    const amount = parseFloat(capture?.amount?.value || "0");
    const customId = captureData.purchase_units?.[0]?.custom_id;

    console.log("[PayPal] Capture ID:", captureId, "Amount:", amount, "CustomId:", customId);

    // If we have an invoice_id, update the billing system
    // Support both legacy "billing" table and new "billing_invoices" table
    if (body.invoice_id) {
      let invoiceUpdated = false;
      let customerEmail = "";
      let customerName = "";
      let invoiceNumber = "";

      // First, try the legacy "billing" table (used by portal)
      const { data: legacyInvoice, error: legacyError } = await supabase
        .from("billing")
        .select("*, profile:profiles!billing_user_id_fkey(full_name, email)")
        .eq("id", body.invoice_id)
        .maybeSingle();

      if (legacyInvoice) {
        console.log("[PayPal] Found invoice in legacy billing table:", legacyInvoice.id);
        
        // Calculate new amounts
        const currentAmountPaid = Number(legacyInvoice.amount_paid) || 0;
        const newAmountPaid = currentAmountPaid + amount;
        const invoiceTotal = Number(legacyInvoice.amount) || 0;
        const newBalanceDue = Math.max(0, invoiceTotal - newAmountPaid);
        const isPaid = newBalanceDue <= 0;

        // Update the legacy billing record
        const { error: updateError } = await supabase
          .from("billing")
          .update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: isPaid ? "paid" : "partial",
            paid_at: isPaid ? new Date().toISOString() : null,
            payment_method_type: "paypal",
            payment_reference: captureId,
            notes: `${legacyInvoice.notes || ""}\n[PayPal] Paiement reçu: ${amount.toFixed(2)}$ - Réf: ${captureId}`.trim(),
          })
          .eq("id", body.invoice_id);

        if (updateError) {
          console.error("[PayPal] Legacy billing update error:", updateError);
        } else {
          console.log("[PayPal] Legacy billing updated successfully");
          invoiceUpdated = true;
          invoiceNumber = legacyInvoice.invoice_number || body.invoice_id.slice(0, 8);
          
          // Get user info for email
          if (legacyInvoice.profile) {
            customerEmail = legacyInvoice.profile.email || legacyInvoice.client_email || "";
            customerName = legacyInvoice.profile.full_name || "";
          } else {
            customerEmail = legacyInvoice.client_email || "";
          }

          // Also insert into payments table for history
          const { error: paymentHistoryError } = await supabase
            .from("payments")
            .insert({
              user_id: legacyInvoice.user_id,
              amount: amount,
              payment_method: "paypal",
              reference_number: captureId,
              payment_reference: captureId,
              notes: `Paiement PayPal automatique - Capture ID: ${captureId}`,
              billing_id: body.invoice_id,
              status: "completed",
              source: "portal",
            });

          if (paymentHistoryError) {
            console.error("[PayPal] Payment history insert error:", paymentHistoryError);
          } else {
            console.log("[PayPal] Payment history recorded successfully");
          }
        }
      } else {
        console.log("[PayPal] Invoice not found in legacy billing, trying billing_invoices...");
      }

      // If not found in legacy table, try billing_invoices (V2 system)
      if (!invoiceUpdated) {
        const { data: invoice, error: invoiceError } = await supabase
          .from("billing_invoices")
          .select("*, customer:billing_customers(*)")
          .eq("id", body.invoice_id)
          .maybeSingle();

        if (invoiceError) {
          console.error("[PayPal] Invoice lookup error:", invoiceError);
        } else if (invoice) {
          console.log("[PayPal] Found invoice in billing_invoices:", invoice.id);
          
        // Create payment record in billing_payments
          const { data: paymentData, error: paymentError } = await supabase
            .from("billing_payments")
            .insert({
              invoice_id: invoice.id,
              customer_id: invoice.customer_id,
              amount: amount,
              method: "paypal",
              provider: "paypal",
              provider_payment_id: captureId,
              status: "confirmed",
              received_at: new Date().toISOString(),
              source: "portal",
            })
            .select()
            .single();
          
          console.log("[PayPal] Payment record created:", paymentData?.id || "success");

          if (paymentError) {
            console.error("[PayPal] Payment record error:", paymentError);
          } else {
            console.log("[PayPal] Payment recorded for invoice:", invoice.id);

            // Update invoice status (trigger will handle balance calculation)
            const newAmountPaid = (invoice.amount_paid || 0) + amount;
            const newBalanceDue = invoice.total - newAmountPaid;
            
            await supabase
              .from("billing_invoices")
              .update({
                amount_paid: newAmountPaid,
                balance_due: newBalanceDue,
                status: newBalanceDue <= 0 ? "paid" : "pending",
                paid_at: newBalanceDue <= 0 ? new Date().toISOString() : null,
              })
              .eq("id", invoice.id);

            invoiceUpdated = true;
            invoiceNumber = invoice.invoice_number;

            // If fully paid, activate subscription and enable auto-billing
            if (newBalanceDue <= 0 && invoice.subscription_id) {
              await supabase
                .from("billing_subscriptions")
                .update({ 
                  status: "active",
                  auto_billing_enabled: true,
                })
                .eq("id", invoice.subscription_id);
            }

            // Get customer info for email
            if (invoice.customer) {
              customerEmail = invoice.customer.email;
              customerName = `${invoice.customer.first_name} ${invoice.customer.last_name}`;
            }
          }
        }
      }

      // Queue confirmation email if we have customer info
      if (invoiceUpdated && customerEmail) {
        await supabase.from("email_queue").insert({
          event_key: `paypal_payment_${captureId}`,
          to_email: customerEmail,
          template_key: "payment_confirmed",
          template_vars: {
            client_name: customerName || "Client",
            amount: amount.toFixed(2),
            invoice_number: invoiceNumber,
            payment_method: "PayPal",
            reference: captureId,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 5,
        });
        console.log("[PayPal] Confirmation email queued to:", customerEmail);
      }
    }

    // Log the successful capture
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "paypal_capture",
      entity_id: captureId,
      action: "completed",
      details: {
        paypal_order_id: body.paypal_order_id,
        invoice_id: body.invoice_id,
        amount,
        payer_email: captureData.payer?.email_address,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        capture_id: captureId,
        amount,
        status: captureData.status,
        payer_email: captureData.payer?.email_address,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[PayPal] Capture error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
