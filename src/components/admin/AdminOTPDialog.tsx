import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, ShieldCheck, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend";
import { toast } from "sonner";

interface AdminOTPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminUserId: string;
  adminEmail: string;
  onSuccess: (sessionToken: string, expiresAt: string, requestId: string) => void;
  onCancel: () => void;
}

export const AdminOTPDialog = ({
  open,
  onOpenChange,
  adminUserId,
  adminEmail,
  onSuccess,
  onCancel,
}: AdminOTPDialogProps) => {
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [isLocked, setIsLocked] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const hasSentInitial = useRef(false);

  // Send OTP on dialog open
  useEffect(() => {
    if (open && adminUserId && !hasSentInitial.current) {
      hasSentInitial.current = true;
      sendOTP();
    }
  }, [open, adminUserId]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Time left until expiration
  useEffect(() => {
    if (!expiresAt) return;
    
    const updateTimeLeft = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft("Expiré");
        setError("Code expiré. Veuillez demander un nouveau code.");
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };
    
    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setOtp("");
      setError("");
      setIsLocked(false);
      setAttemptsLeft(5);
      hasSentInitial.current = false;
    }
  }, [open]);

  const sendOTP = async () => {
    setIsSending(true);
    setError("");
    setIsLocked(false);

    try {
      console.log(`[AdminOTP] Sending OTP for user: ${adminUserId}`);
      
      const { data, error } = await supabase.functions.invoke("admin-otp-send", {
        body: { admin_user_id: adminUserId, email: adminEmail },
      });

      console.log("[AdminOTP] Send response:", { data, error });

      if (error) {
        console.error("[AdminOTP] Function invoke error:", error);
        throw new Error(error.message || "Erreur lors de l'envoi du code");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Échec de l'envoi du code");
      }

      setRequestId(data.request_id);
      setMaskedEmail(data.masked_email);
      setExpiresAt(new Date(data.expires_at));
      setAttemptsLeft(5);
      setCountdown(30); // 30 second cooldown
      
      toast.success("Code de vérification envoyé", {
        description: `Vérifiez votre boîte de réception (${data.masked_email})`,
      });
      
    } catch (err: any) {
      console.error("[AdminOTP] Send error:", err);
      const errorMessage = err.message || "Impossible d'envoyer le code";
      setError(errorMessage);
      toast.error("Erreur", { description: errorMessage });
    } finally {
      setIsSending(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      setError("Veuillez entrer le code à 6 chiffres");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      console.log(`[AdminOTP] Verifying OTP for user: ${adminUserId}`);
      
      const { data, error } = await supabase.functions.invoke("admin-otp-verify", {
        body: { admin_user_id: adminUserId, email: adminEmail, otp },
      });

      console.log("[AdminOTP] Verify response:", { data, error });

      if (error) {
        throw new Error(error.message || "Erreur de vérification");
      }

      if (!data?.success) {
        // Handle specific error cases
        if (data?.locked) {
          setIsLocked(true);
          setAttemptsLeft(0);
          setError("Compte verrouillé. Veuillez demander un nouveau code.");
        } else if (data?.attempts_left !== undefined) {
          setAttemptsLeft(data.attempts_left);
          setError(data.error || "Code incorrect");
        } else {
          setError(data?.error || "Code invalide");
        }
        setOtp("");
        return;
      }

      // Success!
      console.log("[AdminOTP] Verification successful, request_id:", data.request_id);
      
      toast.success("Vérification réussie", {
        description: `Request ID: ${data.request_id}`,
      });
      
      onSuccess(data.session_token, data.session_expires_at, data.request_id);
      
    } catch (err: any) {
      console.error("[AdminOTP] Verify error:", err);
      setError(err.message || "Erreur de vérification");
      setOtp("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancel = async () => {
    // Sign out the user since 2FA failed/cancelled
    await supabase.auth.signOut();
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleCancel();
    }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Vérification en deux étapes
          </DialogTitle>
          <DialogDescription>
            Un code de vérification a été envoyé à <strong>{maskedEmail || adminEmail}</strong>.
            Entrez le code ci-dessous pour continuer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Timer and request ID */}
          {expiresAt && timeLeft && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Expire dans: <strong className={timeLeft === "Expiré" ? "text-destructive" : ""}>{timeLeft}</strong></span>
              </div>
              {requestId && (
                <span className="text-xs text-muted-foreground font-mono">
                  ID: {requestId.slice(-12)}
                </span>
              )}
            </div>
          )}

          {/* OTP Input */}
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                setError("");
              }}
              disabled={isVerifying || isLocked || timeLeft === "Expiré"}
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
          </div>

          {/* Attempts warning */}
          {attemptsLeft < 5 && attemptsLeft > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-600 dark:text-amber-400">
                {attemptsLeft} tentative(s) restante(s)
              </span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* Locked warning */}
          {isLocked && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive">
                Compte verrouillé. Demandez un nouveau code.
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={verifyOTP}
              disabled={otp.length !== 6 || isVerifying || isLocked || timeLeft === "Expiré"}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Vérifier"
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={sendOTP}
              disabled={countdown > 0 || isSending}
              className="w-full text-muted-foreground"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : countdown > 0 ? (
                `Renvoyer le code (${countdown}s)`
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Renvoyer le code
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleCancel}
              className="w-full"
            >
              Annuler
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Le code expire dans 10 minutes. Maximum 5 tentatives.
            Si vous ne recevez pas le courriel, vérifiez votre dossier spam.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminOTPDialog;
