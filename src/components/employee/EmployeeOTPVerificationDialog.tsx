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
import { Loader2, ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface EmployeeOTPVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EmployeeOTPVerificationDialog = ({
  open,
  onOpenChange,
  userId,
  userEmail,
  onSuccess,
  onCancel,
}: EmployeeOTPVerificationDialogProps) => {
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const hasSentInitial = useRef(false);

  // Send OTP on dialog open
  useEffect(() => {
    if (open && userId && !hasSentInitial.current) {
      hasSentInitial.current = true;
      sendOTP();
    }
  }, [open, userId]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setOtp("");
      setError("");
      setCodeSent(false);
      hasSentInitial.current = false;
    }
  }, [open]);

  const sendOTP = async () => {
    setIsSending(true);
    setError("");

    try {
      console.log(`[EmployeeOTP] Sending OTP to user: ${userId}`);
      
      const response = await fetch(`${EDGE_FUNCTION_URL}/staff-otp-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json().catch(() => ({}));
      
      console.log(`[EmployeeOTP] Send response:`, { ok: response.ok, data });

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Échec de l'envoi du code");
      }

      toast.success("Code de vérification envoyé à votre adresse courriel");
      setCodeSent(true);
      setCountdown(60);
    } catch (err: any) {
      console.error("[EmployeeOTP] Send error:", err);
      const errorMessage = err.message || "Impossible d'envoyer le code";
      setError(errorMessage);
      toast.error(`Erreur: ${errorMessage}`);
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
      console.log(`[EmployeeOTP] Verifying OTP for user: ${userId}`);
      
      const response = await fetch(`${EDGE_FUNCTION_URL}/staff-otp-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ user_id: userId, code: otp }),
      });

      const data = await response.json().catch(() => ({}));
      
      console.log(`[EmployeeOTP] Verify response:`, { ok: response.ok, data });

      if (!response.ok) {
        setError(data?.error || "Code invalide");
        setOtp("");
        return;
      }

      if (!data?.success) {
        setError(data?.error || "Code invalide");
        setOtp("");
        return;
      }

      toast.success("Vérification réussie");
      onSuccess();
    } catch (err: any) {
      console.error("[EmployeeOTP] Verify error:", err);
      setError(err.message || "Erreur de vérification");
      setOtp("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleCancel();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Vérification en deux étapes
          </DialogTitle>
          <DialogDescription>
            {codeSent ? (
              <>Un code de vérification a été envoyé à <strong>{userEmail}</strong>. Entrez le code ci-dessous pour continuer.</>
            ) : (
              <>Envoi du code de vérification à <strong>{userEmail}</strong>...</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning banner - OTP is required */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-600 dark:text-amber-400">
              La vérification en deux étapes est <strong>obligatoire</strong> pour accéder au portail employé.
            </p>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                setError("");
              }}
              disabled={isVerifying || !codeSent}
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

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={verifyOTP}
              disabled={otp.length !== 6 || isVerifying || !codeSent}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Vérifier et continuer"
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
            Le code expire dans 5 minutes. Si vous ne recevez pas le courriel,
            vérifiez votre dossier spam.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeOTPVerificationDialog;
