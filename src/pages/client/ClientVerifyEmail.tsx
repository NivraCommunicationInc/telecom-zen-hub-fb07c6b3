import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";

const ClientVerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyEmail();
  }, []);

  const verifyEmail = async () => {
    try {
      // Check for token in URL hash (Supabase magic link format)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type");
      
      // Or check for token in query params
      const token = searchParams.get("token");
      const tokenHash = searchParams.get("token_hash");

      if (accessToken && type === "signup") {
        // Handle Supabase magic link verification
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get("refresh_token") || ""
        });
        
        if (error) {
          throw error;
        }
        setSuccess(true);
      } else if (tokenHash) {
        // Handle token hash verification (Supabase PKCE flow)
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "email"
        });
        
        if (error) throw error;
        setSuccess(true);
      } else if (token) {
        // Handle custom token verification via edge function
        const { data, error } = await supabase.functions.invoke("verify-email-token", {
          body: { token }
        });

        if (error || !data?.success) {
          throw new Error(data?.error || "Vérification échouée");
        }
        setSuccess(true);
      } else {
        // Check if user is already verified via session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at) {
          setSuccess(true);
        } else {
          setError("Aucun jeton de vérification trouvé dans le lien.");
        }
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Le lien de vérification a expiré ou est invalide.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification de votre email...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-2" />
            <CardTitle className="text-2xl">Email vérifié!</CardTitle>
            <CardDescription>
              Votre adresse email a été confirmée avec succès.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Vous pouvez maintenant accéder à toutes les fonctionnalités de votre espace client.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate("/portal")} className="w-full">
                Accéder à mon espace client
              </Button>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full">
                Retour à l'accueil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-2" />
          <CardTitle className="text-2xl">Vérification échouée</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Le lien de vérification a peut-être expiré. Vous pouvez demander un nouveau lien de vérification depuis votre espace client.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/portal/auth")} className="w-full">
              <Mail className="w-4 h-4 mr-2" />
              Se connecter
            </Button>
            <Button variant="outline" onClick={() => navigate("/contact")} className="w-full">
              Contacter le support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientVerifyEmail;
