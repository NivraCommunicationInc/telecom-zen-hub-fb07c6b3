/**
 * checkoutFallback — Direct Supabase record creation when Nivra Core API is unavailable.
 * 
 * This module creates order, invoice, payment, and subscription records
 * directly in Supabase, bypassing the external Nivra Core Worker.
 * 
 * It uses the same DB sequences (generate_order_number, generate_billing_invoice_number,
 * generate_payment_number) to maintain canonical numbering.
 * 
 * This ensures checkout ALWAYS produces operational records, even if the
 * external API is down or unreachable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NivraFullCheckoutPayload, NivraFullCheckoutResponse } from "@/lib/api/nivraApi";

/**
 * Create all operational records directly in Supabase when Nivra Core is unavailable.
 * Returns a response shaped like NivraFullCheckoutResponse for seamless integration.
 */
export async function fallbackCheckout(
  supabase: SupabaseClient,
  payload: NivraFullCheckoutPayload,
): Promise<NivraFullCheckoutResponse> {
  const userId = payload.customer.user_id;
  const now = new Date().toISOString();

  // ── 1. Generate canonical numbers from DB sequences ──
  const [orderNumResult, invoiceNumResult, paymentNumResult] = await Promise.all([
    supabase.rpc("generate_order_number"),
    supabase.rpc("generate_billing_invoice_number"),
    supabase.rpc("generate_payment_number"),
  ]);

  const orderNumber = orderNumResult.data || `ORD-${Date.now()}`;
  const invoiceNumber = invoiceNumResult.data || `INV-${Date.now()}`;
  const paymentNumber = paymentNumResult.data || `PAY-${Date.now()}`;

  const orderId = crypto.randomUUID();
  const invoiceId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const subscriptionId = crypto.randomUUID();

  // ── 2. Resolve billing_customer ──
  let customerId: string | null = null;
  {
    const { data: existing } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("billing_customers")
        .insert({
          user_id: userId,
          first_name: payload.customer.first_name,
          last_name: payload.customer.last_name,
          email: payload.customer.email.trim().toLowerCase(),
          phone: payload.customer.phone,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw new Error(`billing_customer creation failed: ${error.message}`);
      customerId = created.id;
    }
  }

  // ── 3. Resolve account ──
  let accountId = payload.account_id || null;
  let accountNumber = "";
  {
    const { data: acct } = await supabase
      .from("accounts")
      .select("id, account_number")
      .eq("client_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (acct) {
      accountId = acct.id;
      accountNumber = acct.account_number || "";
    } else {
      // Create account — DB trigger generates account_number
      const { data: newAcct, error: acctErr } = await supabase
        .from("accounts")
        .insert({
          client_id: userId,
          status: "active",
          primary_service_address: payload.service_address?.street || null,
          primary_service_city: payload.service_address?.city || null,
          primary_service_province: payload.service_address?.province || "QC",
          primary_service_postal_code: payload.service_address?.postal_code || null,
        })
        .select("id, account_number")
        .single();

      if (acctErr) {
        if (acctErr.code === "23505") {
          const { data: reFetched } = await supabase
            .from("accounts")
            .select("id, account_number")
            .eq("client_id", userId)
            .eq("status", "active")
            .maybeSingle();
          accountId = reFetched?.id || null;
          accountNumber = reFetched?.account_number || "";
        } else {
          throw new Error(`Account creation failed: ${acctErr.message}`);
        }
      } else {
        accountId = newAcct.id;
        accountNumber = newAcct.account_number || "";
      }
    }
  }

  if (!accountId) throw new Error("No account resolved — checkout blocked");

  // ── 4. Compute pricing from snapshot ──
  const pricing = payload.pricing_snapshot;
  const subtotal = Number(pricing.subtotal) || 0;
  const recurringSubtotal = Number(pricing.recurring_subtotal) || subtotal;
  const oneTimeSubtotal = Number(pricing.one_time_subtotal) || 0;
  const discountTotal = Number(pricing.discount_total) || 0;
  const welcomeDiscount = Number(pricing.welcome_discount) || 0;
  const promoDiscount = Number(pricing.promo_discount) || 0;
  const preauthDiscount = Number(pricing.preauth_discount) || 0;
  const taxableBase = Number(pricing.taxable_base) || subtotal;
  const tpsAmount = Number(pricing.tps_amount) || Math.round(taxableBase * 0.05 * 100) / 100;
  const tvqAmount = Number(pricing.tvq_amount) || Math.round(taxableBase * 0.09975 * 100) / 100;
  const grandTotal = Number(pricing.grand_total) || Math.round((taxableBase + tpsAmount + tvqAmount) * 100) / 100;
  const billingCycleDay = new Date().getDate();

  // ── 5. Determine payment status ──
  const isPaid = payload.payment.method === "paypal" && !!payload.payment.paypal_capture_id;
  const isFree = payload.payment.method === "promo_free";
  const paymentStatus = (isPaid || isFree) ? "paid" : "pending";

  // ── 6. Create order ──
  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    order_number: orderNumber,
    user_id: userId,
    account_id: accountId,
    status: "submitted",
    payment_status: paymentStatus,
    service_type: payload.services.map(s => s.name).join(", "),
    order_type: "new",
    total_amount: grandTotal,
    environment: "live",
    created_at: now,
    pricing_snapshot: pricing,
    line_items: payload.line_items,
    notes: payload.notes || null,
    service_address: payload.service_address?.street || null,
    service_city: payload.service_address?.city || null,
    service_province: payload.service_address?.province || "QC",
    service_postal_code: payload.service_address?.postal_code || null,
    installation_type: payload.installation?.type || null,
    delivery_fee: payload.installation?.delivery_fee || 0,
    installation_fee: payload.installation?.installation_fee || 0,
    provider_payment_id: payload.payment.paypal_capture_id || null,
    payment_method: payload.payment.method,
  });
  if (orderErr) throw new Error(`Order creation failed: ${orderErr.message}`);
  console.log("[FallbackCheckout] ✓ Order created:", orderNumber);

  // ── 7. Create invoice ──
  const invoiceStatus = (isPaid || isFree) ? "paid" : "pending";
  const { error: invErr } = await supabase.from("billing_invoices").insert({
    id: invoiceId,
    invoice_number: invoiceNumber,
    customer_id: customerId,
    order_id: orderId,
    status: invoiceStatus,
    subtotal: taxableBase,
    tps_amount: tpsAmount,
    tvq_amount: tvqAmount,
    total: grandTotal,
    amount_paid: (isPaid || isFree) ? grandTotal : 0,
    balance_due: (isPaid || isFree) ? 0 : grandTotal,
    due_date: now,
    cycle_start_date: now,
    cycle_end_date: now,
    type: "initial",
    currency: "CAD",
    payment_method: payload.payment.method || null,
    environment: "live",
    paid_at: (isPaid || isFree) ? now : null,
    billing_snapshot_account_number: accountNumber,
    billing_snapshot_client: {
      first_name: payload.customer.first_name,
      last_name: payload.customer.last_name,
      email: payload.customer.email,
      phone: payload.customer.phone,
    },
    billing_snapshot_payment: {
      method: payload.payment.method,
      reference: payload.payment.reference || payload.payment.paypal_capture_id || null,
      status: payload.payment.status,
    },
  });
  if (invErr) throw new Error(`Invoice creation failed: ${invErr.message}`);
  console.log("[FallbackCheckout] ✓ Invoice created:", invoiceNumber);

  // ── 8. Create payment ──
  const { error: payErr } = await supabase.from("billing_payments").insert({
    id: paymentId,
    payment_number: paymentNumber,
    customer_id: customerId,
    invoice_id: invoiceId,
    method: payload.payment.method,
    amount: grandTotal,
    status: (isPaid || isFree) ? "completed" : "pending",
    reference: payload.payment.reference || payload.payment.paypal_capture_id || null,
    provider: payload.payment.method === "paypal" ? "paypal" : null,
    provider_payment_id: payload.payment.paypal_capture_id || null,
    received_at: (isPaid || isFree) ? now : null,
    source: "live",
    environment: "live",
    created_by_name: `${payload.customer.first_name} ${payload.customer.last_name}`.trim(),
  });
  if (payErr) throw new Error(`Payment creation failed: ${payErr.message}`);
  console.log("[FallbackCheckout] ✓ Payment created:", paymentNumber);

  // ── 9. Create subscription (for recurring services) ──
  let createdSubscriptionId: string | null = null;
  if (payload.services.length > 0) {
    const mainService = payload.services[0];
    
    // Check idempotency
    const { data: existingSub } = await supabase
      .from("billing_subscriptions")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingSub) {
      createdSubscriptionId = existingSub.id;
    } else {
      const { error: subErr } = await supabase.from("billing_subscriptions").insert({
        id: subscriptionId,
        customer_id: customerId,
        order_id: orderId,
        plan_code: mainService.plan_code,
        plan_name: mainService.name,
        plan_price: mainService.plan_price,
        status: "pending",
        cycle_start_date: now,
        cycle_end_date: now,
        service_category: mainService.category?.toLowerCase() || null,
        auto_billing_enabled: payload.payment.preauth_opt_in || false,
        environment: "live",
      });
      if (subErr) {
        console.error("[FallbackCheckout] Subscription creation failed (non-blocking):", subErr);
      } else {
        createdSubscriptionId = subscriptionId;
        console.log("[FallbackCheckout] ✓ Subscription created for:", mainService.name);
      }
    }
  }

  // ── 10. Update account billing_cycle_day ──
  await supabase
    .from("accounts")
    .update({ billing_cycle_day: billingCycleDay })
    .eq("id", accountId)
    .then(() => console.log("[FallbackCheckout] ✓ billing_cycle_day set to:", billingCycleDay));

  console.log("[FallbackCheckout] ✓ COMPLETE — All operational records created directly in Supabase");

  // Return response shaped like NivraFullCheckoutResponse
  return {
    success: true,
    order_id: orderId,
    order_number: orderNumber,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    payment_id: paymentId,
    payment_number: paymentNumber,
    subscription_id: createdSubscriptionId,
    account_number: accountNumber,
    pricing: {
      subtotal,
      recurring_subtotal: recurringSubtotal,
      one_time_subtotal: oneTimeSubtotal,
      discount_total: discountTotal,
      welcome_discount: welcomeDiscount,
      promo_discount: promoDiscount,
      preauth_discount: preauthDiscount,
      taxable_base: taxableBase,
      tps_amount: tpsAmount,
      tvq_amount: tvqAmount,
      grand_total: grandTotal,
    },
    billing_cycle_day: billingCycleDay,
    created_at: now,
  };
}
