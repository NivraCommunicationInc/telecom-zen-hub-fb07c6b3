import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench, Mail, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FunctionsHttpError } from "@supabase/supabase-js";

const TechnicianAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizeEmail = (email: string): string => {
    return email.trim().toLowerCase();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    if (accessCode.length !== 4) {
      setErrorMessage("Le code d'accès doit contenir 4 chiffres.");
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setErrorMessage("Veuillez entrer votre courriel.");
      return;
    }

    setIsLoading(true);

    try {
      // Call the secure edge function for authentication
      const { data, error } = await supabase.functions.invoke("technician-auth", {
        body: { email: normalizedEmail, accessCode },
      });

      if (error) {
        console.error("Edge function error:", error);
        let message = "Erreur de connexion. Veuillez réessayer.";

        if (error instanceof FunctionsHttpError) {
          try {
            const body = await error.context.json();
            // New diagnostic format: { ok: false, step, reason }
            if (typeof body?.reason === "string" && body.reason.trim()) {
              message = body.reason;
            } else if (typeof body?.error === "string" && body.error.trim()) {
              message = body.error;
            }
          } catch {
            // ignore parse errors
          }
        }

        setErrorMessage(message);
        return;
      }

      // Handle error response in data (2xx with ok:false)
      if (data?.ok === false) {
        setErrorMessage(data.reason || data.error || "Erreur de connexion.");
        return;
      }

      if (!data?.success || !data?.token) {
        setErrorMessage("Réponse invalide du serveur.");
        return;
      }

      // Store signed session token and technician info
      const techSession = {
        id: data.technician.id,
        email: data.technician.email,
        full_name: data.technician.full_name,
        phone: data.technician.phone,
        specializations: data.technician.specializations,
        token: data.token,
        authenticated_at: new Date().toISOString(),
      };
      
      localStorage.setItem("nivra_technician_session", JSON.stringify(techSession));

      toast({ 
        title: "Connexion réussie", 
        description: `Bienvenue, ${data.technician.full_name}` 
      });
      navigate("/technician");
    } catch (error: any) {
      console.error("Login error:", error);
      setErrorMessage("Erreur inattendue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </Link>

        <Card className="border-border bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
              <Wrench className="w-8 h-8 text-navy-900" />
            </div>
            <CardTitle className="text-2xl font-display">Portail Technicien</CardTitle>
            <CardDescription>Connexion Technicien – Nivra</CardDescription>
          </CardHeader>

          <CardContent>
            {errorMessage && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Courriel</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="technicien@nivra.ca"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(null);
                    }}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-code">Code d'accès (4 chiffres)</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={4}
                    value={accessCode}
                    onChange={(value) => {
                      setAccessCode(value);
                      setErrorMessage(null);
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="w-14 h-14 text-2xl" />
                      <InputOTPSlot index={1} className="w-14 h-14 text-2xl" />
                      <InputOTPSlot index={2} className="w-14 h-14 text-2xl" />
                      <InputOTPSlot index={3} className="w-14 h-14 text-2xl" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Entrez le code à 4 chiffres fourni par l'administrateur
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="hero"
                disabled={isLoading || accessCode.length !== 4}
              >
                {isLoading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Accès réservé aux techniciens Nivra autorisés.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TechnicianAuth;
