/**
 * CoreFieldAgentsPage — Full admin management console for field sales agents.
 * Tabs: Vendeurs (profile/edit), Commissions (approve/reject/dispute), Retraits (approve/reject/mark paid),
 *       Paie (pay tracking/PDF), Contestations, Règles
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Users, DollarSign, TrendingUp, Loader2, Search, Check, X, AlertTriangle,
  Clock, Banknote, BarChart3, UserCheck, UserX, Edit3, Eye, FileText,
  ChevronRight, ArrowLeft, Phone, Mail, Calendar, Shield, Save,
  MessageSquare, Download, CreditCard, Receipt,
} from "lucide-react";

type TabView = "agents" | "commissions" | "withdrawals" | "pay" | "disputes" | "rules";

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

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
  pending_activation: { label: "Att. activation", cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800" },
  validated: { label: "Validée", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  approved: { label: "Approuvé", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  paid: { label: "Payé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
  rejected: { label: "Rejeté", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
  clawback: { label: "Récupéré", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
  disputed: { label: "Contesté", cls: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800" },
  processing: { label: "En traitement", cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800" },
  cancelled: { label: "Annulé", cls: "bg-muted text-muted-foreground border-border" },
};

export default function CoreFieldAgentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabView>("agents");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "" });

  // ═══ LOAD ALL FIELD AGENTS ═══
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["core-field-agents"],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, is_active, created_at, permissions")
        .eq("role", "field_sales" as any);
      if (rolesErr) throw rolesErr;
      if (!roles?.length) return [];

      const userIds = roles.map((r: any) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", userIds);
      const { data: salesOrders } = await supabase.from("field_sales_orders").select("salesperson_id, total_amount").in("salesperson_id", userIds);
      const { data: commissions } = await supabase.from("sales_commissions").select("salesperson_id, commission_amount, status").in("salesperson_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const salesMap = new Map<string, number>();
      const commMap = new Map<string, { total: number; pending: number; approved: number; paid: number }>();

      for (const s of salesOrders || []) salesMap.set(s.salesperson_id, (salesMap.get(s.salesperson_id) || 0) + 1);
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
          user_id: r.user_id, full_name: profile?.full_name || null, email: profile?.email || null,
          phone: profile?.phone || null, is_active: r.is_active !== false, created_at: r.created_at,
          total_sales: salesMap.get(r.user_id) || 0, total_commission: comm.total,
          pending_commission: comm.pending, approved_commission: comm.approved, paid_commission: comm.paid,
        };
      });
    },
  });

  // ═══ ALL COMMISSIONS ═══
  const { data: allCommissions = [], isLoading: loadingCommissions } = useQuery({
    queryKey: ["core-all-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_commissions")
        .select("*, field_sales_orders!sales_commissions_field_order_id_fkey(customer_name, customer_email)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "commissions",
  });

  // ═══ WITHDRAWALS ═══
  const { data: withdrawals = [], isLoading: loadingWithdrawals } = useQuery({
    queryKey: ["core-field-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("field_sales_cashout_requests").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "withdrawals" || activeTab === "pay",
  });

  // ═══ DISPUTED COMMISSIONS ═══
  const { data: disputes = [], isLoading: loadingDisputes } = useQuery({
    queryKey: ["core-field-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_commissions")
        .select("*, field_sales_orders!sales_commissions_field_order_id_fkey(customer_name)")
        .in("status", ["disputed"] as any)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "disputes",
  });

  // ═══ COMMISSION RULES ═══
  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["core-commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("field_sales_commission_rules").select("*").order("min_sales", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "rules",
  });

  // ═══ MUTATIONS ═══
  const approveCommission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_commissions").update({ status: "validated", validated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-all-commissions"] }); queryClient.invalidateQueries({ queryKey: ["core-field-agents"] }); toast.success("Commission approuvée"); },
  });

  const rejectCommission = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("sales_commissions").update({ status: "rejected", rejection_reason: reason }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-all-commissions"] }); toast.success("Commission rejetée"); },
  });

  const resolveDispute = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: "validated" | "rejected"; note: string }) => {
      const { error } = await supabase.from("sales_commissions").update({
        status: action,
        ...(action === "validated" ? { validated_at: new Date().toISOString() } : { rejection_reason: note }),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-field-disputes"] }); queryClient.invalidateQueries({ queryKey: ["core-all-commissions"] }); toast.success("Contestation traitée"); },
  });

  const updateWithdrawalStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const update: any = { status, reviewed_at: new Date().toISOString() };
      if (note) update.admin_note = note;
      if (status === "paid") update.paid_at = new Date().toISOString();
      const { error } = await supabase.from("field_sales_cashout_requests").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-field-withdrawals"] }); toast.success("Statut mis à jour"); },
  });

  const markCommissionPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_commissions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-all-commissions"] }); queryClient.invalidateQueries({ queryKey: ["core-field-agents"] }); toast.success("Commission marquée payée"); },
  });

  const toggleAgentStatus = useMutation({
    mutationFn: async ({ userId, activate }: { userId: string; activate: boolean }) => {
      const { error } = await supabase.from("user_roles").update({ is_active: activate }).eq("user_id", userId).eq("role", "field_sales" as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-field-agents"] }); toast.success("Statut mis à jour"); },
  });

  const saveAgentProfile = useMutation({
    mutationFn: async () => {
      if (!editingAgent) return;
      // Use edge function for real persistence (adminClient + auth sync)
      const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
        body: {
          action: "update_profile",
          user_id: editingAgent.user_id,
          full_name: editForm.full_name.trim() || undefined,
          email: editForm.email.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
        },
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok && !result?.success) {
        throw new Error(result?.error?.message || result?.message || "Échec de la mise à jour");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-field-agents"] });
      setEditingAgent(null);
      toast.success("Profil mis à jour avec succès");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur de sauvegarde"),
  });

  const filteredAgents = agents.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (a.full_name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q);
  });

  const totalSales = agents.reduce((s, a) => s + a.total_sales, 0);
  const totalCommission = agents.reduce((s, a) => s + a.total_commission, 0);
  const totalPending = agents.reduce((s, a) => s + a.pending_commission, 0);
  const totalPaid = agents.reduce((s, a) => s + a.paid_commission, 0);
  const activeAgents = agents.filter((a) => a.is_active).length;
  const pendingWithdrawals = withdrawals.filter((w: any) => w.status === "pending").length;
  const pendingDisputes = disputes.length;

  const TABS: { key: TabView; label: string; icon: typeof Users; badge?: number }[] = [
    { key: "agents", label: "Vendeurs", icon: Users },
    { key: "commissions", label: "Commissions", icon: DollarSign },
    { key: "withdrawals", label: "Retraits", icon: Banknote, badge: pendingWithdrawals },
    { key: "pay", label: "Paie", icon: CreditCard },
    { key: "disputes", label: "Contestations", icon: MessageSquare, badge: pendingDisputes },
    { key: "rules", label: "Règles", icon: BarChart3 },
  ];

  // ═══ AGENT DETAIL VIEW ═══
  if (selectedAgent) {
    const agent = selectedAgent;
    const agentCommissions = allCommissions.filter((c: any) => c.salesperson_id === agent.user_id);
    const agentWithdrawals = withdrawals.filter((w: any) => w.salesperson_id === agent.user_id);
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedAgent(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour aux vendeurs
        </button>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold", agent.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300")}>
                {(agent.full_name || "?")[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{agent.full_name || "Sans nom"}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{agent.email || "—"}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{agent.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", agent.is_active ? STATUS_BADGE.approved.cls : STATUS_BADGE.rejected.cls)}>
                    {agent.is_active ? "Actif" : "Suspendu"}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Depuis {format(new Date(agent.created_at), "dd MMM yyyy", { locale: fr })}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingAgent(agent); setEditForm({ full_name: agent.full_name || "", email: agent.email || "", phone: agent.phone || "" }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors">
                <Edit3 className="h-3 w-3" /> Modifier
              </button>
              <button onClick={() => toggleAgentStatus.mutate({ userId: agent.user_id, activate: !agent.is_active })}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors", agent.is_active ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-400" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400")}>
                {agent.is_active ? <><UserX className="h-3 w-3" /> Suspendre</> : <><UserCheck className="h-3 w-3" /> Réactiver</>}
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-border">
            {[
              { label: "Ventes", value: agent.total_sales, color: "text-foreground" },
              { label: "Commission totale", value: `${agent.total_commission.toFixed(2)} $`, color: "text-foreground" },
              { label: "En attente", value: `${agent.pending_commission.toFixed(2)} $`, color: "text-amber-600" },
              { label: "Approuvé", value: `${agent.approved_commission.toFixed(2)} $`, color: "text-blue-600" },
              { label: "Payé", value: `${agent.paid_commission.toFixed(2)} $`, color: "text-emerald-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="text-center">
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                <p className={cn("text-sm font-bold mt-0.5", kpi.color)}>{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Agent's commissions */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">Historique des commissions</h3>
          {agentCommissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune commission</p>
          ) : (
            <div className="space-y-2">
              {agentCommissions.slice(0, 50).map((c: any) => {
                const badge = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{Number(c.commission_amount).toFixed(2)} $</span>
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", badge.cls)}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{Number(c.sale_amount).toFixed(2)} $ @ {(Number(c.commission_rate) * 100).toFixed(0)}%</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === "validated" && (
                        <button onClick={() => markCommissionPaid.mutate(c.id)} className="text-[10px] font-medium px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400">
                          Marquer payé
                        </button>
                      )}
                      <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yy")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ EDIT AGENT DIALOG ═══
  if (editingAgent) {
    return (
      <div className="space-y-6">
        <button onClick={() => setEditingAgent(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Annuler
        </button>
        <div className="bg-card border border-border rounded-xl p-6 space-y-5 max-w-lg">
          <h2 className="text-lg font-bold text-foreground">Modifier le profil vendeur</h2>
          {[
            { label: "Nom complet", key: "full_name", icon: Users },
            { label: "Courriel", key: "email", icon: Mail },
            { label: "Téléphone", key: "phone", icon: Phone },
          ].map((field) => (
            <div key={field.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
              <div className="relative">
                <field.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={(editForm as any)[field.key]}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          ))}
          <button onClick={() => saveAgentProfile.mutate()} disabled={saveAgentProfile.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors">
            {saveAgentProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sauvegarder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Vendeurs terrain</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestion complète des agents, commissions, paie et retraits</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Agents actifs", value: `${activeAgents} / ${agents.length}`, color: "text-foreground" },
          { label: "Ventes totales", value: totalSales, color: "text-foreground" },
          { label: "Commissions totales", value: `${totalCommission.toFixed(2)} $`, color: "text-emerald-600" },
          { label: "En attente", value: `${totalPending.toFixed(2)} $`, color: "text-amber-600" },
          { label: "Payé", value: `${totalPaid.toFixed(2)} $`, color: "text-blue-600" },
          { label: "Contestations", value: pendingDisputes, color: pendingDisputes > 0 ? "text-red-600" : "text-muted-foreground" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground font-medium">{kpi.label}</p>
            <p className={cn("text-lg font-bold mt-1", kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-red-500 text-white rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ AGENTS TAB ═══ */}
      {activeTab === "agents" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher par nom ou courriel…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {loadingAgents ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : filteredAgents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucun vendeur trouvé</p>
          ) : (
            <div className="space-y-2">
              {filteredAgents.map((agent) => (
                <div key={agent.user_id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => { setSelectedAgent(agent); setActiveTab("commissions"); }}>
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      agent.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300")}>
                      {(agent.full_name || "?")[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{agent.full_name || "Sans nom"}</p>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", agent.is_active ? STATUS_BADGE.approved.cls : STATUS_BADGE.rejected.cls)}>
                          {agent.is_active ? "Actif" : "Suspendu"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{agent.email || "—"} · {agent.phone || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">{agent.total_sales} ventes</p>
                      <p className="text-sm font-bold text-emerald-600">{agent.total_commission.toFixed(2)} $</p>
                      <p className="text-[10px] text-blue-600">Payé: {agent.paid_commission.toFixed(2)} $</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedAgent(agent)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Voir profil">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setEditingAgent(agent); setEditForm({ full_name: agent.full_name || "", email: agent.email || "", phone: agent.phone || "" }); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Modifier">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleAgentStatus.mutate({ userId: agent.user_id, activate: !agent.is_active })}
                        className={cn("p-1.5 rounded-lg transition-colors", agent.is_active ? "hover:bg-red-50 text-red-500 dark:hover:bg-red-950" : "hover:bg-emerald-50 text-emerald-500 dark:hover:bg-emerald-950")}
                        title={agent.is_active ? "Suspendre" : "Réactiver"}>
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

      {/* ═══ COMMISSIONS TAB ═══ */}
      {activeTab === "commissions" && (
        <div className="space-y-3">
          {loadingCommissions ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : allCommissions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucune commission</p>
          ) : allCommissions.map((c: any) => {
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
                    {agentProfile?.full_name || c.salesperson_id?.slice(0, 8)} — {Number(c.sale_amount).toFixed(2)} $ @ {(Number(c.commission_rate) * 100).toFixed(0)}%
                  </p>
                  {c.field_sales_orders?.customer_name && <p className="text-xs text-muted-foreground">Client: {c.field_sales_orders.customer_name}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(c.status === "pending" || c.status === "pending_activation") && (
                    <>
                      <button onClick={() => approveCommission.mutate(c.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400" title="Approuver"><Check className="h-4 w-4" /></button>
                      <button onClick={() => { const r = prompt("Raison du rejet:"); if (r) rejectCommission.mutate({ id: c.id, reason: r }); }} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400" title="Rejeter"><X className="h-4 w-4" /></button>
                    </>
                  )}
                  {c.status === "validated" && (
                    <button onClick={() => markCommissionPaid.mutate(c.id)} className="text-[10px] font-medium px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400">
                      Marquer payé
                    </button>
                  )}
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ WITHDRAWALS TAB ═══ */}
      {activeTab === "withdrawals" && (
        <div className="space-y-3">
          {loadingWithdrawals ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : withdrawals.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucune demande de retrait</p>
          ) : withdrawals.map((w: any) => {
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
                    {agentProfile?.full_name || w.salesperson_id?.slice(0, 8)} — {w.method || "Virement"} → {w.destination || "—"}
                  </p>
                  {w.request_number && <p className="text-xs font-mono text-muted-foreground">{w.request_number}</p>}
                  {w.admin_note && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Admin: {w.admin_note}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {w.status === "pending" && (
                    <>
                      <button onClick={() => updateWithdrawalStatus.mutate({ id: w.id, status: "approved" })} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400" title="Approuver"><Check className="h-4 w-4" /></button>
                      <button onClick={() => { const n = prompt("Raison du refus:"); if (n) updateWithdrawalStatus.mutate({ id: w.id, status: "rejected", note: n }); }} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400" title="Refuser"><X className="h-4 w-4" /></button>
                    </>
                  )}
                  {w.status === "approved" && (
                    <button onClick={() => updateWithdrawalStatus.mutate({ id: w.id, status: "paid" })} className="text-[10px] font-medium px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400">
                      Marquer payé
                    </button>
                  )}
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(w.created_at), { addSuffix: true, locale: fr })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ PAY TAB ═══ */}
      {activeTab === "pay" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Receipt className="h-4 w-4" /> Suivi de paie des vendeurs</h3>
            <p className="text-xs text-muted-foreground mb-4">Résumé des commissions validées, payées et en attente par agent.</p>
            {agents.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucun agent</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Agent</th>
                      <th className="pb-2 font-medium text-right">Ventes</th>
                      <th className="pb-2 font-medium text-right">Commission totale</th>
                      <th className="pb-2 font-medium text-right">En attente</th>
                      <th className="pb-2 font-medium text-right">Approuvé</th>
                      <th className="pb-2 font-medium text-right">Payé</th>
                      <th className="pb-2 font-medium text-right">Solde dû</th>
                      <th className="pb-2 font-medium text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => {
                      const solde = agent.approved_commission; // What's owed
                      return (
                        <tr key={agent.user_id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3">
                            <p className="font-medium text-foreground">{agent.full_name || "Sans nom"}</p>
                            <p className="text-[10px] text-muted-foreground">{agent.email}</p>
                          </td>
                          <td className="py-3 text-right text-foreground">{agent.total_sales}</td>
                          <td className="py-3 text-right text-foreground">{agent.total_commission.toFixed(2)} $</td>
                          <td className="py-3 text-right text-amber-600">{agent.pending_commission.toFixed(2)} $</td>
                          <td className="py-3 text-right text-blue-600">{agent.approved_commission.toFixed(2)} $</td>
                          <td className="py-3 text-right text-emerald-600">{agent.paid_commission.toFixed(2)} $</td>
                          <td className="py-3 text-right font-bold text-foreground">{solde.toFixed(2)} $</td>
                          <td className="py-3 text-center">
                            <button onClick={() => setSelectedAgent(agent)} className="text-[10px] font-medium px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                              Détails
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-foreground border-t-2 border-border">
                      <td className="pt-3">Total</td>
                      <td className="pt-3 text-right">{totalSales}</td>
                      <td className="pt-3 text-right">{totalCommission.toFixed(2)} $</td>
                      <td className="pt-3 text-right text-amber-600">{totalPending.toFixed(2)} $</td>
                      <td className="pt-3 text-right text-blue-600">{agents.reduce((s, a) => s + a.approved_commission, 0).toFixed(2)} $</td>
                      <td className="pt-3 text-right text-emerald-600">{totalPaid.toFixed(2)} $</td>
                      <td className="pt-3 text-right">{agents.reduce((s, a) => s + a.approved_commission, 0).toFixed(2)} $</td>
                      <td className="pt-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Paid withdrawals history */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Banknote className="h-4 w-4" /> Historique des paiements effectués</h3>
            {(() => {
              const paidW = withdrawals.filter((w: any) => w.status === "paid");
              return paidW.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun paiement effectué</p>
              ) : (
                <div className="space-y-2">
                  {paidW.map((w: any) => {
                    const agentProfile = agents.find((a) => a.user_id === w.salesperson_id);
                    return (
                      <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div>
                          <span className="text-sm font-semibold text-foreground">{Number(w.amount).toFixed(2)} $</span>
                          <span className="text-xs text-muted-foreground ml-2">{agentProfile?.full_name || "—"}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{w.paid_at ? format(new Date(w.paid_at), "dd/MM/yyyy") : w.reviewed_at ? format(new Date(w.reviewed_at), "dd/MM/yyyy") : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══ DISPUTES TAB ═══ */}
      {activeTab === "disputes" && (
        <div className="space-y-3">
          {loadingDisputes ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : disputes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Aucune contestation en cours</p>
          ) : disputes.map((d: any) => {
            const agentProfile = agents.find((a) => a.user_id === d.salesperson_id);
            return (
              <div key={d.id} className="p-4 rounded-xl border border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-semibold text-foreground">{Number(d.commission_amount).toFixed(2)} $ — Commission contestée</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Agent: {agentProfile?.full_name || d.salesperson_id?.slice(0, 8)}</p>
                    {d.rejection_reason && <p className="text-xs text-foreground mt-1 bg-muted rounded p-2">« {d.rejection_reason} »</p>}
                    {d.field_sales_orders?.customer_name && <p className="text-xs text-muted-foreground">Client: {d.field_sales_orders.customer_name}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(d.created_at), { addSuffix: true, locale: fr })}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => resolveDispute.mutate({ id: d.id, action: "validated", note: "" })}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 transition-colors">
                    <Check className="h-3 w-3" /> Accepter (valider commission)
                  </button>
                  <button onClick={() => { const n = prompt("Note de rejet:"); if (n) resolveDispute.mutate({ id: d.id, action: "rejected", note: n }); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400 transition-colors">
                    <X className="h-3 w-3" /> Maintenir rejet
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ RULES TAB ═══ */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Les commissions sont calculées automatiquement et débloquées à l'activation du service.</p>
          {loadingRules ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : rules.length === 0 ? (
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
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", r.is_active ? STATUS_BADGE.approved.cls : "bg-muted text-muted-foreground border-border")}>
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
