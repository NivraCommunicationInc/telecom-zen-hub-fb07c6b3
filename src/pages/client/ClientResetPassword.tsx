import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const ClientResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    let mounted = true;

    const cleanupUrl = () => {
      try {
        const url = new URL(window.location.href);
        // Remove sensitive auth params while keeping the path.
        url.hash = "";
        url.searchParams.delete("code");
        url.searchParams.delete("token_hash");
        url.searchParams.delete("type");
        url.searchParams.delete("redirect_to");
        const next = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;
        window.history.replaceState({}, document.title, next);
      } catch {
        // ignore
      }
    };

    // Listener FIRST (avoid missing PASSWORD_RECOVERY/SIGNED_IN)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session?.user) {
        setError(null);
        setValidating(false);
        cleanupUrl();
      }
    });

    const ensureRecoverySession = async () => {
      try {
        // 1) PKCE flow: /portal/reset-password?code=...
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          cleanupUrl();
        }

        // 2) token_hash flow: /portal/reset-password?token_hash=...&type=recovery
        const tokenHash = searchParams.get("token_hash");
        const queryType = searchParams.get("type");
        if (tokenHash && (queryType === "recovery" || !queryType)) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;
          cleanupUrl();
        }

        // 3) Implicit flow: /portal/reset-password#access_token=...&refresh_token=...&type=recovery
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hashType = hashParams.get("type");
        if (accessToken && hashType === "recovery") {
          if (!refreshToken) {
            throw new Error("Lien incomplet (token manquant). Veuillez rouvrir le lien depuis l'email.");
          }
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          cleanupUrl();
        }

        // Finally, confirm we have a session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setError("Le lien de réinitialisation a expiré ou est invalide. Veuillez en demander un nouveau.");
        }
      } catch {
        // Avoid leaking technical details; show a clear actionable message.
        setError("Le lien de réinitialisation a expiré ou est invalide. Veuillez en demander un nouveau.");
      } finally {
        if (mounted) setValidating(false);
      }
    };

    ensureRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const validatePassword = (pwd: string) => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd)
    };
    return checks;
  };

  const passwordChecks = validatePassword(password);
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast({
        title: "Mot de passe invalide",
        description: "Le mot de passe ne respecte pas les critères requis.",
        variant: "destructive"
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("Session expirée. Veuillez rouvrir le lien de réinitialisation depuis l'email.");
      }

      // Best-effort refresh (some clients/browser contexts can end up with a stale access token).
      await supabase.auth.refreshSession();

      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été mis à jour avec succès."
      });

      // Redirect to portal after 3 seconds
      setTimeout(() => {
        navigate("/portal/auth");
      }, 3000);
    } catch (err: any) {
      console.error("Password update error:", err);
      const message =
        typeof err?.message === "string" && err.message.trim()
          ? err.message
          : typeof err?.error_description === "string" && err.error_description.trim()
            ? err.error_description
            : typeof err?.error === "string" && err.error.trim()
              ? err.error
              : "Impossible de modifier le mot de passe.";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification du lien...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle>Lien invalide</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Vous pouvez demander un nouveau lien de réinitialisation depuis la page de connexion.
            </p>
            <Button onClick={() => navigate("/portal/auth")}>
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Mot de passe modifié!</CardTitle>
            <CardDescription>
              Votre mot de passe a été mis à jour avec succès.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Vous allez être redirigé vers la page de connexion...
            </p>
            <Button onClick={() => navigate("/portal/auth")}>
              Se connecter maintenant
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <img 
            src="/icons/nivra-192.png" 
            alt="Nivra Telecom" 
            className="h-10 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold">Réinitialiser le mot de passe</h1>
          <p className="text-muted-foreground mt-1">
            Choisissez un nouveau mot de passe sécurisé
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                Nouveau mot de passe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Le mot de passe doit contenir:</p>
                <ul className="space-y-1">
                  <li className={`flex items-center gap-2 ${passwordChecks.length ? 'text-green-600' : 'text-muted-foreground'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.length ? 'bg-green-500/20' : 'bg-muted'}`}>
                      {passwordChecks.length && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    Au moins 8 caractères
                  </li>
                  <li className={`flex items-center gap-2 ${passwordChecks.uppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.uppercase ? 'bg-green-500/20' : 'bg-muted'}`}>
                      {passwordChecks.uppercase && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    Une lettre majuscule
                  </li>
                  <li className={`flex items-center gap-2 ${passwordChecks.lowercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.lowercase ? 'bg-green-500/20' : 'bg-muted'}`}>
                      {passwordChecks.lowercase && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    Une lettre minuscule
                  </li>
                  <li className={`flex items-center gap-2 ${passwordChecks.number ? 'text-green-600' : 'text-muted-foreground'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.number ? 'bg-green-500/20' : 'bg-muted'}`}>
                      {passwordChecks.number && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    Un chiffre
                  </li>
                </ul>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-sm text-destructive">Les mots de passe ne correspondent pas</p>
                )}
                {passwordsMatch && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Les mots de passe correspondent
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !isPasswordValid || !passwordsMatch}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Modification en cours...
                  </>
                ) : (
                  "Modifier le mot de passe"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Besoin d'aide? Contactez-nous à support@nivra-telecom.ca</p>
        </div>
      </div>
    </div>
  );
};

export default ClientResetPassword;
