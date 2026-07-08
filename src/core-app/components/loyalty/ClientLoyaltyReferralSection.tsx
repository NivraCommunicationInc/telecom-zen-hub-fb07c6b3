/**
 * ClientLoyaltyReferralSection — Loyalty points + referrals management,
 * embedded inside the Core 360 client profile.
 *
 * Actions call the admin_loyalty_* / admin_referral_* RPCs (SECURITY DEFINER,
 * admin-gated, audited). Live via Realtime subscription on loyalty + referral
 * tables — no polling.
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Award, Users, Plus, Minus, ArrowLeftRight, RefreshCw, Ban, CheckCircle2, XCircle, Gift, UserCog, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLoyaltyReferralRealtime } from "@/hooks/useLoyaltyReferralRealtime";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  clientId: string;         // profiles.user_id
  accountId?: string | null; // accounts.id
}

const btn = "inline-flex items-center gap-1.5 rounded-md border border-[hsl(220,15%,20%)] bg-[hsl(220,20%,12%)] px-2.5 py-1.5 text-[11px] text-white hover:border-emerald-500/40 hover:bg-emerald-500/5 transition";

function askReason(msg: string) {
  const r = window.prompt(`${msg}\n\nRaison (obligatoire, min. 5 caractères) :`);
  if (!r || r.trim().length < 5) {
    toast.error("Raison obligatoire (5 caractères minimum)");
    return null;
  }
  return r.trim();
}

function askNumber(msg: string, positive = true) {
  const s = window.prompt(msg);
  const n = Number(s);
  if (!Number.isFinite(n) || (positive && n <= 0)) {
    toast.error("Montant invalide");
    return null;
  }
  return n;
}

async function callRpc(name: string, args: Record<string, any>) {
  const { data, error } = await supabase.rpc(name as any, args);
  if (error) {
    toast.error(error.message);
    throw error;
  }
  toast.success("Opération effectuée");
  return data;
}

export function ClientLoyaltyReferralSection({ clientId, accountId }: Props) {
  const qc = useQueryClient();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["cl-loyalty", clientId] });
    qc.invalidateQueries({ queryKey: ["cl-loyalty-tx", clientId] });
    qc.invalidateQueries({ queryKey: ["cl-referrals", clientId] });
  }, [qc, clientId]);

  useLoyaltyReferralRealtime(clientId, invalidate);

  const { data: points } = useQuery({
    queryKey: ["cl-loyalty", clientId, accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data } = await supabase.from("loyalty_points").select("*").eq("account_id", accountId).maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["cl-loyalty-tx", clientId, accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await supabase.from("loyalty_transactions").select("*")
        .eq("account_id", accountId).order("created_at", { ascending: false }).limit(25);
      return data ?? [];
    },
    enabled: !!accountId,
  });

  const { data: referralsOut = [] } = useQuery({
    queryKey: ["cl-referrals", clientId, "referrer"],
    queryFn: async () => {
      const { data } = await supabase.from("client_referrals").select("*")
        .eq("referrer_user_id", clientId).order("created_at", { ascending: false }).limit(25);
      return data ?? [];
    },
  });

  const { data: referralsIn = [] } = useQuery({
    queryKey: ["cl-referrals", clientId, "referred"],
    queryFn: async () => {
      const { data } = await supabase.from("client_referrals").select("*")
        .eq("referred_user_id", clientId).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: rewardsCatalog = [] } = useQuery({
    queryKey: ["cl-loyalty-rewards"],
    queryFn: async () => {
      const { data } = await supabase.from("loyalty_rewards").select("*")
        .order("points_required", { ascending: true });
      return data ?? [];
    },
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ["cl-loyalty-redemptions", clientId, accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await supabase.from("loyalty_redemptions").select("*")
        .eq("account_id", accountId).order("created_at", { ascending: false }).limit(15);
      return data ?? [];
    },
    enabled: !!accountId,
  });

  // ── Loyalty actions ──
  const adjust = async (sign: 1 | -1) => {
    if (!accountId) return toast.error("Aucun compte lié");
    const amt = askNumber(`Points à ${sign === 1 ? "ajouter" : "retirer"} :`); if (!amt) return;
    const reason = askReason(`${sign === 1 ? "Ajout" : "Retrait"} de ${amt} points`); if (!reason) return;
    await callRpc("admin_loyalty_adjust", { p_account_id: accountId, p_delta_points: sign * amt, p_reason: reason });
  };

  const transfer = async () => {
    if (!accountId) return toast.error("Aucun compte lié");
    const targetAcct = window.prompt("ID du compte destinataire (UUID) :");
    if (!targetAcct) return;
    const amt = askNumber("Points à transférer :"); if (!amt) return;
    const reason = askReason(`Transfert de ${amt} points`); if (!reason) return;
    await callRpc("admin_loyalty_transfer", { p_from_account: accountId, p_to_account: targetAcct.trim(), p_points: amt, p_reason: reason });
  };

  const convert = async () => {
    if (!accountId) return toast.error("Aucun compte lié");
    const pts = askNumber("Points à convertir :"); if (!pts) return;
    const dollars = askNumber("Crédit facture en $ :"); if (!dollars) return;
    const reason = askReason(`Conversion ${pts} pts → ${dollars}$`); if (!reason) return;
    await callRpc("admin_loyalty_convert_to_credit", { p_account_id: accountId, p_points: pts, p_credit_amount: dollars, p_reason: reason });
  };

  const approvePending = async (txId: string, decision: "approved" | "rejected") => {
    const reason = askReason(`${decision === "approved" ? "Approbation" : "Rejet"} de la transaction`); if (!reason) return;
    await callRpc("admin_loyalty_approve_pending", { p_transaction_id: txId, p_decision: decision, p_reason: reason });
  };

  const extendExpiration = async (txId: string) => {
    const d = window.prompt("Nouvelle date d'expiration (AAAA-MM-JJ) :");
    if (!d) return;
    const reason = askReason("Prolongation d'expiration"); if (!reason) return;
    await callRpc("admin_loyalty_extend_expiration", { p_transaction_id: txId, p_new_expires_at: d, p_reason: reason });
  };

  // ── Referral actions ──
  const referralAction = async (refId: string, action: "approve" | "reject" | "reassign" | "clawback") => {
    if (action === "reassign") {
      const newRef = window.prompt("ID du nouveau parrain (user_id UUID) :"); if (!newRef) return;
      const reason = askReason("Réattribution du parrain"); if (!reason) return;
      return callRpc("admin_referral_reassign", { p_referral_id: refId, p_new_referrer_user_id: newRef.trim(), p_reason: reason });
    }
    const reason = askReason(action === "approve" ? "Approbation référence" : action === "reject" ? "Rejet référence" : "Clawback récompense");
    if (!reason) return;
    if (action === "approve") return callRpc("admin_referral_approve", { p_referral_id: refId, p_reason: reason });
    if (action === "reject") return callRpc("admin_referral_reject", { p_referral_id: refId, p_reason: reason });
    return callRpc("admin_referral_clawback", { p_referral_id: refId, p_reason: reason });
  };

  const manualReward = async () => {
    const referred = window.prompt("user_id du filleul (UUID) :"); if (!referred) return;
    const kind = window.prompt("Type de récompense : 'points' ou 'credit' :"); if (!kind || !["points","credit"].includes(kind)) return toast.error("Type invalide");
    const amt = askNumber(`Valeur (${kind === "points" ? "points" : "$"}) :`); if (!amt) return;
    const reason = askReason("Récompense manuelle référence"); if (!reason) return;
    await callRpc("admin_referral_manual_reward", {
      p_referred_user_id: referred.trim(),
      p_referrer_user_id: clientId,
      p_kind: kind,
      p_amount_or_points: amt,
      p_reason: reason,
    });
  };

  const pending = txs.filter((t: any) => t.status === "pending");

  return (
    <div className="space-y-4">
      {/* ── Loyalty ── */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-400" />
            <h3 className="text-[13px] font-semibold text-white">Récompenses — Points de fidélité</h3>
            {points?.tier && <Badge variant="outline" className="text-[10px]">{points.tier}</Badge>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button className={btn} onClick={() => adjust(1)}><Plus className="h-3 w-3 text-emerald-400" /> Ajouter</button>
            <button className={btn} onClick={() => adjust(-1)}><Minus className="h-3 w-3 text-red-400" /> Retirer</button>
            <button className={btn} onClick={transfer}><ArrowLeftRight className="h-3 w-3 text-sky-400" /> Transférer</button>
            <button className={btn} onClick={convert}><RefreshCw className="h-3 w-3 text-amber-400" /> Convertir en crédit</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,9%)] px-3 py-2">
            <div className="text-[10px] text-[hsl(220,10%,45%)]">Disponibles</div>
            <div className="text-[16px] font-semibold text-emerald-400 tabular-nums">{points?.available_points ?? 0}</div>
          </div>
          <div className="rounded border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,9%)] px-3 py-2">
            <div className="text-[10px] text-[hsl(220,10%,45%)]">Total</div>
            <div className="text-[16px] font-semibold text-white tabular-nums">{points?.total_points ?? 0}</div>
          </div>
          <div className="rounded border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,9%)] px-3 py-2">
            <div className="text-[10px] text-[hsl(220,10%,45%)]">À vie</div>
            <div className="text-[16px] font-semibold text-white tabular-nums">{points?.lifetime_points ?? 0}</div>
          </div>
        </div>

        {pending.length > 0 && (
          <div className="mb-3 rounded border border-amber-500/30 bg-amber-500/5 p-2">
            <div className="text-[11px] font-semibold text-amber-300 mb-1.5">{pending.length} transaction(s) en attente</div>
            <div className="space-y-1">
              {pending.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-white">{t.points > 0 ? "+" : ""}{t.points} pts — {t.description || t.type}</span>
                  <div className="flex gap-1">
                    <button className={btn} onClick={() => approvePending(t.id, "approved")}><CheckCircle2 className="h-3 w-3 text-emerald-400" /></button>
                    <button className={btn} onClick={() => approvePending(t.id, "rejected")}><XCircle className="h-3 w-3 text-red-400" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-[10px] uppercase tracking-wide text-[hsl(220,10%,45%)] mb-1">Historique récent</div>
        <div className="max-h-64 overflow-y-auto divide-y divide-[hsl(220,15%,14%)]">
          {txs.length === 0 && <div className="py-4 text-center text-[11px] text-[hsl(220,10%,45%)]">Aucune transaction</div>}
          {txs.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between py-1.5">
              <div className="min-w-0">
                <div className="text-[11px] text-white truncate">
                  <span className={t.points >= 0 ? "text-emerald-400" : "text-red-400"}>{t.points > 0 ? "+" : ""}{t.points} pts</span>
                  <span className="mx-1.5 text-[hsl(220,10%,45%)]">·</span>
                  {t.description || t.type}
                </div>
                <div className="text-[10px] text-[hsl(220,10%,45%)]">
                  {t.created_at && format(new Date(t.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                  {t.status && t.status !== "posted" && <> · <span className="text-amber-400">{t.status}</span></>}
                  {t.expires_at && <> · exp. {format(new Date(t.expires_at), "d MMM yyyy", { locale: fr })}</>}
                </div>
              </div>
              {t.expires_at && (
                <button className={btn} onClick={() => extendExpiration(t.id)} title="Prolonger l'expiration">
                  <Clock className="h-3 w-3 text-sky-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Rewards catalog + redemptions ── */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="h-4 w-4 text-amber-400" />
          <h3 className="text-[13px] font-semibold text-white">Catalogue de récompenses & rédemptions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[hsl(220,10%,45%)] mb-1">Récompenses disponibles ({rewardsCatalog.length})</div>
            <div className="max-h-48 overflow-y-auto divide-y divide-[hsl(220,15%,14%)]">
              {rewardsCatalog.length === 0 && <div className="py-3 text-center text-[11px] text-[hsl(220,10%,45%)]">Aucune récompense configurée</div>}
              {rewardsCatalog.map((r: any) => (
                <div key={r.id} className="py-1.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] text-white truncate">{r.name || r.title || r.type}</div>
                    <div className="text-[10px] text-[hsl(220,10%,45%)]">{r.points_required ?? 0} pts{r.value ? ` · ${r.value}$` : ""}</div>
                  </div>
                  {r.active === false && <Badge variant="outline" className="text-[9px]">inactif</Badge>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[hsl(220,10%,45%)] mb-1">Rédemptions récentes ({redemptions.length})</div>
            <div className="max-h-48 overflow-y-auto divide-y divide-[hsl(220,15%,14%)]">
              {redemptions.length === 0 && <div className="py-3 text-center text-[11px] text-[hsl(220,10%,45%)]">Aucune rédemption</div>}
              {redemptions.map((r: any) => (
                <div key={r.id} className="py-1.5">
                  <div className="text-[11px] text-white">−{r.points_used ?? r.points ?? 0} pts</div>
                  <div className="text-[10px] text-[hsl(220,10%,45%)]">
                    {r.created_at && format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    {r.status && <> · {r.status}</>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* ── Referrals ── */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" />
            <h3 className="text-[13px] font-semibold text-white">Références</h3>
          </div>
          <button className={btn} onClick={manualReward}><Gift className="h-3 w-3 text-amber-400" /> Récompense manuelle</button>
        </div>

        {referralsIn.length > 0 && (
          <div className="mb-3 rounded border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,9%)] p-2">
            <div className="text-[10px] uppercase tracking-wide text-[hsl(220,10%,45%)] mb-1">Ce client a été parrainé par</div>
            {referralsIn.map((r: any) => (
              <div key={r.id} className="text-[11px] text-white">
                Parrain : <span className="font-mono text-[10px]">{r.referrer_user_id?.slice(0, 8)}…</span>
                <Badge variant="outline" className="ml-2 text-[9px]">{r.status}</Badge>
                <Badge variant="outline" className="ml-1 text-[9px]">récompense {r.reward_status}</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="text-[10px] uppercase tracking-wide text-[hsl(220,10%,45%)] mb-1">Personnes parrainées ({referralsOut.length})</div>
        <div className="max-h-64 overflow-y-auto divide-y divide-[hsl(220,15%,14%)]">
          {referralsOut.length === 0 && <div className="py-4 text-center text-[11px] text-[hsl(220,10%,45%)]">Aucune référence</div>}
          {referralsOut.map((r: any) => (
            <div key={r.id} className="py-2 space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="text-[11px] text-white">
                  <span className="font-mono text-[10px] text-[hsl(220,10%,55%)]">{r.referred_user_id?.slice(0, 8)}…</span>
                  <Badge variant="outline" className="ml-2 text-[9px]">{r.status}</Badge>
                  <Badge variant="outline" className="ml-1 text-[9px]">récompense {r.reward_status}</Badge>
                  {r.fraud_flag && <Badge variant="destructive" className="ml-1 text-[9px]">fraude</Badge>}
                </div>
                <div className="flex gap-1">
                  {r.status !== "qualified" && <button className={btn} onClick={() => referralAction(r.id, "approve")}><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Approuver</button>}
                  {r.status !== "disqualified" && <button className={btn} onClick={() => referralAction(r.id, "reject")}><XCircle className="h-3 w-3 text-red-400" /> Rejeter</button>}
                  <button className={btn} onClick={() => referralAction(r.id, "reassign")}><UserCog className="h-3 w-3 text-sky-400" /> Réattribuer</button>
                  {r.reward_status === "paid" && <button className={btn} onClick={() => referralAction(r.id, "clawback")}><Ban className="h-3 w-3 text-red-400" /> Clawback</button>}
                </div>
              </div>
              <div className="text-[10px] text-[hsl(220,10%,45%)]">
                {r.created_at && format(new Date(r.created_at), "d MMM yyyy", { locale: fr })}
                {r.reward_type && <> · {r.reward_amount ?? "?"} {r.reward_type}</>}
                {r.qualifying_cycles_paid != null && <> · {r.qualifying_cycles_paid}/{r.required_cycles} cycles</>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
