/**
 * DEV-ONLY: QA Smoke Test for Employee Support Tickets
 * Renders the tickets UI with mock data for visual verification
 * Gated by import.meta.env.DEV - not included in production builds
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Ticket, Search, Clock, CheckCircle, MessageCircle, 
  Filter, AlertCircle, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Mock data for QA testing
const mockTickets = [
  {
    id: "1",
    ticket_number: "TKT-2025-0001",
    subject: "Problème de connexion Internet",
    category: "technical",
    priority: "high",
    status: "open",
    created_at: new Date().toISOString(),
    profile: { full_name: "Jean T***", email: "j***@example.com" },
    replies_count: 2,
  },
  {
    id: "2",
    ticket_number: "TKT-2025-0002",
    subject: "Question sur ma facture",
    category: "billing",
    priority: "medium",
    status: "in_progress",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    profile: { full_name: "Marie D***", email: "m***@example.com" },
    replies_count: 5,
  },
  {
    id: "3",
    ticket_number: "TKT-2025-0003",
    subject: "Demande de changement de forfait",
    category: "account",
    priority: "low",
    status: "resolved",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    profile: { full_name: "Pierre L***", email: "p***@example.com" },
    replies_count: 3,
  },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Ouvert", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  in_progress: { label: "En cours", color: "bg-blue-500/20 text-blue-500", icon: Loader2 },
  awaiting_response: { label: "Attente réponse", color: "bg-purple-500/20 text-purple-500", icon: MessageCircle },
  resolved: { label: "Résolu", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
  closed: { label: "Fermé", color: "bg-muted text-muted-foreground", icon: CheckCircle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Faible", color: "bg-muted text-muted-foreground" },
  medium: { label: "Moyen", color: "bg-amber-500/20 text-amber-500" },
  high: { label: "Élevé", color: "bg-red-500/20 text-red-500" },
  urgent: { label: "Urgent", color: "bg-red-600/30 text-red-400" },
};

const categoryLabels: Record<string, string> = {
  technical: "Technique",
  billing: "Facturation",
  account: "Compte",
  sales: "Ventes",
  other: "Autre",
};

const AdminQAEmployeeTickets = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  if (!import.meta.env.DEV) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-500">DEV ONLY</h1>
        <p>This page is not available in production.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mock Employee Header */}
      <div className="bg-primary text-primary-foreground p-4 border-b">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-accent flex items-center justify-center">
              <span className="font-bold text-white text-sm">N</span>
            </div>
            <span className="font-semibold">Nivra Employee Portal</span>
            <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/50">
              🧪 QA MOCK
            </Badge>
          </div>
          <span className="text-sm opacity-80">e***@nivra.ca (employee)</span>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ticket className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Tickets de support</h1>
          </div>
          <Badge variant="outline" className="bg-amber-500/20 text-amber-500">
            DEV-ONLY QA Page
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold">3</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-500">1</p>
              <p className="text-sm text-muted-foreground">Ouvert</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-blue-500">1</p>
              <p className="text-sm text-muted-foreground">En cours</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-500">1</p>
              <p className="text-sm text-muted-foreground">Résolu</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro, sujet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Liste des tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Réponses</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockTickets.map((ticket) => {
                  const statusInfo = statusConfig[ticket.status];
                  const StatusIcon = statusInfo?.icon || Clock;
                  const priorityInfo = priorityConfig[ticket.priority];
                  return (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-sm">{ticket.ticket_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{ticket.profile.full_name}</p>
                          <p className="text-xs text-muted-foreground">{ticket.profile.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{ticket.subject}</TableCell>
                      <TableCell className="text-sm">{categoryLabels[ticket.category]}</TableCell>
                      <TableCell>
                        <Badge className={priorityInfo?.color}>{priorityInfo?.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo?.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {ticket.replies_count}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Voir</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminQAEmployeeTickets;
