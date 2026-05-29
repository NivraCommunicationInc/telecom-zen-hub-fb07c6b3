/**
 * CoreFieldIntentDetail — read-only console for a Field payment intent
 * that has not yet been converted into a canonical order.
 *
 * Field agents create `field_payment_intents` rows (often with a linked
 * `field_quotes` row) before the customer actually pays. Until the
 * webhook materializes them into `public.orders`, the canonical order
 * detail page can't find anything — we render this panel instead so
 * Core staff can still see the customer, items, and total, and process
 * the card_manual payment when applicable.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShoppingCart, MapPin, Mail, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { CoreCardManualPanel } from "@/core-app/components/order-detail/CoreCardManualPanel";

type Props = { intentId: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const FIELD_REF_RE = /^#?FIELD-([0-9a-f]{8})$/i;

const money = (n: number | null | undefined) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export function CoreFieldIntentDetail({ intentId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["core-field-intent-detail", intentId],
    queryFn: async () => {
      const normalized = decodeURIComponent(intentId).trim();
      const fieldRef = normalized.match(FIELD_REF_RE)?.[1]?.toLowerCase();
      let intent: any = null;
      let e1: any = null;

      if (UUID_RE.test(normalized)) {
        const res = await supabase
          .from("field_payment_intents" as any)
          .select("*")
          .eq("id", normalized)
          .maybeSingle();
        intent = res.data;
        e1 = res.error;
      } else if (fieldRef) {
        const res = await supabase
          .from("field_payment_intents" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        intent = (res.data || []).find((row: any) => String(row.id).toLowerCase().startsWith(fieldRef)) || null;
        e1 = res.error;
      }
      if (e1) throw e1;
      if (!intent) return null;

      let quote: any = null;
      if ((intent as any).quote_id) {
        const { data: q } = await supabase
          .from("field_quotes" as any)
          .select("*")
          .eq("id", (intent as any).quote_id)
          .maybeSingle();
        quote = q;
      }

      let agent: any = null;
      if ((intent as any).agent_id) {
        const { data: a } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .eq("user_id", (intent as any).agent_id)
          .maybeSingle();
        agent = a;
      }

      return { intent, quote, agent };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-[#0a0e16]">
        <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
        <span className="ml-3 text-xs text-[#8b9ab0]">Chargement de la commande terrain…</span>
      </div>
    );
  }

  if (error || !data?.intent) {
    return (
      <div className="rounded-lg border border-[#7f0000] bg-[#2d0a0a] p-8 text-center">
        <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-[#ef9a9a]" />
        <p className="text-[#ef9a9a] font-medium text-sm">Commande introuvable</p>
        <p className="text-xs text-[#8b9ab0] mt-1">
          Cette intention de paiement terrain n'existe plus.
        </p>
        <Link to={corePath("/orders")} className="text-[#64b5f6] text-xs mt-3 inline-block hover:opacity-80">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  const intent: any = data.intent;
  const quote: any = data.quote;
  const agent: any = data.agent;
  const client = (quote?.client_info as any) || {};
  const services: any[] = Array.isArray(quote?.services) ? quote.services : [];
  const equipment: any[] = Array.isArray(quote?.equipment) ? quote.equipment : [];

  const customerName =
    intent.customer_name ||
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    "—";
  const customerEmail = intent.customer_email || client.email || "—";
  const customerPhone = client.phone || "—";
  const fullAddress = [client.address, client.city, client.postal_code]
    .filter(Boolean)
    .join(", ");

  const intentRef = `FIELD-${String(intent.id).slice(0, 8).toUpperCase()}`;

  return (
    <div className="space-y-2">
      <Link
        to={corePath("/orders")}
        className="inline-flex items-center gap-1.5 text-[11px] text-[#6b7a90] hover:text-white transition-colors mb-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Commandes
      </Link>

      {/* Card manual processing CTA (renders only if a pending card intent exists) */}
      {intent.payment_method === "card_manual" && (
        <CoreCardManualPanel orderId={intent.id} orderReference={intent.quote_id || null} />
      )}

      <div className="rounded-lg border border-[#1e2535] bg-[#0a0e16] p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#6b7a90]">
              Vente terrain · {intent.payment_method || "—"}
            </div>
            <div className="text-white font-semibold text-base mt-0.5">{intentRef}</div>
            <div className="text-[11px] text-[#8b9ab0] mt-1">
              Créée le {new Date(intent.created_at).toLocaleString("fr-CA")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-[#6b7a90]">Statut</div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 mt-0.5">
              {intent.status}
            </div>
            <div className="text-white font-semibold text-base mt-1">{money(intent.amount)}</div>
          </div>
        </div>

        {/* Notice */}
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200">
          ⏳ Cette commande terrain n'a pas encore été matérialisée dans Nivra Core
          (le paiement n'est pas confirmé). Toutes les informations capturées par
          l'agent sont visibles ci-dessous.
        </div>

        {/* Client */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border border-[#1e2535] bg-[#0b1220] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#6b7a90] mb-2">Client</div>
            <div className="space-y-1.5 text-xs text-[#cfd6e2]">
              <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-[#6b7a90]" />{customerName}</div>
              <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#6b7a90]" />{customerEmail}</div>
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#6b7a90]" />{customerPhone}</div>
              {fullAddress && (
                <div className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 text-[#6b7a90] mt-0.5" />{fullAddress}</div>
              )}
            </div>
          </div>

          <div className="rounded border border-[#1e2535] bg-[#0b1220] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#6b7a90] mb-2">Agent terrain</div>
            <div className="space-y-1.5 text-xs text-[#cfd6e2]">
              <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-[#6b7a90]" />{agent?.full_name || "—"}</div>
              <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#6b7a90]" />{agent?.email || "—"}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        {(services.length > 0 || equipment.length > 0) && (
          <div className="rounded border border-[#1e2535] bg-[#0b1220] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#6b7a90] mb-2">Articles</div>
            <div className="space-y-1.5 text-xs text-[#cfd6e2]">
              {services.map((s, i) => (
                <div key={`s-${i}`} className="flex justify-between gap-3">
                  <span>{s.name || s.label || s.plan_name || "Service"}</span>
                  <span className="text-[#cfd6e2]">{money(s.price ?? s.monthly_price ?? s.amount)}</span>
                </div>
              ))}
              {equipment.map((e, i) => (
                <div key={`e-${i}`} className="flex justify-between gap-3">
                  <span>{e.name || e.label || "Équipement"} {e.quantity ? `× ${e.quantity}` : ""}</span>
                  <span className="text-[#cfd6e2]">{money(e.price ?? e.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        {quote && (
          <div className="rounded border border-[#1e2535] bg-[#0b1220] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#6b7a90] mb-2">Totaux</div>
            <div className="space-y-1 text-xs text-[#cfd6e2]">
              <div className="flex justify-between"><span>Sous-total</span><span>{money(quote.subtotal)}</span></div>
              {Number(quote.activation_fee) > 0 && (
                <div className="flex justify-between"><span>Frais d'activation</span><span>{money(quote.activation_fee)}</span></div>
              )}
              <div className="flex justify-between"><span>TPS</span><span>{money(quote.tps)}</span></div>
              <div className="flex justify-between"><span>TVQ</span><span>{money(quote.tvq)}</span></div>
              <div className="flex justify-between font-semibold text-white pt-1 border-t border-[#1e2535]">
                <span>Total</span><span>{money(quote.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
