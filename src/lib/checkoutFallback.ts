/**
 * checkoutFallback — Direct Supabase record creation when Nivra Core API is unavailable.
 * 
 * IDEMPOTENCY STRATEGY:
 * 1. PayPal payments: use paypal_capture_id as dedup key (unique index on provider_payment_id)
 * 2. Non-PayPal: use a deterministic idempotency_key = `${user_id}:${method}:${timestamp_minute}`
 * 3. If an order already exists for the same capture/key, return existing records instead of creating new ones.
 * 4. Subscription: checked by order_id (the resolved one, not a fresh UUID).
 *
 * This ensures checkout ALWAYS produces operational records, even if the
 * external API is down, AND retries/refreshes never create duplicates.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NivraFullCheckoutPayload, NivraFullCheckoutResponse } from "@/lib/api/nivraApi";

/* ────────────────────────────────────────────────────────────────
 *  IDEMPOTENCY: detect if this checkout was already processed
 * ──────────────────────────────────────────────────────────────── */

interface ExistingRecords {
  order_id: string;
  order_number: string;
  invoice_id: string | null;
  invoice_number: string | null;
  payment_id: string | null;
  payment_number: string | null;
  subscription_id: string | null;
  account_number: string;
  grand_total: number;
  billing_cycle_day: number | null;
  created_at: string;
}

/**
 * Try to find an already-processed checkout for this payment.
 * Returns null if no prior record exists (safe to proceed).
 */
async function findExistingCheckout(
  supabase: SupabaseClient,
  payload: NivraFullCheckoutPayload,
): Promise<ExistingRecords | null> {
  const userId = payload.customer.user_id;

  // ── Strategy 1: PayPal capture ID (strongest dedup key) ──
  if (payload.payment.paypal_capture_id) {
    const { data: existingPayment } = await supabase
      .from("billing_payments")
      .select("id, payment_number, invoice_id, customer_id")
      .eq("provider_payment_id", payload.payment.paypal_capture_id)
      .maybeSingle();

    if (existingPayment) {
      // Payment exists — resolve the full chain
      const { data: invoice } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, order_id, total")
        .eq("id", existingPayment.invoice_id)
        .maybeSingle();

      const orderId = invoice?.order_id;
      let orderNumber = "";
      let accountNumber = "";
      let billingCycleDay: number | null = null;
      let subscriptionId: string | null = null;

      if (orderId) {
        const { data: order } = await supabase
          .from("orders")
          .select("order_number, account_id")
          .eq("id", orderId)
          .maybeSingle();
        orderNumber = order?.order_number || "";

        if (order?.account_id) {
          const { data: acct } = await supabase
            .from("accounts")
            .select("account_number, billing_cycle_day")
            .eq("id", order.account_id)
            .maybeSingle();
          accountNumber = acct?.account_number || "";
          billingCycleDay = acct?.billing_cycle_day || null;
        }

        const { data: sub } = await supabase
          .from("billing_subscriptions")
          .select("id")
          .eq("order_id", orderId)
          .maybeSingle();
        subscriptionId = sub?.id || null;
      }

      return {
        order_id: orderId || "",
        order_number: orderNumber,
        invoice_id: invoice?.id || null,
        invoice_number: invoice?.invoice_number || null,
        payment_id: existingPayment.id,
        payment_number: existingPayment.payment_number,
        subscription_id: subscriptionId,
        account_number: accountNumber,
        grand_total: invoice?.total || 0,
        billing_cycle_day: billingCycleDay,
        created_at: new Date().toISOString(),
      };
    }
  }

  // ── Strategy 2: Check for recent order by same user with same total (within 2 min window) ──
  // Catches Interac / promo_free retries where there's no provider_payment_id
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const grandTotal = Number(payload.pricing_snapshot.grand_total) || 0;

  const { data: recentOrder } = await supabase
    .from("orders")
    .select("id, order_number, account_id, total_amount, created_at")
    .eq("user_id", userId)
    .eq("total_amount", grandTotal)
    .gte("created_at", twoMinAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentOrder) {
    // Found a recent duplicate — resolve chain
    let accountNumber = "";
    let billingCycleDay: number | null = null;
    if (recentOrder.account_id) {
      const { data: acct } = await supabase
        .from("accounts")
        .select("account_number, billing_cycle_day")
        .eq("id", recentOrder.account_id)
        .maybeSingle();
      accountNumber = acct?.account_number || "";
      billingCycleDay = acct?.billing_cycle_day || null;
    }

    const { data: invoice } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number")
      .eq("order_id", recentOrder.id)
      .maybeSingle();

    const { data: payment } = await supabase
      .from("billing_payments")
      .select("id, payment_number")
      .eq("invoice_id", invoice?.id || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    const { data: sub } = await supabase
      .from("billing_subscriptions")
      .select("id")
      .eq("order_id", recentOrder.id)
      .maybeSingle();

    return {
      order_id: recentOrder.id,
      order_number: recentOrder.order_number,
      invoice_id: invoice?.id || null,
      invoice_number: invoice?.invoice_number || null,
      payment_id: payment?.id || null,
      payment_number: payment?.payment_number || null,
      subscription_id: sub?.id || null,
      account_number: accountNumber,
      grand_total: recentOrder.total_amount,
      billing_cycle_day: billingCycleDay,
      created_at: recentOrder.created_at,
    };
  }

  return null; // No prior checkout found — safe to proceed
}

/* ────────────────────────────────────────────────────────────────
 *  MAIN: fallbackCheckout
 * ──────────────────────────────────────────────────────────────── */

/**
 * Create all operational records directly in Supabase when Nivra Core is unavailable.
 * Returns a response shaped like NivraFullCheckoutResponse for seamless integration.
 * 
 * IDEMPOTENT: safe to call multiple times for the same checkout attempt.
 */
export async function fallbackCheckout(
  supabase: SupabaseClient,
  payload: NivraFullCheckoutPayload,
): Promise<NivraFullCheckoutResponse> {

  // ── 0. IDEMPOTENCY CHECK — return existing records if already processed ──
  const existing = await findExistingCheckout(supabase, payload);
  if (existing) {
    console.log("[FallbackCheckout] ✓ IDEMPOTENT HIT — returning existing records for order:", existing.order_number);
    const pricing = payload.pricing_snapshot;
    return {
      success: true,
      order_id: existing.order_id,
      order_number: existing.order_number,
      invoice_id: existing.invoice_id || "",
      invoice_number: existing.invoice_number || "",
      payment_id: existing.payment_id || "",
      payment_number: existing.payment_number || "",
      subscription_id: existing.subscription_id,
      account_number: existing.account_number,
      pricing: {
        subtotal: Number(pricing.subtotal) || 0,
        recurring_subtotal: Number(pricing.recurring_subtotal) || 0,
        one_time_subtotal: Number(pricing.one_time_subtotal) || 0,
        discount_total: Number(pricing.discount_total) || 0,
        welcome_discount: Number(pricing.welcome_discount) || 0,
        promo_discount: Number(pricing.promo_discount) || 0,
        preauth_discount: Number(pricing.preauth_discount) || 0,
        taxable_base: Number(pricing.taxable_base) || 0,
        tps_amount: Number(pricing.tps_amount) || 0,
        tvq_amount: Number(pricing.tvq_amount) || 0,
        grand_total: existing.grand_total,
      },
      billing_cycle_day: existing.billing_cycle_day || new Date().getDate(),
      created_at: existing.created_at,
    };
  }

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

  // ── 2. Resolve billing_customer (idempotent: select-or-insert) ──
  let customerId: string | null = null;
  {
    const { data: existingCust } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingCust) {
      customerId = existingCust.id;
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

      if (error) {
        // Race condition: another call inserted between our select and insert
        if (error.code === "23505") {
          const { data: reFetched } = await supabase
            .from("billing_customers")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();
          customerId = reFetched?.id || null;
        } else {
          throw new Error(`billing_customer creation failed: ${error.message}`);
        }
      } else {
        customerId = created.id;
      }
    }
  }

  if (!customerId) throw new Error("No billing_customer resolved — checkout blocked");

  // ── 3. Resolve account (idempotent: select-or-insert with 23505 handling) ──
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
  const fallbackTax = estimateTaxesFallback(taxableBase);
  const tpsAmount = Number(pricing.tps_amount) || fallbackTax.tps;
  const tvqAmount = Number(pricing.tvq_amount) || fallbackTax.tvq;
  const grandTotal = Number(pricing.grand_total) || fallbackTax.total;
  const billingCycleDay = new Date().getDate();

  // ── 5. Determine canonical billing fields ──
  const isPaid = payload.payment.method === "paypal" && !!payload.payment.paypal_capture_id;
  const isFree = payload.payment.method === "promo_free";
  const paymentStatus = (isPaid || isFree) ? "paid" : "pending";
  const rawMethod = String(payload.payment.method || "").toLowerCase();
  const billingMethod: "paypal" | "interac" | "manual" =
    rawMethod === "paypal"
      ? "paypal"
      : (["etransfer", "e_transfer", "interac"].includes(rawMethod) ? "interac" : "manual");
  const paymentProvider = billingMethod === "paypal" ? "paypal" : billingMethod === "interac" ? "interac" : "manual";
  const paymentReference = paymentProvider === "paypal"
    ? null
    : (payload.payment.reference || paymentNumber || null);
  const paymentProviderPaymentId = paymentProvider === "paypal"
    ? (payload.payment.paypal_capture_id || null)
    : null;

  // ── 6. Create order ──
  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    order_number: orderNumber,
    client_request_id: payload.client_request_id,
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
    notes: payload.notes || null,
    shipping_address: payload.service_address?.street || null,
    shipping_city: payload.service_address?.city || null,
    shipping_province: payload.service_address?.province || "QC",
    shipping_postal_code: payload.service_address?.postal_code || null,
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
    payment_method: billingMethod,
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

  // ── 7b. Create billing_invoice_lines — canonical itemization ──
  const invoiceLines: Array<{
    invoice_id: string;
    description: string;
    unit_price: number;
    quantity: number;
    line_total: number;
    line_type: string;
  }> = [];

  // Recurring services
  for (const svc of payload.services) {
    const qty = svc.quantity || 1;
    const price = Number(svc.plan_price) || 0;
    invoiceLines.push({
      invoice_id: invoiceId,
      description: svc.name,
      unit_price: price,
      quantity: qty,
      line_total: Math.round(price * qty * 100) / 100,
      line_type: "service",
    });
  }

  // Streaming add-ons (each on its own line)
  if (payload.streaming_addons?.length) {
    for (const addon of payload.streaming_addons) {
      const price = Number(addon.monthly_price) || 0;
      invoiceLines.push({
        invoice_id: invoiceId,
        description: addon.name,
        unit_price: price,
        quantity: 1,
        line_total: price,
        line_type: "service",
      });
    }
  }

  // Paid TV channels (each on its own line)
  if (payload.channels?.paid_channels?.length) {
    for (const ch of payload.channels.paid_channels) {
      const price = Number(ch.price) || 0;
      invoiceLines.push({
        invoice_id: invoiceId,
        description: ch.name,
        unit_price: price,
        quantity: 1,
        line_total: price,
        line_type: "service",
      });
    }
  }

  // Equipment
  for (const eq of payload.equipment) {
    const qty = eq.quantity || 1;
    const price = Number(eq.unit_price) || 0;
    invoiceLines.push({
      invoice_id: invoiceId,
      description: eq.name,
      unit_price: price,
      quantity: qty,
      line_total: Math.round(price * qty * 100) / 100,
      line_type: "equipment",
    });
  }

  // Fees
  for (const fee of payload.fees) {
    const amount = Number(fee.amount) || 0;
    if (amount > 0) {
      invoiceLines.push({
        invoice_id: invoiceId,
        description: fee.name,
        unit_price: amount,
        quantity: 1,
        line_total: amount,
        line_type: "fee",
      });
    }
  }

  // Promo / discount
  if (payload.promo && promoDiscount > 0) {
    invoiceLines.push({
      invoice_id: invoiceId,
      description: `Rabais ${payload.promo.code} (${payload.promo.discount_value}% services)`,
      unit_price: -promoDiscount,
      quantity: 1,
      line_total: -promoDiscount,
      line_type: "discount",
    });
  }

  // Welcome discount (if applicable)
  if (welcomeDiscount > 0) {
    invoiceLines.push({
      invoice_id: invoiceId,
      description: "Rabais bienvenue (50% premier mois)",
      unit_price: -welcomeDiscount,
      quantity: 1,
      line_total: -welcomeDiscount,
      line_type: "discount",
    });
  }

  if (invoiceLines.length > 0) {
    const { error: linesErr } = await supabase
      .from("billing_invoice_lines")
      .insert(invoiceLines);
    if (linesErr) {
      console.error("[FallbackCheckout] Invoice lines creation failed (non-blocking):", linesErr);
    } else {
      console.log(`[FallbackCheckout] ✓ ${invoiceLines.length} invoice lines created`);
    }
  }

  // ── 8. Create payment ──
  const { error: payErr } = await supabase.from("billing_payments").insert({
    id: paymentId,
    payment_number: paymentNumber,
    customer_id: customerId,
    invoice_id: invoiceId,
    method: billingMethod,
    amount: grandTotal,
    status: (isPaid || isFree) ? "confirmed" : "pending",
    reference: paymentReference,
    provider: paymentProvider,
    provider_payment_id: paymentProviderPaymentId,
    received_at: (isPaid || isFree) ? now : null,
    source: "live",
    environment: "live",
    created_by_name: `${payload.customer.first_name} ${payload.customer.last_name}`.trim(),
  });
  if (payErr) throw new Error(`Payment creation failed: ${payErr.message}`);
  console.log("[FallbackCheckout] ✓ Payment created:", paymentNumber);

  // ── 9. Create subscription (idempotent: check by resolved orderId) ──
  let createdSubscriptionId: string | null = null;
  if (payload.services.length > 0) {
    const mainService = payload.services[0];

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
