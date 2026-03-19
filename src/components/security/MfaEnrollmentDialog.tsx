/**
 * MfaEnrollmentDialog — Forces TOTP enrollment for staff without MFA.
 * Shows QR code, asks for verification code to complete enrollment.
 */
import { useState, useEffect } from "react";
import { Shield, Loader2, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enrollMfa, verifyMfaCode } from "@/lib/security/mfaUtils";
import { auditAuth } from "@/lib/security/internalAuditLogger";
import { supabase } from "@/integrations/supabase/client";

interface MfaEnrollmentDialogProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export default function MfaEnrollmentDialog({ onComplete, onCancel }: MfaEnrollmentDialogProps) {
  const [step, setStep] = useState<"loading" | "qr" | "verify" | "success" | "error">("loading");
  const [qrUri, setQrUri] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const startEnrollment = async () => {
      try {
        const data = await enrollMfa();
        setQrUri(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep("qr");
      } catch (err) {
        console.error("[MFA Enroll] Error:", err);
        setError("Impossible d'initialiser la 2FA. Veuillez réessayer.");
        setStep("error");
      }
    };
    startEnrollment();
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    setError(null);

    try {
      const success = await verifyMfaCode(factorId, code);
      if (success) {
        // Mark MFA as enrolled in user_roles
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase
            .from("user_roles")
            .update({ mfa_enrolled_at: new Date().toISOString() })
            .eq("user_id", session.user.id)
            .eq("status", "active");
        }
        await auditAuth("mfa_enrolled", { method: "totp" });
        setStep("success");
        setTimeout(onComplete, 1500);
      } else {
        setError("Code invalide. Veuillez réessayer.");
      }
    } catch {
      setError("Erreur de vérification.");
    } finally {
      setVerifying(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[hsl(220,20%,4%)]/95 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,18%)] rounded-2xl p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-emerald-600/15 flex items-center justify-center">
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Authentification 2FA</h2>
            <p className="text-xs text-[hsl(220,10%,45%)]">Obligatoire pour les comptes internes</p>
          </div>
        </div>

        {step === "loading" && (
          <div className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <p className="text-sm text-[hsl(220,10%,50%)]">Initialisation…</p>
          </div>
        )}

        {step === "qr" && (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-[hsl(220,10%,60%)] mb-4">
                Scannez ce code QR avec votre application d'authentification (Google Authenticator, Authy, etc.)
              </p>
              <div className="bg-white rounded-xl p-4 w-fit mx-auto">
                <img src={qrUri} alt="QR Code 2FA" className="w-48 h-48" />
              </div>
            </div>

            <div>
              <p className="text-xs text-[hsl(220,10%,40%)] mb-1.5">Ou entrez cette clé manuellement :</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-[hsl(220,20%,14%)] border border-[hsl(220,15%,20%)] rounded-lg text-xs text-emerald-400 font-mono break-all">
                  {secret}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySecret}
                  className="shrink-0 text-[hsl(220,10%,45%)] hover:text-white"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button
              onClick={() => setStep("verify")}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              J'ai scanné le code
            </Button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-5">
            <p className="text-sm text-[hsl(220,10%,60%)]">
              Entrez le code à 6 chiffres affiché dans votre application d'authentification.
            </p>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              className="h-14 text-center text-2xl font-mono tracking-[0.5em] bg-[hsl(220,20%,14%)] border-[hsl(220,15%,20%)] text-white"
            />

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setStep("qr")}
                className="flex-1 text-[hsl(220,10%,50%)]"
              >
                Retour
              </Button>
              <Button
                onClick={handleVerify}
                disabled={code.length !== 6 || verifying}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vérifier"}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="py-8 flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-medium text-white">2FA activée avec succès</p>
            <p className="text-xs text-[hsl(220,10%,45%)]">Redirection en cours…</p>
          </div>
        )}

        {step === "error" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <div className="flex gap-3">
              {onCancel && (
                <Button variant="ghost" onClick={onCancel} className="text-[hsl(220,10%,50%)]">
                  Annuler
                </Button>
              )}
              <Button
                onClick={() => window.location.reload()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Réessayer
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
