import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Mail, Lock, User, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";
import { PARTNER_SUPPORT_EMAIL } from "@/config/partnerContact";

const InfluencerRegister = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [userExistsError, setUserExistsError] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserExistsError(false);
    
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    if (!acceptTerms) {
      toast.error("Veuillez accepter les conditions d'utilisation");
      return;
    }

    setIsLoading(true);

    try {
      // Call Edge Function for reliable signup
      console.log("[InfluencerRegister] Calling partner-self-signup...");
      
      const { data, error } = await supabase.functions.invoke("partner-self-signup", {
        body: {
          first_name: firstName,
          last_name: lastName,
          email: email,
          password: password,
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
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
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jean"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
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

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm leading-tight">
                  J'accepte les{" "}
                  <a href="/terms" target="_blank" className="text-primary hover:underline">
                    conditions d'utilisation
                  </a>{" "}
                  et la{" "}
                  <a href="/privacy" target="_blank" className="text-primary hover:underline">
                    politique de confidentialité
                  </a>
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !acceptTerms}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                S'inscrire
              </Button>
            </form>

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
