// Daily inventory low-stock alert. Scans inventory_stock_levels view and queues
// admin emails for items in 'critical' or 'out_of_stock' status. De-dupes by
// last_alert_sent_at (max 1 alert per SKU per 24h).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "nivratelecom@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: levels, error } = await supabase
      .from("inventory_stock_levels")
      .select("*")
      .in("stock_status", ["critical", "out_of_stock"]);
    if (error) throw error;

    let queued = 0;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    for (const item of (levels || []) as any[]) {
      if (item.last_alert_sent_at && item.last_alert_sent_at > cutoff) continue;

      const eventKey = `inv_low_${item.sku}_${new Date().toISOString().slice(0, 10)}`;
      const { error: qErr } = await supabase.from("email_queue").insert({
        event_key: eventKey,
        to_email: ADMIN_EMAIL,
        template_key: "inventory_low_stock",
        template_vars: {
          item_name: `${item.brand || ""} ${item.model || ""}`.trim() || item.sku,
          sku: item.sku,
          available_count: item.available_count,
          min_stock_threshold: item.min_stock_threshold,
          stock_status: item.stock_status,
          language: "fr",
        },
        status: "queued",
      });
      if (!qErr) {
        queued++;
        await supabase
          .from("inventory_stock")
          .update({ last_alert_sent_at: new Date().toISOString() })
          .eq("sku", item.sku);
      }
    }

    return new Response(JSON.stringify({ ok: true, queued, scanned: levels?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
