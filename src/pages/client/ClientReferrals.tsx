/**
 * ClientReferrals — Client portal referral program page
 * Shows referral code, stats, history, and reward status
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ClientLayout from "@/components/client/ClientLayout";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/hooks/useClientAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, Users, Clock, CheckCircle, DollarSign, Share2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  code_used: "Code utilisé",
  order_created: "Commande créée",
  service_activated: "Service activé",
  cycle_1_paid: "Cycle 1 payé",
  cycle_2_paid: "Cycle 2 payé",
  cycle_3_paid: "Cycle 3 payé",
  qualified: "Qualifié",
  reward_pending: "Récompense en attente",
  reward_issued: "Récompense envoyée",
  cancelled: "Annulé",
  disqualified: "Disqualifié",
  fraud_review: "En révision",
};

const REWARD_STATUS_LABELS: Record<string, string> = {
  not_eligible: "Non éligible",
  in_progress: "En progression",
  qualified: "Qualifié",
  reward_pending: "En attente d'envoi",
  reward_issued: "Récompense envoyée",
  cancelled: "Annulé",
};

function getStatusColor(status: string) {
  if (["qualified", "reward_pending", "reward_issued"].includes(status)) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (["cancelled", "disqualified", "fraud_review"].includes(status)) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400";
}

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = Math.min(100, (paid / total) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{paid} / {total} cycles payés</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const ClientReferrals = () => {
  const { user } = useClientAuth();

  const { data: profile } = useQuery({
    queryKey: ["client-referral-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("referral_code, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ["client-my-referrals", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("client_referrals" as any)
        .select("*")
        .eq("referrer_user_id", user.id)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!user?.id,
  });

  const stats = {
    total: referrals.length,
    inProgress: referrals.filter((r: any) => ["code_used", "order_created", "service_activated", "cycle_1_paid", "cycle_2_paid", "cycle_3_paid"].includes(r.status)).length,
    qualified: referrals.filter((r: any) => ["qualified", "reward_pending", "reward_issued"].includes(r.status)).length,
    rewardsPending: referrals.filter((r: any) => r.reward_status === "reward_pending").length,
    rewardsIssued: referrals.filter((r: any) => r.reward_status === "reward_issued").length,
    totalEarned: referrals.filter((r: any) => r.reward_status === "reward_issued").reduce((sum: number, r: any) => sum + Number(r.reward_amount || 0), 0),
  };

  const copyCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      toast.success("Code copié !");
    }
  };

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            Programme de parrainage
          </h1>
          <p className="text-muted-foreground mt-1">
            Parrainez vos proches et recevez une carte-cadeau Visa/Mastercard de 25$ pour chaque parrainage qualifié.
          </p>
        </div>

        {/* Referral Code Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Votre code de parrainage</p>
                <p className="text-3xl font-bold font-mono tracking-wider text-primary">
                  {profile?.referral_code || "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={copyCode} variant="outline" className="gap-2">
                  <Copy className="w-4 h-4" />
                  Copier
                </Button>
                <Button 
                  onClick={() => {
                    const text = `Utilise mon code ${profile?.referral_code} pour un rabais chez Nivra Télécom ! 🎁`;
                    if (navigator.share) {
                      navigator.share({ title: "Nivra Parrainage", text });
                    } else {
                      navigator.clipboard.writeText(text);
                      toast.success("Message copié !");
                    }
                  }}
                  className="gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Partager
                </Button>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-background/60 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Comment ça fonctionne ?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Partagez votre code avec un proche</li>
                <li>Votre proche utilise le code lors de sa commande</li>
                <li>Après 3 cycles de facturation payés, vous recevez votre carte-cadeau de 25$</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-5 h-5 text-sky-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Parrainages</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">En cours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.qualified}</p>
              <p className="text-xs text-muted-foreground">Qualifiés</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.totalEarned.toFixed(0)}$</p>
              <p className="text-xs text-muted-foreground">Gagné</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historique de parrainage</CardTitle>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Aucun parrainage pour le moment</p>
                <p className="text-sm mt-1">Partagez votre code pour commencer à gagner des récompenses</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((r: any) => (
                  <div key={r.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${getStatusColor(r.status)} border-0 text-xs`}>
                            {STATUS_LABELS[r.status] || r.status}
                          </Badge>
                          {r.reward_status === "reward_issued" && (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
                              🎁 {r.reward_amount}$ reçu
                            </Badge>
                          )}
                          {r.reward_status === "reward_pending" && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
                              ⏳ Récompense en attente
                            </Badge>
                          )}
                        </div>
                        <ProgressBar paid={r.qualifying_cycles_paid || 0} total={r.required_cycles || 3} />
                        <p className="text-xs text-muted-foreground">
                          Parrainé le {new Date(r.created_at).toLocaleDateString("fr-CA")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{r.reward_amount}$</p>
                        <p className="text-xs text-muted-foreground">Récompense</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Terms */}
        <div className="text-xs text-muted-foreground space-y-1 p-4">
          <p className="font-medium">Conditions du programme</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>La récompense de 25$ est sous forme de carte-cadeau Visa/Mastercard prépayée</li>
            <li>Le client référé doit compléter 3 cycles de facturation mensuelle payés</li>
            <li>L'auto-parrainage est interdit</li>
            <li>Un seul parrainage par nouveau client</li>
            <li>Nivra se réserve le droit de disqualifier les parrainages frauduleux</li>
          </ul>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientReferrals;
