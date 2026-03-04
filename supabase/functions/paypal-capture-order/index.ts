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

    // ── Step 2: Extract & log production-grade proof ──────────────
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id;
    const amountValue = capture?.amount?.value;
    const currencyCode = capture?.amount?.currency_code;
    const customId = captureData.purchase_units?.[0]?.custom_id;
    const amount = parseFloat(amountValue || "0");
    const paypalOrderStatus = captureData.status;

    // ★ PROOF 1: Full PayPal capture proof logged server-side
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
      console.error("[PayPal Capture] ✗ Order NOT completed:", paypalOrderStatus);
      throw new Error(`Payment not completed: ${paypalOrderStatus}`);
    }

    if (!captureId) {
      console.error("[PayPal Capture] ✗ No capture_id in response");
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

    // Use invoice_id from request body, fallback to custom_id from PayPal
    const invoiceId = body.invoice_id || customId;

    // ── Step 3: Idempotency check — prevent double processing ────
    const { data: existingPayment } = await supabase
      .from("billing_payments")
      .select("id")
      .eq("provider_payment_id", captureId)
      .maybeSingle();

    if (existingPayment) {
      console.log("[PayPal Capture] ⚡ Already processed (idempotent):", captureId);
      return new Response(
        JSON.stringify({
          success: true,
          capture_id: captureId,
          amount,
          status: "COMPLETED",
          already_processed: true,
          capture_proof: captureProof,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 4: Update billing system (DB "transaction") ─────────
    let invoiceUpdated = false;
    let customerEmail = "";
    let customerName = "";
    let invoiceNumber = "";
    let updatedInvoice: any = null;

    if (invoiceId) {
      // ─── Try V2: billing_invoices ───
      const { data: v2Invoice, error: v2Error } = await supabase
        .from("billing_invoices")
        .select("*, customer:billing_customers(*)")
        .eq("id", invoiceId)
        .maybeSingle();

      if (v2Error) console.error("[PayPal Capture] V2 invoice lookup error:", v2Error);

      if (v2Invoice) {
        console.log("[PayPal Capture] Found V2 invoice:", v2Invoice.id, "total:", v2Invoice.total);

        // 4a. Insert payment record
        const { data: paymentRecord, error: paymentError } = await supabase
          .from("billing_payments")
          .insert({
            invoice_id: v2Invoice.id,
            customer_id: v2Invoice.customer_id,
            amount: amount,
            method: "paypal",
            provider: "paypal",
            provider_payment_id: captureId,
            status: "confirmed",
            received_at: new Date().toISOString(),
            source: "portal",
            created_by_name: "PayPal Capture",
            created_by_role: "system",
          })
          .select()
          .single();

        if (paymentError) {
          console.error("[PayPal Capture] ✗ Payment insert error:", paymentError);
          // If unique constraint violation, it's a duplicate — still succeed
          if (paymentError.code === "23505") {
            console.log("[PayPal Capture] ⚡ Duplicate payment insert (idempotent)");
          } else {
            throw new Error(`Failed to record payment: ${paymentError.message}`);
          }
        } else {
          console.log("[PayPal Capture] ✓ Payment recorded:", paymentRecord.id);
        }

        // 4b. Recalculate invoice amounts
        const newAmountPaid = (v2Invoice.amount_paid || 0) + amount;
        const newBalanceDue = Math.max(0, v2Invoice.total - newAmountPaid);
        const isPaid = newBalanceDue <= 0;

        const { error: invoiceUpdateError } = await supabase
          .from("billing_invoices")
          .update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: isPaid ? "paid" : "pending",
            paid_at: isPaid ? new Date().toISOString() : null,
            payment_method: "paypal",
            billing_snapshot_payment: isPaid ? {
              method: "paypal",
              paid_at: new Date().toISOString(),
              transaction_id: captureId,
              amount: amount,
              currency: currencyCode,
            } : null,
          })
          .eq("id", v2Invoice.id);

        if (invoiceUpdateError) {
          console.error("[PayPal Capture] ✗ Invoice update error:", invoiceUpdateError);
        } else {
          console.log("[PayPal Capture] ✓ Invoice updated:", {
            invoice_id: v2Invoice.id,
            new_amount_paid: newAmountPaid,
            new_balance_due: newBalanceDue,
            status: isPaid ? "paid" : "pending",
          });
        }

        invoiceUpdated = true;
        invoiceNumber = v2Invoice.invoice_number;

        // 4c. Activate subscription if fully paid
        if (isPaid && v2Invoice.subscription_id) {
          await supabase
            .from("billing_subscriptions")
            .update({ status: "active", auto_billing_enabled: true })
            .eq("id", v2Invoice.subscription_id);
          console.log("[PayPal Capture] ✓ Subscription activated:", v2Invoice.subscription_id);
        }

        if (v2Invoice.customer) {
          customerEmail = v2Invoice.customer.email;
          customerName = `${v2Invoice.customer.first_name} ${v2Invoice.customer.last_name}`;
        }

        // Return updated invoice data for frontend
        updatedInvoice = {
          id: v2Invoice.id,
          invoice_number: v2Invoice.invoice_number,
          total: v2Invoice.total,
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: isPaid ? "paid" : "pending",
          paid_at: isPaid ? new Date().toISOString() : null,
        };
      }

      // ─── Fallback: Legacy billing table ───
      if (!invoiceUpdated) {
        const { data: legacyInvoice } = await supabase
          .from("billing")
          .select("*, profile:profiles!billing_user_id_fkey(full_name, email)")
          .eq("id", invoiceId)
          .maybeSingle();

        if (legacyInvoice) {
          console.log("[PayPal Capture] Found legacy invoice:", legacyInvoice.id);

          const currentAmountPaid = Number(legacyInvoice.amount_paid) || 0;
          const newAmountPaid = currentAmountPaid + amount;
          const invoiceTotal = Number(legacyInvoice.amount) || 0;
          const newBalanceDue = Math.max(0, invoiceTotal - newAmountPaid);
          const isPaid = newBalanceDue <= 0;

          await supabase
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
            .eq("id", invoiceId);

          // Insert into legacy payments table with provider_payment_id for idempotency
          await supabase.from("payments").insert({
            user_id: legacyInvoice.user_id,
            amount: amount,
            payment_method: "paypal",
            reference_number: captureId,
            payment_reference: captureId,
            provider_payment_id: captureId,
            notes: `Paiement PayPal automatique - Capture ID: ${captureId}`,
            billing_id: invoiceId,
            status: "completed",
            source: "portal",
          });

          invoiceUpdated = true;
          invoiceNumber = legacyInvoice.invoice_number || invoiceId.slice(0, 8);
          customerEmail = legacyInvoice.profile?.email || legacyInvoice.client_email || "";
          customerName = legacyInvoice.profile?.full_name || "";

          updatedInvoice = {
            id: invoiceId,
            invoice_number: invoiceNumber,
            total: invoiceTotal,
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: isPaid ? "paid" : "partial",
            paid_at: isPaid ? new Date().toISOString() : null,
          };
        }
      }

      // Queue confirmation email
      if (invoiceUpdated && customerEmail) {
        await supabase.from("email_queue").insert({
          event_key: `paypal_payment_${captureId}`,
          to_email: normalizeEmail(customerEmail),
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
        console.log("[PayPal Capture] ✓ Confirmation email queued to:", customerEmail);
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
      },
    });

    // ── Step 5: Return enriched response with capture proof ──────
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
