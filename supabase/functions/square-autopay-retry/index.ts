// ============================================================
// square-autopay-retry — Retente les paiements autopay Square
// ============================================================
// Politique de retry (validée avec le client) :
//   • Tentative initiale (jour de génération) : faite par
//     billing-generate-renewals → square-charge-subscription
//   • Si échec :
//       - Retries 1 à 7 : tous les jours (J+1 .. J+7)
//       - Retries 8 à 10 : tous les 2 jours
//       - Maximum 10 tentatives au total (initiale + 9 retries)
//   • Après 10 tentatives sans succès → autopay_stopped=true,
//     la facture reste avec son solde dû et l'engine dunning
//     prend le relai (aucun nouvel essai automatique).
//   • Toujours au maximum 1 tentative par jour par facture.
//
// Cron recommandé : quotidien à 09:00 UTC.
// Auth : SERVICE_ROLE_KEY requis (cron-only).
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
  // newAttemptCount = nombre total de tentatives déjà effectuées
  // (incluant celle qu'on vient de faire).
  if (newAttemptCount >= MAX_ATTEMPTS) return null; // stop
  if (newAttemptCount < 7) return 24;               // daily J+1..J+7
  return 48;                                         // every 2 days
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
  const locationId = Deno.env.get("SQUARE_LOCATION_ID") || "LQW27N70DQ2N8";

  // Auth: only accept service role bearer
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!squareToken) {
    return new Response(JSON.stringify({ error: "SQUARE_ACCESS_TOKEN missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Sélection: factures unpaid/overdue/failed, autopay actif (client a une carte),
  // pas arrêtées, avec next_attempt <= now (ou null = éligible tout de suite),
  // et jamais tentées aujourd'hui.
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
    return new Response(JSON.stringify({ error: selErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = { processed: 0, charged: 0, failed: 0, skipped: 0, stopped: 0, errors: [] as string[] };

  for (const inv of candidates || []) {
    const bc = inv.customer as any;
    // Skip si pas de carte Square ou autopay désactivé
    if (!bc?.autopay_enabled || !bc?.square_customer_id || !bc?.square_card_id) {
      results.skipped++;
      continue;
    }
    // Skip si déjà tenté aujourd'hui (1/jour max)
    if (inv.autopay_last_attempt_at && inv.autopay_last_attempt_at.startsWith(todayStr)) {
      results.skipped++;
      continue;
    }
    // Skip si déjà au max
    if ((inv.autopay_retry_count || 0) >= MAX_ATTEMPTS) {
      await supabase.from("billing_invoices")
        .update({ autopay_stopped: true, autopay_next_attempt_at: null })
        .eq("id", inv.id);
      results.stopped++;
      continue;
    }

    results.processed++;
    const amountCents = Math.round(Number(inv.balance_due) * 100);

    try {
      const res = await fetch(SQUARE_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${squareToken}`,
          "Content-Type": "application/json",
          "Square-Version": SQUARE_VERSION,
        },
        body: JSON.stringify({
          source_id: bc.square_card_id,
          customer_id: bc.square_customer_id,
          idempotency_key: `autopay-retry-${inv.id}-${todayStr}`,
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
        const errMsg = body.errors?.map((e: any) => `${e.code}:${e.detail}`).join(" | ") || "square_error";
        const delayH = nextAttemptDelayHours(newCount);
        const nextAt = delayH ? new Date(now.getTime() + delayH * 3600_000).toISOString() : null;

        await supabase.from("billing_invoices")
          .update({
            autopay_retry_count: newCount,
            autopay_last_attempt_at: now.toISOString(),
            autopay_next_attempt_at: nextAt,
            autopay_stopped: newCount >= MAX_ATTEMPTS,
            autopay_last_error: errMsg.slice(0, 500),
          })
          .eq("id", inv.id);

        results.failed++;
        if (newCount >= MAX_ATTEMPTS) results.stopped++;

        // Log une ligne payment failed pour traçabilité
        await supabase.from("billing_payments").insert({
          invoice_id: inv.id,
          customer_id: inv.customer_id,
          method: "card",
          amount: Number(inv.balance_due),
          status: "failed",
          provider: "square",
          source: "autopay_retry",
          created_by_name: "Autopay Retry",
          created_by_role: "system",
          metadata: { retry_count: newCount, error: errMsg, square_errors: body.errors ?? null },
        } as any).then(undefined, () => {});
        continue;
      }

      // Succès: applique le paiement + marque facture payée
      const payment = body.payment;
      const paymentId: string = payment.id;
      const receiptUrl: string | null = payment.receipt_url || null;
      const amountPaid = Number(payment.amount_money?.amount || 0) / 100;

      await supabase.from("billing_payments").insert({
        invoice_id: inv.id,
        customer_id: inv.customer_id,
        method: "card",
        amount: amountPaid,
        status: "confirmed",
        provider: "square",
        provider_payment_id: paymentId,
        square_payment_id: paymentId,
        square_receipt_url: receiptUrl,
        source: "autopay_retry",
        created_by_name: "Autopay Retry",
        created_by_role: "system",
        received_at: now.toISOString(),
      } as any);

      await supabase.from("billing_invoices")
        .update({
          status: "paid",
          balance_due: 0,
          amount_paid: Number(inv.total),
          paid_at: now.toISOString(),
          autopay_retry_count: newCount,
          autopay_last_attempt_at: now.toISOString(),
          autopay_next_attempt_at: null,
          autopay_last_error: null,
        })
        .eq("id", inv.id);

      results.charged++;
    } catch (e: any) {
      results.errors.push(`${inv.id}: ${e?.message || String(e)}`);
    }
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
