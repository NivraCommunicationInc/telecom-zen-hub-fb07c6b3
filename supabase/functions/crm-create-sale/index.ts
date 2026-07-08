/**
 * crm-create-sale — Phase 3.A.1.b (canonical rewrite)
 *
 * Invariants respectés :
 *  - AUCUNE écriture directe sur billing_invoices / billing_invoice_lines /
 *    billing_subscriptions / billing_payments / account_adjustments.
 *  - AUCUN calcul local de TPS/TVQ/total/balance. Les taxes sont calculées
 *    exclusivement par build_invoice_from_order.
 *  - Les rabais (agent + welcome premier mois) sont matérialisés comme lignes
 *    order_items négatives ; ils font donc partie de la source unique.
 *  - Les paiements carte passent par Square.
 *  - Les fonctions *_ad_hoc ne sont PAS utilisées ici : nous avons toujours
 *    une commande source, donc build_invoice_from_order est obligatoire.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SaleEquipmentLine { name: string; price: number; quantity?: number }
interface SaleDiscountPayload {
  id: string; name: string; type: string; value: number;
  applies_to?: string; duration_months?: number | null;
  monthly_discount_amount?: number; first_month_credit?: number;
}
interface CrmSalePayload {
  contact_id: string;
  client: {
    first_name: string; last_name: string; email: string;
    phone?: string; date_of_birth?: string;
    service_address?: string; service_city?: string; service_postal_code?: string;
  };
  plan: { service_id: string; name: string; monthly_price: number; category?: string };
  equipment: SaleEquipmentLine[];
  discount?: SaleDiscountPayload | null;
  install: { date: string; slot: "morning" | "afternoon" | "evening" };
  notes?: string;
}

async function resolveExistingAuthUserId(supabaseUrl: string, serviceKey: string, email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;
  const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (!resp.ok) { await resp.text().catch(() => ""); return null; }
  const data = await resp.json().catch(() => ({}));
  return data?.users?.find((u: any) => String(u?.email || "").trim().toLowerCase() === normalizedEmail)?.id ?? null;
}

async function resolveOrCreateAccount(
  admin: ReturnType<typeof createClient>,
  clientUserId: string,
  client: CrmSalePayload["client"],
): Promise<{ accountId: string; accountNumber: string | null }> {
  const { data: existing } = await admin.from("accounts")
    .select("id, account_number").eq("client_id", clientUserId).eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing?.id) {
    if (existing.account_number) {
      await admin.from("profiles").update({ account_number: String(existing.account_number) })
        .eq("user_id", clientUserId).neq("account_number", String(existing.account_number));
    }
    return { accountId: existing.id, accountNumber: existing.account_number ?? null };
  }
  const { data: numData, error: numErr } = await admin.rpc("generate_account_number");
  if (numErr || !numData) throw new Error(`generate_account_number failed: ${numErr?.message || "unknown"}`);
  const accountName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || client.email || "Client CRM";
  const accountNumber = String(numData);
  const { data: created, error: createErr } = await admin.from("accounts").insert({
    client_id: clientUserId,
    account_number: accountNumber, account_name: accountName, status: "active",
    billing_address: client.service_address ?? null, billing_city: client.service_city ?? null,
    billing_postal_code: client.service_postal_code ?? null, billing_province: "QC",
    primary_service_address: client.service_address ?? null,
    primary_service_city: client.service_city ?? null,
    primary_service_postal_code: client.service_postal_code ?? null,
    primary_service_province: "QC",
    billing_cycle_day: new Date().getDate(),
  }).select("id, account_number").single();
  if (createErr || !created) throw new Error(`Account creation failed: ${createErr?.message || "unknown"}`);
  await admin.from("profiles").update({ account_number: accountNumber }).eq("user_id", clientUserId);
  return { accountId: created.id, accountNumber: created.account_number ?? accountNumber };
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

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("is_active", true);
    const allowed = (roles ?? []).some((r: any) =>
      ["field_sales", "employee", "admin", "sales", "support", "billing_admin", "techops", "kyc_agent", "supervisor"].includes(r.role));
    if (!allowed) return json({ error: "Forbidden — role required" }, 403);

    const payload = await req.json() as CrmSalePayload;
    if (!payload?.contact_id || !payload?.client?.email || !payload?.plan?.service_id) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Step 1: resolve auth user
    let clientUserId: string | null = null;
    try {
      const accResp = await fetch(`${supabaseUrl}/functions/v1/auto-create-client-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", apikey: serviceKey },
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
    } catch (e) { console.error("[crm-create-sale] auto-create-client-account failed", e); }

    if (!clientUserId) {
      const { data: prof } = await admin.from("profiles").select("user_id").ilike("email", payload.client.email).maybeSingle();
      clientUserId = prof?.user_id ?? null;
    }
    if (!clientUserId) {
      clientUserId = await resolveExistingAuthUserId(supabaseUrl, serviceKey, payload.client.email);
    }
    if (!clientUserId) return json({ error: "Cannot resolve client account" }, 500);

    // Step 2: validate discount server-side (business validation, NOT tax math)
    const monthly = Number(payload.plan.monthly_price || 0);
    let monthlyDiscountAmount = 0;
    let firstMonthCredit = 0;
    let discountRow: any = null;
    if (payload.discount?.id) {
      const { data: dRow } = await admin.from("agent_discounts")
        .select("id,name,type,value,applies_to,duration_months,min_plan_price,is_active,expires_at,max_uses,uses_count")
        .eq("id", payload.discount.id).maybeSingle();
      if (dRow && dRow.is_active &&
          (!dRow.expires_at || new Date(dRow.expires_at).getTime() > Date.now()) &&
          (dRow.max_uses == null || (dRow.uses_count ?? 0) < dRow.max_uses) &&
          (Number(dRow.min_plan_price ?? 0) === 0 || monthly >= Number(dRow.min_plan_price))) {
        discountRow = dRow;
        const v = Number(dRow.value || 0);
        switch (dRow.type) {
          case "first_month_free": firstMonthCredit = monthly; break;
          case "percentage": monthlyDiscountAmount = Math.max(0, (monthly * v) / 100); break;
          case "remove_fee": break;
          case "fixed":
          case "fixed_monthly":
          default: monthlyDiscountAmount = Math.max(0, Math.min(v, monthly)); break;
        }
      }
    }
    monthlyDiscountAmount = Number(monthlyDiscountAmount.toFixed(2));
    firstMonthCredit = Number(firstMonthCredit.toFixed(2));

    // Welcome first-month eligibility (business rule; not tax math)
    let welcomeFirstMonth = 0;
    let welcomeApplied = false;
    const agentDiscountIsFirstMonth = discountRow?.type === "first_month_free";
    if (!agentDiscountIsFirstMonth && monthly > 0) {
      const { data: eligibleData } = await admin.rpc(
        "is_eligible_for_welcome_first_month",
        { p_user_id: clientUserId, p_email: payload.client.email },
      );
      if (eligibleData === true) {
        welcomeFirstMonth = Number(monthly.toFixed(2));
        welcomeApplied = true;
      }
    }

    const { accountId, accountNumber } = await resolveOrCreateAccount(admin, clientUserId, payload.client);

    // Step 3: generate order_number + insert order (WITHOUT total_amount — RPC is authoritative)
    const { data: numData, error: numErr } = await admin.rpc("generate_order_number");
    if (numErr) return json({ error: `order_number gen failed: ${numErr.message}` }, 500);
    const orderNumber = String(numData);

    const serviceType = payload.plan.category === "tv" ? "tv"
      : payload.plan.category === "mobile" ? "mobile"
      : payload.plan.category === "bundle" ? "bundle" : "internet";

    const installDetails = {
      requested_date: payload.install.date,
      time_slot: payload.install.slot,
      source: "crm_call",
    };

    const equipmentLines = (payload.equipment ?? []).map((e) => ({
      name: e.name, unit_price: Number(e.price), quantity: Number(e.quantity ?? 1),
    }));

    const { data: order, error: insertErr } = await admin.from("orders").insert({
      order_number: orderNumber,
      user_id: clientUserId,
      account_id: accountId,
      status: "submitted",
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
      // total_amount / subtotal / tps / tvq laissés NULL — les RPC canoniques
      // seront la seule source de vérité. Patch après build_invoice_from_order.
      payment_status: "pending",
      payment_method: "card",
      activation_preference: payload.install.date ? "SCHEDULED" : "ASAP",
      environment: "live",
      equipment_line_details: equipmentLines,
      installation_details: installDetails,
      requested_activation_date: payload.install.date,
      internal_notes: payload.notes ?? null,
      discount_code: discountRow?.name ?? null,
      discount_amount: monthlyDiscountAmount + firstMonthCredit + welcomeFirstMonth,
      promo_discount_amount: monthlyDiscountAmount,
      promo_details: discountRow ? {
        source_discount_id: discountRow.id,
        name: discountRow.name, type: discountRow.type, value: discountRow.value,
        applies_to: discountRow.applies_to, duration_months: discountRow.duration_months,
        monthly_amount: monthlyDiscountAmount, first_month_credit: firstMonthCredit,
      } : null,
    }).select("id, order_number, status").single();

    if (insertErr) return json({ error: `Insert failed: ${insertErr.message}` }, 500);

    // Step 4: materialize order_items — source unique de toute la logique billing
    const items: any[] = [];
    let itemNo = 1;
    // Plan récurrent (prix brut, non escompté — les rabais sont des lignes séparées)
    items.push({
      order_id: order.id,
      item_number: itemNo++,
      plan_code: payload.plan.service_id,
      plan_name: payload.plan.name,
      service_type: serviceType,
      unit_price: monthly,
      quantity: 1,
      line_total: monthly,
      is_recurring: true,
    });
    // Équipement (one-time)
    for (const eq of equipmentLines) {
      const lineTotal = Number((eq.unit_price * eq.quantity).toFixed(2));
      items.push({
        order_id: order.id,
        item_number: itemNo++,
        plan_code: `EQP-${eq.name.slice(0, 20)}`,
        plan_name: eq.name,
        service_type: "equipment",
        unit_price: eq.unit_price,
        quantity: eq.quantity,
        line_total: lineTotal,
        is_recurring: false,
      });
    }
    // Rabais agent (négatif)
    if (discountRow && monthlyDiscountAmount > 0) {
      items.push({
        order_id: order.id, item_number: itemNo++,
        plan_code: `PROMO-${discountRow.id.slice(0, 8)}`,
        plan_name: `${discountRow.name}${discountRow.duration_months ? ` (${discountRow.duration_months} mois)` : ""}`,
        service_type: "promotion",
        unit_price: -monthlyDiscountAmount, quantity: 1,
        line_total: -monthlyDiscountAmount, is_recurring: false,
      });
    }
    // Crédit 1er mois agent (négatif)
    if (discountRow?.type === "first_month_free" && firstMonthCredit > 0) {
      items.push({
        order_id: order.id, item_number: itemNo++,
        plan_code: `PROMO-FMF-${discountRow.id.slice(0, 8)}`,
        plan_name: `${discountRow.name} (1er mois)`,
        service_type: "promotion",
        unit_price: -firstMonthCredit, quantity: 1,
        line_total: -firstMonthCredit, is_recurring: false,
      });
    }
    // Welcome premier mois (négatif)
    if (welcomeFirstMonth > 0) {
      items.push({
        order_id: order.id, item_number: itemNo++,
        plan_code: "PROMO-WELCOME-FMF",
        plan_name: `1er mois offert (automatique)`,
        service_type: "promotion",
        unit_price: -welcomeFirstMonth, quantity: 1,
        line_total: -welcomeFirstMonth, is_recurring: false,
      });
    }

    const { error: itemsErr } = await admin.from("order_items").insert(items);
    if (itemsErr) return json({ error: `order_items insert failed: ${itemsErr.message}` }, 500);

    // Ensure billing_customer exists (prerequisite for RPCs)
    let billingCustomerId: string | null = null;
    const { data: existingBc } = await admin.from("billing_customers")
      .select("id").eq("user_id", clientUserId).maybeSingle();
    if (existingBc) {
      billingCustomerId = existingBc.id;
    } else {
      const { data: byEmail } = await admin.from("billing_customers")
        .select("id").ilike("email", payload.client.email).maybeSingle();
      if (byEmail) {
        billingCustomerId = byEmail.id;
        await admin.from("billing_customers").update({ user_id: clientUserId })
          .eq("id", billingCustomerId).is("user_id", null);
      } else {
        const { data: newBc, error: bcErr } = await admin.from("billing_customers").insert({
          user_id: clientUserId,
          first_name: payload.client.first_name || "Client",
          last_name: payload.client.last_name || "CRM",
          email: payload.client.email,
          phone: payload.client.phone || "",
          status: "active",
        }).select("id").single();
        if (bcErr) return json({ error: `billing_customer failed: ${bcErr.message}` }, 500);
        billingCustomerId = newBc.id;
      }
    }

    const provenanceContext = {
      edge_function_name: "crm-create-sale",
      module: "crm",
      actor_user_id: user.id,
      reason: "crm_sale_created",
      request_id: crypto.randomUUID(),
      source_type: "crm_contact",
      source_id: payload.contact_id,
    };

    // Step 5: canonical RPCs — SEULE source de vérité facturation
    const { data: invoiceId, error: invErr } = await admin.rpc("build_invoice_from_order", {
      p_order_id: order.id, p_context: provenanceContext,
    });
    if (invErr) return json({ error: `build_invoice_from_order failed: ${invErr.message}` }, 500);

    const { error: subErr } = await admin.rpc("create_subscriptions_from_order", {
      p_order_id: order.id, p_context: provenanceContext,
    });
    if (subErr) return json({ error: `create_subscriptions_from_order failed: ${subErr.message}` }, 500);

    // Step 6: read invoice + patch orders columns for downstream consumers
    const { data: invoice } = await admin.from("billing_invoices")
      .select("id, invoice_number, subtotal, tps_amount, tvq_amount, total, status")
      .eq("id", invoiceId).single();

    await admin.from("orders").update({
      subtotal: invoice.subtotal,
      tps_amount: invoice.tps_amount,
      tvq_amount: invoice.tvq_amount,
      total_amount: invoice.total,
    }).eq("id", order.id);

    // Increment discount usage (best-effort)
    if (discountRow) {
      try {
        await admin.from("agent_discounts")
          .update({ uses_count: (Number(discountRow.uses_count ?? 0) + 1) })
          .eq("id", discountRow.id);
      } catch (_) { /* ignore */ }
    }

    // Step 7: CRM state transition
    await admin.from("crm_contacts").update({
      call_status: "sold",
      converted_order_id: order.id,
      converted_to_user_id: clientUserId,
      converted_at: new Date().toISOString(),
      is_locked: false, locked_by: null, locked_until: null, locked_by_name: null,
      updated_at: new Date().toISOString(),
    }).eq("id", payload.contact_id);

    try {
      await admin.from("crm_call_logs").insert({
        contact_id: payload.contact_id,
        agent_id: user.id,
        outcome: "sold",
        notes: `Vente complétée — commande ${orderNumber}`,
      });
    } catch (_) { /* ignore */ }

    // Commission estimate (business logic, no financial writes)
    const monthlyAfterDiscount = Math.max(0, monthly - monthlyDiscountAmount);
    const equipTotal = equipmentLines.reduce((s, e) => s + e.unit_price * e.quantity, 0);
    const commissionEstimate = Number((monthlyAfterDiscount * 0.30 + equipTotal * 0.05).toFixed(2));

    // Step 8: Le paiement suit le chemin Square déclenché séparément par le client depuis le portail.
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-order-confirmation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", apikey: serviceKey },
        body: JSON.stringify({ order_id: order.id }),
      });
    } catch (e) { console.error("[crm-create-sale] send-order-confirmation failed", e); }

    return json({
      ok: true,
      order_id: order.id,
      order_number: orderNumber,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      total: invoice.total,
      commission_estimate: commissionEstimate,
      canonical: true,
    });
  } catch (e) {
    console.error("[crm-create-sale] error", e);
    return json({ error: (e as any)?.message ?? "unknown" }, 500);
  }
});
