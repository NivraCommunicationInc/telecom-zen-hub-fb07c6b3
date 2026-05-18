/**
 * ClientReferrals — Premium client portal referral program page
 * Shows referral code, stats, history, progress, and reward status
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ClientLayout from "@/components/client/ClientLayout";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/hooks/useClientAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, Users, Clock, CheckCircle, DollarSign, Share2, ArrowRight, CreditCard, TrendingUp, MessageCircle, Mail, Smartphone, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

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

function getStatusColor(status: string) {
  if (["qualified", "reward_pending", "reward_issued"].includes(status))
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (["cancelled", "disqualified", "fraud_review"].includes(status))
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400";
}

function CycleProgress({ paid, total }: { paid: number; total: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div
            className={`w-8 h-2 rounded-full transition-all ${
              i < paid ? "bg-emerald-500" : "bg-slate-200"
            }`}
          />
          <span className="text-[10px] text-muted-foreground">M{i + 1}</span>
        </div>
      ))}
      <span className="ml-2 text-xs font-medium text-muted-foreground">{paid}/{total}</span>
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
    inProgress: referrals.filter((r: any) =>
      ["code_used", "order_created", "service_activated", "cycle_1_paid", "cycle_2_paid", "cycle_3_paid"].includes(r.status)
    ).length,
    qualified: referrals.filter((r: any) =>
      ["qualified", "reward_pending", "reward_issued"].includes(r.status)
    ).length,
    rewardsPending: referrals.filter((r: any) => r.reward_status === "reward_pending").length,
    rewardsIssued: referrals.filter((r: any) => r.reward_status === "reward_issued").length,
    totalEarned: referrals
      .filter((r: any) => r.reward_status === "reward_issued")
      .reduce((sum: number, r: any) => sum + Number(r.reward_amount || 0), 0),
  };

  const referralLink = profile?.referral_code
    ? `https://nivra-telecom.ca/commander?ref=${profile.referral_code}`
    : "";

  const copyCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      toast.success("Code copié !");
    }
  };

  const copyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      toast.success("Lien copié! ✓");
    }
  };

  const shareCode = () => {
    const text = `Utilise mon code ${profile?.referral_code} chez Nivra Télécom et obtiens un rabais ! Moi aussi, je reçois une carte-cadeau de 25$ 🎁 ${referralLink}`;
    if (navigator.share) {
      navigator.share({ title: "Nivra Parrainage", text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Message copié !");
    }
  };

  const shareText = `Essayez Nivra Telecom! ${referralLink}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent("Essayez Nivra Telecom")}&body=${encodeURIComponent(shareText)}`;
  const smsUrl = `sms:?body=${encodeURIComponent(shareText)}`;

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Gift className="w-5 h-5 text-emerald-600" />
            </div>
            Programme de parrainage
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Parrainez vos proches et recevez une carte-cadeau Visa/Mastercard de 25$ pour chaque parrainage qualifié.
          </p>
        </div>

        {/* Referral Code Card — Premium */}
        <Card className="border-primary/20 overflow-hidden">
          <div className="bg-gradient-to-r from-[#003366] to-[#004488] p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <p className="text-white/60 text-sm font-medium mb-2">Votre code de parrainage</p>
                <p className="text-3xl sm:text-4xl font-bold font-mono tracking-widest text-white">
                  {profile?.referral_code || "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={copyCode}
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copier
                </Button>
                <Button
                  onClick={shareCode}
                  className="bg-white text-[#003366] hover:bg-white/90 gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Partager
                </Button>
              </div>
            </div>
          </div>
          <CardContent className="p-5 bg-slate-50 dark:bg-card">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground mb-1">Comment ça fonctionne ?</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Partagez votre code avec un proche</li>
                  <li>Votre proche utilise le code lors de sa commande Nivra</li>
                  <li>Après <strong>3 cycles de facturation mensuels payés</strong>, vous recevez votre carte-cadeau de 25$</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { icon: Users, label: "Parrainages", value: stats.total, color: "text-sky-500", bg: "bg-sky-50" },
            { icon: Clock, label: "En cours", value: stats.inProgress, color: "text-amber-500", bg: "bg-amber-50" },
            { icon: CheckCircle, label: "Qualifiés", value: stats.qualified, color: "text-emerald-500", bg: "bg-emerald-50" },
            { icon: DollarSign, label: "Total gagné", value: `${stats.totalEarned}$`, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <Card key={label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending Rewards Banner */}
        {stats.rewardsPending > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
            <Gift className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">
              {stats.rewardsPending} récompense{stats.rewardsPending > 1 ? "s" : ""} en attente d'envoi — Votre carte-cadeau sera émise sous peu !
            </p>
          </div>
        )}

        {/* Referral History */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            Historique de parrainage
          </h2>

          {referrals.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-8 h-8 text-slate-300" />
                </div>
                <p className="font-medium text-foreground mb-1">Aucun parrainage pour le moment</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Partagez votre code pour commencer à gagner des récompenses
                </p>
                <Button onClick={shareCode} className="gap-2">
                  <Share2 className="w-4 h-4" />
                  Partager mon code
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {referrals.map((r: any) => (
                <Card key={r.id} className="overflow-hidden">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-3 flex-1">
                        {/* Status badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${getStatusColor(r.status)} border-0 text-xs`}>
                            {STATUS_LABELS[r.status] || r.status}
                          </Badge>
                          {r.reward_status === "reward_issued" && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                              🎁 {r.reward_amount}$ reçu
                            </Badge>
                          )}
                          {r.reward_status === "reward_pending" && (
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                              ⏳ En attente d'envoi
                            </Badge>
                          )}
                        </div>

                        {/* Cycle progress */}
                        <CycleProgress
                          paid={r.qualifying_cycles_paid || 0}
                          total={r.required_cycles || 3}
                        />

                        {/* Date */}
                        <p className="text-xs text-muted-foreground">
                          Parrainé le {new Date(r.created_at).toLocaleDateString("fr-CA")}
                        </p>
                      </div>

                      {/* Reward amount */}
                      <div className="text-right shrink-0 sm:pl-4">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                          r.reward_status === "reward_issued"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-50 text-slate-600"
                        }`}>
                          <CreditCard className="w-3.5 h-3.5" />
                          <span className="text-sm font-semibold">{r.reward_amount}$</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Carte-cadeau</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Learn more link */}
        <div className="text-center pt-2">
          <Link to="/parrainage" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            En savoir plus sur le programme
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Terms */}
        <div className="text-xs text-muted-foreground space-y-1 p-4 bg-slate-50 dark:bg-card rounded-xl border">
          <p className="font-medium text-foreground">Conditions du programme</p>
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
