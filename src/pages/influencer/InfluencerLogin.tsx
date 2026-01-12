import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

const InfluencerLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

      if (influencer.status === "invited") {
        toast.info("Veuillez compléter votre inscription via le lien d'invitation.");
        await supabase.auth.signOut();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Accédez à votre tableau de bord partenaire
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <Label htmlFor="password">Mot de passe</Label>
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

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Besoin d'aide?</p>
              <a 
                href="mailto:partenaires@nivratelecom.ca" 
                className="text-primary hover:underline"
              >
                partenaires@nivratelecom.ca
              </a>
            </div>
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
