/**
 * ClientEquipmentReturnDialog
 * Lets a client request a return for a piece of service equipment that
 * was deployed less than 30 days ago. Inserts an `equipment_return_requests`
 * row and queues a confirmation email. The agent then handles the rest
 * from Core → Operations → Retours RMA.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { portalClient as supabase } from "@/integrations/backend/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipment: {
    id: string;
    catalog_name: string | null;
    account_id: string | null;
  };
  onSuccess?: () => void;
}

const REASONS = [
  { value: "Défectueux", label: "Défectueux" },
  { value: "Ne fonctionne plus", label: "Ne fonctionne plus" },
  { value: "Résiliation", label: "Résiliation" },
  { value: "Upgrade", label: "Upgrade" },
  { value: "Autre", label: "Autre" },
];

export const ClientEquipmentReturnDialog = ({ open, onOpenChange, equipment, onSuccess }: Props) => {
  const { user } = useClientAuth();
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setReason(""); setDetail(""); setConfirmed(false); };

  const submit = async () => {
    if (!user?.id) { toast.error("Session expirée"); return; }
    if (!reason) { toast.error("Sélectionnez une raison"); return; }
    if (!confirmed) { toast.error("Veuillez confirmer le bon état"); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("equipment_return_requests")
        .insert({
          client_user_id: user.id,
          account_id: equipment.account_id,
          equipment_inventory_id: equipment.id,
          reason,
          reason_detail: detail.trim() || null,
          status: "pending",
        });
      if (error) throw error;

      toast.success("Demande de retour envoyée — étiquette sous 24-48h");
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retourner cet équipement</DialogTitle>
          <DialogDescription>
            {equipment.catalog_name ?? "Équipement"} — Une étiquette de retour
            vous sera envoyée par courriel sous 24-48h ouvrables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="reason">Raison *</Label>
            <Select value={reason} onValueChange={setReason} disabled={submitting}>
              <SelectTrigger id="reason"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="detail">Description (optionnel)</Label>
            <Textarea id="detail" value={detail} onChange={(e) => setDetail(e.target.value)}
              rows={3} disabled={submitting} placeholder="Précisez le problème rencontré…" />
          </div>

          <div className="flex items-start gap-2 pt-1">
            <Checkbox id="confirm" checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)} disabled={submitting} />
            <Label htmlFor="confirm" className="text-sm leading-snug cursor-pointer">
              Je confirme retourner l'appareil en bon état (sauf défectuosité).
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || !reason || !confirmed}>
            {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Envoyer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
