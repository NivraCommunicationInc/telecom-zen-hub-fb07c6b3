import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CheckoutPayload = {
  customer: {
    user_id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  service_address?: {
    street?: string;
    city?: string;
    province?: string;
    postal_code?: string;
  };
  services?: Array<{
    name: string;
    plan_code?: string;
    plan_price?: number;
    category?: string;
    quantity?: number;
  }>;
  equipment?: Array<{
    name?: string;
    sku?: string;
    unit_price?: number;
    quantity?: number;
  }>;
  fees?: Array<{
    name: string;
    amount: number;
  }>;
  channels?: {
    paid_channels?: Array<{ name: string; price?: number }>;
  } | null;
  streaming_addons?: Array<{ name: string; monthly_price?: number; plan_price?: number }>;
  promo?: {
    code?: string;
    discount_value?: number;
  } | null;
  payment: {
    method?: string;
    status?: string;
    reference?: string | null;
    paypal_capture_id?: string | null;
    preauth_opt_in?: boolean;
  };
  pricing_snapshot?: {
    subtotal?: number;
    taxable_base?: number;
    tps_amount?: number;
    tvq_amount?: number;
    grand_total?: number;
    promo_discount?: number;
    welcome_discount?: number;
  };
  line_items?: unknown;
  notes?: string;
  account_id?: string | null;
  referral?: {
    type?: "client" | "influencer";
    code?: string;
    referrer_user_id?: string;
  } | null;
  // Canonical sync fields (explicitly passed at final checkout stage)
  referral_code_used?: string;
  referrer_user_id?: string;
  referred_user_id?: string;
  referred_order_id?: string;
  installation?: {
    type?: string | null;
    delivery_fee?: number;
    installation_fee?: number;
  };
};

type CheckoutResponse = {
  order_id: string;
  order_number: string;
  invoice_id: string;
  invoice_number: string;
  payment_id: string;
  payment_number: string;
  subscription_id?: string | null;
  account_number?: string | null;
  billing_cycle_day?: number | null;
  pricing?: {
    subtotal?: number;
    taxable_base?: number;
    tps_amount?: number;
    tvq_amount?: number;
    grand_total?: number;
  };
  created_at?: string;
};

const toBillingMethod = (method?: string, reference?: string | null): "paypal" | "interac" | "card" | "manual" => {
  const m = String(method || "").toLowerCase();
  const ref = String(reference || "").toLowerCase();
  if (m === "paypal") return "paypal";
  if (m === "etransfer" || m === "e_transfer" || m === "interac") return "interac";
  if (m === "credit_card" || m === "card") return "card";
  if (ref.startsWith("pi_")) return "card";
  return "manual";
};

const isPaidCheckout = (payload: CheckoutPayload) => {
  const method = String(payload.payment?.method || "").toLowerCase();
  const reference = String(payload.payment?.reference || "");
  const cardCaptured =
    (method === "credit_card" || method === "card" || reference.startsWith("pi_")) &&
    (payload.payment?.status === "captured" || reference.startsWith("pi_"));

  return (
    (method === "paypal" && !!payload.payment?.paypal_capture_id) ||
    method === "promo_free" ||
    cardCaptured
  );
};

const toDateOnly = (value?: string) => (value || new Date().toISOString()).split("T")[0];
const toMoney = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function buildInvoiceLines(payload: CheckoutPayload, invoiceId: string) {
  const lines: Array<{
    invoice_id: string;
    description: string;
    unit_price: number;
    quantity: number;
    line_total: number;
    line_type: string;
  }> = [];

  for (const svc of payload.services || []) {
    const qty = Number(svc.quantity || 1);
    const unit = toMoney(svc.plan_price);
    lines.push({
      invoice_id: invoiceId,
      description: svc.name,
      unit_price: unit,
      quantity: qty,
      line_total: toMoney(unit * qty),
      line_type: "service",
    });
  }

  for (const addon of payload.streaming_addons || []) {
    const unit = toMoney(addon.monthly_price ?? addon.plan_price);
    lines.push({
      invoice_id: invoiceId,
      description: addon.name,
      unit_price: unit,
      quantity: 1,
      line_total: unit,
      line_type: "service",
    });
  }

  for (const channel of payload.channels?.paid_channels || []) {
    const unit = toMoney(channel.price);
    lines.push({
      invoice_id: invoiceId,
      description: channel.name,
      unit_price: unit,
      quantity: 1,
      line_total: unit,
      line_type: "service",
    });
  }

  for (const eq of payload.equipment || []) {
    const qty = Number(eq.quantity || 1);
    const unit = toMoney(eq.unit_price);
    lines.push({
      invoice_id: invoiceId,
      description: eq.name || "Équipement",
      unit_price: unit,
      quantity: qty,
      line_total: toMoney(unit * qty),
      line_type: "equipment",
    });
  }

  for (const fee of payload.fees || []) {
    const amount = toMoney(fee.amount);
    if (amount > 0) {
      lines.push({
        invoice_id: invoiceId,
        description: fee.name,
        unit_price: amount,
        quantity: 1,
        line_total: amount,
        line_type: "fee",
      });
    }
  }

  const promoDiscount = toMoney(payload.pricing_snapshot?.promo_discount);
  if (promoDiscount > 0 && payload.promo?.code) {
    lines.push({
      invoice_id: invoiceId,
      description: `Rabais ${payload.promo.code} (${toMoney(payload.promo.discount_value)}% services)`,
      unit_price: -promoDiscount,
      quantity: 1,
      line_total: -promoDiscount,
      line_type: "discount",
    });
  }

  const welcomeDiscount = toMoney(payload.pricing_snapshot?.welcome_discount);
  if (welcomeDiscount > 0) {
    lines.push({
      invoice_id: invoiceId,
      description: "Rabais bienvenue (50% premier mois)",
      unit_price: -welcomeDiscount,
      quantity: 1,
      line_total: -welcomeDiscount,
      line_type: "discount",
    });
  }

  if (lines.length === 0) {
    const fallbackTotal = toMoney(
      payload.pricing_snapshot?.subtotal ??
      payload.pricing_snapshot?.taxable_base ??
      payload.pricing_snapshot?.grand_total
    );

    lines.push({
      invoice_id: invoiceId,
      description: "Service Nivra",
      unit_price: fallbackTotal,
      quantity: 1,
      line_total: fallbackTotal,
      line_type: "service",
    });
  }

  return lines;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- Auth: support both Bearer JWT and x-webhook-secret for service-role calls ---
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedWebhookSecret = Deno.env.get("NIVRA_WEBHOOK_SECRET");
    const isWebhookAuth = Boolean(webhookSecret && expectedWebhookSecret && webhookSecret === expectedWebhookSecret);

    let authenticatedUserId: string | null = null;

    if (isWebhookAuth) {
      console.log("[checkout-canonical-sync] Authenticated via x-webhook-secret (service-role call)");
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ ok: false, errors: ["Unauthorized"] }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "").trim();
      const { data: authData, error: authError } = await admin.auth.getUser(token);
      if (authError || !authData.user) {
        return new Response(JSON.stringify({ ok: false, errors: ["Unauthorized"] }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authenticatedUserId = authData.user.id;
    }

    const body = await req.json();
    const payload = body?.payload as CheckoutPayload;
    let response = (body?.response || {}) as Partial<CheckoutResponse>;

    const referralContext = {
      referral_code_used: String(
        body?.referral_context?.referral_code_used ||
        payload?.referral_code_used ||
        payload?.referral?.code ||
        "",
      )
        .trim()
        .toUpperCase(),
      referrer_user_id:
        body?.referral_context?.referrer_user_id ||
        payload?.referrer_user_id ||
        payload?.referral?.referrer_user_id ||
        null,
      referred_user_id:
        body?.referral_context?.referred_user_id ||
        payload?.referred_user_id ||
        payload?.customer?.user_id ||
        null,
      referred_order_id:
        body?.referral_context?.referred_order_id ||
        payload?.referred_order_id ||
        response?.order_id ||
        null,
    };

    console.log("[checkout-canonical-sync] referral context received:", referralContext);

    if (!payload?.customer?.user_id) {
      return new Response(JSON.stringify({ ok: false, errors: ["Invalid payload"] }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For JWT auth, enforce user_id match. For webhook auth, skip this check.
    if (!isWebhookAuth && payload.customer.user_id !== authenticatedUserId) {
      return new Response(JSON.stringify({ ok: false, errors: ["Forbidden"] }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = response.created_at || new Date().toISOString();

    const [orderNumRes, invoiceNumRes, paymentNumRes] = await Promise.all([
      response.order_number
        ? Promise.resolve({ data: response.order_number })
        : admin.rpc("generate_order_number"),
      response.invoice_number
        ? Promise.resolve({ data: response.invoice_number })
        : admin.rpc("generate_billing_invoice_number"),
      response.payment_number
        ? Promise.resolve({ data: response.payment_number })
        : admin.rpc("generate_payment_number"),
    ]);

    response = {
      order_id: response.order_id || crypto.randomUUID(),
      order_number: response.order_number || String(orderNumRes.data || `ORD-${Date.now()}`),
      invoice_id: response.invoice_id || crypto.randomUUID(),
      invoice_number: response.invoice_number || String(invoiceNumRes.data || `INV-${Date.now()}`),
      payment_id: response.payment_id || crypto.randomUUID(),
      payment_number: response.payment_number || String(paymentNumRes.data || `PAY-${Date.now()}`),
      subscription_id: response.subscription_id || null,
      account_number: response.account_number || null,
      billing_cycle_day: response.billing_cycle_day || null,
      pricing: response.pricing || {
        subtotal: toMoney(payload.pricing_snapshot?.subtotal ?? payload.pricing_snapshot?.taxable_base),
        taxable_base: toMoney(payload.pricing_snapshot?.taxable_base ?? payload.pricing_snapshot?.subtotal),
        tps_amount: toMoney(payload.pricing_snapshot?.tps_amount),
        tvq_amount: toMoney(payload.pricing_snapshot?.tvq_amount),
        grand_total: toMoney(payload.pricing_snapshot?.grand_total),
      },
      created_at: nowIso,
    } as CheckoutResponse;

    const paid = isPaidCheckout(payload);
    const billingMethod = toBillingMethod(payload.payment?.method);
    const results: Record<string, unknown> = {};
    const errors: string[] = [];

    // 0) Ensure profile exists and referral_code auto-generation trigger can run
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, user_id, referral_code")
        .eq("user_id", payload.customer.user_id)
        .maybeSingle();

      if (!profile) {
        await admin.from("profiles").insert({
          id: payload.customer.user_id,
          user_id: payload.customer.user_id,
          email: payload.customer.email?.trim().toLowerCase() || null,
          first_name: payload.customer.first_name || null,
          last_name: payload.customer.last_name || null,
          full_name: `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() || null,
          phone: payload.customer.phone || null,
        });
      }

      const { data: afterProfile } = await admin
        .from("profiles")
        .select("referral_code")
        .eq("user_id", payload.customer.user_id)
        .maybeSingle();

      if (!afterProfile?.referral_code) {
        await admin
          .from("profiles")
          .update({ updated_at: new Date().toISOString() })
          .eq("user_id", payload.customer.user_id)
          .is("referral_code", null);
      }

      const { data: finalProfile } = await admin
        .from("profiles")
        .select("referral_code")
        .eq("user_id", payload.customer.user_id)
        .maybeSingle();

      results.referral_code = finalProfile?.referral_code || null;
    } catch (err: any) {
      errors.push(`profile: ${err?.message || String(err)}`);
    }

    // 1) Billing customer
    let customerId: string | null = null;
    try {
      const { data: existingCustomer } = await admin
        .from("billing_customers")
        .select("id")
        .eq("user_id", payload.customer.user_id)
        .maybeSingle();

      if (existingCustomer?.id) {
        customerId = existingCustomer.id;
      } else {
        const { data: createdCustomer, error: customerInsertError } = await admin
          .from("billing_customers")
          .insert({
            user_id: payload.customer.user_id,
            first_name: payload.customer.first_name || "Client",
            last_name: payload.customer.last_name || "Nivra",
            email: payload.customer.email?.trim().toLowerCase() || `${payload.customer.user_id}@nivra.local`,
            phone: payload.customer.phone || "000-000-0000",
            status: "active",
          })
          .select("id")
          .single();

        if (customerInsertError && customerInsertError.code === "23505") {
          const { data: refetched } = await admin
            .from("billing_customers")
            .select("id")
            .eq("user_id", payload.customer.user_id)
            .maybeSingle();
          customerId = refetched?.id || null;
        } else if (customerInsertError) {
          throw customerInsertError;
        } else {
          customerId = createdCustomer?.id || null;
        }
      }

      if (!customerId) throw new Error("No billing_customer resolved");
      results.billing_customer_id = customerId;
    } catch (err: any) {
      errors.push(`billing_customer: ${err?.message || String(err)}`);
    }

    // 2) Account
    let accountId: string | null = payload.account_id || null;
    let accountNumber = response.account_number || null;
    try {
      const { data: existingAccount } = await admin
        .from("accounts")
        .select("id, account_number")
        .eq("client_id", payload.customer.user_id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingAccount?.id) {
        accountId = existingAccount.id;
        accountNumber = existingAccount.account_number;
      } else {
        const accountInsert: Record<string, unknown> = {
          client_id: payload.customer.user_id,
          status: "active",
          primary_service_address: payload.service_address?.street || null,
          primary_service_city: payload.service_address?.city || null,
          primary_service_province: payload.service_address?.province || "QC",
          primary_service_postal_code: payload.service_address?.postal_code || null,
        };
        if (response.account_number) accountInsert.account_number = response.account_number;

        const { data: createdAccount, error: accountInsertError } = await admin
          .from("accounts")
          .insert(accountInsert)
          .select("id, account_number")
          .single();

        if (accountInsertError && accountInsertError.code === "23505") {
          const { data: refetched } = await admin
            .from("accounts")
            .select("id, account_number")
            .eq("client_id", payload.customer.user_id)
            .eq("status", "active")
            .maybeSingle();
          accountId = refetched?.id || null;
          accountNumber = refetched?.account_number || null;
        } else if (accountInsertError) {
          throw accountInsertError;
        } else {
          accountId = createdAccount?.id || null;
          accountNumber = createdAccount?.account_number || null;
        }
      }

      if (accountId && response.billing_cycle_day) {
        await admin
          .from("accounts")
          .update({ billing_cycle_day: response.billing_cycle_day })
          .eq("id", accountId);
      }

      if (!accountId) throw new Error("No active account resolved");
      results.account_id = accountId;
      results.account_number = accountNumber;
    } catch (err: any) {
      errors.push(`account: ${err?.message || String(err)}`);
    }

    // 3) Order
    if (accountId) {
      try {
        const grandTotal = toMoney(response.pricing?.grand_total ?? payload.pricing_snapshot?.grand_total);
        const { error: orderError } = await admin.from("orders").upsert(
          {
            id: response.order_id,
            order_number: response.order_number,
            user_id: payload.customer.user_id,
            account_id: accountId,
            status: paid ? "confirmed" : "submitted",
            payment_status: paid ? "paid" : (payload.payment?.method === "etransfer" ? "pending" : "pre_authorized"),
            service_type: (payload.services || []).map((s) => s.name).join(", "),
            order_type: "new",
            total_amount: grandTotal,
            environment: "live",
            created_at: nowIso,
            pricing_snapshot: payload.pricing_snapshot || null,
            line_items: payload.line_items || null,
            notes: payload.notes || null,
            shipping_address: payload.service_address?.street || null,
            shipping_city: payload.service_address?.city || null,
            shipping_province: payload.service_address?.province || "QC",
            shipping_postal_code: payload.service_address?.postal_code || null,
            installation_type: payload.installation?.type || null,
            delivery_fee: toMoney(payload.installation?.delivery_fee),
            installation_fee: toMoney(payload.installation?.installation_fee),
            payment_method: payload.payment?.method || null,
            payment_reference:
              billingMethod === "paypal"
                ? null
                : (payload.payment?.reference || response.payment_number || null),
            provider_payment_id: payload.payment?.paypal_capture_id || null,
          },
          { onConflict: "id" },
        );

        if (orderError) throw orderError;
        results.order = true;
      } catch (err: any) {
        errors.push(`order: ${err?.message || String(err)}`);
      }
    }

    // 4) Invoice
    if (customerId) {
      try {
        const subtotal = toMoney(response.pricing?.subtotal ?? payload.pricing_snapshot?.subtotal ?? payload.pricing_snapshot?.taxable_base);
        const tpsAmount = toMoney(response.pricing?.tps_amount ?? payload.pricing_snapshot?.tps_amount);
        const tvqAmount = toMoney(response.pricing?.tvq_amount ?? payload.pricing_snapshot?.tvq_amount);
        const total = toMoney(response.pricing?.grand_total ?? payload.pricing_snapshot?.grand_total ?? subtotal + tpsAmount + tvqAmount);

        const { error: invoiceError } = await admin.from("billing_invoices").upsert(
          {
            id: response.invoice_id,
            invoice_number: response.invoice_number,
            customer_id: customerId,
            order_id: response.order_id,
            status: paid ? "paid" : "pending",
            subtotal,
            tps_amount: tpsAmount,
            tvq_amount: tvqAmount,
            total,
            amount_paid: paid ? total : 0,
            balance_due: paid ? 0 : total,
            due_date: toDateOnly(nowIso),
            cycle_start_date: toDateOnly(nowIso),
            cycle_end_date: toDateOnly(nowIso),
            type: "initial",
            currency: "CAD",
            payment_method: billingMethod,
            environment: "live",
            paid_at: paid ? nowIso : null,
            billing_snapshot_account_number: accountNumber,
            billing_snapshot_client: {
              first_name: payload.customer.first_name || null,
              last_name: payload.customer.last_name || null,
              email: payload.customer.email || null,
              phone: payload.customer.phone || null,
            },
            billing_snapshot_payment: {
              method: billingMethod,
              reference: billingMethod === "paypal" ? null : (payload.payment?.reference || response.payment_number || null),
              status: payload.payment?.status || null,
            },
          },
          { onConflict: "id" },
        );

        if (invoiceError) throw invoiceError;
        results.invoice = true;
      } catch (err: any) {
        errors.push(`invoice: ${err?.message || String(err)}`);
      }
    }

    // 5) Invoice lines (critical auto-recovery)
    try {
      const { count } = await admin
        .from("billing_invoice_lines")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", response.invoice_id);

      if (!count || count === 0) {
        const invoiceLines = buildInvoiceLines(payload, response.invoice_id);
        const { error: linesError } = await admin
          .from("billing_invoice_lines")
          .insert(invoiceLines);

        if (linesError) throw linesError;
        results.invoice_lines_created = invoiceLines.length;
      } else {
        results.invoice_lines_existing = count;
      }
    } catch (err: any) {
      errors.push(`invoice_lines: ${err?.message || String(err)}`);
    }

    // 6) Payment
    if (customerId) {
      try {
        const total = toMoney(response.pricing?.grand_total ?? payload.pricing_snapshot?.grand_total);
        const provider =
          billingMethod === "paypal"
            ? "paypal"
            : billingMethod === "interac"
              ? "interac"
              : billingMethod === "card"
                ? "stripe"
                : "manual";
        const reference = provider === "paypal" ? null : (payload.payment?.reference || response.payment_number || null);
        const providerPaymentId =
          provider === "paypal"
            ? (payload.payment?.paypal_capture_id || null)
            : provider === "stripe"
              ? (payload.payment?.reference || null)
              : null;

        const { error: paymentError } = await admin.from("billing_payments").upsert(
          {
            id: response.payment_id,
            payment_number: response.payment_number,
            customer_id: customerId,
            invoice_id: response.invoice_id,
            method: billingMethod,
            amount: total,
            status: paid ? "confirmed" : "pending",
            reference,
            provider,
            provider_payment_id: providerPaymentId,
            received_at: paid ? nowIso : null,
            source: "live",
            environment: "live",
            created_by_name: `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim(),
          },
          { onConflict: "id" },
        );

        if (paymentError) throw paymentError;
        results.payment = true;
      } catch (err: any) {
        errors.push(`payment: ${err?.message || String(err)}`);
      }
    }

    // 7) Subscription
    if (customerId && (payload.services || []).length > 0) {
      try {
        const firstService = (payload.services || [])[0];
        const cycleDate = toDateOnly(nowIso);

        const { data: existingSub } = await admin
          .from("billing_subscriptions")
          .select("id")
          .eq("order_id", response.order_id)
          .maybeSingle();

        const subscriptionId = existingSub?.id || response.subscription_id || crypto.randomUUID();
        const planPrice = toMoney((payload.services || []).reduce((sum, s) => sum + toMoney(s.plan_price), 0));

        const { error: subError } = await admin.from("billing_subscriptions").upsert(
          {
            id: subscriptionId,
            customer_id: customerId,
            order_id: response.order_id,
            address_id: null,
            plan_code: firstService?.plan_code || "UNKNOWN",
            plan_name: (payload.services || []).map((s) => s.name).join(", "),
            plan_price: planPrice,
            status: paid ? "active" : "pending",
            cycle_start_date: cycleDate,
            cycle_end_date: cycleDate,
            service_category: firstService?.category?.toLowerCase() || null,
            auto_billing_enabled: payload.payment?.preauth_opt_in || false,
            environment: "live",
          },
          { onConflict: "id" },
        );

        if (subError) throw subError;
        results.subscription = true;
      } catch (err: any) {
        errors.push(`subscription: ${err?.message || String(err)}`);
      }
    }

    // 8) Client referral tracking (idempotent server-side insert)
    try {
      const referralCodeUsed = referralContext.referral_code_used;
      const referrerUserId = referralContext.referrer_user_id;
      const referredUserId = referralContext.referred_user_id;
      const referredOrderId = referralContext.referred_order_id || response.order_id || null;

      const hasReferralContext = Boolean(
        referralCodeUsed &&
        referrerUserId &&
        referredUserId &&
        referredOrderId,
      );

      if (!hasReferralContext) {
        console.log("[checkout-canonical-sync] referral insert skipped: missing required context", {
          referral_code_used: referralCodeUsed || null,
          referrer_user_id: referrerUserId || null,
          referred_user_id: referredUserId || null,
          referred_order_id: referredOrderId || null,
        });
      } else if (referrerUserId === referredUserId) {
        console.log("[checkout-canonical-sync] referral insert skipped: self-referral blocked", {
          referrer_user_id: referrerUserId,
          referred_user_id: referredUserId,
        });
      } else {
        const { data: existingReferral, error: existingReferralError } = await admin
          .from("client_referrals")
          .select("id, referred_user_id")
          .eq("referred_user_id", referredUserId)
          .maybeSingle();

        if (existingReferralError) {
          console.error("[checkout-canonical-sync] referral insert failed during duplicate check:", existingReferralError);
          errors.push(`client_referral_duplicate_check: ${existingReferralError.message}`);
        } else if (existingReferral?.id) {
          console.log("[checkout-canonical-sync] referral insert skipped because duplicate:", {
            referred_user_id: referredUserId,
            existing_referral_id: existingReferral.id,
          });
          results.client_referral = "skipped_duplicate";
        } else {
          console.log("[checkout-canonical-sync] referral insert attempted", {
            referral_code_used: referralCodeUsed,
            referrer_user_id: referrerUserId,
            referred_user_id: referredUserId,
            referred_order_id: referredOrderId,
          });

          const { data: referrerAccount } = await admin
            .from("accounts")
            .select("id")
            .eq("client_id", referrerUserId)
            .eq("status", "active")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          let referrerBillingCustomerId: string | null = null;
          try {
            const { data: referrerBc } = await admin
              .from("billing_customers")
              .select("id")
              .eq("user_id", referrerUserId)
              .limit(1)
              .maybeSingle();
            referrerBillingCustomerId = referrerBc?.id || null;
          } catch (referrerBcErr) {
            console.warn("[checkout-canonical-sync] referral insert: unable to resolve referrer billing customer", referrerBcErr);
          }

          const { error: refInsertError } = await admin
            .from("client_referrals")
            .insert({
              referral_code_used: referralCodeUsed,
              referrer_user_id: referrerUserId,
              referred_user_id: referredUserId,
              referred_order_id: referredOrderId,
              referred_account_id: accountId || null,
              referrer_account_id: referrerAccount?.id || null,
              referred_billing_customer_id: customerId || null,
              referrer_billing_customer_id: referrerBillingCustomerId,
              status: "order_created",
              qualifying_cycles_paid: 0,
              required_cycles: 3,
              reward_status: "not_eligible",
              reward_amount: 25,
              reward_type: "Visa/Mastercard gift card",
            });

          if (refInsertError) {
            console.error("[checkout-canonical-sync] referral insert failed and why:", refInsertError);
            errors.push(`client_referral_insert: ${refInsertError.message}`);
          } else {
            console.log("[checkout-canonical-sync] referral insert succeeded", {
              referred_user_id: referredUserId,
              referred_order_id: referredOrderId,
            });
            results.client_referral = true;
          }
        }
      }
    } catch (err: any) {
      console.error("[checkout-canonical-sync] referral insert failed and why:", err);
      errors.push(`client_referral: ${err?.message || String(err)}`);
    }

    const ok = errors.length === 0;
    return new Response(JSON.stringify({ ok, results, errors }), {
      status: ok ? 200 : 207,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[checkout-canonical-sync] Fatal error:", error);
    return new Response(
      JSON.stringify({ ok: false, errors: [error instanceof Error ? error.message : String(error)] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});