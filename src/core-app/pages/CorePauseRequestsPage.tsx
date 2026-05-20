/**
 * CorePauseRequestsPage — Admin workspace for service suspensions.
 *
 * Lifecycle:
 *   pending / pending_core → approved (active suspension) → resumed | (auto-expired)
 *                          → rejected
 *
 * Real actions:
 *   - Approve  → billing_subscriptions.status='paused', paused_at, pause_until, pause credit,
 *                suspension_requests.status='approved', processed_by/at, email service_pause_approved
 *   - Reject   → suspension_requests.status='rejected', billing_subscriptions back to 'active'
 *                if it was 'pause_requested', email service_pause_rejected
 *   - Resume now (on active) → billing_subscriptions.status='active', pause_until=null,
 *                suspension_requests.status='resumed', resumed_at (stored in processed_at on resume),
 *                email service_pause_resumed
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Loader2, Check, X, Pause, Play, Search, Clock, CheckCircle2, XCircle, ListChecks,
  ChevronLeft, ChevronRight, Eye, Activity, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInCalendarDays, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

type FilterKey = "pending" | "active" | "resumed" | "rejected" | "all";
type ActionKind = "approve" | "reject" | "resume" | null;

type Row = {
  id: string;
  account_id: string;
  client_id: string;
  subscription_id: string | null;
  reason: string | null;
  requested_for: string | null;
  pause_duration_days: number | null;
  status: string;
  notes: string | null;
  processed_at: string | null;
  processed_by: string | null;
  created_at: string;
};

const PAGE_SIZE = 10;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:      { label: "En attente", cls: "bg-amber-100 text-amber-800" },
  pending_core: { label: "En attente", cls: "bg-amber-100 text-amber-800" },
  approved:     { label: "Active",     cls: "bg-blue-100 text-blue-800"   },
  resumed:      { label: "Reprise",    cls: "bg-emerald-100 text-emerald-800" },
  rejected:     { label: "Rejetée",    cls: "bg-red-100 text-red-800"     },
};

export default function CorePauseRequestsPage() {
  const qc = useQueryClient();

  const [filter, setFilter] = useState<FilterKey>("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Row | null>(null);
  const [action, setAction] = useState<ActionKind>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ---------- Stats ----------
  const { data: stats } = useQuery({
    queryKey: ["core-pause-stats"],
    refetchInterval: 30000,
    queryFn: async () => {
      const counts = { pending: 0, active: 0, resumedThisMonth: 0, rejected: 0, total: 0 };
      const { data } = await supabase
        .from("suspension_requests")
        .select("status, processed_at");
      const monthStart = startOfMonth(new Date()).toISOString();
      (data || []).forEach((r: any) => {
        counts.total++;
        if (r.status === "pending" || r.status === "pending_core") counts.pending++;
        else if (r.status === "approved") counts.active++;
        else if (r.status === "resumed") {
          if (r.processed_at && r.processed_at >= monthStart) counts.resumedThisMonth++;
        } else if (r.status === "rejected") counts.rejected++;
      });
      return counts;
    },
  });

  // ---------- Requests ----------
  const { data: requests, isLoading } = useQuery({
    queryKey: ["core-pause-requests", filter],
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from("suspension_requests")
        .select("id, account_id, client_id, subscription_id, reason, requested_for, pause_duration_days, status, notes, processed_at, processed_by, created_at")
        .order("created_at", { ascending: false });
      if (filter === "pending") q = q.in("status", ["pending", "pending_core"]);
      else if (filter === "active") q = q.eq("status", "approved");
      else if (filter === "resumed") q = q.eq("status", "resumed");
      else if (filter === "rejected") q = q.eq("status", "rejected");
      const { data, error } = await q;
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  // ---------- Resolvers ----------
  const clientIds = useMemo(() => Array.from(new Set((requests || []).map((r) => r.client_id))), [requests]);
  const accountIds = useMemo(() => Array.from(new Set((requests || []).map((r) => r.account_id))), [requests]);
  const subIds = useMemo(
    () => Array.from(new Set((requests || []).map((r) => r.subscription_id).filter(Boolean) as string[])),
    [requests],
  );

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
        .select("id, plan_name, plan_price, status, paused_at, pause_until")
        .in("id", subIds);
      const map: Record<string, any> = {};
      (data || []).forEach((s: any) => (map[s.id] = s));
      return map;
    },
  });

  // ---------- Filter + paginate ----------
  const filtered = useMemo(() => {
    const list = requests || [];
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter((r) => {
      const c = clients?.[r.client_id];
      const a = accounts?.[r.account_id];
      const sub = r.subscription_id ? subs?.[r.subscription_id] : null;
      return (
        `${c?.first_name || ""} ${c?.last_name || ""}`.toLowerCase().includes(s) ||
        (c?.email || "").toLowerCase().includes(s) ||
        (a?.account_number || "").toLowerCase().includes(s) ||
        (sub?.plan_name || "").toLowerCase().includes(s) ||
        (r.reason || "").toLowerCase().includes(s)
      );
    });
  }, [requests, search, clients, accounts, subs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );
  useMemo(() => { setPage(1); }, [filter, search]); // eslint-disable-line

  // ---------- Activity log ----------
  const logActivity = async (id: string, to: string, patch: Record<string, any>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        action: `suspension_${to}`,
        entity_type: "suspension_request",
        entity_id: id,
        user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
        actor_email: user?.email ?? null,
        details: patch,
      });
    } catch (e) {
      console.warn("[CorePauseRequests] activity log failed", e);
    }
  };

  // ---------- Approve ----------
  const approveMut = useMutation({
    mutationFn: async (r: Row) => {
      const { data: { user } } = await supabase.auth.getUser();
      const sub = r.subscription_id ? subs?.[r.subscription_id] : null;
      const now = new Date();
      const pauseUntil = r.requested_for ? new Date(r.requested_for) : null;
      const pauseDays = r.pause_duration_days ?? (pauseUntil
        ? Math.max(1, Math.ceil((pauseUntil.getTime() - now.getTime()) / 86400000))
        : 0);

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

      const { error: rErr } = await supabase
        .from("suspension_requests")
        .update({
          status: "approved",
          processed_at: now.toISOString(),
          processed_by: user?.id ?? null,
        })
        .eq("id", r.id);
      if (rErr) throw rErr;

      // Prorated pause credit
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

      await logActivity(r.id, "approved", { pause_days: pauseDays });

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
            pause_days: pauseDays,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Suspension approuvée");
      qc.invalidateQueries({ queryKey: ["core-pause-requests"] });
      qc.invalidateQueries({ queryKey: ["core-pause-stats"] });
      close();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  // ---------- Reject ----------
  const rejectMut = useMutation({
    mutationFn: async (r: Row) => {
      if (!rejectReason.trim()) throw new Error("Motif de rejet requis");
      const { data: { user } } = await supabase.auth.getUser();
      const newNotes = [r.notes, `Rejet: ${rejectReason.trim()}`].filter(Boolean).join("\n");

      const { error } = await supabase
        .from("suspension_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          processed_by: user?.id ?? null,
          notes: newNotes,
        })
        .eq("id", r.id);
      if (error) throw error;

      if (r.subscription_id) {
        await supabase
          .from("billing_subscriptions")
          .update({ status: "active" })
          .eq("id", r.subscription_id)
          .eq("status", "pause_requested");
      }

      await logActivity(r.id, "rejected", { reason: rejectReason.trim() });

      const client = clients?.[r.client_id];
      if (client?.email) {
        await supabase.from("email_queue").insert({
          to_email: client.email,
          template_key: "service_pause_rejected",
          event_key: "service_pause_rejected",
          message_type: "transactional",
          template_vars: {
            client_name: client.first_name || client.email,
            reason: rejectReason.trim(),
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Demande rejetée");
      qc.invalidateQueries({ queryKey: ["core-pause-requests"] });
      qc.invalidateQueries({ queryKey: ["core-pause-stats"] });
      close();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  // ---------- Resume ----------
  const resumeMut = useMutation({
    mutationFn: async (r: Row) => {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date();

      if (r.subscription_id) {
        const { error } = await supabase
          .from("billing_subscriptions")
          .update({
            status: "active",
            pause_until: null,
            paused_at: null,
            pause_reason: null,
          })
          .eq("id", r.subscription_id);
        if (error) throw error;
      }

      const { error: rErr } = await supabase
        .from("suspension_requests")
        .update({
          status: "resumed",
          processed_at: now.toISOString(),
          processed_by: user?.id ?? null,
        })
        .eq("id", r.id);
      if (rErr) throw rErr;

      await logActivity(r.id, "resumed", {});

      const client = clients?.[r.client_id];
      if (client?.email) {
        await supabase.from("email_queue").insert({
          to_email: client.email,
          template_key: "service_pause_resumed",
          event_key: "service_pause_resumed",
          message_type: "transactional",
          template_vars: {
            client_name: client.first_name || client.email,
            resumed_at: format(now, "d MMMM yyyy", { locale: fr }),
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Service repris");
      qc.invalidateQueries({ queryKey: ["core-pause-requests"] });
      qc.invalidateQueries({ queryKey: ["core-pause-stats"] });
      close();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const submitting = approveMut.isPending || rejectMut.isPending || resumeMut.isPending;

  const open = (r: Row, k: ActionKind) => {
    setSelected(r);
    setAction(k);
    setRejectReason("");
  };
  const close = () => {
    if (submitting) return;
    setSelected(null);
    setAction(null);
  };
  const submit = () => {
    if (!selected || !action) return;
    if (action === "approve") approveMut.mutate(selected);
    else if (action === "reject") rejectMut.mutate(selected);
    else if (action === "resume") resumeMut.mutate(selected);
  };

  const openDrawer = (r: Row) => {
    setSelected(r);
    setDrawerOpen(true);
  };

  const statCards = [
    { key: "pending"  as FilterKey, label: "En attente",       value: stats?.pending          ?? 0, icon: Clock,        color: "text-amber-500"   },
    { key: "active"   as FilterKey, label: "Actives",          value: stats?.active           ?? 0, icon: Activity,     color: "text-blue-500"    },
    { key: "resumed"  as FilterKey, label: "Reprises ce mois", value: stats?.resumedThisMonth ?? 0, icon: Play,         color: "text-emerald-500" },
    { key: "rejected" as FilterKey, label: "Rejetées",         value: stats?.rejected         ?? 0, icon: XCircle,      color: "text-red-500"     },
    { key: "all"      as FilterKey, label: "Total",            value: stats?.total            ?? 0, icon: ListChecks,   color: "text-violet-500"  },
  ];

  return (
    <>
      <Helmet>
        <title>Suspensions de service — Nivra Core</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Pause className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Suspensions de service</h1>
            <p className="text-sm text-muted-foreground">
              Approbation, suivi et reprise manuelle des suspensions temporaires.
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {statCards.map((s) => {
            const Icon = s.icon;
            const active = filter === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setFilter(s.key)}
                className={`text-left rounded-lg border p-3 transition-colors ${active ? "border-violet-500 bg-violet-500/5" : "border-border hover:bg-muted/40"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div className="text-2xl font-bold mt-1">{s.value}</div>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom, email, # compte, forfait, raison)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {filtered.length} demande(s){filter !== "all" ? ` · ${STATUS_META[filter === "active" ? "approved" : filter]?.label ?? filter}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : paged.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Aucune demande pour ces filtres.
              </div>
            ) : (
              paged.map((r) => {
                const client = clients?.[r.client_id];
                const acc = accounts?.[r.account_id];
                const sub = r.subscription_id ? subs?.[r.subscription_id] : null;
                const name = client
                  ? `${client.first_name || ""} ${client.last_name || ""}`.trim() || client.email
                  : "—";
                const pauseUntil = r.requested_for ? new Date(r.requested_for) : null;
                const isPending = r.status === "pending" || r.status === "pending_core";
                const isActive = r.status === "approved";
                const cfg = STATUS_META[r.status] ?? { label: r.status, cls: "bg-slate-100 text-slate-700" };
                const reasonShort = (r.reason || "").length > 60 ? `${r.reason?.slice(0, 60)}…` : (r.reason || "—");
                const countdown = isActive && pauseUntil
                  ? differenceInCalendarDays(pauseUntil, new Date())
                  : null;

                return (
                  <div key={r.id} className="flex flex-col gap-3 p-4 border border-border rounded-lg">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold truncate">{name}</span>
                          {client?.email && <span className="text-xs text-muted-foreground">{client.email}</span>}
                          {acc?.account_number && (
                            <Badge variant="outline" className="text-xs">#{acc.account_number}</Badge>
                          )}
                          <Badge className={`${cfg.cls} border-0`}>{cfg.label}</Badge>
                          {countdown !== null && (
                            <Badge variant="outline" className="flex items-center gap-1 text-xs">
                              <Clock className="w-3 h-3" />
                              {countdown > 0 ? `Reprise dans ${countdown} j` : countdown === 0 ? "Reprise aujourd'hui" : `En retard de ${Math.abs(countdown)} j`}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{sub?.plan_name || "—"}</span>
                          {sub?.plan_price !== undefined && sub?.plan_price !== null && (
                            <span className="text-muted-foreground"> ({Number(sub.plan_price).toFixed(2)}$/mois)</span>
                          )}
                          {" · "}
                          <span className="text-muted-foreground">Durée:</span>{" "}
                          <span className="font-medium">{r.pause_duration_days ?? "?"} jours</span>
                          {" · "}
                          <span className="text-muted-foreground">Fin prévue:</span>{" "}
                          <span className="font-medium">
                            {pauseUntil ? format(pauseUntil, "d MMM yyyy", { locale: fr }) : "—"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Raison:</span> {reasonShort}
                          {" · "}Demandée le {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          {r.processed_at && (
                            <> {" · "}Traitée le {format(new Date(r.processed_at), "d MMM yyyy HH:mm", { locale: fr })}</>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => openDrawer(r)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {isPending && (
                          <>
                            <Button size="sm" onClick={() => open(r, "approve")}>
                              <Check className="w-4 h-4 mr-1" /> Approuver
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => open(r, "reject")}>
                              <X className="w-4 h-4 mr-1" /> Rejeter
                            </Button>
                          </>
                        )}
                        {isActive && (
                          <Button size="sm" variant="outline" onClick={() => open(r, "resume")}>
                            <Play className="w-4 h-4 mr-1" /> Reprendre maintenant
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Page {page} / {totalPages} · {filtered.length} résultats
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action confirm dialog */}
        <Dialog open={!!action} onOpenChange={(v) => !v && close()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {action === "approve" && "Approuver la suspension"}
                {action === "reject" && "Rejeter la demande"}
                {action === "resume" && "Reprendre le service maintenant"}
              </DialogTitle>
              <DialogDescription>
                {selected && `Demande du ${format(new Date(selected.created_at), "d MMM yyyy HH:mm", { locale: fr })}`}
              </DialogDescription>
            </DialogHeader>

            {selected && (
              <div className="space-y-3 py-2 text-sm">
                {action === "resume" && (
                  <div className="flex items-start gap-2 p-2 bg-amber-100/40 border border-amber-300 rounded text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Le service sera réactivé immédiatement et un courriel sera envoyé au client.</span>
                  </div>
                )}
                {action === "reject" && (
                  <div className="space-y-1">
                    <Label>Motif de rejet *</Label>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      placeholder="Expliquez pourquoi cette demande est rejetée…"
                    />
                  </div>
                )}
                {action === "approve" && (
                  <div className="text-xs text-muted-foreground">
                    Le service sera suspendu jusqu'au{" "}
                    <span className="font-medium text-foreground">
                      {selected.requested_for ? format(new Date(selected.requested_for), "d MMMM yyyy", { locale: fr }) : "—"}
                    </span>. Un crédit prorata sera émis automatiquement.
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={submitting}>Annuler</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Détails de la suspension</SheetTitle>
              <SheetDescription>Information complète sur la demande.</SheetDescription>
            </SheetHeader>
            {selected && (() => {
              const client = clients?.[selected.client_id];
              const acc = accounts?.[selected.account_id];
              const sub = selected.subscription_id ? subs?.[selected.subscription_id] : null;
              const pauseUntil = selected.requested_for ? new Date(selected.requested_for) : null;
              const cfg = STATUS_META[selected.status] ?? { label: selected.status, cls: "bg-slate-100 text-slate-700" };
              return (
                <div className="space-y-4 py-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Client</div>
                    <div className="font-semibold">
                      {client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() || client.email : "—"}
                    </div>
                    {client?.email && <div className="text-xs text-muted-foreground">{client.email}</div>}
                    {acc?.account_number && <div className="text-xs">Compte #{acc.account_number}</div>}
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Statut</div>
                    <Badge className={`${cfg.cls} border-0`}>{cfg.label}</Badge>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Forfait</div>
                    <div className="font-medium">{sub?.plan_name || "—"}</div>
                    {sub?.plan_price !== undefined && sub?.plan_price !== null && (
                      <div className="text-xs text-muted-foreground">{Number(sub.plan_price).toFixed(2)}$/mois</div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Durée</div>
                      <div className="font-medium">{selected.pause_duration_days ?? "?"} jours</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Fin prévue</div>
                      <div className="font-medium">{pauseUntil ? format(pauseUntil, "d MMM yyyy", { locale: fr }) : "—"}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Raison complète</div>
                    <div className="whitespace-pre-line border rounded p-2 bg-muted/40 text-xs">
                      {selected.reason || "Non précisée"}
                    </div>
                  </div>

                  {selected.notes && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Notes</div>
                      <div className="whitespace-pre-line border rounded p-2 bg-muted/40 text-xs">
                        {selected.notes}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-3 text-xs text-muted-foreground space-y-1">
                    <div>Demandée le {format(new Date(selected.created_at), "d MMM yyyy HH:mm", { locale: fr })}</div>
                    {selected.processed_at && (
                      <div>Traitée le {format(new Date(selected.processed_at), "d MMM yyyy HH:mm", { locale: fr })}</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
