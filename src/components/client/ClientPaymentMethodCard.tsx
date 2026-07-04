import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";

export const ClientPaymentMethodCard = () => {
  const { user } = useClientAuth();
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [sqLoading, setSqLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: cardData, isLoading } = useQuery({
    queryKey: ["square-card-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await portalClient
        .from("billing_customers")
        .select("id, square_card_id, square_card_last4, square_card_brand, square_card_exp_month, square_card_exp_year")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const hasCard = !!cardData?.square_card_id;

  // Initialize Square card widget when the form div is rendered.
  // For users WITH a card: form only shows when showForm=true (Modifier la carte).
  // For users WITHOUT a card: form is always visible, so init immediately (showForm stays false).
  useEffect(() => {
    if (hasCard && !showForm) {
      cardRef.current?.destroy?.();
      cardRef.current = null;
      return;
    }
    if (!containerRef.current) return; // form div not in DOM yet (still loading)
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
    return () => {
      destroyed = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, [showForm, hasCard]);

  const handleSaveCard = async () => {
    if (!cardRef.current || !user?.id) return;
    if (!cardData?.id) {
      toast.error("Client introuvable — rechargez la page");
      return;
    }
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
        body: JSON.stringify({ source_id: result.token, customer_id: cardData.id, channel: "portal" }),
      });
      const data = await res.json();
      if (!data?.ok) { toast.error(data?.error || "Erreur lors de l'enregistrement"); return; }

      toast.success("Carte enregistrée — paiement automatique activé !");
      qc.invalidateQueries({ queryKey: ["square-card-status", user.id] });
      setShowForm(false);
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleDetachCard = async () => {
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
      if (!data?.ok) { toast.error(data?.error || "Erreur lors de la désactivation"); return; }
      toast.success("Paiement automatique désactivé");
      qc.invalidateQueries({ queryKey: ["square-card-status", user.id] });
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
    <Card className={hasCard && !showForm ? "border-emerald-300/50 bg-emerald-50/30" : "border-primary/20"}>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base ${hasCard && !showForm ? "text-emerald-700" : ""}`}>
          <CreditCard className="h-4 w-4" />
          Paiement automatique
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasCard && !showForm ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">Autopay actif</span>
              <Badge variant="secondary" className="text-xs">
                {cardData.square_card_brand} ••••{cardData.square_card_last4}
              </Badge>
              {cardData.square_card_exp_month && cardData.square_card_exp_year && (
                <span className="text-xs text-muted-foreground">
                  exp.&nbsp;{String(cardData.square_card_exp_month).padStart(2, "0")}/{cardData.square_card_exp_year}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 shrink-0" />
              Votre abonnement se renouvelle automatiquement chaque mois. Rabais de 5 $/mois inclus.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              Modifier la carte
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {hasCard ? "Remplacer votre carte" : "Activer le prélèvement automatique"}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasCard
                  ? "La nouvelle carte remplace l'ancienne pour les prochains renouvellements."
                  : "Enregistrez une carte pour que votre abonnement se renouvelle automatiquement. Rabais de 5 $/mois inclus."}
              </p>
            </div>
            <div ref={containerRef} id="sq-autopay-card" className="min-h-[90px]" />
            {sqLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
              </div>
            )}
            <div className="flex gap-2">
              {hasCard && (
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
                  Annuler
                </Button>
              )}
              <Button size="sm" onClick={handleSaveCard} disabled={saving || sqLoading}>
                {saving
                  ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Enregistrement…</>
                  : <><CreditCard className="h-3 w-3 mr-1" /> {hasCard ? "Remplacer la carte" : "Activer l'autopay"}</>}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
