import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";
import { activateSubscriptionForOrder } from "../_shared/activateSubscriptionForOrder.ts";

/**
 * ============================================================================
 * STRIPE — ADMIN ACTIONS (CAPTURE / CANCEL / REFUND)
 * ============================================================================
 *
 * Provides admin controls for manual-capture payment flow.
 * After capture, subscription creation is triggered via the shared
 * activateSubscriptionForOrder function (same as webhook path).
 *
 * All actions require admin authentication.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AdminActionRequest {
  action: "capture" | "cancel" | "refund" | "status";
  payment_intent_id: string;
  payment_id?: string;
  invoice_id?: string;
  amount?: number;
  reason?: string;
  admin_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ═══ STRIPE KILL-SWITCH — 2026-03-21 ═══
  console.warn("[stripe-admin-actions] BLOCKED — Stripe disabled in production");
  return new Response(
    JSON.stringify({ error: "Stripe admin actions are disabled. Use PayPal instead." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) throw new Error("Authentication failed");

    const { data: adminCheck } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminCheck) throw new Error("Admin access required");

    const body: AdminActionRequest = await req.json();
    const { action, payment_intent_id, payment_id, invoice_id, amount, reason, admin_name } = body;

    if (!payment_intent_id) throw new Error("payment_intent_id is required");
    if (!action) throw new Error("action is required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const adminId = userData.user.id;
    const adminLabel = admin_name || userData.user.email || "admin";

    console.log(`[stripe-admin-actions] ${action} on PI ${payment_intent_id} by ${adminLabel}`);

    // ─── STATUS ───
    if (action === "status") {
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
      return new Response(
        JSON.stringify({
          id: pi.id,
          status: pi.status,
          amount: pi.amount / 100,
          amount_capturable: (pi.amount_capturable || 0) / 100,
          amount_received: (pi.amount_received || 0) / 100,
          currency: pi.currency,
          created: new Date(pi.created * 1000).toISOString(),
          livemode: pi.livemode,
          metadata: pi.metadata,
          capture_method: pi.capture_method,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CAPTURE ───
    if (action === "capture") {
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id);

      if (pi.status !== "requires_capture") {
        throw new Error(`Cannot capture: PaymentIntent status is '${pi.status}', expected 'requires_capture'`);
      }

      const captureAmount = amount ? Math.round(amount * 100) : undefined;
      const captured = await stripe.paymentIntents.capture(payment_intent_id, {
        ...(captureAmount ? { amount_to_capture: captureAmount } : {}),
      });

      const capturedAmountDollars = captured.amount_received / 100;

      // Update billing_payments
      if (payment_id) {
        await supabase.from("billing_payments").update({
          status: "confirmed" as any,
          authorization_status: "captured",
          captured_at: new Date().toISOString(),
          captured_by: adminLabel,
          confirmed_by: adminId,
          received_at: new Date().toISOString(),
        }).eq("id", payment_id);
      }

      // Update invoice
      if (invoice_id) {
        const { data: inv } = await supabase.from("billing_invoices")
          .select("amount_paid, total, paid_at")
          .eq("id", invoice_id)
          .single();

        if (inv) {
          const newAmountPaid = (inv.amount_paid ?? 0) + capturedAmountDollars;
          const newBalanceDue = Math.max(0, (inv.total ?? 0) - newAmountPaid);
          const isFullyPaid = newBalanceDue <= 0;

          await supabase.from("billing_invoices").update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: (isFullyPaid ? "paid" : "partially_paid") as any,
            paid_at: isFullyPaid ? new Date().toISOString() : inv.paid_at,
          }).eq("id", invoice_id);
        }
      }

      // Update order authorization status
      if (payment_id) {
        const { data: paymentData } = await supabase.from("billing_payments")
          .select("invoice_id").eq("id", payment_id).single();

        if (paymentData?.invoice_id) {
          const { data: invData } = await supabase.from("billing_invoices")
            .select("order_id").eq("id", paymentData.invoice_id).single();

          if (invData?.order_id) {
            await supabase.from("orders").update({
              payment_authorization_status: "captured",
            }).eq("id", invData.order_id);
          }
        }
      }

      // ═══ ACTIVATE STRIPE SUBSCRIPTION (shared canonical function) ═══
      // Note: The webhook (payment_intent.succeeded) ALSO triggers this.
      // The activateSubscriptionForOrder function is idempotent — safe for both.
      let subscriptionResult: any = null;
      const resolvedInvoiceId = invoice_id || (payment_id ? (await supabase.from("billing_payments")
        .select("invoice_id").eq("id", payment_id).single()).data?.invoice_id : null);

      if (resolvedInvoiceId) {
        try {
          const pmId = typeof captured.payment_method === "string"
            ? captured.payment_method
            : (captured.payment_method as any)?.id || undefined;

          const stripeCustomerId = typeof captured.customer === "string"
            ? captured.customer
            : (captured.customer as any)?.id || undefined;

          subscriptionResult = await activateSubscriptionForOrder({
            stripe,
            supabase,
            invoice_id: resolvedInvoiceId,
            payment_method_id: pmId,
            stripe_customer_id: stripeCustomerId,
            trigger_source: "admin_capture",
          });

          console.log(`[stripe-admin-actions] Subscription activation: ${JSON.stringify({
            activated: subscriptionResult.activated,
            stripe_setup_status: subscriptionResult.stripe_setup_status,
            stripe_subscription_id: subscriptionResult.stripe_subscription_id || null,
          })}`);
        } catch (subErr: any) {
          console.error(`[stripe-admin-actions] Subscription activation error: ${subErr.message}`);
          subscriptionResult = { activated: false, error: subErr.message, stripe_setup_status: "failed" };
        }
      }

      // Audit log
      await supabase.from("admin_audit_log").insert({
        admin_user_id: adminId,
        admin_email: userData.user.email,
        action: "stripe_capture",
        target_type: "payment",
        target_id: payment_id || payment_intent_id,
        details: {
          payment_intent_id,
          amount_captured: capturedAmountDollars,
          invoice_id,
          subscription_result: subscriptionResult ? {
            activated: subscriptionResult.activated,
            stripe_setup_status: subscriptionResult.stripe_setup_status,
            stripe_subscription_id: subscriptionResult.stripe_subscription_id || null,
          } : null,
        },
      });

      console.log(`[stripe-admin-actions] ✓ Captured ${capturedAmountDollars} CAD from PI ${payment_intent_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          action: "captured",
          amount_captured: capturedAmountDollars,
          payment_intent_status: captured.status,
          subscription: subscriptionResult?.stripe_subscription_id ? {
            stripe_subscription_id: subscriptionResult.stripe_subscription_id,
            items: subscriptionResult.items,
            status: subscriptionResult.stripe_setup_status,
          } : subscriptionResult?.stripe_setup_status ? {
            stripe_setup_status: subscriptionResult.stripe_setup_status,
            error: subscriptionResult.error,
          } : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CANCEL ───
    if (action === "cancel") {
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id);

      if (!["requires_capture", "requires_payment_method", "requires_confirmation"].includes(pi.status)) {
        throw new Error(`Cannot cancel: PaymentIntent status is '${pi.status}'`);
      }

      const cancelled = await stripe.paymentIntents.cancel(payment_intent_id, {
        cancellation_reason: "requested_by_customer",
      });

      if (payment_id) {
        await supabase.from("billing_payments").update({
          status: "cancelled" as any,
          authorization_status: "cancelled",
          legacy_note: reason ? `[ANNULÉ] ${reason}` : "[ANNULÉ] Autorisation annulée par admin",
        }).eq("id", payment_id);
      }

      if (invoice_id) {
        await supabase.from("billing_invoices").update({
          status: "unpaid" as any,
        }).eq("id", invoice_id);
      }

      if (payment_id) {
        const { data: paymentData } = await supabase.from("billing_payments")
          .select("invoice_id").eq("id", payment_id).single();

        if (paymentData?.invoice_id) {
          const { data: invData } = await supabase.from("billing_invoices")
            .select("order_id").eq("id", paymentData.invoice_id).single();

          if (invData?.order_id) {
            await supabase.from("orders").update({
              payment_authorization_status: "cancelled",
            }).eq("id", invData.order_id);
          }
        }
      }

      await supabase.from("admin_audit_log").insert({
        admin_user_id: adminId,
        admin_email: userData.user.email,
        action: "stripe_cancel_authorization",
        target_type: "payment",
        target_id: payment_id || payment_intent_id,
        details: { payment_intent_id, reason, invoice_id },
      });

      return new Response(
        JSON.stringify({ success: true, action: "cancelled", payment_intent_status: cancelled.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── REFUND ───
    if (action === "refund") {
      const refundAmount = amount ? Math.round(amount * 100) : undefined;

      const refund = await stripe.refunds.create({
        payment_intent: payment_intent_id,
        ...(refundAmount ? { amount: refundAmount } : {}),
        reason: "requested_by_customer",
      });

      const refundedAmountDollars = refund.amount / 100;

      if (payment_id) {
        await supabase.from("billing_payments").update({
          status: "refunded" as any,
          legacy_note: reason ? `[REMBOURSÉ] ${reason}` : `[REMBOURSÉ] ${refundedAmountDollars} CAD`,
        }).eq("id", payment_id);
      }

      if (invoice_id) {
        await supabase.from("billing_invoices").update({
          status: "refunded" as any,
        }).eq("id", invoice_id);
      }

      await supabase.from("admin_audit_log").insert({
        admin_user_id: adminId,
        admin_email: userData.user.email,
        action: "stripe_refund",
        target_type: "payment",
        target_id: payment_id || payment_intent_id,
        details: { payment_intent_id, refund_id: refund.id, amount_refunded: refundedAmountDollars, reason, invoice_id },
      });

      return new Response(
        JSON.stringify({ success: true, action: "refunded", refund_id: refund.id, amount_refunded: refundedAmountDollars }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("[stripe-admin-actions] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
