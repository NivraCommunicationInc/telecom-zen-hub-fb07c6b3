/**
 * CoreReferralRewardsPage — Referral reward queue & issuance console
 * Shows qualified referrals ready for reward, issued rewards, and pending reviews.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Gift, CheckCircle, Clock, DollarSign, Loader2, CreditCard,
} from "lucide-react";
import { toast } from "sonner";

const REWARD_STATUS_LABELS: Record<string, string> = {
  not_eligible: "Non éligible",
  pending: "En attente",
  reward_pending: "À émettre",
  reward_issued: "Émise",
};

function rewardBadgeClass(status: string) {
  if (status === "reward_issued") return "bg-emerald-600/15 text-emerald-400 border-0";
  if (status === "reward_pending") return "bg-amber-500/15 text-amber-400 border-0";
  return "bg-slate-600/15 text-slate-400 border-0";
}

const CoreReferralRewardsPage = () => {
  const queryClient = useQueryClient();

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["core-referral-rewards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_referrals" as any)
        .select("*")
        .in("status", ["qualified", "reward_pending", "reward_issued"])
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const issueRewardMutation = useMutation({
    mutationFn: async (referralId: string) => {
      const { error } = await supabase
        .from("client_referrals" as any)
        .update({
          status: "reward_issued",
          reward_status: "reward_issued",
          reward_issued_at: new Date().toISOString(),
          reward_amount: 25,
          reward_type: "gift_card",
        } as any)
        .eq("id", referralId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-referral-rewards"] });
      toast.success("Récompense émise avec succès");
    },
    onError: () => toast.error("Échec de l'émission"),
  });

  const pendingRewards = referrals.filter((r: any) => r.status === "qualified" || r.reward_status === "reward_pending");
  const issuedRewards = referrals.filter((r: any) => r.reward_status === "reward_issued");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Referral Rewards</h1>
        <p className="text-sm text-muted-foreground">
          File de récompenses de parrainage — cartes-cadeaux 25$
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingRewards.length}</p>
              <p className="text-xs text-muted-foreground">À émettre</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-foreground">{issuedRewards.length}</p>
              <p className="text-xs text-muted-foreground">Émises</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-sky-400" />
            <div>
              <p className="text-2xl font-bold text-foreground">
                {issuedRewards.reduce((sum: number, r: any) => sum + Number(r.reward_amount || 0), 0)} $
              </p>
              <p className="text-xs text-muted-foreground">Total émis</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : referrals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Aucune récompense qualifiée pour le moment</p>
        </div>
      ) : (
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Parrain</TableHead>
                <TableHead className="text-muted-foreground">Code</TableHead>
                <TableHead className="text-muted-foreground">Cycles payés</TableHead>
                <TableHead className="text-muted-foreground">Statut</TableHead>
                <TableHead className="text-muted-foreground">Montant</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.map((r: any) => (
                <TableRow key={r.id} className="border-border">
                  <TableCell className="text-foreground font-mono text-xs">
                    {r.referrer_user_id?.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="text-foreground font-mono">{r.referral_code_used}</TableCell>
                  <TableCell className="text-foreground">{r.qualifying_cycles_paid || 0}/3</TableCell>
                  <TableCell>
                    <Badge className={rewardBadgeClass(r.reward_status)}>
                      {REWARD_STATUS_LABELS[r.reward_status] || r.reward_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground">{r.reward_amount ? `${r.reward_amount} $` : "25 $"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(r.created_at).toLocaleDateString("fr-CA")}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.reward_status !== "reward_issued" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => issueRewardMutation.mutate(r.id)}
                        disabled={issueRewardMutation.isPending}
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                        Émettre
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default CoreReferralRewardsPage;
