/**
 * paymentAutoNote — Shared helper for edge functions to write an automatic
 * system note to client_internal_notes + mirror to activity_logs whenever
 * a payment is confirmed on any channel.
 *
 * Fire-and-forget: never throws.
 */

import { writeAccountJournal } from "./writeAccountJournal.ts";

const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";
const SYSTEM_ACTOR_NAME = "Système Nivra";

export interface PaymentNoteParams {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  billingCustomerId?: string | null;
  clientAuthUserId?: string | null;
  amount: number | string | null | undefined;
  method: string | null | undefined;
  provider?: string | null;
  invoiceNumber?: string | null;
  invoiceId?: string | null;
  nivraReference?: string | null;
  paymentNumber?: string | null;
  channel: string;
  event?: "payment_confirmed" | "payment_recorded" | "payment_invalid";
}

// deno-lint-ignore no-explicit-any
function fmtMoney(n: any): string {
  const v = Number(n);
  return Number.isFinite(v) ? `${v.toFixed(2)} $` : "—";
}

function methodLabel(method?: string | null, provider?: string | null): string {
  const m = (method || "").toLowerCase();
  const base = m === "card" ? "Carte"
    : m === "paypal" ? "Carte"
    : m === "interac" ? "Interac"
    : m === "manual" ? "Manuel"
    : m === "internal" ? "Crédit promo"
    : (method || "—");
  const p = (provider || "").toLowerCase();
  const tag = p === "square" ? " (Square)" : p === "paypal" ? " (PayPal)" : m === "paypal" ? " (PayPal)" : "";
  return `${base}${tag}`;
}

export async function writePaymentAutoNote(params: PaymentNoteParams): Promise<void> {
  try {
    const {
      supabase, billingCustomerId, amount, method, provider,
      invoiceNumber, invoiceId, nivraReference, paymentNumber, channel,
      event = "payment_confirmed",
    } = params;

    let clientId = params.clientAuthUserId || null;
    if (!clientId && billingCustomerId) {
      const { data: bc } = await supabase
        .from("billing_customers")
        .select("user_id")
        .eq("id", billingCustomerId)
        .maybeSingle();
      clientId = bc?.user_id || null;
    }
    if (!clientId) {
      console.warn("[paymentAutoNote] no client auth id — skipping note", { billingCustomerId, invoiceId });
      return;
    }

    const label = event === "payment_invalid" ? "Paiement invalidé"
      : event === "payment_recorded" ? "Paiement enregistré"
      : "Paiement reçu";

    const parts = [
      label,
      fmtMoney(amount),
      methodLabel(method, provider),
      invoiceNumber ? `Facture #${invoiceNumber}` : null,
      nivraReference ? `Réf ${nivraReference}` : paymentNumber ? `Réf ${paymentNumber}` : null,
      channel ? `via ${channel}` : null,
    ].filter(Boolean);
    const body = parts.join(" — ");

    // Deterministic dedup anchor: invoice > payment number > client fallback
    const anchor = invoiceId || invoiceNumber || paymentNumber || `client-${clientId}`;
    const actor = { userId: SYSTEM_ACTOR_ID, role: "system_auto", name: SYSTEM_ACTOR_NAME };

    await writeAccountJournal(supabase, {
      targetTable: "client_internal_notes",
      eventKey: `paymentnote:${anchor}:${event}`,
      actor,
      payload: {
        client_id: clientId,
        note_type: "system",
        body,
      },
    });

    await writeAccountJournal(supabase, {
      targetTable: "activity_logs",
      eventKey: `paymentlog:${anchor}:${event}`,
      actor,
      payload: {
        action: event,
        entity_type: invoiceId ? "invoice" : "client",
        entity_id: invoiceId || clientId,
        details: {
          note: body,
          target_client_id: clientId,
          amount: Number(amount) || null,
          method,
          provider,
          invoice_number: invoiceNumber,
          nivra_reference: nivraReference,
          payment_number: paymentNumber,
          channel,
        },
      },
    });
  } catch (err: any) {
    console.warn("[paymentAutoNote] insert failed:", err?.message || err);
  }
}
