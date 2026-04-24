/**
 * CoreCardManualPanel — shows pending card_manual intent for the current order
 * and lets a Core admin trigger the PayPal capture via core-process-card-payment.
 *
 * Visible only when:
 *   - the order's `payment_method = 'card_manual'`
 *   - a matching `card_payment_intents` row exists (status pending_processing|processing)
 *
 * After successful capture, the row is deleted by the edge function and this
 * panel disappears on next refetch.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orderId: string;
  orderReference?: string | null; // quote id used as order_reference in CPI
}

export function CoreCardManualPanel({ orderId, orderReference }: Props) {
  const qc = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: intent, isLoading, refetch } = useQuery({
    queryKey: ["core-card-intent", orderId, orderReference],
    queryFn: async () => {
      // 1) Try to resolve via field_payment_intents.converted_order_id → its id
      //    is referenced by card_payment_intents.field_payment_intent_id.
      const { data: fpi } = await supabase
        .from("field_payment_intents")
        .select("id, quote_id")
        .eq("converted_order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const candidates = new Set<string>();
      if (fpi?.id) candidates.add(fpi.id);

      // 2) Fall back to order_reference (quote id) lookup for non-converted orders.
      const refs = [orderReference, fpi?.quote_id].filter(Boolean) as string[];

      let q = supabase
        .from("card_payment_intents")
        .select("id, card_last4, card_brand, card_expiry, card_name, amount, currency, status, expires_at, customer_email, field_payment_intent_id, order_reference")
        .in("status", ["pending_processing", "processing"])
        .order("created_at", { ascending: false })
        .limit(5);

      const { data, error } = await q;
      if (error) {
        console.warn("[CoreCardManualPanel] query error", error);
        return null;
      }
      const match = (data || []).find((row: any) =>
        (row.field_payment_intent_id && candidates.has(row.field_payment_intent_id)) ||
        (row.order_reference && refs.includes(row.order_reference)),
      );
      return match || null;
    },
    refetchInterval: 30000,
  });

  if (isLoading) return null;
  if (!intent) return null;

  const handleProcess = async () => {
    setError(null);
    setProcessing(true);
    try {
      const { data, error: invErr } = await supabase.functions.invoke(
        "core-process-card-payment",
        { body: { card_intent_id: intent.id } },
      );
      if (invErr) throw invErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Paiement carte confirmé", {
        description: `PayPal ${(data as any)?.paypal_order_id?.slice(0, 8) || ""}`,
      });
      await refetch();
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["admin-orders-v2"] });
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      toast.error("Paiement refusé", { description: msg });
    } finally {
      setProcessing(false);
    }
  };

  const expiresMs = new Date(intent.expires_at).getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(expiresMs / 3600000));

  return (
    <div className="rounded-lg border border-[#7C3AED]/40 bg-gradient-to-br from-[#1a1033] to-[#0f0a1f] p-4 shadow-lg">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-[#A78BFA]" />
          <h3 className="text-sm font-semibold text-white">
            💳 Paiement carte manuelle en attente
          </h3>
        </div>
        <span className="text-[10px] text-[#A78BFA] font-medium">
          Expire dans {hoursLeft} h
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-[12px]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6b7a90]">Marque</div>
          <div className="text-white font-medium">{(intent.card_brand || "card").toUpperCase()}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6b7a90]">N°</div>
          <div className="text-white font-mono">•••• {intent.card_last4}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6b7a90]">Expiration</div>
          <div className="text-white font-mono">{intent.card_expiry}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6b7a90]">Titulaire</div>
          <div className="text-white truncate" title={intent.card_name}>{intent.card_name}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[#8b9ab0] mb-3">
        <ShieldCheck className="h-3.5 w-3.5 text-[#A78BFA]" />
        Données chiffrées (AES-256-GCM). Supprimées automatiquement après 48 h ou à la fin du traitement.
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded border border-red-500/40 bg-red-500/10 p-2 mb-3 text-[11px] text-red-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <button
        type="button"
        onClick={handleProcess}
        disabled={processing}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-[12px] font-semibold text-white transition-colors"
      >
        {processing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Traitement PayPal en cours…</>
        ) : (
          <>Traiter le paiement via PayPal — {Number(intent.amount).toLocaleString("fr-CA", { style: "currency", currency: intent.currency || "CAD" })}</>
        )}
      </button>
    </div>
  );
}
