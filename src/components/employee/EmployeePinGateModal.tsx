/**
 * EmployeePinGateModal - PIN unlock modal for employee account access
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Lock, AlertTriangle, Loader2, User, Clock, ShieldAlert } from "lucide-react";
import { useEmployeePinGate } from "@/hooks/useEmployeePinGate";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";

interface EmployeePinGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  account: {
    id: string;
    clientId: string;
    clientName: string;
    accountNumber?: string;
  };
}

const accessReasons = [
  { value: "billing_inquiry", label: "Consultation facturation" },
  { value: "payment_recording", label: "Enregistrement de paiement" },
  { value: "streaming_management", label: "Gestion Streaming+" },
  { value: "ticket_support", label: "Support ticket" },
  { value: "account_review", label: "Révision de compte" },
  { value: "other", label: "Autre" },
];

export const EmployeePinGateModal = ({
  isOpen,
  onClose,
  onUnlocked,
  account,
}: EmployeePinGateModalProps) => {
  const { user } = useEmployeeAuth();
  const {
    verifyAndUnlock,
    isAccountLockedOut,
    isAccountUnlocked,
  } = useEmployeePinGate();

  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockoutStatus = isAccountLockedOut(account.id);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setReason("");
      setError(null);
    }
  }, [isOpen]);

  // Check if already unlocked
  useEffect(() => {
    if (isOpen && isAccountUnlocked(account.id)) {
      onUnlocked();
    }
  }, [isOpen, account.id, isAccountUnlocked, onUnlocked]);

  const handleSubmit = async () => {
    if (!pin || pin.length !== 4) {
      setError("Veuillez entrer un NIP de 4 chiffres");
      return;
    }

    if (!reason) {
      setError("Veuillez sélectionner une raison d'accès");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await verifyAndUnlock(
      account.id,
      account.clientId,
      account.clientName,
      pin,
      reason
    );

    setIsLoading(false);

    if (result.success) {
      onUnlocked();
    } else {
      setError(result.error || "Erreur de vérification");
      setPin("");
    }
  };

  const formatLockoutTime = () => {
    if (!lockoutStatus.locked) return "";
    const mins = Math.floor(lockoutStatus.remainingMs / 60000);
    const secs = Math.floor((lockoutStatus.remainingMs % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Déverrouillage de compte
          </DialogTitle>
          <DialogDescription>
            Entrez le NIP du client pour accéder aux données sensibles
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee info */}
          <div className="p-3 rounded-lg bg-accent/50 border border-border">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Employé:</span>
              <span className="font-medium">{user?.email}</span>
            </div>
          </div>

          {/* Account info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">Compte demandé:</p>
            <p className="font-medium">{account.clientName}</p>
            {account.accountNumber && (
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {account.accountNumber}
              </p>
            )}
          </div>

          {/* Lockout warning */}
          {lockoutStatus.locked ? (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
              <ShieldAlert className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="font-medium text-destructive">Compte verrouillé</p>
              <p className="text-sm text-muted-foreground mt-1">
                Trop de tentatives échouées. Réessayez dans{" "}
                <span className="font-mono font-medium">{formatLockoutTime()}</span>
              </p>
            </div>
          ) : (
            <>
              {/* Failed attempts warning */}
              {lockoutStatus.attempts > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-amber-600">
                      {3 - lockoutStatus.attempts} tentative(s) restante(s)
                    </span>
                  </div>
                </div>
              )}

              {/* Reason select */}
              <div className="space-y-2">
                <Label>Raison d'accès *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une raison" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessReasons.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PIN input */}
              <div className="space-y-2">
                <Label>NIP du client (4 chiffres) *</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pin.length === 4 && reason) {
                      handleSubmit();
                    }
                  }}
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Unlock duration info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>L'accès sera valide pour 10 minutes</span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          {!lockoutStatus.locked && (
            <Button
              onClick={handleSubmit}
              disabled={isLoading || pin.length !== 4 || !reason}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Déverrouiller
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeePinGateModal;
