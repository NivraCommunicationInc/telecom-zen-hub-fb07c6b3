/**
 * EmployeeInternetTickets — INTERNAL ticket system between departments/employees.
 * NOT a client-support tool. Tickets here are routed to a target department
 * and optionally a specific assignee, with optional CC employees.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, Loader2, ArrowUpRight, Clock, AlertTriangle, Plus, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { StatusBadge } from "@/employee-app/components/StatusBadge";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const INTERNET_CATEGORIES = ["technical", "internet", "internet_technical"];

type Filter = "open" | "in_progress" | "resolved" | "all";

const CATEGORY_OPTIONS = [
  { value: "internet_technical", label: "Problème technique réseau" },
  { value: "service_activation", label: "Activation service internet" },
  { value: "equipment_config", label: "Configuration équipement" },
  { value: "billing_internet", label: "Problème de facturation internet" },
  { value: "field_support", label: "Demande de support terrain" },
  { value: "other", label: "Autre" },
];

const DEPARTMENT_OPTIONS = [
  { value: "Nivra Core", label: "Nivra Core (admin)" },
  { value: "Support technique", label: "Support technique" },
  { value: "Field Sales", label: "Équipe terrain (Field Sales)" },
  { value: "Facturation", label: "Département facturation" },
  { value: "KYC", label: "Département KYC" },
  { value: "Technicien", label: "Technicien assigné" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normale" },
  { value: "urgent", label: "Urgente" },
  { value: "critical", label: "Critique" },
];

const STAFF_ROLES = ["admin", "employee", "field_sales", "technician", "techops"];

export default function EmployeeInternetTickets() {
  usePortalRealtime(["support_tickets"], [["employee-internet-tickets"]]);
  const [filter, setFilter] = useState<Filter>("open");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("internet_technical");
  const [priority, setPriority] = useState("normal");
  const [department, setDepartment] = useState("Support technique");
  const [description, setDescription] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<any>(null);
  const [ccSearch, setCcSearch] = useState("");
  const [ccList, setCcList] = useState<any[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["employee-internet-tickets", filter],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, priority, category, created_at, assigned_to, assigned_to_user_id, assigned_department, description")
        .in("category", INTERNET_CATEGORIES)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60,
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, newStatus }: { ticketId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-internet-tickets"] });
      toast.success("Statut mis à jour");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Search staff members for assignee
  const { data: assigneeResults = [] } = useQuery({
    queryKey: ["internal-ticket-staff-search", assigneeSearch],
    enabled: showCreateForm && assigneeSearch.length >= 2,
    queryFn: async () => {
      const term = `%${assigneeSearch}%`;
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", STAFF_ROLES as any);
      const roleMap = new Map((roleRows ?? []).map((r: any) => [r.user_id, r.role]));
      const userIds = Array.from(roleMap.keys());
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds)
        .or(`full_name.ilike.${term},email.ilike.${term}`)
        .limit(8);
      return (data ?? []).map((p: any) => ({ ...p, role: roleMap.get(p.user_id) }));
    },
  });

  const { data: ccResults = [] } = useQuery({
    queryKey: ["internal-ticket-cc-search", ccSearch],
    enabled: showCreateForm && ccSearch.length >= 2,
    queryFn: async () => {
      const term = `%${ccSearch}%`;
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", STAFF_ROLES as any);
      const roleMap = new Map((roleRows ?? []).map((r: any) => [r.user_id, r.role]));
      const userIds = Array.from(roleMap.keys());
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds)
        .or(`full_name.ilike.${term},email.ilike.${term}`)
        .limit(8);
      return (data ?? []).map((p: any) => ({ ...p, role: roleMap.get(p.user_id) }));
    },
  });

  const resetForm = () => {
    setSubject("");
    setCategory("internet_technical");
    setPriority("normal");
    setDepartment("Support technique");
    setDescription("");
    setAssigneeSearch("");
    setSelectedAssignee(null);
    setCcSearch("");
    setCcList([]);
    setFiles([]);
  };

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const actorId = sessionData.session?.user.id;
      if (!actorId) throw new Error("Non authentifié");
      if (!subject.trim()) throw new Error("Sujet requis");
      if (!department) throw new Error("Département cible requis");
      if (!description.trim()) throw new Error("Description requise");

      // Upload attachments
      const uploaded: { name: string; path: string; size: number; type: string }[] = [];
      for (const f of files) {
        const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const path = `internal/${actorId}/${safe}`;
        const { error: upErr } = await supabase.storage.from("ticket-attachments").upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) throw upErr;
        uploaded.push({ name: f.name, path, size: f.size, type: f.type });
      }

      const ccIds = ccList.map((c) => c.user_id);
      const { data: ticket, error } = await supabase.from("support_tickets").insert({
        subject,
        description,
        priority,
        category: "internet_technical",
        issue_type: CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category,
        status: "open",
        assigned_department: department,
        route_to: department,
        assigned_to: selectedAssignee?.full_name ?? department,
        assigned_to_user_id: selectedAssignee?.user_id ?? null,
        cc_user_ids: ccIds,
        attachments: uploaded,
        is_internal: true,
        created_by_user_id: actorId,
        created_by_role: "employee",
      } as any).select("id, ticket_number").single();
      if (error) throw error;

      // Notify assignee + CC
      const recipients: { email: string; name: string }[] = [];
      if (selectedAssignee?.email) recipients.push({ email: selectedAssignee.email, name: selectedAssignee.full_name ?? "Collègue" });
      for (const cc of ccList) {
        if (cc.email && !recipients.find((r) => r.email === cc.email)) {
          recipients.push({ email: cc.email, name: cc.full_name ?? "Collègue" });
        }
      }

      if (recipients.length > 0) {
        const rows = recipients.map((r) => ({
          event_key: `ticket_assigned_notification_${ticket.id}_${r.email}`,
          to_email: r.email,
          template_key: "ticket_assigned_notification",
          template_vars: {
            ticket_number: ticket.ticket_number ?? ticket.id,
            subject,
            priority,
            assignee_name: r.name,
            department,
            description,
          },
          status: "queued",
        }));
        await supabase.from("email_queue").insert(rows as any);
      }
    },
    onSuccess: () => {
      toast.success("Ticket interne créé");
      setShowCreateForm(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["employee-internet-tickets"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const counts = {
    open: tickets.filter((t: any) => t.status === "open").length,
    in_progress: tickets.filter((t: any) => t.status === "in_progress").length,
    urgent: tickets.filter((t: any) => t.priority === "urgent" || t.priority === "critical").length,
  };

  const addCc = (p: any) => {
    if (!ccList.find((c) => c.user_id === p.user_id) && p.user_id !== selectedAssignee?.user_id) {
      setCcList([...ccList, p]);
    }
    setCcSearch("");
  };

  const removeCc = (userId: string) => setCcList(ccList.filter((c) => c.user_id !== userId));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Wifi className="h-4 w-4 text-primary" />
            Tickets internes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Communication entre départements et employés (réseau, technique, terrain)
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau ticket interne
        </button>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Sujet *</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Titre du ticket" className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Catégorie *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm">
                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Priorité *</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm">
                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Département cible *</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm">
                {DEPARTMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Description *</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-[100px] w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Décrire le problème, le contexte, les étapes…" />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Assigner à (optionnel)</label>
              {selectedAssignee ? (
                <div className="mt-1 flex items-center justify-between rounded-lg bg-primary/10 p-2 text-xs text-primary">
                  <span>{selectedAssignee.full_name ?? selectedAssignee.email} · <span className="opacity-70">{selectedAssignee.role}</span> · {selectedAssignee.email}</span>
                  <button onClick={() => setSelectedAssignee(null)} className="opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <>
                  <input value={assigneeSearch} onChange={(e) => setAssigneeSearch(e.target.value)} placeholder="Rechercher un employé (nom ou courriel)" className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm" />
                  {assigneeResults.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {assigneeResults.map((p: any) => (
                        <button key={p.user_id} onClick={() => { setSelectedAssignee(p); setAssigneeSearch(""); }} className="w-full rounded-lg border border-border p-2 text-left text-xs hover:bg-secondary">
                          <span className="block font-medium text-foreground">{p.full_name ?? p.email}</span>
                          <span className="text-muted-foreground">{p.role} · {p.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">CC (optionnel) — copies additionnelles</label>
              {ccList.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ccList.map((c) => (
                    <span key={c.user_id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11px]">
                      {c.full_name ?? c.email} <button onClick={() => removeCc(c.user_id)} className="opacity-70 hover:opacity-100"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <input value={ccSearch} onChange={(e) => setCcSearch(e.target.value)} placeholder="Ajouter un employé en CC" className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm" />
              {ccResults.length > 0 && (
                <div className="mt-1 space-y-1">
                  {ccResults.map((p: any) => (
                    <button key={p.user_id} onClick={() => addCc(p)} className="w-full rounded-lg border border-border p-2 text-left text-xs hover:bg-secondary">
                      <span className="block font-medium text-foreground">{p.full_name ?? p.email}</span>
                      <span className="text-muted-foreground">{p.role} · {p.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Paperclip className="h-3 w-3" /> Pièces jointes (optionnel)</label>
              <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="mt-1 w-full text-xs" />
              {files.length > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground">{files.length} fichier(s) sélectionné(s)</div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCreateForm(false); resetForm(); }} className="min-h-[44px] rounded-lg border border-border px-3 text-xs">Annuler</button>
            <button onClick={() => createTicketMutation.mutate()} disabled={createTicketMutation.isPending} className="min-h-[44px] rounded-lg bg-primary px-3 text-xs text-primary-foreground disabled:opacity-40">
              {createTicketMutation.isPending && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}Créer ticket
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ouverts</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{counts.open}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">En cours</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{counts.in_progress}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Urgents</p>
          <p className="text-lg font-bold text-amber-400 mt-0.5">{counts.urgent}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {(["open", "in_progress", "resolved", "all"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px", filter === f ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground")}>
            {f === "open" ? "Ouverts" : f === "in_progress" ? "En cours" : f === "resolved" ? "Résolus" : "Tous"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Wifi className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucun ticket interne dans cette catégorie</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {tickets.map((t: any) => (
            <div key={t.id} className="p-3 hover:bg-secondary/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground">{t.ticket_number ?? t.id.slice(0, 8)}</span>
                    {(t.priority === "urgent" || t.priority === "critical") && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium"><AlertTriangle className="h-2.5 w-2.5" /> {t.priority.toUpperCase()}</span>
                    )}
                    <StatusBadge status={t.status} />
                    {t.assigned_department && (
                      <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">{t.assigned_department}</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground font-medium mt-1 truncate">{t.subject ?? "Sans objet"}</p>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}</span>
                    {t.assigned_to ? <span className="text-primary font-medium">→ {t.assigned_to}</span> : <span className="text-amber-400">Non assigné</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => navigate(employeePath(`/support/${t.id}`))} className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-background text-[11px] text-foreground hover:bg-secondary transition-colors">
                    Détails <ArrowUpRight className="h-2.5 w-2.5" />
                  </button>
                  {t.status === "open" && (
                    <button onClick={() => statusMutation.mutate({ ticketId: t.id, newStatus: "in_progress" })} className="px-2.5 py-1 rounded-md border border-border text-[11px] text-foreground hover:bg-secondary">Prendre</button>
                  )}
                  {t.status === "in_progress" && (
                    <button onClick={() => statusMutation.mutate({ ticketId: t.id, newStatus: "resolved" })} className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 hover:bg-emerald-500/20">Résoudre</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
