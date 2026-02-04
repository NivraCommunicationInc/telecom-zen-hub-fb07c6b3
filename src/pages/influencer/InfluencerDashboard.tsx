import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import InfluencerLayout from "@/components/influencer/InfluencerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  Clock,
  CheckCircle,
  DollarSign,
  Wallet,
  Copy,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import { toast } from "sonner";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";

const InfluencerDashboard = () => {
  const { influencer } = useInfluencerAuth();
  const navigate = useNavigate();
  // Fetch primary referral code
  const { data: primaryCode } = useQuery({
    queryKey: ["influencer-primary-code", influencer?.id],
    queryFn: async () => {
      if (!influencer?.id) return null;
      
      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("influencer_id", influencer.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching code:", error);
        return null;
      }
      return data;
    },
    enabled: !!influencer?.id,
  });

  // Fetch referral stats
  const { data: stats } = useQuery({
    queryKey: ["influencer-stats", influencer?.id],
    queryFn: async () => {
      if (!influencer?.id) return { total: 0, pending: 0, approved: 0 };
      
      const { data: attributions, error } = await supabase
        .from("referral_attributions")
        .select("id, status")
        .eq("influencer_id", influencer.id);

      if (error) {
        console.error("Error fetching stats:", error);
        return { total: 0, pending: 0, approved: 0 };
      }

      return {
        total: attributions?.length || 0,
        pending: attributions?.filter((a) => a.status === "pending").length || 0,
        approved: attributions?.filter((a) => a.status === "approved").length || 0,
      };
    },
    enabled: !!influencer?.id,
  });

  // Fetch balance from ledger
  const { data: balance } = useQuery({
    queryKey: ["influencer-balance", influencer?.id],
    queryFn: async () => {
      if (!influencer?.id) return { pending: 0, approved: 0, available: 0, paid: 0 };
      
      const { data: ledger, error } = await supabase
        .from("commission_ledger_entries")
        .select("type, amount, status")
        .eq("influencer_id", influencer.id);

      if (error) {
        console.error("Error fetching balance:", error);
        return { pending: 0, approved: 0, available: 0, paid: 0 };
      }

      let pending = 0;
      let approved = 0;
      let paid = 0;

      ledger?.forEach((entry) => {
        const amount = Number(entry.amount);
        if (entry.type === "pending_credit" && entry.status === "pending") {
          pending += amount;
        } else if (entry.type === "approved_credit" || (entry.type === "pending_credit" && entry.status === "approved")) {
          approved += amount;
        } else if (entry.type === "reversal") {
          approved += amount; // negative
        } else if (entry.type === "payout_debit") {
          paid += Math.abs(amount);
        }
      });

      const available = approved - paid;

      return { pending, approved, available, paid };
    },
    enabled: !!influencer?.id,
  });

  // Fetch program settings for minimum cashout
  const { data: settings } = useQuery({
    queryKey: ["referral-program-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_program_settings")
        .select("min_cashout_amount")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching settings:", error);
        return { min_cashout_amount: 50 };
      }
      return data || { min_cashout_amount: 50 };
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié!");
  };

  const shareLink = primaryCode ? `https://nivra-telecom.ca/?ref=${primaryCode.code}` : "";

  const canRequestCashout = (balance?.available || 0) >= (settings?.min_cashout_amount || 50);

  return (
    <InfluencerLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bonjour, {influencer?.first_name}! 👋
          </h1>
          <p className="text-muted-foreground">
            Voici un aperçu de votre performance
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Parrainages</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.total || 0}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-cyan-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-3xl font-bold text-foreground">
                    ${balance?.pending?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <Clock className="w-10 h-10 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Disponible</p>
                  <p className="text-3xl font-bold text-foreground">
                    ${balance?.available?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total payé</p>
                  <p className="text-3xl font-bold text-foreground">
                    ${balance?.paid?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Referral Tools */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vos outils de parrainage</CardTitle>
              <CardDescription>
                Partagez votre code pour gagner des commissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {primaryCode ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Votre code</label>
                    <div className="flex gap-2">
                      <Input
                        value={primaryCode.code}
                        readOnly
                        className="font-mono text-lg font-bold"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(primaryCode.code)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Lien de partage</label>
                    <div className="flex gap-2">
                      <Input value={shareLink} readOnly className="text-sm" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(shareLink)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 bg-primary/10 rounded-lg text-sm">
                    <p className="font-medium text-primary">💡 Astuce</p>
                    <p className="text-muted-foreground mt-1">
                      Partagez votre lien sur vos réseaux sociaux pour maximiser vos gains!
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Aucun code actif. Contactez le support.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cashout Card */}
          <Card className={canRequestCashout ? "border-green-500/30" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Demander un retrait
              </CardTitle>
              <CardDescription>
                Minimum: ${settings?.min_cashout_amount?.toFixed(2) || "50.00"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">Solde disponible</p>
                <p className="text-4xl font-bold text-foreground">
                  ${balance?.available?.toFixed(2) || "0.00"}
                </p>
              </div>

              <Button
                className="w-full"
                disabled={!canRequestCashout}
                onClick={() => navigate("/influencer/cashouts")}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                {canRequestCashout ? "Demander un retrait" : "Seuil non atteint"}
              </Button>

              {!canRequestCashout && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Vous devez avoir au moins ${settings?.min_cashout_amount?.toFixed(2) || "50.00"} pour demander un retrait
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/influencer/referrals">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="font-medium">Mes parrainages</span>
                <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link to="/influencer/earnings">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-primary" />
                <span className="font-medium">Historique des gains</span>
                <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link to="/influencer/settings">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="font-medium">Paramètres de paiement</span>
                <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
        
        {/* Help Footer */}
        <PartnerHelpFooter />
      </div>
    </InfluencerLayout>
  );
};

export default InfluencerDashboard;
