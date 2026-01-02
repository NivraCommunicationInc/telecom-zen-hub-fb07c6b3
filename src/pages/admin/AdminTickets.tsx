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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
  Upload,
  Download,
  Eye,
  Image,
  Plus,
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
const categoryConfig: Record<string, { label: string; color: string; icon: any; requiresOrder?: boolean }> = {
  billing: { label: "Facturation", color: "bg-green-500/20 text-green-400", icon: FileText },
  installation: { label: "Installation", color: "bg-blue-500/20 text-blue-400", icon: UserCog },
  equipment: { label: "Équipement", color: "bg-purple-500/20 text-purple-400", icon: Tag },
  equipment_issue: { label: "Problème d'équipement", color: "bg-orange-500/20 text-orange-400", icon: Tag, requiresOrder: true },
  sim_issue: { label: "Problème de SIM", color: "bg-red-500/20 text-red-400", icon: Phone, requiresOrder: true },
  lost_stolen: { label: "Appareil perdu/volé", color: "bg-red-600/20 text-red-500", icon: AlertTriangle, requiresOrder: true },
  sim_lost: { label: "SIM/Téléphone perdu", color: "bg-red-500/20 text-red-400", icon: Phone },
  plan_pause: { label: "Pause de forfait", color: "bg-amber-500/20 text-amber-400", icon: Pause },
  number_change: { label: "Changement de numéro", color: "bg-cyan-500/20 text-cyan-400", icon: Hash },
  id_verification: { label: "Vérification d'identité", color: "bg-amber-500/20 text-amber-400", icon: Shield },
  general: { label: "Support général", color: "bg-muted text-muted-foreground", icon: MessageSquare },
  technical: { label: "Technique", color: "bg-indigo-500/20 text-indigo-400", icon: Shield },
};

const EQUIPMENT_CATEGORIES = ['equipment_issue', 'sim_issue', 'lost_stolen'];

// ID Verification status config
const idVerificationStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  not_received: { label: "Non reçu", color: "bg-slate-500/20 text-slate-400", icon: Clock },
  received: { label: "Reçu", color: "bg-amber-500/20 text-amber-500", icon: FileText },
  verified: { label: "Vérifié", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle2 },
  rejected: { label: "Refusé", color: "bg-red-500/20 text-red-500", icon: XCircle },
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    client_email: "",
    subject: "",
    description: "",
    priority: "normal",
    category: "general",
    requires_id_upload: false,
    related_order_id: "",
    issue_type: "",
  });
  const [selectedClientId, setSelectedClientId] = useState<string>("");

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

  // Fetch clients for email lookup
  const { data: clients } = useQuery({
    queryKey: ["admin-clients-for-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .order("full_name");
      if (error) throw error;
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

  // Fetch orders for selected client (for equipment/SIM tickets)
  const { data: clientOrders } = useQuery({
    queryKey: ["admin-client-orders-for-ticket", selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, service_type, order_type, created_at")
        .eq("user_id", selectedClientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClientId,
  });
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

  // Create ticket for client mutation
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: typeof newTicket) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Find client by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .eq("email", ticketData.client_email.toLowerCase())
        .single();

      if (!profile) throw new Error("Client non trouvé avec cet email");

      // Get related order reference if order is selected
      let relatedOrderReference = null;
      if (ticketData.related_order_id) {
        const { data: orderData } = await supabase
          .from("orders")
          .select("order_number")
          .eq("id", ticketData.related_order_id)
          .single();
        relatedOrderReference = orderData?.order_number || ticketData.related_order_id;
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: profile.user_id,
          client_email: profile.email,
          subject: ticketData.subject,
          description: ticketData.description,
          priority: ticketData.priority,
          category: ticketData.category,
          requires_id_upload: ticketData.requires_id_upload,
          id_verification_status: ticketData.requires_id_upload ? 'not_received' : null,
          created_by_user_id: user.id,
          created_by_role: 'admin',
          status: 'open',
          related_order_id: ticketData.related_order_id || null,
          related_order_reference: relatedOrderReference,
          issue_type: ticketData.issue_type || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      logActivity("create", "ticket", data.id, { subject: data.subject });
      toast({ 
        title: "Ticket créé", 
        description: "Le client verra ce ticket dans son portail" 
      });
      setCreateDialogOpen(false);
      setNewTicket({
        client_email: "",
        subject: "",
        description: "",
        priority: "normal",
        category: "general",
        requires_id_upload: false,
        related_order_id: "",
        issue_type: "",
      });
      setSelectedClientId("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de créer le ticket", 
        variant: "destructive" 
      });
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
                      {/* Related Order Reference */}
                      {selectedTicket.related_order_reference && (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-primary" />
                            <span className="text-sm">
                              Commande: <strong>{selectedTicket.related_order_reference}</strong>
                            </span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              // Open order in new tab
                              window.open(`/admin/orders`, '_blank');
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Voir commande
                          </Button>
                        </div>
                      )}

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

              {/* ID Documents Section - Only show if ticket requires ID upload */}
              {selectedTicket.requires_id_upload && (
                <Card className="bg-card border-amber-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-500" />
                      Documents d'identité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Status */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Statut de vérification</Label>
                      <Select
                        value={selectedTicket.id_verification_status || "not_received"}
                        onValueChange={(v) => {
                          setSelectedTicket({ ...selectedTicket, id_verification_status: v });
                          updateTicketMutation.mutate({ ticketId: selectedTicket.id, id_verification_status: v });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(idVerificationStatusConfig).map(([key, { label, icon: Icon }]) => (
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

                    {/* Uploaded Files */}
                    {((selectedTicket.id_files as any[]) || []).length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Fichiers téléversés</Label>
                        {((selectedTicket.id_files as any[]) || []).map((file: any, index: number) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-accent/50 rounded text-sm">
                            {file.mime?.startsWith('image/') ? (
                              <Image className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <FileText className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className="flex-1 truncate text-xs">{file.filename}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={async () => {
                                // Get signed URL for private bucket
                                const { data } = await supabase.storage
                                  .from("ticket-id-uploads")
                                  .createSignedUrl(file.url, 300); // 5 min expiry
                                if (data?.signedUrl) {
                                  window.open(data.signedUrl, '_blank');
                                }
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={async () => {
                                const { data } = await supabase.storage
                                  .from("ticket-id-uploads")
                                  .createSignedUrl(file.url, 300);
                                if (data?.signedUrl) {
                                  const link = document.createElement('a');
                                  link.href = data.signedUrl;
                                  link.download = file.filename;
                                  link.click();
                                }
                              }}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-accent/30 rounded text-center">
                        <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">
                          En attente du téléversement par le client
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Créer un ticket pour un client</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-1">
                  <div>
                    <Label>Email du client *</Label>
                    <Input
                      type="email"
                      placeholder="client@exemple.com"
                      value={newTicket.client_email}
                      onChange={(e) => {
                        setNewTicket({ ...newTicket, client_email: e.target.value, related_order_id: "" });
                        // Find client by email for order lookup
                        const client = (clients || []).find((c: any) => 
                          c.email?.toLowerCase() === e.target.value.toLowerCase()
                        );
                        setSelectedClientId(client?.user_id || "");
                      }}
                    />
                  </div>
                  <div>
                    <Label>Sujet *</Label>
                    <Input
                      placeholder="Sujet du ticket"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                          {Object.entries(priorityConfig).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Catégorie</Label>
                      <Select
                        value={newTicket.category}
                        onValueChange={(v) => setNewTicket({ 
                          ...newTicket, 
                          category: v, 
                          related_order_id: "",
                          issue_type: "",
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(categoryConfig).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Related Order Selection - for equipment/SIM categories */}
                  {EQUIPMENT_CATEGORIES.includes(newTicket.category) && (
                    <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-orange-500 text-sm font-medium">
                        <Tag className="w-4 h-4" />
                        Commande concernée (obligatoire)
                      </div>
                      {selectedClientId && clientOrders && clientOrders.length > 0 ? (
                        <Select
                          value={newTicket.related_order_id}
                          onValueChange={(v) => setNewTicket({ ...newTicket, related_order_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez la commande" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientOrders.map((order: any) => (
                              <SelectItem key={order.id} value={order.id}>
                                {order.order_number || order.id.slice(0, 8)} - {order.service_type}
                                {order.order_type === "equipment" && " (Équipement)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : selectedClientId ? (
                        <p className="text-sm text-muted-foreground">
                          Aucune commande trouvée pour ce client
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Entrez l'email du client pour voir ses commandes
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label>Message *</Label>
                    <Textarea
                      placeholder="Description du ticket..."
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                      rows={4}
                    />
                  </div>
                  
                  {/* ID Upload Toggle */}
                  <div className="flex items-center justify-between p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-foreground">Demande de pièce d'identité</p>
                        <p className="text-xs text-muted-foreground">
                          Le client pourra téléverser ses documents d'identité
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={newTicket.requires_id_upload}
                      onCheckedChange={(checked) => setNewTicket({ ...newTicket, requires_id_upload: checked })}
                    />
                  </div>

                  <Button
                    className="w-full"
                    variant="hero"
                    onClick={() => createTicketMutation.mutate(newTicket)}
                    disabled={
                      !newTicket.client_email || 
                      !newTicket.subject || 
                      !newTicket.description || 
                      (EQUIPMENT_CATEGORIES.includes(newTicket.category) && !newTicket.related_order_id) ||
                      createTicketMutation.isPending
                    }
                  >
                    {createTicketMutation.isPending ? "Création..." : "Créer le ticket"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
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
