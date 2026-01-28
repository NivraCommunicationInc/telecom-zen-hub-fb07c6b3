import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAdminSecretSession } from "@/hooks/useAdminSecretSession";
import { Eye, EyeOff, Lock, Mail, Shield, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { adminClient } from "@/integrations/backend";
import AdminSecretCodeDialog from "@/components/admin/AdminSecretCodeDialog";
import StaffBackground from "@/components/staff/StaffBackground";

const loginSchema = z.object({
  email: z.string().email("Adresse courriel invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const AdminLogin = () => {
  const navigate = useNavigate();
  const { user, session, isLoading } = useAuth();
  const { toast } = useToast();
  const { storeSession, isValidSession, isChecking } = useAdminSecretSession();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Secret code state
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingUserEmail, setPendingUserEmail] = useState<string>("");

  // DEBUG: Log auth state
  console.log("[AdminLogin] render", { 
    hasUser: !!user, 
    hasSession: !!session, 
    isLoading,
    isChecking,
    isValidSession 
  });

  // Redirect if already authenticated AND has valid secret session
  useEffect(() => {
    if (!isLoading && !isChecking && user && session && isValidSession === true) {
      console.log("[AdminLogin] Already authenticated with valid secret session, redirecting to /admin");
      navigate("/admin", { replace: true });
    }
  }, [user, session, isLoading, isChecking, isValidSession, navigate]);

  // Add noindex meta tag for SEO protection
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (isForgotPassword) {
      // Forgot password flow
      const emailResult = z.string().email("Adresse courriel invalide").safeParse(email);
      if (!emailResult.success) {
        setErrors({ email: emailResult.error.errors[0].message });
        return;
      }

      setIsSubmitting(true);

      const redirectUrl = `${window.location.origin}/admin/reset-password`;
      const { error } = await adminClient.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
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

      toast({
        title: "Courriel envoyé!",
        description: "Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.",
      });
      setIsForgotPassword(false);
      setIsSubmitting(false);
    } else {
      // Login flow: email + password, then secret code
      const result = loginSchema.safeParse({ email, password });
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

      // Authenticate with email/password via adminClient
      const { data, error: signInError } = await adminClient.auth.signInWithPassword({
        email,
        password,
      });

      console.log("[AdminLogin] sign-in result", { 
        hasUser: !!data?.user, 
        hasSession: !!data?.session, 
        error: signInError 
      });

      if (signInError) {
        toast({
          title: "Erreur de connexion",
          description: signInError.message === "Invalid login credentials" 
            ? "Identifiants invalides" 
            : signInError.message,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Verify user has admin role
      try {
        const authUser = data?.user;
        if (!authUser) {
          throw new Error("Session invalide");
        }

        const { data: roleData, error: roleError } = await adminClient
          .from("user_roles")
          .select("role, status")
          .eq("user_id", authUser.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleError || !roleData) {
          await adminClient.auth.signOut();
          toast({
            title: "Accès refusé",
            description: "Vous n'avez pas les permissions administrateur.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        if (roleData.status !== "active") {
          await adminClient.auth.signOut();
          toast({
            title: "Compte désactivé",
            description: "Votre compte administrateur est désactivé.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        // Credentials OK - Show secret code dialog
        console.log("[AdminLogin] Credentials verified, showing secret code dialog");
        setPendingUserId(authUser.id);
        setPendingUserEmail(authUser.email || email);
        setShowSecretDialog(true);
        setIsSubmitting(false);

      } catch (err: any) {
        await adminClient.auth.signOut();
        toast({
          title: "Erreur",
          description: err.message || "Erreur de vérification des permissions",
          variant: "destructive",
        });
        setIsSubmitting(false);
      }
    }
  };

  const handleSecretSuccess = (sessionToken: string, expiresAt: string, usingDefaultCode: boolean) => {
    console.log("[AdminLogin] Secret code verified successfully");
    
    // Store the session
    if (pendingUserId) {
      storeSession(sessionToken, expiresAt, pendingUserId, usingDefaultCode);
    }
    
    setShowSecretDialog(false);
    setPendingUserId(null);
    
    if (usingDefaultCode) {
      toast({
        title: "Connexion réussie",
        description: "Pensez à définir votre propre code secret dans Paramètres > Sécurité.",
        duration: 8000,
      });
    } else {
      toast({
        title: "Connexion réussie",
        description: "Bienvenue dans le portail administrateur.",
      });
    }
    
    navigate("/admin", { replace: true });
  };

  const handleSecretCancel = () => {
    setShowSecretDialog(false);
    setPendingUserId(null);
    setIsSubmitting(false);
  };

  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <StaffBackground />
      
      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg shadow-teal-500/25 mb-4">
            <Shield className="h-8 w-8 text-slate-900" />
          </div>
          <h1 className="text-3xl font-bold text-white">Administration Nivra</h1>
          <p className="text-slate-300">
            {isForgotPassword 
              ? "Réinitialisation du mot de passe" 
              : "Portail administrateur sécurisé"}
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              {isForgotPassword ? (
                <>
                  <Mail className="h-5 w-5 text-teal-400" />
                  Mot de passe oublié
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5 text-teal-400" />
                  Connexion
                </>
              )}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {isForgotPassword 
                ? "Entrez votre courriel pour recevoir un lien de réinitialisation" 
                : "Entrez vos identifiants administrateur"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-teal-400/70" />
                  Adresse courriel
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nivra.ca"
                  className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-teal-400/50 focus:ring-teal-400/20"
                  disabled={isSubmitting}
                />
                {errors.email && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              {!isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-teal-400/70" />
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 pr-10 focus:border-teal-400/50 focus:ring-teal-400/20"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.password}
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-900 font-semibold shadow-lg shadow-teal-500/25 transition-all duration-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isForgotPassword ? "Envoi..." : "Connexion..."}
                  </>
                ) : (
                  isForgotPassword ? "Envoyer le lien" : "Se connecter"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(!isForgotPassword);
                    setErrors({});
                  }}
                  className="text-sm text-slate-300 hover:text-teal-400 transition-colors"
                >
                  {isForgotPassword 
                    ? "← Retour à la connexion" 
                    : "Mot de passe oublié?"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Back to site link */}
        <div className="text-center">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-teal-400 transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au site
          </Link>
        </div>

        <p className="text-center text-slate-400 text-sm">
          © {new Date().getFullYear()} Nivra Telecom. Accès réservé aux administrateurs.
        </p>
      </div>

      {/* Secret Code Dialog */}
      <AdminSecretCodeDialog
        open={showSecretDialog}
        onOpenChange={setShowSecretDialog}
        userId={pendingUserId || ""}
        userEmail={pendingUserEmail}
        onSuccess={handleSecretSuccess}
        onCancel={handleSecretCancel}
      />
    </div>
  );
};

export default AdminLogin;
