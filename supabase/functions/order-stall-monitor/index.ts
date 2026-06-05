/**
 * order-stall-monitor
 *
 * Checks for orders that are stuck in an active-but-unresolved status for
 * more than STALL_HOURS (default 48h) and creates a staff_notification of
 * type 'order_stalled' for each one — deduplicated so only one alert fires
 * per order per stall cycle.
 *
 * Called by pg_cron every 4 hours.  Safe to call manually.
 *
 * Statuses monitored:
 *   pending, pending_verification, verification, back_order, backorder
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const STALL_HOURS = 48;
// Only alert once every DEDUP_HOURS hours per order to avoid spam
const DEDUP_HOURS = 24;

const STALLED_STATUSES = [
  "pending",
  "pending_verification",
  "verification",
  "back_order",
  "backorder",
];

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req.headers.get("origin"));

  // Service role only
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (token !== serviceKey) {
    return new Response(JSON.stringify({ error: "Service role requis" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const stallCutoff = new Date(Date.now() - STALL_HOURS * 60 * 60 * 1000).toISOString();
  const dedupCutoff = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000).toISOString();

  // 1. Find stalled orders
  const { data: stalledOrders, error: fetchErr } = await admin
    .from("orders")
    .select("id, order_number, user_id, status, created_at, updated_at")
    .in("status", STALLED_STATUSES)
    .lt("updated_at", stallCutoff)
    .order("updated_at", { ascending: true })
    .limit(50);

  if (fetchErr) {
    console.error("[order-stall-monitor] fetch error:", fetchErr);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!stalledOrders?.length) {
    return new Response(JSON.stringify({ ok: true, alerted: 0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 2. Deduplicate: skip orders already alerted in the last DEDUP_HOURS
  const orderIds = stalledOrders.map((o) => o.id);
  const { data: recentAlerts } = await admin
    .from("staff_notifications")
    .select("entity_id")
    .eq("notification_type", "order_stalled")
    .in("entity_id", orderIds)
    .gte("created_at", dedupCutoff);

  const alreadyAlerted = new Set((recentAlerts ?? []).map((r: any) => r.entity_id));

  // 3. Resolve client info
  const userIds = [...new Set(stalledOrders.map((o) => o.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [p.user_id, p])
  );

  const STATUS_FR: Record<string, string> = {
    pending: "en attente",
    pending_verification: "vérification KYC",
    verification: "en vérification",
    back_order: "rupture de stock",
    backorder: "rupture de stock",
  };

  // 4. Insert one notification per stalled, non-deduped order
  let alerted = 0;
  for (const order of stalledOrders) {
    if (alreadyAlerted.has(order.id)) continue;

    const profile = profileMap.get(order.user_id) as any;
    const hoursStuck = Math.round(
      (Date.now() - new Date(order.updated_at ?? order.created_at).getTime()) / 3_600_000
    );

    const statusLabel = STATUS_FR[order.status] ?? order.status;

    await admin.from("staff_notifications").insert({
      notification_type: "order_stalled",
      title: "Commande bloquée",
      message:
        `Commande ${order.order_number ?? "N/A"} bloquée depuis ${hoursStuck}h (statut: ${statusLabel})` +
        (profile?.full_name ? ` — ${profile.full_name}` : ""),
      entity_type: "order",
      entity_id: order.id,
      entity_number: order.order_number,
      client_id: order.user_id,
      client_name: profile?.full_name ?? null,
      client_email: profile?.email ?? null,
    });

    alerted++;
  }

  console.log(`[order-stall-monitor] alerted=${alerted} skipped=${stalledOrders.length - alerted}`);

  return new Response(JSON.stringify({ ok: true, alerted, checked: stalledOrders.length }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
