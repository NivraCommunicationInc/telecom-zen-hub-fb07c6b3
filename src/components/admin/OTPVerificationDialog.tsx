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
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OTPVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const OTPVerificationDialog = ({
  open,
  onOpenChange,
  userId,
  userEmail,
  onSuccess,
  onCancel,
}: OTPVerificationDialogProps) => {
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
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
      hasSentInitial.current = false;
    }
  }, [open]);

  const sendOTP = async () => {
    setIsSending(true);
    setError("");

    try {
      const { data, error } = await supabase.functions.invoke("staff-otp-send", {
        body: { user_id: userId },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Échec de l'envoi du code");
      }

      toast.success("Code de vérification envoyé à votre adresse courriel");
      setCountdown(60); // 60 second cooldown
    } catch (err: any) {
      console.error("OTP send error:", err);
      setError(err.message || "Impossible d'envoyer le code");
      toast.error("Erreur lors de l'envoi du code");
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
      const { data, error } = await supabase.functions.invoke("staff-otp-verify", {
        body: { user_id: userId, code: otp },
      });

      if (error) throw error;

      if (!data?.success) {
        setError(data?.error || "Code invalide");
        setOtp("");
        return;
      }

      toast.success("Vérification réussie");
      onSuccess();
    } catch (err: any) {
      console.error("OTP verify error:", err);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Vérification en deux étapes
          </DialogTitle>
          <DialogDescription>
            Un code de vérification a été envoyé à <strong>{userEmail}</strong>.
            Entrez le code ci-dessous pour continuer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                setError("");
              }}
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
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={verifyOTP}
              disabled={otp.length !== 6 || isVerifying}
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
            Le code expire dans 5 minutes. Si vous ne recevez pas le courriel,
            vérifiez votre dossier spam.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OTPVerificationDialog;
