/**
 * DEV-ONLY: QA Smoke Test for Employee Orders
 * Renders the orders UI with mock data for visual verification
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
import { Package, Search, Eye, Filter, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Mock data for QA testing - PII masked
const mockOrders = [
  {
    id: "1",
    order_number: "ORD-2025-0001",
    client_name: "Jean T***",
    client_email: "j***@example.com",
    status: "pending",
    total: 149.99,
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    order_number: "ORD-2025-0002",
    client_name: "Marie D***",
    client_email: "m***@example.com",
    status: "processing",
    total: 89.99,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "3",
    order_number: "ORD-2025-0003",
    client_name: "Pierre L***",
    client_email: "p***@example.com",
    status: "shipped",
    total: 249.99,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "4",
    order_number: "ORD-2025-0004",
    client_name: "Sophie B***",
    client_email: "s***@example.com",
    status: "completed",
    total: 199.99,
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-500/20 text-amber-500" },
  processing: { label: "En traitement", color: "bg-blue-500/20 text-blue-500" },
  verification: { label: "Vérification", color: "bg-purple-500/20 text-purple-500" },
  shipped: { label: "Expédiée", color: "bg-cyan-500/20 text-cyan-500" },
  completed: { label: "Complétée", color: "bg-emerald-500/20 text-emerald-500" },
  cancelled: { label: "Annulée", color: "bg-red-500/20 text-red-500" },
};

const AdminQAEmployeeOrders = () => {
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

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch = !searchQuery ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.client_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Commandes</h1>
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
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-500">1</p>
              <p className="text-sm text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-blue-500">1</p>
              <p className="text-sm text-muted-foreground">En traitement</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-500">1</p>
              <p className="text-sm text-muted-foreground">Complétées</p>
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

        {/* Orders Table */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Liste des commandes ({filteredOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const statusInfo = statusConfig[order.status] || statusConfig.pending;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.client_name}</p>
                          <p className="text-xs text-muted-foreground">{order.client_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {order.total.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          Voir
                        </Button>
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

export default AdminQAEmployeeOrders;
