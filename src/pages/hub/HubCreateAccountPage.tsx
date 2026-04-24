/**
 * HubCreateAccountPage — Staff invitation onboarding.
 *
 * Reached via the invitation email link:
 *   https://nivra-telecom.ca/hub/create-account?token=XXXXXX
 *
 * Calls the `staff-complete-onboarding` Edge Function with:
 *   { token, password, pin, terms_accepted, terms_version }
 *
 * On success, redirects to /hub/login so the new staff member
 * can sign in with the credentials they just created.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { landingPathForRole, HUB_LOGIN_PATH } from "@/lib/security/portalRedirect";
import { createHubSession } from "@/lib/security/hubSession";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useInternalTheme } from "@/hooks/useInternalTheme";

const TERMS_VERSION = "1.0";

export default function HubCreateAccountPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, themeClass, toggleTheme } = useInternalTheme();

  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Lien d'invitation invalide ou expiré. Contactez votre administrateur.");
    }
  }, [token]);

  const passwordOk = password.length >= 8;
  const passwordsMatch = password === confirm && confirm.length > 0;
  const pinOk = /^\d{6}$/.test(pin);
  const pinsMatch = pin === pinConfirm && pinConfirm.length > 0;
  const canSubmit =
    !!token && passwordOk && passwordsMatch && pinOk && pinsMatch && terms && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "staff-complete-onboarding",
        {
          body: {
            token,
            password,
            pin,
            terms_accepted: true,
            terms_version: TERMS_VERSION,
          },
        },
      );

      if (invokeError) {
        setError(invokeError.message || "Erreur lors de la configuration du compte.");
        setLoading(false);
        return;
      }

      const result = data as { ok?: boolean; message?: string; code?: string } | null;

      if (!result?.ok) {
        if (result?.code === "ALREADY_CONFIGURED") {
          setError("Ce lien a déjà été utilisé. Connectez-vous avec votre mot de passe.");
        } else {
          setError(result?.message || "Erreur lors de la configuration du compte.");
        }
        setLoading(false);
        return;
      }

      setDone(true);

      // Sign the user in with the credentials they just set, then route them
      // straight to the correct portal based on their role + portal access flags.
      // Avoids dropping them on a blank /hub/login (no ?portal selector) screen.
      const result2 = result as { ok?: boolean; data?: { email?: string; role?: string | null } };
      const signInEmail = result2?.data?.email?.trim().toLowerCase();
      let landing = HUB_LOGIN_PATH;

      try {
        if (signInEmail) {
          const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
            email: signInEmail,
            password,
          });
          if (!signInError && signIn?.session?.user) {
            createHubSession(signIn.session.user.id);
            landing = landingPathForRole(result2?.data?.role ?? null);
          }
        }
      } catch (signInErr) {
        console.error("[HubCreateAccount] auto sign-in after onboarding failed:", signInErr);
      }

      setTimeout(() => navigate(landing, { replace: true }), 1500);
    } catch (err) {
      console.error("[HubCreateAccount] Unexpected error:", err);
      setError("Erreur inattendue. Réessayez ou contactez le support.");
      setLoading(false);
    }
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4 sm:p-6", themeClass)}>
      <div className="absolute top-4 right-4">
        <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <Card className="w-full max-w-[480px] border-border shadow-lg">
        <CardContent className="p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              Configurez votre compte Nivra
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Choisissez votre mot de passe et votre NIP de sécurité (6 chiffres)
              pour accéder au portail interne.
            </p>
          </div>

          {done ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-base font-semibold text-foreground">
                Compte configuré avec succès!
              </p>
              <p className="text-sm text-muted-foreground">
                Redirection vers la connexion...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Password */}
              <div>
                <Label htmlFor="password" className="text-sm">Mot de passe</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="pl-9 pr-10"
                    disabled={loading || !token}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm" className="text-sm">Confirmer le mot de passe</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-9"
                    disabled={loading || !token}
                    required
                  />
                </div>
                {confirm.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              {/* PIN */}
              <div>
                <Label htmlFor="pin" className="text-sm">NIP de sécurité (6 chiffres)</Label>
                <div className="relative mt-1.5">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="pl-9 tracking-widest"
                    disabled={loading || !token}
                    required
                  />
                </div>
                {pin.length > 0 && !pinOk && (
                  <p className="text-xs text-destructive mt-1">Le NIP doit être exactement 6 chiffres</p>
                )}
              </div>

              <div>
                <Label htmlFor="pinConfirm" className="text-sm">Confirmer le NIP</Label>
                <div className="relative mt-1.5">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pinConfirm"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="pl-9 tracking-widest"
                    disabled={loading || !token}
                    required
                  />
                </div>
                {pinConfirm.length > 0 && !pinsMatch && (
                  <p className="text-xs text-destructive mt-1">Les NIP ne correspondent pas</p>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-start gap-2 pt-2">
                <Checkbox
                  id="terms"
                  checked={terms}
                  onCheckedChange={(v) => setTerms(v === true)}
                  disabled={loading || !token}
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  J'accepte les{" "}
                  <Link
                    to="/terms-and-conditions"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    conditions d'utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link
                    to="/politique-confidentialite"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    politique de confidentialité
                  </Link>
                  .
                </Label>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={!canSubmit}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Configuration en cours…
                  </>
                ) : (
                  "Activer mon compte"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground pt-2">
                Déjà configuré?{" "}
                <Link to="/hub/login" className="text-primary hover:underline">
                  Se connecter
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
