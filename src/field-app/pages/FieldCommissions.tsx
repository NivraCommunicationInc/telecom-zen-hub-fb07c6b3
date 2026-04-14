/**
 * FieldCommissions — Uses fetchCommissionSummary, fetchCommissionList, fetchWithdrawals, createCommissionDispute, requestWithdrawal from service layer.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCommissionSummary, fetchCommissionList, fetchWithdrawals, createCommissionDispute, requestWithdrawal } from "@/field-app/lib/fieldServices";
import { DollarSign, Loader2, Clock, Check, AlertTriangle, ArrowDownToLine, X, Send, Target, MessageSquare, TrendingUp, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-amber-600", bg: "bg-amber-100", icon: Clock },
  pending_activation: { label: "Activation requise", color: "text-purple-600", bg: "bg-purple-100", icon: Clock },
  validated: { label: "Validé", color: "text-blue-600", bg: "bg-blue-100", icon: Check },
  approved: { label: "Approuvé", color: "text-blue-600", bg: "bg-blue-100", icon: Check },
  paid: { label: "Payé", color: "text-emerald-600", bg: "bg-emerald-100", icon: Check },
  clawback: { label: "Récupéré", color: "text-red-600", bg: "bg-red-100", icon: AlertTriangle },
  rejected: { label: "Rejeté", color: "text-red-600", bg: "bg-red-100", icon: X },
  disputed: { label: "Contesté", color: "text-yellow-600", bg: "bg-yellow-100", icon: MessageSquare },
};

type TabView = "commissions" | "withdrawals" | "disputes";

export default function FieldCommissions() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabView>("commissions");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("etransfer");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [disputeCommissionId, setDisputeCommissionId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [commissionFilter, setCommissionFilter] = useState("all");

  const { data: summaryData, isLoading: loadingSummary } = useQuery({ queryKey: ["field-commission-summary"], queryFn: fetchCommissionSummary });
  const { data: commissionsData, isLoading: loadingCommissions } = useQuery({ queryKey: ["field-commission-list", commissionFilter], queryFn: () => fetchCommissionList(commissionFilter !== "all" ? commissionFilter : undefined) });
  const { data: withdrawalsData, isLoading: loadingWithdrawals } = useQuery({ queryKey: ["field-withdrawals"], queryFn: fetchWithdrawals });

  const summary = summaryData?.summary || { pending: 0, approved: 0, paid: 0, total: 0, effectiveAvailable: 0, pendingWithdrawals: 0, disputedCount: 0 };
  const commissions = commissionsData?.commissions || [];
  const withdrawals = withdrawalsData?.withdrawals || [];

  const submitWithdrawal = useMutation({
    mutationFn: () => requestWithdrawal(parseFloat(withdrawAmount), withdrawMethod, withdrawDestination, withdrawNotes),
    onSuccess: () => { toast.success("Demande de retrait soumise !"); setShowWithdrawForm(false); setWithdrawAmount(""); setWithdrawDestination(""); setWithdrawNotes(""); queryClient.invalidateQueries({ queryKey: ["field-withdrawals"] }); queryClient.invalidateQueries({ queryKey: ["field-commission-summary"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const submitDispute = useMutation({
    mutationFn: () => createCommissionDispute(disputeCommissionId!, disputeReason),
    onSuccess: () => { toast.success("Contestation soumise"); setDisputeCommissionId(null); setDisputeReason(""); queryClient.invalidateQueries({ queryKey: ["field-commission-list"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const isLoading = loadingSummary || loadingCommissions || loadingWithdrawals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold text-foreground">Commissions & Paie</h1><p className="text-xs text-muted-foreground mt-0.5">Suivi complet de vos gains, retraits et objectifs</p></div>
        {summary.effectiveAvailable > 0 && <button onClick={() => setShowWithdrawForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"><ArrowDownToLine className="h-4 w-4" /> Demander un retrait</button>}
      </div>
      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[{ label: "Total gagné", value: `${summary.total.toFixed(2)} $`, color: "text-foreground" }, { label: "En attente", value: `${summary.pending.toFixed(2)} $`, color: "text-amber-600" }, { label: "Disponible", value: `${summary.effectiveAvailable.toFixed(2)} $`, color: "text-blue-600" }, { label: "Total payé", value: `${summary.paid.toFixed(2)} $`, color: "text-emerald-600" }, { label: "Retraits en cours", value: `${summary.pendingWithdrawals.toFixed(2)} $`, color: "text-purple-600" }].map((kpi) => (
              <div key={kpi.label} className="bg-card border border-border rounded-xl p-4"><p className="text-[11px] text-muted-foreground font-medium">{kpi.label}</p><p className={cn("text-lg font-bold mt-1", kpi.color)}>{kpi.value}</p></div>
            ))}
          </div>

          {showWithdrawForm && (
            <div className="bg-card border-2 border-emerald-500 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-foreground">Demande de retrait</h3><button onClick={() => setShowWithdrawForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Montant (max {summary.effectiveAvailable.toFixed(2)} $)</label><input type="number" min="1" max={summary.effectiveAvailable} step="0.01" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm" placeholder="0.00" /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Méthode</label><select value={withdrawMethod} onChange={(e) => setWithdrawMethod(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm"><option value="etransfer">Virement Interac</option><option value="bank_transfer">Virement bancaire</option><option value="cheque">Chèque</option></select></div>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Destination *</label><input value={withdrawDestination} onChange={(e) => setWithdrawDestination(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm" placeholder="ex: moncourriel@email.com" /></div>
              <button onClick={() => submitWithdrawal.mutate()} disabled={submitWithdrawal.isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || !withdrawDestination.trim()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors">{submitWithdrawal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Soumettre</button>
            </div>
          )}

          <div className="flex border-b border-border overflow-x-auto">
            {([{ key: "commissions", label: "Commissions", icon: DollarSign }, { key: "withdrawals", label: "Retraits", icon: ArrowDownToLine }, { key: "disputes", label: "Contestations", icon: MessageSquare }] as const).map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap", activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}><tab.icon className="h-3.5 w-3.5" />{tab.label}</button>
            ))}
          </div>

          {activeTab === "commissions" && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {[{ key: "all", label: "Toutes" }, { key: "pending_activation", label: "Att. activation" }, { key: "validated", label: "Validées" }, { key: "paid", label: "Payées" }, { key: "rejected", label: "Rejetées" }].map((f) => (
                  <button key={f.key} onClick={() => setCommissionFilter(f.key)} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", commissionFilter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{f.label}</button>
                ))}
              </div>
              {commissions.length === 0 ? <div className="text-center py-12"><DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Aucune commission</p></div> : (
                <div className="space-y-2">
                  {commissions.map((c: any) => {
                    const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                    const Icon = sc.icon;
                    const amt = Number(c.commission_amount || c.amount || 0);
                    const canDispute = ["clawback", "rejected"].includes(c.status);
                    return (
                      <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", sc.bg)}><Icon className={cn("h-4 w-4", sc.color)} /></div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{amt.toFixed(2)} $</p>
                            <p className="text-[10px] text-muted-foreground">{c.field_sales_orders?.customer_name || "—"}</p>
                            {c.status_explanation && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{c.status_explanation}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", sc.bg, sc.color)}>{sc.label}</span>
                          {canDispute && <button onClick={() => setDisputeCommissionId(c.id)} className="text-[10px] text-amber-600 hover:underline">Contester</button>}
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
              {withdrawals.length === 0 ? <div className="text-center py-12"><ArrowDownToLine className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Aucun retrait</p></div> : withdrawals.map((w: any) => (
                <div key={w.id} className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
                  <div><p className="text-sm font-semibold text-foreground">{Number(w.amount).toFixed(2)} $</p><p className="text-[10px] text-muted-foreground">{w.notes}</p></div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">{w.status}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "disputes" && (
            <div className="space-y-2">
              {commissions.filter((c: any) => ["disputed", "clawback", "rejected"].includes(c.status)).length === 0 ? <div className="text-center py-12"><MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Aucune contestation</p></div> : commissions.filter((c: any) => ["disputed", "clawback", "rejected"].includes(c.status)).map((c: any) => (
                <div key={c.id} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground">{Number(c.commission_amount || 0).toFixed(2)} $</p><span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", STATUS_CONFIG[c.status]?.bg, STATUS_CONFIG[c.status]?.color)}>{STATUS_CONFIG[c.status]?.label}</span></div>
                  {c.rejection_reason && <p className="text-xs text-muted-foreground mt-1">{c.rejection_reason}</p>}
                  {c.next_action && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{c.next_action}</p>}
                </div>
              ))}
            </div>
          )}

          {disputeCommissionId && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card rounded-xl p-5 max-w-md w-full space-y-4">
                <h3 className="text-sm font-bold text-foreground">Contester cette commission</h3>
                <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={3} placeholder="Raison de la contestation..." className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => { setDisputeCommissionId(null); setDisputeReason(""); }} className="flex-1 py-2 rounded-lg border border-border text-sm">Annuler</button>
                  <button onClick={() => submitDispute.mutate()} disabled={!disputeReason.trim() || submitDispute.isPending} className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-40">{submitDispute.isPending ? "..." : "Soumettre"}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
