/**
 * Field Sales — Quotes service.
 *
 * Quotes are saved BEFORE any order/invoice is created. They live in
 * `field_quotes` and can be re-opened via /commander?quote_id=...
 *
 * Sending the quote enqueues a Violet Bold "field_quote" email to the client
 * with a CTA to complete the order.
 */
import { supabase } from "@/integrations/supabase/client";
import type { FieldSaleDraft } from "@/field-app/lib/fieldSaleTypes";

export interface SaveQuotePayload {
  draft: FieldSaleDraft;
  agentName: string;
  activationFee: number;
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
  agentGps?: { lat: number; lng: number; accuracy: number } | null;
  /** When true, the `field_quote` email is NOT sent (used by the payment-link flow which sends its own email). */
  skipClientEmail?: boolean;
}

export interface SavedQuote {
  id: string;
  valid_until: string;
}

/**
 * Persists the current draft as a `field_quote` row and emails the client a
 * link to finish the order. Throws on failure.
 */
export async function saveQuoteAndEmail({
  draft,
  agentName,
  activationFee,
  subtotal,
  tps,
  tvq,
  total,
  agentGps,
  skipClientEmail,
}: SaveQuotePayload): Promise<SavedQuote> {
  const { data: userData } = await supabase.auth.getUser();
  const agentId = userData?.user?.id;
  if (!agentId) throw new Error("Agent non authentifié.");

  // 1) Insert the quote row.
  const { data: inserted, error: qErr } = await supabase
    .from("field_quotes")
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      client_info: draft.customer as any,
      services: draft.services as any,
      equipment: draft.equipment as any,
      discount: draft.discount as any,
      activation_fee: activationFee,
      subtotal,
      tps,
      tvq,
      total,
      status: "draft",
      agent_gps_coords: agentGps ?? null,
      install_date: draft.customer.install_date || null,
      install_mode: draft.customer.install_mode || "technician",
    } as any)
    .select("id, valid_until")
    .single();
  if (qErr || !inserted) throw qErr ?? new Error("Échec de la création de la soumission.");

  const quoteId = inserted.id as string;
  const validUntil = inserted.valid_until as string;

  // 2) Enqueue the Violet Bold "field_quote" email (best-effort).
  if (!skipClientEmail && draft.customer.email) {
    const summary = draft.services.map((s) => s.name).join(", ") || "Services Nivra";
    const validUntilLabel = new Date(validUntil).toLocaleDateString("fr-CA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const completeUrl = `${window.location.origin}/commander?quote_id=${quoteId}`;

    const { error: mailErr } = await supabase.from("email_queue").insert({
      event_key: `field_quote_${quoteId}`,
      to_email: draft.customer.email,
      template_key: "field_quote",
      template_vars: {
        client_name: draft.customer.first_name || "Client",
        first_name: draft.customer.first_name,
        agent_name: agentName,
        quote_id: quoteId,
        valid_until: validUntilLabel,
        total: total.toFixed(2),
        summary,
        complete_url: completeUrl,
        subject: "Votre soumission Nivra Telecom — Valide 30 jours",
      },
      status: "queued",
    } as any);

    if (mailErr) {
      // Non-fatal: quote is still saved. Caller can decide how to surface this.
      console.warn("[field_quote] email enqueue failed", mailErr);
    } else {
      await supabase
        .from("field_quotes")
        .update({ email_sent_at: new Date().toISOString(), status: "sent" } as any)
        .eq("id", quoteId);
    }
  }

  return { id: quoteId, valid_until: validUntil };
}

/**
 * Agent → Client secure Square payment link.
 * Calls the `field-payment-link-create` edge function which creates a
 * `field_payment_intents` row and emails the client the /payer/{id} URL.
 */
export interface PaymentLinkResult {
  intent_id: string;
  payment_url: string;
  expires_at: string;
  email_sent: boolean;
}

export async function sendPaymentLinkFromQuote(quoteId: string): Promise<PaymentLinkResult> {
  const { data, error } = await supabase.functions.invoke("field-payment-link-create", {
    body: { quote_id: quoteId, mode: "email" },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Échec de la création du lien de paiement.");
  return {
    intent_id: data.intent_id,
    payment_url: data.payment_url,
    expires_at: data.expires_at,
    email_sent: !!data.email_sent,
  };
}
