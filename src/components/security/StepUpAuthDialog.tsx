/**
 * StepUpAuthDialog — Re-authentication dialog for sensitive actions.
 * Requires password re-entry before allowing the action to proceed.
 */
import { useState } from "react";
import { Shield, Loader2, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stepUpWithPassword } from "@/lib/security/stepUpAuth";
import { auditAuth } from "@/lib/security/internalAuditLogger";
import type { SensitiveAction } from "@/lib/security/stepUpAuth";

interface StepUpAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: SensitiveAction;
  actionLabel?: string;
  onVerified: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  refund: "Effectuer un remboursement",
  credit_apply: "Appliquer un crédit",
  billing_approval: "Approuver une facturation",
  role_change: "Modifier un rôle",
  access_flag_change: "Modifier les accès",
  kyc_override: "Outrepasser la vérification KYC",
  account_suspension: "Suspendre un compte",
  mfa_reset: "Réinitialiser la 2FA",
  data_export: "Exporter des données",
  payment_void: "Annuler un paiement",
  invoice_void: "Annuler une facture",
  subscription_cancel: "Annuler un abonnement",
};

export default function StepUpAuthDialog({
  open,
  onOpenChange,
  action,
  actionLabel,
  onVerified,
}: StepUpAuthDialogProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);

    const result = await stepUpWithPassword(password);

    if (result.success) {
      await auditAuth("step_up_verified", { action, method: "password" });
      setPassword("");
      onOpenChange(false);
      onVerified();
    } else {
      setError(result.error ?? "Erreur de vérification.");
    }

    setLoading(false);
  };

  const label = actionLabel ?? ACTION_LABELS[action] ?? action;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Lock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-white">Vérification requise</DialogTitle>
              <DialogDescription className="text-[hsl(220,10%,45%)]">
                Action sensible — Confirmez votre identité
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">{label}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Votre mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="h-11 bg-[hsl(220,20%,14%)] border-[hsl(220,15%,20%)] text-white placeholder:text-[hsl(220,10%,35%)]"
          />

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setPassword(""); onOpenChange(false); }}
              className="flex-1 text-[hsl(220,10%,50%)]"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!password.trim() || loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
            </Button>
          </div>
        </form>

        <p className="text-[10px] text-center text-[hsl(220,10%,30%)] mt-2">
          Cette vérification est valide 15 minutes
        </p>
      </DialogContent>
    </Dialog>
  );
}
