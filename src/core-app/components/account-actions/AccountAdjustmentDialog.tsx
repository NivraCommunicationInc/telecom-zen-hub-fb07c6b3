/**
 * AccountAdjustmentDialog — Apply a manual credit OR fee on an account.
 *
 * Writes to `account_adjustments` (NOT `account_promotions` which is for
 * promo codes / discounts). Each adjustment is applied automatically on
 * the next N invoice cycles by the `billing-lifecycle` worker.
 *
 *   • type: credit | fee
 *   • amount: $ per invoice
 *   • months: 1–24
 *   • description: shown verbatim on the invoice line
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DollarSign, Calendar, Plus, Minus } from "lucide-react";

const inputCls =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50";
const btnPrimary =
  "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity";
const btnSecondary =
  "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors";

interface Props {
  accountId: string | undefined;
  clientName: string;
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const MONTH_OPTIONS = [1, 3, 6, 12, 24];

export function AccountAdjustmentDialog({
  accountId, clientName, open, onClose, onRefresh,
}: Props) {
  const [type, setType] = useState<"credit" | "fee">("credit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [months, setMonths] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const parsed = parseFloat(amount);
  const validAmount = parsed > 0;

  const reset = () => {
    setType("credit"); setAmount(""); setDescription(""); setMonths(1);
  };

  const handleApply = async () => {
    if (!accountId) { toast.error("Compte introuvable"); return; }
    if (!validAmount) { toast.error("Montant invalide"); return; }
    if (!description.trim()) { toast.error("Description requise"); return; }
    if (months < 1 || months > 24) { toast.error("Durée invalide (1–24 mois)"); return; }

    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase.from("account_adjustments").insert({
        account_id: accountId,
        type,
        amount: parsed,
        description: description.trim(),
        months_total: months,
        months_remaining: months,
        applied_count: 0,
        status: "active",
        created_by: user?.id || null,
      });
      if (error) throw error;

      toast.success(
        `${type === "credit" ? "Crédit" : "Frais"} de ${parsed.toFixed(2)} $ appliqué sur ${months} facture(s)`,
      );
      reset();
      onRefresh?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            {type === "credit" ? (
              <Minus className="h-4 w-4 text-emerald-400" />
            ) : (
              <Plus className="h-4 w-4 text-amber-400" />
            )}
            Ajustement compte — {type === "credit" ? "Crédit" : "Frais"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Client: <span className="text-foreground font-medium">{clientName}</span>
          </p>

          {/* Type toggle */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setType("credit")}
                className={`rounded-md border px-3 py-2 text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                  type === "credit"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Minus className="h-3 w-3" /> Crédit
              </button>
              <button
                onClick={() => setType("fee")}
                className={`rounded-md border px-3 py-2 text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                  type === "fee"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Plus className="h-3 w-3" /> Frais
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                <DollarSign className="h-3 w-3 inline mr-1" /> Montant ($)
              </label>
              <input
                type="number" step="0.01" min="0"
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                <Calendar className="h-3 w-3 inline mr-1" /> Nombre de mois
              </label>
              <input
                type="number" min={1} max={24}
                value={months}
                onChange={e => setMonths(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {MONTH_OPTIONS.map(m => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
                  months === m
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m} mois
              </button>
            ))}
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={
                type === "credit"
                  ? "Ex: Crédit dédommagement panne"
                  : "Ex: Frais de ré-installation"
              }
              className={inputCls}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Ce texte apparaîtra tel quel sur la facture du client.
            </p>
          </div>

          {/* Preview */}
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Aperçu</p>
            <p className="text-[12px] text-foreground font-medium">
              {validAmount ? (
                <>
                  Ce {type === "credit" ? "crédit" : "frais"} de{" "}
                  <span className={type === "credit" ? "text-emerald-400" : "text-amber-400"}>
                    {type === "credit" ? "−" : "+"}{parsed.toFixed(2)} $
                  </span>{" "}
                  sera appliqué sur les <strong>{months}</strong> prochaine{months > 1 ? "s" : ""} facture{months > 1 ? "s" : ""} du client.
                </>
              ) : (
                "—"
              )}
              {validAmount && (
                <span className="block text-muted-foreground mt-1">
                  Total cumulé: {(parsed * months).toFixed(2)} $
                </span>
              )}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleApply} disabled={loading || !validAmount} className={btnPrimary}>
            {loading ? "…" : `Appliquer le ${type === "credit" ? "crédit" : "frais"}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
