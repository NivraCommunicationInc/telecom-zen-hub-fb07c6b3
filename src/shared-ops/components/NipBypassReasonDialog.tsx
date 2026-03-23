/**
 * NipBypassReasonDialog — Forces agent to provide a structured reason
 * when accessing a client account without NIP verification.
 * Logs to account_access_logs + internal_audit_log.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

export type BypassReason =
  | "customer_forgot_pin"
  | "identity_verified_alternative"
  | "field_intervention"
  | "technician_appointment"
  | "urgent_service_restoration"
  | "accessibility_assisted"
  | "other";

const REASON_OPTIONS: { value: BypassReason; label: string }[] = [
  { value: "customer_forgot_pin", label: "Client a oublié son NIP" },
  { value: "identity_verified_alternative", label: "Identité vérifiée par méthode alternative" },
  { value: "field_intervention", label: "Intervention terrain / visite sur site" },
  { value: "technician_appointment", label: "Rendez-vous technicien" },
  { value: "urgent_service_restoration", label: "Restauration de service urgente" },
  { value: "accessibility_assisted", label: "Accessibilité / client assisté" },
  { value: "other", label: "Autre (note requise)" },
];

interface NipBypassReasonDialogProps {
  open: boolean;
  customerId: string;
  accountId?: string;
  portal: "employee" | "field" | "technician";
  onBypassGranted: () => void;
  onCancel: () => void;
}

export function NipBypassReasonDialog({
  open, customerId, accountId, portal, onBypassGranted, onCancel,
}: NipBypassReasonDialogProps) {
  const [reason, setReason] = useState<BypassReason | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const noteRequired = reason === "other";
  const canSubmit = reason && (!noteRequired || note.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Non authentifié");

      // Log to account_access_logs
      await supabase.from("account_access_logs").insert({
        staff_user_id: session.user.id,
        client_user_id: customerId,
        method: "nip_bypass",
        reason: `${REASON_OPTIONS.find(r => r.value === reason)?.label}${note.trim() ? ` — ${note.trim()}` : ""}`,
        access_granted: true,
        portal,
        verified_fields: { bypass_reason: reason, note: note.trim() || null },
      });

      // Log to internal_audit_log
      await logInternalAudit({
        action: "nip_bypass_access",
        category: "security",
        portal,
        targetType: "client",
        targetId: customerId,
        details: {
          bypass_reason: reason,
          note: note.trim() || null,
          account_id: accountId ?? null,
        },
      });

      // Log to internal_audit_log
      await logInternalAudit({
        action: "nip_bypass_access",
        category: "security",
        portal,
        targetType: "client",
        targetId: customerId,
        details: {
          bypass_reason: reason,
          note: note.trim() || null,
          account_id: accountId ?? null,
        },
      });

      onBypassGranted();
    } catch (err) {
      console.error("[NipBypass] Security logging failed — access DENIED:", err);
      toast.error("Échec de l'enregistrement de sécurité. Accès refusé.");
      // ACCESS DENIED if logging fails — security event must be traceable
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-lg bg-[hsl(220,20%,8%)] border-[hsl(220,15%,15%)] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[hsl(220,10%,90%)]">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Accès sans NIP — Raison requise
          </DialogTitle>
          <DialogDescription className="text-[hsl(220,10%,50%)]">
            L'accès au dossier client sans vérification NIP nécessite une justification. Cette action sera enregistrée dans le journal de sécurité.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-[hsl(220,10%,70%)] text-xs">Raison de l'accès sans NIP</Label>
            <div className="space-y-1.5">
              {REASON_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    reason === opt.value
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-[hsl(220,15%,15%)] hover:border-[hsl(220,15%,22%)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="bypass_reason"
                    value={opt.value}
                    checked={reason === opt.value}
                    onChange={() => setReason(opt.value)}
                    className="accent-amber-500"
                  />
                  <span className="text-xs text-[hsl(220,10%,75%)]">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {(noteRequired || reason) && (
            <div className="space-y-1.5">
              <Label className="text-[hsl(220,10%,70%)] text-xs">
                Note {noteRequired ? "(obligatoire)" : "(optionnelle)"}
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Détails supplémentaires…"
                maxLength={500}
                className="bg-[hsl(220,15%,10%)] border-[hsl(220,15%,18%)] text-white text-xs placeholder:text-[hsl(220,10%,30%)] min-h-[60px]"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}
            className="border-[hsl(220,15%,18%)] text-[hsl(220,10%,70%)] hover:bg-[hsl(220,15%,12%)]">
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}
            className="bg-amber-600 hover:bg-amber-500 text-white">
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Confirmer l'accès
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
