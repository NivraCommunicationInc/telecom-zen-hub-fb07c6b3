import { useQuery } from "@tanstack/react-query";
import InfluencerLayout from "@/components/influencer/InfluencerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";

const InfluencerEarnings = () => {
  const { influencer } = useInfluencerAuth();

  // Fetch ledger entries
  const { data: ledgerEntries, isLoading } = useQuery({
    queryKey: ["influencer-ledger-full", influencer?.id],
    queryFn: async () => {
      if (!influencer?.id) return [];
      
      const { data, error } = await supabase
        .from("commission_ledger_entries")
        .select("*")
        .eq("influencer_id", influencer.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching ledger:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!influencer?.id,
  });

  // Calculate totals
  const totals = ledgerEntries?.reduce(
    (acc, entry) => {
      const amount = Number(entry.amount);
      if (entry.type === "pending_credit") {
        if (entry.status === "pending") acc.pending += amount;
        else if (entry.status === "approved") acc.approved += amount;
      } else if (entry.type === "approved_credit") {
        acc.approved += amount;
      } else if (entry.type === "reversal") {
        acc.reversals += Math.abs(amount);
      } else if (entry.type === "payout_debit") {
        acc.paid += Math.abs(amount);
      } else if (entry.type === "manual_adjustment") {
        if (amount > 0) acc.approved += amount;
        else acc.reversals += Math.abs(amount);
      }
      return acc;
    },
    { pending: 0, approved: 0, reversals: 0, paid: 0 }
  ) || { pending: 0, approved: 0, reversals: 0, paid: 0 };

  const available = totals.approved - totals.paid - totals.reversals;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "pending_credit":
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case "approved_credit":
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Approuvé</Badge>;
      case "reversal":
        return <Badge className="bg-red-500/20 text-red-400"><TrendingDown className="w-3 h-3 mr-1" />Annulation</Badge>;
      case "payout_debit":
        return <Badge className="bg-purple-500/20 text-purple-400"><DollarSign className="w-3 h-3 mr-1" />Paiement</Badge>;
      case "manual_adjustment":
        return <Badge className="bg-blue-500/20 text-blue-400">Ajustement</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <InfluencerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historique des Gains</h1>
          <p className="text-muted-foreground">
            Consultez toutes vos transactions de commission
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">En attente</span>
              </div>
              <p className="text-2xl font-bold">${totals.pending.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Disponible</span>
              </div>
              <p className="text-2xl font-bold text-green-500">${available.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Total payé</span>
              </div>
              <p className="text-2xl font-bold">${totals.paid.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Annulations</span>
              </div>
              <p className="text-2xl font-bold">${totals.reversals.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Ledger Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transactions</CardTitle>
            <CardDescription>Détail de toutes les entrées de commission</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : ledgerEntries?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">Aucune transaction</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerEntries?.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">
                        {new Date(entry.created_at).toLocaleDateString("fr-CA")}
                      </TableCell>
                      <TableCell>{getTypeBadge(entry.type)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{entry.status}</Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${Number(entry.amount) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {Number(entry.amount) >= 0 ? "+" : ""}${Number(entry.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {entry.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Help Footer */}
        <PartnerHelpFooter />
      </div>
    </InfluencerLayout>
  );
};

export default InfluencerEarnings;
