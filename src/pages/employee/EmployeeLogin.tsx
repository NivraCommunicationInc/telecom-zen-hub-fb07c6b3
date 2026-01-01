import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Mail, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
      const { data, error } = await supabase.functions.invoke("employee-auth", {
        body: { email: normalizedEmail, pin },
      });

      if (error) {
        console.error("Edge function error:", error);
        setErrorMessage("Erreur de connexion. Veuillez réessayer.");
        return;
      }

      if (data?.error) {
        setErrorMessage(data.error);
        return;
      }

      if (!data?.success || !data?.token) {
        setErrorMessage("Réponse invalide du serveur.");
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
      };
      
      localStorage.setItem("nivra_employee_session", JSON.stringify(employeeSession));

      toast({ 
        title: "Connexion réussie", 
        description: `Bienvenue, ${data.employee.full_name}` 
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
            <CardDescription>Connexion Employé – Nivra</CardDescription>
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
                    placeholder="employe@nivra.ca"
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
                <Label htmlFor="pin">Code PIN (4 chiffres)</Label>
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
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Entrez le code à 4 chiffres fourni par l'administrateur
                </p>
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
