// ============================================================================
// square-charge-invoice — Charge Square + application via RPC canonique
// ============================================================================
// Phase 3.B.2 partie 2 :
//   - AUCUN INSERT direct dans billing_payments
//   - AUCUN UPDATE direct de billing_invoices (status, balance_due, amount_paid)
//   - AUCUN calcul local de taxes / subtotal / balance_due
//   - AUCUN traitement de crédit / promotion / rabais
//   - Tout paiement passe par la RPC canonique apply_payment_to_invoice
//   - Les échecs sont journalisés dans square_payment_attempts (aucun effet
//     de bord billing)
//   - Idempotence par idempotency_key + reference (Square payment id)
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureFieldCommissionAfterCapture } from "../_shared/ensureFieldCommission.ts";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_API = "https://connect.squareup.com/v2/payments";
const SQUARE_VERSION = "2024-11-20";

type JsonResponse = (body: object, status?: number) => Response;

async function ignoreFailure<T>(operation: PromiseLike<T>, label?: string): Promise<T | null> {
  try {
    return await operation;
  } catch (e) {
    if (label) console.warn(label, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json: JsonResponse = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase: any = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const {
      source_id,
      invoice_id,
      intent_id,
      customer_email: bodyEmail,
      source: bodySource,
      amount_cents: requestedAmountCents,
    } = body;
    const payerIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const paymentSource = bodySource === "public_pay" ? "public_pay" : "portal";

    if (!source_id) return json({ ok: false, error: "source_id requis" }, 400);
    if (!invoice_id && !intent_id) return json({ ok: false, error: "invoice_id ou intent_id requis" }, 400);

    const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const locationId = Deno.env.get("SQUARE_LOCATION_ID") || "LQW27N70DQ2N8";
    if (!accessToken) throw new Error("SQUARE_ACCESS_TOKEN non configuré");

    // ── Résolution facture / intent ────────────────────────────────────────
    let amountCents: number;
    let invoiceNumber = "";
    let customerId: string | null = null;
    let customerEmail: string | null = null;
    let customerName = "";
    let invoiceData: any = null;

    if (invoice_id) {
      const { data: inv, error: invErr } = await supabase
        .from("billing_invoices")
        .select(
          "id, invoice_number, balance_due, total, customer_id, order_id, status, " +
          "customer:billing_customers(email, first_name, last_name)",
        )
        .eq("id", invoice_id)
        .single();
      if (invErr || !inv) return json({ ok: false, error: "Facture introuvable" }, 404);

      const balance = Number(inv.balance_due);
      if (balance <= 0) return json({ ok: false, error: "Facture déjà payée" }, 400);

      const balanceCents = Math.round(balance * 100);
      if (typeof requestedAmountCents === "number" && requestedAmountCents > 0) {
        if (requestedAmountCents < 100) return json({ ok: false, error: "Montant minimum 1,00 $" }, 400);
        if (requestedAmountCents > balanceCents * 3) return json({ ok: false, error: "Montant trop élevé (max 3× le solde dû)" }, 400);
        amountCents = requestedAmountCents;
      } else {
        amountCents = balanceCents;
      }

      invoiceNumber = inv.invoice_number || "";
      customerId = inv.customer_id;
      customerEmail = (inv.customer as any)?.email || bodyEmail || null;
      customerName = `${(inv.customer as any)?.first_name || ""} ${(inv.customer as any)?.last_name || ""}`.trim();
      invoiceData = inv;
    } else {
      // Field payment intent flow
      const { data: lockRows } = await supabase.rpc("field_intent_lock_for_payment", { p_intent_id: intent_id });
      const lock = Array.isArray(lockRows) ? (lockRows[0] as any) : (lockRows as any);
      if (!lock?.locked) {
        const status = lock?.current_status || "unknown";
        if (status === "completed" || status === "paid") return json({ ok: false, error: "Cette commande a déjà été payée.", already_paid: true }, 409);
        if (status === "cancelled") return json({ ok: false, error: "Cette commande a été annulée.", cancelled: true }, 409);
        if (status === "processing") return json({ ok: false, error: "Un paiement est déjà en cours pour cette commande.", in_progress: true }, 409);
        return json({ ok: false, error: "Ce lien n'est plus valide ou a expiré." }, 409);
      }

      const { data: intent } = await supabase
        .from("field_payment_intents")
        .select("id, amount, status, customer_name, customer_email, converted_invoice_id, public_token, quote_id, agent_id")
        .eq("id", intent_id).single();

      if (!intent) {
        await ignoreFailure(supabase.rpc("field_intent_release_lock", { p_intent_id: intent_id }));
        return json({ ok: false, error: "Intention de paiement introuvable" }, 404);
      }

      amountCents = Math.round(Number(intent.amount) * 100);
      customerName = intent.customer_name || "";
      customerEmail = intent.customer_email || null;

      if (intent.converted_invoice_id) {
        const { data: inv } = await supabase
          .from("billing_invoices")
          .select("id, invoice_number, balance_due, total, customer_id, order_id, status, customer:billing_customers(email, first_name, last_name)")
          .eq("id", intent.converted_invoice_id).single();
        if (inv && Number(inv.balance_due) > 0) {
          invoiceData = inv;
          amountCents = Math.round(Number(inv.balance_due) * 100);
          invoiceNumber = inv.invoice_number || "";
          customerId = inv.customer_id;
          if (!customerEmail) customerEmail = (inv.customer as any)?.email || null;
          if (!customerName) customerName = `${(inv.customer as any)?.first_name || ""} ${(inv.customer as any)?.last_name || ""}`.trim();
        } else {
          invoiceNumber = `INV-${intent.converted_invoice_id.slice(0, 8).toUpperCase()}`;
        }
      } else {
        invoiceNumber = `CMD-${intent_id.slice(0, 8).toUpperCase()}`;
      }
    }

    // ── Idempotency key stable par (invoice|intent, amount) ─────────────
    const idempotencyKey = `sq_${invoice_id || intent_id}_${amountCents}`;

    // Duplicate guard: si une tentative avec cette clé a déjà réussi, retour immédiat
    const { data: existingAttempt } = await supabase
      .from("square_payment_attempts")
      .select("id, status, square_payment_id, response_raw")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingAttempt?.status === "success" && existingAttempt.square_payment_id) {
      return json({
        ok: true,
        already_processed: true,
        square_payment_id: existingAttempt.square_payment_id,
        message: "Paiement déjà appliqué (idempotence)",
      });
    }

    // ── Charge Square ────────────────────────────────────────────────────
    const note = [
      invoiceNumber ? `Facture #${invoiceNumber}` : null,
      customerName ? `Client: ${customerName}` : null,
      customerEmail ? `${customerEmail}` : null,
    ].filter(Boolean).join(" | ");

    const squareRes = await fetch(SQUARE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_VERSION,
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        source_id,
        amount_money: { amount: amountCents, currency: "CAD" },
        location_id: locationId,
        note,
        reference_id: invoiceNumber || (intent_id || "").slice(0, 40),
      }),
    });

    const squareData = await squareRes.json();

    if (!squareRes.ok || squareData.errors) {
      // ── ÉCHEC : log dans square_payment_attempts, AUCUNE écriture billing ─
      const sqErr = squareData.errors?.[0] || {};
      const code = sqErr.code || "UNKNOWN_ERROR";
      const detail = sqErr.detail || "";
      const category = sqErr.category || "";

      await ignoreFailure(supabase.from("square_payment_attempts").insert({
        invoice_id: invoiceData?.id ?? null,
        customer_id: customerId,
        amount: amountCents / 100,
        idempotency_key: idempotencyKey,
        square_error_code: code,
        square_error_detail: detail,
        square_error_category: category,
        status: "failed",
        response_raw: squareData,
      }));

      if (intent_id) {
        await ignoreFailure(supabase.rpc("field_intent_release_lock", { p_intent_id: intent_id }));
        await ignoreFailure(supabase.rpc("log_field_order_event", {
          p_intent_id: intent_id, p_event_type: "payment_failed",
          p_payload: { code, detail, category },
        }));
      }

      console.error("[square-charge-invoice] Square error:", JSON.stringify(squareData.errors));
      return json({
        ok: false,
        error: detail ? `Paiement refusé par Square : ${code} — ${detail}` : `Paiement refusé par Square : ${code}`,
        square_error_code: code,
        square_error_detail: detail,
        square_error_category: category,
      }, 402);
    }

    const payment = squareData.payment;
    const paymentId: string = payment.id;
    const receiptUrl: string | null = payment.receipt_url || null;
    const amountPaid = Number(payment.amount_money?.amount || 0) / 100;

    console.log("[square-charge-invoice] Charged:", paymentId, "CAD", amountPaid);

    // ── SUCCÈS : application via RPC canonique ─────────────────────────────
    let canonicalPaymentId: string | null = null;
    if (invoiceData) {
      // Idempotence stricte : si un billing_payment existe déjà avec cette référence Square, skip
      const { data: existingPayment } = await supabase
        .from("billing_payments")
        .select("id")
        .eq("reference", paymentId)
        .maybeSingle();

      if (existingPayment?.id) {
        canonicalPaymentId = existingPayment.id;
        console.log("[square-charge-invoice] Payment already applied (billing_payments.reference match):", paymentId);
      } else {
        const { data: rpcId, error: rpcErr } = await supabase.rpc("apply_payment_to_invoice", {
          p_invoice_id: invoiceData.id,
          p_amount: amountPaid,
          p_method: "card",
          p_provider: "square",
          p_external_reference: paymentId,
          p_source: paymentSource,
          p_context: {
            square_payment_id: paymentId,
            square_receipt_url: receiptUrl,
            idempotency_key: idempotencyKey,
            payer_ip: paymentSource === "public_pay" ? payerIp : null,
            invoice_number: invoiceNumber,
          },
        });

        if (rpcErr) {
          // Le paiement Square est effectué mais l'application canonique a échoué.
          // Journaliser comme "success" côté Square + alerte système. AUCUNE écriture
          // directe sur billing_invoices : la reconciliation devra rejouer la RPC.
          console.error("[square-charge-invoice] RPC apply_payment_to_invoice failed:", rpcErr.message);
          await ignoreFailure(supabase.from("square_payment_attempts").insert({
            invoice_id: invoiceData.id,
            customer_id: customerId,
            amount: amountPaid,
            idempotency_key: idempotencyKey,
            square_payment_id: paymentId,
            status: "success",
            response_raw: { payment, rpc_error: rpcErr.message },
          }));
          await ignoreFailure(supabase.from("billing_system_alerts").insert({
            alert_type: "square_rpc_apply_failed",
            entity_type: "billing_invoice",
            entity_id: invoiceData.id,
            entity_reference: paymentId,
            details: { error: rpcErr.message, payment_id: paymentId, amount: amountPaid },
          }));
          return json({
            ok: false,
            error: "Paiement débité mais application canonique échouée. Conservez ce numéro Square.",
            square_payment_id: paymentId,
            receipt_url: receiptUrl,
          }, 500);
        }
        canonicalPaymentId = rpcId as string;
      }
    }

    // ── Log tentative réussie ──────────────────────────────────────────────
    await ignoreFailure(supabase.from("square_payment_attempts").insert({
      invoice_id: invoiceData?.id ?? null,
      customer_id: customerId,
      amount: amountPaid,
      idempotency_key: idempotencyKey,
      square_payment_id: paymentId,
      status: "success",
      response_raw: payment,
    }));

    if (intent_id) {
      await ignoreFailure(supabase.rpc("log_field_order_event", {
        p_intent_id: intent_id, p_event_type: "payment_succeeded",
        p_payload: { square_payment_id: paymentId, amount: amountPaid },
      }));

      await supabase.from("field_payment_intents")
        .update({ status: "completed", paid_at: new Date().toISOString() })
        .eq("id", intent_id);

      // Shell order flip → paid (ORDER, pas invoice)
      try {
        const { data: intentShell } = await supabase
          .from("field_payment_intents")
          .select("converted_order_id, converted_field_order_id, quote_id, agent_id, converted_invoice_id")
          .eq("id", intent_id).maybeSingle();

        if (intentShell?.converted_order_id) {
          await supabase.from("orders").update({
            payment_status: "paid", status: "validated",
            updated_at: new Date().toISOString(),
          }).eq("id", intentShell.converted_order_id);

          if (intentShell.converted_field_order_id) {
            await supabase.from("field_sales_orders").update({
              payment_status: "confirmed", payment_reference: paymentId,
              updated_at: new Date().toISOString(),
            }).eq("id", intentShell.converted_field_order_id);

            // F31-6 — re-invoke field-sales-sync to create field_commissions now that
            // payment is captured. Idempotent (existing-row check inside sync).
            await supabase.functions.invoke("field-sales-sync", {
              body: { action: "sync_single", sale_id: intentShell.converted_field_order_id },
            }).catch((e) => console.warn("[square-charge-invoice] F31-6 post-capture sync failed:", e));

            // F31-6 safety net — call the canonical helper directly so the
            // commission is guaranteed even if field-sales-sync short-circuits
            // (e.g. already fully synced) or fails transiently.
            const ensured = await ensureFieldCommissionAfterCapture(supabase, {
              sale_id: intentShell.converted_field_order_id,
              reason: "square-charge-invoice:post-capture",
              square_payment_id: paymentId ?? null,
            });
            console.log(`[square-charge-invoice] F31-6 ensureFieldCommission → ${ensured.status}`);
          }

          await supabase.functions.invoke("send-order-confirmation", {
            body: { order_id: intentShell.converted_order_id },
          }).catch((e) => console.warn("[square-charge-invoice] send-order-confirmation failed:", e));
        }

        // Materialize field order from quote
        if (intentShell?.quote_id && !intentShell.converted_field_order_id && !intentShell.converted_invoice_id) {
          await supabase.functions.invoke("field-sales-sync", {
            body: {
              action: "materialize_from_quote",
              quote_id: intentShell.quote_id,
              agent_id: intentShell.agent_id,
              payment_method: "square",
              payment_reference: paymentId,
            },
          }).catch((e) => console.error("[square-charge-invoice] materialize failed:", e));
        }
      } catch (e) {
        console.warn("[square-charge-invoice] shell flip failed:", e);
      }

      // Public payment link sync
      try {
        const { data: intentForLink } = await supabase
          .from("field_payment_intents").select("public_token").eq("id", intent_id).maybeSingle();
        if (intentForLink?.public_token) {
          await supabase.from("public_payment_links").update({
            status: "paid", paid_at: new Date().toISOString(), amount_paid: amountPaid,
          }).eq("token", intentForLink.public_token);
        }
      } catch (e) {
        console.warn("[square-charge-invoice] public link sync failed:", e);
      }
    }

    // ── Email de confirmation ──────────────────────────────────────────────
    if (customerEmail) {
      try {
        // Résoudre le numéro de commande lisible (évite « Commande # » vide)
        let orderNumber = "";
        if (invoiceData?.order_id) {
          try {
            const { data: ord } = await supabase
              .from("orders")
              .select("order_number")
              .eq("id", invoiceData.order_id)
              .maybeSingle();
            orderNumber = ord?.order_number || "";
          } catch { /* ignore */ }
        }

        let pdf: any = null;
        if (invoiceData?.id) {
          try {
            const { buildReceiptPdfAttachment } = await import("../_shared/pdfFromDb.ts");
            pdf = await buildReceiptPdfAttachment(invoiceData.id, "recu-paiement").catch(() => null);
          } catch { /* ignore */ }
        }
        await enqueueCommunication(supabase, {
          channel: "email",
          templateKey: "payment_receipt",
          recipient: customerEmail,
          idempotencyKey: `square_payment_${paymentId}`,
          templateVars: {
            client_name: customerName || "Client",
            first_name: (customerName || "Client").split(" ")[0],
            amount: amountPaid.toFixed(2),
            amount_paid_today: amountPaid.toFixed(2),
            total_payable: invoiceData ? Number(invoiceData.total).toFixed(2) : amountPaid.toFixed(2),
            invoice_id: invoiceData?.id,
            invoice_number: invoiceNumber,
            order_number: orderNumber || invoiceNumber, // fallback: réutilise le nº de facture si pas de commande liée
            payment_method: "Carte de crédit (Square)",
            reference: paymentId,
            square_payment_id: paymentId,
            receipt_url: receiptUrl,
            payment_date: new Date().toISOString(),
          },
          attachments: pdf ? [pdf] : null,
        });
      } catch (e) {
        console.warn("[square-charge-invoice] email queue failed:", e);
      }
    }

    // ── Notification Nivra Core (mark-paid) ─────────────────────────────────
    // Le frontend PayPal appelait déjà notifyNivraCorePaid ; pour Square, le
    // paiement est serveur-side donc aucune notification n'était envoyée à Core.
    try {
      const coreUrl = Deno.env.get("NIVRA_CORE_URL") || "https://telecom-zen-hub-b5f9c7c4.proud-band-c162.workers.dev";
      const payload = {
        paymentNumber: canonicalPaymentId || paymentId,
        paypalOrderId: "",           // n/a pour Square
        paypalCaptureId: "",         // n/a pour Square
        provider: "square",
        squarePaymentId: paymentId,
        invoiceId: invoiceData?.id ?? null,
        invoiceNumber: invoiceNumber || null,
        amount: amountPaid,
        currency: "CAD",
        receiptUrl: receiptUrl || null,
      };
      const r = await fetch(`${coreUrl}/payments/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        console.error(`[square-charge-invoice] Nivra Core mark-paid ${r.status}:`, t.slice(0, 300));
      } else {
        console.log("[square-charge-invoice] Nivra Core mark-paid OK for", paymentId);
      }
    } catch (e) {
      console.warn("[square-charge-invoice] Nivra Core notification failed:", e);
    }

    return json({
      ok: true,
      payment_id: canonicalPaymentId,
      square_payment_id: paymentId,
      square_status: payment.status ?? "COMPLETED",
      receipt_url: receiptUrl,
      amount: amountPaid,
      rpc_used: "apply_payment_to_invoice",
      message: `Paiement approuvé par Square (${payment.status ?? "COMPLETED"}) — Référence Square : ${paymentId}`,
    });
  } catch (err: any) {
    if (intent_id) {
      await ignoreFailure(supabase.rpc("field_intent_release_lock", { p_intent_id: intent_id }), "[square-charge-invoice] lock release after fatal failed");
    }
    console.error("[square-charge-invoice] Fatal:", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});
