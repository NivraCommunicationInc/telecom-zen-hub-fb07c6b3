/**
 * Shared Quote Operations — Canonical server actions for the Quote system.
 * Used by both Employee and Core Admin portals.
 */
import { supabase } from "@/integrations/supabase/client";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

// ─── Types ───────────────────────────────────────────────────────────────

export type QuoteStatus =
  | "draft" | "pending_review" | "approved" | "sent"
  | "viewed" | "accepted" | "rejected" | "expired" | "converted";

export type QuoteLineType =
  | "catalog_service" | "manual_fee" | "activation_fee"
  | "shipping_fee" | "promo_discount" | "credit";

export type BillingFrequency = "one_time" | "monthly";

export interface QuoteLine {
  service_id?: string | null;
  line_type: QuoteLineType;
  label: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  billing_frequency: BillingFrequency;
  metadata?: Record<string, unknown>;
}

export interface QuoteAdjustment {
  adjustment_type: "discount" | "credit";
  label: string;
  amount: number;
  source: "employee_proposed" | "admin_approved" | "system";
  requires_approval: boolean;
}

// ─── 1. Create Draft ──────────────────────────────────────────────────

export async function createQuoteDraft(params: {
  customerUserId: string;
  accountId?: string | null;
  sourcePortal: "employee" | "core";
  createdByUserId: string;
  clientNote?: string;
  internalNote?: string;
  validUntil?: string;
}) {
  const { data, error } = await supabase
    .from("quotes" as any)
    .insert({
      customer_user_id: params.customerUserId,
      account_id: params.accountId || null,
      source_portal: params.sourcePortal,
      created_by_user_id: params.createdByUserId,
      client_note: params.clientNote || null,
      internal_note: params.internalNote || null,
      valid_until: params.validUntil || null,
      status: "draft",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create quote draft: ${error.message}`);

  // Log event
  await logQuoteEvent(data.id, "created", params.createdByUserId, params.sourcePortal === "employee" ? "employee" : "admin", "Soumission créée en brouillon");

  await logInternalAudit({
    action: "quote_created",
    category: "operations",
    portal: params.sourcePortal,
    targetType: "quote",
    targetId: data.id,
    details: { customer_user_id: params.customerUserId },
  });

  return data;
}

// ─── 2. Add Quote Line ───────────────────────────────────────────────

export async function addQuoteLine(quoteId: string, line: QuoteLine) {
  const { data, error } = await supabase
    .from("quote_lines" as any)
    .insert({
      quote_id: quoteId,
      service_id: line.service_id || null,
      line_type: line.line_type,
      label: line.label,
      description: line.description || null,
      quantity: line.quantity,
      unit_price: line.unit_price,
      billing_frequency: line.billing_frequency,
      metadata: line.metadata || {},
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add quote line: ${error.message}`);

  await recalculateQuoteTotals(quoteId);
  return data;
}

// ─── 3. Remove Quote Line ────────────────────────────────────────────

export async function removeQuoteLine(quoteId: string, lineId: string) {
  const { error } = await supabase
    .from("quote_lines" as any)
    .delete()
    .eq("id", lineId)
    .eq("quote_id", quoteId);

  if (error) throw new Error(`Failed to remove quote line: ${error.message}`);
  await recalculateQuoteTotals(quoteId);
}

// ─── 4. Add Quote Adjustment ─────────────────────────────────────────

export async function addQuoteAdjustment(
  quoteId: string,
  adjustment: QuoteAdjustment,
  createdByUserId: string,
) {
  const { data, error } = await supabase
    .from("quote_adjustments" as any)
    .insert({
      quote_id: quoteId,
      adjustment_type: adjustment.adjustment_type,
      label: adjustment.label,
      amount: adjustment.amount,
      source: adjustment.source,
      requires_approval: adjustment.requires_approval,
      approval_status: adjustment.requires_approval ? "pending" : "approved",
      created_by_user_id: createdByUserId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add adjustment: ${error.message}`);

  await recalculateQuoteTotals(quoteId);
  await logQuoteEvent(quoteId, "adjustment_added", createdByUserId, "employee", `Ajustement ajouté: ${adjustment.label} (${adjustment.amount}$)`);
  return data;
}

// ─── 5. Recalculate Quote Totals ─────────────────────────────────────

export async function recalculateQuoteTotals(quoteId: string) {
  // Fetch lines
  const { data: lines } = await supabase
    .from("quote_lines" as any)
    .select("*")
    .eq("quote_id", quoteId);

  // Fetch approved adjustments
  const { data: adjustments } = await supabase
    .from("quote_adjustments" as any)
    .select("*")
    .eq("quote_id", quoteId)
    .in("approval_status", ["approved"]);

  let oneTimeSubtotal = 0;
  let monthlySubtotal = 0;

  for (const line of lines || []) {
    const lineTotal = (line.unit_price || 0) * (line.quantity || 1);
    if (line.billing_frequency === "one_time") {
      oneTimeSubtotal += lineTotal;
    } else {
      monthlySubtotal += lineTotal;
    }
  }

  let discountsTotal = 0;
  let creditsTotal = 0;

  for (const adj of adjustments || []) {
    if (adj.adjustment_type === "discount") discountsTotal += adj.amount;
    if (adj.adjustment_type === "credit") creditsTotal += adj.amount;
  }

  const subtotal = oneTimeSubtotal + monthlySubtotal;
  const taxableBase = Math.max(0, subtotal - discountsTotal - creditsTotal);
  const tps = taxableBase * 0.05;
  const tvq = taxableBase * 0.09975;
  const taxesTotal = tps + tvq;
  const totalDueNow = Math.max(0, oneTimeSubtotal - discountsTotal - creditsTotal + tps + tvq + monthlySubtotal);

  const { error } = await supabase
    .from("quotes" as any)
    .update({
      subtotal: Number(subtotal.toFixed(2)),
      discounts_total: Number(discountsTotal.toFixed(2)),
      credits_total: Number(creditsTotal.toFixed(2)),
      taxes_total: Number(taxesTotal.toFixed(2)),
      total_due_now: Number(totalDueNow.toFixed(2)),
      total_monthly: Number(monthlySubtotal.toFixed(2)),
    })
    .eq("id", quoteId);

  if (error) throw new Error(`Failed to recalculate totals: ${error.message}`);
}

// ─── 6. Update Quote Status ──────────────────────────────────────────

export async function updateQuoteStatus(
  quoteId: string,
  newStatus: QuoteStatus,
  actorUserId: string,
  actorRole: string,
  message?: string,
  extra?: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("quotes" as any)
    .update({
      status: newStatus,
      ...(newStatus === "approved" ? { approved_by_user_id: actorUserId, approved_at: new Date().toISOString() } : {}),
      ...extra,
    })
    .eq("id", quoteId);

  if (error) throw new Error(`Failed to update quote status: ${error.message}`);

  await logQuoteEvent(quoteId, `status_${newStatus}`, actorUserId, actorRole, message || `Statut changé: ${newStatus}`);

  await logInternalAudit({
    action: `quote_${newStatus}`,
    category: "operations",
    targetType: "quote",
    targetId: quoteId,
    details: { new_status: newStatus },
  });
}

// ─── 7. Approve Quote ────────────────────────────────────────────────

export async function approveQuote(quoteId: string, actorUserId: string, actorRole: string, reason?: string) {
  // Record approval
  await supabase.from("quote_approvals" as any).insert({
    quote_id: quoteId,
    decision: "approved",
    reason: reason || null,
    actor_user_id: actorUserId,
    actor_role: actorRole,
  });

  await updateQuoteStatus(quoteId, "approved", actorUserId, actorRole, `Soumission approuvée${reason ? `: ${reason}` : ""}`);
}

// ─── 8. Reject Quote ─────────────────────────────────────────────────

export async function rejectQuote(quoteId: string, actorUserId: string, actorRole: string, reason: string) {
  await supabase.from("quote_approvals" as any).insert({
    quote_id: quoteId,
    decision: "rejected",
    reason,
    actor_user_id: actorUserId,
    actor_role: actorRole,
  });

  await updateQuoteStatus(quoteId, "rejected", actorUserId, actorRole, `Soumission rejetée: ${reason}`);
}

// ─── 9. Send Quote ───────────────────────────────────────────────────

export async function sendQuote(quoteId: string, actorUserId: string, actorRole: string) {
  await updateQuoteStatus(quoteId, "sent", actorUserId, actorRole, "Soumission envoyée au client");
}

// ─── 10. Convert Quote to Order ──────────────────────────────────────

export async function convertQuoteToOrder(quoteId: string, actorUserId: string, actorRole: string) {
  // 1. Load quote
  const { data: quote, error: qErr } = await supabase
    .from("quotes" as any)
    .select("*")
    .eq("id", quoteId)
    .single();

  if (qErr || !quote) throw new Error("Quote not found");
  if (!["approved", "accepted"].includes(quote.status)) {
    throw new Error(`Cannot convert quote with status: ${quote.status}. Must be approved or accepted.`);
  }

  // 2. Load lines
  const { data: lines } = await supabase
    .from("quote_lines" as any)
    .select("*")
    .eq("quote_id", quoteId);

  // 3. Load customer profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("user_id", quote.customer_user_id)
    .maybeSingle();

  // 4. Create canonical order
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const selectedServices = (lines || [])
    .filter((l: any) => l.line_type === "catalog_service")
    .map((l: any) => l.label)
    .join(", ");

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: quote.customer_user_id,
      order_number: orderNumber,
      status: "submitted",
      source: `quote_${quote.source_portal}`,
      selected_plan: selectedServices || "Services de la soumission",
      total_amount: quote.total_due_now,
      client_email: profile?.email || null,
      client_phone: profile?.phone || null,
      metadata: {
        quote_id: quoteId,
        quote_number: quote.quote_number,
        converted_by: actorUserId,
        converted_at: new Date().toISOString(),
      },
    } as any)
    .select()
    .single();

  if (orderErr) throw new Error(`Failed to create order from quote: ${orderErr.message}`);

  // 5. Mark quote as converted
  await supabase
    .from("quotes" as any)
    .update({
      status: "converted",
      converted_order_id: order.id,
    })
    .eq("id", quoteId);

  await logQuoteEvent(quoteId, "converted_to_order", actorUserId, actorRole, `Convertie en commande ${orderNumber}`, { order_id: order.id, order_number: orderNumber });

  await logInternalAudit({
    action: "quote_converted_to_order",
    category: "operations",
    targetType: "quote",
    targetId: quoteId,
    details: { order_id: order.id, order_number: orderNumber },
  });

  return { order, orderNumber };
}

// ─── 11. Duplicate Quote ─────────────────────────────────────────────

export async function duplicateQuote(quoteId: string, actorUserId: string, sourcePortal: "employee" | "core") {
  // Load original
  const { data: original } = await supabase
    .from("quotes" as any)
    .select("*")
    .eq("id", quoteId)
    .single();

  if (!original) throw new Error("Quote not found");

  // Create new draft
  const newQuote = await createQuoteDraft({
    customerUserId: original.customer_user_id,
    accountId: original.account_id,
    sourcePortal,
    createdByUserId: actorUserId,
    clientNote: original.client_note,
    internalNote: original.internal_note,
  });

  // Copy lines
  const { data: lines } = await supabase
    .from("quote_lines" as any)
    .select("*")
    .eq("quote_id", quoteId);

  for (const line of lines || []) {
    await addQuoteLine(newQuote.id, {
      service_id: line.service_id,
      line_type: line.line_type,
      label: line.label,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      billing_frequency: line.billing_frequency,
      metadata: line.metadata,
    });
  }

  await logQuoteEvent(newQuote.id, "duplicated", actorUserId, sourcePortal === "employee" ? "employee" : "admin", `Dupliquée depuis ${original.quote_number}`, { source_quote_id: quoteId });

  return newQuote;
}

// ─── Helper: Log Quote Event ─────────────────────────────────────────

async function logQuoteEvent(
  quoteId: string,
  eventType: string,
  actorUserId: string | null,
  actorRole: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  await supabase.from("quote_events" as any).insert({
    quote_id: quoteId,
    event_type: eventType,
    actor_user_id: actorUserId,
    actor_role: actorRole,
    message,
    metadata: metadata || {},
  });
}
