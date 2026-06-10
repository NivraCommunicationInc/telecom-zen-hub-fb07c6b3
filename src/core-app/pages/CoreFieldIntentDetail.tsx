import type { ReactNode } from "react";
import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { ArrowLeft, CreditCard, ExternalLink, Loader2, Mail, RefreshCw, User } from "lucide-react";

export default function CoreFieldIntentDetail() {
  const { intentId } = useParams<{ intentId: string }>();
  const navigate = useNavigate();

  if (!intentId) {
    return (
      <div className="py-20 text-center">
        <CreditCard className="h-8 w-8 mx-auto mb-2 text-[#6b7a90]" />
        <p className="text-[#8b9ab0] text-xs">Vente terrain introuvable</p>
        <Link to={corePath("/orders")} className="text-[#64b5f6] text-xs mt-2 inline-block hover:opacity-80">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  return <FieldIntentConsole intentId={intentId} onConvertedOrder={(orderId) => navigate(corePath(`/orders/${orderId}`))} />;
}

function FieldIntentConsole({ intentId, onConvertedOrder }: { intentId: string; onConvertedOrder: (id: string) => void }) {
  const pending = useQuery({
    queryKey: ["core-field-intent-direct", intentId],
    queryFn: async () => {
      const { data: intent, error } = await supabase
        .from("field_payment_intents" as any)
        .select("id, quote_id, agent_id, amount, currency, status, payment_method, customer_name, customer_email, paypal_order_id, paypal_approval_url, paid_at, expires_at, converted_order_id, created_at")
        .eq("id", intentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!intent) throw new Error("Vente terrain introuvable");

      const intentAny = intent as any;
      if (intentAny.converted_order_id) {
        return { intent: intentAny, quote: null, agent: null, convertedOrderId: intentAny.converted_order_id as string };
      }

      const { data: quote } = intentAny.quote_id
        ? await supabase
            .from("field_quotes" as any)
            .select("client_info, services, equipment, discount, activation_fee, subtotal, tps, tvq, total, status, agent_name, valid_until")
            .eq("id", intentAny.quote_id)
            .maybeSingle()
        : { data: null };

      const { data: agent } = intentAny.agent_id
        ? await supabase.from("profiles").select("full_name, email").eq("user_id", intentAny.agent_id).maybeSingle()
        : { data: null };

      return { intent: intentAny, quote: quote as any, agent: agent as any, convertedOrderId: null as string | null };
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (pending.data?.convertedOrderId) {
      onConvertedOrder(pending.data.convertedOrderId);
    }
  }, [pending.data?.convertedOrderId]);

  if (pending.isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-[#0a0e16]">
        <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
        <span className="ml-3 text-xs text-[#8b9ab0]">Chargement de la vente terrain…</span>
      </div>
    );
  }

  if (pending.error || !pending.data?.intent) {
    return (
      <div className="rounded-lg border border-[#7f0000] bg-[#2d0a0a] p-8 text-center">
        <p className="text-[#ef9a9a] font-medium text-sm">Erreur de chargement</p>
        <p className="text-xs text-[#8b9ab0] mt-1">
          {pending.error instanceof Error ? pending.error.message : "Vente terrain introuvable"}
        </p>
        <Link to={corePath("/orders")} className="text-[#64b5f6] text-xs mt-3 inline-block hover:opacity-80">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  const intent = pending.data.intent;
  const quote = pending.data.quote;
  const agent = pending.data.agent;
  const clientInfo = quote?.client_info || {};
  const clientName = intent.customer_name || [clientInfo.first_name, clientInfo.last_name].filter(Boolean).join(" ") || "—";
  const clientEmail = intent.customer_email || clientInfo.email || "—";
  const services: any[] = Array.isArray(quote?.services) ? quote.services : [];
  const equipment: any[] = Array.isArray(quote?.equipment) ? quote.equipment : [];
  const amount = Number(intent.amount || quote?.total || 0).toLocaleString("fr-CA", { style: "currency", currency: intent.currency || "CAD" });
  const paymentUrl = `${window.location.origin}/payer/${intent.id}`;
  const expired = intent.expires_at && new Date(intent.expires_at).getTime() < Date.now();

  return (
    <div className="space-y-3">
      <Link to={corePath("/orders")} className="inline-flex items-center gap-1.5 text-[11px] text-[#6b7a90] hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Commandes
      </Link>

      <div className="rounded-lg border border-[#1e2535] bg-[#0a0e16] overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#1e2535] bg-[#0f1623] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#a78bfa] text-[11px] font-semibold uppercase tracking-wide">
              <CreditCard className="h-4 w-4" /> Vente terrain en attente de paiement
            </div>
            <h1 className="text-white text-xl font-bold mt-1">FIELD-{String(intent.id).slice(0, 8).toUpperCase()}</h1>
            <p className="text-[#8b9ab0] text-xs mt-1">La commande Core sera créée automatiquement dès que le paiement est confirmé.</p>
          </div>
          <div className="text-right">
            <div className="text-white text-2xl font-bold">{amount}</div>
            <div className={`text-[11px] font-semibold ${expired ? "text-red-300" : "text-amber-300"}`}>
              {expired ? "Lien expiré" : intent.status || "pending"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InfoTile icon={<User className="h-4 w-4" />} label="Client" value={clientName} sub={clientEmail} />
              <InfoTile icon={<Mail className="h-4 w-4" />} label="Agent" value={quote?.agent_name || agent?.full_name || "—"} sub={agent?.email || ""} />
              <InfoTile icon={<CreditCard className="h-4 w-4" />} label="Paiement" value={intent.payment_method || "PayPal"} sub={intent.paypal_order_id || "En attente"} />
            </div>

            <DetailSection title="Services">
              {services.length ? services.map((item, idx) => <LineItem key={`s-${idx}`} item={item} />) : <EmptyLine />}
            </DetailSection>

            <DetailSection title="Équipement">
              {equipment.length ? equipment.map((item, idx) => <LineItem key={`e-${idx}`} item={item} />) : <EmptyLine />}
            </DetailSection>
          </div>

          <aside className="border-l border-[#1e2535] bg-[#0d121d] p-5 space-y-3">
            <a href={paymentUrl} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#7C3AED] hover:bg-[#6d28d9] px-4 py-2.5 text-xs font-bold text-white transition-colors">
              <ExternalLink className="h-4 w-4" /> Ouvrir lien client
            </a>
            {intent.paypal_approval_url && (
              <a href={intent.paypal_approval_url} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#7C3AED]/50 bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 px-4 py-2.5 text-xs font-bold text-[#c4b5fd] transition-colors">
                <ExternalLink className="h-4 w-4" /> Ouvrir PayPal
              </a>
            )}
            <button onClick={() => pending.refetch()} className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#263247] bg-[#101827] hover:bg-[#162036] px-4 py-2.5 text-xs font-bold text-[#c0c9d8] transition-colors">
              <RefreshCw className="h-4 w-4" /> Vérifier statut
            </button>
            <div className="rounded-lg border border-[#263247] bg-[#0a0e16] p-3 text-[11px] text-[#8b9ab0] space-y-1">
              <div>ID intent: <span className="font-mono text-white">{intent.id}</span></div>
              <div>Soumission: <span className="font-mono text-white">{intent.quote_id || "—"}</span></div>
              <div>Expire: <span className="text-white">{intent.expires_at ? new Date(intent.expires_at).toLocaleString("fr-CA") : "—"}</span></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#1e2535] bg-[#0f1623] p-3">
      <div className="flex items-center gap-1.5 text-[#8b9ab0] text-[10px] uppercase font-semibold">{icon}{label}</div>
      <div className="text-white text-sm font-semibold mt-1 truncate">{value}</div>
      {sub && <div className="text-[#6b7a90] text-[11px] truncate">{sub}</div>}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#1e2535] bg-[#0f1623] p-4">
      <h2 className="text-[11px] text-[#8b9ab0] font-semibold uppercase mb-2">{title}</h2>
      <div className="divide-y divide-[#1e2535]">{children}</div>
    </div>
  );
}

function LineItem({ item }: { item: any }) {
  const name = item?.name || item?.label || item?.title || "Article";
  const price = Number(item?.monthlyPrice ?? item?.monthly_price ?? item?.price ?? item?.unit_price ?? item?.amount ?? 0);
  const quantity = Number(item?.quantity || 1);
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-xs">
      <span className="text-white truncate">{name}{quantity > 1 ? ` ×${quantity}` : ""}</span>
      <span className="text-[#c0c9d8] font-mono">
        {(price * quantity).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
      </span>
    </div>
  );
}

function EmptyLine() {
  return <div className="py-2 text-xs text-[#6b7a90]">Aucun élément.</div>;
}
