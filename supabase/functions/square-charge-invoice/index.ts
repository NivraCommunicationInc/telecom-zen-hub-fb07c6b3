import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_API = "https://connect.squareup.com/v2/payments";
const SQUARE_VERSION = "2024-06-04";

type JsonResponse = (body: object, status?: number) => Response;

async function applySquarePaymentDirectly(params: {
  supabase: ReturnType<typeof createClient>;
  invoiceData: any;
  customerId: string | null;
  amountPaid: number;
  paymentId: string;
  receiptUrl: string | null;
  source?: string;
  payerIp?: string | null;
}) {
  const { supabase, invoiceData, customerId, amountPaid, paymentId, receiptUrl, source, payerIp } = params;
  const now = new Date().toISOString();

  const { data: existingPayment, error: existingErr } = await supabase
    .from("billing_payments")
    .select("id, amount, status, provider_payment_id, square_payment_id")
    .or(`provider_payment_id.eq.${paymentId},square_payment_id.eq.${paymentId}`)
    .maybeSingle();

  if (existingErr) {
    throw new Error(`Vérification paiement existant échouée: ${existingErr.message}`);
  }

  let paymentRowId = existingPayment?.id ?? null;
  let alreadyProcessed = !!existingPayment;

  if (!existingPayment) {
    const { data: insertedPayment, error: paymentErr } = await supabase
      .from("billing_payments")
      .insert({
        invoice_id: invoiceData.id,
        customer_id: customerId || invoiceData.customer_id,
        method: "card",
        amount: amountPaid,
        status: "confirmed",
        provider: "square",
        provider_payment_id: paymentId,
        square_payment_id: paymentId,
        square_receipt_url: receiptUrl,
        source: source || "portal",
        payer_ip: payerIp || null,
        created_by_name: "Square Payment",
        created_by_role: "system",
        received_at: now,
      })
      .select("id")
      .single();

    if (paymentErr || !insertedPayment?.id) {
      throw new Error(`Insertion paiement échouée: ${paymentErr?.message || "aucune ligne créée"}`);
    }
    paymentRowId = insertedPayment.id;
  }

  const { data: totals, error: totalErr } = await supabase
    .from("billing_payments")
    .select("amount")
    .eq("invoice_id", invoiceData.id)
    .eq("status", "confirmed");

  if (totalErr) throw new Error(`Lecture total paiements échouée: ${totalErr.message}`);

  const confirmedPaid = (totals || []).reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0);
  const invoiceTotal = Number(invoiceData.total) || 0;
  const newAmountPaid = Math.round(confirmedPaid * 100) / 100;
  const newBalanceDue = Math.max(0, Math.round((invoiceTotal - newAmountPaid) * 100) / 100);
  const newStatus = newBalanceDue <= 0 ? "paid" : newAmountPaid > 0 ? "partially_paid" : invoiceData.status;

  const { data: updatedInvoice, error: updateErr } = await supabase
    .from("billing_invoices")
    .update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      status: newStatus,
      paid_at: newStatus === "paid" ? now : invoiceData.paid_at || null,
      payment_method: "card",
      billing_snapshot_payment: newStatus === "paid"
        ? {
            method: "card",
            provider: "square",
            provider_payment_id: paymentId,
            square_payment_id: paymentId,
            paid_at: now,
            amount: amountPaid,
          }
        : invoiceData.billing_snapshot_payment || null,
    })
    .eq("id", invoiceData.id)
    .select("id, status, amount_paid, balance_due, paid_at")
    .single();

  if (updateErr || !updatedInvoice?.id) {
    throw new Error(`Mise à jour facture échouée: ${updateErr?.message || "aucune ligne mise à jour"}`);
  }

  const verifiedAmountPaid = Number(updatedInvoice.amount_paid) || 0;
  const verifiedBalanceDue = Number(updatedInvoice.balance_due) || 0;
  const expectedPaid = newStatus === "paid";
  const invoiceMatches =
    Math.abs(verifiedAmountPaid - newAmountPaid) < 0.01 &&
    Math.abs(verifiedBalanceDue - newBalanceDue) < 0.01 &&
    (!expectedPaid || updatedInvoice.status === "paid");

  if (!invoiceMatches) {
    throw new Error(
      `Vérification facture échouée: status=${updatedInvoice.status}, amount_paid=${updatedInvoice.amount_paid}, balance_due=${updatedInvoice.balance_due}`,
    );
  }

  return {
    alreadyProcessed,
    paymentRowId,
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    invoiceStatus: updatedInvoice.status,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json: JsonResponse = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { source_id, invoice_id, intent_id, customer_email: bodyEmail, source: bodySource, amount_cents: requestedAmountCents } = body;
    const payerIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const paymentSource = bodySource === "public_pay" ? "public_pay" : "portal";

    if (!source_id) return json({ ok: false, error: "source_id requis" }, 400);
    if (!invoice_id && !intent_id) return json({ ok: false, error: "invoice_id ou intent_id requis" }, 400);

    const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const locationId = Deno.env.get("SQUARE_LOCATION_ID") || "LQW27N70DQ2N8";
    if (!accessToken) throw new Error("SQUARE_ACCESS_TOKEN non configuré");

    // ── Resolve amount + metadata ────────────────────────────────────────
    let amountCents: number;
    let invoiceNumber = "";
    let customerId: string | null = null;
    let customerEmail: string | null = null;
    let customerName = "";
    let invoiceData: any = null;
    let isOverpayment = false;
    let overpaymentAmount = 0;

    if (invoice_id) {
      console.log("[square-charge-invoice] Looking up invoice_id:", invoice_id);
      const { data: inv, error: invErr } = await supabase
        .from("billing_invoices")
        .select(
          "id, invoice_number, balance_due, total, customer_id, order_id, status, paid_at, billing_snapshot_payment, " +
          "customer:billing_customers(email, first_name, last_name)",
        )
        .eq("id", invoice_id)
        .single();

      console.log("[square-charge-invoice] DB result:", { found: !!inv, err: invErr?.message, inv_num: inv?.invoice_number });
      if (invErr || !inv) return json({ ok: false, error: "Facture introuvable" }, 404);

      const balance = Number(inv.balance_due);
      if (balance <= 0) return json({ ok: false, error: "Facture déjà payée" }, 400);

      // ── CUSTOM AMOUNT (public pay only) ─────────────────────────────────
      // Trois cas :
      //   1. amount_cents < balance*100 → paiement partiel (status devient partially_paid)
      //   2. amount_cents == balance*100 (ou absent) → paiement exact (status devient paid)
      //   3. amount_cents > balance*100 → surpaiement, excédent noté comme crédit
      const balanceCents = Math.round(balance * 100);
      if (typeof requestedAmountCents === "number" && requestedAmountCents > 0) {
        if (requestedAmountCents < 100) return json({ ok: false, error: "Montant minimum 1,00 $" }, 400);
        if (requestedAmountCents > balanceCents * 3) return json({ ok: false, error: "Montant trop élevé (max 3× le solde dû)" }, 400);
        amountCents = requestedAmountCents;
        if (requestedAmountCents > balanceCents) {
          isOverpayment = true;
          overpaymentAmount = (requestedAmountCents - balanceCents) / 100;
        }
      } else {
        amountCents = balanceCents;
      }

      invoiceNumber = inv.invoice_number || "";
      customerId = inv.customer_id;
      customerEmail = (inv.customer as any)?.email || bodyEmail || null;
      customerName = `${(inv.customer as any)?.first_name || ""} ${(inv.customer as any)?.last_name || ""}`.trim();
      invoiceData = inv;


    } else {
      // Field payment intent flow — atomic concurrency lock (pending -> processing)
      const { data: lockRows } = await supabase.rpc(
        "field_intent_lock_for_payment" as never,
        { p_intent_id: intent_id },
      );
      const lock = Array.isArray(lockRows) ? (lockRows[0] as any) : (lockRows as any);
      if (!lock?.locked) {
        const status = lock?.current_status || "unknown";
        if (status === "completed" || status === "paid") {
          return json({ ok: false, error: "Cette commande a déjà été payée.", already_paid: true }, 409);
        }
        if (status === "cancelled") {
          return json({ ok: false, error: "Cette commande a été annulée.", cancelled: true }, 409);
        }
        if (status === "processing") {
          return json({ ok: false, error: "Un paiement est déjà en cours pour cette commande. Réessayez dans quelques secondes.", in_progress: true }, 409);
        }
        return json({ ok: false, error: "Ce lien n'est plus valide ou a expiré." }, 409);
      }

      const { data: intent } = await supabase
        .from("field_payment_intents")
        .select("id, amount, status, customer_name, customer_email, converted_invoice_id, public_token, description, quote_id, agent_id")
        .eq("id", intent_id)
        .single();

      if (!intent) {
        await supabase.rpc("field_intent_release_lock" as never, { p_intent_id: intent_id });
        return json({ ok: false, error: "Intention de paiement introuvable" }, 404);
      }

      // Journal — payment_attempted
      await supabase.rpc("log_field_order_event" as never, {
        p_intent_id: intent_id,
        p_event_type: "payment_attempted",
        p_payload: { amount: intent.amount } as never,
      }).then(undefined, () => {});


      amountCents = Math.round(Number(intent.amount) * 100);
      customerName = intent.customer_name || "";
      customerEmail = intent.customer_email || null;

      if (intent.converted_invoice_id) {
        // Intent is linked to an existing invoice — load it for proper payment application
        const { data: inv } = await supabase
          .from("billing_invoices")
          .select(
            "id, invoice_number, balance_due, total, customer_id, order_id, status, paid_at, billing_snapshot_payment, " +
            "customer:billing_customers(email, first_name, last_name)",
          )
          .eq("id", intent.converted_invoice_id)
          .single();

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


    // ── Charge Square ────────────────────────────────────────────────────
    const note = [
      invoiceNumber ? `Facture #${invoiceNumber}` : null,
      customerName ? `Client: ${customerName}` : null,
      customerEmail ? `${customerEmail}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const squareRes = await fetch(SQUARE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": SQUARE_VERSION,
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        source_id,
        amount_money: { amount: amountCents, currency: "CAD" },
        location_id: locationId,
        note,
        reference_id: invoiceNumber || (intent_id || "").slice(0, 40),
      }),
    });

    const squareData = await squareRes.json();

    if (!squareRes.ok || squareData.errors) {
      // Retourne EXACTEMENT ce que Square dit — aucune traduction, aucune modification.
      // Aucune écriture DB, aucune facture marquée payée, aucun email envoyé.
      const sqErr = squareData.errors?.[0] || {};
      const code: string = sqErr.code || "UNKNOWN_ERROR";
      const detail: string = sqErr.detail || "";
      const category: string = sqErr.category || "";
      const errMsg = detail
        ? `Paiement refusé par Square : ${code} — ${detail}`
        : `Paiement refusé par Square : ${code}`;
      console.error("[square-charge-invoice] Square error:", JSON.stringify(squareData.errors));
      return json({
        ok: false,
        error: errMsg,
        square_error_code: code,
        square_error_detail: detail,
        square_error_category: category,
        square_errors: squareData.errors ?? null,
      }, 402);
    }

    const payment = squareData.payment;
    const paymentId: string = payment.id;
    const receiptUrl: string | null = payment.receipt_url || null;
    const amountPaid = Number(payment.amount_money?.amount || 0) / 100;

    console.log("[square-charge-invoice] Charged:", paymentId, "CAD", amountPaid);

    // ── Apply to invoice directly, no RPC ─────────────────────────────────
    if (invoiceData) {
      let applied;
      try {
        applied = await applySquarePaymentDirectly({ supabase, invoiceData, customerId, amountPaid, paymentId, receiptUrl, source: paymentSource, payerIp: paymentSource === "public_pay" ? payerIp : null });
      } catch (dbErr: any) {
        console.error("[square-charge-invoice] Direct DB payment application failed:", dbErr?.message || dbErr);
        void supabase.from("billing_system_alerts").insert({
          alert_type: "square_charge_db_update_failed",
          entity_type: "billing_invoice",
          entity_id: invoiceData.id,
          entity_reference: paymentId,
          details: {
            error: dbErr?.message || String(dbErr),
            payment_id: paymentId,
            amount: amountPaid,
          },
        }).then(undefined, () => {});

        return json({
          ok: false,
          error: "Paiement débité mais mise à jour de la base de données échouée. Conservez ce numéro de confirmation Square.",
          square_payment_id: paymentId,
          receipt_url: receiptUrl,
        }, 500);
      }

      const alreadyProcessed = applied.alreadyProcessed;
      console.log("[square-charge-invoice] Direct DB update verified:", {
        invoice_id: invoiceData.id,
        payment_row_id: applied.paymentRowId,
        invoice_status: applied.invoiceStatus,
        balance_due: applied.balanceDue,
      });

      // Queue confirmation email (non-blocking) — PDF is optional; email goes out regardless
      if (customerEmail && !alreadyProcessed) {
        let pdf: any = null;
        try {
          const { buildReceiptPdfAttachment } = await import("../_shared/pdfFromDb.ts");
          pdf = await buildReceiptPdfAttachment(invoiceData.id, "recu-paiement");
        } catch (pdfErr) {
          console.warn("[square-charge-invoice] PDF generation skipped:", pdfErr);
        }

        try {
          await supabase.from("email_queue").insert({
            event_key: `square_payment_${paymentId}`,
            to_email: customerEmail,
            template_key: "payment_receipt",
            template_vars: {
              client_name: customerName || "Client",
              first_name: (customerName || "Client").split(" ")[0],
              amount: amountPaid.toFixed(2),
              amount_paid_today: amountPaid.toFixed(2),
              total_payable: Number(invoiceData.total).toFixed(2),
              invoice_id: invoiceData.id,
              order_id: invoiceData.order_id || undefined,
              invoice_number: invoiceNumber,
              payment_method: "Carte de crédit (Square)",
              reference: paymentId,
              square_payment_id: paymentId,
              square_reference: paymentId,
              receipt_url: receiptUrl || null,
              payment_date: new Date().toISOString(),
            },
            attachments: pdf ? [pdf] : null,
            status: "queued",
            attempts: 0,
            max_attempts: 5,
          });
          console.log("[square-charge-invoice] Email queued for:", customerEmail);
        } catch (emailErr) {
          console.warn("[square-charge-invoice] Email queue insert failed:", emailErr);
        }
      } else {
        console.warn("[square-charge-invoice] Email skipped — customerEmail:", customerEmail, "already_processed:", alreadyProcessed);
      }

      // Auto-note: payment received — visible dans tous les portails (Core, OneView CS, Employee)
      if (customerId && !alreadyProcessed) {
        try {
          // Résoudre le profil client (client_internal_notes.client_id = profiles.id / auth user id)
          const { data: bc } = await supabase
            .from("billing_customers")
            .select("user_id")
            .eq("id", customerId)
            .single();

          const profileId = bc?.user_id;
          if (profileId) {
            // Optionnel: rattacher à un compte si l'un des services de la facture pointe vers un account_id
            let accountId: string | null = null;
            try {
              const { data: acc } = await supabase
                .from("accounts")
                .select("id")
                .eq("client_id", profileId)
                .limit(1)
                .maybeSingle();
              accountId = acc?.id ?? null;
            } catch { /* ignore */ }

            const sourceLabel = paymentSource === "public_pay" ? " — Source : page publique /payer" : "";
            const overLabel = isOverpayment
              ? ` — Crédit — surpaiement page publique ${overpaymentAmount.toFixed(2)} $ (à créditer manuellement au dossier)`
              : "";
            const body = `Paiement Square reçu — ${amountPaid.toFixed(2)} $ — Facture #${invoiceNumber || invoiceData.id} — Référence Square : ${paymentId}${sourceLabel}${overLabel}`;


            const { error: noteErr } = await supabase.from("client_internal_notes").insert({
              client_id: profileId,
              account_id: accountId,
              note_type: "system",
              body,
              created_by_user_id: "00000000-0000-0000-0000-000000000000", // remplacé par trigger normalize_...system_auto
              created_by_role: "system_auto",
              created_by_name: "Système Nivra",
            });
            if (noteErr) console.warn("[square-charge-invoice] Auto-note insert error:", noteErr.message);
            else console.log("[square-charge-invoice] Auto-note created for profile:", profileId);
          } else {
            console.warn("[square-charge-invoice] Auto-note skipped — billing_customers.user_id missing for", customerId);
          }
        } catch (noteErr: any) {
          console.warn("[square-charge-invoice] Auto-note block failed:", noteErr?.message || noteErr);
        }
      }
    }

    // Email for intent_id-only flow (no invoiceData) — Correction 2
    if (!invoiceData && customerEmail && intent_id) {
      try {
        await supabase.from("email_queue").insert({
          event_key: `square_payment_${paymentId}`,
          to_email: customerEmail,
          template_key: "payment_receipt",
          template_vars: {
            client_name: customerName || "Client",
            first_name: (customerName || "Client").split(" ")[0],
            amount: amountPaid.toFixed(2),
            amount_paid_today: amountPaid.toFixed(2),
            invoice_number: invoiceNumber || `CMD-${intent_id.slice(0, 8).toUpperCase()}`,
            payment_method: "Carte de crédit (Square)",
            reference: paymentId,
            square_payment_id: paymentId,
            square_reference: paymentId,
            receipt_url: receiptUrl || null,
            payment_date: new Date().toISOString(),
          },
          attachments: null,
          status: "queued",
          attempts: 0,
          max_attempts: 5,
        });
      } catch (emailErr) {
        console.warn("[square-charge-invoice] Intent email queue insert failed:", emailErr);
      }
    }

    // ── Field intent: mark completed ─────────────────────────────────────
    if (intent_id) {
      await supabase
        .from("field_payment_intents")
        .update({ status: "completed", paid_at: new Date().toISOString() })
        .eq("id", intent_id);

      try {
        const { data: intentForLink } = await supabase
          .from("field_payment_intents")
          .select("public_token")
          .eq("id", intent_id)
          .maybeSingle();

        if (intentForLink?.public_token) {
          const { data: link } = await supabase
            .from("public_payment_links")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              amount_paid: amountPaid,
            })
            .eq("token", intentForLink.public_token)
            .select("id, invoice_id, customer_id, nivra_reference, amount_due, description, recipient_name, recipient_email")
            .maybeSingle();

          if (link && !invoiceData) {
            const { data: existing } = await supabase
              .from("billing_payments")
              .select("id")
              .eq("square_payment_id", paymentId)
              .maybeSingle();

            if (!existing?.id) {
              await supabase.from("billing_payments").insert({
                invoice_id: link.invoice_id || null,
                customer_id: link.customer_id || null,
                method: "card",
                amount: amountPaid,
                status: "confirmed",
                provider: "square",
                provider_payment_id: paymentId,
                square_payment_id: paymentId,
                square_receipt_url: receiptUrl,
                source: "public_pay",
                payer_ip: payerIp,
                nivra_reference: link.nivra_reference,
                reference: link.nivra_reference,
                created_by_name: "Square Payment",
                created_by_role: "system",
                received_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (linkSyncErr) {
        console.warn("[square-charge-invoice] public payment link sync failed:", linkSyncErr);
      }

      // ── Agent → client link: materialize field sale + credit commission ──
      // If this intent came from a field_quote (agent-prepared order) and no
      // invoice has been created yet, invoke field-sales-sync to build the
      // field_sales_orders row with the original agent_id preserved. This
      // triggers automatic commission attribution + installation workflow.
      try {
        const { data: intentPost } = await supabase
          .from("field_payment_intents")
          .select("quote_id, agent_id, converted_invoice_id, converted_field_order_id")
          .eq("id", intent_id)
          .maybeSingle();

        if (
          intentPost?.quote_id &&
          !intentPost.converted_field_order_id &&
          !intentPost.converted_invoice_id
        ) {
          console.log(
            "[square-charge-invoice] materializing field order for quote",
            intentPost.quote_id,
            "agent",
            intentPost.agent_id,
          );
          const { error: matErr } = await supabase.functions.invoke("field-sales-sync", {
            body: {
              action: "materialize_from_quote",
              quote_id: intentPost.quote_id,
              agent_id: intentPost.agent_id,
              payment_method: "square",
              payment_reference: paymentId,
              paypal_capture_id: paymentId, // legacy field name (kept for backward compat)
              paypal_amount: amountPaid,
            },
          });
          if (matErr) {
            console.error(
              "[square-charge-invoice] materialize_from_quote failed (payment kept):",
              matErr,
            );
          }
        }
      } catch (matEx) {
        console.error(
          "[square-charge-invoice] materialize invoke exception (non-fatal):",
          matEx,
        );
      }
    }


    return json({
      ok: true,
      payment_id: paymentId,
      square_payment_id: paymentId,
      square_status: payment.status ?? "COMPLETED",
      receipt_url: receiptUrl,
      amount: amountPaid,
      message: `Paiement approuvé par Square (${payment.status ?? "COMPLETED"}) — Référence Square : ${paymentId}`,
    });
  } catch (err: any) {
    console.error("[square-charge-invoice] Fatal:", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});
