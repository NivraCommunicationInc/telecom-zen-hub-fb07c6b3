/**
 * reactivationEngine.ts — Shared reactivation logic (Phase 3.C.3)
 *
 * Called by every Square payment path after apply_payment_to_invoice returns
 * is_fully_paid: true. State transitions go exclusively through the canonical
 * `reactivate_subscription()` RPC — no direct UPDATE on billing_subscriptions.
 *
 * PayPal is decommissioned (Phase 3.B). No provider-side reactivation call
 * is issued from this engine anymore.
 *
 * Reactivation flow:
 *   reactivate_subscription() RPC → state, dates, audit trace
 *   orders (suspended/cancelled → active, if linked)
 *   account_adjustments → prorata credit for unused suspended window
 *   email_queue → service_reactivated
 *   provisioning_log → action: reactivate
 *   admin_audit_log → service_reactivated
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
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
  trigger: "square_webhook" | "square_capture" | "portal_credit" | "balance_pay" | "manual" | "paypal_webhook" | "paypal_capture",
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
      .select("id, status, customer_id, plan_name, order_id, suspension_date, cycle_start_date, cycle_end_date, plan_price")
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

    // ── 2. Reactivate subscription via canonical RPC ─────────────────
    // The RPC handles: state transition (suspended/paused → active),
    // clearing suspension_reason/suspension_date, audit trace, and
    // race-condition safety. Never mutate billing_subscriptions directly.
    const { error: reactivateErr } = await supabase.rpc("reactivate_subscription", {
      p_subscription_id: subscriptionId,
      p_context: { trigger, invoice_id: invoiceId, previous_status: base.previousStatus },
    });

    if (reactivateErr) {
      console.error(`[reactivation] reactivate_subscription RPC failed ${subscriptionId}:`, reactivateErr);
      return { ...base, message: `reactivation_failed: ${reactivateErr.message}` };
    }

    // Phase 3.C.3: PayPal decommissioned — no provider-side reactivation call.

    // ── 3. Reactivate linked order ───────────────────────────────────
    if (sub.order_id) {
      await supabase
        .from("orders")
        .update({ status: "active", updated_at: now })
        .eq("id", sub.order_id)
        .in("status", ["suspended", "cancelled", "on_hold"]);
    }

    // ── 3b. Prorata credit for suspended/paused window ───────────────
    // Scenario 4 (suspension→reactivation) & Scenario 6 (pause temporaire):
    // Credit unused days at full daily rate via account_adjustments(credit).
    try {
      const planPrice = Number((sub as any).plan_price || 0);
      if (
        planPrice > 0 &&
        sub.suspension_date &&
        sub.cycle_start_date &&
        sub.cycle_end_date
      ) {
        const { proratedAmount, daysRemaining, cycleTotalDays } = prorateWindow({
          cycleStart: sub.cycle_start_date,
          cycleEnd: sub.cycle_end_date,
          windowStart: sub.suspension_date,
          windowEnd: now,
          amount: planPrice,
        });
        if (proratedAmount >= 0.01) {
          // Resolve account_id via billing_customers.user_id → accounts.client_id
          const { data: bc } = await supabase
            .from("billing_customers").select("user_id").eq("id", sub.customer_id).maybeSingle();
          const userId = bc?.user_id;
          if (userId) {
            const { data: acct } = await supabase
              .from("accounts").select("id").eq("client_id", userId).maybeSingle();
            if (acct?.id) {
              const label = base.previousStatus === "paused" ? "pause" : "suspension";
              await supabase.from("account_adjustments").insert({
                account_id: acct.id,
                type: "credit",
                amount: proratedAmount,
                description: `Crédit prorata ${label} — ${sub.plan_name || "Forfait"} (${daysRemaining}/${cycleTotalDays} jours non utilisés) — trigger ${trigger}, invoice ${invoiceId}`,
                months_total: 1,
                months_remaining: 1,
                applied_count: 0,
                status: "active",
                is_permanent: false,
                applies_to: "next_invoice",
              });
              console.log(`[reactivation] ✓ Prorata ${label} credit ${proratedAmount}$ for sub ${subscriptionId} (${daysRemaining}/${cycleTotalDays}d)`);
            }
          }
        }
      }
    } catch (e) {
      console.error(`[reactivation] prorata credit error for ${subscriptionId}:`, e);
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
