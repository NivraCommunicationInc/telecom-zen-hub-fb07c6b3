/**
 * CoreCommissionWithdrawalsPage — Admin management of field commission withdrawal requests.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// adminClient bypasses RLS so admins can resolve agent profile names even when
// the regular RLS policy on `profiles` would otherwise hide them. Without this
// the page falls back to UUID slices like "01d69716" which is unreadable.
import { adminClient } from "@/integrations/backend/adminClient";
import { Loader2, Check, X, DollarSign, Clock, Ban, CreditCard, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "En attente", color: "text-[#D97706]", bg: "bg-[#FEF3C7]" },
  approved: { label: "Approuvé", color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]" },
  paid: { label: "Payé", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
  rejected: { label: "Refusé", color: "text-[#DC2626]", bg: "bg-[#FEE2E2]" },
  cancelled: { label: "Annulé", color: "text-[#6B7280]", bg: "bg-[#F3F4F6]" },
};

export default function CoreCommissionWithdrawalsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | "pay" | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-commission-withdrawals", filter],
    queryFn: async () => {
      let query = supabase
        .from("commission_withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch agent profiles for display — uses adminClient so RLS on `profiles`
  // doesn't hide them from staff viewers. Otherwise the UI was rendering UUID
  // slices like "01d69716" instead of names.
  const agentIds = [...new Set(requests.map((r: any) => r.agent_id))].filter(Boolean) as string[];
  const { data: agentProfiles = [] } = useQuery({
    queryKey: ["agent-profiles", agentIds.join(",")],
    queryFn: async () => {
      if (agentIds.length === 0) return [];
      const { data, error } = await adminClient
        .from("profiles")
        .select("user_id, full_name, first_name, last_name, email")
        .in("user_id", agentIds);
      if (error) {
        console.error("[Commissions] profile fetch failed:", error);
        return [];
      }
      return data || [];
    },
    enabled: agentIds.length > 0,
  });

  const getAgentName = (agentId: string | null | undefined): string => {
    if (!agentId) return "Agent inconnu";
    const p = agentProfiles.find((a: any) => a.user_id === agentId) as any;
    if (!p) return "Agent (profil manquant)";
    // Prefer full_name, then first + last, then email — never fall back to UUID.
    const fullName = (p.full_name || "").trim();
    if (fullName) return fullName;
    const composed = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    if (composed) return composed;
    if (p.email) return p.email;
    return "Agent (sans nom)";
  };

  const updateRequest = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const updates: any = {
        status,
        admin_notes: notes || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (status === "paid") {
        updates.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("commission_withdrawal_requests")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      await logInternalAudit({
        action: `commission_withdrawal_${status}`,
        category: "operations",
        portal: "core",
        targetType: "withdrawal_request",
        targetId: id,
        details: { status, admin_notes: notes },
      });
    },
    onSuccess: () => {
      toast.success("Demande mise à jour");
      setActionId(null);
      setActionType(null);
      setAdminNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-commission-withdrawals"] });
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const pendingCount = requests.filter((r: any) => r.status === "pending").length;
  const totalPending = requests.filter((r: any) => r.status === "pending").reduce((s: number, r: any) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#000000]">Retraits de commissions</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {pendingCount} demande{pendingCount !== 1 ? "s" : ""} en attente · {totalPending.toFixed(2)} $
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB]">
        {[
          { value: "all", label: "Tous" },
          { value: "pending", label: "En attente" },
          { value: "approved", label: "Approuvés" },
          { value: "paid", label: "Payés" },
          { value: "rejected", label: "Refusés" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
              filter === f.value
                ? "border-[#22C55E] text-[#16A34A]"
                : "border-transparent text-[#6B7280] hover:text-[#000000]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <DollarSign className="h-10 w-10 mx-auto mb-3 text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF]">Aucune demande de retrait</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => {
            const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const isActionTarget = actionId === req.id;

            return (
              <div key={req.id} className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-[#000000]">{Number(req.amount).toFixed(2)} $</span>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", st.color, st.bg)}>{st.label}</span>
                    </div>
                    <p className="text-sm text-[#374151] mt-1">
                      Agent : <span className="font-medium">{getAgentName(req.agent_id)}</span>
                    </p>
                    {req.notes && <p className="text-xs text-[#6B7280] mt-1">📝 {req.notes}</p>}
                    {req.admin_notes && (
                      <p className="text-xs text-[#DC2626] mt-1">
                        <MessageSquare className="h-3 w-3 inline mr-1" />
                        Admin: {req.admin_notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#9CA3AF]">
                      {format(new Date(req.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </p>
                    {req.paid_at && (
                      <p className="text-[10px] text-[#16A34A] mt-0.5">
                        Payé le {format(new Date(req.paid_at), "d MMM yyyy", { locale: fr })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                {req.status === "pending" && !isActionTarget && (
                  <div className="flex gap-2 pt-2 border-t border-[#F3F4F6]">
                    <button
                      onClick={() => { setActionId(req.id); setActionType("approve"); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DBEAFE] text-[#1D4ED8] text-xs font-medium hover:bg-[#BFDBFE] transition-colors"
                    >
                      <Check className="h-3 w-3" /> Approuver
                    </button>
                    <button
                      onClick={() => { setActionId(req.id); setActionType("pay"); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DCFCE7] text-[#16A34A] text-xs font-medium hover:bg-[#BBF7D0] transition-colors"
                    >
                      <CreditCard className="h-3 w-3" /> Marquer payé
                    </button>
                    <button
                      onClick={() => { setActionId(req.id); setActionType("reject"); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEE2E2] text-[#DC2626] text-xs font-medium hover:bg-[#FECACA] transition-colors"
                    >
                      <Ban className="h-3 w-3" /> Refuser
                    </button>
                  </div>
                )}

                {req.status === "approved" && !isActionTarget && (
                  <div className="flex gap-2 pt-2 border-t border-[#F3F4F6]">
                    <button
                      onClick={() => { setActionId(req.id); setActionType("pay"); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DCFCE7] text-[#16A34A] text-xs font-medium hover:bg-[#BBF7D0] transition-colors"
                    >
                      <CreditCard className="h-3 w-3" /> Marquer payé
                    </button>
                  </div>
                )}

                {/* Action confirmation */}
                {isActionTarget && actionType && (
                  <div className="pt-3 border-t border-[#E5E7EB] space-y-3">
                    <p className="text-xs font-medium text-[#374151]">
                      {actionType === "approve" ? "Approuver" : actionType === "pay" ? "Marquer comme payé" : "Refuser"} cette demande ?
                    </p>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30"
                      placeholder="Notes admin (optionnel)…"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateRequest.mutate({
                          id: req.id,
                          status: actionType === "approve" ? "approved" : actionType === "pay" ? "paid" : "rejected",
                          notes: adminNotes,
                        })}
                        disabled={updateRequest.isPending}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50",
                          actionType === "reject" ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "bg-[#22C55E] hover:bg-[#16A34A]"
                        )}
                      >
                        {updateRequest.isPending ? "…" : "Confirmer"}
                      </button>
                      <button
                        onClick={() => { setActionId(null); setActionType(null); setAdminNotes(""); }}
                        className="flex-1 py-2 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
