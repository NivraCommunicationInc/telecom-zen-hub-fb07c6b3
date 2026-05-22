import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, AlertTriangle, Lock, Info } from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend";

interface AdminSecretCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  onSuccess: (sessionToken: string, expiresAt: string, usingDefaultCode: boolean) => void;
  onCancel: () => void;
}

interface VerifyResponse {
  ok: boolean;
  request_id?: string;
  error?: string;
  session_token?: string;
  session_expires_at?: string;
  using_default_code?: boolean;
  locked?: boolean;
  locked_until?: string;
  remaining_minutes?: number;
  attempts_left?: number;
}

export function AdminSecretCodeDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  onSuccess,
  onCancel,
}: AdminSecretCodeDialogProps) {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  // CRITICAL: Track if verification succeeded to prevent onCancel from firing on dialog close
  const verificationSucceededRef = useRef(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setRequestId(null);
      setAttemptsLeft(null);
      setIsLocked(false);
      setLockedUntil(null);
      setRemainingMinutes(null);
      verificationSucceededRef.current = false;
    }
  }, [open]);

  // Verify the code
  const verifyCode = useCallback(async () => {
    if (code.length !== 6 || isVerifying || isLocked) return;

    setIsVerifying(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-secret-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          admin_user_id: userId,
          code: code,
          session_id: sessionId,
        }),
      });

      const data: VerifyResponse = await response.json();
      setRequestId(data.request_id || null);

      if (data.ok && data.session_token) {
        // CRITICAL: Mark success BEFORE calling onSuccess to prevent onCancel from firing
        verificationSucceededRef.current = true;
        onSuccess(data.session_token, data.session_expires_at!, data.using_default_code || false);
      } else {
        // Handle errors
        if (data.locked) {
          setIsLocked(true);
          setLockedUntil(data.locked_until || null);
          setRemainingMinutes(data.remaining_minutes || null);
          setError("Compte verrouillé pour trop de tentatives.");
        } else {
          setError(data.error || "Code invalide");
          setAttemptsLeft(data.attempts_left ?? null);
        }
        setCode("");
      }
    } catch (err) {
      console.error("[AdminSecretCode] Verification error:", err);
      setError("Erreur de connexion. Veuillez réessayer.");
      setCode("");
    } finally {
      setIsVerifying(false);
    }
  }, [code, isVerifying, isLocked, userId, sessionId, onSuccess]);

  // Auto-verify when code is complete
  useEffect(() => {
    if (code.length === 6 && !isVerifying && !isLocked) {
      verifyCode();
    }
  }, [code, isVerifying, isLocked, verifyCode]);

  const handleExplicitCancel = async () => {
    // Only sign out when the user explicitly clicks "Annuler"
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    onCancel();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Dialog is closing
      if (verificationSucceededRef.current) {
        // SUCCESS PATH: Don't call onCancel, just let it close
        onOpenChange(false);
        return;
      }
      // CANCEL PATH: User closed without success (e.g., clicked outside, pressed Escape)
      // But we've disabled pointer-down-outside, so this is only Escape key
      onCancel();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // Prevent escape from closing if verification is in progress
          if (isVerifying) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Code secret administrateur
          </DialogTitle>
          <DialogDescription>
            Entrez votre code secret à 6 chiffres pour accéder au portail admin.
            <span className="block mt-1 text-xs text-muted-foreground">
              Ce code n'est pas envoyé par courriel.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info about user */}
          <Alert variant="default" className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Compte administrateur: <strong>{userEmail}</strong>
            </AlertDescription>
          </Alert>

          {/* Locked state */}
          {isLocked && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertTitle>Compte verrouillé</AlertTitle>
              <AlertDescription>
                Trop de tentatives incorrectes. Réessayez dans {remainingMinutes} minute{remainingMinutes !== 1 ? 's' : ''}.
                {requestId && (
                  <div className="text-xs mt-1 opacity-70">ID: {requestId}</div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Error state */}
          {error && !isLocked && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>
                {error}
                {attemptsLeft !== null && (
                  <div className="mt-1 font-medium">
                    {attemptsLeft} tentative{attemptsLeft !== 1 ? 's' : ''} restante{attemptsLeft !== 1 ? 's' : ''}
                  </div>
                )}
                {requestId && (
                  <div className="text-xs mt-1 opacity-70">ID: {requestId}</div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* OTP Input */}
          {!isLocked && (
            <div className="flex flex-col items-center space-y-4">
              <InputOTP
                value={code}
                onChange={setCode}
                maxLength={6}
                disabled={isVerifying}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              {isVerifying && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
                  Vérification...
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={handleExplicitCancel}>
              Annuler
            </Button>
            <Button
              onClick={verifyCode}
              disabled={code.length !== 6 || isVerifying || isLocked}
            >
              {isVerifying ? "Vérification..." : "Vérifier"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AdminSecretCodeDialog;
