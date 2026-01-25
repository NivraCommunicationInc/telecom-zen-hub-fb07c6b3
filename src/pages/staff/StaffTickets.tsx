/**
 * StaffTickets - Employee portal support tickets view
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Ticket, Search, Loader2, RefreshCw, Clock, 
  CheckCircle, AlertTriangle, User, MessageSquare, ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";

export default function StaffTickets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: tickets, isLoading, refetch } = useQuery({
    queryKey: ["staff-tickets", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filteredTickets = tickets?.filter(ticket => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ticket.ticket_number?.toLowerCase().includes(q) ||
      ticket.subject?.toLowerCase().includes(q) ||
      ticket.client_email?.toLowerCase().includes(q)
    );
  });

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      open: { label: "Ouvert", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      in_progress: { label: "En cours", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      resolved: { label: "Résolu", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      closed: { label: "Fermé", className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    };
    return configs[status] || { label: status, className: "bg-slate-500/20 text-slate-400" };
  };

  const getPriorityConfig = (priority: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      low: { label: "Basse", className: "bg-slate-600 text-slate-200" },
      medium: { label: "Moyenne", className: "bg-blue-600 text-white" },
      high: { label: "Haute", className: "bg-orange-600 text-white" },
      urgent: { label: "Urgente", className: "bg-red-600 text-white animate-pulse" },
    };
    return configs[priority] || { label: priority, className: "bg-slate-600" };
  };

  const nav = useNavigate();

  return (
    <div className="min-h-screen relative">
      <StaffBackground />
      
      <div className="relative z-10 p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => nav("/staff/dashboard")}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg">
              <Ticket className="h-6 w-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Tickets Support</h1>
              <p className="text-slate-400">Gérer les demandes de support client</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par numéro, sujet ou email..."
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="open">Ouvert</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="resolved">Résolu</SelectItem>
                  <SelectItem value="closed">Fermé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Tickets ({filteredTickets?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
              </div>
            ) : !filteredTickets?.length ? (
              <p className="text-slate-400 text-center py-8">Aucun ticket trouvé</p>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-3">
                  {filteredTickets.map((ticket) => {
                    const status = getStatusConfig(ticket.status);
                    const priority = getPriorityConfig(ticket.priority);
                    return (
                      <Link
                        key={ticket.id}
                        to={`/staff/tickets/${ticket.id}`}
                        className="block p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-teal-500/50 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm text-slate-500">{ticket.ticket_number}</span>
                              <Badge className={priority.className}>{priority.label}</Badge>
                            </div>
                            <p className="font-semibold text-white">{ticket.subject}</p>
                          </div>
                          <Badge className={status.className}>{status.label}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {ticket.client_email || "Client"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
