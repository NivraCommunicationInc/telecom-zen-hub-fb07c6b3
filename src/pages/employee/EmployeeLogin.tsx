import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Mail, ArrowLeft, AlertCircle, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FunctionsHttpError } from "@supabase/supabase-js";

// Error reason to user-friendly message mapping
const getErrorMessage = (reason: string): string => {
  switch (reason) {
    case "not_found":
      return "Aucun compte employé trouvé avec ce courriel.";
    case "invalid_pin":
      return "Code PIN invalide.";
    case "pin_not_set":
      return "Votre PIN n'est pas encore configuré. Contactez l'administrateur.";
    case "status_hold":
      return "Votre compte est temporairement suspendu.";
    case "status_disabled":
      return "Votre compte a été désactivé. Contactez l'administrateur.";
    case "account_locked":
      return "Compte verrouillé suite à trop de tentatives. Réessayez plus tard.";
    default:
      return reason || "Erreur de connexion.";
  }
};

const EmployeeLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (pin.length !== 4) {
      setErrorMessage("Le code PIN doit contenir 4 chiffres.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("Veuillez entrer votre courriel.");
      return;
    }

    setIsLoading(true);

    try {
      // Call edge function for employee PIN-only login
      const { data, error } = await supabase.functions.invoke("employee-auth", {
        body: { 
          action: "pin_login",
          email: normalizedEmail, 
          pin,
        },
      });

      if (error) {
        let message = "Erreur de connexion. Veuillez réessayer.";

        if (error instanceof FunctionsHttpError) {
          try {
            const body = await error.context.json();
            if (typeof body?.reason === "string" && body.reason.trim()) {
              message = getErrorMessage(body.reason);
            } else if (typeof body?.message === "string" && body.message.trim()) {
              message = body.message;
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
        setErrorMessage(getErrorMessage(data.reason || data.error));
        return;
      }

      if (!data?.ok || !data?.user_id) {
        setErrorMessage("Réponse invalide du serveur.");
        return;
      }

      const employeeSession = {
        employeeId: data.employee_id || data.user_id,
        userId: data.user_id,
        email: data.email,
        name: data.full_name || data.email,
        role: "employee",
        permissions: data.permissions || {},
        token: data.token,
        loginAt: new Date().toISOString(),
        lastAuthCheck: new Date().toISOString(),
      };

      localStorage.setItem("nivra_employee_session", JSON.stringify(employeeSession));
      sessionStorage.setItem("employee_last_auth_check", Date.now().toString());

      toast({
        title: "Connexion réussie",
        description: `Bienvenue, ${data.full_name || data.email}`,
      });
      navigate("/employee");
    } catch (error) {
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-display">Portail Employé</CardTitle>
            <CardDescription>Connexion avec courriel et PIN</CardDescription>
          </CardHeader>

          <CardContent>
            {errorMessage && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Courriel
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="employe@nivra.ca"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage(null);
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Code PIN (4 chiffres)
                </Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={4}
                    value={pin}
                    onChange={(value) => {
                      setPin(value);
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
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || pin.length !== 4}
              >
                {isLoading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Accès réservé aux employés Nivra autorisés.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeLogin;
