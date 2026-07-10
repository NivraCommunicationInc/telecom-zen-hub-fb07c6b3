/**
 * EmployeeSupport — Real support ticket management.
 * Agents can view, change status, assign, and add notes.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Headphones, Loader2, ArrowUpRight, MessageSquare, User, Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { addOperationalNote } from "@/shared-ops";
import { StatusBadge } from "@/employee-app/components/StatusBadge";
import { ActionConfirmButton } from "@/employee-app/components/ActionConfirmDialog";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { callSupportAction } from "@/shared-ops/lib/callSupportAction";

type SupportFilter = "open" | "in_progress" | "resolved" | "all";

export default function EmployeeSupport() {
  usePortalRealtime(["support_tickets"], [["employee-support"]]);
  const [filter, setFilter] = useState<SupportFilter>("open");
  const navigate = useNavigate();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["employee-support-v2", filter],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, priority, created_at, assigned_to, user_id, description")
        .order("created_at", { ascending: false })
        .limit(50);
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
    staleTime: 1000 * 60 * 2,
  });

  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, newStatus }: { ticketId: string; newStatus: string }) => {
      const { error } = await supabase.from("support_tickets").update({ status: newStatus }).eq("id", ticketId);
      if (error) throw error;
      await addOperationalNote({ entityId: ticketId, entityType: "support_ticket", note: `Statut → ${newStatus}`, portal: "employee" });
      await logInternalAudit({ action: `ticket_status_${newStatus}`, category: "operations", portal: "employee", targetType: "support_ticket", targetId: ticketId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-support-v2"] });
      toast.success("Ticket mis à jour");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Non authentifié");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).maybeSingle();
      const name = profile?.full_name ?? session.user.email ?? "Agent";
      const { error } = await supabase.from("support_tickets").update({ assigned_to: name }).eq("id", ticketId);
      if (error) throw error;
      await addOperationalNote({ entityId: ticketId, entityType: "support_ticket", note: `Assigné à ${name}`, portal: "employee" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-support-v2"] });
      toast.success("Ticket assigné");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const FILTERS: { key: SupportFilter; label: string }[] = [
    { key: "open", label: "Ouverts" },
    { key: "in_progress", label: "En cours" },
    { key: "resolved", label: "Résolus" },
    { key: "all", label: "Tous" },
  ];

  const priorityBadge = (p: string | null) => {
    if (!p) return null;
    const colors: Record<string, string> = {
      urgent: "text-red-400 bg-red-500/10",
      high: "text-amber-400 bg-amber-500/10",
      normal: "text-muted-foreground bg-muted",
      low: "text-muted-foreground/60 bg-muted",
    };
    return (
      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase", colors[p] ?? colors.normal)}>
        {p === "urgent" ? "URGENT" : p === "high" ? "HAUTE" : p}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Support</h1>
        <p className="text-xs text-muted-foreground">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
              filter === f.key ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-transparent hover:bg-secondary"
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16">
          <Headphones className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Aucun ticket.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => (
            <div key={t.id}
              onClick={() => navigate(employeePath(`/support/${t.id}`))}
              className="rounded-lg border border-border bg-card p-3 hover:border-primary/20 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] text-muted-foreground">{t.ticket_number ?? t.id.slice(0, 8)}</span>
                    <StatusBadge status={t.status} />
                    {priorityBadge(t.priority)}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{t.subject ?? "Sans objet"}</p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                    {t.clientName && (
                      <button onClick={() => t.user_id && navigate(employeePath(`/clients/${t.user_id}`))}
                        className="flex items-center gap-1 hover:text-primary transition-colors">
                        <User className="h-3 w-3" /> {t.clientName}
                      </button>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}
                    </span>
                    {t.assigned_to && (
                      <span className="text-primary font-medium">→ {t.assigned_to}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!t.assigned_to && (
                    <button onClick={() => assignMutation.mutate(t.id)} disabled={assignMutation.isPending}
                      className="px-2 py-1 rounded text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-40">
                      Prendre
                    </button>
                  )}
                  {t.status === "open" && (
                    <ActionConfirmButton label="En cours" consequence="Le ticket sera marqué en cours de traitement"
                      onConfirm={() => statusMutation.mutate({ ticketId: t.id, newStatus: "in_progress" })}
                      isPending={statusMutation.isPending} variant="default" />
                  )}
                  {t.status === "in_progress" && (
                    <ActionConfirmButton label="Résoudre" consequence="Le ticket sera marqué comme résolu"
                      onConfirm={() => statusMutation.mutate({ ticketId: t.id, newStatus: "resolved" })}
                      isPending={statusMutation.isPending} variant="primary" />
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
