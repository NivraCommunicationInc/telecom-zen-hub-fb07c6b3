/**
 * field-objectives — User objectives, territory streets, and visits API.
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
    const action = url.searchParams.get("action") || "current";

    // ═══ OBJECTIVES ═══

    if (action === "current" || action === "progress") {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const paceMultiplier = daysInMonth / dayOfMonth;

      // Get config targets
      const { data: configRows } = await admin.from("field_sales_config").select("config_key, config_value").in("config_key", [
        "default_sales_target", "default_revenue_target", "default_leads_target", "default_commission_target", "default_conversion_target", "default_streets_target", "default_doors_target",
      ]);
      const cfg = (key: string, def: number) => Number(configRows?.find((r: any) => r.config_key === key)?.config_value || def);

      const [ordersRes, leadsRes, commissionsRes, streetsRes] = await Promise.all([
        admin.from("field_sales_orders").select("id, total_amount, payment_status, sync_status").eq("salesperson_id", userId).gte("created_at", startOfMonth),
        admin.from("field_leads").select("id, status").eq("agent_id", userId).gte("created_at", startOfMonth),
        admin.from("sales_commissions").select("commission_amount, status").eq("salesperson_id", userId).gte("created_at", startOfMonth),
        admin.from("field_territory_streets").select("id, status, doors_knocked, doors_sold").eq("agent_id", userId),
      ]);

      const orders = ordersRes.data || [];
      const leads = leadsRes.data || [];
      const commissions = commissionsRes.data || [];
      const streets = streetsRes.data || [];

      const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
      const syncedOrders = orders.filter((o: any) => o.sync_status === "synced").length;
      const totalCommissions = commissions.reduce((s: number, c: any) => s + Number(c.commission_amount || 0), 0);
      const leadsWon = leads.filter((l: any) => l.status === "won").length;
      const conversionRate = leads.length > 0 ? Math.round((leadsWon / leads.length) * 100) : 0;
      const streetsCompleted = streets.filter((s: any) => s.status === "completed").length;
      const totalDoors = streets.reduce((s: number, st: any) => s + (st.doors_knocked || 0), 0);

      const makeKPI = (label: string, current: number, target: number, metric: string, unit: string, isCurrency = false) => {
        const progress = Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
        return { label, metric, current, target, progress, pace: Math.round(current * paceMultiplier), on_track: current * paceMultiplier >= target * 0.9, unit, isCurrency };
      };

      const kpis = [
        makeKPI("Ventes ce mois", orders.length, cfg("default_sales_target", 20), "sales_count", "ventes"),
        makeKPI("Revenus générés", totalRevenue, cfg("default_revenue_target", 5000), "revenue", "$", true),
        makeKPI("Commissions gagnées", totalCommissions, cfg("default_commission_target", 1500), "commissions", "$", true),
        makeKPI("Leads créés", leads.length, cfg("default_leads_target", 50), "leads_created", "leads"),
        makeKPI("Leads convertis", leadsWon, 10, "leads_won", "convertis"),
        makeKPI("Taux de conversion", conversionRate, cfg("default_conversion_target", 40), "conversion_rate", "%"),
        makeKPI("Rues complétées", streetsCompleted, cfg("default_streets_target", 15), "streets_completed", "rues"),
        makeKPI("Portes cognées", totalDoors, cfg("default_doors_target", 500), "doors_knocked", "portes"),
        makeKPI("Commandes synchronisées", syncedOrders, orders.length || 1, "synced_orders", "sync"),
      ];

      const overallProgress = kpis.reduce((sum, k) => sum + k.progress, 0) / kpis.length;
      const achievedCount = kpis.filter((k) => k.current >= k.target).length;

      return new Response(JSON.stringify({
        kpis,
        overallProgress: Math.round(overallProgress),
        achievedCount,
        totalKpis: kpis.length,
        period: { start: startOfMonth, end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString() },
        days_remaining: daysInMonth - dayOfMonth,
      }), { headers });
    }

    // ═══ TERRITORY STREETS ═══

    if (action === "streets" && req.method === "GET") {
      const status = url.searchParams.get("status");
      let query = admin.from("field_territory_streets").select("*").eq("agent_id", userId).order("created_at", { ascending: false });
      if (status && status !== "all") query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw error;

      // Compute stats
      const streets = data || [];
      const totalStreets = streets.length;
      const completedStreets = streets.filter((s: any) => s.status === "completed").length;
      const totalDoors = streets.reduce((s: number, st: any) => s + (st.total_doors || 0), 0);
      const totalKnocked = streets.reduce((s: number, st: any) => s + (st.doors_knocked || 0), 0);
      const totalSold = streets.reduce((s: number, st: any) => s + (st.doors_sold || 0), 0);
      const progress = totalStreets > 0 ? Math.round((completedStreets / totalStreets) * 100) : 0;

      return new Response(JSON.stringify({
        streets,
        stats: { totalStreets, completedStreets, totalDoors, totalKnocked, totalSold, progress },
      }), { headers });
    }

    if (action === "create-street" && req.method === "POST") {
      const body = await req.json();
      const streetName = sanitizeString(body.street_name || "", 200);
      if (!streetName) return new Response(JSON.stringify({ error: "Nom de rue requis" }), { status: 400, headers });

      const { error } = await admin.from("field_territory_streets").insert({
        agent_id: userId,
        street_name: streetName,
        city: sanitizeString(body.city || "Montréal", 200),
        postal_code: body.postal_code?.trim() || null,
        total_doors: body.total_doors || 0,
        notes: body.notes?.trim() || null,
        status: "todo",
      });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (action === "update-street" && req.method === "POST") {
      const body = await req.json();
      const streetId = body.street_id;
      if (!streetId) return new Response(JSON.stringify({ error: "street_id requis" }), { status: 400, headers });

      const { street_id, ...updates } = body;
      const finalUpdates: any = { ...updates, updated_at: new Date().toISOString() };
      if (updates.status === "completed") finalUpdates.completed_at = new Date().toISOString();

      const { error } = await admin.from("field_territory_streets").update(finalUpdates).eq("id", streetId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (action === "delete-street" && req.method === "POST") {
      const body = await req.json();
      const streetId = body.street_id;
      if (!streetId) return new Response(JSON.stringify({ error: "street_id requis" }), { status: 400, headers });

      const { error } = await admin.from("field_territory_streets").delete().eq("id", streetId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (action === "log-visit" && req.method === "POST") {
      const body = await req.json();
      const streetId = body.street_id;
      if (!streetId) return new Response(JSON.stringify({ error: "street_id requis" }), { status: 400, headers });

      // Update street counts
      const { data: street } = await admin.from("field_territory_streets").select("doors_knocked, doors_answered, doors_sold").eq("id", streetId).single();
      if (street) {
        await admin.from("field_territory_streets").update({
          doors_knocked: (street.doors_knocked || 0) + (body.doors_knocked || 0),
          doors_answered: (street.doors_answered || 0) + (body.doors_answered || 0),
          doors_sold: (street.doors_sold || 0) + (body.doors_sold || 0),
          updated_at: new Date().toISOString(),
        }).eq("id", streetId);
      }

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });

  } catch (err: any) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});
