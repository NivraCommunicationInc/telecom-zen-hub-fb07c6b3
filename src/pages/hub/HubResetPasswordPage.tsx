/**
 * HubResetPasswordPage — Landing page from the password reset email.
 * Lets the user set a new password, then signs them out so they can log in
 * again through /nivra-secure-hub-2617-internal/login, where the existing
 * MFA (Google Authenticator) flow is enforced automatically for admins.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useInternalTheme } from "@/hooks/useInternalTheme";

export default function HubResetPasswordPage() {
  const navigate = useNavigate();
  const { theme, themeClass, toggleTheme } = useInternalTheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase parses the recovery hash automatically and creates a session.
    // Subscribe so we know when it's ready.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasRecoverySession(true);
      }
    });

    // Also check immediately in case the event already fired.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasRecoverySession(true);
      else setHasRecoverySession((prev) => (prev === null ? false : prev));
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "Impossible de mettre à jour le mot de passe.");
        setLoading(false);
        return;
      }

      // Force a fresh login so the MFA gate (Google Authenticator) runs again.
      await supabase.auth.signOut();
      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        navigate("/nivra-secure-hub-2617-internal/login", { replace: true });
      }, 2000);
    } catch {
      setError("Erreur lors de la mise à jour du mot de passe.");
      setLoading(false);
    }
  };

  return (
    <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background px-4", themeClass)}>
      <div className="fixed right-3 top-3 z-40">
        <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="h-12 w-12 mx-auto rounded-xl bg-primary flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Nouveau mot de passe</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Choisissez un nouveau mot de passe pour votre compte Nivra Core. Vous devrez ensuite vous reconnecter et entrer votre code Google Authenticator.
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Mot de passe mis à jour avec succès. Redirection vers la connexion…
                </p>
              </div>
            </div>
          ) : hasRecoverySession === false ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  Lien de réinitialisation invalide ou expiré. Veuillez demander un nouveau lien.
                </p>
              </div>
              <Button
                onClick={() => navigate("/nivra-secure-hub-2617-internal/forgot-password", { replace: true })}
                className="w-full h-11"
              >
                Demander un nouveau lien
              </Button>
            </div>
          ) : hasRecoverySession === null ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Nouveau mot de passe (min. 8 caractères)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11"
              />
              <Input
                type="password"
                placeholder="Confirmer le nouveau mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11"
              />

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mettre à jour le mot de passe"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
