/**
 * ClientPaymentMethodCard — Activation autopay via Square (card-on-file / PPA)
 * depuis le portail client. Le client saisit sa carte dans le widget Square hébergé
 * (PCI-DSS chez Square, Nivra ne voit jamais le numéro complet).
 */
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";
const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const ClientPaymentMethodCard = () => {
  const { user } = useClientAuth();
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [sqLoading, setSqLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: cardData, isLoading } = useQuery({
    queryKey: ["client-square-card", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("billing_customers")
        .select("id, square_card_id, square_card_brand, square_card_last4, square_card_exp_month, square_card_exp_year, autopay_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
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
        if (!destroyed) {
          toast.error("Erreur Square : " + (e?.message || String(e)));
          setSqLoading(false);
        }
      }
    };
    init();
    return () => { destroyed = true; cardRef.current?.destroy?.(); cardRef.current = null; };
  }, [showForm]);

  const handleSave = async () => {
    if (!cardRef.current || !user?.id) return;
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
          user_id: user.id,
          customer_id: cardData?.id,
          channel: "portal",
        }),
      });
      const data = await res.json();
      if (!data?.ok) { toast.error(data?.error || "Erreur Square"); return; }
      toast.success("Paiement automatique activé !");
      qc.invalidateQueries({ queryKey: ["client-square-card", user.id] });
      setShowForm(false);
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleDetach = async () => {
    if (!cardData?.id) return;
    if (!confirm("Désactiver le paiement automatique ? Vos prochaines factures devront être payées manuellement.")) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/functions/v1/square-detach-card`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customer_id: cardData.id, channel: "portal" }),
      });
      const data = await res.json();
      if (!data?.ok) { toast.error(data?.error || "Erreur"); return; }
      toast.success("Paiement automatique désactivé.");
      qc.invalidateQueries({ queryKey: ["client-square-card", user?.id] });
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasCard ? "border-emerald-300/50 bg-emerald-50/30" : "border-primary/20"}>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base ${hasCard ? "text-emerald-700" : ""}`}>
          <CreditCard className="h-4 w-4" />
          Paiement automatique (Square)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasCard && !showForm ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">Autopay actif</span>
              <Badge variant="secondary" className="text-xs font-mono">
                {cardData?.square_card_brand} •••• {cardData?.square_card_last4}
              </Badge>
              {cardData?.square_card_exp_month && cardData?.square_card_exp_year && (
                <span className="text-xs text-muted-foreground">
                  exp. {String(cardData.square_card_exp_month).padStart(2, "0")}/{cardData.square_card_exp_year}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 shrink-0" />
              Votre carte sera débitée automatiquement à chaque renouvellement. Rabais de 5 $/mois inclus.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                Changer la carte
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDetach}
                disabled={saving}
                className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
                Désactiver
              </Button>
            </div>
          </>
        ) : showForm ? (
          <>
            <p className="text-xs text-muted-foreground">
              Votre carte est enregistrée en sécurité chez Square (PCI-DSS). Nivra ne voit jamais le numéro complet.
            </p>
            <div ref={containerRef} className="min-h-[90px] rounded-md border bg-white p-2" />
            {sqLoading && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Chargement du widget Square…
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || sqLoading}>
                {saving
                  ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Enregistrement…</>
                  : <><CreditCard className="h-3 w-3 mr-1" /> Activer autopay</>}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Activer le prélèvement automatique</p>
              <p className="text-xs text-muted-foreground">
                Enregistrez votre carte en une fois pour renouveler votre abonnement automatiquement. Rabais de 5 $/mois inclus.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <CreditCard className="h-3 w-3 mr-1" /> Ajouter ma carte
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
