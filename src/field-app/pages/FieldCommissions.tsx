/**
 * FieldCommissions — Agent-facing commission center (sales-focused).
 * Tabs: Commissions, Retraits, Contestations, Objectifs
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  DollarSign, Loader2, Clock, Check, AlertTriangle, ArrowDownToLine,
  X, Send, Target, MessageSquare, TrendingUp, Award, Receipt, FileText,
  Eye, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { getAutoSafeErrorMessage } from "@/lib/errorUtils";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900", icon: Clock },
  pending_activation: { label: "Activation requise", color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900", icon: Clock },
  validated: { label: "Validé", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900", icon: Check },
  approved: { label: "Approuvé", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900", icon: Check },
  paid: { label: "Payé", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900", icon: Check },
  clawback: { label: "Récupéré", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900", icon: AlertTriangle },
  rejected: { label: "Rejeté", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900", icon: X },
  disputed: { label: "Contesté", color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900", icon: MessageSquare },
};

const WITHDRAWAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "En attente", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900" },
  approved: { label: "Approuvé", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900" },
  paid: { label: "Payé", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900" },
  processing: { label: "En traitement", color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900" },
  rejected: { label: "Refusé", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900" },
  cancelled: { label: "Annulé", color: "text-muted-foreground", bg: "bg-muted" },
};

type TabView = "commissions" | "withdrawals" | "disputes" | "objectives";

const formatActionError = (error: unknown, fallback: string) => {
  const message = getAutoSafeErrorMessage(error) || fallback;
  if (error && typeof error === "object" && "code" in error) {
    return `${message} (code ${String((error as { code?: unknown }).code ?? "n/a")})`;
  }
  return message;
};

export default function FieldCommissions() {
  const { user } = useStaffUser();
  const queryClient = useQueryClient();
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("etransfer");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [activeTab, setActiveTab] = useState<TabView>("commissions");
  const [disputeCommissionId, setDisputeCommissionId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [commissionFilter, setCommissionFilter] = useState<string>("all");

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`field-commissions-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales_commissions", filter: `salesperson_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["field-commissions", user.id] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commission_withdrawal_requests", filter: `agent_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["field-withdrawals", user.id] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const { data: commissions = [], isLoading: loadingCommissions } = useQuery({
    queryKey: ["field-commissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_commissions")
        .select("*, field_sales_orders!sales_commissions_field_order_id_fkey(customer_name, customer_email)")
        .eq("salesperson_id", user!.id)
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: withdrawals = [], isLoading: loadingWithdrawals } = useQuery({
    queryKey: ["field-withdrawals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_withdrawal_requests")
        .select("*")
        .eq("agent_id", user!.id)
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: perfData } = useQuery({
    queryKey: ["field-objectives", user?.id],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: orders } = await supabase
        .from("field_sales_orders")
        .select("id, total_amount, sync_status, created_at")
        .eq("salesperson_id", user!.id)
        .gte("created_at", monthStart);
      return orders || [];
    },
    enabled: !!user?.id,
  });

  // Calculations
  const totalPending = commissions.filter((c: any) => ["pending", "pending_activation"].includes(c.status)).reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.amount || 0), 0);
  const totalApproved = commissions.filter((c: any) => ["approved", "validated"].includes(c.status)).reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.amount || 0), 0);
  const totalPaid = commissions.filter((c: any) => c.status === "paid").reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.amount || 0), 0);
  const totalAll = commissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.amount || 0), 0);
  const pendingWithdrawals = withdrawals.filter((w: any) => ["pending", "approved", "processing"].includes(w.status)).reduce((sum: number, w: any) => sum + Number(w.amount), 0);
  const effectiveAvailable = Math.max(0, totalApproved - pendingWithdrawals);
  const disputedCount = commissions.filter((c: any) => ["disputed", "clawback", "rejected"].includes(c.status)).length;
  const paidWithdrawals = withdrawals.filter((w: any) => w.status === "paid");

  // Performance
  const monthlyOrders = perfData?.length || 0;
  const monthlyRevenue = perfData?.reduce((s, o: any) => s + Number(o.total_amount || 0), 0) || 0;
  const syncedOrders = perfData?.filter((o: any) => o.sync_status === "synced").length || 0;

  const OBJECTIVES = [
    { label: "Ventes ce mois", current: monthlyOrders, target: 20, icon: Target, unit: "commandes" },
    { label: "Revenus générés", current: monthlyRevenue, target: 5000, icon: DollarSign, unit: "$", isCurrency: true },
    { label: "Commandes synchronisées", current: syncedOrders, target: monthlyOrders || 1, icon: TrendingUp, unit: "sync" },
    { label: "Taux de conversion", current: monthlyOrders > 0 ? Math.round((syncedOrders / monthlyOrders) * 100) : 0, target: 85, icon: Award, unit: "%" },
  ];

  const submitWithdrawal = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(withdrawAmount);
      if (!amount || amount <= 0 || amount > effectiveAvailable) throw new Error("Montant invalide");
      if (!withdrawDestination.trim()) throw new Error("Destination requise");
      const notes = [
        `Méthode: ${withdrawMethod}`,
        `Destination: ${withdrawDestination.trim()}`,
        withdrawNotes.trim() || null,
      ].filter(Boolean).join(" | ");

      const { error } = await supabase.from("commission_withdrawal_requests").insert({
        agent_id: user!.id,
        amount,
        notes,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande de retrait soumise !");
      setShowWithdrawForm(false);
      setWithdrawAmount(""); setWithdrawDestination(""); setWithdrawNotes("");
      queryClient.invalidateQueries({ queryKey: ["field-withdrawals"] });
    },
    onError: (err) => toast.error(`Échec demande retrait: ${formatActionError(err, "Action impossible")}`),
  });

  const submitDispute = useMutation({
    mutationFn: async () => {
      if (!disputeCommissionId || !disputeReason.trim()) throw new Error("Raison requise");
      const { error } = await supabase
        .from("sales_commissions")
        .update({ status: "disputed" as any, rejection_reason: `[CONTESTATION] ${disputeReason.trim()}` })
        .eq("id", disputeCommissionId)
        .eq("salesperson_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contestation soumise — l'admin sera notifié");
      setDisputeCommissionId(null); setDisputeReason("");
      queryClient.invalidateQueries({ queryKey: ["field-commissions"] });
    },
    onError: (err) => toast.error(`Échec contestation: ${formatActionError(err, "Action impossible")}`),
  });

  const isLoading = loadingCommissions || loadingWithdrawals;

  const filteredCommissions = commissionFilter === "all"
    ? commissions
    : commissions.filter((c: any) => c.status === commissionFilter);

  const TABS: { key: TabView; label: string; icon: typeof DollarSign; badge?: number }[] = [
    { key: "commissions", label: "Commissions", icon: DollarSign, badge: commissions.length },
    { key: "withdrawals", label: "Retraits", icon: ArrowDownToLine, badge: withdrawals.length },
    { key: "disputes", label: "Contestations", icon: MessageSquare, badge: disputedCount || undefined },
    { key: "objectives", label: "Objectifs", icon: Target },
    { key: "payslips", label: "Fiches de paie", icon: Receipt, badge: paidWithdrawals.length || undefined },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Commissions & Paie</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Suivi complet de vos gains, retraits et objectifs</p>
        </div>
        {effectiveAvailable > 0 && (
          <button onClick={() => setShowWithdrawForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
            <ArrowDownToLine className="h-4 w-4" /> Demander un retrait
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total gagné", value: `${totalAll.toFixed(2)} $`, color: "text-foreground" },
              { label: "En attente", value: `${totalPending.toFixed(2)} $`, color: "text-amber-600" },
              { label: "Disponible", value: `${effectiveAvailable.toFixed(2)} $`, color: "text-blue-600" },
              { label: "Total payé", value: `${totalPaid.toFixed(2)} $`, color: "text-emerald-600" },
              { label: "Retraits en cours", value: `${pendingWithdrawals.toFixed(2)} $`, color: "text-purple-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
                <p className="text-[11px] text-muted-foreground font-medium">{kpi.label}</p>
                <p className={cn("text-lg font-bold mt-1", kpi.color)}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Withdrawal form */}
          {showWithdrawForm && (
            <div className="bg-card border-2 border-emerald-500 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Demande de retrait</h3>
                <button onClick={() => setShowWithdrawForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Montant (max {effectiveAvailable.toFixed(2)} $)</label>
                  <input type="number" min="1" max={effectiveAvailable} step="0.01" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Méthode</label>
                  <select value={withdrawMethod} onChange={(e) => setWithdrawMethod(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                    <option value="etransfer">Virement Interac</option>
                    <option value="bank_transfer">Virement bancaire</option>
                    <option value="cheque">Chèque</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Destination (courriel Interac, # compte, etc.) *</label>
                <input value={withdrawDestination} onChange={(e) => setWithdrawDestination(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder="ex: moncourriel@email.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optionnel)</label>
                <textarea value={withdrawNotes} onChange={(e) => setWithdrawNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder="Notes…" />
              </div>
              <button onClick={() => submitWithdrawal.mutate()} disabled={submitWithdrawal.isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > effectiveAvailable || !withdrawDestination.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                {submitWithdrawal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Soumettre la demande
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-border overflow-x-auto">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && <span className="text-[10px] ml-1 opacity-60">({tab.badge})</span>}
              </button>
            ))}
          </div>

          {/* ═══ COMMISSIONS TAB ═══ */}
          {activeTab === "commissions" && (
            <div className="space-y-3">
              {/* Filter */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "all", label: "Toutes" },
                  { key: "pending_activation", label: "Att. activation" },
                  { key: "validated", label: "Validées" },
                  { key: "paid", label: "Payées" },
                  { key: "rejected", label: "Rejetées" },
                ].map((f) => (
                  <button key={f.key} onClick={() => setCommissionFilter(f.key)}
                    className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors",
                      commissionFilter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                    {f.label}
                  </button>
                ))}
              </div>
              {filteredCommissions.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Aucune commission</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCommissions.map((c: any) => {
                    const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                    const Icon = sc.icon;
                    const amt = Number(c.commission_amount || c.amount || 0);
                    const canDispute = ["clawback", "rejected"].includes(c.status);
                    return (
                      <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", sc.bg)}>
                            <Icon className={cn("h-4 w-4", sc.color)} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{amt.toFixed(2)} $</span>
                              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.color, sc.bg)}>{sc.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {Number(c.sale_amount || 0).toFixed(2)} $ @ {(Number(c.commission_rate || 0) * 100).toFixed(0)}%
                              {c.field_sales_orders?.customer_name && ` — ${c.field_sales_orders.customer_name}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canDispute && (
                            <button onClick={() => { setDisputeCommissionId(c.id); setActiveTab("disputes"); }}
                              className="text-[10px] font-medium px-2 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-400 transition-colors">
                              Contester
                            </button>
                          )}
                          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ WITHDRAWALS TAB ═══ */}
          {activeTab === "withdrawals" && (
            <div className="space-y-3">
              {effectiveAvailable > 0 && !showWithdrawForm && (
                <button onClick={() => setShowWithdrawForm(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors">
                  + Nouvelle demande de retrait ({effectiveAvailable.toFixed(2)} $ disponible)
                </button>
              )}
              {withdrawals.length === 0 ? (
                <div className="text-center py-12">
                  <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Aucune demande de retrait</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map((w: any) => {
                    const ws = WITHDRAWAL_STATUS[w.status] || WITHDRAWAL_STATUS.pending;
                    return (
                      <div key={w.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{Number(w.amount).toFixed(2)} $</span>
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", ws.color, ws.bg)}>{ws.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{w.notes || "Demande de retrait"}</p>
                          {w.admin_notes && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Admin: {w.admin_notes}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">{formatDistanceToNow(new Date(w.created_at), { addSuffix: true, locale: fr })}</span>
                          {w.paid_at && <span className="text-[10px] text-emerald-600 block">Payé le {format(new Date(w.paid_at), "dd/MM/yyyy")}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ DISPUTES TAB ═══ */}
          {activeTab === "disputes" && (
            <div className="space-y-4">
              {disputeCommissionId && (
                <div className="bg-card border-2 border-yellow-500 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">Contester une commission</h3>
                    <button onClick={() => { setDisputeCommissionId(null); setDisputeReason(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground">Commission ID: <span className="font-mono">{disputeCommissionId.slice(0, 8)}…</span></p>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Raison de la contestation *</label>
                    <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                      placeholder="Expliquez pourquoi cette commission devrait être révisée…" />
                  </div>
                  <button onClick={() => submitDispute.mutate()} disabled={submitDispute.isPending || !disputeReason.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-40 transition-colors">
                    {submitDispute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                    Soumettre la contestation
                  </button>
                </div>
              )}

              {(() => {
                const disputed = commissions.filter((c: any) => ["disputed", "clawback", "rejected"].includes(c.status));
                return disputed.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Aucune contestation</p>
                    <p className="text-xs text-muted-foreground mt-1">Les commissions rejetées ou récupérées apparaîtront ici</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {disputed.map((c: any) => {
                      const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                      const Icon = sc.icon;
                      return (
                        <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", sc.bg)}>
                              <Icon className={cn("h-4 w-4", sc.color)} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">{Number(c.commission_amount || c.amount || 0).toFixed(2)} $</span>
                                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.color, sc.bg)}>{sc.label}</span>
                              </div>
                              {c.rejection_reason && <p className="text-xs text-muted-foreground mt-0.5">« {c.rejection_reason} »</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {c.status !== "disputed" && (
                              <button onClick={() => setDisputeCommissionId(c.id)}
                                className="text-[10px] font-medium px-2 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-400 transition-colors">
                                Contester
                              </button>
                            )}
                            {c.status === "disputed" && <span className="text-[10px] text-yellow-600 font-medium">En révision par l'admin</span>}
                            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ OBJECTIVES TAB ═══ */}
          {activeTab === "objectives" && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-bold text-foreground mb-1">Objectifs du mois</h3>
                <p className="text-xs text-muted-foreground">{format(new Date(), "MMMM yyyy", { locale: fr })}</p>
              </div>
              <div className="grid gap-3">
                {OBJECTIVES.map((obj) => {
                  const progress = Math.min(100, Math.round((obj.current / obj.target) * 100));
                  const achieved = progress >= 100;
                  return (
                    <div key={obj.label} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", achieved ? "bg-emerald-100 dark:bg-emerald-900" : "bg-muted")}>
                            <obj.icon className={cn("h-4 w-4", achieved ? "text-emerald-600" : "text-muted-foreground")} />
                          </div>
                          <span className="text-sm font-medium text-foreground">{obj.label}</span>
                        </div>
                        <div className="text-right">
                          <span className={cn("text-sm font-bold", achieved ? "text-emerald-600" : "text-foreground")}>
                            {obj.isCurrency ? `${obj.current.toFixed(0)} $` : obj.current}
                          </span>
                          <span className="text-xs text-muted-foreground"> / {obj.isCurrency ? `${obj.target} $` : `${obj.target} ${obj.unit}`}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", achieved ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 text-right">{progress}%</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><Award className="h-4 w-4" /> Paliers de commission</h4>
                <div className="space-y-1.5">
                  {[
                    { range: "1–5 ventes", rate: "8%", bonus: "—" },
                    { range: "6–15 ventes", rate: "10%", bonus: "25 $ / vente" },
                    { range: "16–30 ventes", rate: "12%", bonus: "50 $ / vente" },
                    { range: "31+ ventes", rate: "15%", bonus: "75 $ / vente" },
                  ].map((tier) => (
                    <div key={tier.range} className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium">{tier.range}</span>
                      <div className="flex gap-4">
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">{tier.rate}</span>
                        <span className="text-muted-foreground">{tier.bonus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ PAYSLIPS TAB ═══ */}
          {activeTab === "payslips" && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2"><Receipt className="h-4 w-4" /> Historique de paie</h3>
                <p className="text-xs text-muted-foreground">Résumé de tous vos paiements reçus et commissions payées.</p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-[11px] text-muted-foreground">Commissions payées</p>
                  <p className="text-lg font-bold text-emerald-600 mt-1">{totalPaid.toFixed(2)} $</p>
                  <p className="text-[10px] text-muted-foreground">{commissions.filter((c: any) => c.status === "paid").length} transactions</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-[11px] text-muted-foreground">Retraits payés</p>
                  <p className="text-lg font-bold text-blue-600 mt-1">{paidWithdrawals.reduce((s, w: any) => s + Number(w.amount), 0).toFixed(2)} $</p>
                  <p className="text-[10px] text-muted-foreground">{paidWithdrawals.length} retraits</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-[11px] text-muted-foreground">Retenues / récupérations</p>
                  <p className="text-lg font-bold text-red-600 mt-1">
                    {commissions.filter((c: any) => c.status === "clawback").reduce((s: number, c: any) => s + Number(c.commission_amount || c.amount || 0), 0).toFixed(2)} $
                  </p>
                </div>
              </div>

              {/* Paid commissions list */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Commissions payées</h4>
                {(() => {
                  const paid = commissions.filter((c: any) => c.status === "paid");
                  return paid.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucune commission payée</p>
                  ) : (
                    <div className="space-y-2">
                      {paid.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-100 dark:bg-emerald-900">
                              <Check className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-foreground">{Number(c.commission_amount || c.amount || 0).toFixed(2)} $</span>
                              {c.field_sales_orders?.customer_name && <p className="text-xs text-muted-foreground">{c.field_sales_orders.customer_name}</p>}
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : format(new Date(c.created_at), "dd/MM/yyyy")}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Paid withdrawals list */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Retraits complétés</h4>
                {paidWithdrawals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucun retrait complété</p>
                ) : (
                  <div className="space-y-2">
                    {paidWithdrawals.map((w: any) => (
                      <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900">
                            <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-foreground">{Number(w.amount).toFixed(2)} $</span>
                            <p className="text-xs text-muted-foreground">{w.notes || "Retrait"}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{w.paid_at ? format(new Date(w.paid_at), "dd/MM/yyyy") : format(new Date(w.reviewed_at || w.created_at), "dd/MM/yyyy")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
