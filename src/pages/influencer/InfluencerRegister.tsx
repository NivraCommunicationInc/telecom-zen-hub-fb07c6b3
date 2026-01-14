import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";
import { PartnerSignupForm, PartnerSignupFormData } from "@/components/influencer/PartnerSignupForm";
import WeatherBackground from "@/components/influencer/WeatherBackground";

const InfluencerRegister = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [userExistsError, setUserExistsError] = useState(false);

  const handleRegister = async (formData: PartnerSignupFormData) => {
    setUserExistsError(false);
    setIsLoading(true);

    try {
      // Call Edge Function for reliable signup
      console.log("[InfluencerRegister] Calling partner-self-signup...");
      
      const { data, error } = await supabase.functions.invoke("partner-self-signup", {
        body: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        },
      });

      console.log("[InfluencerRegister] Response:", { data, error });

      // Edge function now always returns 200, check data.ok
      if (error) {
        // Network or CORS error
        console.error("[InfluencerRegister] Network/invoke error:", error);
        toast.error("Erreur de connexion. Veuillez réessayer.");
        return;
      }

      // Check for USER_EXISTS
      if (data?.code === "USER_EXISTS") {
        setUserExistsError(true);
        return;
      }

      // Check for DB_WRITE_FAILED - row not created
      if (data?.code === "DB_WRITE_FAILED") {
        console.error("[InfluencerRegister] DB write failed:", data);
        toast.error("Erreur technique. Veuillez réessayer.");
        return;
      }

      // Check for other errors
      if (data?.ok === false) {
        const errorMsg = data?.message || "Erreur lors de l'inscription";
        console.error("[InfluencerRegister] API error:", data);
        toast.error(errorMsg);
        return;
      }

      // Success - only show "Demande reçue" if ok:true
      if (data?.ok === true) {
        console.log("[InfluencerRegister] Signup successful:", data);
        setIsSuccess(true);
      } else {
        // Unexpected response format
        console.error("[InfluencerRegister] Unexpected response:", data);
        toast.error("Réponse inattendue du serveur");
      }
    } catch (error: any) {
      console.error("[InfluencerRegister] Unexpected error:", error);
      toast.error(error.message || "Erreur inattendue lors de l'inscription");
    } finally {
      setIsLoading(false);
    }
  };

  // User already exists - show recovery options
  if (userExistsError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <WeatherBackground />
        <div className="w-full max-w-md">
          <Card className="border-yellow-500/30">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Compte existant</h2>
              <p className="text-muted-foreground mb-6">
                Un compte existe déjà avec cet email. 
                Utilisez «&nbsp;Mot de passe oublié&nbsp;» pour récupérer l'accès à votre compte.
              </p>
              <div className="space-y-3">
                <Link to="/influencer/login">
                  <Button className="w-full">
                    Se connecter
                  </Button>
                </Link>
                <Link to="/influencer/reset-password">
                  <Button variant="outline" className="w-full">
                    Mot de passe oublié
                  </Button>
                </Link>
              </div>
              
              <PartnerHelpFooter className="mt-6" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <WeatherBackground />
        <div className="w-full max-w-md">
          <Card className="border-green-500/30">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Compte créé!</h2>
              <p className="text-muted-foreground mb-6">
                Votre compte partenaire a été créé avec succès. 
                Vous pouvez maintenant vous connecter et accéder à votre tableau de bord.
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
          <h1 className="text-2xl font-bold text-foreground">Devenir Partenaire</h1>
          <p className="text-muted-foreground">Nivra Telecom</p>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Inscription</CardTitle>
            <CardDescription>
              Rejoignez notre programme partenaires et gagnez des commissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PartnerSignupForm onSubmit={handleRegister} isLoading={isLoading} />

            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p>Déjà inscrit?</p>
              <Link to="/influencer/login" className="text-primary hover:underline">
                Se connecter
              </Link>
            </div>

            <PartnerHelpFooter />
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
};

export default InfluencerRegister;
