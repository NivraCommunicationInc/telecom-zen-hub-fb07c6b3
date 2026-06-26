/**
 * reactivationEngine.ts — Shared reactivation logic
 *
 * Called by every payment path (PayPal webhook, portal-add-credit,
 * paypal-balance-pay-capture) after apply_payment_to_invoice returns
 * is_fully_paid: true.
 *
 * Reactivation flow:
 *   billing_subscriptions (suspended → active)
 *   orders (suspended/cancelled → active, if linked)
 *   email_queue  → service_reactivated template
 *   provisioning_log → action: reactivate
 *   admin_audit_log  → service_reactivated
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { activateNivraPayPalSubscription } from "./nivraPayPalSubscriptionFactory.ts";
import { prorateWindow } from "./prorationMath.ts";

export interface ReactivationResult {
  reactivated: boolean;
  previousStatus: string | null;
  subscriptionId: string;
  message: string;
}

/**
 * Reactivate a subscription if it is currently suspended.
 * Safe to call even when the subscription is not suspended — returns
 * reactivated:false without side effects.
 */
export async function reactivateIfSuspended(
  supabase: SupabaseClient,
  subscriptionId: string,
  invoiceId: string,
  trigger: "paypal_webhook" | "paypal_capture" | "portal_credit" | "balance_pay" | "manual",
): Promise<ReactivationResult> {
  const base: ReactivationResult = {
    reactivated: false,
    previousStatus: null,
    subscriptionId,
    message: "not_suspended",
  };

  try {
    // ── 1. Fetch subscription ────────────────────────────────────────
    const { data: sub, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select("id, status, customer_id, plan_name, order_id, paypal_subscription_id, suspension_date, cycle_start_date, cycle_end_date, plan_price")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (subErr || !sub) {
      console.warn(`[reactivation] Subscription ${subscriptionId} not found`);
      return { ...base, message: "subscription_not_found" };
    }

    base.previousStatus = sub.status;

    const wasInterrupted = sub.status === "suspended" || sub.status === "paused";
    if (!wasInterrupted) {
      return base; // Nothing to do
    }

    const now = new Date().toISOString();

    // ── 2. Reactivate billing_subscriptions ──────────────────────────
    const { error: reactivateErr } = await supabase
      .from("billing_subscriptions")
      .update({
        status: "active",
        suspension_reason: null,
        suspension_date: null,
        updated_at: now,
      })
      .eq("id", subscriptionId)
      .in("status", ["suspended", "paused"]); // Guard against race conditions

    if (reactivateErr) {
      console.error(`[reactivation] Failed to reactivate subscription ${subscriptionId}:`, reactivateErr);
      return { ...base, message: `reactivation_failed: ${reactivateErr.message}` };
    }

    // ── 2b. Reactivate PayPal subscription so billing resumes ────────
    if (sub.paypal_subscription_id) {
      const { success: ppOk, error: ppErr } = await activateNivraPayPalSubscription(
        sub.paypal_subscription_id,
        `Paiement reçu — réactivation (trigger: ${trigger}, invoice: ${invoiceId})`,
      );
      if (ppOk) {
        console.log(`[reactivation] ✓ PayPal subscription ${sub.paypal_subscription_id} reactivated`);
      } else {
        console.error(`[reactivation] ⚠ PayPal reactivation failed ${sub.paypal_subscription_id}: ${ppErr}`);
      }
    }

    // ── 3. Reactivate linked order ───────────────────────────────────
    if (sub.order_id) {
      await supabase
        .from("orders")
        .update({ status: "active", updated_at: now })
        .eq("id", sub.order_id)
        .in("status", ["suspended", "cancelled", "on_hold"]);
    }

    // ── 4. Get customer info for email ───────────────────────────────
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("email, first_name, last_name")
      .eq("id", sub.customer_id)
      .maybeSingle();

    // ── 5. Queue reactivation confirmation email ─────────────────────
    if (customer?.email) {
      const { buildAutoDocPdfAttachment } = await import("./pdfFromDb.ts");
      const reactPdf = await buildAutoDocPdfAttachment("reactivation_notice", {
        client_email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        service_name: sub.plan_name,
        reactivation_date: now,
      }).catch(() => null);
      await supabase.from("email_queue").insert({
        event_key: `svc_reactivated_${subscriptionId}_${Date.now()}`,
        to_email: customer.email,
        template_key: "service_reactivated",
        template_vars: {
          first_name: customer.first_name || "Client",
          client_name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Client",
          plan_name: sub.plan_name || "votre forfait",
          reactivation_date: now.split("T")[0],
          trigger,
        },
        attachments: reactPdf ? [reactPdf] : null,
        status: "queued",
      }).catch((e: unknown) => console.error("[reactivation] email_queue insert failed:", e));
    }

    // ── 6. Provisioning log ──────────────────────────────────────────
    await supabase.from("provisioning_log").insert({
      subscription_id: subscriptionId,
      customer_id: sub.customer_id,
      action: "reactivate",
      trigger,
      status: "success",
      adapter: "manual",
      details: { invoice_id: invoiceId, previous_status: "suspended" },
    }).catch(() => {}); // Non-fatal — table may not exist yet

    // ── 7. Audit log ─────────────────────────────────────────────────
    await supabase.from("admin_audit_log").insert({
      action: "service_reactivated",
      entity_type: "billing_subscription",
      entity_id: subscriptionId,
      details: {
        invoice_id: invoiceId,
        trigger,
        previous_status: "suspended",
        order_id: sub.order_id,
      },
      performed_by: "system",
      created_at: now,
    }).catch(() => {});

    console.log(`[reactivation] ✓ Subscription ${subscriptionId} reactivated (trigger: ${trigger}, invoice: ${invoiceId})`);

    return {
      reactivated: true,
      previousStatus: "suspended",
      subscriptionId,
      message: "reactivated",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[reactivation] Unexpected error for subscription ${subscriptionId}:`, msg);
    return { ...base, message: `error: ${msg}` };
  }
}
