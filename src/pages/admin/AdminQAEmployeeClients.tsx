/**
 * DEV-ONLY: QA Smoke Test for Employee Clients
 * Renders the clients UI with mock data for visual verification
 * Gated by import.meta.env.DEV - not included in production builds
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Search, Eye, Phone, Mail, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Mock data for QA testing - PII masked
const mockClients = [
  {
    id: "1",
    client_number: "CLT-001234",
    full_name: "Jean T***",
    email: "j***@example.com",
    phone: "514-***-1234",
    city: "Montréal",
    account_status: "active",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    client_number: "CLT-001235",
    full_name: "Marie D***",
    email: "m***@example.com",
    phone: "450-***-5678",
    city: "Laval",
    account_status: "active",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "3",
    client_number: "CLT-001236",
    full_name: "Pierre L***",
    email: "p***@example.com",
    phone: "438-***-9012",
    city: "Longueuil",
    account_status: "frozen",
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "4",
    client_number: "CLT-001237",
    full_name: "Sophie B***",
    email: "s***@example.com",
    phone: "514-***-3456",
    city: "Brossard",
    account_status: "suspended",
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "bg-emerald-500/20 text-emerald-500" },
  frozen: { label: "Gelé", color: "bg-blue-500/20 text-blue-500" },
  suspended: { label: "Suspendu", color: "bg-red-500/20 text-red-500" },
  hold: { label: "En attente", color: "bg-amber-500/20 text-amber-500" },
};

const AdminQAEmployeeClients = () => {
  const [searchQuery, setSearchQuery] = useState("");

  if (!import.meta.env.DEV) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-500">DEV ONLY</h1>
        <p>This page is not available in production.</p>
      </div>
    );
  }

  const filteredClients = mockClients.filter((client) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      client.full_name.toLowerCase().includes(q) ||
      client.email.toLowerCase().includes(q) ||
      client.client_number.toLowerCase().includes(q) ||
      client.city.toLowerCase().includes(q)
    );
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
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Clients</h1>
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
              <p className="text-sm text-muted-foreground">Total Clients</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-500">2</p>
              <p className="text-sm text-muted-foreground">Actifs</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-blue-500">1</p>
              <p className="text-sm text-muted-foreground">Gelés</p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-red-500">1</p>
              <p className="text-sm text-muted-foreground">Suspendus</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, numéro client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Liste des clients ({filteredClients.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Inscrit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const statusInfo = statusConfig[client.account_status] || statusConfig.active;
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-mono text-sm">{client.client_number}</TableCell>
                      <TableCell>
                        <p className="font-medium">{client.full_name}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {client.email}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {client.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3 h-3" />
                          {client.city}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
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

export default AdminQAEmployeeClients;
