// ============================================================================
// billing-create-prorata-invoice — Phase 3.A REWRITE
// ============================================================================
//
//   • AUCUNE écriture directe sur billing_invoices / billing_invoice_lines.
//   • AUCUN calcul local TPS/TVQ (retire le fallback 0.05/0.09975).
//   • Passe exclusivement par le RPC canonique SECURITY DEFINER :
//         build_invoice_ad_hoc  (Phase 3.A)
//   • Le prorata par service reste calculé par compute_prorata_for_service
//     (RPC DB existante, source de vérité mathématique).
//
//   Ancien comportement :
//     1. compute_prorata_for_service pour chaque service (OK, conservé)
//     2. compute_invoice_breakdown pour taxes/totaux
//     3. FALLBACK: TPS 5% + TVQ 9.975% recalculés côté JS si l'RPC échoue
//     4. INSERT direct billing_invoices + billing_invoice_lines
//
//   Nouveau comportement :
//     1. compute_prorata_for_service (inchangé — c'est du calcul de prorata,
//        pas du calcul de taxe)
//     2. Assemblage des lignes en JSON canonique
//     3. RPC build_invoice_ad_hoc → facture + lignes + tax_snapshot figé
//
//   Logique supprimée :
//     - Fallback TPS 0.05 / TVQ 0.09975 côté application
//     - Appel à compute_invoice_breakdown (dupliquait le calcul du RPC)
//     - INSERT direct sur billing_invoices et billing_invoice_lines
//     - Fonction persistInvoice locale
// ============================================================================

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
  request_id?: string;
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
    if (!authHeader) return jsonResp({ error: "missing_authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResp({ error: "unauthorized" }, 401);

    const body = (await req.json()) as Payload;
    if (!isUuid(body?.account_id) || !isUuid(body?.service_address_id)) {
      return jsonResp({ error: "invalid_ids" }, 400);
    }
    const serviceIds = (body.service_ids ?? []).filter(isUuid);
    const equipmentIds = (body.equipment_ids ?? []).filter(isUuid);
    if (serviceIds.length === 0 && equipmentIds.length === 0) {
      return jsonResp({ error: "empty_selection" }, 400);
    }

    const activationDate = body.activation_date ??
      new Date().toISOString().slice(0, 10);

    const admin = createClient(supabaseUrl, serviceKey);

    // ── Chargement de l'adresse pour le label des lignes ────────────────
    const { data: address, error: addrErr } = await admin
      .from("service_addresses")
      .select("id, account_id, street_line1, city")
      .eq("id", body.service_address_id)
      .maybeSingle();
    if (addrErr || !address || address.account_id !== body.account_id) {
      return jsonResp({ error: "address_not_found" }, 404);
    }
    const addrLabel = `[${address.street_line1}, ${address.city}]`;

    // ── Résolution du billing_customer via le compte ─────────────────────
    const { data: account, error: acctErr } = await admin
      .from("accounts")
      .select("id, client_id")
      .eq("id", body.account_id)
      .maybeSingle();
    if (acctErr || !account?.client_id) {
      return jsonResp({ error: "account_not_found" }, 404);
    }
    const { data: billingCustomer, error: bcErr } = await admin
      .from("billing_customers")
      .select("id")
      .eq("user_id", account.client_id)
      .maybeSingle();
    if (bcErr || !billingCustomer?.id) {
      return jsonResp({ error: "billing_customer_not_found" }, 404);
    }
    const customerId = billingCustomer.id as string;

    // ── Construction des lignes ad-hoc en JSON canonique ────────────────
    // Note : unit_price et line_total sont exprimés en **dollars** (numeric).
    // Le RPC canonique attend le même format que build_invoice_from_order.
    type CanonicalLine = {
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      line_type: "service" | "equipment";
      line_kind: "prorata" | "equipment";
      service_address_id: string;
      metadata?: Record<string, unknown>;
    };
    const lines: CanonicalLine[] = [];

    // Services → lignes prorata (le calcul reste dans le RPC prorata DB)
    if (serviceIds.length > 0) {
      const { data: services, error: svcErr } = await admin
        .from("services")
        .select("id, name, monthly_price_cents, price_cents, monthly_price")
        .in("id", serviceIds);
      if (svcErr) return jsonResp({ error: "services_fetch_failed" }, 500);

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
        if (prErr) {
          return jsonResp({ error: "prorata_failed", detail: prErr.message }, 500);
        }
        const meta = prorataData as Record<string, any>;
        const cents = Number(meta.prorata_cents ?? 0);
        const dollars = Number((cents / 100).toFixed(2));
        lines.push({
          description:
            `${addrLabel} · ${svc.name} · Prorata ${meta.days_remaining}/${meta.days_in_cycle} jours`,
          quantity: 1,
          unit_price: dollars,
          line_total: dollars,
          line_type: "service",
          line_kind: "prorata",
          service_address_id: body.service_address_id,
          metadata: meta,
        });
      }
    }

    // Équipement → prix plein (jamais proraté)
    if (equipmentIds.length > 0) {
      const { data: equip, error: eqErr } = await admin
        .from("equipment_inventory")
        .select("id, name, price_cents, price")
        .in("id", equipmentIds);
      if (eqErr) return jsonResp({ error: "equipment_fetch_failed" }, 500);
      for (const it of equip ?? []) {
        const cents = (it as any).price_cents ??
          Math.round(((it as any).price ?? 0) * 100);
        const dollars = Number((Number(cents) / 100).toFixed(2));
        lines.push({
          description: `${addrLabel} · ${it.name}`,
          quantity: 1,
          unit_price: dollars,
          line_total: dollars,
          line_type: "equipment",
          line_kind: "equipment",
          service_address_id: body.service_address_id,
        });
      }
    }

    // ── RPC canonique — facture avec taxes figées ───────────────────────
    // AUCUN calcul TPS/TVQ ici. Les taxes sont dérivées et gelées par le RPC.
    const provenanceContext = {
      edge_function_name: "billing-create-prorata-invoice",
      module: "billing",
      actor_user_id: userData.user.id,
      reason: "activation_prorata",
      request_id: body.request_id ?? crypto.randomUUID(),
      source_type: "activation_prorata",
    };

    const { data: invoiceId, error: rpcErr } = await admin.rpc(
      "build_invoice_ad_hoc",
      {
        p_customer_id: customerId,
        p_subscription_id: null,
        p_type: "activation_prorata",
        p_cycle_start: activationDate,
        p_cycle_end: activationDate,
        p_due_date: activationDate,
        p_lines: lines,
        p_context: provenanceContext,
        p_order_id: null,
        p_notes: `Facture prorata activation — ${addrLabel}`,
      },
    );
    if (rpcErr) {
      return jsonResp({ error: "invoice_rpc_failed", detail: rpcErr.message }, 500);
    }

    // Lecture des montants figés (subtotal + TPS + TVQ + total)
    const { data: invoice } = await admin
      .from("billing_invoices")
      .select("id, invoice_number, subtotal, tps_amount, tvq_amount, total")
      .eq("id", invoiceId)
      .single();

    return jsonResp({
      invoice_id: invoiceId,
      invoice_number: invoice?.invoice_number,
      subtotal: invoice?.subtotal,
      tps_amount: invoice?.tps_amount,
      tvq_amount: invoice?.tvq_amount,
      total: invoice?.total,
      line_count: lines.length,
    }, 200);
  } catch (err) {
    return jsonResp({ error: "internal_error", detail: String(err) }, 500);
  }
});

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
