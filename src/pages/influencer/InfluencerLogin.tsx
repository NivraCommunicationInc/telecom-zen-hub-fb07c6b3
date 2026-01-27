import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";
import { PARTNER_APP_URL } from "@/config/partnerContact";
import WeatherBackground from "@/components/influencer/WeatherBackground";

const InfluencerLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Verify user is an active influencer
      const { data: influencer, error: influencerError } = await supabase
        .from("influencers")
        .select("id, status")
        .eq("user_id", data.user.id)
        .single();

      if (influencerError || !influencer) {
        await supabase.auth.signOut();
        toast.error("Accès refusé. Ce compte n'est pas un partenaire.");
        setIsLoading(false);
        return;
      }

      if (influencer.status === "suspended") {
        await supabase.auth.signOut();
        toast.error("Votre compte partenaire a été suspendu.");
        setIsLoading(false);
        return;
      }

      // Only block "invited" status - "pending" now auto-activates on signup
      if (influencer.status === "invited") {
        await supabase.auth.signOut();
        toast.info("Veuillez compléter votre inscription via le lien d'invitation.");
        setIsLoading(false);
        return;
      }

      toast.success("Connexion réussie");
      navigate("/influencer/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotEmail) {
      toast.error("Veuillez entrer votre adresse email");
      return;
    }

    setIsSendingReset(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${PARTNER_APP_URL}/influencer/reset-password`,
      });

      if (error) throw error;

      toast.success("Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.");
      setShowForgotPassword(false);
      setForgotEmail("");
    } catch (error: any) {
      console.error("Reset password error:", error);
      // Don't reveal if email exists or not
      toast.success("Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.");
      setShowForgotPassword(false);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <WeatherBackground />
      <div className="w-full max-w-md relative z-10">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Portail Partenaires</h1>
          <p className="text-muted-foreground">Nivra Telecom</p>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>{showForgotPassword ? "Mot de passe oublié" : "Connexion"}</CardTitle>
            <CardDescription>
              {showForgotPassword 
                ? "Entrez votre email pour recevoir un lien de réinitialisation"
                : "Accédez à votre tableau de bord partenaire"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="forgotEmail"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nous vous enverrons un lien sécurisé pour réinitialiser votre mot de passe.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={isSendingReset}>
                  {isSendingReset && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Envoyer le lien
                </Button>

                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Retour à la connexion
                </Button>
              </form>
            ) : (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Mot de passe</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        Mot de passe oublié?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Se connecter
                  </Button>
                </form>

                <div className="mt-4 text-center text-sm text-muted-foreground">
                  <p>Pas encore inscrit?</p>
                  <Link to="/influencer/register" className="text-primary hover:underline">
                    Devenir partenaire
                  </Link>
                </div>
              </>
            )}

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

export default InfluencerLogin;
