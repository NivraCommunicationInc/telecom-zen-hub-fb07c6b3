// Square Orphan Reconciliation
// Detects Square payments with no counterpart in Nivra (billing_payments / orders / invoices)
// and raises alerts in square_orphan_alerts.
//
// Triggered by pg_cron every 15 min. Authenticated via x-cron-secret header.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SQUARE_API_BASE = "https://connect.squareup.com/v2";

interface SquarePayment {
  id: string;
  status: string;
  amount_money?: { amount: number; currency: string };
  created_at: string;
  note?: string;
  receipt_url?: string;
  buyer_email_address?: string;
  source_type?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ─── Auth ────────────────────────────────────────────────────────────
  const providedSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("SQUARE_ORPHAN_CRON_SECRET");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
  if (!squareToken) {
    return new Response(JSON.stringify({ error: "SQUARE_ACCESS_TOKEN missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const startedAt = new Date();
  const beginTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // now-2h

  // ─── 1. Fetch recent Square payments ─────────────────────────────────
  const squarePayments: SquarePayment[] = [];
  let cursor: string | undefined;
  try {
    do {
      const url = new URL(`${SQUARE_API_BASE}/payments`);
      url.searchParams.set("begin_time", beginTime);
      url.searchParams.set("sort_order", "DESC");
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${squareToken}`,
          "Square-Version": "2024-06-04",
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[square-orphan] Square API error", res.status, errText);
        return new Response(JSON.stringify({ error: "square_api_error", status: res.status }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await res.json();
      if (Array.isArray(body.payments)) squarePayments.push(...body.payments);
      cursor = body.cursor;
    } while (cursor);
  } catch (e) {
    console.error("[square-orphan] Fetch error", e);
    return new Response(JSON.stringify({ error: "square_fetch_failed", detail: String(e) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Only completed payments
  const completed = squarePayments.filter((p) => p.status === "COMPLETED");

  if (completed.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        scanned: 0,
        window_start: beginTime,
        message: "No completed Square payments in window",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ─── 2. Fetch matching records from Nivra ────────────────────────────
  const squareIds = completed.map((p) => p.id);

  const [bpRes, spaRes] = await Promise.all([
    supabase.from("billing_payments").select("id, square_payment_id, invoice_id").in("square_payment_id", squareIds),
    supabase.from("square_payment_attempts").select("id, square_payment_id, invoice_id").in("square_payment_id", squareIds),
  ]);

  const knownInBilling = new Set((bpRes.data ?? []).map((r) => r.square_payment_id));
  const knownInAttempts = new Set((spaRes.data ?? []).map((r) => r.square_payment_id));

  // Extract CMD-XXXX references from notes
  const cmdRegex = /CMD-[A-Z0-9]+/i;
  const cmdRefs = new Map<string, string>(); // square_id → CMD-XXXX
  for (const p of completed) {
    const m = p.note?.match(cmdRegex);
    if (m) cmdRefs.set(p.id, m[0].toUpperCase());
  }

  const uniqueCmds = [...new Set(cmdRefs.values())];
  const matchedCmds = new Set<string>();
  if (uniqueCmds.length > 0) {
    const [ordRes, invRes] = await Promise.all([
      supabase.from("orders").select("order_number").in("order_number", uniqueCmds),
      supabase.from("billing_invoices").select("invoice_number").in("invoice_number", uniqueCmds),
    ]);
    (ordRes.data ?? []).forEach((r: any) => matchedCmds.add((r.order_number ?? "").toUpperCase()));
    (invRes.data ?? []).forEach((r: any) => matchedCmds.add((r.invoice_number ?? "").toUpperCase()));
  }

  // ─── 3. Detect orphans ───────────────────────────────────────────────
  const alertsCreated: string[] = [];
  const alertsRefreshed: string[] = [];

  for (const p of completed) {
    const inBilling = knownInBilling.has(p.id);
    const inAttempts = knownInAttempts.has(p.id);
    const cmd = cmdRefs.get(p.id);
    const cmdOrphan = cmd && !matchedCmds.has(cmd);

    let detectionReason: string | null = null;
    if (!inBilling && !inAttempts) {
      detectionReason = "not_in_billing_payments";
    } else if (!inBilling && inAttempts) {
      detectionReason = "webhook_missed";
    } else if (cmdOrphan) {
      detectionReason = "cmd_reference_no_order";
    }

    if (!detectionReason) continue;

    // Upsert: keep resolved/ignored untouched
    const { data: existing } = await supabase
      .from("square_orphan_alerts")
      .select("id, status")
      .eq("square_payment_id", p.id)
      .maybeSingle();

    if (existing && ["resolved", "ignored"].includes(existing.status)) {
      continue;
    }

    if (existing) {
      await supabase
        .from("square_orphan_alerts")
        .update({ last_seen_at: new Date().toISOString(), raw_square_payload: p })
        .eq("id", existing.id);
      alertsRefreshed.push(p.id);
      continue;
    }

    // Extract name from note pattern "Facture #CMD-XXX | Client: NAME"
    let buyerName: string | null = null;
    if (p.note) {
      const nameMatch = p.note.match(/client\s*:\s*(.+?)$/i);
      if (nameMatch) buyerName = nameMatch[1].trim();
    }

    const insertPayload = {
      square_payment_id: p.id,
      square_receipt_url: p.receipt_url ?? null,
      amount_cents: p.amount_money?.amount ?? null,
      currency: p.amount_money?.currency ?? "CAD",
      square_created_at: p.created_at,
      note: p.note ?? null,
      buyer_email_address: p.buyer_email_address ?? null,
      buyer_display_name: buyerName,
      detection_reason: detectionReason,
      status: "open",
      last_seen_at: new Date().toISOString(),
      raw_square_payload: p,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("square_orphan_alerts")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insErr) {
      console.error("[square-orphan] Insert error", p.id, insErr);
      continue;
    }
    alertsCreated.push(p.id);

    // Admin notification only on creation
    await supabase.from("admin_notification_logs").insert({
      notification_type: "ORPHAN_PAYMENT_DETECTED",
      recipient: "admin",
      status: "queued",
      metadata: {
        alert_id: inserted?.id,
        square_payment_id: p.id,
        amount_cents: p.amount_money?.amount,
        currency: p.amount_money?.currency,
        buyer_name: buyerName,
        buyer_email: p.buyer_email_address,
        note: p.note,
        detection_reason: detectionReason,
        receipt_url: p.receipt_url,
      },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      window_start: beginTime,
      window_end: startedAt.toISOString(),
      scanned: completed.length,
      alerts_created: alertsCreated.length,
      alerts_refreshed: alertsRefreshed.length,
      created_ids: alertsCreated,
      refreshed_ids: alertsRefreshed,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
