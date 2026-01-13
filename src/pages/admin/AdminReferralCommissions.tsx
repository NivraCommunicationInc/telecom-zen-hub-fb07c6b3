import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, Loader2, DollarSign, RefreshCw, AlertCircle } from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminReferralCommissions = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: commissions, isLoading, error, refetch } = useQuery({
    queryKey: ["commission-ledger", searchTerm, statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("commission_ledger_entries")
        .select(`
          *,
          influencers(id, first_name, last_name, email)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (typeFilter !== "all") {
        // Cast to valid enum type
        query = query.eq("type", typeFilter as "approved_credit" | "manual_adjustment" | "payout_debit" | "pending_credit" | "reversal");
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by search term if provided (client-side filter for influencer name)
      if (searchTerm && data) {
        return data.filter(c => {
          const name = `${c.influencers?.first_name || ""} ${c.influencers?.last_name || ""}`.toLowerCase();
          const email = (c.influencers?.email || "").toLowerCase();
          const search = searchTerm.toLowerCase();
          return name.includes(search) || email.includes(search);
        });
      }
      
      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">En attente</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approuvé</Badge>;
      case "paid":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Payé</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Annulé</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "pending_credit":
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Crédit en attente</Badge>;
      case "approved_credit":
        return <Badge variant="outline" className="text-green-500 border-green-500/30">Crédit approuvé</Badge>;
      case "payout_debit":
        return <Badge variant="outline" className="text-blue-500 border-blue-500/30">Retrait</Badge>;
      case "manual_adjustment":
        return <Badge variant="outline" className="text-orange-500 border-orange-500/30">Ajustement</Badge>;
      case "reversal":
        return <Badge variant="outline" className="text-red-500 border-red-500/30">Annulation</Badge>;
      default:
        return <Badge variant="outline">{type || "—"}</Badge>;
    }
  };

  if (error) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/referrals">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Commissions</h1>
            </div>
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Erreur de chargement: {(error as Error).message}</span>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/referrals">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Commissions</h1>
            <p className="text-muted-foreground">
              Historique des commissions et paiements
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par influenceur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="pending_credit">Crédit en attente</SelectItem>
                  <SelectItem value="approved_credit">Crédit approuvé</SelectItem>
                  <SelectItem value="payout_debit">Retraits</SelectItem>
                  <SelectItem value="manual_adjustment">Ajustements</SelectItem>
                  <SelectItem value="reversal">Annulations</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvés</SelectItem>
                  <SelectItem value="paid">Payés</SelectItem>
                  <SelectItem value="cancelled">Annulés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Influenceur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : !commissions || commissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <DollarSign className="w-10 h-10 opacity-50" />
                        <p>Aucune commission trouvée</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  commissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="text-muted-foreground">
                        {commission.created_at
                          ? new Date(commission.created_at).toLocaleDateString("fr-CA")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {commission.influencers ? (
                          <Link 
                            to={`/admin/referrals/influencers/${commission.influencers.id}`}
                            className="hover:text-primary"
                          >
                            <div>
                              <p className="font-medium">
                                {commission.influencers.first_name || "—"} {commission.influencers.last_name || ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {commission.influencers.email || "—"}
                              </p>
                            </div>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getTypeBadge(commission.type)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${commission.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {commission.amount >= 0 ? "+" : ""}${Number(commission.amount || 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(commission.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                        {commission.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReferralCommissions;
