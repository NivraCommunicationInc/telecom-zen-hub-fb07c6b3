/**
 * AdminReferralAdvancedDialog — Advanced referral actions for Core admins.
 *
 * All mutations route through canonical Edge Functions (Module 33 Phase D):
 *   - Reassign / Clawback → referrals-account-actions (rpc_referral_apply_action)
 *   - Manual bonus        → admin-referrals-manage (per-influencer credit)
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ArrowRightLeft, Gift, Ban } from "lucide-react";
import { toast } from "sonner";

interface Props {
  referral: any | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminReferralAdvancedDialog({ referral, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<"reassign" | "manual" | "clawback">("reassign");
  const [newReferrer, setNewReferrer] = useState("");
  const [targetInfluencerId, setTargetInfluencerId] = useState("");
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!referral) return null;

  const run = async () => {
    if (!reason.trim() || reason.trim().length < 5) {
      toast.error("Raison obligatoire (5 caractères min.)");
      return;
    }
    setBusy(true);
    try {
      const idem = `${tab}:${referral.id}:${Date.now()}`;
      let res: any;
      if (tab === "reassign") {
        if (!newReferrer.trim()) { toast.error("user_id du nouveau parrain requis"); setBusy(false); return; }
        res = await supabase.functions.invoke("referrals-account-actions", {
          body: {
            action: "reassign",
            client_user_id: referral.referrer_user_id,
            referral_id: referral.id,
            new_referrer_user_id: newReferrer.trim(),
            reason,
            idempotency_key: idem,
          },
        });
      } else if (tab === "manual") {
        if (!targetInfluencerId.trim()) { toast.error("influencer_id cible requis"); setBusy(false); return; }
        res = await supabase.functions.invoke("admin-referrals-manage", {
          body: {
            action: "manual_bonus",
            target_influencer_id: targetInfluencerId.trim(),
            bonus_amount: Number(bonusAmount),
            reason,
            idempotency_key: idem,
          },
        });
      } else if (tab === "clawback") {
        res = await supabase.functions.invoke("referrals-account-actions", {
          body: {
            action: "clawback",
            client_user_id: referral.referrer_user_id,
            referral_id: referral.id,
            reason,
            idempotency_key: idem,
          },
        });
      }
      if (res?.error) throw new Error(res.error.message || String(res.error));
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success("Action appliquée");
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };


  return (
    <Dialog open={!!referral} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Actions avancées — Parrainage</DialogTitle>
          <DialogDescription>
            Referral <span className="font-mono">{referral.id}</span>. Chaque
            action est journalisée et propagée en temps réel.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="reassign"><ArrowRightLeft className="h-3 w-3 mr-1" />Réattribuer</TabsTrigger>
            <TabsTrigger value="manual"><Gift className="h-3 w-3 mr-1" />Récompense</TabsTrigger>
            <TabsTrigger value="clawback"><Ban className="h-3 w-3 mr-1" />Clawback</TabsTrigger>
          </TabsList>

          <TabsContent value="reassign" className="space-y-3 mt-3">
            <div>
              <label className="text-xs font-medium">Parrain actuel</label>
              <Input value={referral.referrer_user_id ?? "—"} readOnly className="font-mono text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium">Nouveau parrain (user_id)</label>
              <Input value={newReferrer} onChange={(e) => setNewReferrer(e.target.value)}
                placeholder="uuid" className="font-mono text-xs" />
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant={rewardKind === "points" ? "default" : "outline"}
                onClick={() => setRewardKind("points")}>Points</Button>
              <Button size="sm" variant={rewardKind === "cash" ? "default" : "outline"}
                onClick={() => setRewardKind("cash")}>Cash ($)</Button>
            </div>
            <div>
              <label className="text-xs font-medium">
                {rewardKind === "points" ? "Points à créditer" : "Montant ($)"}
              </label>
              <Input type="number" step={rewardKind === "cash" ? "0.01" : "1"}
                value={rewardValue}
                onChange={(e) => setRewardValue(Number(e.target.value))} />
            </div>
          </TabsContent>

          <TabsContent value="clawback" className="space-y-3 mt-3">
            <p className="text-sm text-muted-foreground">
              Récupère la récompense déjà versée pour ce parrainage (annulation
              ou fraude). Le solde du parrain est réduit et la référence
              marquée comme <strong>clawback</strong>.
            </p>
          </TabsContent>
        </Tabs>

        <div>
          <label className="text-xs font-medium">Raison (obligatoire)</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
            rows={3} placeholder="Motif détaillé, ticket, décision manager…" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={run} disabled={busy || !reason.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
