import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAdminOTPSession } from "@/hooks/useAdminOTPSession";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { z } from "zod";
import { adminClient } from "@/integrations/backend";
import AdminOTPDialog from "@/components/admin/AdminOTPDialog";

const loginSchema = z.object({
  email: z.string().email("Adresse courriel invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const AdminLogin = () => {
  const navigate = useNavigate();
  const { user, session, signIn, isLoading } = useAuth();
  const { toast } = useToast();
  const { storeSession, isValidSession, isChecking } = useAdminOTPSession();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // OTP state
  const [showOTPDialog, setShowOTPDialog] = useState(false);
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

  // Redirect if already authenticated AND has valid OTP session
  useEffect(() => {
    if (!isLoading && !isChecking && user && session && isValidSession === true) {
      console.log("[AdminLogin] Already authenticated with valid OTP session, redirecting to /admin");
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
      // Login flow: email + password, then OTP
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

        // Credentials OK - Always require OTP (no bypass)
        console.log("[AdminLogin] Credentials verified, showing OTP dialog");
        setPendingUserId(authUser.id);
        setPendingUserEmail(authUser.email || email);
        setShowOTPDialog(true);
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

  const handleOTPSuccess = (sessionToken: string, expiresAt: string, requestId: string) => {
    console.log("[AdminLogin] OTP verified successfully, request_id:", requestId);
    
    // Store the OTP session
    if (pendingUserId) {
      storeSession(sessionToken, expiresAt, pendingUserId);
    }
    
    setShowOTPDialog(false);
    setPendingUserId(null);
    
    toast({
      title: "Connexion réussie",
      description: `Bienvenue dans le portail administrateur. (ID: ${requestId.slice(-12)})`,
    });
    
    navigate("/admin", { replace: true });
  };

  const handleOTPCancel = () => {
    setShowOTPDialog(false);
    setPendingUserId(null);
    setIsSubmitting(false);
  };

  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hero p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center mb-4">
            <span className="text-navy-900 font-bold text-2xl">N</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground">
            Administration Nivra
          </h1>
          <p className="text-muted-foreground mt-2">
            {isForgotPassword 
              ? "Entrez votre courriel pour réinitialiser votre mot de passe" 
              : "Connectez-vous avec vos identifiants"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Adresse courriel
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nivra.ca"
                className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-cyan-400 h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
            )}

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? (isForgotPassword ? "Envoi..." : "Connexion...") 
                : (isForgotPassword ? "Envoyer le lien" : "Se connecter")}
            </Button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(!isForgotPassword);
                  setErrors({});
                }}
                className="text-sm text-muted-foreground hover:text-cyan-400 transition-colors"
              >
                {isForgotPassword 
                  ? "Retour à la connexion" 
                  : "Mot de passe oublié?"}
              </button>
            </div>
          </div>
        </form>

        <p className="text-center text-muted-foreground text-sm mt-6">
          <Link to="/" className="hover:text-cyan-400 transition-colors">
            ← Retour au site
          </Link>
        </p>
      </div>

      {/* OTP Dialog */}
      <AdminOTPDialog
        open={showOTPDialog}
        onOpenChange={setShowOTPDialog}
        adminUserId={pendingUserId || ""}
        adminEmail={pendingUserEmail}
        onSuccess={handleOTPSuccess}
        onCancel={handleOTPCancel}
      />
    </div>
  );
};

export default AdminLogin;
