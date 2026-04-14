/**
 * field-serviceability — Real address serviceability check.
 * Validates address, checks coverage, detects duplicates.
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
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST requis" }), { status: 405, headers });
    }

    const { userId } = await requireAuth(req);
    const body = await req.json();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "check";

    // ── Serviceability check ──
    if (action === "check") {
      const postalCode = sanitizeString(body.postal_code || "", 10).replace(/\s+/g, "").toUpperCase();
      const address = sanitizeString(body.address || "", 500);
      const city = sanitizeString(body.city || "", 200);

      if (postalCode.length < 3) {
        return new Response(JSON.stringify({
          status: "unknown",
          message: "Code postal invalide",
        }), { headers });
      }

      const prefix = postalCode.substring(0, 3);

      // Check service_coverage_areas
      const { data: coverage, error: covErr } = await admin
        .from("service_coverage_areas")
        .select("coverage_type, available_services, notes")
        .eq("postal_prefix", prefix)
        .eq("is_active", true)
        .maybeSingle();

      let serviceabilityStatus = "unknown";
      let coverageType = null;
      let serviceableProducts: string[] = [];
      let notes = null;

      if (covErr) {
        serviceabilityStatus = "unknown";
      } else if (!coverage) {
        serviceabilityStatus = "unavailable";
      } else {
        coverageType = coverage.coverage_type;
        serviceableProducts = coverage.available_services || [];
        notes = coverage.notes;
        serviceabilityStatus = coverageType === "unavailable" ? "unavailable"
          : coverageType === "limited" ? "limited"
          : "available";
      }

      // Check for existing orders/subscriptions at this address
      const { data: existingOrders } = await admin
        .from("orders")
        .select("id, order_number, status")
        .ilike("client_full_address", `%${postalCode}%`)
        .in("status", ["pending", "processing", "submitted", "received", "shipped"])
        .limit(3);

      const { data: existingSubs } = await admin
        .from("billing_subscriptions")
        .select("id, plan_name, status")
        .eq("status", "active")
        .limit(3);

      // Log the check
      await admin.from("address_serviceability_checks").insert({
        raw_input: { address, city, postal_code: postalCode },
        normalized_address: `${address}, ${city}, QC ${postalCode}`,
        serviceability_status: serviceabilityStatus,
        coverage_type: coverageType,
        serviceable_products: serviceableProducts,
        checked_by_user_id: userId,
        source_system: "field_portal",
        response_payload: { coverage, existing_orders: existingOrders?.length || 0 },
      });

      return new Response(JSON.stringify({
        status: serviceabilityStatus,
        coverage_type: coverageType,
        serviceable_products: serviceableProducts,
        notes,
        existing_orders_count: existingOrders?.length || 0,
        has_active_subscription: false, // Would need address matching
        normalized_address: `${address}, ${city}, QC ${postalCode}`,
      }), { headers });
    }

    // ── Duplicate detection ──
    if (action === "duplicate-check") {
      const phone = sanitizeString(body.phone || "", 20).replace(/\D/g, "");
      const email = (body.email || "").trim().toLowerCase();
      const address = sanitizeString(body.address || "", 500);

      const matches: Array<{ type: string; id: string; name: string; score: number }> = [];

      // Check field_leads by phone
      if (phone.length >= 10) {
        const { data: phoneMatches } = await admin
          .from("field_leads")
          .select("id, first_name, last_name, phone")
          .ilike("phone", `%${phone.slice(-10)}%`)
          .limit(5);

        for (const m of phoneMatches || []) {
          matches.push({
            type: "phone",
            id: m.id,
            name: `${m.first_name} ${m.last_name}`,
            score: 0.9,
          });
        }
      }

      // Check field_leads by email
      if (email && email.includes("@")) {
        const { data: emailMatches } = await admin
          .from("field_leads")
          .select("id, first_name, last_name, email")
          .ilike("email", email)
          .limit(5);

        for (const m of emailMatches || []) {
          if (!matches.find(x => x.id === m.id)) {
            matches.push({
              type: "email",
              id: m.id,
              name: `${m.first_name} ${m.last_name}`,
              score: 0.85,
            });
          }
        }
      }

      // Check profiles (existing customers) by phone
      if (phone.length >= 10) {
        const { data: profileMatches } = await admin
          .from("profiles")
          .select("id, first_name, last_name, phone")
          .ilike("phone", `%${phone.slice(-10)}%`)
          .limit(5);

        for (const m of profileMatches || []) {
          matches.push({
            type: "existing_customer_phone",
            id: m.id,
            name: `${m.first_name} ${m.last_name}`,
            score: 0.95,
          });
        }
      }

      // Log the check
      if (matches.length > 0) {
        const hash = `${phone}-${email}-${address}`.toLowerCase();
        for (const match of matches.slice(0, 5)) {
          await admin.from("customer_duplicate_checks").insert({
            incoming_customer_hash: hash,
            matched_field_lead_id: match.type.startsWith("existing") ? null : match.id,
            matched_customer_id: match.type.startsWith("existing") ? match.id : null,
            match_type: match.type,
            match_score: match.score,
          });
        }
      }

      return new Response(JSON.stringify({
        has_duplicates: matches.length > 0,
        matches,
      }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });

  } catch (err: any) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});
