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

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

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
      // Step 1: Find technician by normalized email
      const { data: techData, error: techError } = await supabase
        .from("technicians")
        .select("id, full_name, email, status, user_id, access_code, failed_login_attempts, lockout_until")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (techError) {
        console.error("Database error:", techError);
        setErrorMessage("Erreur de connexion. Veuillez réessayer.");
        return;
      }

      // Step 2: Check if technician exists
      if (!techData) {
        setErrorMessage("Aucun profil technicien trouvé pour ce courriel. Contactez l'administrateur.");
        return;
      }

      // Step 3: Check if account is locked out
      if (techData.lockout_until) {
        const lockoutEnd = new Date(techData.lockout_until);
        if (lockoutEnd > new Date()) {
          const minutesRemaining = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
          setErrorMessage(`Compte temporairement verrouillé. Réessayez dans ${minutesRemaining} minute(s).`);
          return;
        }
      }

      // Step 4: Check if account is active
      if (techData.status !== "active") {
        setErrorMessage("Accès bloqué: compte désactivé. Contactez l'administrateur.");
        return;
      }

      // Step 5: Verify access code
      if (techData.access_code !== accessCode) {
        // Increment failed attempts
        const newAttempts = (techData.failed_login_attempts || 0) + 1;
        const updates: { failed_login_attempts: number; lockout_until?: string } = {
          failed_login_attempts: newAttempts,
        };

        // Lock account if max attempts exceeded
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          const lockoutTime = new Date();
          lockoutTime.setMinutes(lockoutTime.getMinutes() + LOCKOUT_DURATION_MINUTES);
          updates.lockout_until = lockoutTime.toISOString();
          
          await supabase
            .from("technicians")
            .update(updates)
            .eq("id", techData.id);

          setErrorMessage(`Trop de tentatives échouées. Compte verrouillé pour ${LOCKOUT_DURATION_MINUTES} minutes.`);
          return;
        }

        await supabase
          .from("technicians")
          .update(updates)
          .eq("id", techData.id);

        const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
        setErrorMessage(`Code d'accès invalide. ${remainingAttempts} tentative(s) restante(s).`);
        return;
      }

      // Step 6: Success - Reset failed attempts and create session
      await supabase
        .from("technicians")
        .update({ 
          failed_login_attempts: 0, 
          lockout_until: null 
        })
        .eq("id", techData.id);

      // Store technician session in localStorage
      const techSession = {
        id: techData.id,
        email: techData.email,
        full_name: techData.full_name,
        user_id: techData.user_id,
        authenticated_at: new Date().toISOString(),
      };
      
      localStorage.setItem("nivra_technician_session", JSON.stringify(techSession));

      toast({ 
        title: "Connexion réussie", 
        description: `Bienvenue, ${techData.full_name}` 
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
