import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Real user data from DB
  const referrerUserId = "a50ca098-f95b-4efd-b452-3f0177337f86"; // Serge Beaulne, code NIVRA-9691D
  const referredUserId = "a29f215a-90ca-42e7-9457-609030df8e79"; // JOAS
  const referralCodeUsed = "NIVRA-9691D";
  const nowIso = new Date().toISOString();

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // Step 1: Ensure profile for referred user
  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_id, referral_code")
    .eq("user_id", referredUserId)
    .maybeSingle();

  results.profile_exists = !!profile;

  // Step 2: Ensure billing customer
  let customerId: string | null = null;
  const { data: existingCustomer } = await admin
    .from("billing_customers")
    .select("id")
    .eq("user_id", referredUserId)
    .maybeSingle();

  if (existingCustomer?.id) {
    customerId = existingCustomer.id;
  } else {
    const { data: created, error: custErr } = await admin
      .from("billing_customers")
      .insert({
        user_id: referredUserId,
        first_name: "JOAS",
        last_name: "Referral-Test",
        email: "joas.referral.test@nivra.temp",
        phone: "514-555-0001",
        status: "active",
      })
      .select("id")
      .single();

    if (custErr && custErr.code === "23505") {
      const { data: refetched } = await admin
        .from("billing_customers")
        .select("id")
        .eq("user_id", referredUserId)
        .maybeSingle();
      customerId = refetched?.id || null;
    } else if (custErr) {
      errors.push(`billing_customer: ${custErr.message}`);
    } else {
      customerId = created?.id || null;
    }
  }
  results.billing_customer_id = customerId;

  // Step 3: Ensure account
  let accountId: string | null = null;
  let accountNumber: string | null = null;
  const { data: existingAccount } = await admin
    .from("accounts")
    .select("id, account_number")
    .eq("client_id", referredUserId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingAccount?.id) {
    accountId = existingAccount.id;
    accountNumber = existingAccount.account_number;
  } else {
    const { data: createdAcc, error: accErr } = await admin
      .from("accounts")
      .insert({
        client_id: referredUserId,
        status: "active",
        primary_service_address: "123 Rue Test",
        primary_service_city: "Montréal",
        primary_service_province: "QC",
        primary_service_postal_code: "H2X 1Y4",
      })
      .select("id, account_number")
      .single();

    if (accErr && accErr.code === "23505") {
      const { data: ref } = await admin
        .from("accounts")
        .select("id, account_number")
        .eq("client_id", referredUserId)
        .eq("status", "active")
        .maybeSingle();
      accountId = ref?.id || null;
      accountNumber = ref?.account_number || null;
    } else if (accErr) {
      errors.push(`account: ${accErr.message}`);
    } else {
      accountId = createdAcc?.id || null;
      accountNumber = createdAcc?.account_number || null;
    }
  }
  results.account_id = accountId;

  // Step 4: Generate numbers
  const [orderNumRes, invoiceNumRes, paymentNumRes] = await Promise.all([
    admin.rpc("generate_order_number"),
    admin.rpc("generate_billing_invoice_number"),
    admin.rpc("generate_payment_number"),
  ]);

  const orderId = crypto.randomUUID();
  const invoiceId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  const orderNumber = String(orderNumRes.data || `ORD-${Date.now()}`);
  const invoiceNumber = String(invoiceNumRes.data || `INV-${Date.now()}`);
  const paymentNumber = String(paymentNumRes.data || `PAY-${Date.now()}`);

  // Step 5: Create order
  if (accountId) {
    const { error: orderErr } = await admin.from("orders").upsert({
      id: orderId,
      order_number: orderNumber,
      user_id: referredUserId,
      account_id: accountId,
      status: "submitted",
      payment_status: "paid",
      service_type: "Internet 120 Mbps",
      order_type: "new",
      total_amount: 120.71,
      environment: "live",
      created_at: nowIso,
      pricing_snapshot: { subtotal: 104.99, tps_amount: 5.25, tvq_amount: 10.47, grand_total: 120.71 },
      notes: "Referral test checkout via checkout-canonical-sync - code NIVRA-9691D",
      shipping_address: "123 Rue Test",
      shipping_city: "Montréal",
      shipping_province: "QC",
      shipping_postal_code: "H2X 1Y4",
      payment_method: "paypal",
      provider_payment_id: "REFERRAL-TEST-CAPTURE-001",
    }, { onConflict: "id" });

    if (orderErr) errors.push(`order: ${orderErr.message}`);
    else results.order = { id: orderId, number: orderNumber };
  }

  // Step 6: Create invoice
  if (customerId) {
    const { error: invErr } = await admin.from("billing_invoices").upsert({
      id: invoiceId,
      invoice_number: invoiceNumber,
      customer_id: customerId,
      order_id: orderId,
      status: "paid",
      subtotal: 104.99,
      tps_amount: 5.25,
      tvq_amount: 10.47,
      total: 120.71,
      amount_paid: 120.71,
      balance_due: 0,
      due_date: nowIso.split("T")[0],
      cycle_start_date: nowIso.split("T")[0],
      cycle_end_date: nowIso.split("T")[0],
      type: "initial",
      currency: "CAD",
      payment_method: "paypal",
      environment: "live",
      paid_at: nowIso,
      billing_snapshot_account_number: accountNumber,
    }, { onConflict: "id" });

    if (invErr) errors.push(`invoice: ${invErr.message}`);
    else results.invoice = { id: invoiceId, number: invoiceNumber };
  }

  // Step 7: Create invoice lines
  const { error: linesErr } = await admin.from("billing_invoice_lines").insert([
    { invoice_id: invoiceId, description: "Internet 120 Mbps", unit_price: 55, quantity: 1, line_total: 55, line_type: "service" },
    { invoice_id: invoiceId, description: "Frais d'activation", unit_price: 49.99, quantity: 1, line_total: 49.99, line_type: "fee" },
  ]);
  if (linesErr) errors.push(`invoice_lines: ${linesErr.message}`);

  // Step 8: Create payment
  if (customerId) {
    const { error: payErr } = await admin.from("billing_payments").upsert({
      id: paymentId,
      payment_number: paymentNumber,
      customer_id: customerId,
      invoice_id: invoiceId,
      method: "paypal",
      amount: 120.71,
      status: "confirmed",
      provider: "paypal",
      provider_payment_id: "REFERRAL-TEST-CAPTURE-001",
      received_at: nowIso,
      source: "live",
      environment: "live",
      created_by_name: "JOAS Referral-Test",
    }, { onConflict: "id" });

    if (payErr) errors.push(`payment: ${payErr.message}`);
    else results.payment = { id: paymentId, number: paymentNumber };
  }

  // Step 9: REFERRAL INSERT (the critical part)
  console.log("[referral-test] referral context:", { referralCodeUsed, referrerUserId, referredUserId, referred_order_id: orderId });

  const { data: existingReferral } = await admin
    .from("client_referrals")
    .select("id")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (existingReferral?.id) {
    console.log("[referral-test] referral insert skipped because duplicate:", existingReferral.id);
    results.client_referral = "skipped_duplicate";
  } else {
    // Get referrer account
    const { data: referrerAccount } = await admin
      .from("accounts")
      .select("id")
      .eq("client_id", referrerUserId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const { data: referrerBc } = await admin
      .from("billing_customers")
      .select("id")
      .eq("user_id", referrerUserId)
      .limit(1)
      .maybeSingle();

    console.log("[referral-test] referral insert attempted");
    const { error: refErr } = await admin.from("client_referrals").insert({
      referral_code_used: referralCodeUsed,
      referrer_user_id: referrerUserId,
      referred_user_id: referredUserId,
      referred_order_id: orderId,
      referred_account_id: accountId || null,
      referrer_account_id: referrerAccount?.id || null,
      referred_billing_customer_id: customerId || null,
      referrer_billing_customer_id: referrerBc?.id || null,
      status: "order_created",
      qualifying_cycles_paid: 0,
      required_cycles: 3,
      reward_status: "not_eligible",
      reward_amount: 25,
      reward_type: "Visa/Mastercard gift card",
    });

    if (refErr) {
      console.error("[referral-test] referral insert failed:", refErr);
      errors.push(`client_referral: ${refErr.message}`);
    } else {
      console.log("[referral-test] referral insert succeeded");
      results.client_referral = true;
    }
  }

  const ok = errors.length === 0;
  return new Response(JSON.stringify({ ok, results, errors, order_id: orderId, order_number: orderNumber }), {
    status: ok ? 200 : 207,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
