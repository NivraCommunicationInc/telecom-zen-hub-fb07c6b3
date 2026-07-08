/**
 * recordPayment — Shared canonical payment action.
 * Uses apply_payment_to_invoice RPC. Available to employee + field roles.
 * All mutations are fully audit-logged.
 */
import { supabase } from "@/integrations/supabase/client";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

export type PaymentMethod = "interac" | "cash" | "debit_credit" | "square" | "bank_transfer" | "other";
type CanonicalMethod = "interac" | "manual" | "card";

const mapToBillingMethod = (method: PaymentMethod): CanonicalMethod => {
  if (method === "square") return "card";
  if (method === "interac") return "interac";
  if (method === "debit_credit") return "card";
  return "manual";
};

const mapToProvider = (method: PaymentMethod): string => {
  if (method === "square") return "square";
  if (method === "interac") return "interac";
  if (method === "debit_credit") return "square";
  if (method === "bank_transfer") return "bank";
  if (method === "cash") return "cash";
  return "manual";
};

export interface RecordPaymentParams {
  invoiceId: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  portal: "employee" | "field";
}

export async function recordPayment(params: RecordPaymentParams) {
  const { invoiceId, customerId, amount, method, reference, note, portal } = params;

  if (!invoiceId || !customerId) throw new Error("Facture et client requis");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Non authentifié");

  // Verify role is allowed
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .maybeSingle();

  const allowedRoles = ["admin", "employee", "field_sales", "supervisor", "billing_admin"];
  if (!roleData || !allowedRoles.includes(roleData.role)) {
    throw new Error("Rôle non autorisé pour enregistrer un paiement");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const actorName = profile?.full_name ?? session.user.email ?? "Agent";
  const providerPaymentId = reference?.trim() || `manual_${method}_${Date.now()}`;

  // Use canonical RPC
  const { data: rpcResult, error } = await supabase.rpc("apply_payment_to_invoice" as any, {
    p_invoice_id: invoiceId,
    p_customer_id: customerId,
    p_amount: amount,
    p_method: mapToBillingMethod(method),
    p_provider: mapToProvider(method),
    p_provider_payment_id: providerPaymentId,
    p_source: portal,
    p_created_by_name: actorName,
    p_created_by_role: roleData.role,
  });

  if (error) throw new Error(`Échec de l'enregistrement: ${error.message}`);

  // Activity log
  if (note?.trim()) {
    await supabase.from("activity_logs").insert({
      user_id: session.user.id,
      entity_type: "billing_payment",
      entity_id: invoiceId,
      action: `payment_note: ${note.trim()}`,
      actor_name: actorName,
      actor_role: portal,
      details: { amount, method, reference: reference || null },
    });
  }

  // Internal audit log
  await logInternalAudit({
    action: "record_payment",
    category: "operations",
    portal,
    targetType: "billing_invoice",
    targetId: invoiceId,
    details: {
      amount,
      method,
      canonical_method: mapToBillingMethod(method),
      provider: mapToProvider(method),
      reference: reference || null,
      customer_id: customerId,
      actor_role: roleData.role,
    },
  });

  return rpcResult;
}
