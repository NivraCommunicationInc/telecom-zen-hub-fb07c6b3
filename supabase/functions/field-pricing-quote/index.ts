/**
 * field-pricing-quote â€” Server-side pricing engine for field sales.
 * Computes totals, taxes, discounts â€” single source of truth.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { requireAuth, checkBodySize } from "../_shared/security.ts";
import { TPS_RATE, TVQ_RATE, computeTaxes } from "../_shared/tax-constants.ts";

interface QuoteItem {
  product_id: string;
  quantity: number;
}

interface PromoRequest {
  promo_code?: string;
  field_promo_id?: string;
}

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

    await requireAuth(req);
    const body = await req.json();

    const items: QuoteItem[] = body.items || [];
    const promos: PromoRequest[] = body.promos || [];
    const installationType: string = body.installation_type || "self_install";
    const paymentMethod: string = body.payment_method || "paypal";

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "Aucun article dans le panier" }), { status: 400, headers });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all products
    const productIds = items.map(i => i.product_id);
    const { data: products, error: prodErr } = await admin
      .from("services")
      .select("*")
      .in("id", productIds);
    if (prodErr) throw prodErr;

    // Fetch versioned prices
    const { data: allPrices } = await admin
      .from("product_prices")
      .select("*")
      .in("service_id", productIds)
      .eq("status", "active");

    // Fetch config for activation fees
    const { data: configRows } = await admin
      .from("field_sales_config")
      .select("config_key, config_value, config_type");

    const config: Record<string, any> = {};
    for (const row of configRows || []) {
      config[row.config_key] = row.config_type === "number"
        ? Number(row.config_value)
        : row.config_type === "json"
          ? JSON.parse(row.config_value)
          : row.config_value;
    }

    // Build line items
    const lines: Array<{
      product_id: string;
      name: string;
      line_type: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      billing_frequency: string;
    }> = [];

    let recurringSubtotal = 0;
    let oneTimeSubtotal = 0;

    for (const item of items) {
      const product = products?.find((p: any) => p.id === item.product_id);
      if (!product) continue;

      // Get the best price: first from product_prices, then fallback to services.price
      const versionedPrice = (allPrices || []).find(
        (p: any) => p.service_id === item.product_id && p.price_type === "recurring_monthly"
      );
      const oneTimePrice = (allPrices || []).find(
        (p: any) => p.service_id === item.product_id && p.price_type === "one_time"
      );

      const recurringAmount = versionedPrice ? Number(versionedPrice.amount) : Number(product.price || 0);
      const oneTimeAmount = oneTimePrice ? Number(oneTimePrice.amount) : 0;

      const isEquipment = product.category === "Équipement" || product.billing_type === "one_time";

      if (isEquipment) {
        const total = (oneTimeAmount || recurringAmount) * item.quantity;
        oneTimeSubtotal += total;
        lines.push({
          product_id: item.product_id,
          name: product.name,
          line_type: "equipment",
          quantity: item.quantity,
          unit_price: oneTimeAmount || recurringAmount,
          line_total: total,
          billing_frequency: "one_time",
        });
      } else {
        const total = recurringAmount * item.quantity;
        recurringSubtotal += total;
        lines.push({
          product_id: item.product_id,
          name: product.name,
          line_type: "service",
          quantity: item.quantity,
          unit_price: recurringAmount,
          line_total: total,
          billing_frequency: "monthly",
        });
      }
    }

    // Activation fee
    const activationFeeSingle = config.activation_fee_single || 25;
    const activationFeeMulti = config.activation_fee_multi || 45;
    const serviceCount = lines.filter(l => l.line_type === "service").length;
    const activationFee = serviceCount === 0 ? 0 : serviceCount === 1 ? activationFeeSingle : activationFeeMulti;

    if (activationFee > 0) {
      oneTimeSubtotal += activationFee;
      lines.push({
        product_id: "activation",
        name: "Frais d'activation",
        line_type: "fee",
        quantity: 1,
        unit_price: activationFee,
        line_total: activationFee,
        billing_frequency: "one_time",
      });
    }

    // Installation fee
    if (installationType === "technician") {
      const installFee = config.installation_fee_technician || 50;
      oneTimeSubtotal += installFee;
      lines.push({
        product_id: "installation",
        name: "Frais d'installation technicien",
        line_type: "fee",
        quantity: 1,
        unit_price: installFee,
        line_total: installFee,
        billing_frequency: "one_time",
      });
    }

    // Apply promotions
    let totalDiscount = 0;
    const appliedPromos: Array<{
      id: string;
      code: string;
      name: string;
      discount_amount: number;
      type: string;
    }> = [];

    for (const promo of promos) {
      if (promo.field_promo_id) {
        const { data: fp } = await admin
          .from("field_sales_promotions")
          .select("*")
          .eq("id", promo.field_promo_id)
          .eq("is_active", true)
          .single();

        if (fp) {
          let discountAmount = 0;
          if (fp.promo_type === "monthly") {
            discountAmount = Number(fp.discount_monthly || 0);
          } else if (fp.promo_type === "onetime") {
            discountAmount = Number(fp.discount_onetime || 0);
          } else if (fp.promo_type === "percentage") {
            discountAmount = Math.round(recurringSubtotal * Number(fp.discount_percentage || 0) / 100 * 100) / 100;
          }

          totalDiscount += discountAmount;
          appliedPromos.push({
            id: fp.id,
            code: fp.name,
            name: fp.description || fp.name,
            discount_amount: discountAmount,
            type: fp.promo_type,
          });
        }
      }

      if (promo.promo_code) {
        const { data: p } = await admin
          .from("promotions")
          .select("*")
          .eq("code", promo.promo_code)
          .eq("status", "active")
          .single();

        if (p) {
          let discountAmount = 0;
          if (p.discount_type === "percent") {
            discountAmount = Math.round(recurringSubtotal * Number(p.discount_value || 0) / 100 * 100) / 100;
          } else {
            discountAmount = Number(p.discount_value || 0);
          }

          totalDiscount += discountAmount;
          appliedPromos.push({
            id: p.id,
            code: p.code,
            name: p.name,
            discount_amount: discountAmount,
            type: p.discount_type,
          });
        }
      }
    }

    // Compute taxes on (oneTime + recurring - discount)
    const taxableBase = Math.max(0, recurringSubtotal + oneTimeSubtotal - totalDiscount);
    const { tps, tvq, total: grandTotal } = computeTaxes(taxableBase);

    const dueToday = Math.round((oneTimeSubtotal - Math.min(totalDiscount, oneTimeSubtotal) + 
      (tps * oneTimeSubtotal / (recurringSubtotal + oneTimeSubtotal || 1)) + 
      (tvq * oneTimeSubtotal / (recurringSubtotal + oneTimeSubtotal || 1))) * 100) / 100;

    const result = {
      lines,
      recurring_subtotal: Math.round(recurringSubtotal * 100) / 100,
      one_time_subtotal: Math.round(oneTimeSubtotal * 100) / 100,
      discount_total: Math.round(totalDiscount * 100) / 100,
      applied_promos: appliedPromos,
      activation_fee: activationFee,
      taxable_base: Math.round(taxableBase * 100) / 100,
      tps_rate: TPS_RATE,
      tvq_rate: TVQ_RATE,
      tps_amount: tps,
      tvq_amount: tvq,
      grand_total: grandTotal,
      recurring_monthly_estimate: Math.round(recurringSubtotal * (1 + TPS_RATE + TVQ_RATE) * 100) / 100,
      due_today_estimate: Math.round(grandTotal * 100) / 100,
      computed_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), { headers });

  } catch (err) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});
