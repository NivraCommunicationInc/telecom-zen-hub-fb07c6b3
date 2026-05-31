/**
 * HubForgotPasswordPage — Allows internal staff to request a password reset email.
 * Sends to /nivra-secure-hub-2617-internal/reset-password. After resetting,
 * the user re-logs in through the hub, where the existing MFA (Google
 * Authenticator) flow is enforced automatically for admins.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useInternalTheme } from "@/hooks/useInternalTheme";

export default function HubForgotPasswordPage() {
  const { theme, themeClass, toggleTheme } = useInternalTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/nivra-secure-hub-2617-internal/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (resetError) {
        setError("Erreur lors de l'envoi du courriel. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      // Always show success to avoid revealing whether an account exists.
      setSent(true);
      setLoading(false);
    } catch {
      setError("Erreur lors de l'envoi du courriel. Veuillez réessayer.");
      setLoading(false);
    }
  };

  return (
    <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background px-4", themeClass)}>
      <div className="fixed right-3 top-3 z-40">
        <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Link
            to="/nivra-secure-hub-2617-internal/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à la connexion
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="h-12 w-12 mx-auto rounded-xl bg-primary flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Mot de passe oublié</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Entrez votre courriel professionnel. Un lien de réinitialisation vous sera envoyé s'il correspond à un compte Nivra Core.
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Si un compte interne existe pour cette adresse, vous recevrez un courriel de réinitialisation sous peu. Vérifiez votre boîte de réception et le dossier indésirable.
                </p>
              </div>
              <Link to="/nivra-secure-hub-2617-internal/login" className="block">
                <Button variant="outline" className="w-full h-11">Retour à la connexion</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="Courriel professionnel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
                disabled={loading || !email.trim()}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le lien"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
