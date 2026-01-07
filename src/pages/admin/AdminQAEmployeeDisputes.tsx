/**
 * DEV-ONLY: QA Smoke Test for Employee Payment Disputes
 * Renders the disputes UI with mock data for visual verification
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
  AlertTriangle, Search, Clock, CheckCircle, XCircle, 
  RefreshCw, Filter, DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Mock data for QA testing
const mockDisputes = [
  {
    id: "1",
    dispute_number: "DIS-2025-0001",
    reason_code: "duplicate_charge",
    status: "submitted",
    amount: 89.99,
    created_at: new Date().toISOString(),
    invoice_number: "INV-2025-1234",
    profile: { full_name: "Jean T***", email: "j***@example.com" },
  },
  {
    id: "2",
    dispute_number: "DIS-2025-0002",
    reason_code: "wrong_amount",
    status: "under_review",
    amount: 125.50,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    invoice_number: "INV-2025-1235",
    profile: { full_name: "Marie D***", email: "m***@example.com" },
  },
  {
    id: "3",
    dispute_number: "DIS-2025-0003",
    reason_code: "service_not_received",
    status: "resolved_approved",
    amount: 45.00,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    invoice_number: "INV-2025-1236",
    profile: { full_name: "Pierre L***", email: "p***@example.com" },
  },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  submitted: { label: "Soumis", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  under_review: { label: "En révision", color: "bg-blue-500/20 text-blue-500", icon: RefreshCw },
  awaiting_client: { label: "Info requise", color: "bg-purple-500/20 text-purple-500", icon: AlertTriangle },
  resolved_approved: { label: "Approuvé", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
  resolved_rejected: { label: "Refusé", color: "bg-red-500/20 text-red-500", icon: XCircle },
};

const reasonCodeLabels: Record<string, string> = {
  duplicate_charge: "Charge en double",
  wrong_amount: "Montant incorrect",
  service_not_received: "Service non reçu",
  billing_error: "Erreur de facturation",
  other: "Autre",
};

const AdminQAEmployeeDisputes = () => {
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
            <AlertTriangle className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Litiges de paiement</h1>
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
              <p className="text-sm text-muted-foreground">Soumis</p>
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
                  placeholder="Rechercher par numéro, facture..."
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
            <CardTitle>Liste des litiges</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDisputes.map((dispute) => {
                  const statusInfo = statusConfig[dispute.status];
                  const StatusIcon = statusInfo?.icon || Clock;
                  return (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-mono text-sm">{dispute.dispute_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{dispute.profile.full_name}</p>
                          <p className="text-xs text-muted-foreground">{dispute.profile.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{dispute.invoice_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {dispute.amount.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{reasonCodeLabels[dispute.reason_code]}</TableCell>
                      <TableCell>
                        <Badge className={statusInfo?.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(dispute.created_at), "d MMM yyyy", { locale: fr })}
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

export default AdminQAEmployeeDisputes;
