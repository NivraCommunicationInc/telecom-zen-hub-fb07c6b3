/**
 * CustomerPinGate — Modal and access gate for customer PIN verification.
 * Wraps employee/field/technician customer detail pages to enforce PIN before showing data.
 * If agent cannot provide PIN, forces structured reason capture via NipBypassReasonDialog.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, Loader2, Lock, AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import { useCustomerPinAccess } from "@/employee-app/hooks/useCustomerPinAccess";
import { NipBypassReasonDialog } from "@/shared-ops/components/NipBypassReasonDialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CustomerPinGateProps {
  customerId: string;
  accountId?: string;
  portal?: "employee" | "field" | "technician";
  children: React.ReactNode;
}

export function CustomerPinGate({ customerId, accountId, portal = "employee", children }: CustomerPinGateProps) {
  const {
    hasAccess, isChecking, expiresAt,
    showPinModal, setShowPinModal,
    verifyPin, requestAccess,
  } = useCustomerPinAccess(customerId);

  const [showBypassDialog, setShowBypassDialog] = useState(false);
  const [bypassed, setBypassed] = useState(false);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-3 text-sm text-muted-foreground">Vérification de l'accès…</span>
      </div>
    );
  }

  if (hasAccess || bypassed) {
    return (
      <>
        {/* Session indicator */}
        {expiresAt && !bypassed && (
          <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            <Clock className="h-3.5 w-3.5" />
            Session NIP active jusqu'à {format(new Date(expiresAt), "HH:mm", { locale: fr })}
          </div>
        )}
        {bypassed && (
          <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            Accès sans NIP — raison enregistrée dans le journal de sécurité
          </div>
        )}
        {children}
      </>
    );
  }

  // No access — show blocked state + modal trigger + bypass option
  return (
    <>
      <div className="flex flex-col items-center justify-center h-96 gap-6">
        <div className="p-5 rounded-full bg-secondary border border-border">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="text-lg font-semibold text-foreground">Accès protégé</h2>
          <p className="text-sm text-muted-foreground">
            Pour accéder aux données de ce client, vous devez entrer son NIP de sécurité.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Button onClick={requestAccess} className="gap-2">
            <Shield className="h-4 w-4" />
            Vérifier le NIP client
          </Button>
          <button
            onClick={() => setShowBypassDialog(true)}
            className="text-xs text-muted-foreground hover:text-amber-400 transition-colors underline underline-offset-2"
          >
            Continuer sans NIP (raison requise)
          </button>
        </div>
      </div>

      <PinVerifyModal
        open={showPinModal}
        onOpenChange={setShowPinModal}
        onVerify={verifyPin}
      />

      <NipBypassReasonDialog
        open={showBypassDialog}
        customerId={customerId}
        accountId={accountId}
        portal={portal}
        onBypassGranted={() => {
          setShowBypassDialog(false);
          setBypassed(true);
        }}
        onCancel={() => setShowBypassDialog(false)}
      />
    </>
  );
}

/* ---------- PIN Modal ---------- */

interface PinVerifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (pin: string) => Promise<{ ok: boolean; message: string; attempts_remaining?: number; locked?: boolean }>;
}

function PinVerifyModal({ open, onOpenChange, onVerify }: PinVerifyModalProps) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const handleVerify = async () => {
    if (pin.length !== 4) return;
    setIsVerifying(true);
    setError("");

    const result = await onVerify(pin);

    if (!result.ok) {
      setError(result.message);
      setAttemptsRemaining(result.attempts_remaining ?? null);
      setIsLocked(result.locked ?? false);
      setPin("");
    }

    setIsVerifying(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setPin("");
    setError("");
    setAttemptsRemaining(null);
    setIsLocked(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Vérification NIP client
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Entrez le NIP à 4 chiffres du client pour accéder à son dossier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLocked ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-muted-foreground">NIP client (4 chiffres)</Label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  placeholder="••••"
                  className="text-center text-xl tracking-[0.5em] pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pin.length === 4) handleVerify();
                  }}
                  disabled={isVerifying}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {error && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-destructive">{error}</p>
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({attemptsRemaining} tentative{attemptsRemaining !== 1 ? "s" : ""} restante{attemptsRemaining !== 1 ? "s" : ""})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isVerifying}>
            Annuler
          </Button>
          {!isLocked && (
            <Button onClick={handleVerify} disabled={isVerifying || pin.length !== 4}>
              {isVerifying && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Vérifier
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
