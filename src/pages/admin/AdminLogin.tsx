import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { z } from "zod";
import { adminClient as supabase } from "@/integrations/backend";
import OTPVerificationDialog from "@/components/admin/OTPVerificationDialog";

const loginSchema = z.object({
  email: z.string().email("Adresse courriel invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const AdminLogin = () => {
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
  const navigate = useNavigate();
  const { signIn, isLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 2FA state
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingUserEmail, setPendingUserEmail] = useState<string>("");

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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
      // Login flow: email + password only
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

      // Authenticate with email/password via Supabase Auth
      const { error: signInError } = await signIn(email, password);

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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("Session invalide");
        }

        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role, otp_required, otp_verified_at")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleError || !roleData) {
          await supabase.auth.signOut();
          toast({
            title: "Accès refusé",
            description: "Vous n'avez pas les permissions administrateur.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        // Check if 2FA is required
        // 2FA is required if otp_required is true OR if it's null (default to required for security)
        const requires2FA = roleData.otp_required !== false;
        
        if (requires2FA) {
          // Check if already verified within the last 24 hours
          const verifiedAt = roleData.otp_verified_at ? new Date(roleData.otp_verified_at) : null;
          const now = new Date();
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          if (!verifiedAt || verifiedAt < twentyFourHoursAgo) {
            // Need to verify OTP
            setPendingUserId(user.id);
            setPendingUserEmail(user.email || email);
            setShowOTPDialog(true);
            setIsSubmitting(false);
            return;
          }
        }

        // No 2FA needed or already verified
        completeLogin();

      } catch (err: any) {
        await supabase.auth.signOut();
        toast({
          title: "Erreur",
          description: err.message || "Erreur de vérification des permissions",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const completeLogin = () => {
    toast({
      title: "Connexion réussie",
      description: "Bienvenue dans le portail administrateur",
    });
    navigate("/admin");
  };

  const handleOTPSuccess = () => {
    setShowOTPDialog(false);
    setPendingUserId(null);
    completeLogin();
  };

  const handleOTPCancel = () => {
    setShowOTPDialog(false);
    setPendingUserId(null);
    setIsSubmitting(false);
  };

  if (isLoading) {
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

      {/* 2FA OTP Dialog */}
      <OTPVerificationDialog
        open={showOTPDialog}
        onOpenChange={setShowOTPDialog}
        userId={pendingUserId || ""}
        userEmail={pendingUserEmail}
        onSuccess={handleOTPSuccess}
        onCancel={handleOTPCancel}
      />
    </div>
  );
};

export default AdminLogin;
