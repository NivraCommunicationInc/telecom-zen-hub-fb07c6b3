/**
 * AddCreditWithDurationDialog — Apply credits/promotions with duration options.
 * Durations: 1, 3, 6, 12, 24 months, custom, or permanent.
 * Uses account_promotions table for tracking.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Gift, DollarSign, Calendar } from "lucide-react";

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50";
const btnPrimary = "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors";

interface Props {
  accountId: string | undefined;
  customerId: string | undefined;
  clientName: string;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

type DurationPreset = 1 | 3 | 6 | 12 | 24 | "custom" | "permanent";

const DURATION_OPTIONS: { value: DurationPreset; label: string }[] = [
  { value: 1, label: "1 mois" },
  { value: 3, label: "3 mois" },
  { value: 6, label: "6 mois" },
  { value: 12, label: "12 mois" },
  { value: 24, label: "24 mois" },
  { value: "custom", label: "Personnalisé" },
  { value: "permanent", label: "Permanent" },
];

export function AddCreditWithDurationDialog({ accountId, customerId, clientName, open, onClose, onRefresh }: Props) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promotionType, setPromotionType] = useState<"credit" | "discount" | "promo">("credit");
  const [durationPreset, setDurationPreset] = useState<DurationPreset>(1);
  const [customDuration, setCustomDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const getDurationMonths = (): number => {
    if (durationPreset === "permanent") return 9999;
    if (durationPreset === "custom") return parseInt(customDuration) || 1;
    return durationPreset;
  };

  const handleApply = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) { toast.error("Montant invalide"); return; }
    if (!label.trim()) { toast.error("Libellé requis"); return; }
    if (!accountId) { toast.error("Compte introuvable"); return; }

    setLoading(true);
    try {
      const durationMonths = getDurationMonths();
      const isPermanent = durationPreset === "permanent";
      const expiresAt = isPermanent
        ? null
        : new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from("account_promotions").insert({
        account_id: accountId,
        customer_id: customerId || null,
        label: label.trim(),
        promotion_type: promotionType,
        amount: parsedAmount,
        duration_months: isPermanent ? 9999 : durationMonths,
        months_remaining: isPermanent ? 9999 : durationMonths,
        promo_code: promoCode.trim() || null,
        notes: notes.trim() || null,
        is_active: true,
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
        created_by_role: "admin",
      });
      if (error) throw error;

      // Log activity
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "account",
        entity_id: accountId,
        action: "credit_applied",
        reason: `${label} — ${parsedAmount.toFixed(2)} $/mois × ${isPermanent ? "permanent" : `${durationMonths} mois`}`,
        details: {
          source: "core",
          amount: parsedAmount,
          duration_months: durationMonths,
          promotion_type: promotionType,
          promo_code: promoCode || null,
          is_permanent: isPermanent,
        },
      });

      // Internal note documenting the discount
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "account",
        entity_id: accountId,
        action: "internal_note",
        reason: `📋 Promotion ajoutée: ${label} — ${parsedAmount.toFixed(2)} $/mois${promoCode ? ` (code: ${promoCode})` : ""} × ${isPermanent ? "permanent" : `${durationMonths} mois`}. ${notes || ""}`.trim(),
      });

      toast.success(`Crédit de ${parsedAmount.toFixed(2)} $/mois appliqué pour ${isPermanent ? "permanent" : `${durationMonths} mois`}`);
      onRefresh();
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
            <Gift className="h-4 w-4 text-primary" /> Appliquer un crédit / promotion
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">Client: <span className="text-foreground font-medium">{clientName}</span></p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Type</label>
              <select value={promotionType} onChange={e => setPromotionType(e.target.value as any)} className={inputCls}>
                <option value="credit">Crédit</option>
                <option value="discount">Remise</option>
                <option value="promo">Promotion</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Montant mensuel ($)</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Libellé</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Crédit fidélité, Promotion nouveau client" className={inputCls} />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Code promo (optionnel)</label>
            <input value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="Ex: WELCOME10, LOYALTY2024" className={inputCls} />
          </div>

          {/* Duration selection */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
              <Calendar className="h-3 w-3 inline mr-1" />
              Durée
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setDurationPreset(opt.value)}
                  className={`rounded-md border px-2 py-1.5 text-[10px] font-medium transition-all ${
                    durationPreset === opt.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {durationPreset === "custom" && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Nombre de mois</label>
              <input type="number" min="1" max="120" value={customDuration} onChange={e => setCustomDuration(e.target.value)} placeholder="Ex: 18" className={inputCls} />
            </div>
          )}

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Notes internes (optionnel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes sur cette promotion..." className={`${inputCls} resize-none`} />
          </div>

          {/* Summary */}
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Résumé</p>
            <p className="text-[12px] text-foreground font-medium">
              {parseFloat(amount) > 0 ? `${parseFloat(amount).toFixed(2)} $/mois` : "—"} × {" "}
              {durationPreset === "permanent" ? "permanent" : durationPreset === "custom" ? `${customDuration || "?"} mois` : `${durationPreset} mois`}
              {parseFloat(amount) > 0 && durationPreset !== "permanent" && (
                <span className="text-muted-foreground ml-2">
                  = {(parseFloat(amount) * getDurationMonths()).toFixed(2)} $ total
                </span>
              )}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleApply} disabled={loading} className={btnPrimary}>{loading ? "…" : "Appliquer le crédit"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
