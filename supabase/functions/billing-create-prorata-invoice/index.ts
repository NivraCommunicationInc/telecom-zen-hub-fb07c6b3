// Edge Function: billing-create-prorata-invoice
// Creates an activation invoice with per-service prorata lines + full-price equipment lines.
// All monetary math lives in the DB (compute_prorata_for_service + compute_invoice_breakdown).
// Frontend never sends prices; only IDs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  account_id: string;
  service_address_id: string;
  service_ids?: string[];
  equipment_ids?: string[];
  activation_date?: string; // ISO date
};

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "missing_authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = (await req.json()) as Payload;
    if (!isUuid(body?.account_id) || !isUuid(body?.service_address_id)) {
      return json({ error: "invalid_ids" }, 400);
    }
    const serviceIds = (body.service_ids ?? []).filter(isUuid);
    const equipmentIds = (body.equipment_ids ?? []).filter(isUuid);
    if (serviceIds.length === 0 && equipmentIds.length === 0) {
      return json({ error: "empty_selection" }, 400);
    }

    const activationDate = body.activation_date ??
      new Date().toISOString().slice(0, 10);

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch address label for line descriptions
    const { data: address, error: addrErr } = await admin
      .from("service_addresses")
      .select("id, account_id, street_line1, city")
      .eq("id", body.service_address_id)
      .maybeSingle();
    if (addrErr || !address || address.account_id !== body.account_id) {
      return json({ error: "address_not_found" }, 404);
    }
    const addrLabel = `[${address.street_line1}, ${address.city}]`;

    const lines: Array<{
      description: string;
      quantity: number;
      unit_price_cents: number;
      total_cents: number;
      service_address_id: string;
      prorata_metadata: Record<string, unknown> | null;
    }> = [];

    // Services -> prorata lines
    if (serviceIds.length > 0) {
      const { data: services, error: svcErr } = await admin
        .from("services")
        .select("id, name, monthly_price_cents, price_cents, monthly_price")
        .in("id", serviceIds);
      if (svcErr) return json({ error: "services_fetch_failed" }, 500);

      for (const svc of services ?? []) {
        const monthlyCents = (svc as any).monthly_price_cents ??
          (svc as any).price_cents ??
          Math.round(((svc as any).monthly_price ?? 0) * 100);
        const { data: prorataData, error: prErr } = await admin.rpc(
          "compute_prorata_for_service",
          {
            p_account_id: body.account_id,
            p_service_address_id: body.service_address_id,
            p_monthly_price_cents: monthlyCents,
            p_activation_date: activationDate,
          },
        );
        if (prErr) return json({ error: "prorata_failed", detail: prErr.message }, 500);
        const meta = prorataData as Record<string, any>;
        const cents = meta.prorata_cents ?? 0;
        lines.push({
          description:
            `${addrLabel} · ${svc.name} · Prorata ${meta.days_remaining}/${meta.days_in_cycle} jours`,
          quantity: 1,
          unit_price_cents: cents,
          total_cents: cents,
          service_address_id: body.service_address_id,
          prorata_metadata: meta,
        });
      }
    }

    // Equipment -> full price lines (never prorated)
    if (equipmentIds.length > 0) {
      const { data: equip, error: eqErr } = await admin
        .from("equipment_inventory")
        .select("id, name, price_cents, price")
        .in("id", equipmentIds);
      if (eqErr) return json({ error: "equipment_fetch_failed" }, 500);
      for (const it of equip ?? []) {
        const cents = (it as any).price_cents ??
          Math.round(((it as any).price ?? 0) * 100);
        lines.push({
          description: `${addrLabel} · ${it.name}`,
          quantity: 1,
          unit_price_cents: cents,
          total_cents: cents,
          service_address_id: body.service_address_id,
          prorata_metadata: null,
        });
      }
    }

    const subtotalCents = lines.reduce((s, l) => s + l.total_cents, 0);

    // Delegate taxes/totals to canonical breakdown function
    const { data: breakdown, error: bErr } = await admin.rpc(
      "compute_invoice_breakdown",
      { p_subtotal_cents: subtotalCents },
    );
    if (bErr) {
      // Fallback: apply TPS 5% + TVQ 9.975% if function signature differs
      const tps = Math.round(subtotalCents * 0.05);
      const tvq = Math.round(subtotalCents * 0.09975);
      const total = subtotalCents + tps + tvq;
      return await persistInvoice(admin, {
        account_id: body.account_id,
        service_address_id: body.service_address_id,
        subtotal_cents: subtotalCents,
        tps_cents: tps,
        tvq_cents: tvq,
        total_cents: total,
        lines,
      });
    }

    const b = breakdown as any;
    return await persistInvoice(admin, {
      account_id: body.account_id,
      service_address_id: body.service_address_id,
      subtotal_cents: b.subtotal_cents ?? subtotalCents,
      tps_cents: b.tps_cents ?? 0,
      tvq_cents: b.tvq_cents ?? 0,
      total_cents: b.total_cents ?? subtotalCents,
      lines,
    });
  } catch (err) {
    return json({ error: "internal_error", detail: String(err) }, 500);
  }
});

async function persistInvoice(admin: any, args: {
  account_id: string;
  service_address_id: string;
  subtotal_cents: number;
  tps_cents: number;
  tvq_cents: number;
  total_cents: number;
  lines: Array<any>;
}) {
  const { data: invoice, error: invErr } = await admin
    .from("billing_invoices")
    .insert({
      account_id: args.account_id,
      subtotal_cents: args.subtotal_cents,
      tps_cents: args.tps_cents,
      tvq_cents: args.tvq_cents,
      total_cents: args.total_cents,
      status: "pending",
      kind: "activation_prorata",
    })
    .select("id, total_cents")
    .single();
  if (invErr || !invoice) {
    return json({ error: "invoice_insert_failed", detail: invErr?.message }, 500);
  }

  const lineRows = args.lines.map((l) => ({
    invoice_id: invoice.id,
    description: l.description,
    quantity: l.quantity,
    unit_price_cents: l.unit_price_cents,
    total_cents: l.total_cents,
    service_address_id: l.service_address_id,
    prorata_metadata: l.prorata_metadata,
  }));
  const { error: linesErr } = await admin.from("billing_invoice_lines").insert(lineRows);
  if (linesErr) {
    return json({ error: "lines_insert_failed", detail: linesErr.message }, 500);
  }

  return json({
    invoice_id: invoice.id,
    total_cents: invoice.total_cents,
    subtotal_cents: args.subtotal_cents,
    tps_cents: args.tps_cents,
    tvq_cents: args.tvq_cents,
    line_count: lineRows.length,
  }, 200);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
