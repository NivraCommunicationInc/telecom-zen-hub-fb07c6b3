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
interface SaleDiscountPayload {
  id: string;
  name: string;
  type: string;
  value: number;
  applies_to?: string;
  duration_months?: number | null;
  monthly_discount_amount?: number;
  first_month_credit?: number;
}
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
  discount?: SaleDiscountPayload | null;
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

    // Step 2: compute totals (re-validate discount server-side; never trust client math).
    const equipTotal = (payload.equipment ?? []).reduce(
      (s, e) => s + Number(e.price || 0) * Number(e.quantity ?? 1), 0
    );
    const monthly = Number(payload.plan.monthly_price || 0);

    let monthlyDiscountAmount = 0;
    let firstMonthCredit = 0;
    let discountRow: any = null;
    if (payload.discount?.id) {
      const { data: dRow } = await admin
        .from("agent_discounts")
        .select("id,name,type,value,applies_to,duration_months,min_plan_price,is_active,expires_at,max_uses,uses_count")
        .eq("id", payload.discount.id)
        .maybeSingle();
      if (dRow && dRow.is_active &&
          (!dRow.expires_at || new Date(dRow.expires_at).getTime() > Date.now()) &&
          (dRow.max_uses == null || (dRow.uses_count ?? 0) < dRow.max_uses) &&
          (Number(dRow.min_plan_price ?? 0) === 0 || monthly >= Number(dRow.min_plan_price))
      ) {
        discountRow = dRow;
        const v = Number(dRow.value || 0);
        switch (dRow.type) {
          case "first_month_free":
            firstMonthCredit = monthly;
            break;
          case "percentage":
            monthlyDiscountAmount = Math.max(0, (monthly * v) / 100);
            break;
          case "remove_fee":
            // No installation fee billed via CRM flow.
            break;
          case "fixed":
          case "fixed_monthly":
          default:
            monthlyDiscountAmount = Math.max(0, Math.min(v, monthly));
            break;
        }
      }
    }
    monthlyDiscountAmount = Number(monthlyDiscountAmount.toFixed(2));
    firstMonthCredit = Number(firstMonthCredit.toFixed(2));

    // ── Welcome offer (premier mois gratuit, 100% du forfait) ─────────────
    // Auto-applied for any client who has never received it before, regardless
    // of sales channel (CRM / Field / POS / Guest checkout). Equipment and
    // one-time fees are NEVER discounted — only the recurring forfait.
    let welcomeFirstMonth = 0;
    let welcomeApplied = false;
    const agentDiscountIsFirstMonth = discountRow?.type === "first_month_free";
    if (!agentDiscountIsFirstMonth && monthly > 0) {
      const { data: eligibleData, error: eligibleErr } = await admin.rpc(
        "is_eligible_for_welcome_first_month",
        { p_user_id: clientUserId, p_email: payload.client.email },
      );
      if (eligibleErr) {
        console.error("[crm-create-sale] welcome eligibility check failed", eligibleErr);
      } else if (eligibleData === true) {
        welcomeFirstMonth = Number(monthly.toFixed(2));
        welcomeApplied = true;
      }
    }

    const totalFirstMonthCredit = Number((firstMonthCredit + welcomeFirstMonth).toFixed(2));
    const monthlyAfterDiscount = Number(Math.max(0, monthly - monthlyDiscountAmount).toFixed(2));
    // First invoice = forfait (après rabais agent) − crédit premier mois + équipement
    const firstMonthBillable = Number(Math.max(0, monthlyAfterDiscount - totalFirstMonthCredit).toFixed(2));
    const subtotal = Number((firstMonthBillable + equipTotal).toFixed(2));
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

    const pricingSnapshot = {
      monthly_plan_price: monthly,
      monthly_after_discount: monthlyAfterDiscount,
      first_month_billable: firstMonthBillable,
      equipment_total: equipTotal,
      subtotal,
      tps_amount: tps,
      tvq_amount: tvq,
      total,
      discount_total_combined: monthlyDiscountAmount + totalFirstMonthCredit,
      promo_discount: monthlyDiscountAmount,
      welcome_discount: welcomeFirstMonth,
      welcome_applied: welcomeApplied,
      agent_first_month_credit: firstMonthCredit,
      ...(discountRow ? {
        applied_discount: {
          id: discountRow.id,
          name: discountRow.name,
          type: discountRow.type,
          value: discountRow.value,
          applies_to: discountRow.applies_to,
          duration_months: discountRow.duration_months,
          monthly_amount: monthlyDiscountAmount,
          first_month_credit: firstMonthCredit,
        },
      } : {}),
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
      // Discount columns
      discount_code: discountRow?.name ?? null,
      discount_amount: monthlyDiscountAmount + totalFirstMonthCredit,
      promo_discount_amount: monthlyDiscountAmount,
      promo_details: discountRow ? {
        source_discount_id: discountRow.id,
        name: discountRow.name,
        type: discountRow.type,
        value: discountRow.value,
        applies_to: discountRow.applies_to,
        duration_months: discountRow.duration_months,
        monthly_amount: monthlyDiscountAmount,
        first_month_credit: firstMonthCredit,
      } : null,
      pricing_snapshot: pricingSnapshot,
    }).select("id, order_number, total_amount, subtotal").single();

    if (insertErr) return json({ error: `Insert failed: ${insertErr.message}` }, 500);

    // Increment discount usage (best-effort)
    if (discountRow) {
      try {
        await admin.from("agent_discounts")
          .update({ uses_count: (Number(discountRow.uses_count ?? 0) + 1) })
          .eq("id", discountRow.id);
      } catch (_) { /* ignore */ }
    }


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
    const commissionEstimate = Number((monthlyAfterDiscount * 0.30 + equipTotal * 0.05).toFixed(2));

    // Step 7: create PayPal order (best-effort — non-blocking)
    let paypalApproveUrl: string | null = null;
    let paypalOrderId: string | null = null;
    try {
      const ppResp = await fetch(`${supabaseUrl}/functions/v1/paypal-create-order`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          order_id: order.id,
          amount: total,
          currency: "CAD",
          description: `Commande Nivra ${orderNumber}`,
          customer_info: {
            first_name: payload.client.first_name,
            last_name: payload.client.last_name,
            email: payload.client.email,
            phone: payload.client.phone,
          },
        }),
      });
      const ppData = await ppResp.json().catch(() => ({}));
      paypalOrderId = ppData?.paypal_order_id ?? null;
      paypalApproveUrl = (ppData?.links ?? []).find((l: any) => l?.rel === "approve")?.href ?? null;
    } catch (e) {
      console.error("[crm-create-sale] paypal-create-order failed", e);
    }

    // Step 8: send order confirmation email (best-effort)
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-order-confirmation`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          order_id: order.id,
          paypal_approve_url: paypalApproveUrl,
        }),
      });
    } catch (e) {
      console.error("[crm-create-sale] send-order-confirmation failed", e);
    }

    return json({
      ok: true,
      order_id: order.id,
      order_number: order.order_number,
      total: order.total_amount,
      commission_estimate: commissionEstimate,
      paypal_approve_url: paypalApproveUrl,
      paypal_order_id: paypalOrderId,
    });

  } catch (e: any) {
    console.error("[crm-create-sale] error", e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});
