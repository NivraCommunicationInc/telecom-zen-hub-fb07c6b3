import { useState, useMemo } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { toast } from "sonner";
import { Loader2, ArrowUp, ArrowDown, Check, Zap, Receipt } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

type Plan = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  features_json: any;
  category: string | null;
};

type Subscription = {
  id: string;
  plan_name: string | null;
  plan_price: number | null;
  status: string;
  next_renewal_at: string | null;
  service_category: string | null;
};

const ClientChangePlan = () => {
  const { user } = useClientAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<(Plan & { diff: number; changeType: "upgrade" | "downgrade" | "current"; isCurrent: boolean }) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { data: canonicalData, isLoading: canonicalLoading } = useCanonicalClientData(user?.id);

  const subscription = useMemo<Subscription | null>(() => {
    const subs = (canonicalData?.subscriptions || [])
      .filter((sub: any) => ["active", "pending"].includes(String(sub?.status || "").toLowerCase()))
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return (subs[0] as Subscription | undefined) ?? null;
  }, [canonicalData?.subscriptions]);

  const account = canonicalData?.account;

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["change-plan-available"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await portalSupabase
        .from("services")
        .select("id, name, price, description, features_json, category")
        .eq("is_active", true)
        .in("category", ["internet", "bundle", "tv", "combo"])
        .order("price", { ascending: true });
      if (error) throw error;
      return (data as Plan[]) || [];
    },
  });

  const currentPrice = subscription?.plan_price ?? 0;
  const currentName = subscription?.plan_name ?? "—";

  const hasBundle = ["bundle", "combo"].includes((subscription?.service_category || "").toLowerCase());

  const enrichedPlans = useMemo(() => {
    return (plans || [])
      .filter((p) => {
        // If client has TV+Internet bundle/combo, hide internet-only plans
        if (hasBundle && p.category === "internet") return false;
        return true;
      })
      .map((p) => {
        const isCurrent = subscription?.plan_name?.toLowerCase() === p.name.toLowerCase();
        const diff = p.price - currentPrice;
        const changeType: "upgrade" | "downgrade" | "current" = isCurrent
          ? "current"
          : diff > 0
            ? "upgrade"
            : "downgrade";
        return { ...p, isCurrent, diff, changeType };
      });
  }, [plans, subscription, currentPrice, hasBundle]);

  const effectiveDate = subscription?.next_renewal_at
    ? format(new Date(subscription.next_renewal_at), "d MMMM yyyy", { locale: fr })
    : "votre prochain renouvellement";

  const prorationPreview = useMemo(() => {
    if (!selected || selected.changeType !== "upgrade" || !subscription?.next_renewal_at) return null;
    const priceDiff = selected.price - currentPrice;
    if (priceDiff <= 0 || currentPrice <= 0) return null;
    const today = new Date();
    const cycleEnd = new Date(subscription.next_renewal_at);
    const daysRemaining = Math.max(1, Math.ceil((cycleEnd.getTime() - today.getTime()) / 86_400_000));
    const subtotal = Math.round(priceDiff * (daysRemaining / 30) * 100) / 100;
    if (subtotal < 0.01) return null;
    const tps = Math.round(subtotal * TPS_RATE * 100) / 100;
    const tvq = Math.round(subtotal * TVQ_RATE * 100) / 100;
    const total = Math.round((subtotal + tps + tvq) * 100) / 100;
    return { subtotal, tps, tvq, total, daysRemaining };
  }, [selected, subscription, currentPrice]);

  const handleConfirm = async () => {
    if (!selected || !user?.id || !account?.id) {
      toast.error("Compte introuvable");
      return;
    }
    setSubmitting(true);
    try {
      const changeType = selected.diff > 0 ? "upgrade" : "downgrade";

      const { data, error: fnErr } = await portalSupabase.functions.invoke("client-plan-change", {
        body: {
          account_id: account.id,
          subscription_id: subscription?.id ?? null,
          new_plan_id: selected.id,
          new_plan_name: selected.name,
          new_monthly_price: selected.price,
          previous_plan_name: currentName,
          previous_monthly_price: currentPrice,
          change_type: changeType,
        },
      });
      if (fnErr) throw fnErr;
      if (!data?.ok) throw new Error(data?.error || "Erreur inconnue");

      if (changeType === "upgrade") {
        const totalFmt = data.proration_total
          ? `${Number(data.proration_total).toFixed(2)} $`
          : "";
        toast.success(
          `Forfait mis à niveau vers ${selected.name}${totalFmt ? ` — facture proratisée de ${totalFmt} générée` : ""}.`,
        );
      } else {
        toast.success("Demande envoyée — changement effectif à votre prochain renouvellement.");
      }
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["canonical-client-data", user.id] });
    } catch (e: any) {
      console.error("[ClientChangePlan]", e);
      toast.error(e?.message || "Erreur lors du changement de forfait");
    } finally {
      setSubmitting(false);
    }
  };

  if (canonicalLoading || plansLoading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold">Changer de forfait</h1>
          <p className="text-muted-foreground mt-1">
            Les mises à niveau sont appliquées immédiatement avec une facture proratisée.
            Les réductions sont effectives à votre prochain renouvellement.
          </p>
        </header>

        {/* Current plan */}
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-primary" />
              Votre forfait actuel
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Nom</div>
              <div className="font-semibold">{currentName}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Prix mensuel</div>
              <div className="font-semibold">{currentPrice.toFixed(2)} $ / mois</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Prochain renouvellement</div>
              <div className="font-semibold">{effectiveDate}</div>
            </div>
          </CardContent>
        </Card>

        {/* Available plans */}
        <section>
          <h2 className="text-xl font-bold mb-3">Forfaits disponibles</h2>
          {enrichedPlans.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">Aucun forfait disponible pour le moment.</p>
                <p className="text-sm text-muted-foreground mt-1">Contactez le support pour modifier votre forfait.</p>
              </CardContent>
            </Card>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrichedPlans.map((p) => (
              <Card
                key={p.id}
                className={`${p.isCurrent ? "border-primary" : "border-border"} flex flex-col`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    {p.isCurrent && <Badge variant="default">Votre forfait</Badge>}
                    {!p.isCurrent && p.changeType === "downgrade" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <ArrowDown className="w-3 h-3" /> Économisez {Math.abs(p.diff).toFixed(2)}$
                      </Badge>
                    )}
                    {!p.isCurrent && p.changeType === "upgrade" && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Plus rapide
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <div className="text-2xl font-bold">
                    {Number(p.price).toFixed(2)} $
                    <span className="text-sm font-normal text-muted-foreground"> / mois</span>
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  )}
                  {Array.isArray(p.features_json) && p.features_json.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {p.features_json.slice(0, 5).map((f: any, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <span>{typeof f === "string" ? f : f?.label || JSON.stringify(f)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-2">
                    {p.isCurrent ? (
                      <Button disabled className="w-full">Forfait actuel</Button>
                    ) : p.changeType === "upgrade" ? (
                      <Button
                        onClick={() => setSelected(p)}
                        className="w-full flex items-center gap-2"
                      >
                        <ArrowUp className="w-4 h-4" /> Mettre à niveau
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setSelected(p)}
                        variant="secondary"
                        className="w-full flex items-center gap-2"
                      >
                        <ArrowDown className="w-4 h-4" /> Passer à ce forfait
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le changement</DialogTitle>
            <DialogDescription>
              Changer de <strong>{currentName}</strong> à <strong>{selected?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Différence mensuelle</span>
                <span className={selected.diff > 0 ? "text-destructive" : "text-green-500"}>
                  {selected.diff > 0 ? "+" : ""}
                  {selected.diff.toFixed(2)} $
                </span>
              </div>
              {selected.changeType === "upgrade" && prorationPreview && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-400 font-medium text-xs uppercase tracking-wide">
                    <Receipt className="w-3.5 h-3.5" />
                    Facture proratisée aujourd'hui
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sous-total ({prorationPreview.daysRemaining} jours restants)</span>
                    <span>{prorationPreview.subtotal.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>TPS (5 %)</span>
                    <span>{prorationPreview.tps.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>TVQ (9,975 %)</span>
                    <span>{prorationPreview.tvq.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-border pt-1.5">
                    <span>Total dû maintenant</span>
                    <span className="text-destructive">{prorationPreview.total.toFixed(2)} $</span>
                  </div>
                </div>
              )}
              {selected.changeType === "downgrade" && (
                <p className="text-xs text-muted-foreground">
                  La réduction sera appliquée à votre prochain renouvellement ({effectiveDate}).
                  Aucun frais supplémentaire.
                </p>
              )}
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Effectif dès</span>
                <span className="font-medium">
                  {selected.changeType === "upgrade" ? "Immédiatement" : effectiveDate}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selected?.changeType === "upgrade" ? "Confirmer et payer" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientChangePlan;
