/**
 * ClientReferralsDialog — Staff management of a client's referrals.
 * Used in Nivra Core (Account 360) and Nivra OneView CS (Client 360).
 *
 * Reads from `client_referrals` via `referrals-account-actions` (list_for_client)
 * and exposes admin actions: qualify, issue reward, mark delivered, fraud,
 * clear fraud, disqualify. All writes are audited and trigger branded emails.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Users, CheckCircle2, Gift, Truck, ShieldAlert, ShieldCheck, XCircle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
}

interface Referral {
  id: string;
  referral_code_used: string;
  referred_user_id: string;
  referred_name?: string;
  referred_order_id: string | null;
  status: string;
  qualifying_cycles_paid: number;
  required_cycles: number;
  reward_status: string;
  reward_type: string | null;
  reward_amount: number | string | null;
  reward_reference: string | null;
  reward_card_provider: string | null;
  reward_issued_at: string | null;
  reward_sent_at: string | null;
  reward_delivered_at: string | null;
  qualified_at: string | null;
  disqualified_at: string | null;
  disqualification_reason: string | null;
  fraud_flag: boolean;
  fraud_review_notes: string | null;
  notes: string | null;
  created_at: string;
}

const fmt = (n: number | string | null) => {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(v) || 0);
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  code_used:         { label: "Code utilisé",        tone: "secondary" },
  order_created:     { label: "Commande créée",      tone: "secondary" },
  service_activated: { label: "Service activé",      tone: "secondary" },
  cycle_1_paid:      { label: "Cycle 1 payé",        tone: "secondary" },
  cycle_2_paid:      { label: "Cycle 2 payé",        tone: "secondary" },
  cycle_3_paid:      { label: "Cycle 3 payé",        tone: "secondary" },
  qualified:         { label: "Qualifié",            tone: "default" },
  reward_pending:    { label: "Récompense en attente", tone: "default" },
  reward_issued:     { label: "Récompense émise",    tone: "default" },
  cancelled:         { label: "Annulé",              tone: "outline" },
  disqualified:      { label: "Disqualifié",         tone: "destructive" },
  fraud_review:      { label: "Revue fraude",        tone: "destructive" },
};

const REWARD_LABEL: Record<string, string> = {
  not_eligible:   "Non admissible",
  in_progress:    "En cours",
  qualified:      "Qualifié",
  reward_pending: "À émettre",
  reward_issued:  "Émise",
  cancelled:      "Annulée",
};

export function ClientReferralsDialog({ open, onClose, clientUserId, clientName }: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [selected, setSelected] = useState<Referral | null>(null);

  // Action inputs
  const [rewardRef, setRewardRef] = useState("");
  const [rewardProvider, setRewardProvider] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [actionReason, setActionReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("referrals-account-actions", {
        body: { action: "list_for_client", client_user_id: clientUserId },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setReferrals(((data as { referrals: Referral[] }).referrals) || []);
    } catch (e: any) {
      // Extract actual server error if available
      let msg = e?.message || "Erreur";
      try { const b = await (e?.context as Response)?.json?.(); if (b?.error) msg = b.error; } catch {}
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !clientUserId) return;
    setSelected(null);
    setRewardRef(""); setRewardProvider(""); setRewardAmount(""); setActionReason("");
    void load();
  }, [open, clientUserId]);

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!selected) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("referrals-account-actions", {
        body: { action, client_user_id: clientUserId, referral_id: selected.id, ...extra },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Action appliquée");
      await load();
      setSelected(null);
      setRewardRef(""); setRewardProvider(""); setRewardAmount(""); setActionReason("");
    } catch (e: any) {
      // Extract actual server error if available
      let msg = e?.message || "Erreur";
      try { const b = await (e?.context as Response)?.json?.(); if (b?.error) msg = b.error; } catch {}
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const doQualify       = () => invoke("qualify");
  const doMarkDelivered = () => invoke("mark_delivered");
  const doClearFraud    = () => invoke("clear_fraud");
  const doMarkFraud     = () => {
    if (!actionReason.trim()) { toast.error("Raison requise"); return; }
    void invoke("mark_fraud", { reason: actionReason.trim() });
  };
  const doDisqualify    = () => {
    if (!confirm("Disqualifier ce parrainage ?")) return;
    void invoke("disqualify", { reason: actionReason.trim() || "Non admissible" });
  };
  const doIssueReward = () => {
    if (!rewardRef.trim()) { toast.error("Référence requise"); return; }
    const amt = parseFloat(rewardAmount);
    void invoke("issue_reward", {
      reward_reference: rewardRef.trim(),
      reward_card_provider: rewardProvider.trim() || undefined,
      reward_amount: Number.isFinite(amt) ? amt : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Parrainages du client
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Référent : ${clientName}` : "Gestion des parrainages"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {referrals.length} parrainage(s) trouvé(s)
          </p>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading || busy}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Aucun parrainage pour ce client.
          </p>
        ) : (
          <ul className="space-y-2">
            {referrals.map((r) => {
              const st = STATUS_LABEL[r.status] || { label: r.status, tone: "secondary" };
              const rs = REWARD_LABEL[r.reward_status] || r.reward_status;
              const isOpen = selected?.id === r.id;
              return (
                <li key={r.id} className="rounded border bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setSelected(isOpen ? null : r)}
                    className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/50 rounded-t"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{r.referred_name || "—"}</span>
                        <Badge variant={st.tone as "default" | "secondary" | "outline" | "destructive"} className="text-[10px]">
                          {st.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">Récompense : {rs}</Badge>
                        {r.fraud_flag && (
                          <Badge variant="destructive" className="text-[10px]">
                            <ShieldAlert className="h-3 w-3 mr-1" />Fraude
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Code <strong>{r.referral_code_used}</strong> ·{" "}
                        Cycles {r.qualifying_cycles_paid}/{r.required_cycles} ·{" "}
                        Récompense {fmt(r.reward_amount)}
                        {r.reward_reference ? ` · Réf ${r.reward_reference}` : ""}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t p-3 space-y-3 bg-background/40">
                      {/* Quick info grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Créé : </span>
                          {new Date(r.created_at).toLocaleDateString("fr-CA")}</div>
                        <div><span className="text-muted-foreground">Qualifié : </span>
                          {r.qualified_at ? new Date(r.qualified_at).toLocaleDateString("fr-CA") : "—"}</div>
                        <div><span className="text-muted-foreground">Récompense émise : </span>
                          {r.reward_issued_at ? new Date(r.reward_issued_at).toLocaleDateString("fr-CA") : "—"}</div>
                        <div><span className="text-muted-foreground">Livrée : </span>
                          {r.reward_delivered_at ? new Date(r.reward_delivered_at).toLocaleDateString("fr-CA") : "—"}</div>
                        {r.disqualification_reason && (
                          <div className="col-span-2 text-destructive">
                            Disqualifié : {r.disqualification_reason}
                          </div>
                        )}
                        {r.fraud_review_notes && (
                          <div className="col-span-2 text-amber-500">
                            Note fraude : {r.fraud_review_notes}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Qualify / mark delivered / fraud toggle */}
                      <div className="flex flex-wrap gap-2">
                        {r.status !== "qualified" && r.reward_status !== "reward_issued" && (
                          <Button size="sm" onClick={doQualify} disabled={busy}>
                            <CheckCircle2 className="h-4 w-4 mr-1" />Qualifier
                          </Button>
                        )}
                        {r.reward_status === "reward_issued" && !r.reward_delivered_at && (
                          <Button size="sm" variant="outline" onClick={doMarkDelivered} disabled={busy}>
                            <Truck className="h-4 w-4 mr-1" />Marquer livré
                          </Button>
                        )}
                        {r.fraud_flag ? (
                          <Button size="sm" variant="outline" onClick={doClearFraud} disabled={busy}>
                            <ShieldCheck className="h-4 w-4 mr-1" />Lever la fraude
                          </Button>
                        ) : null}
                      </div>

                      {/* Issue reward block */}
                      {r.reward_status !== "reward_issued" && r.status !== "disqualified" && (
                        <div className="rounded border p-3 space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            <Gift className="h-3 w-3" />Émettre la récompense
                          </Label>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder="Référence (ex: VISA-1234)"
                              value={rewardRef}
                              onChange={(e) => setRewardRef(e.target.value)}
                              disabled={busy}
                            />
                            <Input
                              placeholder="Fournisseur (optionnel)"
                              value={rewardProvider}
                              onChange={(e) => setRewardProvider(e.target.value)}
                              disabled={busy}
                            />
                            <Input
                              type="number" min="0" step="0.01"
                              placeholder={`Montant (${fmt(r.reward_amount)})`}
                              value={rewardAmount}
                              onChange={(e) => setRewardAmount(e.target.value)}
                              disabled={busy}
                            />
                          </div>
                          <Button size="sm" onClick={doIssueReward} disabled={busy || !rewardRef.trim()}>
                            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Gift className="h-4 w-4 mr-1" />}
                            Émettre
                          </Button>
                        </div>
                      )}

                      {/* Fraud / disqualify block */}
                      {r.status !== "disqualified" && (
                        <div className="rounded border p-3 space-y-2">
                          <Label className="text-xs">Raison (fraude ou disqualification)</Label>
                          <Textarea
                            rows={2}
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                            placeholder="Obligatoire pour signaler une fraude"
                            disabled={busy}
                          />
                          <div className="flex gap-2">
                            {!r.fraud_flag && (
                              <Button size="sm" variant="outline" onClick={doMarkFraud} disabled={busy}>
                                <ShieldAlert className="h-4 w-4 mr-1 text-destructive" />Signaler fraude
                              </Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={doDisqualify} disabled={busy}>
                              <XCircle className="h-4 w-4 mr-1" />Disqualifier
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
