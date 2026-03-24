/**
 * AccountRestrictionsDialog — Block account, suspend services, flag, payment restrictions.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Ban, AlertTriangle, Lock, Flag, CreditCard } from "lucide-react";

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50";
const btnPrimary = "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors";
const btnDanger = "rounded-md bg-destructive px-4 py-1.5 text-[11px] font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-40 transition-opacity";

type RestrictionType = "block_account" | "suspend_services" | "payment_restriction" | "internal_flag";

interface Props {
  accountId: string | undefined;
  clientId: string | undefined;
  accountStatus: string | null;
  subscriptions?: any[];
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function AccountRestrictionsDialog({ accountId, clientId, accountStatus, subscriptions = [], open, onClose, onRefresh }: Props) {
  const [action, setAction] = useState<RestrictionType>("block_account");
  const [reason, setReason] = useState("");
  const [flagNote, setFlagNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!reason.trim() && action !== "internal_flag") { toast.error("Raison obligatoire"); return; }
    if (action === "internal_flag" && !flagNote.trim()) { toast.error("Note obligatoire pour le flag"); return; }
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const actorId = user?.id || "system";

      switch (action) {
        case "block_account": {
          if (!accountId) throw new Error("Compte introuvable");
          const { error } = await supabase.from("accounts").update({
            status: "blocked", updated_at: new Date().toISOString(),
          }).eq("id", accountId);
          if (error) throw error;
          toast.success("Compte bloqué");
          break;
        }
        case "suspend_services": {
          const activeSubs = subscriptions.filter((s: any) => s.status === "active");
          if (activeSubs.length === 0) { toast.error("Aucun service actif à suspendre"); setLoading(false); return; }
          for (const sub of activeSubs) {
            await supabase.from("billing_subscriptions").update({
              status: "suspended" as any, updated_at: new Date().toISOString(),
            }).eq("id", sub.id);
          }
          if (accountId) {
            await supabase.from("accounts").update({
              status: "suspended", updated_at: new Date().toISOString(),
            }).eq("id", accountId);
          }
          toast.success(`${activeSubs.length} service(s) suspendu(s)`);
          break;
        }
        case "payment_restriction": {
          // Log as internal audit + activity
          toast.success("Restriction de paiement appliquée");
          break;
        }
        case "internal_flag": {
          // Add flag note to activity logs
          await supabase.from("activity_logs").insert({
            user_id: actorId,
            entity_type: "account",
            entity_id: accountId || clientId || "unknown",
            action: "internal_flag_added",
            reason: flagNote.trim(),
            details: { source: "core", flag_type: "warning", restriction_reason: reason || null },
          });
          toast.success("Flag interne ajouté");
          break;
        }
      }

      // Always log the restriction action
      await supabase.from("activity_logs").insert({
        user_id: actorId,
        entity_type: "account",
        entity_id: accountId || clientId || "unknown",
        action: `restriction_${action}`,
        reason: reason.trim() || flagNote.trim(),
        details: { source: "core", restriction_type: action },
      });

      // Internal audit
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", actorId).maybeSingle();
      await supabase.from("internal_audit_log").insert({
        actor_user_id: actorId,
        actor_name: profile?.full_name || user?.email || "Admin",
        action: `restriction_${action}`,
        category: "security",
        portal: "core",
        target_type: "account",
        target_id: accountId || clientId || "unknown",
        details: { reason: reason.trim(), restriction_type: action },
      });

      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const actionConfig: Record<RestrictionType, { icon: any; label: string; color: string; desc: string }> = {
    block_account: { icon: Ban, label: "Bloquer le compte", color: "text-red-400", desc: "Le client ne pourra plus accéder à son portail." },
    suspend_services: { icon: Lock, label: "Suspendre tous les services", color: "text-amber-400", desc: "Tous les services actifs seront suspendus." },
    payment_restriction: { icon: CreditCard, label: "Restriction de paiement", color: "text-orange-400", desc: "Ajoutera une restriction de paiement au dossier." },
    internal_flag: { icon: Flag, label: "Flag / Note interne", color: "text-violet-400", desc: "Ajouter un avertissement visible par le staff." },
  };

  const cfg = actionConfig[action];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-400" /> Appliquer une restriction
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Type de restriction</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(actionConfig) as RestrictionType[]).map(key => {
                const c = actionConfig[key];
                const Icon = c.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setAction(key)}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-[10px] font-medium transition-all ${
                      action === key
                        ? `border-primary/40 bg-primary/10 ${c.color}`
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
            <p className="text-[11px] text-muted-foreground">{cfg.desc}</p>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Raison</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison de la restriction..." className={inputCls} />
          </div>

          {action === "internal_flag" && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Note du flag</label>
              <textarea value={flagNote} onChange={e => setFlagNote(e.target.value)} rows={3} placeholder="Description détaillée du flag..." className={`${inputCls} resize-none`} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleApply} disabled={loading} className={action === "internal_flag" ? btnPrimary : btnDanger}>
            {loading ? "…" : "Appliquer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
