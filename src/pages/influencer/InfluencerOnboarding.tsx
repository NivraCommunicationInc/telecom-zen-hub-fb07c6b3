import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";
import { PARTNER_SUPPORT_EMAIL, getPartnerMailtoLink } from "@/config/partnerContact";

interface InviteData {
  influencer_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  invite_id: string;
  expires_at: string;
}

const InfluencerOnboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("etransfer");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      console.log("[Onboarding] Token received:", token?.substring(0, 8) + "...");
      
      if (!token) {
        console.log("[Onboarding] No token provided");
        setIsValidating(false);
        return;
      }

      try {
        // Call server-side validation endpoint
        const { data, error } = await supabase.functions.invoke("validate-partner-invite", {
          body: { token },
        });

        console.log("[Onboarding] Validation response:", { valid: data?.valid, reason: data?.reason });

        if (error) {
          console.error("[Onboarding] Server error:", error);
          setErrorReason("server_error");
          setIsValid(false);
          setIsValidating(false);
          return;
        }

        if (!data?.valid) {
          console.log("[Onboarding] Invalid token, reason:", data?.reason);
          setErrorReason(data?.reason || "unknown");
          setIsValid(false);
          setIsValidating(false);
          return;
        }

        // Token is valid
        console.log("[Onboarding] Token valid for:", data.data?.email);
        setInviteData(data.data);
        setPayoutEmail(data.data?.email || "");
        setIsValid(true);
      } catch (error) {
        console.error("[Onboarding] Unexpected error:", error);
        setErrorReason("unexpected_error");
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

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

    if (!acceptTerms) {
      toast.error("Veuillez accepter les conditions");
      return;
    }

    if (!inviteData) {
      toast.error("Données d'invitation invalides");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteData.email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/influencer/dashboard",
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Failed to create user");
      }

      // CRITICAL: Update influencer with user_id and activate FIRST
      const { error: updateError } = await supabase
        .from("influencers")
        .update({
          user_id: authData.user.id,
          status: "active", // Auto-activate on signup completion
          payout_method: payoutMethod,
          payout_email: payoutEmail,
        })
        .eq("id", inviteData.influencer_id);

      if (updateError) {
        console.error("[Onboarding] Failed to update influencer:", updateError);
        throw new Error("Impossible de lier le compte. Contactez le support.");
      }

      // Mark invite as used
      await supabase
        .from("influencer_invites")
        .update({ used_at: new Date().toISOString() })
        .eq("id", inviteData.invite_id);

      // CRITICAL: Add role to user_roles table with is_active = true
      // Use upsert to handle race conditions
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({
          user_id: authData.user.id,
          role: "influencer",
          is_active: true,
        }, {
          onConflict: "user_id,role",
        });

      if (roleError) {
        console.error("[Onboarding] Failed to create role (non-fatal):", roleError);
        // Non-fatal - the partner-self-signup function should have created it
      }

      // Verify the setup was successful
      const { data: verifyInfluencer } = await supabase
        .from("influencers")
        .select("id, user_id, status")
        .eq("id", inviteData.influencer_id)
        .single();

      console.log("[Onboarding] Verification:", verifyInfluencer);

      if (!verifyInfluencer?.user_id) {
        throw new Error("La liaison du compte a échoué. Contactez le support.");
      }

      toast.success("Compte créé avec succès! Vous pouvez maintenant vous connecter.");
      navigate("/influencer/login");
    } catch (error: any) {
      console.error("[Onboarding] Submit error:", error);
      toast.error(error.message || "Erreur lors de la création du compte");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getErrorMessage = (reason: string | null): string => {
    switch (reason) {
      case "missing_token":
        return "Aucun token fourni dans le lien.";
      case "not_found":
        return "Ce lien d'invitation n'existe pas.";
      case "already_used":
        return "Ce lien d'invitation a déjà été utilisé.";
      case "expired":
        return "Ce lien d'invitation a expiré.";
      case "influencer_not_found":
        return "Le compte partenaire associé n'existe plus.";
      case "already_activated":
        return "Votre compte est déjà activé. Connectez-vous directement.";
      default:
        return "Ce lien d'invitation est invalide ou a expiré.";
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Validation de votre invitation...</p>
        </div>
      </div>
    );
  }

  if (!token || !isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive/30">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Lien invalide</h2>
            <p className="text-muted-foreground mb-6">
              {getErrorMessage(errorReason)}
            </p>
            
            {errorReason === "already_activated" ? (
              <Link to="/influencer/login">
                <Button className="w-full mb-4">Se connecter</Button>
              </Link>
            ) : (
              <Button 
                variant="outline" 
                className="w-full mb-4"
                asChild
              >
                <a href={getPartnerMailtoLink()}>
                  Contacter {PARTNER_SUPPORT_EMAIL}
                </a>
              </Button>
            )}
            
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Retour au site
            </Link>
            
            <PartnerHelpFooter className="mt-6" />
          </CardContent>
        </Card>
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
          <h1 className="text-2xl font-bold text-foreground">Bienvenue!</h1>
          <p className="text-muted-foreground">Complétez votre inscription partenaire</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Invitation validée
            </CardTitle>
            <CardDescription>
              Créez votre compte pour accéder au portail partenaires
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Read-only info */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nom:</span>
                  <span className="font-medium">{inviteData?.first_name} {inviteData?.last_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{inviteData?.email}</span>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmez votre mot de passe"
                  required
                />
              </div>

              {/* Payout settings */}
              <div className="space-y-2">
                <Label>Méthode de paiement préférée</Label>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="etransfer">Interac e-Transfer</SelectItem>
                    <SelectItem value="bank">Virement bancaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payoutEmail">
                  {payoutMethod === "etransfer" ? "Email pour e-Transfer" : "Email de contact"}
                </Label>
                <Input
                  id="payoutEmail"
                  type="email"
                  value={payoutEmail}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                  required
                />
              </div>

              {/* Terms */}
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

              <Button type="submit" className="w-full" disabled={isSubmitting || !acceptTerms}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Créer mon compte
              </Button>
            </form>
            
            <PartnerHelpFooter />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InfluencerOnboarding;
