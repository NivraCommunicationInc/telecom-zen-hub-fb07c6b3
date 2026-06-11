/**
 * CoreProvisioningJobsPage — OSS Provisioning Job Queue
 *
 * Shows all provisioning_jobs: activate/deactivate/suspend/reactivate/terminate/modify
 * triggered by payment events, billing-lifecycle, or manually from this page.
 *
 * Features:
 * - Live job list with status filter + client search
 * - Stats bar: pending / running / failed / success (24h)
 * - Retry button for FAILED jobs (re-calls provisioning-engine)
 * - Cancel button for PENDING jobs
 * - Manual job creation dialog
 * - Auto-refresh every 30s
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminClient } from "@/integrations/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  RefreshCw, Plus, Clock, CheckCircle2, XCircle, Loader2,
  RotateCcw, Ban, Zap, Search, ChevronDown, ChevronRight,
  Activity, Server, Radio,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  running:   "bg-sky-500/15 text-sky-400 border-sky-500/30",
  success:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed:    "bg-red-500/15 text-red-400 border-red-500/30",
  retrying:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cancelled: "bg-[hsl(220,15%,20%)] text-[hsl(var(--core-text-label))] border-[hsl(220,15%,25%)]",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Clock className="w-3.5 h-3.5" />,
  running:   <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  success:   <CheckCircle2 className="w-3.5 h-3.5" />,
  failed:    <XCircle className="w-3.5 h-3.5" />,
  retrying:  <RotateCcw className="w-3.5 h-3.5" />,
  cancelled: <Ban className="w-3.5 h-3.5" />,
};

const STATUS_FR: Record<string, string> = {
  pending:   "En attente",
  running:   "En cours",
  success:   "Succès",
  failed:    "Échoué",
  retrying:  "En réessai",
  cancelled: "Annulé",
};

const ACTION_FR: Record<string, string> = {
  activate:   "Activation",
  deactivate: "Désactivation",
  terminate:  "Résiliation",
  modify:     "Modification plan",
  reset:      "Réinitialisation",
  suspend:    "Suspension",
  reactivate: "Réactivation",
};

const ACTION_COLOR: Record<string, string> = {
  activate:   "text-emerald-400",
  reactivate: "text-emerald-400",
  deactivate: "text-amber-400",
  suspend:    "text-amber-400",
  terminate:  "text-red-400",
  modify:     "text-sky-400",
  reset:      "text-purple-400",
};

const ADAPTER_FR: Record<string, string> = {
  manual:   "Manuel",
  radius:   "RADIUS",
  olt:      "OLT GPON",
  mikrotik: "MikroTik",
  ubiquiti: "Ubiquiti",
  tr069:    "TR-069",
};

const BLANK_FORM = {
  action: "activate",
  adapter: "manual",
  customer_email: "",
  subscription_id: "",
  plan_name: "",
  ip_address: "",
  mac_address: "",
  ont_serial: "",
  pppoe_username: "",
  notes: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoreProvisioningJobsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });

  // ── Data ──────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["provisioning-jobs", statusFilter],
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = adminClient
        .from("provisioning_jobs")
        .select(`
          *,
          billing_customers(first_name, last_name, email),
          billing_subscriptions(plan_name, plan_code)
        `)
        .order("created_at", { ascending: false })
        .limit(150);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // ── Stats (last 24h) ──────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ["provisioning-jobs-stats"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 86400 * 1000).toISOString();
      const statuses = ["pending", "running", "success", "failed", "retrying"];
      const results: Record<string, number> = {};
      await Promise.all(statuses.map(async (s) => {
        const { count } = await adminClient
          .from("provisioning_jobs")
          .select("*", { count: "exact", head: true })
          .eq("status", s)
          .gte("created_at", since);
        results[s] = count || 0;
      }));
      return results;
    },
  });

  // ── Filtered list ─────────────────────────────────────────────────
  const filtered = jobs.filter((j: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const cust = j.billing_customers;
    return (
      j.action?.includes(q) ||
      j.status?.includes(q) ||
      j.adapter?.includes(q) ||
      j.trigger?.includes(q) ||
      j.id?.includes(q) ||
      j.subscription_id?.includes(q) ||
      cust?.email?.toLowerCase().includes(q) ||
      cust?.first_name?.toLowerCase().includes(q) ||
      cust?.last_name?.toLowerCase().includes(q) ||
      j.billing_subscriptions?.plan_name?.toLowerCase().includes(q)
    );
  });

  // ── Mutations ─────────────────────────────────────────────────────
  const retryMutation = useMutation({
    mutationFn: async (job: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const res = await supabase.functions.invoke("provisioning-engine", {
        body: {
          action: job.action,
          subscription_id: job.subscription_id,
          customer_id: job.customer_id,
          trigger: `retry_by_admin`,
          adapter: job.adapter === "manual" ? undefined : job.adapter,
          parameters: { ...job.parameters, job_id: job.id },
          plan_name: job.parameters?.plan_name,
          ip_address: job.parameters?.ip_address,
          mac_address: job.parameters?.mac_address,
          ont_serial: job.parameters?.ont_serial,
          pppoe_username: job.parameters?.pppoe_username,
          vlan_id: job.parameters?.vlan_id,
        },
      });
      if (res.error) throw res.error;
      // Mark as retrying then let engine update
      await adminClient.from("provisioning_jobs").update({
        status: "retrying",
        attempt_count: (job.attempt_count || 0) + 1,
        error_message: null,
      }).eq("id", job.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provisioning-jobs"] });
      qc.invalidateQueries({ queryKey: ["provisioning-jobs-stats"] });
      toast.success("Job relancé — l'engine va le retraiter");
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors du retry"),
  });

  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await adminClient
        .from("provisioning_jobs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provisioning-jobs"] });
      qc.invalidateQueries({ queryKey: ["provisioning-jobs-stats"] });
      toast.success("Job annulé");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      let customerId: string | null = null;
      let subscriptionId = form.subscription_id || null;

      if (form.customer_email) {
        const { data: cust } = await adminClient
          .from("billing_customers")
          .select("id")
          .ilike("email", form.customer_email.trim())
          .maybeSingle();
        customerId = cust?.id || null;
      }

      // Insert pending job first
      const { data: job, error: jobErr } = await adminClient.from("provisioning_jobs").insert({
        subscription_id: subscriptionId,
        customer_id: customerId,
        action: form.action,
        adapter: form.adapter,
        trigger: "admin_manual",
        status: "pending",
        parameters: {
          plan_name: form.plan_name || null,
          ip_address: form.ip_address || null,
          mac_address: form.mac_address || null,
          ont_serial: form.ont_serial || null,
          pppoe_username: form.pppoe_username || null,
        },
        notes: form.notes || null,
        created_by: "admin",
      }).select("id").single();
      if (jobErr) throw jobErr;

      // If customer_id and subscription_id, execute immediately
      if (customerId && subscriptionId) {
        await supabase.functions.invoke("provisioning-engine", {
          body: {
            action: form.action,
            subscription_id: subscriptionId,
            customer_id: customerId,
            trigger: "admin_manual",
            adapter: form.adapter !== "manual" ? form.adapter : undefined,
            parameters: { job_id: job.id, plan_name: form.plan_name || undefined },
            plan_name: form.plan_name || undefined,
            ip_address: form.ip_address || undefined,
            mac_address: form.mac_address || undefined,
            ont_serial: form.ont_serial || undefined,
            pppoe_username: form.pppoe_username || undefined,
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provisioning-jobs"] });
      qc.invalidateQueries({ queryKey: ["provisioning-jobs-stats"] });
      setAddOpen(false);
      setForm({ ...BLANK_FORM });
      toast.success("Job créé et soumis à l'engine");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Render ────────────────────────────────────────────────────────
  const pendingCount  = stats?.pending  || 0;
  const runningCount  = stats?.running  || 0;
  const failedCount   = stats?.failed   || 0;
  const successCount  = stats?.success  || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">
            Provisioning OSS
          </h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">
            File de travaux réseau — RADIUS · OLT · MikroTik · Manuel
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />Nouveau job
          </Button>
        </div>
      </div>

      {/* Stats bar (24h) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "En attente", count: pendingCount, icon: <Clock className="w-4 h-4 text-amber-400" />, color: "text-amber-400", filter: "pending" },
          { label: "En cours",   count: runningCount, icon: <Activity className="w-4 h-4 text-sky-400" />, color: "text-sky-400", filter: "running" },
          { label: "Échoués",    count: failedCount,  icon: <XCircle className="w-4 h-4 text-red-400" />,  color: "text-red-400", filter: "failed" },
          { label: "Succès 24h", count: successCount, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400", filter: "success" },
        ].map(({ label, count, icon, color, filter }) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(statusFilter === filter ? "all" : filter)}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
              statusFilter === filter
                ? "border-[hsl(var(--core-accent))] bg-[hsl(var(--core-accent))]/10"
                : "border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] hover:bg-[hsl(220,15%,14%)]"
            }`}
          >
            {icon}
            <div>
              <p className={`text-lg font-bold leading-none ${color}`}>{count}</p>
              <p className="text-xs text-[hsl(var(--core-text-label))] mt-0.5">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--core-text-label))]" />
          <Input
            placeholder="Client, email, action, adaptateur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-sm bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_FR).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-[hsl(var(--core-text-label))]">
          {filtered.length} job{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--core-text-label))]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Zap className="w-8 h-8 text-[hsl(var(--core-text-label))]" />
            <p className="text-sm text-[hsl(var(--core-text-secondary))]">
              Aucun job{statusFilter !== "all" ? ` en statut « ${STATUS_FR[statusFilter]} »` : ""}
            </p>
          </div>
        ) : filtered.map((job: any) => {
          const cust = job.billing_customers;
          const sub  = job.billing_subscriptions;
          const isExpanded = expandedId === job.id;

          return (
            <div
              key={job.id}
              className={`rounded-lg border transition-colors ${
                job.status === "failed"   ? "border-red-500/30 bg-red-500/5" :
                job.status === "pending"  ? "border-amber-500/20 bg-[hsl(220,15%,11%)]" :
                job.status === "running"  ? "border-sky-500/30 bg-sky-500/5" :
                job.status === "success"  ? "border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]" :
                "border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]"
              }`}
            >
              <button
                className="w-full p-4 text-left"
                onClick={() => setExpandedId(isExpanded ? null : job.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    {/* Action + status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${ACTION_COLOR[job.action] || "text-[hsl(var(--core-text-primary))]"}`}>
                        {ACTION_FR[job.action] || job.action}
                      </span>
                      <Badge className={`text-xs border inline-flex items-center gap-1 ${STATUS_STYLE[job.status] || ""}`}>
                        {STATUS_ICON[job.status]}
                        {STATUS_FR[job.status] || job.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Server className="w-3 h-3 mr-1" />
                        {ADAPTER_FR[job.adapter] || job.adapter}
                      </Badge>
                    </div>
                    {/* Client + sub info */}
                    <div className="text-xs text-[hsl(var(--core-text-secondary))] space-x-3">
                      {cust && (
                        <span>{cust.first_name} {cust.last_name} · {cust.email}</span>
                      )}
                      {sub && (
                        <span className="text-[hsl(var(--core-text-label))]">
                          {sub.plan_name}
                        </span>
                      )}
                      {job.trigger && (
                        <span className="text-[hsl(var(--core-text-label))]">
                          via {job.trigger}
                        </span>
                      )}
                    </div>
                    {/* Error */}
                    {job.error_message && (
                      <p className="text-xs text-red-400 truncate max-w-sm">{job.error_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-[hsl(var(--core-text-label))]">
                        {format(new Date(job.created_at), "d MMM HH:mm", { locale: fr })}
                      </p>
                      {job.attempt_count > 0 && (
                        <p className="text-xs text-[hsl(var(--core-text-label))]">
                          {job.attempt_count}/{job.max_attempts} tentative{job.attempt_count > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-[hsl(var(--core-text-label))]" />
                      : <ChevronRight className="w-4 h-4 text-[hsl(var(--core-text-label))]" />
                    }
                  </div>
                </div>
              </button>

              {/* Expanded detail + actions */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[hsl(220,15%,16%)] pt-3 space-y-3">
                  {/* Parameters */}
                  {job.parameters && Object.keys(job.parameters).some(k => job.parameters[k]) && (
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--core-text-label))] mb-1 uppercase tracking-wide">
                        Paramètres réseau
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                        {[
                          ["Plan", job.parameters.plan_name],
                          ["IP", job.parameters.ip_address],
                          ["MAC", job.parameters.mac_address],
                          ["Série ONT", job.parameters.ont_serial],
                          ["PPPoE", job.parameters.pppoe_username],
                          ["VLAN", job.parameters.vlan_id],
                        ].filter(([, v]) => v).map(([k, v]) => (
                          <div key={k as string}>
                            <span className="text-xs text-[hsl(var(--core-text-label))]">{k}: </span>
                            <span className="text-xs text-[hsl(var(--core-text-primary))] font-mono">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Result */}
                  {job.result && (
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--core-text-label))] mb-1 uppercase tracking-wide">
                        Résultat engine
                      </p>
                      <p className="text-xs text-[hsl(var(--core-text-secondary))]">
                        {job.result.adapter_message || JSON.stringify(job.result)}
                      </p>
                    </div>
                  )}
                  {/* Notes */}
                  {job.notes && (
                    <p className="text-xs text-[hsl(var(--core-text-label))] italic">{job.notes}</p>
                  )}
                  {/* ID */}
                  <p className="text-xs text-[hsl(var(--core-text-label))] font-mono">{job.id}</p>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {(job.status === "failed" || job.status === "retrying") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => retryMutation.mutate(job)}
                        disabled={retryMutation.isPending}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Réessayer
                      </Button>
                    )}
                    {job.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-[hsl(var(--core-text-label))] hover:text-red-400"
                        onClick={() => cancelMutation.mutate(job.id)}
                        disabled={cancelMutation.isPending}
                      >
                        <Ban className="w-3 h-3 mr-1" />
                        Annuler
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create job dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[hsl(var(--core-accent))]" />
              Nouveau job de provisioning
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Action</Label>
                <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_FR).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Adaptateur</Label>
                <Select value={form.adapter} onValueChange={(v) => setForm({ ...form, adapter: v })}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ADAPTER_FR).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Email client</Label>
              <Input
                placeholder="client@exemple.com"
                value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">ID abonnement</Label>
              <Input
                placeholder="uuid de billing_subscriptions"
                value={form.subscription_id}
                onChange={(e) => setForm({ ...form, subscription_id: e.target.value })}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nom du forfait</Label>
                <Input placeholder="Internet 100M" value={form.plan_name} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Adresse IP</Label>
                <Input placeholder="192.168.1.x" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} className="h-8 text-sm font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Série ONT</Label>
                <Input placeholder="ALFC12345678" value={form.ont_serial} onChange={(e) => setForm({ ...form, ont_serial: e.target.value })} className="h-8 text-sm font-mono" />
              </div>
              <div>
                <Label className="text-xs">PPPoE username</Label>
                <Input placeholder="client@nivra.net" value={form.pppoe_username} onChange={(e) => setForm({ ...form, pppoe_username: e.target.value })} className="h-8 text-sm font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes internes</Label>
              <Textarea
                rows={2}
                placeholder="Contexte, numéro de ticket, etc."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="text-sm"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!form.action || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Soumission…</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" />Créer et soumettre</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
