/**
 * EmployeeInternetTickets — Filtered view of technical/internet support tickets.
 * Shows tickets in categories: technical, internet, internet_technical.
 * Allows assigning to a technician and changing status.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, Loader2, ArrowUpRight, User, Clock, AlertTriangle, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { StatusBadge } from "@/employee-app/components/StatusBadge";
import { AssignTechnicianDialog } from "@/employee-app/components/AssignTechnicianDialog";

const INTERNET_CATEGORIES = ["technical", "internet", "internet_technical"];

type Filter = "open" | "in_progress" | "resolved" | "all";

export default function EmployeeInternetTickets() {
  const [filter, setFilter] = useState<Filter>("open");
  const [assignTarget, setAssignTarget] = useState<{ id: string; assignedUserId: string | null; assignedName: string | null } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [problemType, setProblemType] = useState("Connexion Internet");
  const [priority, setPriority] = useState("normal");
  const [routeTo, setRouteTo] = useState("support_interne");
  const [technicianId, setTechnicianId] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["employee-internet-tickets", filter],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, priority, category, created_at, assigned_to, assigned_to_user_id, user_id, description")
        .in("category", INTERNET_CATEGORIES)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map(t => t.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      return (data ?? []).map(t => ({
        ...t,
        clientName: profileMap.get(t.user_id)?.full_name ?? null,
        clientEmail: profileMap.get(t.user_id)?.email ?? null,
        clientPhone: profileMap.get(t.user_id)?.phone ?? null,
      }));
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

  const { data: clients = [], isLoading: searchingClients } = useQuery({
    queryKey: ["employee-internet-ticket-client-search", clientSearch],
    enabled: showCreateForm && clientSearch.length >= 2,
    queryFn: async () => {
      const term = `%${clientSearch}%`;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, service_address, service_city, service_postal_code")
        .or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
        .limit(8);
      return data ?? [];
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["employee-internet-ticket-technicians"],
    enabled: showCreateForm,
    queryFn: async () => {
      const { data } = await supabase.from("technicians" as any).select("id, user_id, full_name, email").eq("status", "active").order("full_name");
      return data ?? [];
    },
  });

  const routeLabels: Record<string, string> = {
    support_interne: "Support interne",
    field_sales: "Field Sales",
    technicien_assigne: "Technicien assigné",
    facturation: "Facturation",
    kyc: "KYC",
  };

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const actorId = sessionData.session?.user.id;
      if (!actorId) throw new Error("Non authentifié");
      if (!selectedClient?.user_id) throw new Error("Client requis");
      if (routeTo === "technicien_assigne" && (!technicianId || !appointmentAt)) throw new Error("Technicien et rendez-vous requis");

      const selectedTech = (technicians as any[]).find((t) => t.id === technicianId);
      const subject = `${problemType} — ${selectedClient.full_name ?? selectedClient.email ?? "Client"}`;
      const route_to = routeTo;
      const { data: ticket, error } = await supabase.from("support_tickets").insert({
        user_id: selectedClient.user_id,
        owner_user_id: selectedClient.user_id,
        client_email: selectedClient.email ?? null,
        subject,
        description: description || problemType,
        priority,
        category: "internet_technical",
        issue_type: problemType,
        status: "open",
        assigned_department: routeLabels[routeTo],
        route_to,
        assigned_to: selectedTech?.full_name ?? routeLabels[routeTo],
        assigned_to_user_id: selectedTech?.user_id ?? null,
        service_address: [selectedClient.service_address, selectedClient.service_city, selectedClient.service_postal_code].filter(Boolean).join(", ") || null,
        created_by_user_id: actorId,
        created_by_role: "employee",
      } as any).select("id, ticket_number").single();
      if (error) throw error;

      if (routeTo === "technicien_assigne") {
        const when = new Date(appointmentAt);
        const { error: appointmentError } = await supabase.from("appointments").insert({
          client_id: selectedClient.user_id,
          client_email: selectedClient.email ?? null,
          client_phone: selectedClient.phone ?? null,
          title: `Ticket Internet — ${selectedClient.full_name ?? "Client"}`,
          service_type: "internet_technical",
          description: `Ticket ${ticket.ticket_number ?? ticket.id}: ${problemType}`,
          internal_notes: description || null,
          scheduled_at: when.toISOString(),
          duration_minutes: 60,
          status: "scheduled",
          technician_id: selectedTech?.id ?? null,
          service_address: selectedClient.service_address ?? null,
          service_city: selectedClient.service_city ?? null,
          service_postal_code: selectedClient.service_postal_code ?? null,
          created_by: actorId,
          environment: "live",
        } as any);
        if (appointmentError) throw appointmentError;
      }

      await supabase.from("email_queue").insert({
        event_key: `ticket_assigned_notification_${ticket.id}`,
        to_email: selectedTech?.email ?? "support@nivratelecom.ca",
        template_key: "ticket_assigned_notification",
        template_vars: {
          ticket_number: ticket.ticket_number ?? ticket.id,
          subject,
          priority,
          client_name: selectedClient.full_name ?? selectedClient.email ?? "Client",
          client_label: selectedClient.full_name ?? selectedClient.email ?? "Client",
          assignee_name: selectedTech?.full_name ?? routeLabels[routeTo],
          description,
        },
        status: "queued",
      } as any);
    },
    onSuccess: () => {
      toast.success("Ticket Internet créé");
      setShowCreateForm(false);
      setClientSearch("");
      setSelectedClient(null);
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["employee-internet-tickets"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const counts = {
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    urgent: tickets.filter(t => t.priority === "urgent").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Wifi className="h-4 w-4 text-primary" />
            Tickets Internet & Technique
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tickets liés au service internet, équipements et problèmes techniques
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau ticket Internet
        </button>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs text-muted-foreground">Client search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full min-h-[44px] rounded-lg border border-border bg-background pl-9 pr-3 text-sm" placeholder="Nom, courriel, téléphone" />
              </div>
              {searchingClients && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {clients.map((c: any) => <button key={c.user_id} onClick={() => setSelectedClient(c)} className="w-full rounded-lg border border-border p-2 text-left text-xs hover:bg-secondary"><span className="block font-medium text-foreground">{c.full_name ?? c.email}</span><span className="text-muted-foreground">{c.email}</span></button>)}
              {selectedClient && <div className="rounded-lg bg-primary/10 p-2 text-xs text-primary">Client: {selectedClient.full_name ?? selectedClient.email}</div>}
            </div>
            <SelectField label="Problem type" value={problemType} onChange={setProblemType} options={["Connexion Internet", "Modem / routeur", "Vitesse lente", "Panne complète", "Installation", "Autre"]} />
            <SelectField label="Priority" value={priority} onChange={setPriority} options={[{ value: "normal", label: "Normale" }, { value: "urgent", label: "Urgente" }, { value: "critical", label: "Critique" }]} />
            <SelectField label="Route to" value={routeTo} onChange={setRouteTo} options={[{ value: "support_interne", label: "Support interne" }, { value: "field_sales", label: "Field Sales" }, { value: "technicien_assigne", label: "Technicien assigné" }, { value: "facturation", label: "Facturation" }, { value: "kyc", label: "KYC" }]} />
            {routeTo === "technicien_assigne" && <SelectField label="Technicien" value={technicianId} onChange={setTechnicianId} options={[{ value: "", label: "Sélectionner" }, ...(technicians as any[]).map((t) => ({ value: t.id, label: t.full_name ?? t.email ?? t.id }))]} />}
            {routeTo === "technicien_assigne" && <InputField label="Date + time" type="datetime-local" value={appointmentAt} onChange={setAppointmentAt} />}
            <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-[90px] w-full rounded-lg border border-border bg-background p-3 text-sm" /></div>
          </div>
          <div className="flex justify-end gap-2"><button onClick={() => setShowCreateForm(false)} className="min-h-[44px] rounded-lg border border-border px-3 text-xs">Annuler</button><button onClick={() => createTicketMutation.mutate()} disabled={createTicketMutation.isPending || !selectedClient} className="min-h-[44px] rounded-lg bg-primary px-3 text-xs text-primary-foreground disabled:opacity-40">{createTicketMutation.isPending && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}Créer ticket</button></div>
        </div>
      )}

      {/* Quick stats */}
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

      {/* Filters */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["open", "in_progress", "resolved", "all"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
              filter === f
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {f === "open" ? "Ouverts" : f === "in_progress" ? "En cours" : f === "resolved" ? "Résolus" : "Tous"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Wifi className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucun ticket dans cette catégorie</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {tickets.map(t => (
            <div key={t.id} className="p-3 hover:bg-secondary/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {t.ticket_number ?? t.id.slice(0, 8)}
                    </span>
                    {t.priority === "urgent" && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                        <AlertTriangle className="h-2.5 w-2.5" /> URGENT
                      </span>
                    )}
                    {t.priority === "high" && (
                      <span className="text-[10px] text-amber-400 font-medium">HAUTE</span>
                    )}
                    <StatusBadge status={t.status} />
                    {t.category && (
                      <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                        {t.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground font-medium mt-1 truncate">
                    {t.subject ?? "Sans objet"}
                  </p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    {t.clientName && (
                      <span className="flex items-center gap-1">
                        <User className="h-2.5 w-2.5" /> {t.clientName}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}
                    </span>
                    {t.assigned_to ? (
                      <span className="text-primary font-medium">→ {t.assigned_to}</span>
                    ) : (
                      <span className="text-amber-400">Non assigné</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => navigate(employeePath(`/support/${t.id}`))}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-background text-[11px] text-foreground hover:bg-secondary transition-colors"
                  >
                    Détails <ArrowUpRight className="h-2.5 w-2.5" />
                  </button>
                  <button
                    onClick={() => setAssignTarget({
                      id: t.id,
                      assignedUserId: t.assigned_to_user_id ?? null,
                      assignedName: t.assigned_to ?? null,
                    })}
                    className="px-2.5 py-1 rounded-md border border-border bg-background text-[11px] text-primary hover:bg-primary/10 transition-colors"
                  >
                    {t.assigned_to_user_id ? "Réassigner" : "Assigner tech"}
                  </button>
                  {t.status === "open" && (
                    <button
                      onClick={() => statusMutation.mutate({ ticketId: t.id, newStatus: "in_progress" })}
                      disabled={statusMutation.isPending}
                      className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-[11px] text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                    >
                      Démarrer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignTarget && (
        <AssignTechnicianDialog
          ticketId={assignTarget.id}
          currentAssignedUserId={assignTarget.assignedUserId}
          currentAssignedName={assignTarget.assignedName}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  );
}
