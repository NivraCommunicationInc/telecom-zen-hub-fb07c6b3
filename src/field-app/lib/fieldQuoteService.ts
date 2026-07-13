/**
 * Field Sales — Quotes service (Module 31 hardened).
 *
 * As of Module 31 (F31-1) all quote/order mutations funnel through the
 * canonical `new-order-actions` edge function. This file no longer writes
 * to `field_quotes` directly — pricing, catalogue resolution, ownership
 * and traceability are enforced server-side.
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
  monthlyBeforeDiscount?: number;
  equipmentTotal?: number;
  firstMonthCredit?: number;
  agentGps?: { lat: number; lng: number; accuracy: number } | null;
  /** When true, the `field_quote` email is NOT sent (kept for compatibility). */
  skipClientEmail?: boolean;
  idempotencyKey?: string;
}

export interface SavedQuote {
  id: string;
  valid_until: string;
}

async function extractEdgeError(error: any, data: any, fallback: string): Promise<Error> {
  if (data?.error) return new Error(String(data.error));
  const ctx = error?.context;
  if (ctx?.json) {
    try { const b = await ctx.json(); if (b?.error) return new Error(String(b.error)); }
    catch { /* ignore */ }
  }
  if (error?.message && error.message !== "Edge Function returned a non-2xx status code") {
    return new Error(error.message);
  }
  return new Error(fallback);
}

/**
 * Create a server-priced field_quote via `new-order-actions`.
 * All catalogue resolution, TPS/TVQ, discount validation, and ownership
 * checks happen server-side. If price mismatch > tolerance, throws.
 */
export async function saveQuoteAndEmail(payload: SaveQuotePayload): Promise<SavedQuote> {
  const { draft, agentName, activationFee, subtotal, tps, tvq, total,
          monthlyBeforeDiscount, equipmentTotal, firstMonthCredit,
          agentGps, idempotencyKey } = payload;

  const resolvedMonthlyBeforeDiscount = monthlyBeforeDiscount ?? draft.services.reduce(
    (sum, service) => sum + Number(service.monthlyPrice || 0),
    0,
  );
  const resolvedEquipmentTotal = equipmentTotal ?? draft.equipment.reduce(
    (sum, equipment) => sum + Number(equipment.price || 0) * Number(equipment.quantity || 1),
    0,
  );
  const resolvedFirstMonthCredit = firstMonthCredit ?? (draft.services.length > 0 ? resolvedMonthlyBeforeDiscount : 0);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) throw new Error("Agent non authentifié.");

  const { data, error } = await supabase.functions.invoke("new-order-actions", {
    body: {
      action: "create_quote",
      idempotency_key: idempotencyKey || `quote_${Date.now()}_${userData.user.id}`,
      client_user_id: null,
      account_id: draft.existing_account_id ?? null,
      service_address_id: draft.existing_service_address_id ?? null,
      customer: draft.customer,
      services: draft.services,
      equipment: draft.equipment,
      custom_adjustments: draft.custom_adjustments || [],
      discount: draft.discount,
      activation_fee: activationFee,
      agent_name: agentName,
      agent_gps: agentGps,
      client_totals: {
        subtotal, tps, tvq, total,
        monthly_before_discount: resolvedMonthlyBeforeDiscount,
        equipment_total: resolvedEquipmentTotal,
        first_month_credit: resolvedFirstMonthCredit,
      },
    },
  });
  if (error || !data?.ok) throw await extractEdgeError(error, data, "Échec de la soumission");
  return { id: data.quote_id, valid_until: data.valid_until };
}

/**
 * Agent → Client secure Square payment link.
 * (Unchanged — still calls field-payment-link-create edge.)
 */
export interface PaymentLinkResult {
  intent_id: string;
  payment_url: string;
  expires_at: string;
  email_sent: boolean;
}

export async function sendPaymentLinkFromQuote(
  quoteId: string,
  mode: "email" | "link_only" = "email",
): Promise<PaymentLinkResult> {
  const { data, error } = await supabase.functions.invoke("field-payment-link-create", {
    body: { quote_id: quoteId, mode },
  });
  if (error || !data?.ok) throw await extractEdgeError(error, data, "Échec du lien de paiement");
  return {
    intent_id: data.intent_id,
    payment_url: data.payment_url,
    expires_at: data.expires_at,
    email_sent: !!data.email_sent,
  };
}
