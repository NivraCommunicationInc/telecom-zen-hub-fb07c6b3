/**
 * crm-create-sale — Creates an order from a CRM call sale.
 *
 * Flow:
 *  1. Validates auth (agent must be field_sales OR employee role).
 *  2. Ensures the prospect has an auth account (via auto-create-client-account).
 *  3. Generates order_number via RPC.
 *  4. Inserts orders row with source='crm_call' + crm_contact_id (commission trigger fires).
 *  5. Updates crm_contacts (call_status='sold', converted_order_id, converted_to_user_id).
 *  6. Returns { order_id, order_number, commission_estimate }.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SaleEquipmentLine { name: string; price: number; quantity?: number }
interface CrmSalePayload {
  contact_id: string;
  client: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    date_of_birth?: string;
    service_address?: string;
    service_city?: string;
    service_postal_code?: string;
  };
  plan: { service_id: string; name: string; monthly_price: number; category?: string };
  equipment: SaleEquipmentLine[];
  install: { date: string; slot: "morning" | "afternoon" | "evening" };
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Role check
    const { data: roles } = await admin.from("user_roles")
      .select("role").eq("user_id", user.id).eq("is_active", true);
    const allowed = (roles ?? []).some((r: any) => ["field_sales", "employee", "admin", "sales"].includes(r.role));
    if (!allowed) return json({ error: "Forbidden — role required" }, 403);

    const payload = await req.json() as CrmSalePayload;
    if (!payload?.contact_id || !payload?.client?.email || !payload?.plan?.service_id) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Step 1: ensure auth user
    let clientUserId: string | null = null;
    try {
      const accResp = await fetch(`${supabaseUrl}/functions/v1/auto-create-client-account`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json", "apikey": serviceKey },
        body: JSON.stringify({
          email: payload.client.email,
          first_name: payload.client.first_name,
          last_name: payload.client.last_name,
          phone: payload.client.phone,
          service_address: payload.client.service_address,
          service_city: payload.client.service_city,
          service_postal_code: payload.client.service_postal_code,
          date_of_birth: payload.client.date_of_birth,
        }),
      });
      const accData = await accResp.json().catch(() => ({}));
      clientUserId = accData?.user_id ?? accData?.userId ?? null;
    } catch (e) {
      console.error("[crm-create-sale] auto-create-client-account failed", e);
    }

    // Fallback: look up existing profile by email
    if (!clientUserId) {
      const { data: prof } = await admin.from("profiles")
        .select("user_id").ilike("email", payload.client.email).maybeSingle();
      clientUserId = prof?.user_id ?? null;
    }

    if (!clientUserId) return json({ error: "Cannot resolve client account" }, 500);

    // Step 2: compute totals
    const equipTotal = (payload.equipment ?? []).reduce(
      (s, e) => s + Number(e.price || 0) * Number(e.quantity ?? 1), 0
    );
    const monthly = Number(payload.plan.monthly_price || 0);
    const subtotal = Number((monthly + equipTotal).toFixed(2));
    const tps = Number((subtotal * 0.05).toFixed(2));
    const tvq = Number((subtotal * 0.09975).toFixed(2));
    const total = Number((subtotal + tps + tvq).toFixed(2));

    // Step 3: generate order_number
    const { data: numData, error: numErr } = await admin.rpc("generate_order_number");
    if (numErr) return json({ error: `order_number gen failed: ${numErr.message}` }, 500);
    const orderNumber = String(numData);

    // Step 4: insert order
    const serviceType = payload.plan.category === "tv" ? "tv"
      : payload.plan.category === "mobile" ? "mobile"
      : payload.plan.category === "bundle" ? "bundle"
      : "internet";

    const equipmentLines = (payload.equipment ?? []).map((e) => ({
      name: e.name, unit_price: Number(e.price), quantity: Number(e.quantity ?? 1),
    }));

    const installDetails = {
      requested_date: payload.install.date,
      time_slot: payload.install.slot,
      source: "crm_call",
    };

    const { data: order, error: insertErr } = await admin.from("orders").insert({
      order_number: orderNumber,
      user_id: clientUserId,
      status: "pending",
      service_type: serviceType,
      category: payload.plan.category ?? "internet",
      source: "crm_call",
      crm_contact_id: payload.contact_id,
      created_by: user.id,
      created_by_agent_id: user.id,
      client_email: payload.client.email,
      client_first_name: payload.client.first_name,
      client_last_name: payload.client.last_name,
      client_phone: payload.client.phone ?? null,
      client_dob: payload.client.date_of_birth ?? null,
      shipping_address: payload.client.service_address ?? null,
      shipping_city: payload.client.service_city ?? null,
      shipping_postal_code: payload.client.service_postal_code ?? null,
      subtotal,
      total_amount: total,
      tps_rate: 0.05, tvq_rate: 0.09975, tps_amount: tps, tvq_amount: tvq,
      payment_status: "pending",
      environment: "live",
      equipment_line_details: equipmentLines,
      installation_details: installDetails,
      requested_activation_date: payload.install.date,
      internal_notes: payload.notes ?? null,
    }).select("id, order_number, total_amount, subtotal").single();

    if (insertErr) return json({ error: `Insert failed: ${insertErr.message}` }, 500);

    // Step 5: update crm_contacts
    await admin.from("crm_contacts").update({
      call_status: "sold",
      converted_order_id: order.id,
      converted_to_user_id: clientUserId,
      converted_at: new Date().toISOString(),
      is_locked: false,
      locked_by: null,
      locked_until: null,
      locked_by_name: null,
      updated_at: new Date().toISOString(),
    }).eq("id", payload.contact_id);

    // Step 6: log call (sold outcome) — best effort
    try {
      await admin.from("crm_call_logs").insert({
        contact_id: payload.contact_id,
        agent_id: user.id,
        outcome: "sold",
        notes: `Vente complétée — commande ${orderNumber}`,
      });
    } catch (_) { /* ignore */ }

    // Commission estimate (30% forfait + 5% equipment)
    const commissionEstimate = Number((monthly * 0.30 + equipTotal * 0.05).toFixed(2));

    return json({
      ok: true,
      order_id: order.id,
      order_number: order.order_number,
      total: order.total_amount,
      commission_estimate: commissionEstimate,
    });
  } catch (e: any) {
    console.error("[crm-create-sale] error", e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});
