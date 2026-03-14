/**
 * Admin Contested Payments Page
 * Shows all payment disputes with full admin visibility
 * Re-exports and enhances the existing AdminPaymentDisputes functionality
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertTriangle,
  Search,
  CreditCard,
  RefreshCw,
  ExternalLink,
  Calendar,
  User,
  DollarSign,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Status configuration for visual display
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  submitted: { label: "Soumise", variant: "secondary", icon: Clock },
  under_review: { label: "En révision", variant: "default", icon: AlertTriangle },
  awaiting_client: { label: "En attente client", variant: "outline", icon: User },
  resolved_approved: { label: "Approuvée", variant: "default", icon: CheckCircle },
  resolved_rejected: { label: "Rejetée", variant: "destructive", icon: XCircle },
};

// Reason code labels
const reasonLabels: Record<string, string> = {
  duplicate_charge: "Facturation en double",
  service_not_received: "Service non reçu",
  incorrect_amount: "Montant incorrect",
  unauthorized: "Non autorisé",
  fraud: "Fraude suspectée",
  other: "Autre",
};

export default function AdminContestedPayments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch ALL payment disputes with full admin visibility
  const { data: disputes, isLoading, refetch, isError } = useQuery({
    queryKey: ["admin-contested-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_disputes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch related profiles and payments
        const userIds = [...new Set(data.map((d) => d.user_id))];
        const paymentIds = [...new Set(data.map((d) => d.payment_id))];

        const [profilesRes, paymentsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, email, full_name, phone, client_number").in("user_id", userIds),
          supabase.from("billing_invoices").select("id, invoice_number, total, status, payment_method, created_at").in("id", paymentIds),
        ]);

        return data.map((dispute) => ({
          ...dispute,
          profile: profilesRes.data?.find((p) => p.user_id === dispute.user_id) || null,
          payment: paymentsRes.data?.find((p) => p.id === dispute.payment_id) || null,
        }));
      }

      return data || [];
    },
  });

  // Filter disputes based on search and status
  const filteredDisputes = disputes?.filter((dispute) => {
    if (statusFilter !== "all" && dispute.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        dispute.dispute_number?.toLowerCase().includes(query) ||
        dispute.profile?.email?.toLowerCase().includes(query) ||
        dispute.profile?.full_name?.toLowerCase().includes(query) ||
        dispute.payment?.invoice_number?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Calculate stats
  const pendingCount = disputes?.filter((d) => ["submitted", "under_review", "awaiting_client"].includes(d.status)).length || 0;
  const resolvedCount = disputes?.filter((d) => ["resolved_approved", "resolved_rejected"].includes(d.status)).length || 0;
  const totalAmount = disputes?.reduce((sum, d) => sum + (Number(d.payment?.amount) || 0), 0) || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <CreditCard className="h-6 w-6 text-destructive" />
              </div>
              Paiements contestés
            </h1>
            <p className="text-muted-foreground mt-1">
              Toutes les contestations de paiement et demandes de remboursement
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/payment-disputes">
                <ExternalLink className="h-4 w-4 mr-2" />
                Vue complète
              </Link>
            </Button>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{disputes?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total contestations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">En cours</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{resolvedCount}</p>
                  <p className="text-xs text-muted-foreground">Résolues</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                  <p className="text-xs text-muted-foreground">Montant contesté</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro, email, nom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {filteredDisputes?.length || 0} contestation{(filteredDisputes?.length || 0) !== 1 ? "s" : ""} trouvée{(filteredDisputes?.length || 0) !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                <p className="text-lg font-medium">Erreur de chargement</p>
                <p className="text-muted-foreground">Impossible de charger les contestations</p>
                <Button onClick={() => refetch()} variant="outline" className="mt-4">
                  Réessayer
                </Button>
              </div>
            ) : filteredDisputes?.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">Aucune contestation</p>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "Aucun résultat pour ces critères"
                    : "Aucune contestation de paiement trouvée"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contestation</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Paiement</TableHead>
                      <TableHead>Raison</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDisputes?.map((dispute) => {
                      const StatusIcon = statusConfig[dispute.status]?.icon || AlertTriangle;
                      return (
                        <TableRow key={dispute.id}>
                          <TableCell>
                            <div className="font-medium">
                              {dispute.dispute_number || dispute.id.slice(0, 8)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{dispute.profile?.full_name || "-"}</div>
                            <div className="text-xs text-muted-foreground">{dispute.profile?.email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{dispute.payment?.invoice_number || "-"}</div>
                            <div className="text-xs font-medium">
                              {Number(dispute.payment?.amount || 0).toLocaleString("fr-CA", {
                                style: "currency",
                                currency: "CAD",
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{reasonLabels[dispute.reason_code] || dispute.reason_code}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig[dispute.status]?.variant || "secondary"} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig[dispute.status]?.label || dispute.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(dispute.created_at), "d MMM yyyy", { locale: fr })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/admin/payment-disputes?search=${encodeURIComponent(dispute.dispute_number || dispute.id)}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
