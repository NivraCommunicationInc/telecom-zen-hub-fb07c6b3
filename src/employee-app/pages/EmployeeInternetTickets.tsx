/**
 * EmployeeInternetTickets — Filtered view of technical/internet support tickets.
 * Shows tickets in categories: technical, internet, internet_technical.
 * Allows assigning to a technician and changing status.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, Loader2, ArrowUpRight, User, Clock, AlertTriangle } from "lucide-react";
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
      </div>

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
