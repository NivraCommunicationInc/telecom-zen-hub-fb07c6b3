/**
 * CoreAutopayPanel — Inscription/désactivation Square PPA depuis Nivra Core / OneView.
 *
 * Staff peut, par téléphone ou en agence, saisir la carte du client via le widget Square
 * (mêmes edge functions que le portail client, avec channel="core"/"hub").
 * Écrit note automatique + email officiel au client.
 */
import { useEffect, useRef, useState } from "react";
import { Panel, PanelHeader } from "./Account360Helpers";
import { CreditCard, CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";
const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface Props {
  billingCustomerId: string;
  /** "core" (Nivra Core admin) ou "hub" (OneView agent). */
  channel?: "core" | "hub";
  staffActorName?: string | null;
}

export const CoreAutopayPanel = ({ billingCustomerId, channel = "core", staffActorName = null }: Props) => {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [sqLoading, setSqLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: cardData, isLoading } = useQuery({
    queryKey: ["core-autopay-card", billingCustomerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_customers")
        .select("id, email, first_name, last_name, square_card_id, square_card_brand, square_card_last4, square_card_exp_month, square_card_exp_year, autopay_enabled")
        .eq("id", billingCustomerId)
        .maybeSingle();
      return data;
    },
    enabled: !!billingCustomerId,
  });

  const hasCard = !!cardData?.square_card_id;

  useEffect(() => {
    if (!showForm) {
      cardRef.current?.destroy?.();
      cardRef.current = null;
      return;
    }
    if (!containerRef.current) return;
    let destroyed = false;
    setSqLoading(true);
    const init = async () => {
      try {
        if (!(window as any).Square) {
          await new Promise<void>((resolve, reject) => {
            if (document.querySelector('script[src*="web.squarecdn.com"]')) {
              const poll = setInterval(() => {
                if ((window as any).Square) { clearInterval(poll); resolve(); }
              }, 100);
              return;
            }
            const s = document.createElement("script");
            s.src = "https://web.squarecdn.com/v1/square.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Impossible de charger Square"));
            document.head.appendChild(s);
          });
        }
        if (destroyed) return;
        const payments = (window as any).Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        await card.attach(containerRef.current!);
        if (destroyed) { card.destroy(); return; }
        cardRef.current = card;
        setSqLoading(false);
      } catch (e: any) {
        if (!destroyed) { toast.error("Erreur Square : " + (e?.message || String(e))); setSqLoading(false); }
      }
    };
    init();
    return () => { destroyed = true; cardRef.current?.destroy?.(); cardRef.current = null; };
  }, [showForm]);

  const handleSave = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        toast.error(result.errors?.[0]?.message || "Informations de carte invalides");
        return;
      }
      const res = await fetch(`${BACKEND_URL}/functions/v1/square-save-card`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_id: result.token,
          customer_id: billingCustomerId,
          channel,
          staff_actor_name: staffActorName,
        }),
      });
      const data = await res.json();
      if (!data?.ok) { toast.error(data?.error || "Erreur Square"); return; }
      toast.success("Paiement automatique activé pour le client — email de confirmation envoyé.");
      qc.invalidateQueries({ queryKey: ["core-autopay-card", billingCustomerId] });
      setShowForm(false);
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleDetach = async () => {
    if (!confirm("Désactiver le paiement automatique de ce client ? Un email de confirmation lui sera envoyé.")) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/functions/v1/square-detach-card`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customer_id: billingCustomerId, channel, staff_actor_name: staffActorName }),
      });
      const data = await res.json();
      if (!data?.ok) { toast.error(data?.error || "Erreur"); return; }
      toast.success("Paiement automatique désactivé.");
      qc.invalidateQueries({ queryKey: ["core-autopay-card", billingCustomerId] });
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Panel>
        <PanelHeader icon={CreditCard} title="Paiement automatique (Square)" />
        <div className="p-3 flex items-center gap-2 text-[11px] text-core-text-label">
          <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
        </div>
      </Panel>
    );
  }

  return (
    <Panel className={hasCard ? "border-emerald-500/30" : undefined}>
      <PanelHeader icon={CreditCard} title="Paiement automatique (Square)" />
      <div className="p-3 space-y-2">
        {hasCard && !showForm ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-400">Autopay actif</span>
              <span className="text-[11px] font-mono rounded bg-[hsl(220,15%,18%)] px-2 py-0.5 text-core-text-primary border border-[hsl(220,15%,22%)]">
                {cardData?.square_card_brand} •••• {cardData?.square_card_last4}
              </span>
              {cardData?.square_card_exp_month && cardData?.square_card_exp_year && (
                <span className="text-[10px] text-core-text-label">
                  exp. {String(cardData.square_card_exp_month).padStart(2, "0")}/{cardData.square_card_exp_year}
                </span>
              )}
            </div>
            <p className="text-[10px] text-core-text-label flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 shrink-0" />
              La carte sera débitée automatiquement à chaque renouvellement. Rabais 5$/mois appliqué.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1 rounded-md bg-[hsl(220,15%,18%)] px-3 py-1.5 text-[11px] font-medium text-core-text-primary hover:bg-[hsl(220,15%,22%)] border border-[hsl(220,15%,22%)]"
              >
                Changer la carte
              </button>
              <button
                onClick={handleDetach}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />} Désactiver
              </button>
            </div>
          </>
        ) : showForm ? (
          <>
            <p className="text-[11px] text-core-text-secondary">
              Saisissez la carte du client (avec son autorisation verbale). La carte est stockée chez Square (PCI-DSS) — Nivra ne voit jamais le numéro complet.
            </p>
            <div ref={containerRef} className="min-h-[90px] rounded-md bg-white p-2" />
            {sqLoading && (
              <div className="flex items-center gap-1 text-[10px] text-core-text-label">
                <Loader2 className="h-3 w-3 animate-spin" /> Chargement du widget Square…
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-[hsl(220,15%,18%)] px-3 py-1.5 text-[11px] font-medium text-core-text-primary hover:bg-[hsl(220,15%,22%)] border border-[hsl(220,15%,22%)] disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || sqLoading}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? <><Loader2 className="h-3 w-3 animate-spin" /> Enregistrement…</> : <><CreditCard className="h-3 w-3" /> Activer autopay</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-core-text-secondary">
              Ce client n'a pas de carte enregistrée. Inscrivez-le au paiement automatique (avec son autorisation verbale).
              Rabais de 5$/mois automatique. Email officiel envoyé au client à l'activation.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500"
            >
              <CreditCard className="h-3 w-3" /> Inscrire au paiement automatique
            </button>
          </>
        )}
      </div>
    </Panel>
  );
};
