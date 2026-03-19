/**
 * CustomerPinGate — Modal and access gate for customer PIN verification.
 * Wraps employee customer detail pages to enforce PIN before showing data.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, Loader2, Lock, AlertTriangle, Clock } from "lucide-react";
import { useCustomerPinAccess } from "@/employee-app/hooks/useCustomerPinAccess";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CustomerPinGateProps {
  customerId: string;
  children: React.ReactNode;
}

export function CustomerPinGate({ customerId, children }: CustomerPinGateProps) {
  const {
    hasAccess, isChecking, expiresAt,
    showPinModal, setShowPinModal,
    verifyPin, requestAccess,
  } = useCustomerPinAccess(customerId);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-3 text-sm text-[hsl(220,10%,50%)]">Vérification de l'accès…</span>
      </div>
    );
  }

  if (hasAccess) {
    return (
      <>
        {/* Session indicator */}
        {expiresAt && (
          <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-md bg-[hsl(150,60%,15%)] border border-[hsl(150,40%,25%)] text-xs text-[hsl(150,60%,70%)]">
            <Clock className="h-3.5 w-3.5" />
            Session active jusqu'à {format(new Date(expiresAt), "HH:mm", { locale: fr })}
          </div>
        )}
        {children}
      </>
    );
  }

  // No access — show blocked state + modal trigger
  return (
    <>
      <div className="flex flex-col items-center justify-center h-96 gap-6">
        <div className="p-5 rounded-full bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,18%)]">
          <Lock className="h-10 w-10 text-[hsl(220,15%,40%)]" />
        </div>
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="text-lg font-semibold text-[hsl(220,10%,85%)]">Accès protégé</h2>
          <p className="text-sm text-[hsl(220,10%,50%)]">
            Pour accéder aux données de ce client, vous devez entrer son NIP de sécurité.
          </p>
        </div>
        <Button onClick={requestAccess} className="gap-2">
          <Shield className="h-4 w-4" />
          Vérifier le NIP client
        </Button>
      </div>

      <PinVerifyModal
        open={showPinModal}
        onOpenChange={setShowPinModal}
        onVerify={verifyPin}
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
      <DialogContent className="sm:max-w-md bg-[hsl(220,20%,8%)] border-[hsl(220,15%,15%)] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[hsl(220,10%,90%)]">
            <Shield className="w-5 h-5 text-cyan-500" />
            Vérification NIP client
          </DialogTitle>
          <DialogDescription className="text-[hsl(220,10%,50%)]">
            Entrez le NIP à 4 chiffres du client pour accéder à son dossier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLocked ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-[hsl(0,40%,12%)] border border-[hsl(0,30%,25%)]">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-[hsl(220,10%,70%)]">NIP client (4 chiffres)</Label>
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
                  className="text-center text-xl tracking-[0.5em] pr-10 bg-[hsl(220,15%,10%)] border-[hsl(220,15%,18%)] text-white placeholder:text-[hsl(220,10%,30%)]"
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-[hsl(220,10%,40%)] hover:text-white"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {error && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-red-400">{error}</p>
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <span className="text-xs text-[hsl(220,10%,40%)]">
                      ({attemptsRemaining} tentative{attemptsRemaining !== 1 ? "s" : ""} restante{attemptsRemaining !== 1 ? "s" : ""})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isVerifying}
            className="border-[hsl(220,15%,18%)] text-[hsl(220,10%,70%)] hover:bg-[hsl(220,15%,12%)]">
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
