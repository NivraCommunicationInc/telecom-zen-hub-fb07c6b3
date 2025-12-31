import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Send, ArrowLeft, Flag, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";

const statusColors: Record<string, string> = {
  open: "bg-cyan-500/20 text-cyan-400",
  in_progress: "bg-amber-500/20 text-amber-500",
  resolved: "bg-emerald-500/20 text-emerald-500",
  closed: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Fermé",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/20 text-blue-500",
  high: "bg-orange-500/20 text-orange-500",
  urgent: "bg-red-500/20 text-red-500",
};

const priorityLabels: Record<string, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

const AdminTickets = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyContent, setReplyContent] = useState("");

  // Fetch all support tickets with client info
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for tickets
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((t: any) => t.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds);

        return data.map((ticket: any) => ({
          ...ticket,
          profile: profiles?.find((p: any) => p.user_id === ticket.user_id) || null,
        }));
      }

      return data || [];
    },
  });

  // Fetch replies for selected ticket
  const { data: replies, isLoading: repliesLoading } = useQuery({
    queryKey: ["admin-ticket-replies", selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", selectedTicket?.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedTicket?.id,
  });

  // Update ticket status
  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, status, priority }: { ticketId: string; status?: string; priority?: string }) => {
      const updateData: any = {};
      if (status) updateData.status = status;
      if (priority) updateData.priority = priority;

      const { error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      logActivity("update", "ticket", selectedTicket?.id, { status: selectedTicket?.status });
      toast({ title: "Ticket mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  // Add admin reply
  const addReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("ticket_replies")
        .insert({
          ticket_id: selectedTicket?.id,
          user_id: user.id,
          content,
          is_admin: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Update ticket status to in_progress if it was open
      if (selectedTicket?.status === "open") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress" })
          .eq("id", selectedTicket.id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-replies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      logActivity("reply", "ticket", selectedTicket?.id);
      toast({ title: "Réponse envoyée" });
      setReplyContent("");
    },
    onError: () => {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    },
  });

  const handleSelectTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setReplyContent("");
  };

  if (selectedTicket) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setSelectedTicket(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux tickets
          </Button>

          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-xl">{selectedTicket.subject}</CardTitle>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>{selectedTicket.profile?.full_name || selectedTicket.profile?.email || "Client inconnu"}</span>
                    <span>•</span>
                    <span>{format(new Date(selectedTicket.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedTicket.priority}
                    onValueChange={(v) => {
                      setSelectedTicket({ ...selectedTicket, priority: v });
                      updateTicketMutation.mutate({ ticketId: selectedTicket.id, priority: v });
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Basse</SelectItem>
                      <SelectItem value="normal">Normale</SelectItem>
                      <SelectItem value="high">Haute</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(v) => {
                      setSelectedTicket({ ...selectedTicket, status: v });
                      updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: v });
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Ouvert</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="resolved">Résolu</SelectItem>
                      <SelectItem value="closed">Fermé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Original Description */}
              <div className="p-4 bg-accent/50 rounded-lg border-l-4 border-cyan-500">
                <p className="text-sm text-muted-foreground mb-2">Message initial du client</p>
                <p className="text-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Replies */}
              <div className="space-y-4">
                <Label className="text-muted-foreground">Historique des échanges</Label>
                {repliesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : replies && replies.length > 0 ? (
                  replies.map((reply: any) => (
                    <div
                      key={reply.id}
                      className={`p-4 rounded-lg ${
                        reply.is_admin
                          ? "bg-cyan-500/10 border-l-4 border-cyan-500 ml-4"
                          : "bg-accent/50 border-l-4 border-muted mr-4"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${reply.is_admin ? "text-cyan-400" : "text-foreground"}`}>
                          {reply.is_admin ? "Support Nivra (Admin)" : "Client"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(reply.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aucune réponse pour le moment</p>
                )}
              </div>

              {/* Reply Form */}
              {selectedTicket.status !== "closed" && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <Label>Répondre au client</Label>
                  <Textarea
                    placeholder="Tapez votre réponse..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="hero"
                      onClick={() => addReplyMutation.mutate(replyContent)}
                      disabled={!replyContent.trim() || addReplyMutation.isPending}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer la réponse
                    </Button>
                  </div>
                </div>
              )}

              {selectedTicket.status === "closed" && (
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-muted-foreground">Ce ticket est fermé. Vous ne pouvez plus y répondre.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Tickets de support</h1>
          <p className="text-muted-foreground mt-1">Gérer les demandes de support client</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {["open", "in_progress", "resolved", "closed"].map((status) => (
            <Card key={status} className="bg-card border-border">
              <CardContent className="p-4">
                <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {tickets?.filter((t: any) => t.status === status).length || 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              Liste des tickets ({tickets?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : tickets && tickets.length > 0 ? (
              <div className="space-y-3">
                {tickets.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-lg border border-border hover:border-cyan-400/30 transition-colors cursor-pointer"
                    onClick={() => handleSelectTicket(ticket)}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-medium text-foreground">{ticket.subject}</h3>
                          <Badge className={statusColors[ticket.status] || "bg-muted"}>
                            {statusLabels[ticket.status] || ticket.status}
                          </Badge>
                          {ticket.priority && ticket.priority !== "normal" && (
                            <Badge className={priorityColors[ticket.priority]}>
                              <Flag className="w-3 h-3 mr-1" />
                              {priorityLabels[ticket.priority]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>{ticket.profile?.full_name || ticket.profile?.email || "Client"}</span>
                          <span>•</span>
                          <span>{format(new Date(ticket.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        Voir / Répondre
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun ticket de support</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminTickets;
