/**
 * phone-checkout-prepare
 *
 * Server-side preparation of a phone order BEFORE PayPal opens.
 * Bypasses client-side RLS by using the service role.
 *
 * Steps:
 *   1. Validate phone is available.
 *   2. Find or create the client auth user (auto-create-client-account).
 *   3. Find or create the account row (so order has account context).
 *   4. Insert a draft order with status='pending_payment', payment_status='pending'.
 *   5. Return { order_id, user_id, account_id, amount } to the frontend so
 *      it can pass order_id to paypal-create-order.
 *
 * NOTE: We do NOT touch billing_invoices / phone_inventory here. Both happen
 *       in phone-checkout-finalize after PayPal capture confirms the payment.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHIPPING_FEE = 20;
const TPS = 0.05;
const TVQ = 0.09975;

const STORAGE_UPCHARGE: Record<string, number> = {
  "64GB": 0,
  "128GB": 0,
  "256GB": 0,
  "512GB": 100,
  "1TB": 200,
};

interface PrepareBody {
  phone_id: string;
  mode: "phone_only" | "phone_plus_plan";
  selected_plan_id?: string | null;
  selected_color: string;
  selected_storage: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    dob?: string | null;
  };
  shipping: {
    address: string;
    city: string;
    province: string;
    postal_code: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = (await req.json()) as PrepareBody;

    // Basic validation
    if (!body.phone_id || !body.customer?.email) {
      return jsonError("Missing required fields", 400);
    }

    const email = body.customer.email.trim().toLowerCase();
    const firstName = body.customer.first_name.trim();
    const lastName = body.customer.last_name.trim();

    // 1) Load phone & verify availability
    const { data: phone, error: phoneErr } = await supabase
      .from("phone_inventory")
      .select("id, brand, model, storage, price_cad, status, is_visible_on_site")
      .eq("id", body.phone_id)
      .maybeSingle();

    if (phoneErr) {
      console.error("[phone-checkout-prepare] phone fetch", phoneErr);
      return jsonError("Phone lookup failed", 500);
    }
    if (!phone) return jsonError("Phone not found", 404);
    if (phone.status !== "available" || !phone.is_visible_on_site) {
      return jsonError("Phone unavailable", 409);
    }

    // 2) Compute amount on the server (do not trust the client)
    const baseUpcharge = STORAGE_UPCHARGE[phone.storage] ?? 0;
    const selectedUpcharge = STORAGE_UPCHARGE[body.selected_storage] ?? 0;
    const phonePrice = round2(Number(phone.price_cad) - baseUpcharge + selectedUpcharge);
    const subtotal = round2(phonePrice + SHIPPING_FEE);
    const tps = round2(subtotal * TPS);
    const tvq = round2(subtotal * TVQ);
    const total = round2(subtotal + tps + tvq);

    // 3) Find or create auth user
    let userId: string;
    const { data: usersList } = await supabase.auth.admin.listUsers();
    const existing = usersList?.users?.find((u) => u.email?.toLowerCase() === email);

    if (existing) {
      userId = existing.id;
    } else {
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      });
      if (createErr || !newUser?.user) {
        console.error("[phone-checkout-prepare] createUser", createErr);
        return jsonError("Could not create user account", 500);
      }
      userId = newUser.user.id;
    }

    // 4) Ensure profile exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) {
      await supabase.from("profiles").insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: body.customer.phone,
      });
    }

    // 5) Ensure account exists
    let accountId: string | null = null;
    const { data: existingAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("client_id", userId)
      .maybeSingle();

    if (existingAccount) {
      accountId = existingAccount.id;
    } else {
      const { data: acctNum } = await supabase.rpc("generate_account_number");
      const { data: newAccount, error: acctErr } = await supabase
        .from("accounts")
        .insert({
          client_id: userId,
          account_number: acctNum ?? `NV-${Date.now()}`,
          account_name: `${firstName} ${lastName}`.trim(),
          status: "active",
          billing_address: body.shipping.address,
          billing_city: body.shipping.city,
          billing_province: body.shipping.province,
          billing_postal_code: body.shipping.postal_code,
          primary_service_address: body.shipping.address,
          primary_service_city: body.shipping.city,
          primary_service_province: body.shipping.province,
          primary_service_postal_code: body.shipping.postal_code,
        })
        .select("id")
        .single();
      if (acctErr) {
        console.error("[phone-checkout-prepare] account insert", acctErr);
        // Continue without account â€” order still works
      } else {
        accountId = newAccount?.id ?? null;
      }
    }

    // 6) Generate order number
    const { data: orderNum } = await supabase.rpc("generate_order_number");

    // 7) Insert draft order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        service_type: "phone",
        category: "phone_purchase",
        status: "pending_payment",
        payment_status: "pending",
        order_number: orderNum ?? `PH-${Date.now()}`,
        client_email: email,
        client_first_name: firstName,
        client_last_name: lastName,
        client_phone: body.customer.phone,
        client_dob: body.customer.dob || null,
        shipping_address: body.shipping.address,
        shipping_city: body.shipping.city,
        shipping_province: body.shipping.province,
        shipping_postal_code: body.shipping.postal_code,
        subtotal,
        tps_amount: tps,
        tvq_amount: tvq,
        total_amount: total,
        delivery_fee: SHIPPING_FEE,
        activation_fee: 0,
        installation_fee: 0,
        equipment_details: [{
          phone_id: phone.id,
          brand: phone.brand,
          model: phone.model,
          storage: body.selected_storage,
          color: body.selected_color,
          unit_price: phonePrice,
        }],
        created_by: "guest_phone_checkout",
        notes: `Phone order: ${phone.brand} ${phone.model} (${body.selected_storage}, ${body.selected_color}). Mode: ${body.mode}.${body.selected_plan_id ? ` Plan: ${body.selected_plan_id}.` : ""}`,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("[phone-checkout-prepare] order insert", orderErr);
      return jsonError(`Order creation failed: ${orderErr?.message ?? "unknown"}`, 500);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        user_id: userId,
        account_id: accountId,
        amount: total,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[phone-checkout-prepare] fatal", err);
    return jsonError(err?.message ?? "Internal error", 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
