import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MoreVertical,
  Tag,
  UserCog,
  FileText,
  Phone,
  Mail,
  Calendar,
  Hash,
  RefreshCcw,
  Star,
  AlertCircle,
  Pause,
  Shield,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";

// Extended status options
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "bg-slate-500/20 text-slate-400", icon: Clock },
  open: { label: "Ouvert", color: "bg-cyan-500/20 text-cyan-400", icon: MessageSquare },
  in_progress: { label: "En cours", color: "bg-amber-500/20 text-amber-500", icon: RefreshCcw },
  on_hold: { label: "En pause", color: "bg-purple-500/20 text-purple-400", icon: Pause },
  resolved: { label: "Résolu", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle2 },
  closed: { label: "Fermé", color: "bg-muted text-muted-foreground", icon: XCircle },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-400", icon: XCircle },
};

// Priority levels with VIP
const priorityConfig: Record<string, { label: string; color: string; icon: any }> = {
  low: { label: "Basse", color: "bg-slate-500/20 text-slate-400", icon: Flag },
  normal: { label: "Normale", color: "bg-blue-500/20 text-blue-500", icon: Flag },
  medium: { label: "Moyenne", color: "bg-yellow-500/20 text-yellow-500", icon: Flag },
  high: { label: "Haute", color: "bg-orange-500/20 text-orange-500", icon: AlertTriangle },
  urgent: { label: "Urgente", color: "bg-red-500/20 text-red-500", icon: AlertCircle },
  vip: { label: "VIP", color: "bg-gradient-to-r from-amber-400/30 to-yellow-500/30 text-amber-400", icon: Star },
};

// Category tags
const categoryConfig: Record<string, { label: string; color: string; icon: any }> = {
  billing: { label: "Facturation", color: "bg-green-500/20 text-green-400", icon: FileText },
  installation: { label: "Installation", color: "bg-blue-500/20 text-blue-400", icon: UserCog },
  equipment: { label: "Équipement", color: "bg-purple-500/20 text-purple-400", icon: Tag },
  sim_lost: { label: "SIM/Téléphone perdu", color: "bg-red-500/20 text-red-400", icon: Phone },
  plan_pause: { label: "Pause de forfait", color: "bg-amber-500/20 text-amber-400", icon: Pause },
  number_change: { label: "Changement de numéro", color: "bg-cyan-500/20 text-cyan-400", icon: Hash },
  general: { label: "Support général", color: "bg-muted text-muted-foreground", icon: MessageSquare },
  technical: { label: "Technique", color: "bg-indigo-500/20 text-indigo-400", icon: Shield },
};

// Assignment roles
const assignmentRoles = [
  { value: "admin", label: "Admin" },
  { value: "employee", label: "Employé" },
  { value: "technician", label: "Technicien" },
];

const AdminTickets = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  
  // State
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyContent, setReplyContent] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("conversation");

  // Fetch all support tickets with client info
  const { data: tickets, isLoading, refetch } = useQuery({
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

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    
    return tickets.filter((ticket: any) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          ticket.ticket_number?.toLowerCase().includes(query) ||
          ticket.subject?.toLowerCase().includes(query) ||
          ticket.description?.toLowerCase().includes(query) ||
          ticket.profile?.full_name?.toLowerCase().includes(query) ||
          ticket.profile?.email?.toLowerCase().includes(query) ||
          ticket.profile?.phone?.toLowerCase().includes(query) ||
          ticket.profile?.client_number?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      
      // Priority filter
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
      
      // Category filter - check if ticket has category field
      if (categoryFilter !== "all") {
        const ticketCategory = ticket.category || "general";
        if (ticketCategory !== categoryFilter) return false;
      }
      
      return true;
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter, categoryFilter]);

  // Stats by status
  const stats = useMemo(() => {
    if (!tickets) return {};
    const counts: Record<string, number> = {};
    Object.keys(statusConfig).forEach(status => {
      counts[status] = tickets.filter((t: any) => t.status === status).length;
    });
    return counts;
  }, [tickets]);

  // Update ticket mutation
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
      // Update local state immediately
      if (selectedTicket?.id === data.ticketId) {
        setSelectedTicket((prev: any) => ({ ...prev, ...data }));
      }
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      logActivity("update", "ticket", data.ticketId, data);
      toast({ title: "Ticket mis à jour", description: "Les modifications ont été enregistrées" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le ticket", variant: "destructive" });
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

      // Update ticket status to in_progress if it was open or pending
      if (["open", "pending"].includes(selectedTicket?.status)) {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", selectedTicket.id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-replies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      logActivity("reply", "ticket", selectedTicket?.id);
      toast({ title: "Réponse envoyée", description: "Le client recevra une notification" });
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

  const handleQuickStatusChange = (ticketId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTicketMutation.mutate({ ticketId, status: newStatus });
  };

  // Ticket Detail View
  if (selectedTicket) {
    const StatusIcon = statusConfig[selectedTicket.status]?.icon || MessageSquare;
    const PriorityIcon = priorityConfig[selectedTicket.priority]?.icon || Flag;
    const CategoryIcon = categoryConfig[selectedTicket.category || "general"]?.icon || Tag;

    return (
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedTicket(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux tickets
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {selectedTicket.ticket_number || `#${selectedTicket.id.slice(0, 8)}`}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
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

                    <TabsContent value="conversation" className="mt-4 space-y-4">
                      {/* Original Message */}
                      <div className="p-4 bg-accent/50 rounded-lg border-l-4 border-cyan-500">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {selectedTicket.profile?.full_name || "Client"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(selectedTicket.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                          </span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                      </div>

                      {/* Replies */}
                      <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-3">
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
                                    ? "bg-cyan-500/10 border-l-4 border-cyan-500 ml-8"
                                    : "bg-accent/50 border-l-4 border-muted mr-8"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-sm font-medium ${reply.is_admin ? "text-cyan-400" : ""}`}>
                                    {reply.is_admin ? "Support Nivra" : "Client"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(reply.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                                  </span>
                                </div>
                                <p className="text-foreground whitespace-pre-wrap">{reply.content}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground italic text-center py-8">
                              Aucune réponse pour le moment
                            </p>
                          )}
                        </div>
                      </ScrollArea>

                      {/* Reply Form */}
                      {!["closed", "cancelled"].includes(selectedTicket.status) ? (
                        <div className="space-y-3 pt-4 border-t border-border">
                          <Label>Répondre au client</Label>
                          <Textarea
                            placeholder="Tapez votre réponse..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            rows={4}
                            className="resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                addReplyMutation.mutate(replyContent);
                                updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: "resolved" });
                              }}
                              disabled={!replyContent.trim() || addReplyMutation.isPending}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Répondre et Résoudre
                            </Button>
                            <Button
                              variant="hero"
                              onClick={() => addReplyMutation.mutate(replyContent)}
                              disabled={!replyContent.trim() || addReplyMutation.isPending}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Envoyer
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <p className="text-muted-foreground">Ce ticket est {selectedTicket.status === "closed" ? "fermé" : "annulé"}.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: "open" })}
                          >
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            Réouvrir le ticket
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="details" className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Numéro de ticket</Label>
                          <p className="font-mono">{selectedTicket.ticket_number || `#${selectedTicket.id.slice(0, 8)}`}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Date de création</Label>
                          <p>{format(new Date(selectedTicket.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Dernière mise à jour</Label>
                          <p>{format(new Date(selectedTicket.updated_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Catégorie</Label>
                          <Badge className={categoryConfig[selectedTicket.category || "general"]?.color}>
                            {categoryConfig[selectedTicket.category || "general"]?.label}
                          </Badge>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="notes" className="mt-4 space-y-4">
                      <div className="space-y-3">
                        <Label>Notes internes (visibles uniquement par l'équipe)</Label>
                        <Textarea
                          placeholder="Ajoutez des notes internes..."
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          rows={6}
                          className="resize-none"
                        />
                        <Button
                          variant="outline"
                          onClick={() => updateTicketMutation.mutate({ 
                            ticketId: selectedTicket.id, 
                            internal_notes: internalNotes 
                          })}
                          disabled={updateTicketMutation.isPending}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Sauvegarder les notes
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Client Info Card */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Informations client
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedTicket.profile?.full_name || "Non renseigné"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedTicket.profile?.email || selectedTicket.client_email || "Non renseigné"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedTicket.profile?.phone || "Non renseigné"}</span>
                  </div>
                  {selectedTicket.profile?.client_number && (
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono">{selectedTicket.profile.client_number}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ticket Controls Card */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserCog className="w-4 h-4" />
                    Gestion du ticket
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Statut</Label>
                    <Select
                      value={selectedTicket.status}
                      onValueChange={(v) => {
                        setSelectedTicket({ ...selectedTicket, status: v });
                        updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: v });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([key, { label, icon: Icon }]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Priorité</Label>
                    <Select
                      value={selectedTicket.priority}
                      onValueChange={(v) => {
                        setSelectedTicket({ ...selectedTicket, priority: v });
                        updateTicketMutation.mutate({ ticketId: selectedTicket.id, priority: v });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(priorityConfig).map(([key, { label, icon: Icon }]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Catégorie</Label>
                    <Select
                      value={selectedTicket.category || "general"}
                      onValueChange={(v) => {
                        setSelectedTicket({ ...selectedTicket, category: v });
                        updateTicketMutation.mutate({ ticketId: selectedTicket.id, category: v });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryConfig).map(([key, { label, icon: Icon }]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Quick Actions */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Actions rapides</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: "resolved" })}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Résoudre
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: "closed" })}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Fermer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Ticket List View
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Tickets de support</h1>
            <p className="text-muted-foreground mt-1">Gérer les demandes de support client</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(statusConfig).map(([status, { label, color, icon: Icon }]) => (
            <Card 
              key={status} 
              className={`bg-card border-border cursor-pointer hover:border-cyan-400/30 transition-colors ${statusFilter === status ? 'border-cyan-400' : ''}`}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stats[status] || 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro, nom, email, téléphone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    {Object.entries(statusConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Flag className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Priorité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes priorités</SelectItem>
                    {Object.entries(priorityConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Tag className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    {Object.entries(categoryConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              Tickets ({filteredTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredTickets.length > 0 ? (
              <div className="space-y-3">
                {filteredTickets.map((ticket: any) => {
                  const StatusIcon = statusConfig[ticket.status]?.icon || MessageSquare;
                  const priorityInfo = priorityConfig[ticket.priority] || priorityConfig.normal;
                  const categoryInfo = categoryConfig[ticket.category || "general"];

                  return (
                    <div
                      key={ticket.id}
                      className="p-4 rounded-lg border border-border hover:border-cyan-400/30 transition-colors cursor-pointer group"
                      onClick={() => handleSelectTicket(ticket)}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Header row */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">
                              {ticket.ticket_number || `#${ticket.id.slice(0, 8)}`}
                            </Badge>
                            <Badge className={statusConfig[ticket.status]?.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig[ticket.status]?.label}
                            </Badge>
                            {ticket.priority && ticket.priority !== "normal" && (
                              <Badge className={priorityInfo.color}>
                                <priorityInfo.icon className="w-3 h-3 mr-1" />
                                {priorityInfo.label}
                              </Badge>
                            )}
                            {categoryInfo && (
                              <Badge className={categoryInfo.color}>
                                <categoryInfo.icon className="w-3 h-3 mr-1" />
                                {categoryInfo.label}
                              </Badge>
                            )}
                          </div>

                          {/* Subject */}
                          <h3 className="font-medium text-foreground truncate mb-1">{ticket.subject}</h3>

                          {/* Description preview */}
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {ticket.description}
                          </p>

                          {/* Footer */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{ticket.profile?.full_name || ticket.profile?.email || "Client"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{format(new Date(ticket.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions rapides</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => handleQuickStatusChange(ticket.id, "in_progress", e as any)}>
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                Marquer en cours
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleQuickStatusChange(ticket.id, "resolved", e as any)}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Marquer résolu
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleQuickStatusChange(ticket.id, "closed", e as any)}>
                                <XCircle className="w-4 h-4 mr-2" />
                                Fermer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => handleQuickStatusChange(ticket.id, "on_hold", e as any)}>
                                <Pause className="w-4 h-4 mr-2" />
                                Mettre en pause
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button size="sm" variant="outline">
                            Ouvrir
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all"
                    ? "Aucun ticket ne correspond aux filtres"
                    : "Aucun ticket de support"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminTickets;
