import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  fetchCommissionSummary,
  fetchCommissionList,
  fetchWithdrawals,
  createCommissionDispute,
  requestWithdrawal,
} from "@/field-app/lib/fieldServices";
import {
  DollarSign,
  Loader2,
  Clock,
  Check,
  AlertTriangle,
  ArrowDownToLine,
  X,
  Send,
  MessageSquare,
  Wallet,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CommissionGridTables from "@/components/commissions/CommissionGridTables";
import { Target } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
  pending: { label: "En attente", tone: "bg-amber-100 text-amber-800 border border-amber-300", icon: Clock },
  pending_activation: { label: "Activation requise", tone: "bg-amber-100 text-amber-800 border border-amber-300", icon: Clock },
  validated: { label: "Validé", tone: "bg-green-100 text-green-800 border border-green-300", icon: Check },
  approved: { label: "Approuvé", tone: "bg-green-100 text-green-800 border border-green-300", icon: Check },
  paid: { label: "Payé", tone: "bg-blue-100 text-blue-800 border border-blue-300", icon: Check },
  on_hold: { label: "En attente", tone: "bg-orange-100 text-orange-800 border border-orange-300", icon: Clock },
  clawback: { label: "Récupéré", tone: "bg-red-100 text-red-800 border border-red-300", icon: AlertTriangle },
  rejected: { label: "Rejeté", tone: "bg-red-100 text-red-800 border border-red-300", icon: X },
  disputed: { label: "Contesté", tone: "bg-amber-100 text-amber-800 border border-amber-300", icon: MessageSquare },
};

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  processing: "En traitement",
  paid: "Payé",
  rejected: "Rejeté",
};

const formatCommissionAmount = (amount: number | string | null | undefined) =>
  new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2
  }).format(Number(amount || 0));

const getCommissionLabel = (c: any): string => {
  if (c.description && c.description !== '—' && c.description.trim()) return c.description;
  if (c.order_number) return `Commande #${c.order_number}`;
  if (c.field_sales_orders?.customer_name) return c.field_sales_orders.customer_name;
  if (c.commission_type === 'forfait' || c.commission_type === 'sale') return 'Commission forfait';
  if (c.commission_type === 'equipment') return 'Commission équipement';
  if (c.commission_type === 'monthly_bonus') return 'Bonus mensuel';
  return 'Commission vente';
};

const getCommissionDate = (c: any): string => {
  const d = c.earned_at || c.created_at;
  if (!d) return 'Date de vente';
  return new Date(d).toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

type TabView = "commissions" | "withdrawals" | "disputes";

export default function FieldCommissions() {
  const queryClient = useQueryClient();
  const { user } = useStaffUser();
  const [activeTab, setActiveTab] = useState<TabView>("commissions");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [disputeCommissionId, setDisputeCommissionId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [commissionFilter, setCommissionFilter] = useState("all");

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ["field-commission-summary"],
    queryFn: fetchCommissionSummary,
    refetchInterval: 10000,
  });

  const { data: commissionsData, isLoading: loadingCommissions } = useQuery({
    queryKey: ["field-commission-list", commissionFilter],
    queryFn: () => fetchCommissionList(commissionFilter !== "all" ? commissionFilter : undefined),
    refetchInterval: 15000,
  });

  const { data: withdrawalsData, isLoading: loadingWithdrawals } = useQuery({
    queryKey: ["field-withdrawals"],
    queryFn: fetchWithdrawals,
    refetchInterval: 15000,
  });

  // Direct DB fallback if edge function returns 0
  const { data: directCommissions } = useQuery({
    queryKey: ["field-commission-direct", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("field_commissions")
        .select("amount, status")
        .eq("agent_id", user.id);
      console.log("[commission] direct rows:", data, "error:", error);
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  /* Realtime — listen to sales_commissions for this agent.
     Insert  → "Nouvelle commission ajoutée"
     Update  → status change toast (validated / paid / rejected) */
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`field-commissions-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "field_commissions",
          filter: `agent_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["field-commission-summary"] });
          queryClient.invalidateQueries({ queryKey: ["field-commission-list"] });

          if (payload.eventType === "INSERT") {
            toast.success("Nouvelle commission ajoutée");
          } else if (payload.eventType === "UPDATE") {
            const oldStatus = (payload.old as any)?.status;
            const newStatus = (payload.new as any)?.status;
            if (oldStatus !== newStatus && newStatus) {
              const labels: Record<string, string> = {
                validated: "Commission validée",
                approved: "Commission approuvée",
                paid: "Commission payée",
                rejected: "Commission rejetée",
                clawback: "Commission récupérée",
              };
              const msg = labels[newStatus];
              if (msg) toast(msg);
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const edgeSummary = summaryData?.summary || {
    pending: 0,
    approved: 0,
    paid: 0,
    total: 0,
    effectiveAvailable: 0,
    pendingWithdrawals: 0,
    disputedCount: 0,
  };

  const directTotal = (directCommissions || []).reduce(
    (sum: number, c: any) => sum + Number(c.amount || 0),
    0
  );
  const directPending = (directCommissions || [])
    .filter((c: any) => ["pending", "pending_activation"].includes(c.status))
    .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
  const directApproved = (directCommissions || [])
    .filter((c: any) => ["validated", "approved", "payable"].includes(c.status))
    .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
  const directPaid = (directCommissions || [])
    .filter((c: any) => ["paid", "included_in_payroll"].includes(c.status))
    .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

  const summary = {
    ...edgeSummary,
    total: Number(edgeSummary.total) > 0 ? edgeSummary.total : directTotal,
    pending: Number(edgeSummary.pending) > 0 ? edgeSummary.pending : directPending,
    approved: Number(edgeSummary.approved) > 0 ? edgeSummary.approved : directApproved,
    paid: Number(edgeSummary.paid) > 0 ? edgeSummary.paid : directPaid,
    effectiveAvailable:
      Number(edgeSummary.effectiveAvailable) > 0
        ? edgeSummary.effectiveAvailable
        : Math.max(0, directApproved - Number(edgeSummary.pendingWithdrawals || 0)),
  };

  const commissions = commissionsData?.commissions || [];
  const withdrawals = withdrawalsData?.withdrawals || [];
  const isLoading = loadingSummary || loadingCommissions || loadingWithdrawals;
  const availableBalance = Number(summary.effectiveAvailable ?? 0);

  const disputedCommissions = useMemo(
    () => commissions.filter((commission: any) => ["disputed", "clawback", "rejected"].includes(commission.status)),
    [commissions]
  );

  const submitWithdrawal = useMutation({
    mutationFn: async () => {
      const amount = Number(withdrawAmount);
      const email = withdrawDestination.trim();

      if (!amount || amount <= 0) {
        throw new Error("Montant invalide");
      }
      if (amount > availableBalance) {
        throw new Error("Le montant dépasse votre solde disponible");
      }
      if (!email) {
        throw new Error("Le courriel PayPal est requis");
      }

      return requestWithdrawal(amount, "paypal", email, withdrawNotes.trim());
    },
    onSuccess: () => {
      toast.success("Demande de retrait soumise");
      setShowWithdrawForm(false);
      setWithdrawAmount("");
      setWithdrawDestination("");
      setWithdrawNotes("");
      queryClient.invalidateQueries({ queryKey: ["field-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["field-commission-summary"] });
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de la demande"),
  });

  const submitDispute = useMutation({
    mutationFn: () => createCommissionDispute(disputeCommissionId!, disputeReason),
    onSuccess: () => {
      toast.success("Contestation soumise");
      setDisputeCommissionId(null);
      setDisputeReason("");
      queryClient.invalidateQueries({ queryKey: ["field-commission-list"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 field-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Commissions</h1>
          <p className="text-sm text-[hsl(var(--field-text-muted))] mt-0.5">
            Solde disponible, retraits et historique agent
          </p>
        </div>
        <button
          onClick={() => {
            setActiveTab("withdrawals");
            setShowWithdrawForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl field-gradient-accent text-white text-sm font-semibold field-glow disabled:opacity-40"
        >
          <ArrowDownToLine className="h-4 w-4" /> Demander un retrait
        </button>
      </div>

      {/* Sections A/B/C — official commission & bonus grids + my targets */}
      <FieldGridsAndTargets userId={user?.id} />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--field-accent))]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
            {[
              { label: "Total gagné", value: formatCommissionAmount(summary.total), color: "text-white" },
              { label: "En attente", value: formatCommissionAmount(summary.pending), color: "text-[hsl(var(--field-warning))]" },
              { label: "Disponible", value: formatCommissionAmount(availableBalance), color: "text-[hsl(var(--field-accent-glow))]" },
              { label: "Total payé", value: formatCommissionAmount(summary.paid), color: "text-[hsl(var(--field-success))]" },
              { label: "Retraits en cours", value: formatCommissionAmount(summary.pendingWithdrawals), color: "text-[hsl(var(--field-text-muted))]" },
            ].map((item) => (
              <div key={item.label} className="bg-[hsl(var(--field-card))] border border-[hsl(var(--field-border-subtle))] rounded-xl p-4 md:p-5">
                <p className="text-[11px] md:text-xs text-[hsl(var(--field-text-dim))] font-medium uppercase tracking-wider">{item.label}</p>
                <p className={cn("text-lg md:text-xl font-bold mt-1", item.color)}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[hsl(var(--field-accent)/0.15)] flex items-center justify-center text-[hsl(var(--field-accent-glow))] shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Solde disponible au retrait</p>
              <p className="text-2xl font-bold text-[hsl(var(--field-accent-glow))] mt-1">{formatCommissionAmount(availableBalance)}</p>
              <p className="text-xs text-[hsl(var(--field-text-muted))] mt-1">
                Disponible = commissions approuvées moins retraits en attente.
              </p>
            </div>
          </div>

          {showWithdrawForm && (
            <div className="bg-[hsl(var(--field-card))] border border-[hsl(var(--field-accent)/0.4)] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Demander un retrait</h2>
                <button onClick={() => setShowWithdrawForm(false)} className="text-[hsl(var(--field-text-muted))] hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-[hsl(var(--field-text-muted))] mb-1 block">
                    Montant (max {formatCommissionAmount(availableBalance)})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={availableBalance}
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-bg-elevated))] text-sm text-white"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[hsl(var(--field-text-muted))] mb-1 block">Méthode</label>
                  <div className="w-full px-3 py-2.5 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-bg-elevated))] text-sm text-white">
                    PayPal
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[hsl(var(--field-text-muted))] mb-1 block">
                  Courriel PayPal
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--field-text-dim))]" />
                  <input
                    type="email"
                    value={withdrawDestination}
                    onChange={(e) => setWithdrawDestination(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-bg-elevated))] text-sm text-white"
                    placeholder="paypal@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[hsl(var(--field-text-muted))] mb-1 block">Note optionnelle</label>
                <textarea
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-bg-elevated))] text-sm text-white"
                  placeholder="Information additionnelle..."
                />
              </div>

              <button
                onClick={() => submitWithdrawal.mutate()}
                disabled={submitWithdrawal.isPending || availableBalance <= 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl field-gradient-accent text-white text-sm font-semibold field-glow disabled:opacity-40"
              >
                {submitWithdrawal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Soumettre
              </button>
            </div>
          )}

          <div className="flex border-b border-[hsl(var(--field-border-subtle))] overflow-x-auto">
            {([
              { key: "commissions", label: "Commissions", icon: DollarSign },
              { key: "withdrawals", label: "Retraits", icon: ArrowDownToLine },
              { key: "disputes", label: "Contestations", icon: MessageSquare },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 min-h-[48px] text-sm md:text-base font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.key
                    ? "border-[hsl(var(--field-accent))] text-white"
                    : "border-transparent text-[hsl(var(--field-text-muted))] hover:text-white"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "commissions" && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "all", label: "Toutes" },
                  { key: "pending_activation", label: "Att. activation" },
                  { key: "validated", label: "Validées" },
                  { key: "paid", label: "Payées" },
                  { key: "rejected", label: "Rejetées" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setCommissionFilter(filter.key)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-xl border transition-colors",
                      commissionFilter === filter.key
                        ? "bg-[hsl(var(--field-accent)/0.18)] text-white border-[hsl(var(--field-accent)/0.45)]"
                        : "bg-[hsl(var(--field-card))] border-[hsl(var(--field-border-subtle))] text-[hsl(var(--field-text-muted))] hover:text-white"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {commissions.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--field-text-dim))]" />
                  <p className="text-sm text-[hsl(var(--field-text-muted))]">Aucune commission</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {commissions.map((commission: any) => {
                    const statusConfig = STATUS_CONFIG[commission.status] || STATUS_CONFIG.pending;
                    const Icon = statusConfig.icon;
                    const amount = commission.amount || commission.commission_amount || 0;
                    const canDispute = ["clawback", "rejected"].includes(commission.status);

                    return (
                      <div
                        key={commission.id}
                        className="flex items-center justify-between p-4 rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", statusConfig.tone)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{formatCommissionAmount(amount)}</p>
                            <p className="text-[11px] text-[hsl(var(--field-text-muted))] truncate">
                              {getCommissionLabel(commission)}
                            </p>
                            <p className="text-[10px] text-[hsl(var(--field-text-dim))] mt-0.5">
                              {getCommissionDate(commission)}
                            </p>
                            {commission.status_explanation && (
                              <p className="text-[10px] text-[hsl(var(--field-text-dim))] mt-0.5">
                                {commission.status_explanation}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusConfig.tone)}>
                            {statusConfig.label}
                          </span>
                          {canDispute && (
                            <button
                              onClick={() => setDisputeCommissionId(commission.id)}
                              className="text-[10px] text-[hsl(var(--field-warning))] hover:underline"
                            >
                              Contester
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "withdrawals" && (
            <div className="space-y-2">
              {withdrawals.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]">
                  <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--field-text-dim))]" />
                  <p className="text-sm text-[hsl(var(--field-text-muted))]">Aucun retrait</p>
                </div>
              ) : (
                withdrawals.map((withdrawal: any) => {
                  const status = withdrawal.status || "pending";
                  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
                  return (
                    <div
                      key={withdrawal.id}
                      className="p-4 rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{formatCommissionAmount(withdrawal.amount)}</p>
                        <p className="text-[10px] text-[hsl(var(--field-text-muted))] mt-0.5 truncate">
                          {withdrawal.notes || "Retrait PayPal"}
                        </p>
                      </div>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", statusConfig.tone)}>
                        {WITHDRAWAL_STATUS_LABELS[status] || status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "disputes" && (
            <div className="space-y-2">
              {disputedCommissions.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--field-text-dim))]" />
                  <p className="text-sm text-[hsl(var(--field-text-muted))]">Aucune contestation</p>
                </div>
              ) : (
                disputedCommissions.map((commission: any) => {
                  const statusConfig = STATUS_CONFIG[commission.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={commission.id} className="p-4 rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">
                          {formatCommissionAmount(commission.amount || commission.commission_amount)}
                        </p>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusConfig.tone)}>
                          {statusConfig.label}
                        </span>
                      </div>
                      {commission.rejection_reason && (
                        <p className="text-xs text-[hsl(var(--field-text-muted))] mt-2">{commission.rejection_reason}</p>
                      )}
                      {commission.next_action && (
                        <p className="text-[10px] text-[hsl(var(--field-text-dim))] mt-1">{commission.next_action}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {disputeCommissionId && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-[hsl(var(--field-card))] rounded-2xl border border-[hsl(var(--field-border-subtle))] p-5 max-w-md w-full space-y-4">
                <h3 className="text-sm font-bold text-white">Contester cette commission</h3>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={3}
                  placeholder="Raison de la contestation..."
                  className="w-full px-3 py-2.5 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-bg-elevated))] text-sm text-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setDisputeCommissionId(null);
                      setDisputeReason("");
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-[hsl(var(--field-border-subtle))] text-sm text-white"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => submitDispute.mutate()}
                    disabled={!disputeReason.trim() || submitDispute.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-[hsl(var(--field-warning))] text-white text-sm font-semibold disabled:opacity-40"
                  >
                    {submitDispute.isPending ? "..." : "Soumettre"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   FIELD GRIDS & TARGETS — Sections A, B, C (read-only)
   ════════════════════════════════════════════════════════════════ */
function FieldGridsAndTargets({ userId }: { userId?: string }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1).toISOString();
  const monthEnd = new Date(year, month, 1).toISOString();

  const { data: monthSales = 0 } = useQuery({
    queryKey: ["field-month-sales", userId, year, month],
    queryFn: async () => {
      if (!userId) return 0;
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("created_by_agent_id", userId)
        .gte("created_at", monthStart)
        .lt("created_at", monthEnd)
        .in("status", ["activated", "completed", "active"]);
      return count ?? 0;
    },
    enabled: !!userId,
  });

  const { data: targets = [] } = useQuery({
    queryKey: ["field-targets", userId, year, month],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("sales_targets")
        .select("service_type, target_count")
        .eq("employee_id", userId)
        .eq("period_year", year)
        .eq("period_month", month);
      return data ?? [];
    },
    enabled: !!userId,
  });

  const weeklyT = (targets as any[]).find((t) => t.service_type === "weekly_sales")?.target_count ?? 0;
  const monthlyT = (targets as any[]).find((t) => t.service_type === "total_sales")?.target_count ?? 0;
  const monthlyPct = monthlyT > 0 ? Math.min(100, Math.round((monthSales / monthlyT) * 100)) : 0;

  return (
    <div className="space-y-4">
      <CommissionGridTables variant="field" currentSales={monthSales} />

      {/* Section C — My targets */}
      <div className="bg-[hsl(var(--field-card))] border border-[hsl(var(--field-border-subtle))] rounded-2xl p-4 md:p-5">
        <h3 className="text-sm md:text-base font-bold text-white mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-[hsl(var(--field-accent-glow))]" /> Mes objectifs
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-bg-elevated))]">
            <p className="text-[11px] text-[hsl(var(--field-text-muted))]">Objectif hebdomadaire</p>
            <p className="text-lg font-bold text-white mt-0.5">{weeklyT} ventes</p>
          </div>
          <div className="p-3 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-bg-elevated))]">
            <p className="text-[11px] text-[hsl(var(--field-text-muted))]">Objectif mensuel</p>
            <p className="text-lg font-bold text-white mt-0.5">
              {monthSales} / {monthlyT || "—"}{" "}
              <span className="text-xs text-[hsl(var(--field-text-muted))]">ventes</span>
            </p>
            {monthlyT > 0 && (
              <div className="mt-2 h-2 w-full rounded-full bg-[hsl(var(--field-bg))] overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--field-accent))] transition-all"
                  style={{ width: `${monthlyPct}%` }}
                />
              </div>
            )}
          </div>
        </div>
        {monthlyT === 0 && (
          <p className="text-[11px] text-[hsl(var(--field-text-dim))] mt-2 italic">
            Aucun objectif défini pour ce mois — votre superviseur peut les configurer dans le Core.
          </p>
        )}
      </div>
    </div>
  );
}
