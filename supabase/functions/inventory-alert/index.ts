/**
 * inventory-alert — Daily low-stock alert.
 * Queries inventory_stock table directly (groups by sku), queues admin emails
 * for items in critical or out_of_stock status (available < min_stock_threshold).
 * De-dupes: max 1 alert per SKU per 24h (checked via last_alert_sent_at).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "support@nivra-telecom.ca";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch all inventory_stock rows to aggregate by SKU in JS
    // (avoids PostgREST view exposure issues with keyless views)
    const { data: allStock, error: stockErr } = await supabase
      .from("inventory_stock")
      .select("id, sku, brand, model, item_type, status, min_stock_threshold, reorder_point, last_alert_sent_at, warehouse_location");

    if (stockErr) throw stockErr;

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Aggregate by SKU
    const bySkuMap: Record<string, {
      sku: string; brand: string; model: string; item_type: string;
      available: number; total: number; min_stock_threshold: number; reorder_point: number;
      last_alert_sent_at: string | null; ids: string[];
    }> = {};

    for (const item of (allStock || []) as any[]) {
      const key = item.sku || item.id;
      if (!bySkuMap[key]) {
        bySkuMap[key] = {
          sku: item.sku,
          brand: item.brand || "",
          model: item.model || "",
          item_type: item.item_type || "",
          available: 0,
          total: 0,
          min_stock_threshold: item.min_stock_threshold ?? 5,
          reorder_point: item.reorder_point ?? 3,
          last_alert_sent_at: item.last_alert_sent_at,
          ids: [],
        };
      }
      const grp = bySkuMap[key];
      grp.total++;
      if (item.status === "available") grp.available++;
      if (item.last_alert_sent_at && (!grp.last_alert_sent_at || item.last_alert_sent_at > grp.last_alert_sent_at)) {
        grp.last_alert_sent_at = item.last_alert_sent_at;
      }
      grp.ids.push(item.id);
    }

    let queued = 0;
    const skuGroups = Object.values(bySkuMap);

    for (const grp of skuGroups) {
      // Skip if available count is above reorder_point
      if (grp.available > grp.reorder_point) continue;

      // De-dupe: skip if already alerted in last 24h
      if (grp.last_alert_sent_at && grp.last_alert_sent_at > cutoff) continue;

      const stock_status = grp.available === 0 ? "out_of_stock" : "critical";
      const eventKey = `inv_low_${grp.sku}_${new Date().toISOString().slice(0, 10)}`;

      let qErr: any = null;
      try { await enqueueCommunication({
        channel: "email",
        templateKey: "inventory_low_stock",
        recipient: ADMIN_EMAIL,
        idempotencyKey: eventKey,
        templateVars: {
          item_name: `${grp.brand} ${grp.model}`.trim() || grp.sku,
          sku: grp.sku,
          available_count: grp.available,
          total_count: grp.total,
          min_stock_threshold: grp.min_stock_threshold,
          reorder_point: grp.reorder_point,
          stock_status,
          language: "fr",
        },
      }); } catch (__e) { qErr = __e; }

      if (!qErr) {
        queued++;
        // Update last_alert_sent_at on all rows for this SKU
        await supabase
          .from("inventory_stock")
          .update({ last_alert_sent_at: new Date().toISOString() })
          .in("id", grp.ids);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, queued, scanned: skuGroups.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
