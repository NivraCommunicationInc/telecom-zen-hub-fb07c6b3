// Equipment account actions — Nivra Core & Nivra OneView CS
// Single entry for client equipment lifecycle:
//   - assign_from_catalog : allocate the first in_stock unit of a given catalog item
//                           (services.id, category='Équipement') to the client.
//                           If no in_stock unit exists, create a new equipment_inventory row
//                           pulling catalog_name + price_client from the services catalog
//                           — NEVER from client-supplied values.
//   - mark_returned       : flag an assigned/deployed unit as returned (status=in_stock,
//                           detach account_id, set retired_at).
//   - mark_defective      : flag a unit as defective (status=defective).
//   - update_serial       : staff records SIM ICCID / modem serial / MAC / IMEI on an
//                           existing row.
//
// Every action validates staff role, writes audit, and queues a branded client email.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

// Fallback bucket for scoped upserts without a per-write business id.
function isoMinuteBucket36(d: Date = new Date()): string {
  return Math.floor(d.getTime() / 60_000).toString(36);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "list_active" | "assign_from_catalog" | "mark_returned" | "mark_defective" | "update_serial";

interface Body {
  action: Action;
  client_user_id: string;
  account_id?: string | null;
  subscription_id?: string | null;
  order_id?: string | null;
  reason?: string | null;
  notes?: string | null;

  // assign_from_catalog
  catalog_item_id?: string; // public.services.id (category='Équipement')

  // mark_returned / mark_defective / update_serial
  inventory_id?: string;
  condition?: "new" | "good" | "damaged" | "lost";
  serial_number?: string;
  imei?: string;
  mac_address?: string;
  iccid?: string; // mapped to serial_number for SIM
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_ROLES = new Set([
  "admin", "employee", "supervisor", "support", "billing_admin", "sales",
]);

async function resolveCustomerIds(admin: any, clientUserId: string): Promise<string[]> {
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("user_id", clientUserId)
    .maybeSingle();
  const normalizedEmail = String(profile?.email || "").trim().toLowerCase();
  const filters = [`user_id.eq.${clientUserId}`];
  if (normalizedEmail) filters.push(`email.eq.${normalizedEmail}`);
  const { data } = await admin
    .from("billing_customers")
    .select("id")
    .or(filters.join(","));
  return (data || []).map((r: { id: string }) => r.id);
}

const fmtMoney = (n: number) => {
  try {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
  } catch (_e) {
    return `${n.toFixed(2)} $`;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Non autorisé" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { isStaff: _isStaff } = await checkStaffAuth(admin, user.id);
  if (!_isStaff) {
    return json(403, { error: "Action réservée au personnel autorisé" });
  }

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) return json(400, { error: "Champs requis: action, client_user_id" });

  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, email, first_name, last_name, account_number")
    .eq("user_id", client_user_id)
    .maybeSingle();
  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";

  const { data: actorProfile } = await admin
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const actorEmail = actorProfile?.email || user.email || null;
  const actorName = [actorProfile?.first_name, actorProfile?.last_name].filter(Boolean).join(" ").trim() || actorEmail || "staff";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";

  const audit = async (label: string, payload: Record<string, unknown>) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `equipment.${label}`,
        admin_user_id: user.id,
        admin_email: actorEmail,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        details: payload,
      });
    } catch (_e) { /* swallow */ }
  };

  // Resolve actor role (best-effort) for traceability tables
  const { data: actorRoleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const actorRole = actorRoleRow?.role || "staff";

  const logActivity = async (action_type: string, summary: string, metadata: Record<string, unknown>) => {
    try {
      const before = (metadata as any)?.before ?? null;
      const after = (metadata as any)?.after ?? null;
      await admin.from("client_activity_logs").insert({
        client_id: client_user_id,
        actor_user_id: user.id,
        actor_name: actorName,
        actor_role: actorRole,
        action_type,
        entity_type: "equipment",
        entity_id: (metadata?.inventory_id as string) ?? null,
        summary,
        before_data: before,
        after_data: after ?? { ...metadata, actor_email: actorEmail },
      });
    } catch (_e) { /* swallow */ }
  };

  const addSystemNote = async (prefix: string, message: string) => {
    try {
      await admin.from("client_internal_notes").insert({
        client_id: client_user_id,
        account_id: body.account_id ?? null,
        note_type: "system",
        body: `[${prefix}] ${message} — par ${actorName}`,
        created_by_user_id: user.id,
        created_by_role: actorRole,
        created_by_name: actorName,
      });
    } catch (_e) { /* swallow */ }
  };

  const enqueueEmail = async (template: string, vars: Record<string, unknown>) => {
    if (!clientEmail) return;
    try {
      await enqueueCommunication(admin, {
      channel: "email",
      recipient: clientEmail,
      templateKey: template,
      priority: 0,
      idempotencyKey: `acct360:equipment:${body.account_id ?? "na"}:${template}:${body.idempotency_key ?? body.__audit_reason ?? "default"}`,
      templateVars: { ...vars, first_name: firstName, to_email: clientEmail },
    });
    } catch (_e) { /* swallow */ }
  };

  // Cross-client isolation guard for mutations targeting an existing inventory row.
  const assertOwnership = async (inventoryId: string): Promise<
    | { ok: true; row: { id: string; catalog_name: string | null; status: string; account_id: string | null; order_id: string | null; subscription_id: string | null } }
    | { ok: false; status: number; error: string }
  > => {
    const { data: row, error } = await admin
      .from("equipment_inventory")
      .select("id, catalog_name, status, account_id, order_id, subscription_id")
      .eq("id", inventoryId)
      .maybeSingle();
    if (error) return { ok: false, status: 500, error: error.message };
    if (!row) return { ok: false, status: 404, error: "Équipement introuvable" };

    if (body.account_id && row.account_id && row.account_id === body.account_id) return { ok: true, row };
    if (row.order_id) {
      const { data: ord } = await admin.from("orders").select("user_id, account_id").eq("id", row.order_id).maybeSingle();
      if (ord && (ord.user_id === client_user_id || (body.account_id && ord.account_id === body.account_id))) return { ok: true, row };
    }
    if (row.subscription_id) {
      const { data: sub } = await admin.from("billing_subscriptions").select("customer_id").eq("id", row.subscription_id).maybeSingle();
      if (sub?.customer_id) {
        const customerIds = await resolveCustomerIds(admin, client_user_id);
        if (customerIds.includes(sub.customer_id)) return { ok: true, row };
      }
    }
    return { ok: false, status: 403, error: "Équipement n'appartient pas à ce client" };
  };

  try {
    switch (action) {
      case "list_active": {
        const activeStatuses = ["assigned", "deployed", "reserved"];
        // SECURITY: validate UUIDs BEFORE interpolating into .or() filter.
        // Without this, an attacker could inject Postgrest filter syntax via
        // body.account_id (e.g. `xxx,user_id.eq.<other-uuid>`) to read other
        // clients' orders. UUID_RE matches strict v1-v8 RFC 4122 form.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!UUID_RE.test(client_user_id)) {
          return json(400, { error: "Invalid client_user_id format" });
        }
        const safeAccountId = body.account_id && UUID_RE.test(String(body.account_id))
          ? String(body.account_id)
          : null;
        const { data: orders, error: ordersErr } = await admin
          .from("orders")
          .select("id, equipment_details, equipment_id")
          .or(`user_id.eq.${client_user_id}${safeAccountId ? `,account_id.eq.${safeAccountId}` : ""}`)
          .order("created_at", { ascending: false })
          .limit(100);
        if (ordersErr) return json(500, { error: ordersErr.message });

        const customerIds = await resolveCustomerIds(admin, client_user_id);
        const subsRes = customerIds.length > 0
          ? await admin
              .from("billing_subscriptions")
              .select("id, order_id")
              .eq("status", "active")
              .in("customer_id", customerIds)
          : { data: [], error: null } as any;
        const { data: subs, error: subsErr } = subsRes;
        if (subsErr) return json(500, { error: subsErr.message });

        const orderIds = Array.from(new Set([
          ...((orders || []).map((o: { id: string }) => o.id)),
          ...((subs || []).map((s: { order_id?: string | null }) => s.order_id).filter(Boolean) as string[]),
        ]));

        const invFilters: string[] = [];
        if (safeAccountId) invFilters.push(`account_id.eq.${safeAccountId}`);
        // orderIds already came from our own DB query above, so they're trusted UUIDs
        const safeOrderIds = orderIds.filter((id) => UUID_RE.test(String(id))).slice(0, 100);
        if (safeOrderIds.length > 0) invFilters.push(`order_id.in.(${safeOrderIds.join(",")})`);
        const invRes = invFilters.length > 0
          ? await admin.from("equipment_inventory")
              .select("id,catalog_name,category,status,serial_number,imei,mac_address,price_client,assigned_at,condition,order_id,sku,created_at")
              .or(invFilters.join(","))
              .in("status", activeStatuses)
          : { data: [], error: null } as any;
        if (invRes.error) return json(500, { error: invRes.error.message });

        const inventoryRows = (invRes.data || []).map((r: Record<string, unknown>) => ({ ...r, source: "inventory" }));
        const ordersWithInventory = new Set(inventoryRows.map((r: any) => r.order_id).filter(Boolean));
        const missingOrderIds = orderIds.filter((id) => !ordersWithInventory.has(id));

        let lineRows: any[] = [];
        if (missingOrderIds.length > 0) {
          const { data: lines, error: linesErr } = await admin
            .from("equipment_order_lines")
            .select("id,order_id,item_name,item_sku,unit_price,quantity,line_total,serial_numbers,created_at")
            .in("order_id", missingOrderIds.slice(0, 100));
          if (linesErr) return json(500, { error: linesErr.message });
          lineRows = (lines || []).map((l: Record<string, unknown>) => ({
            ...l,
            id: `line-${l.id}`,
            source: "order_line",
            catalog_name: l.item_name ?? "Équipement",
            category: "Équipement",
            status: "reserved",
            serial_number: null,
            imei: null,
            mac_address: null,
            price_client: l.unit_price ?? null,
            assigned_at: null,
            condition: null,
          }));
        }

        const ordersWithLines = new Set(lineRows.map((r) => r.order_id).filter(Boolean));
        const snapshotRows: any[] = [];
        for (const o of orders || []) {
          if (ordersWithInventory.has(o.id) || ordersWithLines.has(o.id)) continue;
          const details = Array.isArray(o.equipment_details) ? o.equipment_details : [];
          details.forEach((eq: any, idx: number) => snapshotRows.push({
            id: `order-${o.id}-equipment-${idx}`,
            source: "order_snapshot",
            order_id: o.id,
            catalog_name: eq.label || eq.type || eq.name || "Équipement",
            category: "Équipement",
            status: "reserved",
            serial_number: eq.serial_number ?? null,
            serial_numbers: eq.serial_numbers ?? null,
            imei: eq.imei ?? null,
            mac_address: eq.mac_address ?? null,
            price_client: eq.unit_price ?? eq.price ?? null,
            unit_price: eq.unit_price ?? eq.price ?? null,
            assigned_at: null,
            created_at: null,
            condition: null,
            quantity: eq.quantity || 1,
            item_sku: eq.type || eq.sku || o.equipment_id || null,
          }));
        }

        const items = [...inventoryRows, ...lineRows, ...snapshotRows]
          .sort((a: any, b: any) => +new Date(b.assigned_at || b.created_at || 0) - +new Date(a.assigned_at || a.created_at || 0));
        return json(200, { ok: true, items, total: items.length });
      }

      case "assign_from_catalog": {
        if (!body.catalog_item_id) return json(400, { error: "catalog_item_id requis" });

        // Resolve canonical catalog row (single source of truth)
        const { data: catalog, error: catErr } = await admin
          .from("services")
          .select("id, name, price, category, status, is_active")
          .eq("id", body.catalog_item_id)
          .eq("category", "Équipement")
          .maybeSingle();
        if (catErr) return json(500, { error: catErr.message });
        if (!catalog) return json(404, { error: "Catalogue équipement introuvable" });
        if (catalog.status !== "active" && catalog.is_active !== true) {
          return json(400, { error: "Équipement non actif au catalogue" });
        }

        const canonicalName = catalog.name as string;
        const canonicalPrice = Number(catalog.price ?? 0);

        // Try to reuse the first in_stock unit of this catalog item
        const { data: stockRows } = await admin
          .from("equipment_inventory")
          .select("id")
          .eq("catalog_item_id", body.catalog_item_id)
          .eq("status", "in_stock")
          .order("created_at", { ascending: true })
          .limit(1);

        let inventoryId: string;
        if (stockRows && stockRows.length > 0) {
          inventoryId = (stockRows[0] as { id: string }).id;
          const { error: updErr } = await admin
            .from("equipment_inventory")
            .update({
              status: "assigned",
              account_id: body.account_id ?? null,
              order_id: body.order_id ?? null,
              subscription_id: body.subscription_id ?? null,
              assigned_at: new Date().toISOString(),
              assigned_by: user.id,
              price_client: canonicalPrice, // re-sync to canonical
              catalog_name: canonicalName,
              notes: body.notes ?? null,
            })
            .eq("id", inventoryId);
          if (updErr) return json(500, { error: updErr.message });
        } else {
          // No stock — create a fresh inventory row already assigned
          const { data: ins, error: insErr } = await admin
            .from("equipment_inventory")
            .insert({
              catalog_item_id: body.catalog_item_id,
              catalog_name: canonicalName,
              category: "Équipement",
              price_client: canonicalPrice,
              status: "assigned",
              account_id: body.account_id ?? null,
              order_id: body.order_id ?? null,
              subscription_id: body.subscription_id ?? null,
              assigned_at: new Date().toISOString(),
              assigned_by: user.id,
              notes: body.notes ?? null,
              condition: "new",
            })
            .select("id")
            .single();
          if (insErr) return json(500, { error: insErr.message });
          inventoryId = (ins as { id: string }).id;
        }

        await audit("assign", {
          inventory_id: inventoryId,
          catalog_item_id: body.catalog_item_id,
          catalog_name: canonicalName,
          price_client: canonicalPrice,
        });
        await logActivity("equipment_assigned", `Équipement assigné: ${canonicalName}`, {
          inventory_id: inventoryId,
          catalog_item_id: body.catalog_item_id,
          price_client: canonicalPrice,
        });
        await addSystemNote("EQUIPMENT.ASSIGN", `${canonicalName} (${fmtMoney(canonicalPrice)}) assigné`);
        await enqueueEmail("client_equipment_assigned", {
          equipment_name: canonicalName,
          equipment_price: fmtMoney(canonicalPrice),
        });

        return json(200, { ok: true, inventory_id: inventoryId, name: canonicalName, price: canonicalPrice });
      }

      case "mark_returned": {
        if (!body.inventory_id) return json(400, { error: "inventory_id requis" });
        const own = await assertOwnership(body.inventory_id);
        if (!own.ok) return json(own.status, { error: own.error });
        const row = own.row;

        // F16-3: idempotence — only assigned/deployed/reserved can be returned
        if (!["assigned", "deployed", "reserved"].includes(row.status)) {
          return json(409, { error: `Retour impossible: statut courant ${row.status}` });
        }

        const hasReason = !!(body.reason && body.reason.trim());
        const { error: updErr } = await admin
          .from("equipment_inventory")
          .update({
            status: "in_stock",
            account_id: null,
            subscription_id: null,
            retired_at: new Date().toISOString(),
            condition: body.condition || "good",
            notes: hasReason ? `Retour — ${body.reason!.trim()}` : "Retour — sans note",
          })
          .eq("id", body.inventory_id);
        if (updErr) return json(500, { error: updErr.message });

        await audit("return", { inventory_id: body.inventory_id, condition: body.condition, reason: body.reason });
        await logActivity("equipment_returned", `Équipement retourné: ${row.catalog_name || "Équipement"}`, {
          inventory_id: body.inventory_id,
          condition: body.condition || "good",
          reason: body.reason || null,
        });
        await addSystemNote("EQUIPMENT.RETURN", `${row.catalog_name || "Équipement"} retourné (état: ${body.condition || "good"})`);
        await enqueueEmail("client_equipment_returned", {
          equipment_name: row.catalog_name || "Équipement",
          condition: body.condition || "good",
          reason: body.reason || "—",
        });
        return json(200, { ok: true });
      }

      case "mark_defective": {
        if (!body.inventory_id) return json(400, { error: "inventory_id requis" });
        const own = await assertOwnership(body.inventory_id);
        if (!own.ok) return json(own.status, { error: own.error });
        const row = own.row;

        // F16-4: idempotence — do not overwrite already defective/retired
        if (row.status === "defective") return json(409, { error: "Équipement déjà marqué défectueux" });
        if (["retired", "in_stock"].includes(row.status)) {
          return json(409, { error: `Marquage défectueux impossible: statut courant ${row.status}` });
        }

        const { error: updErr } = await admin
          .from("equipment_inventory")
          .update({
            status: "defective",
            condition: "damaged",
            notes: body.reason || null,
          })
          .eq("id", body.inventory_id);
        if (updErr) return json(500, { error: updErr.message });
        await audit("defective", { inventory_id: body.inventory_id, reason: body.reason });
        await logActivity("equipment_defective", `Équipement défectueux: ${row.catalog_name || "Équipement"}`, {
          inventory_id: body.inventory_id,
          reason: body.reason || null,
        });
        await addSystemNote("EQUIPMENT.DEFECTIVE", `${row.catalog_name || "Équipement"} marqué défectueux${body.reason ? ` — ${body.reason}` : ""}`);
        return json(200, { ok: true });
      }

      case "update_serial": {
        if (!body.inventory_id) return json(400, { error: "inventory_id requis" });
        const own = await assertOwnership(body.inventory_id);
        if (!own.ok) return json(own.status, { error: own.error });
        const row = own.row;

        const patch: Record<string, unknown> = {};
        if (body.serial_number) patch.serial_number = body.serial_number.trim();
        if (body.iccid)         patch.serial_number = body.iccid.trim();
        if (body.imei)          patch.imei = body.imei.trim();
        if (body.mac_address)   patch.mac_address = body.mac_address.trim();
        if (Object.keys(patch).length === 0) return json(400, { error: "Aucun identifiant à mettre à jour" });

        // Capture before snapshot for audit trail
        const { data: beforeRow } = await admin
          .from("equipment_inventory")
          .select("serial_number, imei, mac_address")
          .eq("id", body.inventory_id)
          .maybeSingle();
        const before: Record<string, unknown> = {};
        for (const k of Object.keys(patch)) before[k] = (beforeRow as any)?.[k] ?? null;

        const { error: updErr } = await admin
          .from("equipment_inventory")
          .update(patch)
          .eq("id", body.inventory_id);
        if (updErr) return json(500, { error: updErr.message });
        await audit("update_serial", { inventory_id: body.inventory_id, before, after: patch });
        await logActivity("equipment_identifiers_updated", `Identifiants mis à jour: ${row.catalog_name || "Équipement"}`, {
          inventory_id: body.inventory_id,
          before,
          after: patch,
        });
        await addSystemNote("EQUIPMENT.UPDATE_SERIAL", `Identifiants mis à jour sur ${row.catalog_name || "Équipement"}: ${Object.keys(patch).join(", ")}`);
        return json(200, { ok: true });
      }


      default:
        return json(400, { error: `Action inconnue: ${action}` });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
