/**
 * CorePlanChangesPage — Global admin view of all plan change requests.
 *
 * Lifecycle: pending / pending_core → approved | rejected
 * Real actions:
 *   - Approve (optionally apply immediately; emits prorata credit on downgrade)
 *   - Reject (with required reason persisted to notes)
 *   - PayPal warning when subscription is recurring on PayPal
 *   - Activity log written for every transition
 *   - Transactional email queued on approve
 *
 * UX parity with CoreReturnsPage (RMA):
 *   - Clickable stats bar (filters by status)
 *   - Filters: status, change_type, date-from, date-to
 *   - Search (client name / email / account # / plan name)
 *   - Pagination 10 / page
 *   - Action dialog with full context
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, Check, X, ArrowRight, AlertTriangle, ArrowUp, ArrowDown,
  Clock, CheckCircle2, XCircle, ListChecks, Search, RefreshCcw, Filter,
  ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type FilterKey = "pending" | "approved" | "rejected" | "all";
type ActionKind = "approve" | "reject" | "view" | null;

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
  notes: string | null;
  effective_date: string | null;
  created_at: string;
  approved_at: string | null;
};

type SubMeta = {
  next_renewal_at: string | null;
  paypal_subscription_id: string | null;
  plan_price: number | null;
  cycle_end_date: string | null;
  customer_id: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:       { label: "En attente",  cls: "bg-amber-100 text-amber-800" },
  pending_core:  { label: "En attente",  cls: "bg-amber-100 text-amber-800" },
  approved:      { label: "Approuvée",   cls: "bg-emerald-100 text-emerald-800" },
  rejected:      { label: "Rejetée",     cls: "bg-red-100 text-red-800" },
};

const CHANGE_TYPE_LABEL: Record<string, string> = {
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  lateral: "Latéral",
  swap: "Changement",
};

const PAGE_SIZE = 10;

export default function CorePlanChangesPage() {
  const qc = useQueryClient();

  // filters
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [changeType, setChangeType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // action dialog
  const [selected, setSelected] = useState<Row | null>(null);
  const [action, setAction] = useState<ActionKind>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [applyNow, setApplyNow] = useState(false);

  // ---------- Stats (always all-time, not filtered) ----------
  const { data: stats } = useQuery({
    queryKey: ["core-plan-change-stats"],
    queryFn: async () => {
      const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
      const { data, error } = await supabase
        .from("service_change_requests")
        .select("status");
      if (error) throw error;
      (data || []).forEach((r: any) => {
        counts.total++;
        if (r.status === "pending" || r.status === "pending_core") counts.pending++;
        else if (r.status === "approved") counts.approved++;
        else if (r.status === "rejected") counts.rejected++;
      });
      return counts;
    },
    refetchInterval: 30000,
  });

  // ---------- Requests ----------
  const { data: requests, isLoading } = useQuery({
    queryKey: ["core-plan-change-requests", filter, changeType, dateFrom, dateTo],
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from("service_change_requests")
        .select("id, account_id, client_id, subscription_id, current_plan_name, requested_plan_id, requested_plan_name, change_type, status, notes, effective_date, created_at, approved_at")
        .order("created_at", { ascending: false });
      if (filter === "pending") q = q.in("status", ["pending", "pending_core"]);
      else if (filter === "approved") q = q.eq("status", "approved");
      else if (filter === "rejected") q = q.eq("status", "rejected");
      if (changeType !== "all") q = q.eq("change_type", changeType);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  // ---------- Resolvers (clients, accounts, subs, plan prices) ----------
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
  const planIds = useMemo(
    () => Array.from(new Set((requests || []).map((r) => r.requested_plan_id).filter(Boolean) as string[])),
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
        .select("id, next_renewal_at, paypal_subscription_id, plan_price, cycle_end_date, customer_id")
        .in("id", subIds);
      const map: Record<string, SubMeta> = {};
      (data || []).forEach((s: any) => {
        map[s.id] = {
          next_renewal_at: s.next_renewal_at,
          paypal_subscription_id: s.paypal_subscription_id,
          plan_price: s.plan_price,
          cycle_end_date: s.cycle_end_date ?? null,
          customer_id: s.customer_id ?? null,
        };
      });
      return map;
    },
  });

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

  // ---------- Search + pagination ----------
  const filteredRequests = useMemo(() => {
    const list = requests || [];
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter((r) => {
      const c = clients?.[r.client_id];
      const a = accounts?.[r.account_id];
      return (
        r.requested_plan_name?.toLowerCase().includes(s) ||
        r.current_plan_name?.toLowerCase().includes(s) ||
        c?.email?.toLowerCase().includes(s) ||
        c?.first_name?.toLowerCase().includes(s) ||
        c?.last_name?.toLowerCase().includes(s) ||
        a?.account_number?.toLowerCase().includes(s)
      );
    });
  }, [requests, search, clients, accounts]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const pagedRequests = useMemo(
    () => filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRequests, page],
  );

  // Reset to page 1 when filters change
  useMemo(() => { setPage(1); }, [filter, changeType, dateFrom, dateTo, search]); // eslint-disable-line

  // ---------- Activity log helper ----------
  const logActivity = async (id: string, from: string, to: string, patch: Record<string, any>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        action: `plan_change_${to}`,
        entity_type: "service_change_request",
        entity_id: id,
        user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
        actor_email: user?.email ?? null,
        details: { from, to, ...patch },
      });
    } catch (e) {
      console.warn("[CorePlanChanges] activity log failed", e);
    }
  };

  // ---------- Mutations ----------
  const approveMut = useMutation({
    mutationFn: async (r: Row) => {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = r.subscription_id ? subMeta?.[r.subscription_id] : undefined;
      const newPrice = r.requested_plan_id ? planPrices?.[r.requested_plan_id] ?? null : null;
      const currentPrice = meta?.plan_price ?? null;
      const effDate = r.effective_date ? new Date(r.effective_date) : null;
      const now = new Date();
      const isDue = effDate ? effDate.getTime() <= now.getTime() : true;
      const force = applyNow;

      if (r.subscription_id && (isDue || force)) {
        const update: any = { plan_name: r.requested_plan_name };
        if (newPrice !== null) update.plan_price = newPrice;
        const { error } = await supabase
          .from("billing_subscriptions")
          .update(update)
          .eq("id", r.subscription_id);
        if (error) throw error;
      }

      // ── PRORATION ON IMMEDIATE PLAN CHANGE ──
      // Everything on ONE invoice — add a line to the existing pending renewal invoice,
      // recompute subtotal + TPS + TVQ so the PDF totals always add up.
      // If no pending invoice exists yet, fall back to account_adjustments for next renewal.
      const cycleEndDate = meta?.cycle_end_date ? new Date(meta.cycle_end_date) : null;
      const daysInCycle = 30;
      const msInDay = 86400000;
      const daysRemainingInCycle = cycleEndDate
        ? Math.max(0, Math.min(daysInCycle, Math.floor((cycleEndDate.getTime() - now.getTime()) / msInDay)))
        : 0;

      if (force && currentPrice !== null && newPrice !== null && currentPrice !== newPrice && r.subscription_id && daysRemainingInCycle > 0) {
        const isUpgrade = newPrice > currentPrice;
        const prorataPreTax = Number((Math.abs(newPrice - currentPrice) / daysInCycle * daysRemainingInCycle).toFixed(2));

        if (prorataPreTax > 0) {
          // Find the pending renewal invoice for this subscription
          const { data: pendingInv } = await supabase
            .from("billing_invoices")
            .select("id, subtotal, tps_amount, tvq_amount, total, balance_due, notes")
            .eq("subscription_id", r.subscription_id)
            .eq("type", "renewal")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pendingInv) {
            // Add proration line to the existing invoice
            const lineDesc = isUpgrade
              ? `Prorata upgrade — ${r.current_plan_name || "—"} → ${r.requested_plan_name} (${daysRemainingInCycle}j × ${((newPrice - currentPrice) / daysInCycle).toFixed(4)}$/j)`
              : `Crédit prorata — ${r.current_plan_name || "—"} → ${r.requested_plan_name} (${daysRemainingInCycle}j)`;
            const unitPrice = isUpgrade ? prorataPreTax : -prorataPreTax;

            await supabase.from("billing_invoice_lines").insert({
              invoice_id: pendingInv.id,
              description: lineDesc,
              unit_price: unitPrice,
              quantity: 1,
              line_total: unitPrice,
              line_type: isUpgrade ? "service" : "discount",
            });

            // Recompute totals: new_subtotal drives recalculated taxes so PDF numbers add up
            const TPS = 0.05;
            const TVQ = 0.09975;
            const newSubtotal = Math.max(0, Math.round((Number(pendingInv.subtotal || 0) + unitPrice) * 100) / 100);
            const newTps = Math.round(newSubtotal * TPS * 100) / 100;
            const newTvq = Math.round(newSubtotal * TVQ * 100) / 100;
            const newTotal = Math.round((newSubtotal + newTps + newTvq) * 100) / 100;
            const noteAppend = `Prorata ${isUpgrade ? "upgrade" : "downgrade"} ${r.current_plan_name || "—"} → ${r.requested_plan_name} appliqué le ${now.toISOString().split("T")[0]}`;
            const newNotes = [pendingInv.notes, noteAppend].filter(Boolean).join(" | ");

            await supabase.from("billing_invoices").update({
              subtotal: newSubtotal,
              tps_amount: newTps,
              tvq_amount: newTvq,
              total: newTotal,
              balance_due: newTotal,
              notes: newNotes,
            }).eq("id", pendingInv.id);

            // Keep pending payment in sync with the updated total
            await supabase.from("billing_payments")
              .update({ amount: newTotal })
              .eq("invoice_id", pendingInv.id)
              .eq("status", "pending");

          } else {
            // No pending invoice yet — store for next renewal via account_adjustments
            await supabase.from("account_adjustments").insert({
              account_id: r.account_id,
              type: isUpgrade ? "fee" : "credit",
              amount: prorataPreTax,
              description: isUpgrade
                ? `Prorata upgrade — ${r.current_plan_name || "—"} → ${r.requested_plan_name} (${daysRemainingInCycle}j)`
                : `Crédit prorata — ${r.current_plan_name || "—"} → ${r.requested_plan_name} (${daysRemainingInCycle}j)`,
              months_total: 1,
              months_remaining: 1,
              status: "active",
            });
          }
        }
      }

      const { error: upErr } = await supabase
        .from("service_change_requests")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user?.id ?? null,
        })
        .eq("id", r.id);
      if (upErr) throw upErr;

      await logActivity(r.id, r.status, "approved", {
        apply_now: force,
        new_price: newPrice,
        current_price: currentPrice,
      });

      // Transactional email
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

      return meta?.paypal_subscription_id;
    },
    onSuccess: (paypalId) => {
      toast.success(
        paypalId
          ? "Approuvée — mettez à jour PayPal manuellement"
          : "Demande approuvée",
      );
      qc.invalidateQueries({ queryKey: ["core-plan-change-requests"] });
      qc.invalidateQueries({ queryKey: ["core-plan-change-stats"] });
      closeAction();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const rejectMut = useMutation({
    mutationFn: async (r: Row) => {
      if (!rejectReason.trim()) throw new Error("Motif de rejet requis");
      const { data: { user } } = await supabase.auth.getUser();
      const newNotes = [r.notes, `Rejet: ${rejectReason.trim()}`].filter(Boolean).join("\n");
      const { error } = await supabase
        .from("service_change_requests")
        .update({
          status: "rejected",
          approved_at: new Date().toISOString(),
          approved_by: user?.id ?? null,
          notes: newNotes,
        })
        .eq("id", r.id);
      if (error) throw error;
      await logActivity(r.id, r.status, "rejected", { reason: rejectReason.trim() });

      const client = clients?.[r.client_id];
      if (client?.email) {
        await supabase.from("email_queue").insert({
          to_email: client.email,
          template_key: "plan_change_rejected",
          event_key: "plan_change_rejected",
          message_type: "transactional",
          template_vars: {
            client_name: client.first_name || client.email,
            requested_plan_name: r.requested_plan_name,
            reason: rejectReason.trim(),
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Demande rejetée");
      qc.invalidateQueries({ queryKey: ["core-plan-change-requests"] });
      qc.invalidateQueries({ queryKey: ["core-plan-change-stats"] });
      closeAction();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const submitting = approveMut.isPending || rejectMut.isPending;

  const openAction = (r: Row, k: ActionKind) => {
    setSelected(r);
    setAction(k);
    setRejectReason("");
    setApplyNow(false);
  };

  const closeAction = () => {
    if (submitting) return;
    setSelected(null);
    setAction(null);
  };

  const submit = () => {
    if (!selected || !action) return;
    if (action === "approve") approveMut.mutate(selected);
    else if (action === "reject") rejectMut.mutate(selected);
  };

  const statCards = [
    { key: "pending"  as FilterKey, label: "En attente",  value: stats?.pending  ?? 0, icon: Clock,         color: "text-amber-500"    },
    { key: "approved" as FilterKey, label: "Approuvées",  value: stats?.approved ?? 0, icon: CheckCircle2,  color: "text-emerald-500"  },
    { key: "rejected" as FilterKey, label: "Rejetées",    value: stats?.rejected ?? 0, icon: XCircle,       color: "text-red-500"      },
    { key: "all"      as FilterKey, label: "Total",       value: stats?.total    ?? 0, icon: ListChecks,    color: "text-violet-500"   },
  ];

  return (
    <>
      <Helmet>
        <title>Changements de forfait — Nivra Core</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <RefreshCcw className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Changements de forfait</h1>
            <p className="text-sm text-muted-foreground">
              Approbation des demandes d'upgrade, downgrade et changement latéral.
            </p>
          </div>
        </div>

        {/* Stats bar — clickable */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtres
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={changeType} onValueChange={setChangeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="upgrade">Upgrade</SelectItem>
                  <SelectItem value="downgrade">Downgrade</SelectItem>
                  <SelectItem value="lateral">Latéral</SelectItem>
                  <SelectItem value="swap">Changement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Du</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Au</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Recherche</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Client, email, # compte, forfait…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {filteredRequests.length} demande(s){filter !== "all" ? ` · ${STATUS_META[filter]?.label ?? filter}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : pagedRequests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Aucune demande pour ces filtres.
              </div>
            ) : (
              pagedRequests.map((r) => {
                const meta = r.subscription_id ? subMeta?.[r.subscription_id] : undefined;
                const onPayPal = !!meta?.paypal_subscription_id;
                const client = clients?.[r.client_id];
                const acc = accounts?.[r.account_id];
                const newPrice = r.requested_plan_id ? planPrices?.[r.requested_plan_id] ?? null : null;
                const currentPrice = meta?.plan_price ?? null;
                const diff = currentPrice !== null && newPrice !== null ? newPrice - currentPrice : null;
                const effLabel = r.effective_date
                  ? format(new Date(r.effective_date), "d MMM yyyy", { locale: fr })
                  : "—";
                const clientName = client
                  ? `${client.first_name || ""} ${client.last_name || ""}`.trim() || client.email
                  : r.client_id.slice(0, 8);
                const cfg = STATUS_META[r.status] ?? { label: r.status, cls: "bg-slate-100 text-slate-700" };
                const isPending = r.status === "pending" || r.status === "pending_core";
                const typeLabel = CHANGE_TYPE_LABEL[r.change_type] ?? r.change_type;

                return (
                  <div key={r.id} className="flex flex-col gap-3 p-4 border border-border rounded-lg">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold truncate">{clientName}</span>
                          {acc?.account_number && (
                            <Badge variant="outline" className="text-xs">#{acc.account_number}</Badge>
                          )}
                          <Badge className={`${cfg.cls} border-0`}>{cfg.label}</Badge>
                          <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                          {onPayPal && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> PayPal
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{r.current_plan_name || "—"}</span>
                          {currentPrice !== null && (
                            <span className="text-muted-foreground">({currentPrice.toFixed(2)}$)</span>
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
                              {diff > 0 ? "+" : ""}{diff.toFixed(2)}$/mois
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Demandé le {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          {" · "}Effectif: <span className="font-medium">{effLabel}</span>
                          {r.approved_at && (
                            <> {" · "}Traité le {format(new Date(r.approved_at), "d MMM yyyy HH:mm", { locale: fr })}</>
                          )}
                        </div>
                        {r.notes && (
                          <div className="text-xs text-muted-foreground whitespace-pre-line border-l-2 border-border pl-2 mt-1">
                            {r.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => openAction(r, "view")}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {isPending && (
                          <>
                            <Button size="sm" onClick={() => openAction(r, "approve")}>
                              <Check className="w-4 h-4 mr-1" /> Approuver
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openAction(r, "reject")}>
                              <X className="w-4 h-4 mr-1" /> Rejeter
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pagination */}
            {filteredRequests.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Page {page} / {totalPages} · {filteredRequests.length} résultats
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action dialog */}
        <Dialog open={!!action} onOpenChange={(v) => !v && closeAction()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {action === "approve" && "Approuver la demande"}
                {action === "reject" && "Rejeter la demande"}
                {action === "view" && "Détails de la demande"}
              </DialogTitle>
              <DialogDescription>
                {selected && `Demande du ${format(new Date(selected.created_at), "d MMM yyyy HH:mm", { locale: fr })}`}
              </DialogDescription>
            </DialogHeader>

            {selected && (() => {
              const meta = selected.subscription_id ? subMeta?.[selected.subscription_id] : undefined;
              const onPayPal = !!meta?.paypal_subscription_id;
              const newPrice = selected.requested_plan_id ? planPrices?.[selected.requested_plan_id] ?? null : null;
              const currentPrice = meta?.plan_price ?? null;
              const isDowngrade = currentPrice !== null && newPrice !== null && newPrice < currentPrice;

              return (
                <div className="space-y-3 py-2 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Forfait actuel</div>
                      <div className="font-medium">{selected.current_plan_name || "—"}</div>
                      {currentPrice !== null && <div className="text-xs">{currentPrice.toFixed(2)}$/mois</div>}
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Forfait demandé</div>
                      <div className="font-medium">{selected.requested_plan_name}</div>
                      {newPrice !== null && <div className="text-xs">{newPrice.toFixed(2)}$/mois</div>}
                    </div>
                  </div>

                  {onPayPal && action !== "view" && (
                    <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Client sur PayPal — mettre à jour l'abonnement PayPal manuellement après approbation.</span>
                    </div>
                  )}

                  {action === "approve" && (() => {
                    const isUpgrade = currentPrice !== null && newPrice !== null && newPrice > currentPrice;
                    return (
                      <label className="flex items-start gap-2 text-xs">
                        <Checkbox
                          checked={applyNow}
                          onCheckedChange={(v) => setApplyNow(!!v)}
                          className="mt-0.5"
                        />
                        <span>
                          Appliquer immédiatement
                          {isDowngrade && <> — un crédit prorata sera ajouté à la prochaine facture</>}
                          {isUpgrade && <> — une ligne prorata sera ajoutée à la facture en cours</>}
                        </span>
                      </label>
                    );
                  })()}

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

                  {action === "view" && selected.notes && (
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <div className="text-xs whitespace-pre-line border rounded p-2 bg-muted/40">
                        {selected.notes}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <DialogFooter>
              <Button variant="outline" onClick={closeAction} disabled={submitting}>
                {action === "view" ? "Fermer" : "Annuler"}
              </Button>
              {action !== "view" && (
                <Button onClick={submit} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Confirmer
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
