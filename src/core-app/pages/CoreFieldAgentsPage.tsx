/**
 * CoreFieldAgentsPage — Admin management console for field sales agents.
 * Lists agents, their commissions, performance, and actions (suspend, modify rates, approve withdrawals).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Users, DollarSign, TrendingUp, Loader2, Search, ChevronRight,
  ArrowLeft, Check, X, AlertTriangle, Clock, Banknote, BarChart3,
  UserCheck, UserX, Edit3, Eye, RefreshCw, Download,
} from "lucide-react";

type TabView = "agents" | "commissions" | "withdrawals" | "rules";

interface AgentRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  total_sales: number;
  total_commission: number;
  pending_commission: number;
  approved_commission: number;
  paid_commission: number;
}

export default function CoreFieldAgentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabView>("agents");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);

  // ═══ LOAD ALL FIELD AGENTS ═══
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["core-field-agents"],
    queryFn: async () => {
      // Get all users with field_sales role
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, is_active, created_at, permissions")
        .eq("role", "field_sales" as any);
      if (rolesErr) throw rolesErr;
      if (!roles?.length) return [];

      const userIds = roles.map((r: any) => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", userIds);

      // Get sales counts
      const { data: salesOrders } = await supabase
        .from("field_sales_orders")
        .select("salesperson_id, total_amount")
        .in("salesperson_id", userIds);

      // Get commissions from sales_commissions (canonical)
      const { data: commissions } = await supabase
        .from("sales_commissions")
        .select("salesperson_id, commission_amount, status")
        .in("salesperson_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const salesMap = new Map<string, number>();
      const commMap = new Map<string, { total: number; pending: number; approved: number; paid: number }>();

      for (const s of salesOrders || []) {
        salesMap.set(s.salesperson_id, (salesMap.get(s.salesperson_id) || 0) + 1);
      }

      for (const c of commissions || []) {
        const existing = commMap.get(c.salesperson_id) || { total: 0, pending: 0, approved: 0, paid: 0 };
        existing.total += Number(c.commission_amount);
        if (c.status === "pending" || c.status === "pending_activation") existing.pending += Number(c.commission_amount);
        if (c.status === "approved" || c.status === "validated") existing.approved += Number(c.commission_amount);
        if (c.status === "paid") existing.paid += Number(c.commission_amount);
        commMap.set(c.salesperson_id, existing);
      }

      return roles.map((r: any): AgentRow => {
        const profile = profileMap.get(r.user_id) as any;
        const comm = commMap.get(r.user_id) || { total: 0, pending: 0, approved: 0, paid: 0 };
        return {
          user_id: r.user_id,
          full_name: profile?.full_name || null,
          email: profile?.email || null,
          phone: profile?.phone || null,
          is_active: r.is_active !== false,
          created_at: r.created_at,
          total_sales: salesMap.get(r.user_id) || 0,
          total_commission: comm.total,
          pending_commission: comm.pending,
          approved_commission: comm.approved,
          paid_commission: comm.paid,
        };
      });
    },
  });

  // ═══ LOAD ALL COMMISSIONS (for admin view) ═══
  const { data: allCommissions = [], isLoading: loadingCommissions } = useQuery({
    queryKey: ["core-all-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_commissions")
        .select("*, field_sales_orders!sales_commissions_field_order_id_fkey(customer_name, customer_email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "commissions",
  });

  // ═══ LOAD WITHDRAWAL REQUESTS ═══
  const { data: withdrawals = [], isLoading: loadingWithdrawals } = useQuery({
    queryKey: ["core-field-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_sales_cashout_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "withdrawals",
  });

  // ═══ LOAD COMMISSION RULES ═══
  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["core-commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_sales_commission_rules")
        .select("*")
        .order("min_sales", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "rules",
  });

  // ═══ APPROVE COMMISSION ═══
  const approveCommission = useMutation({
    mutationFn: async (commissionId: string) => {
      const { error } = await supabase
        .from("sales_commissions")
        .update({ status: "validated", validated_at: new Date().toISOString() })
        .eq("id", commissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-all-commissions"] });
      queryClient.invalidateQueries({ queryKey: ["core-field-agents"] });
      toast.success("Commission approuvée");
    },
  });

  // ═══ REJECT COMMISSION ═══
  const rejectCommission = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("sales_commissions")
        .update({ status: "rejected", rejection_reason: reason })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-all-commissions"] });
      toast.success("Commission rejetée");
    },
  });

  // ═══ APPROVE WITHDRAWAL ═══
  const approveWithdrawal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("field_sales_cashout_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-field-withdrawals"] });
      toast.success("Retrait approuvé");
    },
  });

  // ═══ REJECT WITHDRAWAL ═══
  const rejectWithdrawal = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from("field_sales_cashout_requests")
        .update({ status: "rejected", admin_note: note, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-field-withdrawals"] });
      toast.success("Retrait refusé");
    },
  });

  // ═══ TOGGLE AGENT STATUS ═══
  const toggleAgentStatus = useMutation({
    mutationFn: async ({ userId, activate }: { userId: string; activate: boolean }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ is_active: activate })
        .eq("user_id", userId)
        .eq("role", "field_sales" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-field-agents"] });
      toast.success("Statut mis à jour");
    },
  });

  const filteredAgents = agents.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (a.full_name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q);
  });

  const totalSales = agents.reduce((s, a) => s + a.total_sales, 0);
  const totalCommission = agents.reduce((s, a) => s + a.total_commission, 0);
  const totalPending = agents.reduce((s, a) => s + a.pending_commission, 0);
  const activeAgents = agents.filter((a) => a.is_active).length;

  const TABS: { key: TabView; label: string; icon: typeof Users }[] = [
    { key: "agents", label: "Vendeurs", icon: Users },
    { key: "commissions", label: "Commissions", icon: DollarSign },
    { key: "withdrawals", label: "Retraits", icon: Banknote },
    { key: "rules", label: "Règles", icon: BarChart3 },
  ];

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    pending_activation: { label: "Att. activation", cls: "bg-orange-50 text-orange-700 border-orange-200" },
    validated: { label: "Validée", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    approved: { label: "Approuvée", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    paid: { label: "Payée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Rejetée", cls: "bg-red-50 text-red-700 border-red-200" },
    clawback: { label: "Récupérée", cls: "bg-red-50 text-red-700 border-red-200" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Vendeurs terrain</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestion des agents, commissions, retraits et règles</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground font-medium">Agents actifs</p>
          <p className="text-lg font-bold text-foreground mt-1">{activeAgents} / {agents.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground font-medium">Ventes totales</p>
          <p className="text-lg font-bold text-foreground mt-1">{totalSales}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground font-medium">Commissions totales</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{totalCommission.toFixed(2)} $</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground font-medium">En attente</p>
          <p className="text-lg font-bold text-amber-600 mt-1">{totalPending.toFixed(2)} $</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: AGENTS ═══ */}
      {activeTab === "agents" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou courriel…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {loadingAgents ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : filteredAgents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucun vendeur trouvé</p>
          ) : (
            <div className="space-y-2">
              {filteredAgents.map((agent) => (
                <div key={agent.user_id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      agent.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {(agent.full_name || "?")[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{agent.full_name || "Sans nom"}</p>
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                          agent.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {agent.is_active ? "Actif" : "Suspendu"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{agent.email || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">{agent.total_sales} ventes</p>
                      <p className="text-sm font-bold text-emerald-600">{agent.total_commission.toFixed(2)} $</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleAgentStatus.mutate({ userId: agent.user_id, activate: !agent.is_active })}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          agent.is_active ? "hover:bg-red-50 text-red-500" : "hover:bg-emerald-50 text-emerald-500"
                        )}
                        title={agent.is_active ? "Suspendre" : "Réactiver"}
                      >
                        {agent.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: COMMISSIONS ═══ */}
      {activeTab === "commissions" && (
        <div className="space-y-3">
          {loadingCommissions ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : allCommissions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucune commission</p>
          ) : (
            allCommissions.map((c: any) => {
              const badge = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
              const agentProfile = agents.find((a) => a.user_id === c.salesperson_id);
              return (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{Number(c.commission_amount).toFixed(2)} $</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", badge.cls)}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {agentProfile?.full_name || c.salesperson_id?.slice(0, 8)} — Vente: {Number(c.sale_amount).toFixed(2)} $ @ {(Number(c.commission_rate) * 100).toFixed(0)}%
                    </p>
                    {c.field_sales_orders?.customer_name && (
                      <p className="text-xs text-muted-foreground">Client: {c.field_sales_orders.customer_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(c.status === "pending" || c.status === "pending_activation") && (
                      <>
                        <button
                          onClick={() => approveCommission.mutate(c.id)}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                          title="Approuver"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt("Raison du rejet:");
                            if (reason) rejectCommission.mutate({ id: c.id, reason });
                          }}
                          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          title="Rejeter"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ TAB: WITHDRAWALS ═══ */}
      {activeTab === "withdrawals" && (
        <div className="space-y-3">
          {loadingWithdrawals ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : withdrawals.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucune demande de retrait</p>
          ) : (
            withdrawals.map((w: any) => {
              const badge = STATUS_BADGE[w.status] || STATUS_BADGE.pending;
              const agentProfile = agents.find((a) => a.user_id === w.salesperson_id);
              return (
                <div key={w.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{Number(w.amount).toFixed(2)} $</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", badge.cls)}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {agentProfile?.full_name || w.salesperson_id?.slice(0, 8)} — {w.method} → {w.destination}
                    </p>
                    {w.request_number && <p className="text-xs font-mono text-muted-foreground">{w.request_number}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {w.status === "pending" && (
                      <>
                        <button
                          onClick={() => approveWithdrawal.mutate(w.id)}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          title="Approuver"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            const note = prompt("Raison du refus:");
                            if (note) rejectWithdrawal.mutate({ id: w.id, note });
                          }}
                          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          title="Refuser"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(w.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ TAB: RULES ═══ */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Les commissions sont calculées automatiquement lors de la synchronisation et débloquées à l'activation du service.
          </p>
          {loadingRules ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : rules.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucune règle configurée</p>
          ) : (
            <div className="space-y-2">
              {rules.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.rule_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Type: {r.rule_type} — 
                      {r.bonus_percentage ? ` ${r.bonus_percentage}%` : ""}
                      {r.bonus_amount ? ` ${r.bonus_amount} $ fixe` : ""}
                      {r.min_sales != null ? ` — Min: ${r.min_sales} ventes` : ""}
                      {r.max_sales != null ? ` — Max: ${r.max_sales} ventes` : ""}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                    r.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"
                  )}>
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
