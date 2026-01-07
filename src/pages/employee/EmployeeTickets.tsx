import { useState, useMemo } from "react";
import EmployeeLayout from "@/components/employee/EmployeeLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Flag,
  User,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCcw,
  Pause,
  Mail,
  Phone,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "bg-slate-500/20 text-slate-400", icon: Clock },
  open: { label: "Ouvert", color: "bg-cyan-500/20 text-cyan-400", icon: MessageSquare },
  in_progress: { label: "En cours", color: "bg-amber-500/20 text-amber-500", icon: RefreshCcw },
  on_hold: { label: "En pause", color: "bg-purple-500/20 text-purple-400", icon: Pause },
  resolved: { label: "Résolu", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle2 },
  closed: { label: "Fermé", color: "bg-muted text-muted-foreground", icon: XCircle },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-400", icon: XCircle },
};

const priorityConfig: Record<string, { label: string; color: string; icon: any }> = {
  low: { label: "Basse", color: "bg-slate-500/20 text-slate-400", icon: Flag },
  normal: { label: "Normale", color: "bg-blue-500/20 text-blue-500", icon: Flag },
  medium: { label: "Moyenne", color: "bg-yellow-500/20 text-yellow-500", icon: Flag },
  high: { label: "Haute", color: "bg-orange-500/20 text-orange-500", icon: AlertTriangle },
  urgent: { label: "Urgente", color: "bg-red-500/20 text-red-500", icon: AlertTriangle },
};

const EmployeeTickets = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyContent, setReplyContent] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("conversation");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["employee-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((t: any) => t.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone, client_number")
          .in("user_id", userIds);

        return data.map((ticket: any) => ({
          ...ticket,
          profile: profiles?.find((p: any) => p.user_id === ticket.user_id) || null,
        }));
      }

      return data || [];
    },
  });

  const { data: replies, isLoading: repliesLoading } = useQuery({
    queryKey: ["employee-ticket-replies", selectedTicket?.id],
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

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    
    return tickets.filter((ticket: any) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          ticket.ticket_number?.toLowerCase().includes(query) ||
          ticket.subject?.toLowerCase().includes(query) ||
          ticket.profile?.full_name?.toLowerCase().includes(query) ||
          ticket.profile?.email?.toLowerCase().includes(query) ||
          ticket.profile?.client_number?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
      
      return true;
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    if (!tickets) return {};
    const counts: Record<string, number> = {};
    Object.keys(statusConfig).forEach(status => {
      counts[status] = tickets.filter((t: any) => t.status === status).length;
    });
    return counts;
  }, [tickets]);

  const updateTicketMutation = useMutation({
    mutationFn: async (updates: { ticketId: string; [key: string]: any }) => {
      const { ticketId, ...updateData } = updates;
      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;
      return { ticketId, ...updateData };
    },
    onSuccess: (data) => {
      if (selectedTicket?.id === data.ticketId) {
        setSelectedTicket((prev: any) => ({ ...prev, ...data }));
      }
      queryClient.invalidateQueries({ queryKey: ["employee-tickets"] });
      logActivity("update", "ticket", data.ticketId, data);
      toast({ title: "Ticket mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le ticket", variant: "destructive" });
    },
  });

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

      if (["open", "pending"].includes(selectedTicket?.status)) {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", selectedTicket.id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-ticket-replies"] });
      queryClient.invalidateQueries({ queryKey: ["employee-tickets"] });
      logActivity("reply", "ticket", selectedTicket?.id);
      toast({ title: "Réponse envoyée" });
      setReplyContent("");
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'envoyer la réponse", variant: "destructive" });
    },
  });

  const handleSelectTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setReplyContent("");
    setInternalNotes(ticket.internal_notes || "");
    setActiveTab("conversation");
  };

  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    addReplyMutation.mutate(replyContent);
  };

  const handleSaveNotes = () => {
    updateTicketMutation.mutate({
      ticketId: selectedTicket.id,
      internal_notes: internalNotes,
    });
  };

  // Detail View
  if (selectedTicket) {
    const StatusIcon = statusConfig[selectedTicket.status]?.icon || MessageSquare;
    const PriorityIcon = priorityConfig[selectedTicket.priority]?.icon || Flag;

    return (
      <EmployeeLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedTicket(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux tickets
            </Button>
            <Badge variant="outline" className="font-mono">
              {selectedTicket.ticket_number || `#${selectedTicket.id.slice(0, 8)}`}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <StatusIcon className="w-5 h-5" />
                    {selectedTicket.subject}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Créé le {format(new Date(selectedTicket.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="conversation">Conversation</TabsTrigger>
                      <TabsTrigger value="details">Détails</TabsTrigger>
                      <TabsTrigger value="notes">Notes internes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="conversation" className="space-y-4 pt-4">
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                          {/* Original Message */}
                          <div className="p-4 bg-accent/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="w-4 h-4" />
                              <span className="font-medium text-sm">
                                {selectedTicket.profile?.full_name || "Client"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(selectedTicket.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                              </span>
                            </div>
                            <p className="text-sm">{selectedTicket.description}</p>
                          </div>

                          {/* Replies */}
                          {repliesLoading ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            replies?.map((reply: any) => (
                              <div
                                key={reply.id}
                                className={`p-4 rounded-lg ${reply.is_admin ? 'bg-primary/10 ml-8' : 'bg-accent/50 mr-8'}`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <User className="w-4 h-4" />
                                  <span className="font-medium text-sm">
                                    {reply.is_admin ? "Support Nivra" : selectedTicket.profile?.full_name || "Client"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(reply.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>

                      {/* Reply Input */}
                      <div className="space-y-2">
                        <Textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder="Écrivez votre réponse..."
                          rows={4}
                        />
                        <Button 
                          onClick={handleSendReply} 
                          disabled={!replyContent.trim() || addReplyMutation.isPending}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Envoyer
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="details" className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">Statut</Label>
                          <Select 
                            value={selectedTicket.status} 
                            onValueChange={(value) => updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([status, config]) => (
                                <SelectItem key={status} value={status}>{config.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Priorité</Label>
                          <Select 
                            value={selectedTicket.priority} 
                            onValueChange={(value) => updateTicketMutation.mutate({ ticketId: selectedTicket.id, priority: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(priorityConfig).map(([priority, config]) => (
                                <SelectItem key={priority} value={priority}>{config.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <Label className="text-muted-foreground text-xs">Description initiale</Label>
                        <p className="mt-1 text-sm p-3 bg-accent/50 rounded-lg">
                          {selectedTicket.description}
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="notes" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Notes internes (non visibles par le client)</Label>
                        <Textarea
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          placeholder="Notes internes..."
                          rows={8}
                        />
                        <Button onClick={handleSaveNotes} disabled={updateTicketMutation.isPending}>
                          Sauvegarder les notes
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Client Info Sidebar */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Informations client
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">Nom</Label>
                    <p className="font-medium">{selectedTicket.profile?.full_name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {selectedTicket.profile?.email || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Téléphone</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {selectedTicket.profile?.phone || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">No. Client</Label>
                    <p className="font-mono text-sm">{selectedTicket.profile?.client_number || "-"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Status Quick Actions */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Actions rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: "in_progress" })}
                    disabled={selectedTicket.status === "in_progress" || updateTicketMutation.isPending}
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    En cours
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                    onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: "resolved" })}
                    disabled={selectedTicket.status === "resolved" || updateTicketMutation.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Résolu
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: "closed" })}
                    disabled={selectedTicket.status === "closed" || updateTicketMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Fermé
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </EmployeeLayout>
    );
  }

  // List View
  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tickets de support</h1>
            <p className="text-muted-foreground">Gestion des demandes clients</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(statusConfig).map(([status, config]) => (
            <Card 
              key={status} 
              className={`cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <config.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats[status] || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{config.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro, sujet, client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <SelectItem key={status} value={status}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Priorité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes priorités</SelectItem>
                  {Object.entries(priorityConfig).map(([priority, config]) => (
                    <SelectItem key={priority} value={priority}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">
                Aucun ticket trouvé
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTickets.map((ticket: any) => {
                  const statusInfo = statusConfig[ticket.status] || statusConfig.open;
                  const priorityInfo = priorityConfig[ticket.priority] || priorityConfig.normal;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{ticket.subject}</p>
                            <Badge className={priorityInfo.color} variant="outline">
                              {priorityInfo.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {ticket.ticket_number || `#${ticket.id.slice(0, 8)}`}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {ticket.profile?.full_name || "Client inconnu"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                          </p>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  );
};

export default EmployeeTickets;
