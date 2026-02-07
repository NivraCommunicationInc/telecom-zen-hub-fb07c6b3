/**
 * Admin Contested Invoices Page
 * Shows all invoices with disputed or contested status
 * Full visibility for admin with no exclusions
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
  FileText,
  RefreshCw,
  ExternalLink,
  Calendar,
  User,
  DollarSign,
  Filter,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Status configuration for visual display
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  disputed: { label: "Contestée", variant: "destructive" },
  contested: { label: "Contestée", variant: "destructive" },
  chargeback: { label: "Rétrofacturation", variant: "destructive" },
  pending_dispute: { label: "En attente de contestation", variant: "secondary" },
  under_review: { label: "En révision", variant: "secondary" },
  overdue: { label: "Renouvellement requis", variant: "destructive" },
};

export default function AdminContestedInvoices() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch ALL invoices that have dispute-related status or flags
  // Admin override: no exclusions, full visibility
  const { data: invoices, isLoading, refetch, isError } = useQuery({
    queryKey: ["admin-contested-invoices"],
    queryFn: async () => {
      // Query billing table for disputed/contested invoices
      // Include any status that could indicate a dispute
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .or("status.eq.disputed,status.eq.contested,status.eq.chargeback,status.ilike.%dispute%")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Also fetch any invoices linked to payment_disputes
      const { data: disputeLinks, error: disputeError } = await supabase
        .from("payment_disputes")
        .select("payment_id");

      if (disputeError) throw disputeError;

      const disputedPaymentIds = new Set(disputeLinks?.map((d) => d.payment_id) || []);

      // Fetch invoices that have disputes but might not have disputed status
      if (disputedPaymentIds.size > 0) {
        const { data: additionalInvoices, error: additionalError } = await supabase
          .from("billing")
          .select("*")
          .in("id", Array.from(disputedPaymentIds))
          .not("status", "eq", "disputed"); // Avoid duplicates

        if (!additionalError && additionalInvoices) {
          return [...(data || []), ...additionalInvoices].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
      }

      return data || [];
    },
  });

  // Filter invoices based on search and status
  const filteredInvoices = invoices?.filter((invoice) => {
    if (statusFilter !== "all" && invoice.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        invoice.invoice_number?.toLowerCase().includes(query) ||
        invoice.client_email?.toLowerCase().includes(query) ||
        invoice.id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Get unique statuses for filter
  const uniqueStatuses = [...new Set(invoices?.map((i) => i.status).filter(Boolean) || [])];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <FileText className="h-6 w-6 text-destructive" />
              </div>
              Factures contestées
            </h1>
            <p className="text-muted-foreground mt-1">
              Toutes les factures avec statut contesté, en litige ou rétrofacturation
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Actualiser
          </Button>
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
                  <p className="text-2xl font-bold">{invoices?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total contestées</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {(invoices?.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) || 0).toLocaleString("fr-CA", {
                      style: "currency",
                      currency: "CAD",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">Montant total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {invoices?.filter((i) => {
                      const days = (Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24);
                      return days <= 7;
                    }).length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Cette semaine</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <User className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {new Set(invoices?.map((i) => i.user_id)).size || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Clients concernés</p>
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
                  placeholder="Rechercher par numéro de facture, email..."
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
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusConfig[status]?.label || status}
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
              {filteredInvoices?.length || 0} facture{(filteredInvoices?.length || 0) !== 1 ? "s" : ""} trouvée{(filteredInvoices?.length || 0) !== 1 ? "s" : ""}
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
                <p className="text-muted-foreground">Impossible de charger les factures contestées</p>
                <Button onClick={() => refetch()} variant="outline" className="mt-4">
                  Réessayer
                </Button>
              </div>
            ) : filteredInvoices?.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">Aucune facture contestée</p>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "Aucun résultat pour ces critères"
                    : "Aucune facture avec statut contesté trouvée"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facture</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices?.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div className="font-medium">
                            {invoice.invoice_number || invoice.id.slice(0, 8)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{invoice.client_email || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {Number(invoice.amount || 0).toLocaleString("fr-CA", {
                              style: "currency",
                              currency: "CAD",
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig[invoice.status]?.variant || "secondary"}>
                            {statusConfig[invoice.status]?.label || invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(invoice.created_at), "d MMM yyyy", { locale: fr })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/admin/billing?search=${encodeURIComponent(invoice.invoice_number || invoice.id)}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
