/**
 * checkoutBackfill — Writes canonical records to local Supabase
 * after Nivra Core checkout succeeds.
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

type BillingMethod = "paypal" | "interac" | "manual";

const toBillingMethod = (method?: string): BillingMethod => {
  if (method === "paypal") return "paypal";
  if (method === "etransfer" || method === "e_transfer" || method === "interac") return "interac";
  return "manual";
};

const isPaidCheckout = (payload: NivraFullCheckoutPayload) =>
  (payload.payment.method === "paypal" && !!payload.payment.paypal_capture_id) ||
  payload.payment.method === "promo_free";

async function resolveServiceAddressId(
  supabase: SupabaseClient,
  accountId: string,
  payload: NivraFullCheckoutPayload,
): Promise<string | null> {
  const line = payload.service_address?.street?.trim() || null;
  const city = payload.service_address?.city?.trim() || null;
  const province = payload.service_address?.province?.trim() || "QC";
  const postal = payload.service_address?.postal_code?.trim() || null;

  if (!line) return null;

  const { data: existing } = await supabase
    .from("service_addresses")
    .select("id")
    .eq("account_id", accountId)
    .eq("address_line", line)
    .eq("city", city)
    .eq("postal_code", postal)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("service_addresses")
    .insert({
      account_id: accountId,
      label: "Service principale",
      address_line: line,
      city,
      province,
      postal_code: postal,
      is_primary: true,
      is_default: true,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Backfill] service_addresses insert error:", error);
    return null;
  }

  return created.id;
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
  const billingMethod = toBillingMethod(payload.payment.method);
  const paid = isPaidCheckout(payload);

  // 1) billing customer
  try {
    const { data: existing } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.id) {
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
        result.errors.push(`billing_customer: ${error.message}`);
      } else {
        result.billing_customer_id = created.id;
      }
    }
  } catch (e: any) {
    result.errors.push(`billing_customer: ${e.message}`);
  }

  if (!result.billing_customer_id) return result;

  // 2) resolve account
  let resolvedAccountId: string | null = payload.account_id || null;
  try {
    const { data: existingAcct } = await supabase
      .from("accounts")
      .select("id")
      .eq("client_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingAcct?.id) {
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
        result.errors.push(`account: ${acctErr.message}`);
      } else {
        resolvedAccountId = newAcct.id;
      }
    }
  } catch (e: any) {
    result.errors.push(`account: ${e.message}`);
  }

  if (!resolvedAccountId) {
    result.errors.push("account: No active account found");
    return result;
  }

  // 3) order
  try {
    const { error } = await supabase.from("orders").upsert(
      {
        id: response.order_id,
        order_number: response.order_number,
        client_request_id: payload.client_request_id,
        user_id: userId,
        account_id: resolvedAccountId,
        status: "submitted",
        payment_status: paid ? "paid" : (payload.payment.method === "etransfer" ? "pending" : "pre_authorized"),
        service_type: payload.services.map((s) => s.name).join(", "),
        order_type: "new",
        total_amount: pricing?.grand_total ?? Number(payload.pricing_snapshot?.grand_total ?? 0),
        environment: "live",
        created_at: response.created_at || now,
        pricing_snapshot: payload.pricing_snapshot,
        notes: payload.notes || null,
        shipping_address: payload.service_address.street || null,
        shipping_city: payload.service_address.city || null,
        shipping_province: payload.service_address.province || "QC",
        shipping_postal_code: payload.service_address.postal_code || null,
        installation_type: payload.installation.type || null,
        delivery_fee: payload.installation.delivery_fee || 0,
        installation_fee: payload.installation.installation_fee || 0,
        provider_payment_id: payload.payment.paypal_capture_id || null,
        payment_method: payload.payment.method,
        payment_reference: billingMethod === "paypal" ? null : (payload.payment.reference || response.payment_number || null),
      },
      { onConflict: "order_number" },
    );

    if (error) result.errors.push(`order: ${error.message}`);
    else result.order = true;
  } catch (e: any) {
    result.errors.push(`order: ${e.message}`);
  }

  // 4) invoice
  try {
    const total = pricing?.grand_total ?? Number(payload.pricing_snapshot?.grand_total ?? 0);
    const { error } = await supabase.from("billing_invoices").upsert(
      {
        id: response.invoice_id,
        invoice_number: response.invoice_number,
        customer_id: result.billing_customer_id,
        order_id: response.order_id,
        status: paid ? "paid" : "pending",
        subtotal: pricing?.subtotal || pricing?.taxable_base || Number(payload.pricing_snapshot?.subtotal ?? payload.pricing_snapshot?.taxable_base ?? 0),
        tps_amount: pricing?.tps_amount ?? Number(payload.pricing_snapshot?.tps_amount ?? 0),
        tvq_amount: pricing?.tvq_amount ?? Number(payload.pricing_snapshot?.tvq_amount ?? 0),
        total,
        amount_paid: paid ? total : 0,
        balance_due: paid ? 0 : total,
        due_date: response.created_at || now,
        cycle_start_date: response.created_at || now,
        cycle_end_date: response.created_at || now,
        type: "initial",
        currency: "CAD",
        payment_method: billingMethod,
        environment: "live",
        paid_at: paid ? (response.created_at || now) : null,
        billing_snapshot_account_number: response.account_number,
        billing_snapshot_client: {
          first_name: payload.customer.first_name,
          last_name: payload.customer.last_name,
          email: payload.customer.email,
          phone: payload.customer.phone,
        },
        billing_snapshot_payment: {
          method: billingMethod,
          reference: billingMethod === "paypal" ? null : (payload.payment.reference || response.payment_number || null),
          status: payload.payment.status,
        },
      },
      { onConflict: "invoice_number" },
    );

    if (error) result.errors.push(`invoice: ${error.message}`);
    else result.invoice = true;
  } catch (e: any) {
    result.errors.push(`invoice: ${e.message}`);
  }

  // 5) payment
  try {
    const total = pricing?.grand_total ?? Number(payload.pricing_snapshot?.grand_total ?? 0);
    const provider = billingMethod === "paypal" ? "paypal" : billingMethod === "interac" ? "interac" : "manual";
    const reference = provider === "paypal" ? null : (payload.payment.reference || response.payment_number || null);
    const providerPaymentId = provider === "paypal" ? (payload.payment.paypal_capture_id || null) : null;

    const { error } = await supabase.from("billing_payments").upsert(
      {
        id: response.payment_id,
        payment_number: response.payment_number,
        customer_id: result.billing_customer_id,
        invoice_id: response.invoice_id,
        method: billingMethod,
        amount: total,
        status: paid ? "confirmed" : "pending",
        reference,
        provider,
        provider_payment_id: providerPaymentId,
        received_at: paid ? (response.created_at || now) : null,
        source: "live",
        environment: "live",
        created_by_name: `${payload.customer.first_name} ${payload.customer.last_name}`.trim(),
      },
      { onConflict: "payment_number" },
    );

    if (error) result.errors.push(`payment: ${error.message}`);
    else result.payment = true;
  } catch (e: any) {
    result.errors.push(`payment: ${e.message}`);
  }

  // 6) subscription + service lines
  if (payload.services.length > 0) {
    try {
      const mainService = payload.services[0];
      const serviceAddressId = await resolveServiceAddressId(supabase, resolvedAccountId, payload);

      const { data: existingSub } = await supabase
        .from("billing_subscriptions")
        .select("id")
        .eq("order_id", response.order_id)
        .maybeSingle();

      let subscriptionId: string;

      if (existingSub?.id) {
        subscriptionId = existingSub.id;
        result.subscription = true;
      } else {
        subscriptionId = response.subscription_id || crypto.randomUUID();
        const cycleDate = (response.created_at || now).split("T")[0];

        // Calculate combined plan price from all recurring services
        const combinedPlanPrice = payload.services.reduce(
          (sum, svc) => sum + (Number(svc.plan_price) || 0), 0
        );

        const { error } = await supabase.from("billing_subscriptions").upsert(
          {
            id: subscriptionId,
            customer_id: result.billing_customer_id,
            order_id: response.order_id,
            address_id: serviceAddressId,
            plan_code: mainService.plan_code,
            plan_name: payload.services.map(s => s.name).join(", "),
            plan_price: combinedPlanPrice || mainService.plan_price,
            status: "pending",
            cycle_start_date: cycleDate,
            cycle_end_date: cycleDate,
            service_category: mainService.category?.toLowerCase() || null,
            auto_billing_enabled: payload.payment.preauth_opt_in || false,
            environment: "live",
          },
          { onConflict: "id" },
        );

        if (error) result.errors.push(`subscription: ${error.message}`);
        else result.subscription = true;
      }

      // 6b) Create service lines for each recurring service
      for (const svc of payload.services) {
        try {
          await supabase.from("billing_subscription_services").upsert(
            {
              subscription_id: subscriptionId,
              service_name: svc.name,
              service_code: svc.plan_code || svc.name.toLowerCase().replace(/\s+/g, '_'),
              service_type: "recurring",
              unit_price: Number(svc.plan_price) || 0,
              quantity: 1,
              is_active: true,
            },
            { onConflict: "id" },
          );
        } catch { /* best-effort */ }
      }

      // 6c) Create equipment lines (one_time) from payload
      const equipmentItems = payload.equipment || [];
      for (const eq of equipmentItems) {
        try {
          await supabase.from("billing_subscription_services").upsert(
            {
              subscription_id: subscriptionId,
              service_name: eq.name || eq.label || "Équipement",
              service_code: eq.code || eq.type || "equipment",
              service_type: "one_time",
              unit_price: Number(eq.price) || 0,
              quantity: Number(eq.quantity) || 1,
              is_active: true,
            },
            { onConflict: "id" },
          );
        } catch { /* best-effort */ }
      }
    } catch (e: any) {
      result.errors.push(`subscription: ${e.message}`);
    }
  }

  return result;
}
