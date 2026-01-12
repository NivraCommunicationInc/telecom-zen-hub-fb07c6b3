import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Mail, Lock, User, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";
import { PARTNER_CONTACT } from "@/config/partnerContact";

const InfluencerRegister = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/influencer/login",
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Échec de la création du compte");
      }

      // Create influencer record with pending status
      const { error: influencerError } = await supabase
        .from("influencers")
        .insert({
          user_id: authData.user.id,
          first_name: firstName,
          last_name: lastName,
          email: email,
          status: "pending" as any,
          payout_method: "etransfer",
          payout_email: email,
        });

      if (influencerError) throw influencerError;

      // Add role to user_roles table
      await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: "influencer",
      });

      // Sign out the user (they need to wait for activation)
      await supabase.auth.signOut();

      setIsSuccess(true);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Erreur lors de l'inscription");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-green-500/30">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Demande reçue!</h2>
              <p className="text-muted-foreground mb-6">
                Votre demande d'inscription au programme partenaires a été reçue. 
                Notre équipe examinera votre demande et activera votre compte sous peu.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Vous recevrez un email de confirmation une fois votre compte activé.
              </p>
              <Link to="/influencer/login">
                <Button variant="outline" className="w-full">
                  Retour à la connexion
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
