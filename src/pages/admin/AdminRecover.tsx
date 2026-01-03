import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, Shield, KeyRound, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const recoverSchema = z.object({
  email: z.string().email("Adresse courriel invalide"),
  password: z
    .string()
    .min(12, "Minimum 12 caractères")
    .regex(/\d/, "Doit contenir au moins un chiffre")
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/, "Doit contenir au moins un caractère spécial"),
  pin: z.string().length(8, "Le PIN doit contenir exactement 8 chiffres").regex(/^\d+$/, "Le PIN doit contenir uniquement des chiffres"),
});

const AdminRecover = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const token = searchParams.get("token") || "";
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Token validation - must be present
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-xl bg-destructive/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground mb-2">
            Accès non autorisé
          </h1>
          <p className="text-muted-foreground mb-6">
            Lien invalide ou token manquant.
          </p>
          <Link to="/">
            <Button variant="hero">Retour à l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setTokenError(null);

    const result = recoverSchema.safeParse({ email, password, pin });
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
      // Call edge function for admin recovery - token validation happens server-side
      // Uses admin-bootstrap function which doesn't require prior authentication
      const { data, error } = await supabase.functions.invoke("admin-bootstrap", {
        body: {
          action: "recover",
          email,
          password,
          pin,
          bootstrap_token: token,
        },
      });

      if (error) {
        console.error("Recovery error:", error);
        setTokenError(error.message || "Une erreur est survenue");
        setIsSubmitting(false);
        return;
      }

      if (data?.error) {
        if (data.error.includes("token") || data.error.includes("Token")) {
          setTokenError(data.error);
        } else {
          toast({
            title: "Erreur",
            description: data.error,
            variant: "destructive",
          });
        }
        setIsSubmitting(false);
        return;
      }

      toast({
        title: "Succès!",
        description: "Compte admin récupéré. Vous allez être redirigé...",
      });

      setTimeout(() => {
        navigate("/admin/login");
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

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-xl bg-destructive/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground mb-2">
            Token invalide
          </h1>
          <p className="text-muted-foreground mb-6">{tokenError}</p>
          <Link to="/">
            <Button variant="hero">Retour à l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hero p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary-foreground">
            Récupération Admin
          </h1>
          <p className="text-muted-foreground mt-2">
            Réinitialiser les identifiants administrateur
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Courriel admin
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nivra.ca"
                className="bg-background/50 border-border/50 text-foreground h-12"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Nouveau mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="bg-background/50 border-border/50 text-foreground h-12 pr-10"
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
              <p className="text-xs text-muted-foreground">
                Min. 12 caractères, 1 chiffre, 1 caractère spécial
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin" className="text-foreground flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Nouveau PIN (8 chiffres)
              </Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={8}
                  value={pin}
                  onChange={(value) => setPin(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-10 h-12 text-xl" />
                    <InputOTPSlot index={1} className="w-10 h-12 text-xl" />
                    <InputOTPSlot index={2} className="w-10 h-12 text-xl" />
                    <InputOTPSlot index={3} className="w-10 h-12 text-xl" />
                    <InputOTPSlot index={4} className="w-10 h-12 text-xl" />
                    <InputOTPSlot index={5} className="w-10 h-12 text-xl" />
                    <InputOTPSlot index={6} className="w-10 h-12 text-xl" />
                    <InputOTPSlot index={7} className="w-10 h-12 text-xl" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {errors.pin && <p className="text-sm text-destructive text-center">{errors.pin}</p>}
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Récupération..." : "Récupérer le compte"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminRecover;
