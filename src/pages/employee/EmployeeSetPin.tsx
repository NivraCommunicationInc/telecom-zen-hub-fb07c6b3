import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Lock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

const EmployeeSetPin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [tokenEmail, setTokenEmail] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setValidationError("Lien invalide - token manquant");
        setIsValidating(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("employee-auth", {
          body: { action: "validate_pin_token", token }
        });

        if (error || !data?.ok) {
          setValidationError(data?.message || "Lien invalide ou expiré");
          setIsValidating(false);
          return;
        }

        setTokenEmail(data.email);
        setIsValidating(false);
      } catch (err) {
        console.error("Token validation error:", err);
        setValidationError("Erreur de validation du lien");
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{4}$/.test(pin)) {
      toast({
        title: "PIN invalide",
        description: "Le PIN doit contenir exactement 4 chiffres",
        variant: "destructive",
      });
      return;
    }

    if (pin !== confirmPin) {
      toast({
        title: "Erreur",
        description: "Les PINs ne correspondent pas",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("employee-auth", {
        body: { action: "set_pin_with_token", token, pin }
      });

      if (error || !data?.ok) {
        toast({
          title: "Erreur",
          description: data?.message || "Impossible de définir le PIN",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      toast({
        title: "PIN créé!",
        description: "Votre PIN a été configuré avec succès",
      });

      setTimeout(() => {
        navigate("/employee/login");
      }, 2000);
    } catch (err) {
      console.error("Set PIN error:", err);
      toast({
        title: "Erreur",
        description: "Une erreur s'est produite",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero p-4">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-cyan-400" />
          <p className="text-muted-foreground">Validation du lien...</p>
        </div>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 space-y-6">
            <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
            <div className="space-y-2">
              <h1 className="font-display text-xl font-bold text-foreground">Lien invalide</h1>
              <p className="text-muted-foreground">{validationError}</p>
            </div>
            <Link to="/employee/login">
              <Button variant="outline" className="w-full">
                Retour à la connexion
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 space-y-6">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <div className="space-y-2">
              <h1 className="font-display text-xl font-bold text-foreground">PIN configuré!</h1>
              <p className="text-muted-foreground">Redirection vers la connexion...</p>
            </div>
          </div>
        </div>
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
            Configurer votre PIN
          </h1>
          <p className="text-muted-foreground mt-2">
            Créez un PIN de 4 chiffres pour accéder au portail employé
          </p>
          {tokenEmail && (
            <p className="text-sm text-cyan-400 mt-1">{tokenEmail}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4" />
                PIN (4 chiffres)
              </Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="bg-background/50 border-border/50 text-foreground text-center text-2xl tracking-widest h-14"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPin" className="text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Confirmer le PIN
              </Label>
              <Input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="bg-background/50 border-border/50 text-foreground text-center text-2xl tracking-widest h-14"
              />
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isSubmitting || pin.length !== 4 || confirmPin.length !== 4}
            >
              {isSubmitting ? "Configuration..." : "Configurer mon PIN"}
            </Button>
          </div>
        </form>

        <p className="text-center text-muted-foreground text-sm mt-6">
          <Link to="/employee/login" className="hover:text-cyan-400 transition-colors">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
};

export default EmployeeSetPin;