import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, KeyRound } from "lucide-react";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Adresse courriel invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  pin: z.string().length(8, "Le PIN doit contenir 8 chiffres").regex(/^\d+$/, "Le PIN doit contenir uniquement des chiffres"),
});

const AdminLogin = () => {
  const navigate = useNavigate();
  const { signIn, isLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // SECURITY: NO auto-login effect - user must always provide credentials
  // Clear any stale session on mount to ensure clean login
  useState(() => {
    sessionStorage.removeItem("admin_last_auth_check");
  });

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
      // Login flow: email + password + 8-digit PIN
      const result = loginSchema.safeParse({ email, password, pin });
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

      // Step 1: Authenticate with email/password via Supabase Auth
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

      // Step 2: Verify admin PIN via edge function
      try {
        const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
          body: {
            action: "verify_admin_pin",
            email,
            pin,
          },
        });

        if (error || data?.error || !data?.valid) {
          // Sign out since PIN verification failed
          await supabase.auth.signOut();
          toast({
            title: "Erreur de connexion",
            description: data?.error || "PIN invalide. Veuillez réessayer.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        // Check if password or PIN change is required
        if (data.require_password_change || data.require_pin_change) {
          // Store requirement flags and redirect to change page
          sessionStorage.setItem("admin_require_password_change", data.require_password_change ? "true" : "false");
          sessionStorage.setItem("admin_require_pin_change", data.require_pin_change ? "true" : "false");
          navigate("/admin/change-credentials");
          return;
        }

        // Update last_auth_check_at
        await supabase.functions.invoke("admin-manage-staff", {
          body: {
            action: "update_auth_check",
            email,
          },
        });

        toast({
          title: "Connexion réussie",
          description: "Bienvenue dans le portail administrateur",
        });

        navigate("/admin");

      } catch (err: any) {
        await supabase.auth.signOut();
        toast({
          title: "Erreur",
          description: "Erreur de vérification du PIN",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    }
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
              : "Connectez-vous avec vos identifiants et PIN"}
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
              <>
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

                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    PIN Administrateur (8 chiffres)
                  </Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={8}
                      value={pin}
                      onChange={(value) => setPin(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="w-10 h-12 text-xl bg-background/50 border-border/50" />
                        <InputOTPSlot index={1} className="w-10 h-12 text-xl bg-background/50 border-border/50" />
                        <InputOTPSlot index={2} className="w-10 h-12 text-xl bg-background/50 border-border/50" />
                        <InputOTPSlot index={3} className="w-10 h-12 text-xl bg-background/50 border-border/50" />
                        <InputOTPSlot index={4} className="w-10 h-12 text-xl bg-background/50 border-border/50" />
                        <InputOTPSlot index={5} className="w-10 h-12 text-xl bg-background/50 border-border/50" />
                        <InputOTPSlot index={6} className="w-10 h-12 text-xl bg-background/50 border-border/50" />
                        <InputOTPSlot index={7} className="w-10 h-12 text-xl bg-background/50 border-border/50" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {errors.pin && <p className="text-sm text-destructive text-center">{errors.pin}</p>}
                </div>
              </>
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
                  setPin("");
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
    </div>
  );
};

export default AdminLogin;