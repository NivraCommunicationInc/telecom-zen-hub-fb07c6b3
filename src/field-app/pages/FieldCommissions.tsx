/**
 * FieldCommissions — Commission tracking, withdrawal requests, disputes & objectives.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  DollarSign, Loader2, Clock, Check, AlertTriangle, ArrowDownToLine,
  X, Send, Target, MessageSquare, TrendingUp, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-[#D97706]", bg: "bg-[#FEF3C7]", icon: Clock },
  pending_activation: { label: "Activation requise", color: "text-[#9333EA]", bg: "bg-[#F3E8FF]", icon: Clock },
  validated: { label: "Validé", color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]", icon: Check },
  approved: { label: "Approuvé", color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]", icon: Check },
  paid: { label: "Payé", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]", icon: Check },
  clawback: { label: "Récupéré", color: "text-[#DC2626]", bg: "bg-[#FEE2E2]", icon: AlertTriangle },
  rejected: { label: "Rejeté", color: "text-[#DC2626]", bg: "bg-[#FEE2E2]", icon: X },
  disputed: { label: "Contesté", color: "text-[#F59E0B]", bg: "bg-[#FEF3C7]", icon: MessageSquare },
};

const WITHDRAWAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "En attente", color: "text-[#D97706]", bg: "bg-[#FEF3C7]" },
  approved: { label: "Approuvé", color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]" },
  paid: { label: "Payé", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
  rejected: { label: "Refusé", color: "text-[#DC2626]", bg: "bg-[#FEE2E2]" },
  cancelled: { label: "Annulé", color: "text-[#6B7280]", bg: "bg-[#F3F4F6]" },
};

type TabView = "commissions" | "withdrawals" | "disputes" | "objectives";

export default function FieldCommissions() {
  const { user } = useStaffUser();
  const queryClient = useQueryClient();
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [activeTab, setActiveTab] = useState<TabView>("commissions");
  const [disputeCommissionId, setDisputeCommissionId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const { data: commissions = [], isLoading: loadingCommissions } = useQuery({
    queryKey: ["field-commissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_commissions")
        .select("*")
        .eq("agent_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: withdrawals = [], isLoading: loadingWithdrawals } = useQuery({
    queryKey: ["commission-withdrawals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_withdrawal_requests")
        .select("*")
        .eq("agent_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Performance data for objectives
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

  const totalPending = commissions.filter((c: any) => ["pending", "pending_activation"].includes(c.status)).reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalApproved = commissions.filter((c: any) => ["approved", "validated"].includes(c.status)).reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalPaid = commissions.filter((c: any) => c.status === "paid").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const availableBalance = totalApproved;
  const pendingWithdrawals = withdrawals.filter((w: any) => w.status === "pending").reduce((sum: number, w: any) => sum + Number(w.amount), 0);
  const effectiveAvailable = Math.max(0, availableBalance - pendingWithdrawals);
  const disputedCount = commissions.filter((c: any) => c.status === "disputed" || c.status === "clawback" || c.status === "rejected").length;

  // Objectives
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
      const { error } = await supabase.from("commission_withdrawal_requests").insert({
        agent_id: user!.id,
        amount,
        notes: withdrawNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande de retrait soumise !");
      setShowWithdrawForm(false);
      setWithdrawAmount("");
      setWithdrawNotes("");
      queryClient.invalidateQueries({ queryKey: ["commission-withdrawals"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
  });

  const submitDispute = useMutation({
    mutationFn: async () => {
      if (!disputeCommissionId || !disputeReason.trim()) throw new Error("Raison requise");
      // Update commission status to disputed and add reason in notes
      const { error } = await supabase
        .from("field_commissions")
        .update({ status: "disputed", notes: `Contestation: ${disputeReason.trim()}` })
        .eq("id", disputeCommissionId)
        .eq("agent_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contestation soumise — l'admin sera notifié");
      setDisputeCommissionId(null);
      setDisputeReason("");
      queryClient.invalidateQueries({ queryKey: ["field-commissions"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
  });

  const isLoading = loadingCommissions || loadingWithdrawals;

  const TABS: { key: TabView; label: string; icon: typeof DollarSign; count?: number }[] = [
    { key: "commissions", label: "Commissions", icon: DollarSign, count: commissions.length },
    { key: "withdrawals", label: "Retraits", icon: ArrowDownToLine, count: withdrawals.length },
    { key: "disputes", label: "Contestations", icon: MessageSquare, count: disputedCount },
    { key: "objectives", label: "Objectifs", icon: Target },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#000000]">Commissions</h1>
        {effectiveAvailable > 0 && (
          <button
            onClick={() => setShowWithdrawForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Demander un retrait
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">En attente</p>
              <p className="text-lg font-bold text-[#D97706] mt-1">{totalPending.toFixed(2)} $</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Disponible</p>
              <p className="text-lg font-bold text-[#3B82F6] mt-1">{effectiveAvailable.toFixed(2)} $</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Total payé</p>
              <p className="text-lg font-bold text-[#16A34A] mt-1">{totalPaid.toFixed(2)} $</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Retraits en cours</p>
              <p className="text-lg font-bold text-[#9333EA] mt-1">{pendingWithdrawals.toFixed(2)} $</p>
            </div>
          </div>

          {/* Withdrawal form */}
          {showWithdrawForm && (
            <div className="bg-white border-2 border-[#22C55E] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#000000]">Demande de retrait</h3>
                <button onClick={() => setShowWithdrawForm(false)} className="text-[#6B7280] hover:text-[#000000]"><X className="h-4 w-4" /></button>
              </div>
              <div>
                <label className="text-xs font-medium text-[#374151] mb-1 block">Montant (max {effectiveAvailable.toFixed(2)} $)</label>
                <input type="number" min="1" max={effectiveAvailable} step="0.01" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#374151] mb-1 block">Notes (optionnel)</label>
                <textarea value={withdrawNotes} onChange={(e) => setWithdrawNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]" placeholder="Raison du retrait…" />
              </div>
              <button onClick={() => submitWithdrawal.mutate()} disabled={submitWithdrawal.isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > effectiveAvailable} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] disabled:opacity-40 transition-colors">
                {submitWithdrawal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Soumettre la demande
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-[#E5E7EB] overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.key ? "border-[#22C55E] text-[#16A34A]" : "border-transparent text-[#6B7280] hover:text-[#000000]"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.count !== undefined && <span className="text-[10px] ml-1 opacity-60">({tab.count})</span>}
              </button>
            ))}
          </div>

          {/* ═══ COMMISSIONS TAB ═══ */}
          {activeTab === "commissions" && (
            commissions.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
                <p className="text-sm text-[#9CA3AF]">Aucune commission</p>
              </div>
            ) : (
              <div className="space-y-2">
                {commissions.map((c: any) => {
                  const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                  const Icon = sc.icon;
                  const canDispute = ["clawback", "rejected"].includes(c.status);
                  return (
                    <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-[#E5E7EB] bg-white">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", sc.bg)}>
                          <Icon className={cn("h-4 w-4", sc.color)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#000000]">{Number(c.amount).toFixed(2)} $</span>
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.color, sc.bg)}>{sc.label}</span>
                          </div>
                          {c.notes && <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{c.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canDispute && (
                          <button
                            onClick={() => { setDisputeCommissionId(c.id); setActiveTab("disputes"); }}
                            className="text-[10px] font-medium px-2 py-1 rounded bg-[#FEF3C7] text-[#D97706] hover:bg-[#FDE68A] transition-colors"
                          >
                            Contester
                          </button>
                        )}
                        <span className="text-[10px] text-[#9CA3AF]">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ═══ WITHDRAWALS TAB ═══ */}
          {activeTab === "withdrawals" && (
            withdrawals.length === 0 ? (
              <div className="text-center py-12">
                <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
                <p className="text-sm text-[#9CA3AF]">Aucune demande de retrait</p>
                {effectiveAvailable > 0 && (
                  <button onClick={() => setShowWithdrawForm(true)} className="mt-3 text-sm text-[#22C55E] hover:text-[#16A34A] font-medium">
                    + Nouvelle demande de retrait
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {withdrawals.map((w: any) => {
                  const ws = WITHDRAWAL_STATUS[w.status] || WITHDRAWAL_STATUS.pending;
                  return (
                    <div key={w.id} className="flex items-center justify-between p-4 rounded-xl border border-[#E5E7EB] bg-white">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#000000]">{Number(w.amount).toFixed(2)} $</span>
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", ws.color, ws.bg)}>{ws.label}</span>
                        </div>
                        {w.notes && <p className="text-xs text-[#6B7280] mt-0.5">{w.notes}</p>}
                        {w.admin_notes && <p className="text-xs text-[#DC2626] mt-0.5">Admin: {w.admin_notes}</p>}
                      </div>
                      <span className="text-[10px] text-[#9CA3AF]">
                        {formatDistanceToNow(new Date(w.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ═══ DISPUTES TAB ═══ */}
          {activeTab === "disputes" && (
            <div className="space-y-4">
              {/* Dispute form */}
              {disputeCommissionId && (
                <div className="bg-white border-2 border-[#F59E0B] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#000000]">Contester une commission</h3>
                    <button onClick={() => { setDisputeCommissionId(null); setDisputeReason(""); }} className="text-[#6B7280] hover:text-[#000000]"><X className="h-4 w-4" /></button>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    Commission ID: <span className="font-mono">{disputeCommissionId.slice(0, 8)}…</span>
                  </p>
                  <div>
                    <label className="text-xs font-medium text-[#374151] mb-1 block">Raison de la contestation *</label>
                    <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 focus:border-[#F59E0B]" placeholder="Expliquez pourquoi cette commission devrait être révisée…" />
                  </div>
                  <button onClick={() => submitDispute.mutate()} disabled={submitDispute.isPending || !disputeReason.trim()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#F59E0B] text-white text-sm font-semibold hover:bg-[#D97706] disabled:opacity-40 transition-colors">
                    {submitDispute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                    Soumettre la contestation
                  </button>
                </div>
              )}

              {/* Disputed commissions list */}
              {(() => {
                const disputed = commissions.filter((c: any) => ["disputed", "clawback", "rejected"].includes(c.status));
                return disputed.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
                    <p className="text-sm text-[#9CA3AF]">Aucune contestation</p>
                    <p className="text-xs text-[#D1D5DB] mt-1">Les commissions rejetées ou récupérées apparaîtront ici</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {disputed.map((c: any) => {
                      const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                      const Icon = sc.icon;
                      return (
                        <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-[#E5E7EB] bg-white">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", sc.bg)}>
                              <Icon className={cn("h-4 w-4", sc.color)} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[#000000]">{Number(c.amount).toFixed(2)} $</span>
                                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.color, sc.bg)}>{sc.label}</span>
                              </div>
                              {c.notes && <p className="text-xs text-[#6B7280] mt-0.5">{c.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {c.status !== "disputed" && (
                              <button
                                onClick={() => setDisputeCommissionId(c.id)}
                                className="text-[10px] font-medium px-2 py-1 rounded bg-[#FEF3C7] text-[#D97706] hover:bg-[#FDE68A] transition-colors"
                              >
                                Contester
                              </button>
                            )}
                            <span className="text-[10px] text-[#9CA3AF]">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                            </span>
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
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                <h3 className="text-sm font-bold text-[#000000] mb-1">Objectifs du mois</h3>
                <p className="text-xs text-[#6B7280]">{format(new Date(), "MMMM yyyy", { locale: fr })}</p>
              </div>

              <div className="grid gap-3">
                {OBJECTIVES.map((obj) => {
                  const progress = Math.min(100, Math.round((obj.current / obj.target) * 100));
                  const achieved = progress >= 100;
                  return (
                    <div key={obj.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", achieved ? "bg-[#DCFCE7]" : "bg-[#F3F4F6]")}>
                            <obj.icon className={cn("h-4 w-4", achieved ? "text-[#16A34A]" : "text-[#6B7280]")} />
                          </div>
                          <span className="text-sm font-medium text-[#000000]">{obj.label}</span>
                        </div>
                        <div className="text-right">
                          <span className={cn("text-sm font-bold", achieved ? "text-[#16A34A]" : "text-[#000000]")}>
                            {obj.isCurrency ? `${obj.current.toFixed(0)} $` : obj.current}
                          </span>
                          <span className="text-xs text-[#9CA3AF]"> / {obj.isCurrency ? `${obj.target} $` : `${obj.target} ${obj.unit}`}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", achieved ? "bg-[#22C55E]" : "bg-[#3B82F6]")}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#9CA3AF] mt-1 text-right">{progress}%</p>
                    </div>
                  );
                })}
              </div>

              {/* Tier info */}
              <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-bold text-[#16A34A] flex items-center gap-2">
                  <Award className="h-4 w-4" /> Paliers de commission
                </h4>
                <div className="space-y-1.5">
                  {[
                    { range: "1–5 ventes", rate: "8%", bonus: "—" },
                    { range: "6–15 ventes", rate: "10%", bonus: "25 $ / vente" },
                    { range: "16–30 ventes", rate: "12%", bonus: "50 $ / vente" },
                    { range: "31+ ventes", rate: "15%", bonus: "75 $ / vente" },
                  ].map((tier) => (
                    <div key={tier.range} className="flex items-center justify-between text-xs">
                      <span className="text-[#374151] font-medium">{tier.range}</span>
                      <div className="flex gap-4">
                        <span className="text-[#16A34A] font-bold">{tier.rate}</span>
                        <span className="text-[#6B7280]">{tier.bonus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
