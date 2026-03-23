/**
 * Shared Quote Operations — Canonical server actions for the Quote system.
 * Used by both Employee and Core Admin portals.
 */
import { supabase } from "@/integrations/supabase/client";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { generateQuotePDF, type QuotePDFData } from "@/lib/pdf/quoteTemplate";

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
  customerUserId?: string;
  accountId?: string | null;
  sourcePortal: "employee" | "core";
  createdByUserId: string;
  clientNote?: string;
  internalNote?: string;
  validUntil?: string;
  isProspect?: boolean;
  prospectName?: string;
  prospectEmail?: string;
  prospectPhone?: string;
}) {
  const { data, error } = await supabase
    .from("quotes" as any)
    .insert({
      customer_user_id: params.isProspect ? null : (params.customerUserId || null),
      account_id: params.accountId || null,
      source_portal: params.sourcePortal,
      created_by_user_id: params.createdByUserId,
      client_note: params.clientNote || null,
      internal_note: params.internalNote || null,
      valid_until: params.validUntil || null,
      status: "draft",
      is_prospect: params.isProspect || false,
      prospect_name: params.prospectName || null,
      prospect_email: params.prospectEmail || null,
      prospect_phone: params.prospectPhone || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create quote draft: ${error.message}`);

  await logQuoteEvent(data.id, "created", params.createdByUserId, params.sourcePortal === "employee" ? "employee" : "admin", "Soumission créée en brouillon");

  await logInternalAudit({
    action: "quote_created",
    category: "operations",
    portal: params.sourcePortal,
    targetType: "quote",
    targetId: data.id,
    details: {
      customer_user_id: params.customerUserId,
      is_prospect: params.isProspect || false,
      prospect_name: params.prospectName,
    },
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

// ─── 5. Remove Quote Adjustment ──────────────────────────────────────

export async function removeQuoteAdjustment(quoteId: string, adjustmentId: string) {
  const { error } = await supabase
    .from("quote_adjustments" as any)
    .delete()
    .eq("id", adjustmentId)
    .eq("quote_id", quoteId);

  if (error) throw new Error(`Failed to remove adjustment: ${error.message}`);
  await recalculateQuoteTotals(quoteId);
}

// ─── 6. Recalculate Quote Totals ─────────────────────────────────────

export async function recalculateQuoteTotals(quoteId: string) {
  const { data: lines } = await supabase
    .from("quote_lines" as any)
    .select("*")
    .eq("quote_id", quoteId);

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

// ─── 7. Update Quote Status ──────────────────────────────────────────

export async function updateQuoteStatus(
  quoteId: string,
  newStatus: QuoteStatus,
  actorUserId: string,
  actorRole: string,
  message?: string,
  extra?: Record<string, unknown>,
) {
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    ...extra,
  };

  if (newStatus === "approved") {
    updatePayload.approved_by_user_id = actorUserId;
    updatePayload.approved_at = new Date().toISOString();
  }
  if (newStatus === "sent") {
    updatePayload.last_sent_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("quotes" as any)
    .update(updatePayload)
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

// ─── 8. Approve Quote ────────────────────────────────────────────────

export async function approveQuote(quoteId: string, actorUserId: string, actorRole: string, reason?: string) {
  await supabase.from("quote_approvals" as any).insert({
    quote_id: quoteId,
    decision: "approved",
    reason: reason || null,
    actor_user_id: actorUserId,
    actor_role: actorRole,
  });

  await updateQuoteStatus(quoteId, "approved", actorUserId, actorRole, `Soumission approuvée${reason ? `: ${reason}` : ""}`);
}

// ─── 9. Reject Quote ─────────────────────────────────────────────────

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

// ─── 10. Send Quote to Client (via Edge Function) ────────────────────

export async function sendQuote(quoteId: string, actorUserId: string, actorRole: string) {
  // Call the dedicated edge function that builds professional HTML and enqueues
  const { data, error } = await supabase.functions.invoke("send-quote-email", {
    body: { quoteId },
  });

  if (error) {
    throw new Error(`Erreur d'envoi: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  // Update status to sent
  await updateQuoteStatus(quoteId, "sent", actorUserId, actorRole, `Soumission envoyée à ${data?.recipientEmail || "client"}`);
}

// ─── 11. Follow-up ──────────────────────────────────────────────────

export async function logFollowUp(quoteId: string, actorUserId: string, actorRole: string, message?: string) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("quotes" as any)
    .update({
      last_followup_at: now,
      next_followup_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    })
    .eq("id", quoteId);

  if (error) throw new Error(`Failed to update follow-up: ${error.message}`);

  await logQuoteEvent(quoteId, "followup", actorUserId, actorRole, message || "Relance effectuée");

  await logInternalAudit({
    action: "quote_followup",
    category: "operations",
    targetType: "quote",
    targetId: quoteId,
    details: { followup_at: now },
  });
}

// ─── 12. Convert Quote to Order ──────────────────────────────────────

export async function convertQuoteToOrder(quoteId: string, actorUserId: string, actorRole: string) {
  const { data: quote, error: qErr } = await supabase
    .from("quotes" as any)
    .select("*")
    .eq("id", quoteId)
    .single();

  if (qErr || !quote) throw new Error("Quote not found");
  if (quote.converted_order_id) {
    throw new Error("Cette soumission a déjà été convertie en commande.");
  }
  if (!["approved", "accepted"].includes(quote.status)) {
    throw new Error(`Cannot convert quote with status: ${quote.status}. Must be approved or accepted.`);
  }

  const { data: lines } = await supabase
    .from("quote_lines" as any)
    .select("*")
    .eq("quote_id", quoteId);

  let clientEmail: string | null = null;
  let clientPhone: string | null = null;
  let resolvedAccountId: string | null = quote.account_id || null;

  if (quote.customer_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", quote.customer_user_id)
      .maybeSingle();
    clientEmail = profile?.email || null;
    clientPhone = profile?.phone || null;

    if (!resolvedAccountId) {
      const { data: account } = await supabase
        .from("accounts" as any)
        .select("id")
        .eq("client_id", quote.customer_user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedAccountId = account?.id || null;
    }
  } else if (quote.is_prospect) {
    clientEmail = quote.prospect_email;
    clientPhone = quote.prospect_phone;
  }

  if (!resolvedAccountId) {
    throw new Error("Impossible de convertir: aucun compte client actif trouvé pour cette soumission.");
  }

  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const selectedServices = (lines || [])
    .filter((l: any) => l.line_type === "catalog_service")
    .map((l: any) => l.label)
    .join(", ");

  const orderInsertPayload = {
    user_id: quote.customer_user_id || actorUserId,
    account_id: resolvedAccountId,
    order_number: orderNumber,
    status: "submitted",
    order_type: "new_service",
    service_type: selectedServices || "Services de la soumission",
    total_amount: Number(quote.total_due_now || 0),
    client_email: clientEmail,
    client_phone: clientPhone,
    internal_notes: `[Source: quote_${quote.source_portal}] Converti depuis soumission ${quote.quote_number || quoteId}. Prospect: ${quote.is_prospect ? "oui" : "non"}${quote.prospect_name ? ` (${quote.prospect_name})` : ""}. Par: ${actorUserId}`,
    notes: quote.client_note || null,
  };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert(orderInsertPayload as any)
    .select()
    .single();

  if (orderErr) throw new Error(`Failed to create order from quote: ${orderErr.message}`);

  await supabase
    .from("quotes" as any)
    .update({ status: "converted", converted_order_id: order.id })
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

// ─── 13. Duplicate Quote ─────────────────────────────────────────────

export async function duplicateQuote(quoteId: string, actorUserId: string, sourcePortal: "employee" | "core") {
  const { data: original } = await supabase
    .from("quotes" as any)
    .select("*")
    .eq("id", quoteId)
    .single();

  if (!original) throw new Error("Quote not found");

  const newQuote = await createQuoteDraft({
    customerUserId: original.customer_user_id || undefined,
    accountId: original.account_id,
    sourcePortal,
    createdByUserId: actorUserId,
    clientNote: original.client_note,
    internalNote: original.internal_note,
    isProspect: original.is_prospect,
    prospectName: original.prospect_name,
    prospectEmail: original.prospect_email,
    prospectPhone: original.prospect_phone,
  });

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

// ─── 14. Get Public URL ──────────────────────────────────────────────

export function getQuotePublicUrl(publicToken: string): string {
  return `${window.location.origin}/quote?token=${publicToken}`;
}

// ─── 15. Download Quote PDF ──────────────────────────────────────────

export async function downloadQuotePDF(quoteId: string) {
  const { data: quote } = await supabase
    .from("quotes" as any)
    .select("*")
    .eq("id", quoteId)
    .single();

  if (!quote) throw new Error("Quote not found");

  const { data: lines } = await supabase
    .from("quote_lines" as any)
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });

  const { data: adjustments } = await supabase
    .from("quote_adjustments" as any)
    .select("*")
    .eq("quote_id", quoteId)
    .eq("approval_status", "approved")
    .order("created_at", { ascending: true });

  // Resolve client name
  let clientName = quote.is_prospect ? (quote.prospect_name || "Prospect") : "Client";
  let clientEmail = quote.is_prospect ? quote.prospect_email : undefined;
  let clientPhone = quote.is_prospect ? quote.prospect_phone : undefined;

  if (!quote.is_prospect && quote.customer_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", quote.customer_user_id)
      .maybeSingle();
    if (profile) {
      clientName = profile.full_name || "Client";
      clientEmail = profile.email;
      clientPhone = profile.phone;
    }
  }

  const pdfData: QuotePDFData = {
    quoteNumber: quote.quote_number || "—",
    clientName,
    clientEmail,
    clientPhone,
    isProspect: quote.is_prospect || false,
    validUntil: quote.valid_until,
    clientNote: quote.client_note,
    lines: (lines || []).map((l: any) => ({
      label: l.label,
      quantity: l.quantity,
      unitPrice: l.unit_price,
      billingFrequency: l.billing_frequency,
      lineType: l.line_type,
    })),
    adjustments: (adjustments || []).map((a: any) => ({
      label: a.label,
      amount: a.amount,
      adjustmentType: a.adjustment_type,
    })),
    subtotal: Number(quote.subtotal || 0),
    discountsTotal: Number(quote.discounts_total || 0),
    creditsTotal: Number(quote.credits_total || 0),
    taxesTotal: Number(quote.taxes_total || 0),
    totalDueNow: Number(quote.total_due_now || 0),
    totalMonthly: Number(quote.total_monthly || 0),
    createdAt: quote.created_at,
    status: quote.status,
  };

  const blob = generateQuotePDF(pdfData);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Soumission-${quote.quote_number}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 16. Resend Quote Email ──────────────────────────────────────────

export async function resendQuoteEmail(quoteId: string, actorUserId: string, actorRole: string) {
  const { data, error } = await supabase.functions.invoke("send-quote-email", {
    body: { quoteId },
  });

  if (error) throw new Error(`Erreur de renvoi: ${error.message}`);
  if (data?.error) throw new Error(data.error);

  // Update last_sent_at without changing status
  await supabase
    .from("quotes" as any)
    .update({ last_sent_at: new Date().toISOString() })
    .eq("id", quoteId);

  await logQuoteEvent(quoteId, "email_resent", actorUserId, actorRole, `Courriel renvoyé à ${data?.recipientEmail || "client"}`);
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
