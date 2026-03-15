/**
 * CoreInstallationsPage — Canonical installation job management for Nivra Core.
 * /core/installations
 * 
 * Day 3: Real operational installation tracking with technician assignment,
 * status workflow, audit logging, and end-to-end job lifecycle.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  Wrench, Plus, Search, Loader2, Calendar, MapPin, User, Phone,
  Clock, CheckCircle, XCircle, Play, AlertTriangle, Truck, ArrowRight,
  FileText, History, Eye, UserCheck, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusVariant } from "@/core-app/components/ui/StatusBadge";
import { corePath } from "@/core-app/lib/corePaths";

// ── Canonical Statuses ──
const JOB_STATUSES = [
  { value: "pending", label: "En attente", variant: "neutral" as StatusVariant, icon: Clock },
  { value: "scheduled", label: "Planifié", variant: "info" as StatusVariant, icon: Calendar },
  { value: "assigned", label: "Technicien assigné", variant: "warning" as StatusVariant, icon: UserCheck },
  { value: "en_route", label: "En route", variant: "info" as StatusVariant, icon: Truck },
  { value: "in_progress", label: "En cours", variant: "purple" as StatusVariant, icon: Play },
  { value: "completed", label: "Terminé", variant: "success" as StatusVariant, icon: CheckCircle },
  { value: "failed", label: "Échoué", variant: "danger" as StatusVariant, icon: AlertTriangle },
  { value: "cancelled", label: "Annulé", variant: "danger" as StatusVariant, icon: XCircle },
] as const;

const statusLabel = (s: string) => JOB_STATUSES.find(o => o.value === s)?.label || s;
const statusVariant = (s: string): StatusVariant => JOB_STATUSES.find(o => o.value === s)?.variant || "neutral";

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["scheduled", "assigned", "cancelled"],
  scheduled: ["assigned", "cancelled"],
  assigned: ["en_route", "cancelled"],
  en_route: ["in_progress"],
  in_progress: ["completed", "failed"],
  completed: [],
  failed: ["pending", "scheduled"],
  cancelled: ["pending"],
};

const JOB_TYPES = [
  { value: "installation", label: "Installation" },
  { value: "maintenance", label: "Maintenance" },
  { value: "replacement", label: "Remplacement" },
  { value: "repair", label: "Réparation" },
];

const INSTALLATION_LEVELS = [
  { value: "level_1", label: "Niveau 1 — Coaxial présent" },
  { value: "level_2", label: "Niveau 2 — Câblage requis" },
];

interface InstallationJob {
  id: string;
  job_number: string;
  order_id: string | null;
  account_id: string | null;
  address_id: string | null;
  appointment_id: string | null;
  technician_id: string | null;
  technician_assigned_at: string | null;
  job_type: string;
  installation_level: string | null;
  service_type: string | null;
  status: string;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  service_address: string | null;
  service_city: string | null;
  service_postal_code: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  equipment_installed: any;
  technician_notes: string | null;
  internal_notes: string | null;
  client_instructions: string | null;
  quality_score: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface Technician {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  specializations: string[] | null;
}

interface JobLog {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  actor_name: string | null;
  details: any;
  created_at: string;
}

export default function CoreInstallationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<InstallationJob | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState<InstallationJob | null>(null);
  const [statusChangeItem, setStatusChangeItem] = useState<InstallationJob | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");

  // Create form
  const [createForm, setCreateForm] = useState({
    order_number: "",
    account_number: "",
    job_type: "installation",
    installation_level: "level_1",
    service_type: "",
    scheduled_date: "",
    scheduled_time_start: "",
    scheduled_time_end: "",
    service_address: "",
    service_city: "",
    service_postal_code: "",
    client_name: "",
    client_phone: "",
    client_email: "",
    internal_notes: "",
    client_instructions: "",
  });

  // ── Fetch jobs ──
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["installation-jobs", statusFilter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("installation_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as InstallationJob[];
    },
  });

  // ── Fetch technicians ──
  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("technicians")
        .select("id, full_name, email, phone, status, specializations")
        .eq("status", "active")
        .order("full_name");
      return (data || []) as Technician[];
    },
  });

  // ── Fetch audit log for selected job ──
  const { data: jobLogs = [] } = useQuery({
    queryKey: ["installation-job-logs", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await (supabase as any)
        .from("installation_job_logs")
        .select("*")
        .eq("job_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as JobLog[];
    },
  });

  // ── Create job mutation ──
  const createMutation = useMutation({
    mutationFn: async () => {
      let orderId: string | null = null;
      let accountId: string | null = null;

      if (createForm.order_number.trim()) {
        const { data: ord } = await supabase
          .from("orders")
          .select("id")
          .eq("order_number", createForm.order_number.trim())
          .maybeSingle();
        if (!ord) throw new Error(`Commande ${createForm.order_number} introuvable`);
        orderId = ord.id;
      }

      if (createForm.account_number.trim()) {
        const { data: acc } = await supabase
          .from("accounts")
          .select("id")
          .eq("account_number", createForm.account_number.trim())
          .maybeSingle();
        if (!acc) throw new Error(`Compte ${createForm.account_number} introuvable`);
        accountId = acc.id;
      }

      const { error } = await (supabase as any).from("installation_jobs").insert({
        order_id: orderId,
        account_id: accountId,
        job_type: createForm.job_type,
        installation_level: createForm.installation_level,
        service_type: createForm.service_type || null,
        scheduled_date: createForm.scheduled_date || null,
        scheduled_time_start: createForm.scheduled_time_start || null,
        scheduled_time_end: createForm.scheduled_time_end || null,
        service_address: createForm.service_address || null,
        service_city: createForm.service_city || null,
        service_postal_code: createForm.service_postal_code || null,
        client_name: createForm.client_name || null,
        client_phone: createForm.client_phone || null,
        client_email: createForm.client_email || null,
        internal_notes: createForm.internal_notes || null,
        client_instructions: createForm.client_instructions || null,
        status: createForm.scheduled_date ? "scheduled" : "pending",
        created_by: "Admin",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installation-jobs"] });
      toast.success("Job d'installation créé");
      setShowCreateDialog(false);
      setCreateForm({
        order_number: "", account_number: "", job_type: "installation",
        installation_level: "level_1", service_type: "", scheduled_date: "",
        scheduled_time_start: "", scheduled_time_end: "", service_address: "",
        service_city: "", service_postal_code: "", client_name: "",
        client_phone: "", client_email: "", internal_notes: "", client_instructions: "",
      });
    },
    onError: (err: any) => toast.error("Erreur", { description: err.message }),
  });

  // ── Assign technician mutation ──
  const [selectedTechId, setSelectedTechId] = useState("");
  const assignMutation = useMutation({
    mutationFn: async ({ job, technicianId }: { job: InstallationJob; technicianId: string }) => {
      const { error } = await (supabase as any)
        .from("installation_jobs")
        .update({
          technician_id: technicianId,
          technician_assigned_at: new Date().toISOString(),
          status: "assigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (error) throw error;

      // Audit
      const tech = technicians.find(t => t.id === technicianId);
      await (supabase as any).from("installation_job_logs").insert({
        job_id: job.id,
        action: "technician_assigned",
        old_status: job.status,
        new_status: "assigned",
        actor_name: "Admin",
        details: { technician_id: technicianId, technician_name: tech?.full_name },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installation-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["installation-job-logs"] });
      toast.success("Technicien assigné");
      setAssignDialog(null);
      setSelectedTechId("");
    },
    onError: (err: any) => toast.error("Erreur", { description: err.message }),
  });

  // ── Status change mutation ──
  const statusMutation = useMutation({
    mutationFn: async ({ job, toStatus, note }: { job: InstallationJob; toStatus: string; note?: string }) => {
      const updates: any = {
        status: toStatus,
        updated_at: new Date().toISOString(),
      };
      if (toStatus === "in_progress") updates.started_at = new Date().toISOString();
      if (toStatus === "completed") updates.completed_at = new Date().toISOString();
      if (toStatus === "cancelled") {
        updates.cancelled_at = new Date().toISOString();
        updates.cancellation_reason = note || null;
      }
      if (toStatus === "pending") {
        updates.started_at = null;
        updates.completed_at = null;
        updates.cancelled_at = null;
      }

      const { error } = await (supabase as any)
        .from("installation_jobs")
        .update(updates)
        .eq("id", job.id);
      if (error) throw error;

      await (supabase as any).from("installation_job_logs").insert({
        job_id: job.id,
        action: "status_change",
        old_status: job.status,
        new_status: toStatus,
        actor_name: "Admin",
        details: note ? { note } : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installation-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["installation-job-logs"] });
      toast.success("Statut mis à jour");
      setStatusChangeItem(null);
      setNewStatus("");
      setStatusNote("");
    },
    onError: (err: any) => toast.error("Erreur", { description: err.message }),
  });

  // ── Filter ──
  const filtered = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(j =>
      j.job_number?.toLowerCase().includes(q) ||
      (j.client_name || "").toLowerCase().includes(q) ||
      (j.service_address || "").toLowerCase().includes(q) ||
      (j.client_email || "").toLowerCase().includes(q)
    );
  }, [jobs, search]);

  // ── KPIs ──
  const counts = JOB_STATUSES.reduce((acc, s) => {
    acc[s.value] = jobs.filter(j => j.status === s.value).length;
    return acc;
  }, {} as Record<string, number>);

  const todayJobs = jobs.filter(j => j.scheduled_date === format(new Date(), "yyyy-MM-dd")).length;

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Installations & Interventions</h1>
          <p className="text-xs text-muted-foreground">
            {jobs.length} jobs • {todayJobs} aujourd'hui • {counts.in_progress || 0} en cours • {technicians.length} techniciens actifs
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouveau job
        </Button>
      </div>

      {/* ═══ STATUS KPIs ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {JOB_STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
            className={cn(
              "rounded-lg border p-2 text-left transition-colors",
              statusFilter === s.value
                ? "border-emerald-500/30 bg-emerald-600/10"
                : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]"
            )}
          >
            <div className="flex items-center gap-1.5">
              <s.icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-foreground mt-0.5">{counts[s.value] || 0}</p>
          </button>
        ))}
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Job #, client, adresse…"
          className="pl-8 h-8 bg-[hsl(220,20%,9%)] border-[hsl(220,15%,18%)] text-foreground text-xs placeholder:text-muted-foreground"
        />
      </div>

      {/* ═══ TABLE ═══ */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Job #", "Type", "Client", "Adresse", "Date prévue", "Technicien", "Statut", "Commande", "Actions"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Aucun job d'installation
                </td></tr>
              ) : (
                filtered.map(job => {
                  const tech = technicians.find(t => t.id === job.technician_id);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelected(job)}
                      className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5 text-foreground font-mono font-medium text-[11px]">{job.job_number}</td>
                      <td className="px-3 py-2.5 text-muted-foreground capitalize">
                        {JOB_TYPES.find(t => t.value === job.job_type)?.label || job.job_type}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-foreground font-medium">{job.client_name || "—"}</div>
                        {job.client_phone && <div className="text-[10px] text-muted-foreground">{job.client_phone}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[180px] truncate">
                        {job.service_address || "—"}
                        {job.service_city && `, ${job.service_city}`}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {job.scheduled_date
                          ? format(new Date(job.scheduled_date + "T00:00:00"), "dd MMM yyyy", { locale: fr })
                          : "—"}
                        {job.scheduled_time_start && (
                          <div className="text-[10px]">{job.scheduled_time_start?.slice(0, 5)} - {job.scheduled_time_end?.slice(0, 5)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {tech ? (
                          <div className="text-foreground font-medium">{tech.full_name}</div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">Non assigné</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge label={statusLabel(job.status)} variant={statusVariant(job.status)} size="sm" />
                      </td>
                      <td className="px-3 py-2.5">
                        {job.order_id ? (
                          <Link
                            to={corePath(`/orders/${job.order_id}`)}
                            onClick={e => e.stopPropagation()}
                            className="text-blue-400 hover:underline text-[11px]"
                          >
                            Voir ↗
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {(job.status === "pending" || job.status === "scheduled") && (
                            <button
                              onClick={() => { setAssignDialog(job); setSelectedTechId(""); }}
                              className="h-6 px-2 rounded border border-amber-500/30 text-[10px] text-amber-400 hover:bg-amber-500/10"
                              title="Assigner technicien"
                            >
                              <UserCheck className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => { setStatusChangeItem(job); setNewStatus(""); setStatusNote(""); }}
                            className="h-6 px-2 rounded border border-[hsl(220,15%,20%)] text-[10px] text-muted-foreground hover:text-foreground"
                            title="Changer statut"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ DETAIL DRAWER ═══ */}
      <Sheet open={!!selected && !statusChangeItem && !assignDialog} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-foreground overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4 text-emerald-400" />
              Job {selected?.job_number}
            </SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3">
                <StatusBadge label={statusLabel(selected.status)} variant={statusVariant(selected.status)} size="md" />
                <span className="text-[11px] text-muted-foreground">
                  {JOB_TYPES.find(t => t.value === selected.job_type)?.label}
                  {selected.installation_level && ` • ${INSTALLATION_LEVELS.find(l => l.value === selected.installation_level)?.label}`}
                </span>
              </div>

              {/* Client & Address */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Client & Adresse
                </h3>
                {[
                  ["Client", selected.client_name],
                  ["Téléphone", selected.client_phone],
                  ["Courriel", selected.client_email],
                  ["Adresse", [selected.service_address, selected.service_city, selected.service_postal_code].filter(Boolean).join(", ")],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="text-foreground font-medium text-right max-w-[250px]">{(v as string) || "—"}</span>
                  </div>
                ))}
              </div>

              {/* Schedule */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Planification
                </h3>
                {[
                  ["Date prévue", selected.scheduled_date ? format(new Date(selected.scheduled_date + "T00:00:00"), "dd MMMM yyyy", { locale: fr }) : "—"],
                  ["Créneau", selected.scheduled_time_start ? `${selected.scheduled_time_start?.slice(0, 5)} - ${selected.scheduled_time_end?.slice(0, 5)}` : "—"],
                  ["Démarré", selected.started_at ? format(new Date(selected.started_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"],
                  ["Terminé", selected.completed_at ? format(new Date(selected.completed_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="text-foreground font-medium">{(v as string)}</span>
                  </div>
                ))}
              </div>

              {/* Technician */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" /> Technicien
                </h3>
                {(() => {
                  const tech = technicians.find(t => t.id === selected.technician_id);
                  return tech ? (
                    <>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-muted-foreground">Nom</span>
                        <span className="text-foreground font-medium">{tech.full_name}</span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-muted-foreground">Téléphone</span>
                        <span className="text-foreground">{tech.phone || "—"}</span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-muted-foreground">Assigné le</span>
                        <span className="text-foreground">
                          {selected.technician_assigned_at
                            ? format(new Date(selected.technician_assigned_at), "dd MMM yyyy HH:mm", { locale: fr })
                            : "—"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[12px] italic">Aucun technicien assigné</span>
                      {(selected.status === "pending" || selected.status === "scheduled") && (
                        <button
                          onClick={() => { setAssignDialog(selected); setSelected(null); }}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30"
                        >
                          Assigner
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Linkage */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Références
                </h3>
                {[
                  ["Commande", selected.order_id],
                  ["Compte", selected.account_id],
                  ["Rendez-vous", selected.appointment_id],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">{l}</span>
                    {v && l === "Commande" ? (
                      <Link to={corePath(`/orders/${v}`)} className="text-blue-400 hover:underline text-[11px]">Voir commande ↗</Link>
                    ) : (
                      <span className="text-foreground font-mono text-[10px]">{(v as string) || "—"}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Status Actions */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transitions disponibles</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(VALID_TRANSITIONS[selected.status] || []).map(toStatus => (
                    <button
                      key={toStatus}
                      onClick={() => statusMutation.mutate({ job: selected, toStatus })}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors text-muted-foreground border border-[hsl(220,15%,18%)] hover:text-foreground"
                    >
                      → {statusLabel(toStatus)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {(selected.internal_notes || selected.technician_notes || selected.client_instructions) && (
                <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
                  {selected.internal_notes && (
                    <div><span className="text-[10px] text-muted-foreground uppercase">Interne:</span><p className="text-[12px] text-foreground">{selected.internal_notes}</p></div>
                  )}
                  {selected.technician_notes && (
                    <div><span className="text-[10px] text-muted-foreground uppercase">Technicien:</span><p className="text-[12px] text-foreground">{selected.technician_notes}</p></div>
                  )}
                  {selected.client_instructions && (
                    <div><span className="text-[10px] text-muted-foreground uppercase">Instructions client:</span><p className="text-[12px] text-foreground">{selected.client_instructions}</p></div>
                  )}
                </div>
              )}

              {/* Audit Trail */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" /> Historique
                </h3>
                {jobLogs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Aucun historique</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {jobLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-[11px]">
                        <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <span className="text-foreground font-medium">{log.action}</span>
                          {log.old_status && log.new_status && (
                            <span className="text-muted-foreground"> {statusLabel(log.old_status)} → {statusLabel(log.new_status)}</span>
                          )}
                          <br />
                          <span className="text-muted-foreground">
                            {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                            {log.actor_name && ` • ${log.actor_name}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ ASSIGN TECHNICIAN DIALOG ═══ */}
      {assignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAssignDialog(null)}>
          <div className="w-full max-w-md rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-400" />
              Assigner un technicien — {assignDialog.job_number}
            </h2>

            {technicians.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Aucun technicien actif disponible</p>
            ) : (
              <div className="space-y-2">
                {technicians.map(tech => (
                  <button
                    key={tech.id}
                    onClick={() => setSelectedTechId(tech.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left",
                      selectedTechId === tech.id
                        ? "border-emerald-500/30 bg-emerald-600/10"
                        : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] hover:bg-[hsl(220,15%,13%)]"
                    )}
                  >
                    <div>
                      <div className="text-[13px] text-foreground font-medium">{tech.full_name}</div>
                      <div className="text-[11px] text-muted-foreground">{tech.email} {tech.phone && `• ${tech.phone}`}</div>
                      {tech.specializations && tech.specializations.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {tech.specializations.map(s => (
                            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedTechId === tech.id && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setAssignDialog(null)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-muted-foreground text-[12px] font-medium">
                Annuler
              </button>
              <button
                onClick={() => { if (selectedTechId) assignMutation.mutate({ job: assignDialog, technicianId: selectedTechId }); }}
                disabled={!selectedTechId || assignMutation.isPending}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {assignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STATUS CHANGE DIALOG ═══ */}
      {statusChangeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setStatusChangeItem(null)}>
          <div className="w-full max-w-sm rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-[14px] font-semibold text-foreground">
              Changer le statut — {statusChangeItem.job_number}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Actuel: <StatusBadge label={statusLabel(statusChangeItem.status)} variant={statusVariant(statusChangeItem.status)} size="sm" />
            </p>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Nouveau statut</Label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                className="w-full h-8 px-2 mt-1 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-foreground focus:outline-none"
              >
                <option value="">Sélectionner…</option>
                {(VALID_TRANSITIONS[statusChangeItem.status] || []).map(s => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Note (optionnel)</Label>
              <Input
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                placeholder="Raison…"
                className="h-8 mt-1 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,18%)] text-foreground text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStatusChangeItem(null)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-muted-foreground text-[12px] font-medium">
                Annuler
              </button>
              <button
                onClick={() => { if (newStatus) statusMutation.mutate({ job: statusChangeItem, toStatus: newStatus, note: statusNote }); }}
                disabled={!newStatus || statusMutation.isPending}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE JOB DIALOG ═══ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,16%)] text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Créer un job d'installation</DialogTitle>
            <DialogDescription className="text-muted-foreground">Lier à une commande existante ou créer manuellement</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">N° Commande</Label>
                <Input value={createForm.order_number}
                  onChange={e => setCreateForm(p => ({ ...p, order_number: e.target.value }))}
                  placeholder="ORD-XXXXXX"
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">N° Compte</Label>
                <Input value={createForm.account_number}
                  onChange={e => setCreateForm(p => ({ ...p, account_number: e.target.value }))}
                  placeholder="ACC-XXXXXX"
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Type de job</Label>
                <Select value={createForm.job_type} onValueChange={v => setCreateForm(p => ({ ...p, job_type: v }))}>
                  <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                    {JOB_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-foreground text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Niveau</Label>
                <Select value={createForm.installation_level} onValueChange={v => setCreateForm(p => ({ ...p, installation_level: v }))}>
                  <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                    {INSTALLATION_LEVELS.map(l => <SelectItem key={l.value} value={l.value} className="text-foreground text-xs">{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Date</Label>
                <Input type="date" value={createForm.scheduled_date}
                  onChange={e => setCreateForm(p => ({ ...p, scheduled_date: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Début</Label>
                <Input type="time" value={createForm.scheduled_time_start}
                  onChange={e => setCreateForm(p => ({ ...p, scheduled_time_start: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Fin</Label>
                <Input type="time" value={createForm.scheduled_time_end}
                  onChange={e => setCreateForm(p => ({ ...p, scheduled_time_end: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>

            <div className="border-t border-[hsl(220,15%,16%)] pt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Infos client</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Nom</Label>
                <Input value={createForm.client_name}
                  onChange={e => setCreateForm(p => ({ ...p, client_name: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Téléphone</Label>
                <Input value={createForm.client_phone}
                  onChange={e => setCreateForm(p => ({ ...p, client_phone: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Courriel</Label>
              <Input value={createForm.client_email}
                onChange={e => setCreateForm(p => ({ ...p, client_email: e.target.value }))}
                className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
            </div>

            <div className="border-t border-[hsl(220,15%,16%)] pt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Adresse de service</p>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Adresse</Label>
              <Input value={createForm.service_address}
                onChange={e => setCreateForm(p => ({ ...p, service_address: e.target.value }))}
                className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Ville</Label>
                <Input value={createForm.service_city}
                  onChange={e => setCreateForm(p => ({ ...p, service_city: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Code postal</Label>
                <Input value={createForm.service_postal_code}
                  onChange={e => setCreateForm(p => ({ ...p, service_postal_code: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Notes internes</Label>
              <Textarea value={createForm.internal_notes}
                onChange={e => setCreateForm(p => ({ ...p, internal_notes: e.target.value }))}
                rows={2}
                className="mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
            </div>

            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Créer le job
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
