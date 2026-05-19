/**
 * CorePauseRequestsPage — Admin view of all pending service-pause requests.
 * Approve: sets billing_subscriptions to paused, sets pause window, issues
 * prorated pause credit, marks request approved, sends approval email.
 * Reject: marks request rejected, restores subscription to active.
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Check, X, Pause, Search, Clock, CheckCircle2, XCircle, ListChecks } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type FilterKey = "pending" | "approved" | "rejected" | "all";

type Row = {
  id: string;
  account_id: string;
  client_id: string;
  subscription_id: string | null;
  reason: string | null;
  requested_for: string | null;
  pause_duration_days: number | null;
  status: string;
  created_at: string;
};

export default function CorePauseRequestsPage() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [search, setSearch] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["core-pause-stats"],
    refetchInterval: 30000,
    queryFn: async () => {
      const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
      const { data } = await supabase.from("suspension_requests").select("status");
      (data || []).forEach((r: any) => {
        counts.total++;
        if (r.status === "pending" || r.status === "pending_core") counts.pending++;
        else if (r.status === "approved") counts.approved++;
        else if (r.status === "rejected") counts.rejected++;
      });
      return counts;
    },
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["core-pause-requests", filter],
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from("suspension_requests")
        .select("id, account_id, client_id, subscription_id, reason, requested_for, pause_duration_days, status, created_at")
        .order("created_at", { ascending: false });
      if (filter === "pending") q = q.in("status", ["pending", "pending_core"]);
      else if (filter === "approved") q = q.eq("status", "approved");
      else if (filter === "rejected") q = q.eq("status", "rejected");
      const { data, error } = await q;
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const clientIds = useMemo(() => Array.from(new Set((requests || []).map((r) => r.client_id))), [requests]);
  const subIds = useMemo(
    () => Array.from(new Set((requests || []).map((r) => r.subscription_id).filter(Boolean) as string[])),
    [requests],
  );
  const accountIds = useMemo(() => Array.from(new Set((requests || []).map((r) => r.account_id))), [requests]);

  const { data: clients } = useQuery({
    queryKey: ["core-pause-clients", clientIds.join(",")],
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
    queryKey: ["core-pause-accounts", accountIds.join(",")],
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

  const { data: subs } = useQuery({
    queryKey: ["core-pause-subs", subIds.join(",")],
    enabled: subIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_price")
        .in("id", subIds);
      const map: Record<string, any> = {};
      (data || []).forEach((s: any) => (map[s.id] = s));
      return map;
    },
  });

  const approve = async (r: Row) => {
    setBusyId(r.id);
    try {
      const sub = r.subscription_id ? subs?.[r.subscription_id] : null;
      const pauseUntil = r.requested_for ? new Date(r.requested_for) : null;
      const now = new Date();
      const pauseDays = r.pause_duration_days ?? (pauseUntil
        ? Math.max(1, Math.ceil((pauseUntil.getTime() - now.getTime()) / 86400000))
        : 0);

      // Pause subscription
      if (r.subscription_id && pauseUntil) {
        const { error } = await supabase
          .from("billing_subscriptions")
          .update({
            status: "paused",
            paused_at: now.toISOString(),
            pause_until: pauseUntil.toISOString(),
            pause_reason: r.reason,
          })
          .eq("id", r.subscription_id);
        if (error) throw error;
      }

      // Mark request approved
      await supabase
        .from("suspension_requests")
        .update({ status: "approved", processed_at: new Date().toISOString() })
        .eq("id", r.id);

      // Pause credit (proportional to pause days)
      if (sub?.plan_price && pauseDays > 0) {
        const credit = Number(((Number(sub.plan_price) / 30) * pauseDays).toFixed(2));
        if (credit > 0) {
          await supabase.from("account_adjustments").insert({
            account_id: r.account_id,
            type: "credit",
            amount: credit,
            description: `Crédit suspension service — ${pauseDays} jours`,
            months_total: 1,
            months_remaining: 1,
            status: "active",
          });
        }
      }

      // Email client
      const client = clients?.[r.client_id];
      if (client?.email) {
        await supabase.from("email_queue").insert({
          to_email: client.email,
          template_key: "service_pause_approved",
          event_key: "service_pause_approved",
          message_type: "transactional",
          template_vars: {
            client_name: client.first_name || client.email,
            pause_from: format(now, "d MMMM yyyy", { locale: fr }),
            pause_until: pauseUntil ? format(pauseUntil, "d MMMM yyyy", { locale: fr }) : "—",
          },
        });
      }

      toast.success("Suspension approuvée");
      qc.invalidateQueries({ queryKey: ["core-pause-requests"] });
    } catch (e: any) {
      console.error("[CorePauseRequestsPage.approve]", e);
      toast.error(e?.message || "Erreur lors de l'approbation");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r: Row) => {
    setBusyId(r.id);
    try {
      await supabase
        .from("suspension_requests")
        .update({ status: "rejected", processed_at: new Date().toISOString() })
        .eq("id", r.id);
      // Restore subscription if it was flipped to pause_requested
      if (r.subscription_id) {
        await supabase
          .from("billing_subscriptions")
          .update({ status: "active" })
          .eq("id", r.subscription_id)
          .eq("status", "pause_requested");
      }
      toast.success("Demande rejetée");
      qc.invalidateQueries({ queryKey: ["core-pause-requests"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Suspensions de service — Nivra Core</title>
      </Helmet>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Pause className="w-6 h-6" /> Suspensions de service
            </h1>
            <p className="text-sm text-muted-foreground">
              Demandes de suspension temporaire envoyées par les clients.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>
              En attente
            </Button>
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
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
            <CardContent className="p-10 text-center text-muted-foreground">Aucune demande.</CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{requests.length} demande(s)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.map((r) => {
                const client = clients?.[r.client_id];
                const acc = accounts?.[r.account_id];
                const sub = r.subscription_id ? subs?.[r.subscription_id] : null;
                const name = client
                  ? `${client.first_name || ""} ${client.last_name || ""}`.trim() || client.email
                  : r.client_id.slice(0, 8);
                const pauseUntil = r.requested_for ? new Date(r.requested_for) : null;

                const isPending = r.status === "pending" || r.status === "pending_core";

                return (
                  <div key={r.id} className="flex flex-col gap-3 p-4 border border-border rounded-lg">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{name}</span>
                          {acc?.account_number && (
                            <Badge variant="outline" className="text-xs">#{acc.account_number}</Badge>
                          )}
                          <Badge
                            variant={
                              isPending
                                ? "secondary"
                                : r.status === "approved"
                                  ? "default"
                                  : "destructive"
                            }
                          >
                            {r.status}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{sub?.plan_name || "—"}</span>
                          {sub?.plan_price !== undefined && sub?.plan_price !== null && (
                            <span className="text-muted-foreground"> ({Number(sub.plan_price).toFixed(2)}$/mois)</span>
                          )}
                          {" · "}
                          <span className="text-muted-foreground">Pause:</span>{" "}
                          <span className="font-medium">{r.pause_duration_days ?? "?"} jours</span>
                          {" · "}
                          <span className="text-muted-foreground">Reprise:</span>{" "}
                          <span className="font-medium">
                            {pauseUntil ? format(pauseUntil, "d MMM yyyy", { locale: fr }) : "—"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Raison: <span className="font-medium">{r.reason || "Non précisée"}</span>
                          {" · "}Demandée le{" "}
                          {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                        </div>
                      </div>
                      {isPending && (
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
