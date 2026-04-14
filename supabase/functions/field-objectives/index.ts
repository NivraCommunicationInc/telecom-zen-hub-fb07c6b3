/**
 * field-objectives — User objectives and progress API.
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
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "GET requis" }), { status: 405, headers });
    }

    const { userId } = await requireAuth(req);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "current";

    if (action === "current") {
      // Get current month objectives
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const { data: objectives } = await admin
        .from("employee_objectives")
        .select("*")
        .eq("user_id", userId)
        .eq("month", monthStart);

      // If no objectives set, get defaults from templates
      if (!objectives || objectives.length === 0) {
        const { data: templates } = await admin
          .from("field_objective_templates")
          .select("*")
          .eq("status", "active");

        // Also get defaults from config
        const { data: configRows } = await admin
          .from("field_sales_config")
          .select("config_key, config_value")
          .in("config_key", ["default_sales_target", "default_revenue_target"]);

        const defaultSales = Number(configRows?.find((r: any) => r.config_key === "default_sales_target")?.config_value || 20);
        const defaultRevenue = Number(configRows?.find((r: any) => r.config_key === "default_revenue_target")?.config_value || 5000);

        // Compute actual from orders
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: orders } = await admin
          .from("field_sales_orders")
          .select("id, total_amount")
          .eq("salesperson_id", userId)
          .gte("created_at", startOfMonth);

        const currentSales = orders?.length || 0;
        const currentRevenue = (orders || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

        // Compute pace
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const paceMultiplier = daysInMonth / dayOfMonth;

        return new Response(JSON.stringify({
          objectives: [
            {
              metric: "sales_count",
              label: "Ventes",
              target: defaultSales,
              actual: currentSales,
              progress: Math.min(100, Math.round((currentSales / defaultSales) * 100)),
              pace: Math.round(currentSales * paceMultiplier),
              on_track: currentSales * paceMultiplier >= defaultSales * 0.9,
            },
            {
              metric: "revenue",
              label: "Revenu",
              target: defaultRevenue,
              actual: Math.round(currentRevenue),
              progress: Math.min(100, Math.round((currentRevenue / defaultRevenue) * 100)),
              pace: Math.round(currentRevenue * paceMultiplier),
              on_track: currentRevenue * paceMultiplier >= defaultRevenue * 0.9,
            },
          ],
          templates: templates || [],
          period: { start: startOfMonth, end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString() },
          days_remaining: daysInMonth - dayOfMonth,
        }), { headers });
      }

      // Use stored objectives
      const obj = objectives[0];
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const paceMultiplier = daysInMonth / dayOfMonth;

      return new Response(JSON.stringify({
        objectives: [
          {
            metric: "sales_count",
            label: "Ventes",
            target: obj.target_sales,
            actual: obj.current_sales,
            progress: obj.target_sales > 0 ? Math.min(100, Math.round((obj.current_sales / obj.target_sales) * 100)) : 0,
            pace: Math.round(obj.current_sales * paceMultiplier),
            on_track: obj.current_sales * paceMultiplier >= obj.target_sales * 0.9,
          },
          {
            metric: "revenue",
            label: "Revenu",
            target: Number(obj.target_revenue),
            actual: Number(obj.current_revenue),
            progress: Number(obj.target_revenue) > 0 ? Math.min(100, Math.round((Number(obj.current_revenue) / Number(obj.target_revenue)) * 100)) : 0,
            pace: Math.round(Number(obj.current_revenue) * paceMultiplier),
            on_track: Number(obj.current_revenue) * paceMultiplier >= Number(obj.target_revenue) * 0.9,
          },
        ],
        period: { start: startOfMonth, end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString() },
        days_remaining: daysInMonth - dayOfMonth,
      }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });

  } catch (err: any) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});
