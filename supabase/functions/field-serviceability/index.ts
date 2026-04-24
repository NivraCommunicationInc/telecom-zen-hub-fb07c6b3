/**
 * field-serviceability — Address check, duplicate detection, customer search.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { requireAuth, checkBodySize, sanitizeString } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const cors = handleCorsPreflightRequest(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };

  try {
    checkBodySize(req);
    const { userId } = await requireAuth(req);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "check";

    // ── Customer search (GET) ──
    if (req.method === "GET" && action === "customer-search") {
      const rawQuery = sanitizeString(url.searchParams.get("q") || "", 120);
      const q = rawQuery.trim();
      const qLower = q.toLowerCase();
      const qDigits = q.replace(/\D/g, "");

      if (q.length < 2) {
        return new Response(JSON.stringify({
          results: [],
          accounts: [],
          orders: [],
          fieldOrders: [],
          hasExistingService: false,
          hasPendingOrder: false,
          isAvailable: true,
        }), { headers });
      }

      const { data: allowedRoles, error: rolesError } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("is_active", true)
        .in("role", ["admin", "employee", "field_sales", "technician"] as any)
        .limit(1);

      if (rolesError) throw rolesError;
      if (!allowedRoles?.length) {
        return new Response(JSON.stringify({ error: "Accès non autorisé" }), { status: 403, headers });
      }

      const profileFilters = [
        `full_name.ilike.%${qLower}%`,
        `first_name.ilike.%${qLower}%`,
        `last_name.ilike.%${qLower}%`,
        `email.ilike.%${qLower}%`,
        `client_number.ilike.%${qLower}%`,
      ];

      if (qDigits.length >= 4) {
        profileFilters.push(`phone.ilike.%${qDigits}%`);
      }

      const orderFilters = [
        `order_number.ilike.%${qLower}%`,
        `client_email.ilike.%${qLower}%`,
        `client_first_name.ilike.%${qLower}%`,
        `client_last_name.ilike.%${qLower}%`,
        `client_full_address.ilike.%${qLower}%`,
        `shipping_address.ilike.%${qLower}%`,
      ];

      if (qDigits.length >= 4) {
        orderFilters.push(`client_phone.ilike.%${qDigits}%`);
      }

      const [profilesRes, accountsRes, fieldOrdersRes] = await Promise.all([
        admin
          .from("profiles")
          .select("user_id, full_name, first_name, last_name, email, phone, client_number, service_address, service_city, service_postal_code")
          .or(profileFilters.join(","))
          .limit(20),
        admin
          .from("accounts")
          .select("id, client_id, account_number, account_name, status, primary_service_address, primary_service_city, primary_service_postal_code")
          .or(`account_number.ilike.%${qLower}%,account_name.ilike.%${qLower}%,primary_service_address.ilike.%${qLower}%,primary_service_postal_code.ilike.%${qLower}%`)
          .limit(20),
        admin
          .from("field_sales_orders")
          .select("id, customer_name, customer_address, payment_status, sync_status, created_at")
          .or(`customer_name.ilike.%${qLower}%,customer_address.ilike.%${qLower}%`)
          .limit(10),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (fieldOrdersRes.error) throw fieldOrdersRes.error;

      const { data: ordersData, error: ordersError } = await admin
        .from("orders")
        .select("id, order_number, status, service_type, client_full_address, shipping_address, client_first_name, client_last_name, client_email, client_phone")
        .or(orderFilters.join(","))
        .in("status", ["pending", "processing", "submitted", "received", "shipped"])
        .limit(10);

      if (ordersError) {
        console.error("[field-serviceability] customer-search orders lookup failed", {
          query: q,
          message: ordersError.message,
        });
      }

      const profiles = profilesRes.data || [];
      const accounts = accountsRes.data || [];
      const fieldOrders = fieldOrdersRes.data || [];
      const orders = ordersData || [];

      const missingProfileIds = Array.from(new Set(
        accounts
          .map((account: any) => account.client_id)
          .filter((clientId: string | null) => !!clientId && !profiles.some((profile: any) => profile.user_id === clientId))
      ));

      const linkedProfilesRes = missingProfileIds.length > 0
        ? await admin
            .from("profiles")
            .select("user_id, full_name, first_name, last_name, email, phone, client_number, service_address, service_city, service_postal_code")
            .in("user_id", missingProfileIds)
        : { data: [], error: null };

      if (linkedProfilesRes.error) throw linkedProfilesRes.error;

      const accountByClientId = new Map(
        accounts
          .filter((account: any) => account.client_id)
          .map((account: any) => [account.client_id, account])
      );

      const resultsMap = new Map<string, any>();

      const upsertResult = (profile: any, source: "profile" | "account") => {
        const existing = resultsMap.get(profile.user_id);
        const account = accountByClientId.get(profile.user_id);
        const fullName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || account?.account_name || null;

        resultsMap.set(profile.user_id, {
          id: profile.user_id,
          full_name: fullName,
          email: profile.email || existing?.email || null,
          phone: profile.phone || existing?.phone || null,
          address: account?.primary_service_address || profile.service_address || existing?.address || "",
          city: account?.primary_service_city || profile.service_city || existing?.city || "",
          postal_code: account?.primary_service_postal_code || profile.service_postal_code || existing?.postal_code || "",
          source: existing?.source === "profile" ? "profile" : source,
          account_number: account?.account_number || existing?.account_number || null,
        });
      };

      for (const profile of profiles) {
        upsertResult(profile, "profile");
      }

      for (const profile of linkedProfilesRes.data || []) {
        upsertResult(profile, "account");
      }

      for (const account of accounts) {
        if (!account.client_id || resultsMap.has(account.client_id)) continue;
        resultsMap.set(account.client_id, {
          id: account.client_id,
          full_name: account.account_name || `Compte ${account.account_number}`,
          email: null,
          phone: null,
          address: account.primary_service_address || "",
          city: account.primary_service_city || "",
          postal_code: account.primary_service_postal_code || "",
          source: "account",
          account_number: account.account_number || null,
        });
      }

      for (const order of orders) {
        const orderName = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ").trim();
        const dedupeKey =
          [order.client_email?.toLowerCase?.(), order.client_phone?.replace?.(/\D/g, ""), orderName.toLowerCase(), order.client_full_address || order.shipping_address]
            .filter(Boolean)
            .join("|") || `order:${order.id}`;

        if (Array.from(resultsMap.values()).some((entry: any) => {
          const entryPhone = entry.phone?.replace?.(/\D/g, "") || "";
          const orderPhone = order.client_phone?.replace?.(/\D/g, "") || "";
          return Boolean(
            (entry.email && order.client_email && entry.email.toLowerCase() === order.client_email.toLowerCase()) ||
            (entryPhone && orderPhone && entryPhone === orderPhone) ||
            ((entry.full_name || "").toLowerCase() === orderName.toLowerCase() && (entry.address || "") === (order.client_full_address || order.shipping_address || ""))
          );
        })) {
          continue;
        }

        resultsMap.set(`order:${dedupeKey}`, {
          id: `order:${order.id}`,
          full_name: orderName || `Commande ${order.order_number}`,
          email: order.client_email || null,
          phone: order.client_phone || null,
          address: order.client_full_address || order.shipping_address || "",
          city: "",
          postal_code: "",
          source: "order",
          account_number: null,
        });
      }

      const rankResult = (entry: any) => {
        const haystacks = [
          entry.full_name,
          entry.email,
          entry.phone,
          entry.address,
          entry.postal_code,
          entry.account_number,
        ].filter(Boolean).map((value: string) => value.toLowerCase());

        if (haystacks.some((value) => value === qLower)) return 0;
        if (qDigits && entry.phone?.replace(/\D/g, "").includes(qDigits)) return 1;
        if (haystacks.some((value) => value.startsWith(qLower))) return 2;
        if (haystacks.some((value) => value.includes(qLower))) return 3;
        return 4;
      };

      const results = Array.from(resultsMap.values())
        .sort((a, b) => rankResult(a) - rankResult(b) || (a.full_name || "").localeCompare(b.full_name || ""))
        .slice(0, 20);

      const hasExistingService = accounts.some((account: any) => account.status === "active");
      const hasPendingOrder = orders.length > 0 || fieldOrders.length > 0;

      return new Response(JSON.stringify({
        results,
        accounts,
        orders,
        fieldOrders,
        hasExistingService,
        hasPendingOrder,
        isAvailable: !hasExistingService && !hasPendingOrder,
      }), { headers });
    }

    if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST requis" }), { status: 405, headers });

    const body = await req.json();

    // ── Serviceability check ──
    if (action === "check") {
      const postalCode = sanitizeString(body.postal_code || "", 10).replace(/\s+/g, "").toUpperCase();
      const address = sanitizeString(body.address || "", 500);
      const city = sanitizeString(body.city || "", 200);

      if (postalCode.length < 3) return new Response(JSON.stringify({ status: "unknown", message: "Code postal invalide" }), { headers });

      const prefix = postalCode.substring(0, 3);
      const { data: coverage } = await admin.from("service_coverage_areas").select("coverage_type, available_services, notes").eq("postal_prefix", prefix).eq("is_active", true).maybeSingle();

      let serviceabilityStatus = "unknown";
      let coverageType = null;
      let serviceableProducts: string[] = [];
      let notes = null;

      if (!coverage) { serviceabilityStatus = "unavailable"; }
      else {
        coverageType = coverage.coverage_type;
        serviceableProducts = coverage.available_services || [];
        notes = coverage.notes;
        serviceabilityStatus = coverageType === "unavailable" ? "unavailable" : coverageType === "limited" ? "limited" : "available";
      }

      const { data: existingOrders } = await admin.from("orders").select("id").ilike("client_full_address", `%${postalCode}%`).in("status", ["pending", "processing", "submitted"]).limit(3);

      await admin.from("address_serviceability_checks").insert({
        raw_input: { address, city, postal_code: postalCode },
        normalized_address: `${address}, ${city}, QC ${postalCode}`,
        serviceability_status: serviceabilityStatus,
        coverage_type: coverageType,
        serviceable_products: serviceableProducts,
        checked_by_user_id: userId,
        source_system: "field_portal",
        response_payload: { existing_orders: existingOrders?.length || 0 },
      });

      return new Response(JSON.stringify({
        status: serviceabilityStatus,
        coverage_type: coverageType,
        serviceable_products: serviceableProducts,
        notes,
        existing_orders_count: existingOrders?.length || 0,
        has_active_subscription: false,
        normalized_address: `${address}, ${city}, QC ${postalCode}`,
      }), { headers });
    }

    // ── Duplicate detection ──
    if (action === "duplicate-check") {
      const phone = sanitizeString(body.phone || "", 20).replace(/\D/g, "");
      const email = (body.email || "").trim().toLowerCase();
      const matches: Array<{ type: string; id: string; name: string; score: number }> = [];

      if (phone.length >= 10) {
        const { data } = await admin.from("field_leads").select("id, first_name, last_name").ilike("phone", `%${phone.slice(-10)}%`).limit(5);
        for (const m of data || []) matches.push({ type: "phone", id: m.id, name: `${m.first_name} ${m.last_name}`, score: 0.9 });

        const { data: profiles } = await admin.from("profiles").select("id, first_name, last_name").ilike("phone", `%${phone.slice(-10)}%`).limit(5);
        for (const m of profiles || []) matches.push({ type: "existing_customer", id: m.id, name: `${m.first_name} ${m.last_name}`, score: 0.95 });
      }

      if (email?.includes("@")) {
        const { data } = await admin.from("field_leads").select("id, first_name, last_name").ilike("email", email).limit(5);
        for (const m of data || []) if (!matches.find(x => x.id === m.id)) matches.push({ type: "email", id: m.id, name: `${m.first_name} ${m.last_name}`, score: 0.85 });
      }

      return new Response(JSON.stringify({ has_duplicates: matches.length > 0, matches }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });
  } catch (err: any) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});
