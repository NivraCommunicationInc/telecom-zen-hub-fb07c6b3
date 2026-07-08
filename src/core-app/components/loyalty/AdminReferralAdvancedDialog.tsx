/**
 * AdminReferralAdvancedDialog — Advanced referral actions for Core admins:
 *   - Reassign referrer  (admin_referral_reassign)
 *   - Manual reward      (admin_referral_manual_reward)
 *   - Clawback           (admin_referral_clawback)
 *
 * Approve / reject use the existing UI in CoreReferralsPage which calls
 * admin_referral_decide (or the reward mutation) directly.
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
  const [rewardKind, setRewardKind] = useState<"points" | "cash">("points");
  const [rewardValue, setRewardValue] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!referral) return null;

  const run = async () => {
    if (!reason.trim()) { toast.error("Raison obligatoire"); return; }
    setBusy(true);
    try {
      let res: any;
      if (tab === "reassign") {
        if (!newReferrer.trim()) { toast.error("user_id du nouveau parrain requis"); setBusy(false); return; }
        res = await supabase.rpc("admin_referral_reassign", {
          p_referral_id: referral.id,
          p_new_referrer_user_id: newReferrer.trim(),
          p_reason: reason,
        });
      } else if (tab === "manual") {
        res = await supabase.rpc("admin_referral_manual_reward", {
          p_referrer_user_id: referral.referrer_user_id,
          p_kind: rewardKind,
          p_value: Number(rewardValue),
          p_reason: reason,
          p_referred_user_id: referral.referred_user_id ?? null,
        });
      } else if (tab === "clawback") {
        res = await supabase.rpc("admin_referral_clawback", {
          p_referral_id: referral.id,
          p_reason: reason,
        });
      }
      if (res?.error) throw res.error;
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
