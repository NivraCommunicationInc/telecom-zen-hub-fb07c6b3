/**
 * DEV-ONLY: QA Smoke Test for Employee Cancellations
 * Renders the cancellations UI with mock data for visual verification
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
  FileX, Search, Clock, CheckCircle, XCircle, 
  AlertTriangle, Calendar, RefreshCw, Filter
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Mock data for QA testing
const mockCancellationRequests = [
  {
    id: "1",
    request_number: "CAN-2025-0001",
    service_type: "internet",
    reason_code: "moving",
    status: "requested",
    created_at: new Date().toISOString(),
    profile: { full_name: "Jean T***", email: "j***@example.com" },
  },
  {
    id: "2", 
    request_number: "CAN-2025-0002",
    service_type: "tv",
    reason_code: "price",
    status: "under_review",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    profile: { full_name: "Marie D***", email: "m***@example.com" },
  },
  {
    id: "3",
    request_number: "CAN-2025-0003",
    service_type: "mobile",
    reason_code: "service_issue",
    status: "approved",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    profile: { full_name: "Pierre L***", email: "p***@example.com" },
  },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  requested: { label: "Demandé", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  under_review: { label: "En révision", color: "bg-blue-500/20 text-blue-500", icon: RefreshCw },
  awaiting_client: { label: "Info requise", color: "bg-purple-500/20 text-purple-500", icon: AlertTriangle },
  approved: { label: "Approuvé", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
  scheduled: { label: "Planifié", color: "bg-cyan-500/20 text-cyan-500", icon: Calendar },
  completed: { label: "Complété", color: "bg-muted text-muted-foreground", icon: CheckCircle },
  declined: { label: "Refusé", color: "bg-red-500/20 text-red-500", icon: XCircle },
};

const serviceTypeLabels: Record<string, string> = {
  mobile: "Mobile",
  internet: "Internet",
  tv: "Télévision",
  security: "Sécurité",
  streaming: "Streaming",
  bundle: "Forfait combiné",
};

const AdminQAEmployeeCancellations = () => {
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
            <FileX className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Demandes d'annulation</h1>
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
              <p className="text-sm text-muted-foreground">Demandé</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-blue-500">1</p>
              <p className="text-sm text-muted-foreground">En révision</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-500">1</p>
              <p className="text-sm text-muted-foreground">Approuvé</p>
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
                  placeholder="Rechercher par numéro, client..."
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
            <CardTitle>Liste des demandes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCancellationRequests.map((request) => {
                  const statusInfo = statusConfig[request.status];
                  const StatusIcon = statusInfo?.icon || Clock;
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-mono text-sm">{request.request_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.profile.full_name}</p>
                          <p className="text-xs text-muted-foreground">{request.profile.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{serviceTypeLabels[request.service_type]}</TableCell>
                      <TableCell>
                        <Badge className={statusInfo?.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "d MMM yyyy", { locale: fr })}
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

export default AdminQAEmployeeCancellations;
