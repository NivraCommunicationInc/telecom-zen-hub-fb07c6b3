/**
 * AddPromotionDialog — Staff dialog to add a duration-based promotion to an account.
 * Used in Employee and Core portals.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addAccountPromotion } from "@/shared-ops/quoteOperations";
import { toast } from "sonner";
import { Gift, Loader2 } from "lucide-react";

interface AddPromotionDialogProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  customerId?: string;
  quoteId?: string;
  orderId?: string;
  actorUserId: string;
  actorRole: string;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { value: "1", label: "1 mois" },
  { value: "3", label: "3 mois" },
  { value: "6", label: "6 mois" },
  { value: "12", label: "12 mois" },
  { value: "24", label: "24 mois" },
  { value: "custom", label: "Personnalisé" },
];

const TYPE_OPTIONS = [
  { value: "monthly_discount", label: "Rabais mensuel" },
  { value: "credit", label: "Crédit" },
  { value: "promo", label: "Promotion" },
];

export function AddPromotionDialog({
  open,
  onClose,
  accountId,
  customerId,
  quoteId,
  orderId,
  actorUserId,
  actorRole,
  onSuccess,
}: AddPromotionDialogProps) {
  const [label, setLabel] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [amount, setAmount] = useState("");
  const [promotionType, setPromotionType] = useState("monthly_discount");
  const [durationPreset, setDurationPreset] = useState("1");
  const [customDuration, setCustomDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const durationMonths = durationPreset === "custom"
    ? parseInt(customDuration) || 0
    : parseInt(durationPreset);

  const handleSubmit = async () => {
    if (!label.trim()) { toast.error("Libellé requis"); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Montant invalide"); return; }
    if (durationMonths <= 0) { toast.error("Durée invalide"); return; }

    setProcessing(true);
    try {
      await addAccountPromotion({
        accountId,
        customerId,
        quoteId,
        orderId,
        promoCode: promoCode.trim() || undefined,
        label: label.trim(),
        promotionType: promotionType as any,
        amount: parseFloat(amount),
        durationMonths,
        createdByUserId: actorUserId,
        createdByRole: actorRole,
        notes: notes.trim() || undefined,
      });
      toast.success(`Promotion ajoutée: ${label} — ${amount}$/mois × ${durationMonths} mois`);
      onSuccess?.();
      resetAndClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const resetAndClose = () => {
    setLabel("");
    setPromoCode("");
    setAmount("");
    setPromotionType("monthly_discount");
    setDurationPreset("1");
    setCustomDuration("");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-4 w-4" /> Ajouter une promotion
          </DialogTitle>
          <DialogDescription>
            Cette promotion sera appliquée automatiquement sur les prochaines factures mensuelles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Code promo (optionnel)</Label>
            <Input value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="Ex: NIVRA50" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Libellé <span className="text-destructive">*</span></Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Rabais fidélité 50%" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Type <span className="text-destructive">*</span></Label>
              <Select value={promotionType} onValueChange={setPromotionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Montant ($/mois) <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10.00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Durée <span className="text-destructive">*</span></Label>
            <Select value={durationPreset} onValueChange={setDurationPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {durationPreset === "custom" && (
              <Input
                type="number"
                min="1"
                max="60"
                value={customDuration}
                onChange={e => setCustomDuration(e.target.value)}
                placeholder="Nombre de mois"
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Notes internes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Raison de la promotion, contexte..."
              rows={2}
            />
          </div>

          {amount && durationMonths > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Résumé:</strong> {label || "—"} — {parseFloat(amount).toFixed(2)} $/mois × {durationMonths} mois
                = <strong>{(parseFloat(amount) * durationMonths).toFixed(2)} $ total</strong>
              </p>
              {promoCode && (
                <p className="text-xs text-muted-foreground mt-1">Code: <strong>{promoCode}</strong></p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={processing}>
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Gift className="h-4 w-4 mr-1" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
