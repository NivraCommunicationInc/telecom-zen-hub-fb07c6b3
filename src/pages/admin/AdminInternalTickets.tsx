import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  Circle,
  Filter,
} from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AIImproveButton } from "@/components/tickets/AIImproveButton";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Ouvert", color: "bg-blue-500/20 text-blue-600", icon: Circle },
  in_progress: { label: "En cours", color: "bg-amber-500/20 text-amber-600", icon: Clock },
  pending: { label: "En attente", color: "bg-purple-500/20 text-purple-600", icon: AlertTriangle },
  resolved: { label: "Résolu", color: "bg-emerald-500/20 text-emerald-600", icon: CheckCircle },
  closed: { label: "Fermé", color: "bg-gray-500/20 text-gray-600", icon: CheckCircle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Basse", color: "bg-gray-500/20 text-gray-600" },
  normal: { label: "Normale", color: "bg-blue-500/20 text-blue-600" },
  high: { label: "Haute", color: "bg-orange-500/20 text-orange-600" },
  urgent: { label: "Urgente", color: "bg-red-500/20 text-red-600" },
};

const categoryOptions = [
  { value: "general", label: "Général" },
  { value: "technical", label: "Technique" },
  { value: "billing", label: "Facturation" },
  { value: "scheduling", label: "Planification" },
  { value: "equipment", label: "Équipement" },
  { value: "client_issue", label: "Problème client" },
  { value: "urgent", label: "Urgent" },
];

const AdminInternalTickets = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  
  // Create ticket dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    category: "general",
    priority: "normal",
    assigned_to_department: "all",
    cc_departments: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View ticket dialog
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [newReply, setNewReply] = useState("");
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setUserProfile(data);
    };
    fetchProfile();
  }, [user]);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("internal_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Erreur de chargement", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchReplies = async (ticketId: string) => {
    setIsLoadingReplies(true);
    try {
      const { data, error } = await supabase
        .from("internal_ticket_replies")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setReplies(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!user || !newTicket.subject || !newTicket.description) {
      toast({ title: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("internal_tickets").insert({
        created_by_id: user.id,
        created_by_name: userProfile?.full_name || user.email,
        created_by_role: "admin",
        created_by_email: user.email,
        subject: newTicket.subject,
        description: newTicket.description,
        category: newTicket.category,
        priority: newTicket.priority,
        assigned_to_department: newTicket.assigned_to_department,
        cc_departments: newTicket.cc_departments,
      });
      if (error) throw error;
      toast({ title: "Ticket créé avec succès" });
      setShowCreateDialog(false);
      setNewTicket({ subject: "", description: "", category: "general", priority: "normal", assigned_to_department: "all", cc_departments: [] });
      fetchTickets();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !newReply.trim() || !user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("internal_ticket_replies").insert({
        ticket_id: selectedTicket.id,
        author_id: user.id,
        author_name: userProfile?.full_name || user.email,
        author_role: "admin",
        author_email: user.email,
        content: newReply,
      });
      if (error) throw error;
      setNewReply("");
      fetchReplies(selectedTicket.id);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === "resolved" || newStatus === "closed") {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by_id = user?.id;
        updates.resolved_by_name = userProfile?.full_name || user?.email;
      }
      const { error } = await supabase.from("internal_tickets").update(updates).eq("id", ticketId);
      if (error) throw error;
      toast({ title: "Statut mis à jour" });
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus, ...updates });
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const openTicketDetails = (ticket: any) => {
    setSelectedTicket(ticket);
    fetchReplies(ticket.id);
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !search ||
      ticket.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.subject?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.created_by_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesDept = departmentFilter === "all" || ticket.assigned_to_department === departmentFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  const toggleCcDepartment = (dept: string) => {
    setNewTicket(prev => ({
      ...prev,
      cc_departments: prev.cc_departments.includes(dept)
        ? prev.cc_departments.filter(d => d !== dept)
        : [...prev.cc_departments, dept]
    }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Tickets internes</h1>
            <p className="text-muted-foreground text-sm">Communication entre équipes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchTickets} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau ticket
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(statusConfig).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Département" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="employee">Employés</SelectItem>
              <SelectItem value="technician">Techniciens</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tickets Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                Aucun ticket trouvé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Créé par</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openTicketDetails(ticket)}>
                      <TableCell className="font-medium">{ticket.ticket_number}</TableCell>
                      <TableCell className="max-w-xs truncate">{ticket.subject}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{ticket.created_by_role}</Badge>
                          <span className="text-sm">{ticket.created_by_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ticket.assigned_to_department}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityConfig[ticket.priority]?.color}>
                          {priorityConfig[ticket.priority]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[ticket.status]?.color}>
                          {statusConfig[ticket.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nouveau ticket interne
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sujet *</Label>
              <Input value={newTicket.subject} onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })} placeholder="Sujet du ticket..." />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} placeholder="Décrivez le problème ou la demande..." rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={newTicket.category} onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Destinataire (département)</Label>
              <Select value={newTicket.assigned_to_department} onValueChange={(v) => setNewTicket({ ...newTicket, assigned_to_department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements</SelectItem>
                  <SelectItem value="admin">Administration</SelectItem>
                  <SelectItem value="employee">Employés</SelectItem>
                  <SelectItem value="technician">Techniciens</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CC (copie)</Label>
              <div className="flex gap-4">
                {["admin", "employee", "technician"].filter(d => d !== newTicket.assigned_to_department).map(dept => (
                  <div key={dept} className="flex items-center gap-2">
                    <Checkbox
                      id={`cc-${dept}`}
                      checked={newTicket.cc_departments.includes(dept)}
                      onCheckedChange={() => toggleCcDepartment(dept)}
                    />
                    <Label htmlFor={`cc-${dept}`} className="text-sm capitalize">{dept === "admin" ? "Administration" : dept === "employee" ? "Employés" : "Techniciens"}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annuler</Button>
            <Button onClick={handleCreateTicket} disabled={isSubmitting || !newTicket.subject || !newTicket.description}>
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Créer le ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Ticket Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              {selectedTicket?.ticket_number} - {selectedTicket?.subject}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              {/* Ticket info */}
              <div className="flex flex-wrap gap-2">
                <Badge className={priorityConfig[selectedTicket.priority]?.color}>{priorityConfig[selectedTicket.priority]?.label}</Badge>
                <Badge className={statusConfig[selectedTicket.status]?.color}>{statusConfig[selectedTicket.status]?.label}</Badge>
                <Badge variant="outline">→ {selectedTicket.assigned_to_department}</Badge>
                {(selectedTicket.cc_departments as string[])?.map((d: string) => (
                  <Badge key={d} variant="secondary">CC: {d}</Badge>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Créé par:</span>
                  <p className="font-medium">{selectedTicket.created_by_name} ({selectedTicket.created_by_role})</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <p className="font-medium">{format(new Date(selectedTicket.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}</p>
                </div>
              </div>

              <div className="bg-muted/50 p-3 rounded">
                <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Status update */}
              <div className="flex items-center gap-2">
                <Label className="text-sm">Changer le statut:</Label>
                <Select value={selectedTicket.status} onValueChange={(v) => handleUpdateStatus(selectedTicket.id, v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Replies */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <Label className="mb-2">Conversation ({replies.length})</Label>
                <ScrollArea className="flex-1 border rounded p-3 max-h-48">
                  {isLoadingReplies ? (
                    <div className="flex justify-center py-4"><RefreshCw className="w-4 h-4 animate-spin" /></div>
                  ) : replies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune réponse</p>
                  ) : (
                    <div className="space-y-3">
                      {replies.map(reply => (
                        <div key={reply.id} className="border-b pb-3 last:border-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3 h-3" />
                            <span className="text-sm font-medium">{reply.author_name}</span>
                            <Badge variant="outline" className="text-xs">{reply.author_role}</Badge>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(new Date(reply.created_at), "d MMM HH:mm", { locale: fr })}
                            </span>
                          </div>
                          <p className="text-sm pl-5">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Reply input with AI button */}
              <div className="space-y-2">
                <Textarea value={newReply} onChange={(e) => setNewReply(e.target.value)} placeholder="Écrire une réponse..." rows={2} className="w-full" />
                <div className="flex items-center justify-between gap-2">
                  <AIImproveButton
                    message={newReply}
                    onApply={(improved) => setNewReply(improved)}
                    context="ticket_reply"
                    tone="professional"
                    disabled={!newReply.trim() || newReply.length < 10}
                  />
                  <Button onClick={handleSendReply} disabled={isSubmitting || !newReply.trim()}>
                    <Send className="w-4 h-4 mr-2" />
                    Envoyer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminInternalTickets;
