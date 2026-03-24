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
  | "viewed" | "accepted_pending_checkout" | "checkout_in_progress"
  | "checkout_completed" | "rejected" | "expired" | "converted";

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

// ─── Status display config ──────────────────────────────────────────
export const QUOTE_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; description?: string }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  pending_review: { label: "En révision", variant: "outline" },
  approved: { label: "Approuvée", variant: "default" },
  sent: { label: "Envoyée", variant: "default" },
  viewed: { label: "Consultée", variant: "outline" },
  accepted_pending_checkout: { label: "Acceptée — Checkout requis", variant: "outline", description: "Le client a accepté, en attente de finalisation" },
  checkout_in_progress: { label: "Checkout en cours", variant: "outline", description: "Le client est en train de compléter le formulaire" },
  checkout_completed: { label: "Checkout complété", variant: "default", description: "Prêt pour conversion en commande" },
  rejected: { label: "Rejetée", variant: "destructive" },
  expired: { label: "Expirée", variant: "secondary" },
  converted: { label: "Convertie", variant: "default" },
};

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
  const { data, error } = await supabase.functions.invoke("send-quote-email", {
    body: { quoteId },
  });

  if (error) throw new Error(`Erreur d'envoi: ${error.message}`);
  if (data?.error) throw new Error(data.error);

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

// ─── 12. Accept Quote (Client-side) — Sets accepted_pending_checkout ─

export async function acceptQuoteByClient(quoteId: string, publicToken: string) {
  const checkoutToken = crypto.randomUUID();
  
  const { error } = await supabase
    .from("quotes" as any)
    .update({
      status: "accepted_pending_checkout",
      checkout_token: checkoutToken,
    })
    .eq("id", quoteId)
    .eq("public_token", publicToken);

  if (error) throw new Error(`Erreur d'acceptation: ${error.message}`);

  await supabase.from("quote_events" as any).insert({
    quote_id: quoteId,
    event_type: "accepted_by_client",
    actor_role: "client",
    message: "Le client a accepté la soumission — checkout requis",
  });

  return { checkoutToken };
}

// ─── 13. Convert Quote to Order — ONLY if checkout_completed ─────────

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

  // ═══ RULE: Conversion ONLY allowed when checkout is completed ═══
  if (quote.status !== "checkout_completed") {
    throw new Error(
      `Conversion impossible. Le checkout client doit être complété avant de créer la commande. Statut actuel: ${quote.status}`
    );
  }

  const { data: lines } = await supabase
    .from("quote_lines" as any)
    .select("*")
    .eq("quote_id", quoteId);

  // Use checkout_data (filled by client) as primary source for client info
  const checkoutData = quote.checkout_data as Record<string, any> | null;

  let clientEmail: string | null = checkoutData?.email || null;
  let clientPhone: string | null = checkoutData?.phone || null;
  let clientName: string | null = checkoutData ? `${checkoutData.first_name || ""} ${checkoutData.last_name || ""}`.trim() : null;
  let resolvedAccountId: string | null = quote.account_id || null;

  // Fallback to profile data if checkout_data incomplete
  if (quote.customer_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", quote.customer_user_id)
      .maybeSingle();
    if (!clientEmail) clientEmail = profile?.email || null;
    if (!clientPhone) clientPhone = profile?.phone || null;
    if (!clientName) clientName = profile?.full_name || null;

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
    if (!clientEmail) clientEmail = quote.prospect_email;
    if (!clientPhone) clientPhone = quote.prospect_phone;
    if (!clientName) clientName = quote.prospect_name;
  }

  if (!resolvedAccountId) {
    throw new Error("Impossible de convertir: aucun compte client actif trouvé pour cette soumission.");
  }

  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const selectedServices = (lines || [])
    .filter((l: any) => l.line_type === "catalog_service")
    .map((l: any) => l.label)
    .join(", ");

  const checkoutNotes = checkoutData
    ? `[Checkout] ${clientName}. DOB: ${checkoutData.dob || "N/A"}. Paiement: ${checkoutData.payment_method || "N/A"}${checkoutData.interac_reference ? ` Ref: ${checkoutData.interac_reference}` : ""}`
    : "";

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
    service_address: checkoutData?.address || null,
    service_city: checkoutData?.city || null,
    service_province: checkoutData?.province || null,
    service_postal_code: checkoutData?.postal_code || null,
    internal_notes: `[Source: quote_${quote.source_portal}] Converti depuis soumission ${quote.quote_number || quoteId}. ${checkoutNotes}. Par: ${actorUserId}`,
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

// ─── 14. Duplicate Quote ─────────────────────────────────────────────

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

// ─── 15. Get Public URL ──────────────────────────────────────────────

export function getQuotePublicUrl(publicToken: string): string {
  return `${window.location.origin}/quote?token=${publicToken}`;
}

// ─── 16. Get Checkout URL ────────────────────────────────────────────

export function getQuoteCheckoutUrl(checkoutToken: string): string {
  return `${window.location.origin}/quote-checkout?token=${checkoutToken}`;
}

// ─── 17. Send Checkout Link — Real email via email_queue ─────────────

export async function sendCheckoutLink(quoteId: string, actorUserId: string, actorRole: string) {
  const { data: quote } = await supabase
    .from("quotes" as any)
    .select("checkout_token, prospect_email, customer_user_id, is_prospect, quote_number, total_due_now, total_monthly")
    .eq("id", quoteId)
    .single();

  if (!quote) throw new Error("Quote not found");

  let checkoutToken = quote.checkout_token;
  if (!checkoutToken) {
    checkoutToken = crypto.randomUUID();
    await supabase.from("quotes" as any).update({ checkout_token: checkoutToken }).eq("id", quoteId);
  }

  const checkoutUrl = getQuoteCheckoutUrl(checkoutToken);

  // Resolve recipient email
  let recipientEmail: string | null = null;
  if (quote.is_prospect) {
    recipientEmail = quote.prospect_email;
  } else if (quote.customer_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", quote.customer_user_id)
      .maybeSingle();
    recipientEmail = profile?.email || null;
  }

  if (!recipientEmail) {
    throw new Error("Aucun courriel client trouvé pour envoyer le lien de finalisation.");
  }

  // Send checkout link email via send-quote-email edge function (pgmq pipeline)
  const { data: emailData, error: emailErr } = await supabase.functions.invoke("send-quote-email", {
    body: { quoteId, mode: "checkout_link" },
  });

  if (emailErr || emailData?.error) {
    const errMsg = emailErr?.message || emailData?.error || "Erreur inconnue";
    console.error("[sendCheckoutLink] Email error:", errMsg);
    throw new Error(`Erreur d'envoi du courriel: ${errMsg}`);
  }

  await logQuoteEvent(quoteId, "checkout_link_sent", actorUserId, actorRole, `Lien de finalisation envoyé à ${recipientEmail}`);

  await logInternalAudit({
    action: "quote_checkout_link_sent",
    category: "operations",
    targetType: "quote",
    targetId: quoteId,
    details: { recipient: recipientEmail, checkout_url: checkoutUrl },
  });

  return { checkoutUrl, checkoutToken, recipientEmail };
}

// ─── Build checkout email HTML ──────────────────────────────────────

function buildCheckoutEmailHtml(params: {
  quoteNumber: string;
  checkoutUrl: string;
  totalDueNow: number;
  totalMonthly: number;
}): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 20px;">
  <div style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;text-align:center;">
      <h1 style="color:#ffffff;font-size:20px;margin:0;">Nivra Télécom</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#0f172a;font-size:18px;margin:0 0 16px;">Finalisez votre commande</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Votre soumission <strong>${params.quoteNumber}</strong> a été acceptée. 
        Pour compléter votre commande, veuillez cliquer sur le bouton ci-dessous afin de 
        remplir vos informations et confirmer votre paiement.
      </p>
      <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:0 0 24px;">
        <table style="width:100%;font-size:14px;color:#334155;">
          <tr><td style="padding:4px 0;">Total dû maintenant</td><td style="text-align:right;font-weight:700;">${params.totalDueNow.toFixed(2)} $</td></tr>
          <tr><td style="padding:4px 0;">Mensuel récurrent</td><td style="text-align:right;font-weight:600;color:#2563eb;">${params.totalMonthly.toFixed(2)} $/mois</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${params.checkoutUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;">
          Compléter ma commande
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
        Ce lien est sécurisé et unique à votre soumission. Si vous n'avez pas demandé cette soumission, ignorez ce courriel.
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">
        Nivra Télécom inc. · Support@nivra-telecom.ca · nivra-telecom.ca
      </p>
    </div>
  </div>
</div>
</body>
</html>`.trim();
}

// ─── 18. Download Quote PDF ──────────────────────────────────────────

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

  let clientName = "En attente d'identification";
  let clientEmail = quote.is_prospect ? quote.prospect_email : undefined;
  let clientPhone: string | undefined = undefined;

  // For prospects: only show email, hide name/phone (unreliable CRM data)
  if (quote.is_prospect) {
    // Only use prospect_name if it looks real (not empty, not "Prospect")
    const pName = quote.prospect_name?.trim();
    if (pName && pName !== "Prospect" && pName !== "prospect") {
      clientName = pName;
    }
    // Don't show phone for unverified prospects
  } else if (quote.customer_user_id) {
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

// ─── 19. Resend Quote Email ──────────────────────────────────────────

export async function resendQuoteEmail(quoteId: string, actorUserId: string, actorRole: string) {
  const { data, error } = await supabase.functions.invoke("send-quote-email", {
    body: { quoteId },
  });

  if (error) throw new Error(`Erreur de renvoi: ${error.message}`);
  if (data?.error) throw new Error(data.error);

  await supabase
    .from("quotes" as any)
    .update({ last_sent_at: new Date().toISOString() })
    .eq("id", quoteId);

  await logQuoteEvent(quoteId, "email_resent", actorUserId, actorRole, `Courriel renvoyé à ${data?.recipientEmail || "client"}`);
}

// ─── 20. Add Account Promotion ───────────────────────────────────────

export async function addAccountPromotion(params: {
  accountId: string;
  customerId?: string;
  quoteId?: string;
  orderId?: string;
  promoCode?: string;
  label: string;
  promotionType: "monthly_discount" | "credit" | "promo";
  amount: number;
  durationMonths: number;
  createdByUserId: string;
  createdByRole: string;
  notes?: string;
}) {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + params.durationMonths);

  const promoNotes = [
    params.notes || "",
    params.promoCode ? `Code: ${params.promoCode}` : "",
    `Termes: ${params.amount}$/mois × ${params.durationMonths} mois (${params.promotionType})`,
  ].filter(Boolean).join(" | ");

  const { data, error } = await supabase
    .from("account_promotions" as any)
    .insert({
      account_id: params.accountId,
      customer_id: params.customerId || null,
      quote_id: params.quoteId || null,
      order_id: params.orderId || null,
      promo_code: params.promoCode || null,
      label: params.label,
      promotion_type: params.promotionType,
      amount: params.amount,
      duration_months: params.durationMonths,
      months_remaining: params.durationMonths,
      is_active: true,
      created_by_user_id: params.createdByUserId,
      created_by_role: params.createdByRole,
      notes: promoNotes,
      started_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add promotion: ${error.message}`);

  await logInternalAudit({
    action: "promotion_added",
    category: "operations",
    targetType: "account",
    targetId: params.accountId,
    details: {
      promo_code: params.promoCode,
      label: params.label,
      amount: params.amount,
      duration_months: params.durationMonths,
      promotion_type: params.promotionType,
      notes: promoNotes,
    },
  });

  return data;
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
