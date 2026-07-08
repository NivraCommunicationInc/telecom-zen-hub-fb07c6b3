// QA C360 — Provision the isolated test account used to validate Client 360 modules.
// Idempotent: safe to invoke multiple times. All resources are keyed by email + fixed markers.
//
// Guardrails:
//   - Account marked with account_tags(tag_key='qa_test_account')
//   - Subscription flagged environment='test'
//   - No payment method attached => no real charge is possible
//   - Auth user created via admin API (email confirmed so login is possible if ever needed for
//     manual QA), but no real emails are sent to @nivra-test.ca

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_EMAIL = "test-c360-planchange@nivra-test.ca";
const TEST_FIRST_NAME = "QA";
const TEST_LAST_NAME = "C360-PlanChange";
const TEST_TAG_KEY = "qa_test_account";
const TEST_ENV = "test";
const INTERNET_500_PLAN_CODE = "internet_500";
const INTERNET_500_NAME = "Internet 500 Mbps";
const INTERNET_500_PRICE = 50.0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Authorization: only admin/supervisor can trigger provisioning.
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const callerId = userData.user.id;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerId, _role: "admin" });
    const { data: isSup } = await supabase.rpc("has_role", { _user_id: callerId, _role: "supervisor" });
    if (!isAdmin && !isSup) return json({ error: "forbidden" }, 403);

    const created: string[] = [];
    const reused: string[] = [];

    // 1. Auth user (idempotent by email).
    let userId: string;
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === TEST_EMAIL);
    if (existing) {
      userId = existing.id;
      reused.push("auth.users");
    } else {
      const password = crypto.randomUUID() + "-Qa!"; // never returned to caller
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { qa_test_account: true, purpose: "c360_planchange" },
      });
      if (createErr || !newUser?.user) throw new Error(`auth create: ${createErr?.message}`);
      userId = newUser.user.id;
      created.push("auth.users");
    }

    // 2. Profile.
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, client_number")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingProfile) {
      // client_number is required + unique. Reserve a deterministic QA range prefix.
      const clientNumber = `QA-C360-${Date.now().toString().slice(-6)}`;
      const { error: profErr } = await supabase.from("profiles").insert({
        user_id: userId,
        client_number: clientNumber,
        first_name: TEST_FIRST_NAME,
        last_name: TEST_LAST_NAME,
        email: TEST_EMAIL,
      });
      if (profErr) throw new Error(`profile insert: ${profErr.message}`);
      created.push("profiles");
    } else {
      reused.push("profiles");
    }

    // 3. Account.
    let accountId: string;
    const { data: existingAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("client_id", userId)
      .maybeSingle();
    if (existingAccount) {
      accountId = existingAccount.id;
      reused.push("accounts");
    } else {
      const accountNumber = `QA-ACC-${Date.now().toString().slice(-6)}`;
      const { data: acc, error: accErr } = await supabase
        .from("accounts")
        .insert({
          client_id: userId,
          account_number: accountNumber,
          account_name: "QA C360 PlanChange",
          status: "active",
          billing_address: "1799 Av. Pierre-Péladeau",
          billing_city: "Laval",
          billing_province: "QC",
          billing_postal_code: "H7T 2Y5",
          primary_service_address: "1799 Av. Pierre-Péladeau",
          primary_service_city: "Laval",
          primary_service_province: "QC",
          primary_service_postal_code: "H7T 2Y5",
        })
        .select("id")
        .single();
      if (accErr || !acc) throw new Error(`account insert: ${accErr?.message}`);
      accountId = acc.id;
      created.push("accounts");
    }

    // 4. Service address.
    let serviceAddressId: string;
    const { data: existingAddr } = await supabase
      .from("service_addresses")
      .select("id")
      .eq("account_id", accountId)
      .eq("is_default", true)
      .maybeSingle();
    if (existingAddr) {
      serviceAddressId = existingAddr.id;
      reused.push("service_addresses");
    } else {
      const { data: addr, error: addrErr } = await supabase
        .from("service_addresses")
        .insert({
          account_id: accountId,
          label: "QA — Adresse test",
          address_line: "1799 Av. Pierre-Péladeau",
          city: "Laval",
          province: "QC",
          postal_code: "H7T 2Y5",
          is_default: true,
          is_primary: true,
          is_active: true,
          created_via: "qa_provisioning",
        })
        .select("id")
        .single();
      if (addrErr || !addr) throw new Error(`service_addresses insert: ${addrErr?.message}`);
      serviceAddressId = addr.id;
      created.push("service_addresses");
    }

    // 5. QA tag on the account (idempotent).
    const { data: existingTag } = await supabase
      .from("account_tags")
      .select("id")
      .eq("account_id", accountId)
      .eq("tag_key", TEST_TAG_KEY)
      .maybeSingle();
    if (!existingTag) {
      const { error: tagErr } = await supabase.from("account_tags").insert({
        account_id: accountId,
        client_user_id: userId,
        tag_key: TEST_TAG_KEY,
        tag_label: "Compte QA C360 — ne pas facturer / ne pas provisionner",
        severity: "info",
        note: "Compte QA interne. Isolé via environment='test' + domaine @nivra-test.ca.",
        created_by: callerId,
      });
      if (tagErr) throw new Error(`account_tags insert: ${tagErr.message}`);
      created.push("account_tags");
    } else {
      reused.push("account_tags");
    }

    // 6. Billing subscription Internet 500 (environment='test').
    let subscriptionId: string;
    const { data: existingSub } = await supabase
      .from("billing_subscriptions")
      .select("id, plan_code, environment")
      .eq("customer_id", userId)
      .eq("environment", TEST_ENV)
      .maybeSingle();
    const today = new Date();
    const anchorDay = today.getUTCDate() > 28 ? 28 : today.getUTCDate();
    const cycleStart = today.toISOString().slice(0, 10);
    const cycleEndDate = new Date(today);
    // cycle_end must be (anchor_day - 1) — one full cycle from today.
    cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + 1);
    cycleEndDate.setUTCDate(anchorDay - 1);
    const cycleEnd = cycleEndDate.toISOString().slice(0, 10);

    if (existingSub) {
      subscriptionId = existingSub.id;
      reused.push("billing_subscriptions");
    } else {
      const { data: sub, error: subErr } = await supabase
        .from("billing_subscriptions")
        .insert({
          customer_id: userId,
          plan_code: INTERNET_500_PLAN_CODE,
          plan_name: INTERNET_500_NAME,
          plan_price: INTERNET_500_PRICE,
          service_category: "Internet",
          status: "active",
          environment: TEST_ENV,
          cycle_start_date: cycleStart,
          cycle_end_date: cycleEnd,
          billing_anchor_date: cycleStart,
          billing_cycle_anchor: anchorDay,
          auto_billing_enabled: false,
          service_address_id: serviceAddressId,
          address_id: serviceAddressId,
          source_type: "qa_provisioning",
        })
        .select("id")
        .single();
      if (subErr || !sub) throw new Error(`billing_subscriptions insert: ${subErr?.message}`);
      subscriptionId = sub.id;
      created.push("billing_subscriptions");
    }

    // 7. Equipment (1 fictional router).
    const { data: existingEq } = await supabase
      .from("equipment_inventory")
      .select("id")
      .eq("serial_number", "QA-ROUTER-C360-001")
      .maybeSingle();
    if (!existingEq) {
      const { error: eqErr } = await supabase.from("equipment_inventory").insert({
        catalog_name: "Borne WiFi QA (test)",
        category: "router",
        sku: "QA-ROUTER-C360",
        serial_number: "QA-ROUTER-C360-001",
        status: "assigned",
        account_id: accountId,
        subscription_id: subscriptionId,
        service_address_id: serviceAddressId,
        address_id: serviceAddressId,
        assigned_at: new Date().toISOString(),
        assigned_by: callerId,
        notes: "Équipement fictif — compte QA C360. Ne pas expédier.",
      });
      if (eqErr) throw new Error(`equipment_inventory insert: ${eqErr.message}`);
      created.push("equipment_inventory");
    } else {
      reused.push("equipment_inventory");
    }

    return json({
      ok: true,
      account: {
        user_id: userId,
        account_id: accountId,
        subscription_id: subscriptionId,
        service_address_id: serviceAddressId,
        email: TEST_EMAIL,
        plan_code: INTERNET_500_PLAN_CODE,
        plan_price: INTERNET_500_PRICE,
        environment: TEST_ENV,
        cycle_start_date: cycleStart,
        cycle_end_date: cycleEnd,
        billing_anchor_day: anchorDay,
      },
      created,
      reused,
      guardrails: {
        payment_method_attached: false,
        environment: TEST_ENV,
        tag: TEST_TAG_KEY,
        note: "Aucune vraie charge possible. Aucun email n'est déclenché automatiquement.",
      },
    });
  } catch (err) {
    console.error("[qa-provision-test-account]", err);
    return json({ error: (err as Error).message ?? "unknown_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
