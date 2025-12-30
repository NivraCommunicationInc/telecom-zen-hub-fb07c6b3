import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Plus, Send, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const ClientTickets = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newTicket, setNewTicket] = useState({ subject: "", description: "", priority: "normal" });
  const [replyContent, setReplyContent] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["client-tickets-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: replies } = useQuery({
    queryKey: ["ticket-replies", selectedTicket?.id],
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

  const createTicketMutation = useMutation({
    mutationFn: async (ticket: typeof newTicket) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          subject: ticket.subject,
          description: ticket.description,
          priority: ticket.priority,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-tickets-all"] });
      toast({ title: "Ticket créé avec succès" });
      setCreateDialogOpen(false);
      setNewTicket({ subject: "", description: "", priority: "normal" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création du ticket", variant: "destructive" });
    },
  });

  const addReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from("ticket_replies")
        .insert({
          ticket_id: selectedTicket?.id,
          user_id: user?.id,
          content,
          is_admin: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-replies"] });
      toast({ title: "Réponse envoyée" });
      setReplyContent("");
    },
    onError: () => {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    },
  });

  const statusColors: Record<string, string> = {
    open: "bg-cyan-500/20 text-cyan-500",
    in_progress: "bg-amber-500/20 text-amber-500",
    closed: "bg-muted text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    open: "Ouvert",
    in_progress: "En cours",
    closed: "Fermé",
  };

  const priorityLabels: Record<string, string> = {
    low: "Faible",
    normal: "Normal",
    high: "Urgent",
  };

  if (selectedTicket) {
    return (
      <ClientLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setSelectedTicket(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux tickets
          </Button>

          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedTicket.subject}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Créé le {format(new Date(selectedTicket.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
                <Badge className={statusColors[selectedTicket.status] || "bg-muted"}>
                  {statusLabels[selectedTicket.status] || selectedTicket.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Original Description */}
              <div className="p-4 bg-accent/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Description initiale</p>
                <p className="text-foreground">{selectedTicket.description}</p>
              </div>

              {/* Replies */}
              <div className="space-y-4">
                {replies?.map((reply: any) => (
                  <div
                    key={reply.id}
                    className={`p-4 rounded-lg ${
                      reply.is_admin ? "bg-cyan-500/10 ml-4" : "bg-accent/50 mr-4"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">
                        {reply.is_admin ? "Support Nivra" : "Vous"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(reply.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <p className="text-foreground">{reply.content}</p>
                  </div>
                ))}
              </div>

              {/* Reply Form */}
              {selectedTicket.status !== "closed" && (
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Écrivez votre réponse..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="hero"
                    onClick={() => addReplyMutation.mutate(replyContent)}
                    disabled={!replyContent.trim() || addReplyMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Support</h1>
            <p className="text-muted-foreground mt-1">Gérez vos demandes de support</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un ticket de support</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Sujet</Label>
                  <Input
                    placeholder="Décrivez brièvement votre problème"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Priorité</Label>
                  <Select
                    value={newTicket.priority}
                    onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Faible</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Décrivez votre problème en détail..."
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    rows={5}
                  />
                </div>
                <Button
                  className="w-full"
                  variant="hero"
                  onClick={() => createTicketMutation.mutate(newTicket)}
                  disabled={!newTicket.subject || !newTicket.description || createTicketMutation.isPending}
                >
                  Créer le ticket
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              Mes tickets
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
              <div className="space-y-4">
                {tickets.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/50 rounded-lg cursor-pointer hover:bg-accent/70 transition-colors"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-foreground">{ticket.subject}</h3>
                        <Badge className={statusColors[ticket.status] || "bg-muted"}>
                          {statusLabels[ticket.status] || ticket.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {ticket.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(ticket.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <Badge variant="outline">{priorityLabels[ticket.priority] || ticket.priority}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Aucun ticket de support</p>
                <Button variant="hero" onClick={() => setCreateDialogOpen(true)}>
                  Créer un ticket
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientTickets;