/**
 * ============================================================================
 * PAYPAL REFUND — Full & Partial Refunds via PayPal Captures API
 * ============================================================================
 * Entry point: POST /paypal-refund
 * Body: {
 *   payment_id: string        — billing_payments.id
 *   amount?: number           — partial refund amount (omit for full refund)
 *   reason: string            — refund reason (required)
 *   invoice_id?: string       — billing_invoices.id (optional override)
 * }
 *
 * Flow:
 *  1. Authenticate admin via JWT
 *  2. Look up billing_payment → get PayPal capture ID
 *  3. Call PayPal Captures Refund API
 *  4. Update billing_payments status
 *  5. Update billing_invoices status + balance
 *  6. Log admin audit
 *  7. Queue refund email notification
 * ============================================================================
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RefundRequest {
  payment_id: string;
  amount?: number;
  reason: string;
  invoice_id?: string;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const PAYPAL_API = Deno.env.get("PAYPAL_API_URL") || "https://api-m.paypal.com";
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: require admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const anonClient = createClient<any>(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminId = userData.user.id;
    const { data: adminCheck } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", adminId)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RefundRequest = await req.json();
    const { payment_id, amount, reason, invoice_id: overrideInvoiceId } = body;

    if (!payment_id || !reason) {
      return new Response(
        JSON.stringify({ error: "payment_id and reason are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1: Look up payment ──
    const { data: payment, error: payErr } = await supabase
      .from("billing_payments")
      .select("id, amount, status, provider_payment_id, method, invoice_id, customer_id, payment_number")
      .eq("id", payment_id)
      .single();

    if (payErr || !payment) {
      return new Response(
        JSON.stringify({ error: "Payment not found", details: payErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payment.status === "refunded") {
      return new Response(
        JSON.stringify({ error: "Payment already refunded" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const captureId = payment.provider_payment_id;
    if (!captureId) {
      return new Response(
        JSON.stringify({ error: "No PayPal capture ID found on this payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refundAmount = amount ? Math.round(amount * 100) / 100 : payment.amount;
    const isPartial = amount !== undefined && amount < payment.amount;

    if (refundAmount > Number(payment.amount)) {
      return new Response(
        JSON.stringify({
          error: `Montant de remboursement (${refundAmount.toFixed(2)} $ CAD) supérieur au paiement original (${Number(payment.amount).toFixed(2)} $ CAD)`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 2: Call PayPal Refund API ──
    const accessToken = await getPayPalAccessToken();
    const PAYPAL_API = Deno.env.get("PAYPAL_API_URL") || "https://api-m.paypal.com";

    const refundBody: Record<string, unknown> = {};
    if (isPartial) {
      refundBody.amount = {
        value: refundAmount.toFixed(2),
        currency_code: "CAD",
      };
    }
    refundBody.note_to_payer = reason.substring(0, 255);

    console.log(`[PayPalRefund] Refunding capture ${captureId}, amount: ${refundAmount}, partial: ${isPartial}`);

    const refundRes = await fetch(
      `${PAYPAL_API}/v2/payments/captures/${captureId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `refund-${payment_id}-${isPartial ? Math.round((amount ?? 0) * 100) : "full"}`,
        },
        body: JSON.stringify(refundBody),
      }
    );

    if (!refundRes.ok) {
      const errText = await refundRes.text();
      console.error(`[PayPalRefund] PayPal API error: ${refundRes.status}`, errText);
      return new Response(
        JSON.stringify({
          error: "PayPal refund failed",
          paypal_status: refundRes.status,
          details: errText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refundData = await refundRes.json();
    const paypalRefundId = refundData.id;
    const paypalRefundStatus = refundData.status; // COMPLETED or PENDING
    console.log(`[PayPalRefund] PayPal refund ${paypalRefundId} status: ${paypalRefundStatus}`);

    // ── Step 3: Update billing_payments ──
    const newPaymentStatus = isPartial ? "partially_refunded" : "refunded";
    await supabase
      .from("billing_payments")
      .update({
        status: newPaymentStatus as any,
        legacy_note: `[REMBOURSÉ${isPartial ? " PARTIEL" : ""}] ${refundAmount.toFixed(2)} CAD — ${reason} — PayPal Refund: ${paypalRefundId}`,
      })
      .eq("id", payment_id);

    // ── Step 4: Update billing_invoices ──
    const targetInvoiceId = overrideInvoiceId || payment.invoice_id;
    if (targetInvoiceId) {
      const { data: invoice } = await supabase
        .from("billing_invoices")
        .select("id, total, amount_paid, balance_due")
        .eq("id", targetInvoiceId)
        .single();

      if (invoice) {
        const newAmountPaid = Math.max(0, (invoice.amount_paid || 0) - refundAmount);
        const newBalanceDue = Math.max(0, invoice.total - newAmountPaid);
        const newInvoiceStatus = isPartial ? "partially_refunded" : "refunded";

        await supabase
          .from("billing_invoices")
          .update({
            status: newInvoiceStatus as any,
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            notes: `Remboursement ${isPartial ? "partiel" : "complet"}: ${refundAmount.toFixed(2)} CAD — ${reason}`,
          })
          .eq("id", targetInvoiceId);
      }
    }

    // ── Step 5: Admin audit log ──
    await supabase.from("admin_audit_log").insert({
      admin_user_id: adminId,
      admin_email: userData.user.email,
      action: "paypal_refund",
      target_type: "payment",
      target_id: payment_id,
      details: {
        paypal_capture_id: captureId,
        paypal_refund_id: paypalRefundId,
        paypal_refund_status: paypalRefundStatus,
        amount_refunded: refundAmount,
        is_partial: isPartial,
        reason,
        invoice_id: targetInvoiceId,
        payment_number: payment.payment_number,
      },
    });

    // ── Step 6: Queue refund notification email ──
    if (payment.customer_id) {
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("email, first_name, last_name")
        .eq("id", payment.customer_id)
        .single();

      if (customer?.email) {
        const { data: invoiceData } = targetInvoiceId
          ? await supabase
              .from("billing_invoices")
              .select("invoice_number")
              .eq("id", targetInvoiceId)
              .single()
          : { data: null };

        const refundEventKey = `paypal_refund_${payment.id}`;
        await supabase.from("email_queue").insert({
          event_key: refundEventKey,
          idempotency_key: refundEventKey,
          to_email: customer.email,
          template_key: "refund_issued",
          template_vars: {
            client_name: `${customer.first_name} ${customer.last_name}`,
            invoice_number: invoiceData?.invoice_number || payment.payment_number,
            refund_amount: refundAmount,
            amount: refundAmount,
            refund_method: "PayPal",
            reason,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 3,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: isPartial ? "partially_refunded" : "refunded",
        paypal_refund_id: paypalRefundId,
        paypal_refund_status: paypalRefundStatus,
        amount_refunded: refundAmount,
        payment_id,
        invoice_id: targetInvoiceId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[PayPalRefund] Error:", err);
    reportEdgeError(err, { function: "paypal-refund" }).catch(() => {});
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
