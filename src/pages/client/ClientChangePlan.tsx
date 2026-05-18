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
import { Loader2, ArrowUp, ArrowDown, Check, Zap } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

  // Current active subscription (pick the most recent active one)
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["client-change-plan-sub", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Subscription | null> => {
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!customer) return null;
      const { data, error } = await portalSupabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_price, status, next_renewal_at, service_category")
        .eq("customer_id", customer.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Subscription | null) ?? null;
    },
  });

  // Active account for the user (for account_id on the request)
  const { data: account } = useQuery({
    queryKey: ["client-change-plan-account", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await portalSupabase
        .from("accounts")
        .select("id, account_number")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["change-plan-available"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await portalSupabase
        .from("services")
        .select("id, name, price, description, features_json, category")
        .eq("is_active", true)
        .in("category", ["internet", "bundle", "tv"])
        .order("price", { ascending: true });
      if (error) throw error;
      return (data as Plan[]) || [];
    },
  });

  const currentPrice = subscription?.plan_price ?? 0;
  const currentName = subscription?.plan_name ?? "—";

  const enrichedPlans = useMemo(() => {
    return (plans || []).map((p) => {
      const isCurrent = subscription?.plan_name?.toLowerCase() === p.name.toLowerCase();
      const diff = p.price - currentPrice;
      const changeType: "upgrade" | "downgrade" | "current" = isCurrent
        ? "current"
        : diff > 0
          ? "upgrade"
          : "downgrade";
      return { ...p, isCurrent, diff, changeType };
    });
  }, [plans, subscription, currentPrice]);

  const effectiveDate = subscription?.next_renewal_at
    ? format(new Date(subscription.next_renewal_at), "d MMMM yyyy", { locale: fr })
    : "votre prochain renouvellement";

  const handleConfirm = async () => {
    if (!selected || !user?.id || !account?.id) {
      toast.error("Compte introuvable");
      return;
    }
    setSubmitting(true);
    try {
      const changeType = selected.diff > 0 ? "upgrade" : selected.diff < 0 ? "downgrade" : "change";

      const { error: insertErr } = await portalSupabase
        .from("service_change_requests")
        .insert({
          account_id: account.id,
          client_id: user.id,
          subscription_id: subscription?.id ?? null,
          current_plan_name: currentName,
          requested_plan_id: selected.id,
          requested_plan_name: selected.name,
          change_type: changeType,
          status: "pending",
          requested_by: user.id,
          notes: `Client self-serve request via portal. Effective: ${effectiveDate}.`,
        });
      if (insertErr) throw insertErr;

      // Confirmation email to client (bilingual via trigger)
      await portalSupabase.from("email_queue").insert({
        to_email: user.email,
        template_key: "plan_change_requested",
        event_key: "plan_change_requested",
        message_type: "transactional",
        template_vars: {
          client_name: user.user_metadata?.first_name || user.email,
          current_plan_name: currentName,
          requested_plan_name: selected.name,
          effective_date: effectiveDate,
          change_type: changeType,
        },
      });

      // Internal alert (FR — admin language)
      await portalSupabase.from("email_queue").insert({
        to_email: "admin@nivra-telecom.ca",
        template_key: "plan_change_admin_alert",
        event_key: "plan_change_admin_alert",
        message_type: "transactional",
        template_vars: {
          client_name: user.user_metadata?.first_name || user.email,
          current_plan_name: currentName,
          requested_plan_name: selected.name,
          account_number: account.account_number,
        },
      });

      toast.success("Demande envoyée — vous serez notifié dès l'approbation.");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["client-change-plan-sub"] });
    } catch (e: any) {
      console.error("[ClientChangePlan]", e);
      toast.error(e?.message || "Erreur lors de l'envoi de la demande");
    } finally {
      setSubmitting(false);
    }
  };

  if (subLoading || plansLoading) {
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
            Modifiez votre forfait en ligne. Le changement sera effectif à votre prochain renouvellement.
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
              {selected.diff < 0 && (
                <p className="text-xs text-muted-foreground">
                  Un crédit prorata sera calculé sur votre prochaine facture.
                </p>
              )}
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Effectif dès</span>
                <span className="font-medium">{effectiveDate}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientChangePlan;
