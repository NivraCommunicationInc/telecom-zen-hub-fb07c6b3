import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, KeyRound, Shield, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { hashPin } from "@/lib/pinUtils";

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(12, "Minimum 12 caractères")
    .regex(/\d/, "Doit contenir au moins un chiffre")
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/, "Doit contenir au moins un caractère spécial"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const AdminChangeCredentials = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [requirePinChange, setRequirePinChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user is authenticated and has change requirements
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/admin/login", { replace: true });
        return;
      }

      // Read flags from sessionStorage (set by AdminLogin)
      const pwChange = sessionStorage.getItem("admin_require_password_change") === "true";
      const pinChange = sessionStorage.getItem("admin_require_pin_change") === "true";

      if (!pwChange && !pinChange) {
        // No change required, go to admin
        navigate("/admin", { replace: true });
        return;
      }

      setRequirePasswordChange(pwChange);
      setRequirePinChange(pinChange);
      setIsCheckingSession(false);
    };

    checkSession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate password if required
    if (requirePasswordChange) {
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
    }

    // Validate PIN if required
    if (requirePinChange) {
      if (!/^\d{8}$/.test(newPin)) {
        setErrors({ newPin: "Le PIN doit contenir exactement 8 chiffres" });
        return;
      }
      if (newPin !== confirmPin) {
        setErrors({ confirmPin: "Les PINs ne correspondent pas" });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/login", { replace: true });
        return;
      }

      // Update password if required
      if (requirePasswordChange) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (passwordError) {
          toast({
            title: "Erreur",
            description: passwordError.message,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Update PIN if required
      if (requirePinChange) {
        const pinHash = await hashPin(newPin);
        
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ 
            admin_pin_hash: pinHash,
            require_pin_change: false,
          })
          .eq("user_id", session.user.id)
          .eq("role", "admin");

        if (roleError) {
          toast({
            title: "Erreur",
            description: "Échec de la mise à jour du PIN",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Clear require_password_change flag if we changed password
      if (requirePasswordChange) {
        await supabase
          .from("user_roles")
          .update({ require_password_change: false })
          .eq("user_id", session.user.id)
          .eq("role", "admin");
      }

      // Clear sessionStorage flags
      sessionStorage.removeItem("admin_require_password_change");
      sessionStorage.removeItem("admin_require_pin_change");

      toast({
        title: "Succès!",
        description: "Vos identifiants ont été mis à jour.",
      });

      // Navigate to admin dashboard
      navigate("/admin", { replace: true });

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
          <p className="text-muted-foreground">Vérification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hero p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground">
            Changement requis
          </h1>
          <p className="text-muted-foreground mt-2">
            Vous devez mettre à jour vos identifiants avant de continuer
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
          <div className="space-y-6">
            {requirePasswordChange && (
              <>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-400 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Vous devez créer un nouveau mot de passe
                  </p>
                </div>

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
                      placeholder="••••••••••••"
                      className="bg-background/50 border-border/50 text-foreground h-12 pr-10"
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
                    Min. 12 caractères, 1 chiffre, 1 caractère spécial
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Confirmer le mot de passe
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="bg-background/50 border-border/50 text-foreground h-12"
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>
              </>
            )}

            {requirePinChange && (
              <>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-400 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Vous devez créer un nouveau PIN à 8 chiffres
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Nouveau PIN (8 chiffres)
                  </Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={8}
                      value={newPin}
                      onChange={(value) => setNewPin(value)}
                    >
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                          <InputOTPSlot key={i} index={i} className="w-9 h-12 text-xl bg-background/50 border-border/50" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {errors.newPin && <p className="text-sm text-destructive text-center">{errors.newPin}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Confirmer le PIN
                  </Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={8}
                      value={confirmPin}
                      onChange={(value) => setConfirmPin(value)}
                    >
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                          <InputOTPSlot key={i} index={i} className="w-9 h-12 text-xl bg-background/50 border-border/50" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {errors.confirmPin && <p className="text-sm text-destructive text-center">{errors.confirmPin}</p>}
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
              {isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminChangeCredentials;
