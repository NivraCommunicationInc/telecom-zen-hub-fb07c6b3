import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_PARAM_RE = /^[\w-]+$/;

export type ResolvedOrderRoute =
  | { kind: "order"; orderId: string }
  | { kind: "field_payment_intent"; intentId: string };

export async function resolveOrderRouteParam(param: string): Promise<ResolvedOrderRoute> {
  const value = decodeURIComponent(param).trim();
  if (!value || !SAFE_PARAM_RE.test(value)) throw new Error("Identifiant de commande invalide");

  const fieldPrefix = value.toUpperCase().startsWith("FIELD-") ? value.slice(6).toLowerCase() : null;

  if (UUID_RE.test(value)) {
    const { data: byId } = await supabase.from("orders").select("id").eq("id", value).maybeSingle();
    if (byId?.id) return { kind: "order", orderId: byId.id };

    const { data: intent } = await supabase
      .from("field_payment_intents" as any)
      .select("id, converted_order_id")
      .eq("id", value)
      .maybeSingle();
    if ((intent as any)?.converted_order_id) return { kind: "order", orderId: (intent as any).converted_order_id };
    if ((intent as any)?.id) return { kind: "field_payment_intent", intentId: (intent as any).id };
  }

  const { data: byNumber } = await supabase.from("orders").select("id").eq("order_number", value).maybeSingle();
  if (byNumber?.id) return { kind: "order", orderId: byNumber.id };

  if (fieldPrefix && /^[0-9a-f]{8}$/i.test(fieldPrefix)) {
    const { data: intents } = await supabase
      .from("field_payment_intents" as any)
      .select("id, converted_order_id")
      .order("created_at", { ascending: false })
      .limit(1000);
    const intent = ((intents || []) as any[]).find((row) => String(row.id).toLowerCase().startsWith(fieldPrefix));
    if (intent?.converted_order_id) return { kind: "order", orderId: intent.converted_order_id as string };
    if (intent?.id) return { kind: "field_payment_intent", intentId: intent.id as string };
  }

  throw new Error("Commande introuvable");
}

export async function resolveCanonicalOrderId(param: string): Promise<string> {
  const resolved = await resolveOrderRouteParam(param);
  if (resolved.kind === "order") return resolved.orderId;
  throw new Error("Vente terrain en attente de paiement — la commande Core sera créée dès confirmation du paiement.");
}