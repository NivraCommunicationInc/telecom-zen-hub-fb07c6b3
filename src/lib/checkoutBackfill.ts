/**
 * checkoutBackfill — Writes canonical records to local Supabase
 * after Nivra Core checkout succeeds.
 *
 * This ensures immediate visibility in:
 *   - Client portal (orders, invoices, payments, subscriptions)
 *   - Core admin (orders, invoices, payments lists)
 *   - Account 360 / Client profile
 *
 * All amounts come from the Nivra Core response (source of truth).
 * Errors are non-blocking — logged but never break the checkout.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NivraFullCheckoutResponse, NivraFullCheckoutPayload } from "@/lib/api/nivraApi";

export interface BackfillResult {
  billing_customer_id: string | null;
  order: boolean;
  invoice: boolean;
  payment: boolean;
  subscription: boolean;
  errors: string[];
}

export async function backfillCheckoutToSupabase(
  supabase: SupabaseClient,
  payload: NivraFullCheckoutPayload,
  response: NivraFullCheckoutResponse,
): Promise<BackfillResult> {
  const result: BackfillResult = {
    billing_customer_id: null,
    order: false,
    invoice: false,
    payment: false,
    subscription: false,
    errors: [],
  };

  const userId = payload.customer.user_id;
  const now = new Date().toISOString();
  const pricing = response.pricing;

  // ── 1. Upsert billing_customer ──
  try {
    const { data: existing } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      result.billing_customer_id = existing.id;
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
        console.error("[Backfill] billing_customers insert error:", error);
        result.errors.push(`billing_customer: ${error.message}`);
      } else {
        result.billing_customer_id = created.id;
      }
    }
  } catch (e: any) {
    console.error("[Backfill] billing_customers exception:", e);
    result.errors.push(`billing_customer: ${e.message}`);
  }

  const customerId = result.billing_customer_id;

  // ── 1b. Upsert accounts record (canonical account linkage) ──
  let resolvedAccountId: string | null = payload.account_id || null;
  try {
    const { data: existingAcct } = await supabase
      .from("accounts")
      .select("id")
      .eq("client_id", userId)
      .maybeSingle();

    if (existingAcct) {
      resolvedAccountId = existingAcct.id;
    } else if (response.account_number) {
      const { data: newAcct, error: acctErr } = await supabase
        .from("accounts")
        .insert({
          client_id: userId,
          account_number: response.account_number,
          status: "active",
          primary_service_address: payload.service_address?.street || null,
          primary_service_city: payload.service_address?.city || null,
          primary_service_province: payload.service_address?.province || "QC",
          primary_service_postal_code: payload.service_address?.postal_code || null,
        })
        .select("id")
        .single();
      if (acctErr) {
        console.error("[Backfill] accounts insert error:", acctErr);
        result.errors.push(`account: ${acctErr.message}`);
      } else {
        resolvedAccountId = newAcct.id;
        console.log("[Backfill] ✓ Account created:", response.account_number);
      }
    }
  } catch (e: any) {
    console.error("[Backfill] accounts exception:", e);
    result.errors.push(`account: ${e.message}`);
  }

  // ── 2. Upsert order ──
  try {
    const paymentMethod = payload.payment.method;
    const paymentStatus =
      paymentMethod === "paypal" && payload.payment.paypal_capture_id
        ? "paid"
        : paymentMethod === "etransfer"
          ? "pending"
          : paymentMethod === "promo_free"
            ? "paid"
            : "pre_authorized";

    const { error } = await supabase.from("orders").upsert(
      {
        id: response.order_id,
        order_number: response.order_number,
        user_id: userId,
        account_id: payload.account_id || null,
        status: "submitted",
        payment_status: paymentStatus,
        service_type: payload.services.map((s) => s.name).join(", "),
        order_type: "new",
        total_amount: pricing.grand_total,
        environment: "live",
        created_at: response.created_at || now,
        pricing_snapshot: payload.pricing_snapshot,
        line_items: payload.line_items,
        notes: payload.notes || null,
        service_address: payload.service_address.street || null,
        service_city: payload.service_address.city || null,
        service_province: payload.service_address.province || "QC",
        service_postal_code: payload.service_address.postal_code || null,
        installation_type: payload.installation.type || null,
        delivery_fee: payload.installation.delivery_fee || 0,
        installation_fee: payload.installation.installation_fee || 0,
        provider_payment_id: payload.payment.paypal_capture_id || null,
        payment_method: paymentMethod,
      },
      { onConflict: "id" },
    );
    if (error) {
      console.error("[Backfill] orders upsert error:", error);
      result.errors.push(`order: ${error.message}`);
    } else {
      result.order = true;
      console.log("[Backfill] ✓ Order backfilled:", response.order_number);
    }
  } catch (e: any) {
    console.error("[Backfill] orders exception:", e);
    result.errors.push(`order: ${e.message}`);
  }

  // ── 3. Upsert billing_invoice ──
  if (customerId) {
    try {
      const isPaid = payload.payment.method === "paypal" && payload.payment.paypal_capture_id;
      const invoiceStatus = isPaid ? "paid" : "pending";

      const { error } = await supabase.from("billing_invoices").upsert(
        {
          id: response.invoice_id,
          invoice_number: response.invoice_number,
          customer_id: customerId,
          order_id: response.order_id,
          status: invoiceStatus,
          subtotal: pricing.subtotal || pricing.taxable_base,
          tps_amount: pricing.tps_amount,
          tvq_amount: pricing.tvq_amount,
          total: pricing.grand_total,
          amount_paid: isPaid ? pricing.grand_total : 0,
          balance_due: isPaid ? 0 : pricing.grand_total,
          due_date: response.created_at || now,
          cycle_start_date: response.created_at || now,
          cycle_end_date: response.created_at || now,
          type: "initial",
          currency: "CAD",
          payment_method: payload.payment.method || null,
          environment: "live",
          paid_at: isPaid ? (response.created_at || now) : null,
          billing_snapshot_account_number: response.account_number,
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
        },
        { onConflict: "id" },
      );
      if (error) {
        console.error("[Backfill] billing_invoices upsert error:", error);
        result.errors.push(`invoice: ${error.message}`);
      } else {
        result.invoice = true;
        console.log("[Backfill] ✓ Invoice backfilled:", response.invoice_number);
      }
    } catch (e: any) {
      console.error("[Backfill] billing_invoices exception:", e);
      result.errors.push(`invoice: ${e.message}`);
    }

    // ── 4. Upsert billing_payment ──
    try {
      const isPaid = payload.payment.method === "paypal" && payload.payment.paypal_capture_id;

      const { error } = await supabase.from("billing_payments").upsert(
        {
          id: response.payment_id,
          payment_number: response.payment_number,
          customer_id: customerId,
          invoice_id: response.invoice_id,
          method: payload.payment.method,
          amount: pricing.grand_total,
          status: isPaid ? "completed" : "pending",
          reference: payload.payment.reference || payload.payment.paypal_capture_id || null,
          provider: payload.payment.method === "paypal" ? "paypal" : null,
          provider_payment_id: payload.payment.paypal_capture_id || null,
          received_at: isPaid ? (response.created_at || now) : null,
          source: "checkout",
          environment: "live",
          created_by_name: `${payload.customer.first_name} ${payload.customer.last_name}`.trim(),
        },
        { onConflict: "id" },
      );
      if (error) {
        console.error("[Backfill] billing_payments upsert error:", error);
        result.errors.push(`payment: ${error.message}`);
      } else {
        result.payment = true;
        console.log("[Backfill] ✓ Payment backfilled:", response.payment_number);
      }
    } catch (e: any) {
      console.error("[Backfill] billing_payments exception:", e);
      result.errors.push(`payment: ${e.message}`);
    }

    // ── 5. Upsert billing_subscription (if recurring services) ──
    if (response.subscription_id && payload.services.length > 0) {
      try {
        const mainService = payload.services[0];
        const { error } = await supabase.from("billing_subscriptions").upsert(
          {
            id: response.subscription_id,
            customer_id: customerId,
            order_id: response.order_id,
            plan_code: mainService.plan_code,
            plan_name: mainService.name,
            plan_price: mainService.plan_price,
            status: "active",
            cycle_start_date: response.created_at || now,
            cycle_end_date: response.created_at || now, // Will be set properly by billing engine
            service_category: mainService.category?.toLowerCase() || null,
            auto_billing_enabled: payload.payment.preauth_opt_in || false,
            environment: "live",
          },
          { onConflict: "id" },
        );
        if (error) {
          console.error("[Backfill] billing_subscriptions upsert error:", error);
          result.errors.push(`subscription: ${error.message}`);
        } else {
          result.subscription = true;
          console.log("[Backfill] ✓ Subscription backfilled:", response.subscription_id);
        }
      } catch (e: any) {
        console.error("[Backfill] billing_subscriptions exception:", e);
        result.errors.push(`subscription: ${e.message}`);
      }
    }
  }

  // Summary
  const ok = result.errors.length === 0;
  console.log(
    `[Backfill] ${ok ? "✓ Complete" : "⚠ Partial"}: order=${result.order}, invoice=${result.invoice}, payment=${result.payment}, sub=${result.subscription}`,
    result.errors.length > 0 ? result.errors : "",
  );

  return result;
}
