import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import InfluencerLayout from "@/components/influencer/InfluencerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";

const InfluencerReferrals = () => {
  const { influencer } = useInfluencerAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch referrals
  const { data: referrals, isLoading } = useQuery({
    queryKey: ["influencer-referrals", influencer?.id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("referral_attributions")
        .select("*")
        .eq("influencer_id", influencer?.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!influencer?.id,
  });

  // Mask customer identifier: show only initials and city/month
  const maskCustomer = (email?: string, createdAt?: string) => {
    if (!email) return "Client";
    const parts = email.split("@")[0];
    const initials = parts.slice(0, 2).toUpperCase();
    const month = createdAt ? new Date(createdAt).toLocaleDateString("fr-CA", { month: "short", year: "numeric" }) : "";
    return `${initials}** • ${month}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">En attente</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approuvé</Badge>;
      case "hold":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">En révision</Badge>;
      case "disputed":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Contesté</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Refusé</Badge>;
      case "reversed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Annulé</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: referrals?.length || 0,
    pending: referrals?.filter((r) => r.status === "pending").length || 0,
    approved: referrals?.filter((r) => r.status === "approved").length || 0,
  };

  return (
    <InfluencerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes Parrainages</h1>
          <p className="text-muted-foreground">
            Suivez vos clients référés et leurs statuts
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-500">{stats.approved}</p>
              <p className="text-sm text-muted-foreground">Approuvés</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvés</SelectItem>
                  <SelectItem value="hold">En révision</SelectItem>
                  <SelectItem value="disputed">Contestés</SelectItem>
                  <SelectItem value="rejected">Refusés</SelectItem>
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
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Rabais appliqué</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : referrals?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">Aucun parrainage trouvé</p>
                      <p className="text-sm text-muted-foreground">
                        Partagez votre code pour commencer à gagner!
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  referrals?.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="text-sm">
                        {new Date(referral.created_at).toLocaleDateString("fr-CA")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {maskCustomer(referral.customer_email, referral.created_at)}
                      </TableCell>
                      <TableCell>{getStatusBadge(referral.status)}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(referral.customer_discount_amount).toFixed(2)}
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

export default InfluencerReferrals;
