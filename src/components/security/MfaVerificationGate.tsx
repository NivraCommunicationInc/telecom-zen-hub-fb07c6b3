/**
 * MfaVerificationGate — Intercepts session and requires TOTP verification
 * before allowing access to internal portals.
 */
import { useState } from "react";
import { Shield, Loader2, AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { verifyMfaCode } from "@/lib/security/mfaUtils";
import { auditAuth } from "@/lib/security/internalAuditLogger";

interface MfaVerificationGateProps {
  factorId: string;
  onVerified: () => void;
  onLogout: () => void;
}

export default function MfaVerificationGate({ factorId, onVerified, onLogout }: MfaVerificationGateProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    setError(null);

    try {
      const success = await verifyMfaCode(factorId, code);
      if (success) {
        await auditAuth("mfa_verified", { method: "totp" });
        onVerified();
      } else {
        setError("Code invalide. Vérifiez l'heure de votre appareil et réessayez.");
        setCode("");
      }
    } catch {
      setError("Code invalide. Vérifiez l'heure de votre appareil et réessayez.");
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6) handleVerify();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="h-12 w-12 mx-auto rounded-xl bg-emerald-600/15 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Vérification 2FA</h1>
          <p className="text-xs text-[hsl(220,10%,45%)] mt-2">
            Entrez le code à 6 chiffres de votre application d'authentification.
          </p>
        </div>

        <div className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-14 text-center text-2xl font-mono tracking-[0.5em] bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white"
          />

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <Button
            onClick={handleVerify}
            disabled={code.length !== 6 || verifying}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vérifier"}
          </Button>

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="w-full text-center text-xs text-emerald-400/80 hover:text-emerald-300 transition-colors mt-3 inline-flex items-center justify-center gap-1.5"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Problème avec le code 2FA ?
          </button>

          <button
            onClick={onLogout}
            className="w-full text-center text-xs text-[hsl(220,10%,35%)] hover:text-red-400 transition-colors mt-2"
          >
            Déconnexion
          </button>
        </div>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white">
          <DialogHeader>
            <DialogTitle>Problème avec le code 2FA</DialogTitle>
            <DialogDescription className="text-[hsl(220,10%,55%)]">
              Le code TOTP dépend de l'heure exacte de votre appareil.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-[hsl(220,10%,75%)] list-decimal list-inside">
            <li>Synchronisez l'horloge de votre téléphone (Réglages → Date et heure → Automatique).</li>
            <li>Attendez le prochain code (un nouveau code apparaît toutes les 30 secondes).</li>
            <li>Si le problème persiste, contactez : <a href="mailto:support@nivra-telecom.ca" className="text-emerald-400 hover:underline">support@nivra-telecom.ca</a></li>
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
