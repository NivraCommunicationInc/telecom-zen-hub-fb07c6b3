import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";
import { PARTNER_SUPPORT_EMAIL, getPartnerMailtoLink } from "@/config/partnerContact";
import WeatherBackground from "@/components/influencer/WeatherBackground";

const InfluencerResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if it's a recovery session (user came from password reset email)
      if (session?.user) {
        setIsValidSession(true);
      } else {
        // Listen for auth state changes (for when user arrives via email link)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY" && session) {
            setIsValidSession(true);
          } else if (event === "SIGNED_IN" && session) {
            setIsValidSession(true);
          }
        });

        // After a short delay, if still no session, mark as invalid
        setTimeout(() => {
          setIsValidSession((prev) => prev === null ? false : prev);
        }, 2000);

        return () => subscription.unsubscribe();
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast.success("Mot de passe mis à jour avec succès");
      
      // Sign out and redirect to login
      await supabase.auth.signOut();
      setTimeout(() => navigate("/influencer/login"), 2000);
    } catch (error: any) {
      console.error("Password update error:", error);
      toast.error(error.message || "Erreur lors de la mise à jour du mot de passe");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <WeatherBackground />
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Vérification de votre session...</p>
        </div>
      </div>
    );
  }

  // Invalid/expired session
  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <WeatherBackground />
        <Card className="max-w-md w-full border-destructive/30">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Lien expiré ou invalide</h2>
            <p className="text-muted-foreground mb-6">
              Le lien de réinitialisation a expiré ou est invalide. Veuillez demander un nouveau lien.
            </p>
            <Link to="/influencer/login">
              <Button variant="outline" className="w-full mb-4">
                Retour à la connexion
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              className="w-full"
              asChild
            >
              <a href={getPartnerMailtoLink()}>
                Contacter {PARTNER_SUPPORT_EMAIL}
              </a>
            </Button>
            <PartnerHelpFooter className="mt-6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <WeatherBackground />
        <Card className="max-w-md w-full border-green-500/30">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Mot de passe mis à jour!</h2>
            <p className="text-muted-foreground mb-6">
              Votre mot de passe a été modifié avec succès. Vous allez être redirigé vers la page de connexion.
            </p>
            <Link to="/influencer/login">
              <Button className="w-full">
                Se connecter
              </Button>
            </Link>
            <PartnerHelpFooter className="mt-6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <WeatherBackground />
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Nouveau mot de passe</h1>
          <p className="text-muted-foreground">Portail Partenaires Nivra</p>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Réinitialiser le mot de passe</CardTitle>
            <CardDescription>
              Entrez votre nouveau mot de passe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmez votre mot de passe"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Mettre à jour le mot de passe
              </Button>
            </form>

            <PartnerHelpFooter />
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link to="/influencer/login" className="text-sm text-muted-foreground hover:text-foreground">
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
};

export default InfluencerResetPassword;
