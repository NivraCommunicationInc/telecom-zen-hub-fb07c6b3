import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Minimum 8 caractères")
    .regex(/\d/, "Doit contenir au moins un chiffre"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const EmployeeResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // Wait a moment for Supabase to process the URL hash
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Listen for auth state changes first
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("[EmployeeResetPassword] Auth event:", event);
        if (event === "PASSWORD_RECOVERY" && session) {
          console.log("[EmployeeResetPassword] PASSWORD_RECOVERY session received");
          setIsCheckingSession(false);
          setSessionError(null);
        } else if (event === "SIGNED_IN" && session) {
          console.log("[EmployeeResetPassword] SIGNED_IN session received");
          setIsCheckingSession(false);
          setSessionError(null);
        }
      });

      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("[EmployeeResetPassword] Session error:", error);
        setSessionError("Lien invalide ou expiré. Veuillez demander un nouveau lien de réinitialisation.");
        setIsCheckingSession(false);
        return;
      }
      
      if (session) {
        console.log("[EmployeeResetPassword] Session found");
        setIsCheckingSession(false);
        setSessionError(null);
      } else {
        // Check for error in URL
        const hash = window.location.hash;
        if (hash.includes("error=")) {
          const errorMatch = hash.match(/error_description=([^&]*)/);
          const errorDesc = errorMatch ? decodeURIComponent(errorMatch[1].replace(/\+/g, ' ')) : "Lien invalide ou expiré.";
          setSessionError(errorDesc);
          setIsCheckingSession(false);
          return;
        }

        // Wait a bit more for the session to be established
        setTimeout(() => {
          supabase.auth.getSession().then(({ data }) => {
            if (!data.session) {
              console.log("[EmployeeResetPassword] No session after wait");
              setSessionError("Lien invalide ou expiré. Veuillez demander un nouveau lien de réinitialisation.");
            }
            setIsCheckingSession(false);
          });
        }, 2000);
      }

      return () => subscription.unsubscribe();
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      toast({
        title: "Succès!",
        description: "Votre mot de passe a été réinitialisé.",
      });

      // Sign out before redirecting
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate("/employee/login");
      }, 2000);

    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Vérification du lien...</p>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-xl bg-destructive/20 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground mb-2">
            Lien expiré
          </h1>
          <p className="text-muted-foreground mb-6">{sessionError}</p>
          <Link to="/employee/login">
            <Button variant="hero">Retour à la connexion</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground mb-2">
            Mot de passe réinitialisé!
          </h1>
          <p className="text-muted-foreground mb-6">
            Vous allez être redirigé vers la page de connexion employé...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hero p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center mb-4">
            <span className="text-navy-900 font-bold text-2xl">N</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground">
            Réinitialiser le mot de passe
          </h1>
          <p className="text-muted-foreground mt-2">
            Portail Employé - Entrez votre nouveau mot de passe
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Nouveau mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword}</p>}
              <p className="text-xs text-muted-foreground">
                Min. 8 caractères, 1 chiffre
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Confirmer le mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
            </Button>
          </div>
        </form>

        <p className="text-center text-muted-foreground text-sm mt-6">
          <Link to="/employee/login" className="hover:text-cyan-400 transition-colors">
            ← Retour à la connexion employé
          </Link>
        </p>
      </div>
    </div>
  );
};

export default EmployeeResetPassword;
