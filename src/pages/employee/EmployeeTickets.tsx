import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Ticket,
  LogOut,
  RefreshCw,
  Search,
  ArrowLeft,
  Eye,
  User,
  Clock,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statusLabels: Record<string, { label: string; color: string }> = {
  open: { label: "Ouvert", color: "bg-blue-500/20 text-blue-600" },
  in_progress: { label: "En cours", color: "bg-amber-500/20 text-amber-600" },
  waiting: { label: "En attente", color: "bg-purple-500/20 text-purple-600" },
  resolved: { label: "Résolu", color: "bg-emerald-500/20 text-emerald-600" },
  closed: { label: "Fermé", color: "bg-gray-500/20 text-gray-600" },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: "Basse", color: "bg-gray-500/20 text-gray-600" },
  normal: { label: "Normal", color: "bg-blue-500/20 text-blue-600" },
  high: { label: "Haute", color: "bg-orange-500/20 text-orange-600" },
  urgent: { label: "Urgent", color: "bg-red-500/20 text-red-600" },
};

interface TicketReply {
  id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
}

const EmployeeTickets = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [internalNote, setInternalNote] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const stored = localStorage.getItem("nivra_employee_session");
    if (!stored) {
      navigate("/employee/login");
      return;
    }
    try {
      const s = JSON.parse(stored);
      if (!s.permissions?.can_view_tickets) {
        toast({ title: "Accès refusé", variant: "destructive" });
        navigate("/employee");
        return;
      }
      setSession(s);
    } catch {
      navigate("/employee/login");
    }
  }, [navigate, toast]);

  const fetchTickets = async () => {
    if (!session?.token) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_tickets", params: { limit: 200 } },
      });
      if (error) throw error;
      setTickets(data?.tickets || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReplies = async (ticketId: string) => {
    if (!session?.token) return;
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_ticket_replies", params: { ticketId } },
      });
      if (error) throw error;
      setReplies(data?.replies || []);
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  };

  useEffect(() => {
    if (session?.token) fetchTickets();
  }, [session?.token]);

  useEffect(() => {
    if (selectedTicket?.id) {
      fetchReplies(selectedTicket.id);
    } else {
      setReplies([]);
    }
  }, [selectedTicket?.id]);

  const handleLogout = () => {
    localStorage.removeItem("nivra_employee_session");
    navigate("/employee/login");
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !search || 
      ticket.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.subject?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.client_email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateTicket = async (ticketId: string, updates: any) => {
    if (!session?.permissions?.can_manage_tickets) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "update_ticket", params: { ticketId, updates } },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Ticket mis à jour" });
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, ...updates });
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyContent.trim() || !selectedTicket?.id) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "add_ticket_reply", 
          params: { 
            ticketId: selectedTicket.id, 
            content: replyContent.trim() 
          } 
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Réponse envoyée" });
      setReplyContent("");
      fetchReplies(selectedTicket.id);
      fetchTickets();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (!internalNote.trim() || !selectedTicket?.id) return;
    const newNote = selectedTicket.internal_notes 
      ? `${selectedTicket.internal_notes}\n\n[${format(new Date(), "d MMM HH:mm")} - ${session.name}] ${internalNote}`
      : `[${format(new Date(), "d MMM HH:mm")} - ${session.name}] ${internalNote}`;
    
    await handleUpdateTicket(selectedTicket.id, { internal_notes: newNote });
    setInternalNote("");
    setSelectedTicket({ ...selectedTicket, internal_notes: newNote });
  };

  const handleQuickClose = async (ticketId: string, resolution: "resolved" | "closed") => {
    await handleUpdateTicket(ticketId, { status: resolution });
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/employee">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <Ticket className="w-6 h-6 text-amber-500" />
              <h1 className="font-display font-bold text-lg">Tickets</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {format(lastRefresh, "HH:mm")}
              </span>
              <Button variant="outline" size="sm" onClick={fetchTickets} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(statusLabels).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucun ticket trouvé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.ticket_number || "N/A"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{ticket.subject || "N/A"}</TableCell>
                      <TableCell>{ticket.client_email || "N/A"}</TableCell>
                      <TableCell>
                        <Badge className={priorityLabels[ticket.priority]?.color || "bg-gray-500/20"}>
                          {priorityLabels[ticket.priority]?.label || ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusLabels[ticket.status]?.color || "bg-gray-500/20"}>
                          {statusLabels[ticket.status]?.label || ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(ticket)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {session?.permissions?.can_manage_tickets && ticket.status !== "resolved" && ticket.status !== "closed" && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-emerald-600 hover:text-emerald-700"
                                onClick={() => handleQuickClose(ticket.id, "resolved")}
                                title="Marquer résolu"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-gray-600 hover:text-gray-700"
                                onClick={() => handleQuickClose(ticket.id, "closed")}
                                title="Fermer"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selectedTicket} onOpenChange={() => { setSelectedTicket(null); setInternalNote(""); setReplyContent(""); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              {selectedTicket?.ticket_number || "Ticket"}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Détails</TabsTrigger>
                <TabsTrigger value="replies">Réponses ({replies.length})</TabsTrigger>
                <TabsTrigger value="internal">Notes internes</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <h3 className="font-medium text-lg">{selectedTicket.subject}</h3>
                
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${selectedTicket.client_email}`} className="hover:underline">
                    {selectedTicket.client_email || "N/A"}
                  </a>
                </div>

                <div className="flex gap-2">
                  <Badge className={priorityLabels[selectedTicket.priority]?.color}>
                    {priorityLabels[selectedTicket.priority]?.label || selectedTicket.priority}
                  </Badge>
                  <Badge className={statusLabels[selectedTicket.status]?.color}>
                    {statusLabels[selectedTicket.status]?.label || selectedTicket.status}
                  </Badge>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="font-medium mb-2 text-sm">Description:</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedTicket.description || "Aucune description"}</p>
                </div>

                <div className="text-xs text-muted-foreground">
                  Créé le {format(new Date(selectedTicket.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                </div>

                {session?.permissions?.can_manage_tickets && (
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-medium">Changer le statut</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(statusLabels).map(([key, { label }]) => (
                        <Button
                          key={key}
                          variant={selectedTicket.status === key ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleUpdateTicket(selectedTicket.id, { status: key })}
                          disabled={selectedTicket.status === key || isSubmitting}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    
                    <p className="text-sm font-medium pt-2">Changer la priorité</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(priorityLabels).map(([key, { label }]) => (
                        <Button
                          key={key}
                          variant={selectedTicket.priority === key ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleUpdateTicket(selectedTicket.id, { priority: key })}
                          disabled={selectedTicket.priority === key || isSubmitting}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="replies" className="space-y-4 mt-4">
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {replies.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Aucune réponse pour le moment</p>
                  ) : (
                    replies.map((reply) => (
                      <div 
                        key={reply.id} 
                        className={`p-3 rounded-lg ${reply.is_admin ? "bg-primary/10 ml-4" : "bg-muted/50 mr-4"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">
                            {reply.is_admin ? "Support Nivra" : "Client"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(reply.created_at), "d MMM HH:mm", { locale: fr })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {session?.permissions?.can_manage_tickets && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Répondre au client</p>
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Votre réponse..."
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        rows={3}
                        className="flex-1"
                      />
                    </div>
                    <Button
                      className="mt-2"
                      onClick={handleSendReply}
                      disabled={!replyContent.trim() || isSubmitting}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="internal" className="space-y-4 mt-4">
                {selectedTicket.internal_notes ? (
                  <div className="bg-amber-500/10 p-4 rounded-lg">
                    <p className="font-medium mb-2 text-sm flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Notes internes (non visibles par le client)
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{selectedTicket.internal_notes}</p>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Aucune note interne</p>
                )}

                {session?.permissions?.can_manage_tickets && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Ajouter une note interne</p>
                    <Textarea
                      placeholder="Note interne (non visible par le client)..."
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      rows={2}
                    />
                    <Button
                      className="mt-2"
                      size="sm"
                      onClick={handleAddInternalNote}
                      disabled={!internalNote.trim() || isSubmitting}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Ajouter la note
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeTickets;
