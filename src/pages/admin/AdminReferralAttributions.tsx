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
import { ArrowLeft, Search, Loader2, TrendingUp, RefreshCw, AlertCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminReferralAttributions = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: attributions, isLoading, error, refetch } = useQuery({
    queryKey: ["referral-attributions", searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("referral_attributions")
        .select(`
          *,
          referral_codes(code, influencers(id, first_name, last_name, email))
        `)
        .order("applied_at", { ascending: false });

      if (searchTerm) {
        query = query.ilike("customer_email", `%${searchTerm}%`);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">En attente</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approuvé</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejeté</Badge>;
      case "paid":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Payé</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  };

  const getFraudBadge = (level: number | null) => {
    if (!level || level === 0) return null;
    if (level <= 2) {
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Risque faible</Badge>;
    }
    if (level <= 4) {
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Risque moyen</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Risque élevé</Badge>;
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
              <h1 className="text-2xl font-bold text-foreground">Parrainages</h1>
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
            <h1 className="text-2xl font-bold text-foreground">Parrainages</h1>
            <p className="text-muted-foreground">
              Liste des attributions de parrainage
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
                  placeholder="Rechercher par email client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvés</SelectItem>
                  <SelectItem value="rejected">Rejetés</SelectItem>
                  <SelectItem value="paid">Payés</SelectItem>
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
                  <TableHead>Client</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Influenceur</TableHead>
                  <TableHead className="text-right">Rabais</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Fraude</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : !attributions || attributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <TrendingUp className="w-10 h-10 opacity-50" />
                        <p>Aucun parrainage trouvé</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  attributions.map((attr) => {
                    const influencer = attr.referral_codes?.influencers;
                    return (
                      <TableRow key={attr.id}>
                        <TableCell className="text-muted-foreground">
                          {attr.applied_at
                            ? new Date(attr.applied_at).toLocaleDateString("fr-CA")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{attr.customer_email || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                            {attr.referral_codes?.code || "—"}
                          </code>
                        </TableCell>
                        <TableCell>
                          {influencer ? (
                            <Link 
                              to={`/admin/referrals/influencers/${influencer.id}`}
                              className="hover:text-primary"
                            >
                              {influencer.first_name || "—"} {influencer.last_name || ""}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${Number(attr.customer_discount_amount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(attr.status)}</TableCell>
                        <TableCell>
                          {attr.fraud_flag_level && typeof attr.fraud_flag_level === 'number' ? (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-orange-500" />
                              {getFraudBadge(attr.fraud_flag_level)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Aucun</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReferralAttributions;
