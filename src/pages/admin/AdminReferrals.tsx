import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  QrCode, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  Plus,
  Search,
  Settings,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminReferrals = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch overview stats
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ["referral-stats"],
    queryFn: async () => {
      const [influencers, codes, attributions, pendingCashouts, pendingInfluencers] = await Promise.all([
        supabase.from("influencers").select("id, status", { count: "exact" }),
        supabase.from("referral_codes").select("id", { count: "exact" }),
        supabase.from("referral_attributions").select("id, customer_discount_amount", { count: "exact" }),
        supabase.from("cashout_requests").select("id, amount").eq("status", "requested"),
        // Count pending influencers separately
        supabase.from("influencers").select("id", { count: "exact" }).eq("status", "pending"),
      ]);

      const totalDiscounts = attributions.data?.reduce((sum, a) => sum + (Number(a.customer_discount_amount) || 0), 0) || 0;
      const pendingPayouts = pendingCashouts.data?.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) || 0;

      return {
        totalInfluencers: influencers.count || 0,
        activeInfluencers: influencers.data?.filter(i => i.status === "active").length || 0,
        pendingInfluencers: pendingInfluencers.count || 0,
        totalCodes: codes.count || 0,
        totalReferrals: attributions.count || 0,
        totalDiscounts,
        pendingCashouts: pendingCashouts.count || 0,
        pendingPayouts,
      };
    },
  });

  // Fetch recent influencers
  const { data: recentInfluencers, isLoading: influencersLoading, error: influencersError, refetch: refetchInfluencers } = useQuery({
    queryKey: ["recent-influencers", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("influencers")
        .select(`
          *,
          referral_codes(id),
          referral_attributions(id)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch pending cashouts
  const { data: pendingCashouts, isLoading: cashoutsLoading } = useQuery({
    queryKey: ["pending-cashouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashout_requests")
        .select(`
          *,
          influencers(first_name, last_name, email)
        `)
        .eq("status", "requested")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Actif</Badge>;
      case "invited":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Invité</Badge>;
      case "pending":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">En attente</Badge>;
      case "suspended":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Suspendu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Programme de Parrainage</h1>
            <p className="text-muted-foreground">Gérez vos influenceurs, codes et commissions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/referrals/settings">
                <Settings className="w-4 h-4 mr-2" />
                Paramètres
              </Link>
            </Button>
            <Button onClick={() => navigate("/admin/referrals/influencers")}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel Influenceur
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Influenceurs Actifs</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.activeInfluencers || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">sur {stats?.totalInfluencers || 0} total</p>
                </div>
                <Users className="w-10 h-10 text-cyan-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Codes Actifs</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.totalCodes || 0}</p>
                </div>
                <QrCode className="w-10 h-10 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Parrainages</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.totalReferrals || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">${stats?.totalDiscounts?.toFixed(2) || "0.00"} rabais</p>
                </div>
                <TrendingUp className="w-10 h-10 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Demandes partenaires</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.pendingInfluencers || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">en attente d'approbation</p>
                </div>
                <Clock className="w-10 h-10 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Influenceurs", href: "/admin/referrals/influencers", icon: Users },
            { label: "Codes", href: "/admin/referrals/codes", icon: QrCode },
            { label: "Parrainages", href: "/admin/referrals/attributions", icon: TrendingUp },
            { label: "Commissions", href: "/admin/referrals/commissions", icon: DollarSign },
            { label: "Retraits", href: "/admin/referrals/cashouts", icon: CheckCircle },
            { label: "Paramètres", href: "/admin/referrals/settings", icon: Settings },
          ].map((link) => (
            <Link key={link.href} to={link.href}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <link.icon className="w-5 h-5 text-primary" />
                  <span className="font-medium text-sm">{link.label}</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Influencers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Influenceurs Récents</CardTitle>
                <CardDescription>Derniers partenaires ajoutés</CardDescription>
              </div>
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {influencersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : influencersError ? (
                <Alert variant="destructive" className="m-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Erreur de chargement</span>
                    <Button variant="outline" size="sm" onClick={() => refetchInfluencers()}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : !recentInfluencers || recentInfluencers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun influenceur trouvé
                </p>
              ) : (
                recentInfluencers.map((influencer) => (
                  <Link
                    key={influencer.id}
                    to={`/admin/referrals/influencers/${influencer.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {(influencer.first_name || "?")[0]}{(influencer.last_name || "?")[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {influencer.first_name || "—"} {influencer.last_name || ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{influencer.email || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{influencer.referral_codes?.length || 0} codes</p>
                        <p>{influencer.referral_attributions?.length || 0} refs</p>
                      </div>
                      {getStatusBadge(influencer.status)}
                    </div>
                  </Link>
                ))
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link to="/admin/referrals/influencers">
                  Voir tous les influenceurs
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Pending Cashouts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Demandes de Retrait en Attente
              </CardTitle>
              <CardDescription>Retraits à traiter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cashoutsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !pendingCashouts || pendingCashouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Aucune demande en attente
                  </p>
                </div>
              ) : (
                pendingCashouts.map((cashout) => (
                  <div
                    key={cashout.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {cashout.influencers?.first_name || "—"} {cashout.influencers?.last_name || ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cashout.request_number || "—"} • {cashout.method || "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-500">
                        ${Number(cashout.amount || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cashout.created_at ? new Date(cashout.created_at).toLocaleDateString("fr-CA") : "—"}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {(pendingCashouts?.length || 0) > 0 && (
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/admin/referrals/cashouts">
                    Gérer les retraits
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminReferrals;
