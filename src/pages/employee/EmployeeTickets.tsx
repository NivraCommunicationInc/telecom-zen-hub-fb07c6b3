import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const EmployeeTickets = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [internalNote, setInternalNote] = useState("");
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

  useEffect(() => {
    if (session?.token) fetchTickets();
  }, [session?.token]);

  const handleLogout = () => {
    localStorage.removeItem("nivra_employee_session");
    navigate("/employee/login");
  };

  const filteredTickets = tickets.filter(ticket => {
    if (!search) return true;
    return ticket.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.subject?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.client_email?.toLowerCase().includes(search.toLowerCase());
  });

  const handleUpdateTicket = async (ticketId: string, updates: any) => {
    if (!session?.permissions?.can_manage_tickets) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "update_ticket", params: { ticketId, updates } },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Ticket mis à jour" });
      fetchTickets();
      setSelectedTicket(null);
      setInternalNote("");
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
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
                    <TableHead></TableHead>
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
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(ticket)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selectedTicket} onOpenChange={() => { setSelectedTicket(null); setInternalNote(""); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              {selectedTicket?.ticket_number || "Ticket"}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              <h3 className="font-medium">{selectedTicket.subject}</h3>
              
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{selectedTicket.client_email || "N/A"}</span>
              </div>

              <div className="flex gap-2">
                <Badge className={priorityLabels[selectedTicket.priority]?.color}>
                  {priorityLabels[selectedTicket.priority]?.label || selectedTicket.priority}
                </Badge>
                <Badge className={statusLabels[selectedTicket.status]?.color}>
                  {statusLabels[selectedTicket.status]?.label || selectedTicket.status}
                </Badge>
              </div>

              <div className="bg-muted/50 p-3 rounded text-sm">
                <p className="font-medium mb-1">Description:</p>
                <p className="text-muted-foreground">{selectedTicket.description || "Aucune description"}</p>
              </div>

              {selectedTicket.internal_notes && (
                <div className="bg-amber-500/10 p-3 rounded text-sm">
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    Notes internes:
                  </p>
                  <p className="text-muted-foreground">{selectedTicket.internal_notes}</p>
                </div>
              )}

              {session?.permissions?.can_manage_tickets && (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Changer le statut</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(statusLabels).map(([key, { label }]) => (
                        <Button
                          key={key}
                          variant={selectedTicket.status === key ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleUpdateTicket(selectedTicket.id, { status: key })}
                          disabled={selectedTicket.status === key}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Ajouter une note interne</p>
                    <Textarea
                      placeholder="Note interne..."
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      rows={2}
                    />
                    <Button
                      className="mt-2"
                      size="sm"
                      onClick={() => handleUpdateTicket(selectedTicket.id, { 
                        internal_notes: selectedTicket.internal_notes 
                          ? `${selectedTicket.internal_notes}\n\n[${format(new Date(), "d MMM HH:mm")}] ${internalNote}`
                          : `[${format(new Date(), "d MMM HH:mm")}] ${internalNote}`
                      })}
                      disabled={!internalNote.trim()}
                    >
                      Enregistrer la note
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeTickets;
