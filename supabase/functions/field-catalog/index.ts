/**
 * field-catalog â€” Commercial catalog API for the Field Portal.
 * Returns services, prices, equipment rules, and promotions from the single source of truth.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { requireAuth, checkBodySize } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const cors = handleCorsPreflightRequest(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };

  try {
    checkBodySize(req);
    const { supabase, userId } = await requireAuth(req);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "full";
    const category = url.searchParams.get("category");
    const productId = url.searchParams.get("product_id");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: full catalog
    if (action === "full" || action === "products") {
      let query = admin
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (category) {
        query = query.eq("category", category);
      }

      const { data: products, error } = await query;
      if (error) throw error;

      // Fetch prices for all products
      const productIds = (products || []).map((p: any) => p.id);
      const { data: prices } = await admin
        .from("product_prices")
        .select("*")
        .in("service_id", productIds)
        .eq("status", "active");

      // Fetch attributes
      const { data: attributes } = await admin
        .from("product_attributes")
        .select("*")
        .in("service_id", productIds);

      // Fetch equipment rules
      const { data: equipmentRules } = await admin
        .from("product_equipment_rules")
        .select("*, equipment:equipment_service_id(id, name, category, price)")
        .in("service_id", productIds);

      // Fetch active promotions
      const now = new Date().toISOString();
      const { data: promotions } = await admin
        .from("promotions")
        .select("*")
        .eq("status", "active")
        .or(`end_at.is.null,end_at.gte.${now}`);

      // Fetch field-specific promotions
      const { data: fieldPromos } = await admin
        .from("field_sales_promotions")
        .select("*")
        .eq("is_active", true);

      return new Response(JSON.stringify({
        products: products || [],
        prices: prices || [],
        attributes: attributes || [],
        equipment_rules: equipmentRules || [],
        promotions: promotions || [],
        field_promotions: fieldPromos || [],
      }), { headers });
    }

    // Action: single product detail
    if (action === "product" && productId) {
      const { data: product, error } = await admin
        .from("services")
        .select("*")
        .eq("id", productId)
        .single();
      if (error) throw error;

      const [pricesRes, attrsRes, rulesRes] = await Promise.all([
        admin.from("product_prices").select("*").eq("service_id", productId).eq("status", "active"),
        admin.from("product_attributes").select("*").eq("service_id", productId),
        admin.from("product_equipment_rules")
          .select("*, equipment:equipment_service_id(id, name, category, price)")
          .eq("service_id", productId),
      ]);

      return new Response(JSON.stringify({
        product,
        prices: pricesRes.data || [],
        attributes: attrsRes.data || [],
        equipment_rules: rulesRes.data || [],
      }), { headers });
    }

    // Action: equipment catalog only
    if (action === "equipment") {
      const { data, error } = await admin
        .from("services")
        .select("*")
        .eq("is_active", true)
        .eq("category", "Équipement")
        .order("display_order", { ascending: true });
      if (error) throw error;

      const eqIds = (data || []).map((e: any) => e.id);
      const { data: prices } = await admin
        .from("product_prices")
        .select("*")
        .in("service_id", eqIds)
        .eq("status", "active");

      return new Response(JSON.stringify({
        equipment: data || [],
        prices: prices || [],
      }), { headers });
    }

    // Action: config values
    if (action === "config") {
      const { data, error } = await admin.from("field_sales_config").select("*");
      if (error) throw error;

      const config: Record<string, any> = {};
      for (const row of data || []) {
        try {
          config[row.config_key] = row.config_type === "json"
            ? JSON.parse(row.config_value)
            : row.config_type === "number"
              ? Number(row.config_value)
              : row.config_value;
        } catch (_e) {
          config[row.config_key] = row.config_value;
        }
      }

      return new Response(JSON.stringify({ config }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });

  } catch (err) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});
