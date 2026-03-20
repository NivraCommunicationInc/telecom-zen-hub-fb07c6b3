/**
 * FieldCommissions — Commission tracking + withdrawal requests.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { DollarSign, Loader2, Clock, Check, AlertTriangle, ArrowDownToLine, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-[#D97706]", bg: "bg-[#FEF3C7]", icon: Clock },
  approved: { label: "Approuvé", color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]", icon: Check },
  paid: { label: "Payé", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]", icon: Check },
  clawback: { label: "Récupéré", color: "text-[#DC2626]", bg: "bg-[#FEE2E2]", icon: AlertTriangle },
};

const WITHDRAWAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "En attente", color: "text-[#D97706]", bg: "bg-[#FEF3C7]" },
  approved: { label: "Approuvé", color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]" },
  paid: { label: "Payé", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
  rejected: { label: "Refusé", color: "text-[#DC2626]", bg: "bg-[#FEE2E2]" },
  cancelled: { label: "Annulé", color: "text-[#6B7280]", bg: "bg-[#F3F4F6]" },
};

export default function FieldCommissions() {
  const { user } = useStaffUser();
  const queryClient = useQueryClient();
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"commissions" | "withdrawals">("commissions");

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

  const totalPending = commissions.filter((c: any) => c.status === "pending").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalApproved = commissions.filter((c: any) => c.status === "approved").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalPaid = commissions.filter((c: any) => c.status === "paid").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const availableBalance = totalApproved; // Only approved commissions can be withdrawn

  const pendingWithdrawals = withdrawals.filter((w: any) => w.status === "pending").reduce((sum: number, w: any) => sum + Number(w.amount), 0);
  const effectiveAvailable = Math.max(0, availableBalance - pendingWithdrawals);

  const submitWithdrawal = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(withdrawAmount);
      if (!amount || amount <= 0 || amount > effectiveAvailable) {
        throw new Error("Montant invalide");
      }
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
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erreur");
    },
  });

  const isLoading = loadingCommissions || loadingWithdrawals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
              <p className="text-[11px] text-[#6B7280] font-medium">Payé</p>
              <p className="text-lg font-bold text-[#16A34A] mt-1">{totalPaid.toFixed(2)} $</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Retraits en cours</p>
              <p className="text-lg font-bold text-[#9333EA] mt-1">{pendingWithdrawals.toFixed(2)} $</p>
            </div>
          </div>

          {/* Withdrawal form modal */}
          {showWithdrawForm && (
            <div className="bg-white border-2 border-[#22C55E] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#000000]">Demande de retrait</h3>
                <button onClick={() => setShowWithdrawForm(false)} className="text-[#6B7280] hover:text-[#000000]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-[#374151] mb-1 block">
                  Montant (max {effectiveAvailable.toFixed(2)} $)
                </label>
                <input
                  type="number"
                  min="1"
                  max={effectiveAvailable}
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#374151] mb-1 block">Notes (optionnel)</label>
                <textarea
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]"
                  placeholder="Raison du retrait…"
                />
              </div>
              <button
                onClick={() => submitWithdrawal.mutate()}
                disabled={submitWithdrawal.isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > effectiveAvailable}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] disabled:opacity-40 transition-colors"
              >
                {submitWithdrawal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Soumettre la demande
              </button>
            </div>
          )}

          {/* Tab nav */}
          <div className="flex border-b border-[#E5E7EB]">
            <button
              onClick={() => setActiveTab("commissions")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "commissions"
                  ? "border-[#22C55E] text-[#16A34A]"
                  : "border-transparent text-[#6B7280] hover:text-[#000000]"
              )}
            >
              Commissions ({commissions.length})
            </button>
            <button
              onClick={() => setActiveTab("withdrawals")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "withdrawals"
                  ? "border-[#22C55E] text-[#16A34A]"
                  : "border-transparent text-[#6B7280] hover:text-[#000000]"
              )}
            >
              Retraits ({withdrawals.length})
            </button>
          </div>

          {/* Commissions list */}
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
                      <span className="text-[10px] text-[#9CA3AF]">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Withdrawals list */}
          {activeTab === "withdrawals" && (
            withdrawals.length === 0 ? (
              <div className="text-center py-12">
                <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
                <p className="text-sm text-[#9CA3AF]">Aucune demande de retrait</p>
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
        </>
      )}
    </div>
  );
}
