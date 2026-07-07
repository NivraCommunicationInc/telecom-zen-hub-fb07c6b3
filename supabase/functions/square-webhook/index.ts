/**
 * square-webhook — Phase 3.B.1 canonique
 *
 * INVARIANTS :
 *  1. Validation signature Square AVANT toute écriture DB.
 *  2. Idempotence : gate `record_webhook_event(provider,event_id)` AVANT logique métier.
 *  3. Aucune écriture directe sur billing_payments / billing_invoices / billing_invoice_lines.
 *     Tout passe par les RPC canoniques :
 *        - payment.updated FAILED     → aucune écriture billing (alerte seulement)
 *        - dispute.*                  → aucune écriture billing (alerte seulement)
 *     (Les captures Square passent par square-charge-*, pas par ce webhook.)
 *  4. Aucun refund via ce webhook : Square émet `refund.created` séparément — routé
 *     vers `refund_payment` RPC. JAMAIS un account_adjustment / invoice_line négative /
 *     promotion.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { writePaymentAutoNote } from "../_shared/paymentAutoNote.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-square-hmacsha256-signature",
};

async function verifySquareSignature(
  rawBody: string,
  signatureHeader: string,
  webhookUrl: string,
  signatureKey: string,
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(signatureKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(webhookUrl + rawBody));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return expected === signatureHeader;
  } catch (e) {
    console.error("[square-webhook] signature verify error", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rawBody = await req.text();

    // ─── (1) VALIDATION SIGNATURE avant toute écriture ────────────────
    const signatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
    if (signatureKey) {
      const signatureHeader = req.headers.get("x-square-hmacsha256-signature") || "";
      const webhookUrl = req.headers.get("x-forwarded-url") || req.url;
      const ok = await verifySquareSignature(rawBody, signatureHeader, webhookUrl, signatureKey);
      if (!ok) {
        console.warn("[square-webhook] Signature mismatch — rejected");
        return json({ error: "invalid_signature" }, 401);
      }
    } else {
      console.warn("[square-webhook] SQUARE_WEBHOOK_SIGNATURE_KEY absent — mode dev uniquement");
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: "invalid_payload" }, 400);
    }

    const eventType: string = event?.type || "";
    const eventId: string = event?.event_id || "";
    const eventCreatedAt: string | null = event?.created_at || null;

    if (!eventType || !eventId) {
      return json({ error: "missing_event_id_or_type" }, 400);
    }

    // ─── (2) IDEMPOTENCE avant traitement métier ──────────────────────
    const { data: isNew, error: idempotencyErr } = await supabase.rpc("record_webhook_event", {
      p_provider: "square",
      p_event_id: eventId,
      p_event_type: eventType,
      p_provider_created_at: eventCreatedAt,
      p_payload_hash: null,
    });
    if (idempotencyErr) {
      console.error("[square-webhook] record_webhook_event error:", idempotencyErr);
      return json({ error: "idempotency_check_failed" }, 500);
    }
    if (isNew === false) {
      console.log(`[square-webhook] Event ${eventId} déjà traité — short-circuit`);
      return json({ received: true, already_processed: true });
    }

    console.log(`[square-webhook] ✓ Event ${eventType} (${eventId}) — traitement`);

    // ─── (3) BRANCHES MÉTIER — aucune écriture billing directe ────────
    if (eventType === "payment.updated") {
      const payment = event.data?.object?.payment;
      const status: string = payment?.status || "";
      const providerPaymentId: string = payment?.id || "";

      if (status === "FAILED" && providerPaymentId) {
        // Note: aucune modification de billing_payments — l'état "failed" doit
        // provenir de la capture side (square-charge-*) via RPC canonique.
        // Ici on émet seulement une alerte pour l'équipe.
        const { data: bp } = await supabase
          .from("billing_payments")
          .select("id, invoice_id, customer_id, amount, method, provider, payment_number, nivra_reference, invoice:billing_invoices(invoice_number)")
          .eq("provider_payment_id", providerPaymentId)
          .maybeSingle();

        await supabase.from("billing_system_alerts").insert({
          alert_type: "square_payment_failed_webhook",
          entity_type: "billing_payment",
          entity_id: bp?.id || null,
          entity_reference: providerPaymentId,
          severity: "warning",
          details: {
            square_payment_id: providerPaymentId,
            square_status: status,
            invoice_id: bp?.invoice_id || null,
            amount: bp?.amount || null,
            event_id: eventId,
            note: "Aucune écriture billing directe — capture side (square-charge-*) devra rejouer via RPC canonique.",
          },
        });

        if (bp) {
          await writePaymentAutoNote({
            supabase,
            billingCustomerId: bp.customer_id,
            amount: bp.amount,
            method: bp.method || "card",
            provider: bp.provider || "square",
            invoiceNumber: (bp as any).invoice?.invoice_number || null,
            invoiceId: bp.invoice_id,
            nivraReference: bp.nivra_reference || null,
            paymentNumber: bp.payment_number || null,
            channel: "Webhook Square (échec)",
            event: "payment_invalid",
          });
        }
      }
    } else if (eventType === "refund.created" || eventType === "refund.updated") {
      // ─── (4) REFUND canonique via refund_payment() RPC ──────────────
      const refund = event.data?.object?.refund;
      const refundStatus: string = refund?.status || "";
      const providerRefundId: string = refund?.id || "";
      const originalPaymentProviderId: string = refund?.payment_id || "";
      const refundAmountCents: number = refund?.amount_money?.amount || 0;
      const refundAmount = refundAmountCents / 100;

      // On ne traite le refund qu'une fois qu'il est COMPLETED
      if (refundStatus !== "COMPLETED" || refundAmount <= 0 || !originalPaymentProviderId) {
        return json({ received: true, skipped: `refund status=${refundStatus}` });
      }

      // Retrouver le billing_payment original via provider_payment_id
      const { data: originalPayment } = await supabase
        .from("billing_payments")
        .select("id")
        .eq("provider_payment_id", originalPaymentProviderId)
        .eq("provider", "square")
        .maybeSingle();

      if (!originalPayment) {
        await supabase.from("billing_system_alerts").insert({
          alert_type: "square_refund_unmatched",
          entity_type: "square_refund",
          entity_reference: providerRefundId,
          severity: "high",
          details: {
            square_refund_id: providerRefundId,
            original_square_payment_id: originalPaymentProviderId,
            refund_amount: refundAmount,
            event_id: eventId,
          },
        });
        return json({ received: true, error: "original_payment_not_found" });
      }

      // Note : refund_payment est SECURITY DEFINER et pose son propre
      // verrou d'idempotence via record_webhook_event('square', refundId).
      // Le event_id ici est différent du refundId — on utilise le refundId
      // comme clé métier stable pour lier au refund Square.
      const { data: refundRpcId, error: refundErr } = await supabase.rpc("refund_payment", {
        p_provider: "square",
        p_event_id: `refund:${providerRefundId}`,
        p_original_payment_id: originalPayment.id,
        p_amount: refundAmount,
        p_external_reference: providerRefundId,
        p_reason: refund?.reason || "square_refund",
        p_provider_created_at: eventCreatedAt,
        p_context: { source: "square-webhook", webhook_event_id: eventId },
      });

      if (refundErr) {
        console.error("[square-webhook] refund_payment error:", refundErr);
        return json({ received: true, error: refundErr.message }, 200);
      }

      console.log(`[square-webhook] ✓ Refund ${providerRefundId} traité via refund_payment → ${refundRpcId}`);
    } else if (eventType === "dispute.created" || eventType === "dispute.state.changed") {
      const dispute = event.data?.object?.dispute;
      if (dispute) {
        await supabase.from("billing_system_alerts").insert({
          alert_type: "square_dispute",
          entity_type: "square_payment",
          entity_reference: dispute.disputed_payment?.payment_id || dispute.id,
          severity: "critical",
          details: {
            message: `Litige Square ${dispute.state} — ${(dispute.amount_money?.amount || 0) / 100} $ CAD`,
            dispute_id: dispute.id,
            state: dispute.state,
            reason: dispute.reason,
            due_at: dispute.due_at,
            amount_cents: dispute.amount_money?.amount,
            payment_id: dispute.disputed_payment?.payment_id,
            event_id: eventId,
          },
        });
      }
    }

    return json({ received: true, event_type: eventType });
  } catch (err: any) {
    console.error("[square-webhook] Fatal:", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
