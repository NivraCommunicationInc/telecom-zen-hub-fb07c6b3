import { supabase } from "@/integrations/supabase/client";

// Accept any UUID format (v1–v8, non-RFC variants) — gen_random_uuid() is v4
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_PARAM_RE = /^[\w-]+$/;

export type ResolvedOrderRoute =
  | { kind: "order"; orderId: string };

export async function resolveOrderRouteParam(param: string): Promise<ResolvedOrderRoute> {
  const value = decodeURIComponent(param).trim();
  if (!value || !SAFE_PARAM_RE.test(value)) throw new Error("Identifiant de commande invalide");

  const fieldPrefix = value.toUpperCase().startsWith("FIELD-") ? value.slice(6).toLowerCase() : null;

  if (UUID_RE.test(value)) {
    const { data: byId, error: err1 } = await supabase
      .from("orders")
      .select("id")
      .eq("id", value)
      .maybeSingle();
    if (err1) console.error("[orderRouteResolver] orders.id lookup:", err1.message);
    if (byId?.id) return { kind: "order", orderId: byId.id };

    const { data: intent, error: err2 } = await supabase
      .from("field_payment_intents" as any)
      .select("id, converted_order_id, converted_invoice_id")
      .eq("id", value)
      .maybeSingle();
    if (err2) console.error("[orderRouteResolver] field_payment_intents.id lookup:", err2.message);
    if ((intent as any)?.converted_order_id)
      return { kind: "order", orderId: (intent as any).converted_order_id };
    if ((intent as any)?.converted_invoice_id) {
      const { data: invoice, error: invErr } = await supabase
        .from("billing_invoices")
        .select("order_id")
        .eq("id", (intent as any).converted_invoice_id)
        .maybeSingle();
      if (invErr) console.error("[orderRouteResolver] billing_invoices.id lookup:", invErr.message);
      if ((invoice as any)?.order_id) return { kind: "order", orderId: (invoice as any).order_id };
    }
    if ((intent as any)?.id)
      throw new Error("Commande Core introuvable pour ce paiement — aucun dossier opérationnel ne sera affiché en format FIELD.");
  }

  const { data: byNumber, error: err3 } = await supabase
    .from("orders")
    .select("id")
    .eq("order_number", value)
    .maybeSingle();
  if (err3) console.error("[orderRouteResolver] orders.order_number lookup:", err3.message);
  if (byNumber?.id) return { kind: "order", orderId: byNumber.id };

  // FIELD-{first8} prefix — use SQL cast to avoid fetching 1000 rows
  if (fieldPrefix && /^[0-9a-f]{8}$/i.test(fieldPrefix)) {
    const { data: intents, error: err4 } = await supabase
      .from("field_payment_intents" as any)
      .select("id, converted_order_id, converted_invoice_id")
      .filter("id::text", "like", `${fieldPrefix.toLowerCase()}-%`)
      .limit(5);
    if (err4) console.error("[orderRouteResolver] field prefix lookup:", err4.message);
    const intent = ((intents || []) as any[]).find((row) =>
      String(row.id).toLowerCase().startsWith(fieldPrefix.toLowerCase())
    );
    if (intent?.converted_order_id)
      return { kind: "order", orderId: intent.converted_order_id as string };
    if (intent?.converted_invoice_id) {
      const { data: invoice, error: invErr } = await supabase
        .from("billing_invoices")
        .select("order_id")
        .eq("id", intent.converted_invoice_id as string)
        .maybeSingle();
      if (invErr) console.error("[orderRouteResolver] billing invoice prefix lookup:", invErr.message);
      if ((invoice as any)?.order_id) return { kind: "order", orderId: (invoice as any).order_id };
    }
    if (intent?.id)
      throw new Error("Commande Core introuvable pour ce paiement — aucun dossier opérationnel ne sera affiché en format FIELD.");
  }

  throw new Error("Commande introuvable");
}

export async function resolveCanonicalOrderId(param: string): Promise<string> {
  const resolved = await resolveOrderRouteParam(param);
  return resolved.orderId;
}
