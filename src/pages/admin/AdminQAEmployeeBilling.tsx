/**
 * DEV-ONLY: QA Smoke Test for Employee Billing
 * Renders the billing UI with mock data for visual verification
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
import { CreditCard, Search, Eye, Filter, DollarSign, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Mock data for QA testing - PII masked
const mockInvoices = [
  {
    id: "1",
    invoice_number: "INV-2025-0001",
    client_email: "j***@example.com",
    status: "pending",
    amount: 149.99,
    due_date: new Date(Date.now() + 604800000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    invoice_number: "INV-2025-0002",
    client_email: "m***@example.com",
    status: "paid",
    amount: 89.99,
    due_date: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: "3",
    invoice_number: "INV-2025-0003",
    client_email: "p***@example.com",
    status: "overdue",
    amount: 249.99,
    due_date: new Date(Date.now() - 172800000).toISOString(),
    created_at: new Date(Date.now() - 1209600000).toISOString(),
  },
  {
    id: "4",
    invoice_number: "INV-2025-0004",
    client_email: "s***@example.com",
    status: "paid",
    amount: 199.99,
    due_date: new Date(Date.now() - 259200000).toISOString(),
    created_at: new Date(Date.now() - 1814400000).toISOString(),
  },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  paid: { label: "Payé", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
  overdue: { label: "En retard", color: "bg-red-500/20 text-red-500", icon: AlertCircle },
  partial: { label: "Partiel", color: "bg-blue-500/20 text-blue-500", icon: Clock },
  cancelled: { label: "Annulé", color: "bg-muted text-muted-foreground", icon: Clock },
};

const AdminQAEmployeeBilling = () => {
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

  const filteredInvoices = mockInvoices.filter((invoice) => {
    const matchesSearch = !searchQuery ||
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPending = mockInvoices.filter(i => i.status === "pending").reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = mockInvoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const totalOverdue = mockInvoices.filter(i => i.status === "overdue").reduce((sum, i) => sum + i.amount, 0);

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
            <CreditCard className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Facturation</h1>
          </div>
          <Badge variant="outline" className="bg-amber-500/20 text-amber-500">
            DEV-ONLY QA Page
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold">4</p>
              <p className="text-sm text-muted-foreground">Total Factures</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-500">${totalPending.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-500">${totalPaid.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Payé</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-red-500">${totalOverdue.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">En retard</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative max-w-md">
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

        {/* Invoices Table */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Liste des factures ({filteredInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const statusInfo = statusConfig[invoice.status] || statusConfig.pending;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-sm">{invoice.client_email}</TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-medium">
                          <DollarSign className="w-3 h-3" />
                          {invoice.amount.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4 mr-1" />
                            Voir
                          </Button>
                          <Button variant="outline" size="sm">
                            Mettre à jour
                          </Button>
                        </div>
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

export default AdminQAEmployeeBilling;
