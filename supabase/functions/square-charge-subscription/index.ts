// ============================================================================
// square-charge-subscription — Charge Square + RPC canonique
// ============================================================================
// Phase 3.B.2 partie 2 :
//   - AUCUN INSERT direct billing_payments
//   - AUCUN UPDATE direct billing_invoices
//   - Toute application passe par apply_payment_to_invoice
//   - Échecs journalisés dans square_payment_attempts (aucun effet billing)
//   - Idempotence via idempotency_key stable
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_API = "https://connect.squareup.com/v2";
const LOCATION_ID = Deno.env.get("SQUARE_LOCATION_ID")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase: any = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN")!;

  try {
    const { subscription_id, invoice_id, amount } = await req.json();
    if (!subscription_id || !invoice_id || amount === undefined) {
      throw new Error("subscription_id, invoice_id et amount requis");
    }

    // Idempotence: si facture déjà payée → OK immédiat
    const { data: existingInv } = await supabase
      .from("billing_invoices")
      .select("id, status, balance_due, invoice_number")
      .eq("id", invoice_id).maybeSingle();
    if (existingInv?.status === "paid" || Number(existingInv?.balance_due || 0) <= 0) {
      return new Response(
        JSON.stringify({ ok: true, already_paid: true, invoice_number: existingInv?.invoice_number }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: sub, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select("id, customer_id, plan_name, billing_customers(id, email, first_name, last_name, square_customer_id, square_card_id, square_card_brand, square_card_last4)")
      .eq("id", subscription_id).single();
    if (subErr || !sub) throw new Error("Subscription introuvable");

    const bc = sub.billing_customers as any;
    if (!bc?.square_customer_id || !bc?.square_card_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "NO_SQUARE_CARD", message: "Client n'a pas de carte Square enregistrée" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amountCents = Math.round(Number(amount) * 100);
    const idempotencyKey = `sub-charge-${invoice_id}`;

    // Idempotence : si tentative déjà réussie pour cette clé, retour immédiat
    const { data: existingAttempt } = await supabase
      .from("square_payment_attempts")
      .select("id, status, square_payment_id")
      .eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existingAttempt?.status === "success" && existingAttempt.square_payment_id) {
      return new Response(
        JSON.stringify({ ok: true, already_processed: true, square_payment_id: existingAttempt.square_payment_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(`${SQUARE_API}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${squareToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-11-20",
      },
      body: JSON.stringify({
        source_id: bc.square_card_id,
        idempotency_key: idempotencyKey,
        amount_money: { amount: amountCents, currency: "CAD" },
        customer_id: bc.square_customer_id,
        location_id: LOCATION_ID,
        note: `Facture ${invoice_id} — ${sub.plan_name || "Abonnement Nivra"}`,
        autocomplete: true,
      }),
    });

    const body = await res.json();

    if (!res.ok || body.errors) {
      const errMsg = body.errors?.map((e: any) => e.detail).join(", ") || "Square payment failed";
      const code = body.errors?.[0]?.code || "UNKNOWN";
      const category = body.errors?.[0]?.category || null;

      await supabase.from("square_payment_attempts").insert({
        invoice_id, subscription_id, customer_id: sub.customer_id,
        amount: Number(amount),
        idempotency_key: idempotencyKey,
        square_error_code: code,
        square_error_detail: errMsg,
        square_error_category: category,
        status: "failed",
        response_raw: body,
      }).catch(() => {});

      console.error("[square-charge-subscription] Payment failed:", errMsg);
      return new Response(
        JSON.stringify({ ok: false, error: errMsg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payment = body.payment;
    const squarePaymentId: string = payment.id;
    const receiptUrl: string | null = payment.receipt_url || null;
    const amountPaid = Number(payment.amount_money?.amount || 0) / 100;

    // Idempotence : ne pas réappliquer si déjà présent
    const { data: existingPayment } = await supabase
      .from("billing_payments").select("id").eq("reference", squarePaymentId).maybeSingle();

    let canonicalPaymentId: string | null = existingPayment?.id ?? null;
    if (!canonicalPaymentId) {
      const { data: rpcId, error: rpcErr } = await supabase.rpc("apply_payment_to_invoice", {
        p_invoice_id: invoice_id,
        p_amount: amountPaid,
        p_method: "card",
        p_provider: "square",
        p_external_reference: squarePaymentId,
        p_source: "autopay_square",
        p_context: {
          subscription_id,
          square_payment_id: squarePaymentId,
          square_receipt_url: receiptUrl,
          idempotency_key: idempotencyKey,
        },
      });
      if (rpcErr) {
        console.error("[square-charge-subscription] RPC failed:", rpcErr.message);
        await supabase.from("square_payment_attempts").insert({
          invoice_id, subscription_id, customer_id: sub.customer_id,
          amount: amountPaid,
          idempotency_key: idempotencyKey,
          square_payment_id: squarePaymentId,
          status: "success",
          response_raw: { payment, rpc_error: rpcErr.message },
        }).catch(() => {});
        throw new Error(`RPC apply failed: ${rpcErr.message}`);
      }
      canonicalPaymentId = rpcId as string;
    }

    await supabase.from("square_payment_attempts").insert({
      invoice_id, subscription_id, customer_id: sub.customer_id,
      amount: amountPaid,
      idempotency_key: idempotencyKey,
      square_payment_id: squarePaymentId,
      status: "success",
      response_raw: payment,
    }).catch(() => {});

    // Email reçu (non-blocking)
    if (bc?.email) {
      try {
        const { buildReceiptPdfAttachment } = await import("../_shared/pdfFromDb.ts");
        const pdf = await buildReceiptPdfAttachment(invoice_id, "recu-paiement").catch(() => null);
        await enqueueCommunication({
          channel: "email",
          templateKey: "payment_receipt",
          recipient: bc.email,
          idempotencyKey: `square-receipt-${squarePaymentId}`,
          templateVars: {
            client_name: `${bc.first_name || ""} ${bc.last_name || ""}`.trim() || bc.email,
            amount: Number(amount).toFixed(2),
            amount_paid_today: Number(amount).toFixed(2),
            total_payable: Number(amount).toFixed(2),
            invoice_id,
            payment_method: `Carte ${bc.square_card_brand || ""} •••• ${bc.square_card_last4 || ""} (Paiement automatique)`,
            reference: squarePaymentId,
            receipt_url: receiptUrl,
          },
          attachments: pdf ? [pdf] : null,
        });
      } catch (e) {
        console.warn("[square-charge-subscription] email failed:", e);
      }
    }

    console.log(`[square-charge-subscription] ✅ Charged ${amount} CAD for invoice ${invoice_id}, Square ${squarePaymentId}`);

    return new Response(JSON.stringify({
      ok: true,
      canonical_payment_id: canonicalPaymentId,
      square_payment_id: squarePaymentId,
      receipt_url: receiptUrl,
      amount_charged: amountPaid,
      rpc_used: "apply_payment_to_invoice",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[square-charge-subscription]", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
