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
import { Loader2, ShieldCheck, RefreshCw, Clock, AlertTriangle, Mail, CheckCircle2, XCircle, Send } from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AdminOTPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminUserId: string;
  adminEmail: string;
  onSuccess: (sessionToken: string, expiresAt: string, requestId: string) => void;
  onCancel: () => void;
}

type SendStatus = "idle" | "sending" | "success" | "error";

interface SendResult {
  ok: boolean;
  request_id?: string;
  message_id?: string;
  to_email?: string;
  from_email?: string;
  masked_email?: string;
  expires_at?: string;
  error?: string;
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
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [isLocked, setIsLocked] = useState(false);
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
        setVerifyError("Code expiré. Veuillez demander un nouveau code.");
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
      setVerifyError("");
      setIsLocked(false);
      setAttemptsLeft(5);
      setSendStatus("idle");
      setSendResult(null);
      hasSentInitial.current = false;
    }
  }, [open]);

  const sendOTP = async () => {
    setSendStatus("sending");
    setSendResult(null);
    setVerifyError("");
    setIsLocked(false);

    try {
      console.log(`[AdminOTP] Sending OTP for user: ${adminUserId}, email: ${adminEmail}`);
      
      const { data, error } = await supabase.functions.invoke("admin-otp-send", {
        body: { admin_user_id: adminUserId, email: adminEmail },
      });

      console.log("[AdminOTP] Send response:", { data, error });

      // Handle network/invoke errors
      if (error) {
        console.error("[AdminOTP] Function invoke error:", error);
        const result: SendResult = {
          ok: false,
          error: error.message || "Erreur lors de l'envoi du code",
          request_id: "invoke-error"
        };
        setSendResult(result);
        setSendStatus("error");
        toast.error("Erreur d'envoi OTP", {
          description: result.error,
        });
        return;
      }

      // Check if response has ok:true AND message_id
      if (!data?.ok) {
        const result: SendResult = {
          ok: false,
          error: data?.error || "Échec de l'envoi du code",
          request_id: data?.request_id || "unknown"
        };
        setSendResult(result);
        setSendStatus("error");
        toast.error("Échec envoi OTP", {
          description: `${result.error} (ID: ${result.request_id})`,
        });
        return;
      }

      // Verify message_id exists
      if (!data.message_id) {
        const result: SendResult = {
          ok: false,
          error: "Resend n'a pas retourné de message_id - email non envoyé",
          request_id: data.request_id || "unknown"
        };
        setSendResult(result);
        setSendStatus("error");
        toast.error("OTP non envoyé", {
          description: result.error,
        });
        return;
      }

      // SUCCESS: We have ok:true AND message_id
      const result: SendResult = {
        ok: true,
        request_id: data.request_id,
        message_id: data.message_id,
        to_email: data.to_email,
        from_email: data.from_email,
        masked_email: data.masked_email,
        expires_at: data.expires_at
      };
      
      setSendResult(result);
      setSendStatus("success");
      setExpiresAt(new Date(data.expires_at));
      setAttemptsLeft(5);
      setCountdown(30);
      
      toast.success("Code OTP envoyé avec succès", {
        description: `Message ID: ${data.message_id.slice(0, 12)}...`,
      });
      
    } catch (err: any) {
      console.error("[AdminOTP] Send error:", err);
      const result: SendResult = {
        ok: false,
        error: err.message || "Impossible d'envoyer le code",
        request_id: "exception"
      };
      setSendResult(result);
      setSendStatus("error");
      toast.error("Erreur", { description: result.error });
    }
  };

  const sendTestOTP = async () => {
    // Same as sendOTP but explicit for testing
    await sendOTP();
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      setVerifyError("Veuillez entrer le code à 6 chiffres");
      return;
    }

    setIsVerifying(true);
    setVerifyError("");

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
          setVerifyError("Compte verrouillé. Veuillez demander un nouveau code.");
        } else if (data?.attempts_left !== undefined) {
          setAttemptsLeft(data.attempts_left);
          setVerifyError(data.error || "Code incorrect");
        } else {
          setVerifyError(data?.error || "Code invalide");
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
      setVerifyError(err.message || "Erreur de vérification");
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

  const canProceedToInput = sendStatus === "success" && sendResult?.ok && sendResult?.message_id;

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
            Envoi du code de vérification à <strong>{adminEmail}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Send Status Display */}
          {sendStatus === "sending" && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Envoi en cours...</AlertTitle>
              <AlertDescription>
                Envoi du code OTP à: {adminEmail}
              </AlertDescription>
            </Alert>
          )}

          {sendStatus === "error" && sendResult && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Échec de l'envoi</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{sendResult.error}</p>
                <p className="text-xs font-mono">Request ID: {sendResult.request_id}</p>
              </AlertDescription>
            </Alert>
          )}

          {sendStatus === "success" && sendResult?.ok && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700 dark:text-green-400">OTP envoyé avec succès</AlertTitle>
              <AlertDescription className="space-y-1 text-green-600 dark:text-green-300">
                <p className="flex items-center gap-2">
                  <Mail className="w-3 h-3" />
                  <span>À: {sendResult.to_email}</span>
                </p>
                <p className="text-xs font-mono">Message ID: {sendResult.message_id}</p>
                <p className="text-xs font-mono">Request ID: {sendResult.request_id}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Only show OTP input if send was successful */}
          {canProceedToInput && (
            <>
              {/* Timer display */}
              {expiresAt && timeLeft && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Expire dans: <strong className={timeLeft === "Expiré" ? "text-destructive" : ""}>{timeLeft}</strong></span>
                  </div>
                </div>
              )}

              {/* OTP Input */}
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => {
                    setOtp(value);
                    setVerifyError("");
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

              {/* Verify error message */}
              {verifyError && (
                <p className="text-sm text-destructive text-center">{verifyError}</p>
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
            </>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            {canProceedToInput && (
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
                  "Vérifier le code"
                )}
              </Button>
            )}

            <Button
              variant={sendStatus === "error" ? "default" : "ghost"}
              onClick={sendOTP}
              disabled={countdown > 0 || sendStatus === "sending"}
              className="w-full"
            >
              {sendStatus === "sending" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : countdown > 0 ? (
                `Renvoyer le code (${countdown}s)`
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {sendStatus === "error" ? "Réessayer l'envoi" : "Renvoyer le code"}
                </>
              )}
            </Button>

            {/* Test OTP button for debugging */}
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestOTP}
              disabled={sendStatus === "sending"}
              className="w-full text-xs"
            >
              <Send className="w-3 h-3 mr-2" />
              Test: Renvoyer OTP (affiche message_id)
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
