/**
 * EmployeeSupportDetail — Full ticket detail with conversation, reply, status, assign.
 * Uses ticket_replies table for conversation timeline.
 * All actions audit-logged via shared-ops.
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Loader2, Send, User, Clock, MessageSquare,
  CheckCircle, AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { addOperationalNote } from "@/shared-ops";
import { StatusBadge } from "@/employee-app/components/StatusBadge";
import { ActionConfirmButton } from "@/employee-app/components/ActionConfirmDialog";
import { AssignTechnicianDialog } from "@/employee-app/components/AssignTechnicianDialog";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

export default function EmployeeSupportDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  // Fetch ticket
  const { data: ticket, isLoading } = useQuery({
    queryKey: ["employee-ticket-detail", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Ticket introuvable");

      // Fetch client profile
      let clientProfile = null;
      if (data.user_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .eq("user_id", data.user_id)
          .maybeSingle();
        clientProfile = p;
      }

      return { ...data, clientProfile };
    },
  });

  // Fetch replies
  const { data: replies = [] } = useQuery({
    queryKey: ["employee-ticket-replies", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // Send reply
  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("ticket_replies").insert({
        ticket_id: ticketId!,
        user_id: user.id,
        content: content.trim(),
        sender_role: "employee",
        sender_name: profile?.full_name ?? user.email ?? "Agent",
        is_admin: true,
      });
      if (error) throw error;

      // If ticket was open, move to in_progress
      if (ticket?.status === "open") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", ticketId!);
      }

      await logInternalAudit({
        action: "ticket_reply",
        category: "operations",
        portal: "employee",
        targetType: "support_ticket",
        targetId: ticketId!,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-ticket-replies", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["employee-ticket-detail", ticketId] });
      setReplyText("");
      toast.success("Réponse envoyée");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Status change
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", ticketId!);
      if (error) throw error;

      await addOperationalNote({
        entityId: ticketId!,
        entityType: "support_ticket",
        note: `Statut → ${newStatus}`,
        portal: "employee",
      });
      await logInternalAudit({
        action: `ticket_status_${newStatus}`,
        category: "operations",
        portal: "employee",
        targetType: "support_ticket",
        targetId: ticketId!,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-ticket-detail", ticketId] });
      toast.success("Statut mis à jour");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Assign to self
  const assignMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      const name = profile?.full_name ?? user.email ?? "Agent";

      const { error } = await supabase
        .from("support_tickets")
        .update({ assigned_to: name, updated_at: new Date().toISOString() })
        .eq("id", ticketId!);
      if (error) throw error;

      await addOperationalNote({
        entityId: ticketId!,
        entityType: "support_ticket",
        note: `Assigné à ${name}`,
        portal: "employee",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-ticket-detail", ticketId] });
      toast.success("Ticket assigné");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!ticketId) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Ticket introuvable</p>
        <Link to={employeePath("/support")} className="text-primary text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!ticket) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <p className="text-destructive text-sm">Ticket introuvable</p>
        <Link to={employeePath("/support")} className="text-primary text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  const priorityColor: Record<string, string> = {
    urgent: "text-red-400", high: "text-amber-400", normal: "text-muted-foreground", low: "text-muted-foreground/60",
  };

  return (
    <div className="space-y-4">
      <Link to={employeePath("/support")} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Support
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            {ticket.ticket_number ?? ticket.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-foreground mt-0.5">{ticket.subject ?? "Sans objet"}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className={priorityColor[ticket.priority ?? "normal"]}>
              {ticket.priority === "urgent" ? "URGENT" : ticket.priority === "high" ? "HAUTE" : ticket.priority ?? "normal"}
            </span>
            <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: fr })}</span>
            {ticket.category && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{ticket.category}</span>}
            {ticket.assigned_to && <span className="text-primary">→ {ticket.assigned_to}</span>}
          </div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {!ticket.assigned_to && (
          <button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-40">
            Prendre en charge
          </button>
        )}
        {ticket.status === "open" && (
          <ActionConfirmButton label="En cours" consequence="Le ticket sera marqué en cours de traitement"
            onConfirm={() => statusMutation.mutate("in_progress")} isPending={statusMutation.isPending} variant="default" />
        )}
        {ticket.status === "in_progress" && (
          <ActionConfirmButton label="Résoudre" consequence="Le ticket sera marqué comme résolu"
            onConfirm={() => statusMutation.mutate("resolved")} isPending={statusMutation.isPending} variant="primary" />
        )}
        {ticket.status === "resolved" && (
          <ActionConfirmButton label="Réouvrir" consequence="Le ticket sera réouvert"
            onConfirm={() => statusMutation.mutate("open")} isPending={statusMutation.isPending} variant="warning" />
        )}
        {ticket.clientProfile?.user_id && (
          <button onClick={() => navigate(employeePath(`/clients/${ticket.clientProfile.user_id}`))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:text-foreground transition-colors">
            <User className="h-3 w-3" /> {ticket.clientProfile.full_name ?? "Voir client"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Conversation */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original message */}
          {ticket.description && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-xs font-medium text-foreground">
                    {ticket.client_name ?? ticket.clientProfile?.full_name ?? "Client"}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-2">
                    {format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </span>
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {/* Replies timeline */}
          {replies.map((reply: any) => {
            const isAgent = reply.sender_role !== "client";
            return (
              <div key={reply.id} className={cn(
                "rounded-xl border p-4",
                isAgent ? "border-primary/20 bg-primary/5" : "border-border bg-card"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center",
                    isAgent ? "bg-primary/10" : "bg-secondary"
                  )}>
                    {isAgent ? <MessageSquare className="h-3.5 w-3.5 text-primary" /> : <User className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div>
                    <span className={cn("text-xs font-medium", isAgent ? "text-primary" : "text-foreground")}>
                      {reply.sender_name ?? (isAgent ? "Agent" : "Client")}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-2">
                      {reply.sender_role} · {format(new Date(reply.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{reply.content}</p>
              </div>
            );
          })}

          {/* Reply form */}
          {ticket.status !== "resolved" && (
            <div className="rounded-xl border border-border bg-card p-4">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Écrire une réponse…"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => replyText.trim() && replyMutation.mutate(replyText)}
                  disabled={replyMutation.isPending || !replyText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  {replyMutation.isPending ? "Envoi…" : "Envoyer"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Info panel */}
        <div className="space-y-4">
          {/* Client info */}
          {ticket.clientProfile && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Client</h3>
              <p className="text-sm font-medium text-foreground">{ticket.clientProfile.full_name}</p>
              {ticket.clientProfile.email && <p className="text-xs text-muted-foreground mt-0.5">{ticket.clientProfile.email}</p>}
              {ticket.clientProfile.phone && <p className="text-xs text-muted-foreground">{ticket.clientProfile.phone}</p>}
              <button
                onClick={() => navigate(employeePath(`/clients/${ticket.clientProfile.user_id}`))}
                className="text-[10px] text-primary hover:underline mt-2 inline-block"
              >
                Voir profil complet →
              </button>
            </div>
          )}

          {/* Ticket metadata */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Détails</h3>
            <div className="space-y-1.5 text-xs">
              <MetaRow label="Statut" value={ticket.status} />
              <MetaRow label="Priorité" value={ticket.priority ?? "normal"} />
              <MetaRow label="Catégorie" value={ticket.category ?? "—"} />
              <MetaRow label="Assigné à" value={ticket.assigned_to ?? "Non assigné"} />
              <MetaRow label="Créé le" value={format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: fr })} />
              {ticket.related_order_reference && (
                <MetaRow label="Commande" value={ticket.related_order_reference} />
              )}
              <MetaRow label="Réponses" value={String(replies.length)} />
            </div>
          </div>

          {/* Traceability */}
          <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground font-mono">
            <span>ticket: {ticket.id.slice(0, 8)}</span>
            {ticket.user_id && <span>· client: {ticket.user_id.slice(0, 8)}</span>}
            {ticket.related_order_id && <span>· order: {ticket.related_order_id.slice(0, 8)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
