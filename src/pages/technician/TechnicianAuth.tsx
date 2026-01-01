import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench, Lock, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const TechnicianAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (accessCode.length !== 4) {
      toast({
        title: "Code invalide",
        description: "Le code d'accès doit contenir 4 chiffres.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Look up technician by email and access code
      const { data: techData, error: techError } = await supabase
        .from("technicians")
        .select("id, full_name, email, status, user_id, access_code")
        .eq("email", email.toLowerCase().trim())
        .eq("access_code", accessCode)
        .eq("status", "active")
        .maybeSingle();

      if (techError) throw techError;

      if (!techData) {
        throw new Error("Courriel ou code d'accès invalide, ou compte inactif.");
      }

      // Store technician session in localStorage (simple session without Supabase Auth)
      const techSession = {
        id: techData.id,
        email: techData.email,
        full_name: techData.full_name,
        user_id: techData.user_id,
        authenticated_at: new Date().toISOString(),
      };
      
      localStorage.setItem("nivra_technician_session", JSON.stringify(techSession));

      toast({ title: "Connexion réussie", description: `Bienvenue, ${techData.full_name}` });
      navigate("/technician");
    } catch (error: any) {
      toast({
        title: "Erreur de connexion",
        description: error.message,
        variant: "destructive",
      });
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
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(value) => setAccessCode(value)}
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
