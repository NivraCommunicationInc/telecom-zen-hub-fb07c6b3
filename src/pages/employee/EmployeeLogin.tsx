import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Mail, ArrowLeft, AlertCircle, Lock, KeyRound, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FunctionsHttpError } from "@supabase/supabase-js";

const EmployeeLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

    if (!password || password.length < 6) {
      setErrorMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setIsLoading(true);

    try {
      // Call edge function for employee login with password + PIN
      const { data, error } = await supabase.functions.invoke("employee-auth", {
        body: { 
          email: normalizedEmail, 
          password,
          pin,
          action: "login_with_password"
        },
      });

      if (error) {
        let message = "Erreur de connexion. Veuillez réessayer.";

        if (error instanceof FunctionsHttpError) {
          try {
            const body = await error.context.json();
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

      // Check if password change is required
      if (data.require_password_change) {
        // Store token and redirect to change password page
        sessionStorage.setItem("employee_temp_token", data.token);
        sessionStorage.setItem("employee_email", normalizedEmail);
        navigate("/employee/change-password");
        return;
      }

      const employeeSession = {
        employeeId: data.employee.id,
        email: data.employee.email,
        name: data.employee.full_name,
        phone: data.employee.phone,
        role: "employee",
        permissions: data.employee.permissions,
        token: data.token,
        loginAt: new Date().toISOString(),
        lastAuthCheck: new Date().toISOString(),
      };

      localStorage.setItem("nivra_employee_session", JSON.stringify(employeeSession));
      sessionStorage.setItem("employee_last_auth_check", Date.now().toString());

      toast({
        title: "Connexion réussie",
        description: `Bienvenue, ${data.employee.full_name}`,
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
            <CardDescription>Connexion avec mot de passe et PIN</CardDescription>
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
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(null);
                    }}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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
                disabled={isLoading || pin.length !== 4 || !password}
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