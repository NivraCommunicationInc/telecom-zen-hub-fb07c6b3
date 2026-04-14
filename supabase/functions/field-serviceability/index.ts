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
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      if (q.length < 2) return new Response(JSON.stringify({ results: [] }), { headers });

      const [accountsRes, fieldOrdersRes, ordersRes] = await Promise.all([
        admin.from("accounts").select("id, account_number, status, primary_service_address, primary_service_city, primary_service_postal_code").or(`primary_service_address.ilike.%${q}%,primary_service_postal_code.ilike.%${q}%,account_number.ilike.%${q}%`).limit(10),
        admin.from("field_sales_orders").select("id, customer_name, customer_address, payment_status, sync_status, created_at").ilike("customer_address", `%${q}%`).limit(10),
        admin.from("orders").select("id, order_number, status, service_type, service_address").or(`service_address.ilike.%${q}%`).in("status", ["pending", "processing", "submitted", "received", "shipped"]).limit(10),
      ]);

      const accounts = accountsRes.data || [];
      const fieldOrders = fieldOrdersRes.data || [];
      const orders = ordersRes.data || [];

      const hasExistingService = accounts.some((a: any) => a.status === "active");
      const hasPendingOrder = orders.length > 0 || fieldOrders.length > 0;

      return new Response(JSON.stringify({
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
