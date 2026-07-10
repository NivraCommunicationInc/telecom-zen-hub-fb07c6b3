/**
 * ClientLoyalty — Feature 1 loyalty program for clients.
 * Reads loyalty_points / loyalty_rewards / loyalty_transactions / loyalty_redemptions.
 */
import { useEffect, useState } from "react";
import { portalClient } from "@/integrations/backend/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { useLoyaltyReferralRealtime } from "@/hooks/useLoyaltyReferralRealtime";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Award, Gift, History, TrendingUp } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type LoyaltyPoints = {
  account_id: string;
  total_points: number;
  available_points: number;
  lifetime_points: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  card_number?: string;
};
type Reward = {
  id: string; name_fr: string; description_fr: string | null;
  points_required: number; reward_type: string; reward_value: number | null;
};
type Tx = {
  id: string; type: string; points: number; description: string;
  balance_after: number; created_at: string;
};

const TIER_INFO: Record<string, { label: string; color: string; min: number; next: number | null }> = {
  bronze: { label: "Bronze", color: "#cd7f32", min: 0, next: 500 },
  silver: { label: "Argent", color: "#c0c0c0", min: 500, next: 1500 },
  gold: { label: "Or", color: "#d4af37", min: 1500, next: 5000 },
  platinum: { label: "Platine", color: "#7c3aed", min: 5000, next: null },
};

export default function ClientLoyalty() {
  const { user } = useClientAuth();
  const { data: canonicalData, isLoading: canonicalLoading, refetch } = useCanonicalClientData(user?.id);
  const [points, setPoints] = useState<LoyaltyPoints | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [history, setHistory] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmReward, setConfirmReward] = useState<Reward | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const accountIds = canonicalData?.identifiers?.accountIds || [];
    if (accountIds.length === 0) { setLoading(false); return; }
    const accountId = accountIds[0];
    const r = canonicalData?.loyaltyRewards || [];
    const p = (canonicalData?.loyaltyPoints || []).find((row: any) => row.account_id === accountId) || canonicalData?.loyaltyPoints?.[0];
    const h = (canonicalData?.loyaltyTransactions || []).filter((row: any) => !row.account_id || row.account_id === accountId).slice(0, 20);
    setPoints((p as LoyaltyPoints) || { account_id: accountId, total_points: 0, available_points: 0, lifetime_points: 0, tier: "bronze" });
    setRewards((r as Reward[]) || []);
    setHistory((h as Tx[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (!canonicalLoading) load(); /* eslint-disable-next-line */ }, [user?.id, canonicalLoading, canonicalData?.projection?.lastRefreshedAt]);

  // Realtime: any admin adjustment/approval/transfer in Core refreshes here.
  useLoyaltyReferralRealtime(user?.id, () => { refetch(); });

  const handleRedeem = async () => {
    if (!confirmReward || !points || redeeming) return;
    setRedeeming(true);
    // F32-2/3: idempotency_key obligatoire — empêche double-clic / retry réseau
    const idem = `redeem-${points.account_id}-${confirmReward.id}-${crypto.randomUUID()}`;
    const { data, error } = await portalClient.rpc("redeem_loyalty_reward", {
      p_account_id: points.account_id,
      p_reward_id: confirmReward.id,
      p_idempotency_key: idem,
    });
    setRedeeming(false);
    setConfirmReward(null);
    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || error?.message || "Échec de l'échange");
      return;
    }
    toast.success("Récompense échangée avec succès");
    await refetch();
  };

  const tier = TIER_INFO[points?.tier || "bronze"];
  const lifetime = points?.lifetime_points || 0;
  const progress = tier.next ? Math.min(100, ((lifetime - tier.min) / (tier.next - tier.min)) * 100) : 100;
  const pointsToNext = tier.next ? Math.max(0, tier.next - lifetime) : 0;

  return (
    <ClientLayout>
      <main className="max-w-[1200px] mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Programme de fidélité</h1>
          <p className="text-slate-600 mt-1">Gagnez des points à chaque paiement et échangez-les contre des récompenses.</p>
        </header>

        {/* Loyalty card visual */}
        {points?.card_number && (
          <div
            className="relative rounded-2xl overflow-hidden p-6 text-white shadow-xl"
            style={{ background: "linear-gradient(135deg, #0066CC 0%, #7C3AED 100%)", minHeight: 180 }}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px), radial-gradient(circle at 20% 80%, white 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }} />
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg tracking-wide">NIVRA FIDÉLITÉ</span>
                <Badge style={{ background: tier.color, color: "white" }} className="text-sm px-3 py-1">
                  <Award className="w-3 h-3 mr-1" />{tier.label}
                </Badge>
              </div>
              <div className="mt-8">
                <p className="text-xs opacity-70 mb-1 tracking-widest">NUMÉRO DE CARTE</p>
                <p className="text-2xl font-mono font-bold tracking-widest">{points.card_number}</p>
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  <p className="text-xs opacity-70">Points disponibles</p>
                  <p className="text-3xl font-bold">{(points?.available_points ?? 0).toLocaleString("fr-CA")}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">Total vie</p>
                  <p className="text-lg font-semibold">{(points?.lifetime_points || 0).toLocaleString("fr-CA")} pts</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Balance & tier */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Points disponibles</p>
                <p className="text-5xl font-bold" style={{ color: "#7c3aed" }}>
                  {loading ? "…" : (points?.available_points ?? 0).toLocaleString("fr-CA")}
                </p>
                <p className="text-xs text-slate-500 mt-1">Total vie : {(points?.lifetime_points || 0).toLocaleString("fr-CA")} pts</p>
              </div>
              <div className="text-right">
                <Badge style={{ background: tier.color, color: "white" }} className="text-base px-4 py-1.5">
                  <Award className="w-4 h-4 mr-1" />Niveau {tier.label}
                </Badge>
                {tier.next && (
                  <p className="text-xs text-slate-600 mt-2">Prochain niveau — encore {pointsToNext.toLocaleString("fr-CA")} pts</p>
                )}
              </div>
            </div>
            {tier.next && <Progress value={progress} className="mt-4" />}
          </CardContent>
        </Card>

        {/* How to earn */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" />Comment gagner des points</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• <strong>Paiement de facture :</strong> 100 pts (montant indépendant)</li>
              <li>• <strong>Bonus AutoPay (Square) :</strong> +25 pts</li>
              <li>• <strong>Bonus paiement à temps :</strong> +25 pts</li>
              <li>• <strong>Activation d'un nouveau service :</strong> 100 pts</li>
              <li>• <strong>Parrainage activé :</strong> 300 pts</li>
              <li>• <strong>Anniversaire de compte :</strong> 100 pts par année</li>
              <li className="text-slate-500 text-xs mt-2">Échangez vos points contre des crédits ou un mois gratuit — voir le catalogue ci-dessous.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Rewards catalog */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="w-5 h-5" />Catalogue de récompenses</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((r) => {
                const canRedeem = (points?.available_points || 0) >= r.points_required;
                return (
                  <div key={r.id} className="border rounded-lg p-4 flex flex-col">
                    <h3 className="font-semibold text-slate-900">{r.name_fr}</h3>
                    <p className="text-xs text-slate-600 mt-1 flex-1">{r.description_fr}</p>
                    <p className="text-lg font-bold mt-3" style={{ color: "#7c3aed" }}>{r.points_required.toLocaleString("fr-CA")} pts</p>
                    <Button
                      className="mt-2 w-full"
                      disabled={!canRedeem}
                      onClick={() => setConfirmReward(r)}
                      style={canRedeem ? { background: "#7c3aed" } : undefined}
                    >
                      {canRedeem ? "Échanger" : `Encore ${(r.points_required - (points?.available_points || 0)).toLocaleString("fr-CA")} pts`}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />Historique</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune transaction pour le moment.</p>
            ) : (
              <div className="divide-y">
                {history.map((tx) => (
                  <div key={tx.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-slate-900">{tx.description}</p>
                      <p className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleString("fr-CA")}</p>
                    </div>
                    <div className="text-right">
                      <p className={tx.points >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                        {tx.points >= 0 ? "+" : ""}{tx.points} pts
                      </p>
                      <p className="text-xs text-slate-500">Solde : {tx.balance_after}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!confirmReward} onOpenChange={(o) => !o && setConfirmReward(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'échange</DialogTitle>
            <DialogDescription>
              Utiliser <strong>{confirmReward?.points_required.toLocaleString("fr-CA")} points</strong> pour : {confirmReward?.name_fr} ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReward(null)}>Annuler</Button>
            <Button onClick={handleRedeem} disabled={redeeming} style={{ background: "#7c3aed" }}>
              {redeeming ? "Échange…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
}
