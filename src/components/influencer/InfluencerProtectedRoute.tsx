import { ReactNode } from "react";
import { Navigate, Link } from "react-router-dom";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import { Loader2, Clock, XCircle, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PartnerHelpFooter from "./PartnerHelpFooter";
import { PARTNER_CONTACT, getPartnerMailtoLink } from "@/config/partnerContact";

interface InfluencerProtectedRouteProps {
  children: ReactNode;
}

const InfluencerProtectedRoute = ({ children }: InfluencerProtectedRouteProps) => {
  const { user, influencer, isLoading } = useInfluencerAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated at all
  if (!user) {
    return <Navigate to="/influencer/login" replace />;
  }

  // User exists but not an influencer
  if (!influencer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Accès refusé</h2>
            <p className="text-muted-foreground mb-4">
              Ce compte n'est pas associé à un profil partenaire.
            </p>
            <Link to="/" className="text-primary hover:underline">
              Retour au site
            </Link>
            <PartnerHelpFooter className="mt-6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Influencer is suspended
  if (influencer.status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive/30">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-destructive mb-2">Compte suspendu</h2>
            <p className="text-muted-foreground mb-6">
              Votre compte partenaire a été suspendu. Contactez le support pour plus d'informations.
            </p>
            <Button variant="outline" asChild className="w-full">
              <a href={getPartnerMailtoLink("support")}>
                Contacter le support
              </a>
            </Button>
            <PartnerHelpFooter showPartnersEmail={false} className="mt-6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Influencer is pending (self-signup waiting for activation)
  if (influencer.status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-yellow-500/30">
          <CardContent className="pt-6 text-center">
            <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Demande en cours</h2>
            <p className="text-muted-foreground mb-4">
              Votre demande d'inscription au programme partenaires est en cours d'examen.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Notre équipe activera votre compte sous peu. Vous recevrez un email de confirmation.
            </p>
            <Link to="/">
              <Button variant="outline" className="w-full">
                Retour au site
              </Button>
            </Link>
            <PartnerHelpFooter className="mt-6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Influencer is still invited (should complete onboarding)
  if (influencer.status === "invited") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-primary/30">
          <CardContent className="pt-6 text-center">
            <Users className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Inscription incomplète</h2>
            <p className="text-muted-foreground mb-6">
              Veuillez compléter votre inscription en utilisant le lien d'invitation reçu par email.
            </p>
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas reçu d'email? Contactez-nous.
            </p>
            <PartnerHelpFooter className="mt-6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default InfluencerProtectedRoute;
