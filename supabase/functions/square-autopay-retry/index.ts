// ============================================================
// square-autopay-retry — Retry paiements autopay Square
// Phase 3.B.2 partie 2 :
//   - AUCUN INSERT direct billing_payments (succès ET échec)
//   - AUCUN UPDATE direct billing_invoices.status / balance / amount_paid
//   - Succès → apply_payment_to_invoice (RPC canonique)
//   - Échec  → square_payment_attempts (aucun effet billing)
//   - Compteurs autopay (retry_count, next_attempt, stopped) restent gérés ici
//     — colonnes de scheduling, pas de facturation
// Politique retry : J+1..J+7 daily, J+8..J+10 every 2 days, max 10.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_API = "https://connect.squareup.com/v2/payments";
const SQUARE_VERSION = "2024-11-20";
const MAX_ATTEMPTS = 10;

function nextAttemptDelayHours(newAttemptCount: number): number | null {
  if (newAttemptCount >= MAX_ATTEMPTS) return null;
  if (newAttemptCount < 7) return 24;
  return 48;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
  const locationId = Deno.env.get("SQUARE_LOCATION_ID") || "LQW27N70DQ2N8";

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!squareToken) {
    return new Response(JSON.stringify({ error: "SQUARE_ACCESS_TOKEN missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const { data: candidates, error: selErr } = await supabase
    .from("billing_invoices")
    .select(`
      id, invoice_number, balance_due, total, customer_id, status,
      autopay_retry_count, autopay_last_attempt_at, autopay_next_attempt_at, autopay_stopped,
      customer:billing_customers(id, email, first_name, last_name, square_customer_id, square_card_id, autopay_enabled)
    `)
    .in("status", ["unpaid", "overdue", "failed", "partially_paid"])
    .gt("balance_due", 0)
    .eq("autopay_stopped", false)
    .or(`autopay_next_attempt_at.is.null,autopay_next_attempt_at.lte.${now.toISOString()}`)
    .limit(200);

  if (selErr) {
    return new Response(JSON.stringify({ error: selErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results = { processed: 0, charged: 0, failed: 0, skipped: 0, stopped: 0, errors: [] as string[] };

  for (const inv of candidates || []) {
    const bc = inv.customer as any;
    if (!bc?.autopay_enabled || !bc?.square_customer_id || !bc?.square_card_id) { results.skipped++; continue; }
    if (inv.autopay_last_attempt_at && inv.autopay_last_attempt_at.startsWith(todayStr)) { results.skipped++; continue; }
    if ((inv.autopay_retry_count || 0) >= MAX_ATTEMPTS) {
      await supabase.from("billing_invoices")
        .update({ autopay_stopped: true, autopay_next_attempt_at: null })
        .eq("id", inv.id);
      results.stopped++; continue;
    }

    results.processed++;
    const amountCents = Math.round(Number(inv.balance_due) * 100);
    const idempotencyKey = `autopay-retry-${inv.id}-${todayStr}`;

    // Idempotence — si tentative déjà réussie aujourd'hui pour cette clé
    const { data: existingAttempt } = await supabase
      .from("square_payment_attempts")
      .select("id, status, square_payment_id")
      .eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existingAttempt?.status === "success") { results.skipped++; continue; }

    try {
      const res = await fetch(SQUARE_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${squareToken}`,
          "Content-Type": "application/json",
          "Square-Version": SQUARE_VERSION,
        },
        body: JSON.stringify({
          source_id: bc.square_card_id,
          customer_id: bc.square_customer_id,
          idempotency_key: idempotencyKey,
          amount_money: { amount: amountCents, currency: "CAD" },
          location_id: locationId,
          note: `Autopay retry — Facture ${inv.invoice_number || inv.id}`,
          autocomplete: true,
          reference_id: (inv.invoice_number || inv.id).slice(0, 40),
        }),
      });

      const body = await res.json();
      const newCount = (inv.autopay_retry_count || 0) + 1;

      if (!res.ok || body.errors) {
        // ── ÉCHEC : log dans square_payment_attempts UNIQUEMENT ─────────────
        const errMsg = body.errors?.map((e: any) => `${e.code}:${e.detail}`).join(" | ") || "square_error";
        const code = body.errors?.[0]?.code || "UNKNOWN";
        const category = body.errors?.[0]?.category || null;
        const delayH = nextAttemptDelayHours(newCount);
        const nextAt = delayH ? new Date(now.getTime() + delayH * 3600_000).toISOString() : null;

        // Colonnes de scheduling autopay (pas des colonnes financières)
        await supabase.from("billing_invoices").update({
          autopay_retry_count: newCount,
          autopay_last_attempt_at: now.toISOString(),
          autopay_next_attempt_at: nextAt,
          autopay_stopped: newCount >= MAX_ATTEMPTS,
          autopay_last_error: errMsg.slice(0, 500),
        }).eq("id", inv.id);

        await supabase.from("square_payment_attempts").insert({
          invoice_id: inv.id,
          customer_id: inv.customer_id,
          amount: Number(inv.balance_due),
          idempotency_key: idempotencyKey,
          square_error_code: code,
          square_error_detail: errMsg,
          square_error_category: category,
          status: "failed",
          attempt_number: newCount,
          response_raw: body,
        }).catch(() => {});

        results.failed++;
        if (newCount >= MAX_ATTEMPTS) results.stopped++;
        continue;
      }

      // ── SUCCÈS : RPC canonique + log tentative ───────────────────────────
      const payment = body.payment;
      const paymentId: string = payment.id;
      const receiptUrl: string | null = payment.receipt_url || null;
      const amountPaid = Number(payment.amount_money?.amount || 0) / 100;

      // Idempotence RPC : reference match
      const { data: existingPayment } = await supabase
        .from("billing_payments").select("id").eq("reference", paymentId).maybeSingle();

      if (!existingPayment?.id) {
        const { error: rpcErr } = await supabase.rpc("apply_payment_to_invoice", {
          p_invoice_id: inv.id,
          p_amount: amountPaid,
          p_method: "card",
          p_provider: "square",
          p_external_reference: paymentId,
          p_source: "autopay_retry",
          p_context: {
            square_payment_id: paymentId,
            square_receipt_url: receiptUrl,
            idempotency_key: idempotencyKey,
            retry_count: newCount,
          },
        });
        if (rpcErr) {
          console.error("[square-autopay-retry] RPC failed for invoice", inv.id, rpcErr.message);
          results.errors.push(`${inv.id}: rpc ${rpcErr.message}`);
          continue;
        }
      }

      await supabase.from("square_payment_attempts").insert({
        invoice_id: inv.id,
        customer_id: inv.customer_id,
        amount: amountPaid,
        idempotency_key: idempotencyKey,
        square_payment_id: paymentId,
        status: "success",
        attempt_number: newCount,
        response_raw: payment,
      }).catch(() => {});

      // Colonnes de scheduling autopay uniquement (aucun status/balance/amount_paid)
      await supabase.from("billing_invoices").update({
        autopay_retry_count: newCount,
        autopay_last_attempt_at: now.toISOString(),
        autopay_next_attempt_at: null,
        autopay_last_error: null,
      }).eq("id", inv.id);

      results.charged++;
    } catch (e: any) {
      results.errors.push(`${inv.id}: ${e?.message || String(e)}`);
    }
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
