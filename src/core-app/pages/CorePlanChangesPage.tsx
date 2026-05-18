/**
 * CorePlanChangesPage — Global admin view of all pending plan change requests
 * across all clients. Approve/reject inline; each request resolves its own
 * client + account, current/new plan prices, effective date, and PayPal status.
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Check, X, ArrowRight, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Row = {
  id: string;
  account_id: string;
  client_id: string;
  subscription_id: string | null;
  current_plan_name: string | null;
  requested_plan_id: string | null;
  requested_plan_name: string;
  change_type: string;
  status: string;
  effective_date: string | null;
  created_at: string;
};

type SubMeta = {
  next_renewal_at: string | null;
  paypal_subscription_id: string | null;
  plan_price: number | null;
};

export default function CorePlanChangesPage() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applyNow, setApplyNow] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["core-plan-change-requests", filter],
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from("service_change_requests")
        .select("id, account_id, client_id, subscription_id, current_plan_name, requested_plan_id, requested_plan_name, change_type, status, effective_date, created_at")
        .order("created_at", { ascending: false });
      if (filter === "pending") q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const clientIds = useMemo(
    () => Array.from(new Set((requests || []).map((r) => r.client_id))),
    [requests],
  );
  const accountIds = useMemo(
    () => Array.from(new Set((requests || []).map((r) => r.account_id))),
    [requests],
  );
  const subIds = useMemo(
    () => Array.from(new Set((requests || []).map((r) => r.subscription_id).filter(Boolean) as string[])),
    [requests],
  );

  const { data: clients } = useQuery({
    queryKey: ["core-plan-change-clients", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", clientIds);
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => (map[p.user_id] = p));
      return map;
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["core-plan-change-accounts", accountIds.join(",")],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, account_number")
        .in("id", accountIds);
      const map: Record<string, any> = {};
      (data || []).forEach((a: any) => (map[a.id] = a));
      return map;
    },
  });

  const { data: subMeta } = useQuery({
    queryKey: ["core-plan-change-subs", subIds.join(",")],
    enabled: subIds.length > 0,
    queryFn: async (): Promise<Record<string, SubMeta>> => {
      const { data } = await supabase
        .from("billing_subscriptions")
        .select("id, next_renewal_at, paypal_subscription_id, plan_price")
        .in("id", subIds);
      const map: Record<string, SubMeta> = {};
      (data || []).forEach((s: any) => {
        map[s.id] = {
          next_renewal_at: s.next_renewal_at,
          paypal_subscription_id: s.paypal_subscription_id,
          plan_price: s.plan_price,
        };
      });
      return map;
    },
  });

  // Resolve new plan prices in bulk
  const planIds = useMemo(
    () => Array.from(new Set((requests || []).map((r) => r.requested_plan_id).filter(Boolean) as string[])),
    [requests],
  );
  const { data: planPrices } = useQuery({
    queryKey: ["core-plan-change-plans", planIds.join(",")],
    enabled: planIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, price")
        .in("id", planIds);
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => (map[p.id] = Number(p.price)));
      return map;
    },
  });

  const approve = async (r: Row) => {
    setBusyId(r.id);
    try {
      const meta = r.subscription_id ? subMeta?.[r.subscription_id] : undefined;
      const newPrice = r.requested_plan_id ? planPrices?.[r.requested_plan_id] ?? null : null;
      const currentPrice = meta?.plan_price ?? null;
      const effDate = r.effective_date ? new Date(r.effective_date) : null;
      const now = new Date();
      const isDue = effDate ? effDate.getTime() <= now.getTime() : true;
      const force = !!applyNow[r.id];

      if (r.subscription_id && (isDue || force)) {
        const update: any = { plan_name: r.requested_plan_name };
        if (newPrice !== null) update.plan_price = newPrice;
        const { error } = await supabase
          .from("billing_subscriptions")
          .update(update)
          .eq("id", r.subscription_id);
        if (error) throw error;
      }

      if (force && currentPrice !== null && newPrice !== null && newPrice < currentPrice && effDate) {
        const daysInCycle = 30;
        const msRemaining = effDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.min(daysInCycle, Math.floor(msRemaining / 86400000)));
        const proratedCredit = Number((((currentPrice - newPrice) / daysInCycle) * daysRemaining).toFixed(2));
        if (proratedCredit > 0) {
          await supabase.from("account_adjustments").insert({
            account_id: r.account_id,
            type: "credit",
            amount: proratedCredit,
            description: `Crédit prorata — changement de forfait ${r.current_plan_name || "—"} → ${r.requested_plan_name}`,
            months_total: 1,
            months_remaining: 1,
            status: "active",
          });
        }
      }

      await supabase
        .from("service_change_requests")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", r.id);

      const client = clients?.[r.client_id];
      const effLabel = effDate ? format(effDate, "d MMMM yyyy", { locale: fr }) : "votre prochain renouvellement";
      if (client?.email) {
        await supabase.from("email_queue").insert({
          to_email: client.email,
          template_key: "plan_change_approved",
          event_key: "plan_change_approved",
          message_type: "transactional",
          template_vars: {
            client_name: client.first_name || client.email,
            current_plan_name: r.current_plan_name || "—",
            requested_plan_name: r.requested_plan_name,
            effective_date: effLabel,
          },
        });
      }

      toast.success(
        meta?.paypal_subscription_id
          ? "Approuvé — pensez à mettre à jour PayPal manuellement"
          : "Demande approuvée",
      );
      qc.invalidateQueries({ queryKey: ["core-plan-change-requests"] });
    } catch (e: any) {
      console.error("[CorePlanChangesPage.approve]", e);
      toast.error(e?.message || "Erreur lors de l'approbation");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r: Row) => {
    setBusyId(r.id);
    try {
      await supabase
        .from("service_change_requests")
        .update({ status: "rejected", approved_at: new Date().toISOString() })
        .eq("id", r.id);
      toast.success("Demande rejetée");
      qc.invalidateQueries({ queryKey: ["core-plan-change-requests"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Changements de forfait — Nivra Core</title>
      </Helmet>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Changements de forfait</h1>
            <p className="text-sm text-muted-foreground">
              Demandes en attente d'approbation par l'équipe Nivra.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === "pending" ? "default" : "outline"}
              onClick={() => setFilter("pending")}
            >
              En attente
            </Button>
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              Toutes
            </Button>
          </div>
        </header>

        {isLoading ? (
          <Card>
            <CardContent className="p-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : !requests || requests.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Aucune demande.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{requests.length} demande(s)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.map((r) => {
                const meta = r.subscription_id ? subMeta?.[r.subscription_id] : undefined;
                const onPayPal = !!meta?.paypal_subscription_id;
                const client = clients?.[r.client_id];
                const acc = accounts?.[r.account_id];
                const newPrice = r.requested_plan_id ? planPrices?.[r.requested_plan_id] ?? null : null;
                const currentPrice = meta?.plan_price ?? null;
                const diff =
                  currentPrice !== null && newPrice !== null ? newPrice - currentPrice : null;
                const effLabel = r.effective_date
                  ? format(new Date(r.effective_date), "d MMM yyyy", { locale: fr })
                  : "—";
                const clientName = client
                  ? `${client.first_name || ""} ${client.last_name || ""}`.trim() || client.email
                  : r.client_id.slice(0, 8);

                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 p-4 border border-border rounded-lg"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{clientName}</span>
                          {acc?.account_number && (
                            <Badge variant="outline" className="text-xs">
                              #{acc.account_number}
                            </Badge>
                          )}
                          <Badge
                            variant={
                              r.status === "pending"
                                ? "secondary"
                                : r.status === "approved"
                                  ? "default"
                                  : "destructive"
                            }
                          >
                            {r.status}
                          </Badge>
                          {onPayPal && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> PayPal
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{r.current_plan_name || "—"}</span>
                          {currentPrice !== null && (
                            <span className="text-muted-foreground">
                              ({currentPrice.toFixed(2)}$)
                            </span>
                          )}
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{r.requested_plan_name}</span>
                          {newPrice !== null && (
                            <span className="text-muted-foreground">({newPrice.toFixed(2)}$)</span>
                          )}
                          {diff !== null && diff !== 0 && (
                            <Badge
                              variant={diff > 0 ? "destructive" : "default"}
                              className="flex items-center gap-1"
                            >
                              {diff > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                              {diff > 0 ? "+" : ""}
                              {diff.toFixed(2)}$/mois
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Demandé le {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          {" · "}Effectif: <span className="font-medium">{effLabel}</span>
                        </div>
                      </div>
                      {r.status === "pending" && (
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" onClick={() => approve(r)} disabled={busyId === r.id}>
                            {busyId === r.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 mr-1" />
                            )}
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reject(r)}
                            disabled={busyId === r.id}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      )}
                    </div>
                    {r.status === "pending" && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={!!applyNow[r.id]}
                          onCheckedChange={(v) =>
                            setApplyNow((s) => ({ ...s, [r.id]: !!v }))
                          }
                        />
                        Appliquer immédiatement (un crédit prorata sera émis en cas de downgrade)
                      </label>
                    )}
                    {onPayPal && r.status === "pending" && (
                      <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          ⚠️ Client sur PayPal — Mettre à jour manuellement dans PayPal après approbation.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
