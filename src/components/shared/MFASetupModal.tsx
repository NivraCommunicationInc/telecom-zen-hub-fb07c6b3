/**
 * MFASetupModal — Blocking MFA enrollment for internal portals.
 *
 * Two methods:
 *   1) Email OTP (uses staff-otp-send / staff-otp-verify edge functions)
 *   2) TOTP authenticator app (uses supabase.auth.mfa.enroll/challengeAndVerify)
 *
 * On success, persists mfa_method + mfa_configured_at on profiles.
 * Cannot be skipped or dismissed.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Mail, Smartphone, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  userId: string;
  onConfigured: () => void;
}

type Step = "choose" | "email" | "totp";

export default function MFASetupModal({ userId, onConfigured }: Props) {
  const [step, setStep] = useState<Step>("choose");

  return (
    <Dialog open={true}>
      <DialogContent
        className="max-w-lg gap-0 p-0 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Authentification à deux facteurs requise
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Pour sécuriser votre compte, vous devez configurer une méthode MFA avant d'accéder au portail.
          </p>
        </DialogHeader>

        <div className="px-6 py-5">
          {step === "choose" && <ChooseMethod onPick={setStep} />}
          {step === "email" && (
            <EmailOtpFlow
              userId={userId}
              onBack={() => setStep("choose")}
              onConfigured={onConfigured}
            />
          )}
          {step === "totp" && (
            <TotpFlow
              userId={userId}
              onBack={() => setStep("choose")}
              onConfigured={onConfigured}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChooseMethod({ onPick }: { onPick: (s: Step) => void }) {
  return (
    <div className="space-y-3">
      <button
        onClick={() => onPick("email")}
        className="w-full flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-left transition"
      >
        <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">Recevoir un code par courriel</div>
          <div className="text-xs text-muted-foreground mt-1">
            Un code à 6 chiffres sera envoyé à votre adresse courriel à chaque connexion.
          </div>
        </div>
      </button>
      <button
        onClick={() => onPick("totp")}
        className="w-full flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-left transition"
      >
        <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">Utiliser une application d'authentification</div>
          <div className="text-xs text-muted-foreground mt-1">
            Recommandé. Compatible avec Google Authenticator, Authy, 1Password, etc.
          </div>
        </div>
      </button>
    </div>
  );
}

function EmailOtpFlow({
  userId,
  onBack,
  onConfigured,
}: {
  userId: string;
  onBack: () => void;
  onConfigured: () => void;
}) {
  const [stage, setStage] = useState<"send" | "verify">("send");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const remainingLockSec =
    lockedUntil && lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;

  const sendCode = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("staff-otp-send", {
        body: { user_id: userId },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Erreur");
      toast.success("Code envoyé. Vérifiez votre courriel.");
      setStage("verify");
    } catch (err) {
      console.error("[MFA email send]", err);
      toast.error("Impossible d'envoyer le code. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (lockedUntil && lockedUntil > Date.now()) return;
    if (code.length !== 6) {
      toast.error("Le code doit contenir 6 chiffres.");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("staff-otp-verify", {
        body: { user_id: userId, code },
      });
      if (error || !data?.success) {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= 3) {
          const lockUntil = Date.now() + 30 * 60 * 1000;
          setLockedUntil(lockUntil);
          toast.error("Trop de tentatives. Compte verrouillé 30 minutes.");
        } else {
          toast.error(`Code invalide. ${3 - next} tentative(s) restante(s).`);
        }
        return;
      }

      // Persist MFA configuration on profile
      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          mfa_method: "email",
          mfa_configured_at: new Date().toISOString(),
          mfa_enabled: true,
          mfa_verified_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (updErr) throw updErr;

      toast.success("MFA par courriel activé.");
      onConfigured();
    } catch (err) {
      console.error("[MFA email verify]", err);
      toast.error("Erreur de vérification. Réessayez.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Changer de méthode
      </button>

      {stage === "send" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Nous allons envoyer un code à 6 chiffres à votre adresse courriel.
            Le code est valide 10 minutes.
          </p>
          <Button onClick={sendCode} disabled={sending} className="w-full">
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Envoyer le code
          </Button>
        </div>
      )}

      {stage === "verify" && (
        <div className="space-y-3">
          <Label htmlFor="otp">Code reçu par courriel</Label>
          <Input
            id="otp"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="text-center text-2xl tracking-widest font-mono"
            disabled={!!lockedUntil && remainingLockSec > 0}
          />
          {lockedUntil && remainingLockSec > 0 && (
            <p className="text-xs text-destructive">
              Verrouillé. Réessayez dans {Math.floor(remainingLockSec / 60)}m {remainingLockSec % 60}s.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={sendCode}
              disabled={sending || (lockedUntil ? remainingLockSec > 0 : false)}
              className="flex-1"
            >
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Renvoyer
            </Button>
            <Button
              onClick={verifyCode}
              disabled={
                verifying ||
                code.length !== 6 ||
                (lockedUntil ? remainingLockSec > 0 : false)
              }
              className="flex-1"
            >
              {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Vérifier
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TotpFlow({
  userId,
  onBack,
  onConfigured,
}: {
  userId: string;
  onBack: () => void;
  onConfigured: () => void;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enrolling, setEnrolling] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Clean any existing unverified TOTP factor before enrolling
        const { data: list } = await supabase.auth.mfa.listFactors();
        const existing = list?.totp?.find((f) => f.status !== "verified");
        if (existing) {
          await supabase.auth.mfa.unenroll({ factorId: existing.id });
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Nivra Portail ${new Date().toISOString().slice(0, 10)}`,
        });
        if (error) throw error;
        if (cancelled || !data) return;
        setFactorId(data.id);
        setQr(data.totp?.qr_code ?? null);
        setSecret(data.totp?.secret ?? null);
      } catch (err) {
        console.error("[MFA TOTP enroll]", err);
        toast.error("Impossible de démarrer la configuration TOTP.");
      } finally {
        if (!cancelled) setEnrolling(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const verify = async () => {
    if (!factorId) return;
    if (code.length !== 6) {
      toast.error("Le code doit contenir 6 chiffres.");
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (error) throw error;

      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          mfa_method: "totp",
          mfa_configured_at: new Date().toISOString(),
          mfa_enabled: true,
          mfa_verified_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (updErr) throw updErr;

      toast.success("Application d'authentification configurée.");
      onConfigured();
    } catch (err) {
      console.error("[MFA TOTP verify]", err);
      toast.error("Code invalide. Réessayez.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Changer de méthode
      </button>

      {enrolling ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Génération du code QR...
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Scannez ce code QR avec votre application d'authentification
            (Google Authenticator, Authy, 1Password, etc.).
          </p>

          {qr && (
            <div className="flex justify-center bg-white p-3 rounded-lg border">
              <img src={qr} alt="QR code MFA" className="h-48 w-48" />
            </div>
          )}

          {secret && (
            <div className="text-xs text-muted-foreground">
              <span className="block mb-1">Saisie manuelle :</span>
              <code className="font-mono bg-muted px-2 py-1 rounded text-foreground break-all">
                {secret}
              </code>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="totp">Code à 6 chiffres affiché par votre application</Label>
            <Input
              id="totp"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="text-center text-2xl tracking-widest font-mono"
            />
          </div>

          <Button
            onClick={verify}
            disabled={verifying || code.length !== 6 || !factorId}
            className="w-full"
          >
            {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Activer l'authentification
          </Button>
        </>
      )}
    </div>
  );
}
