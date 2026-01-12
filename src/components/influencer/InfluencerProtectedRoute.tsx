import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import { Loader2 } from "lucide-react";

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
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-foreground mb-2">Accès refusé</h2>
          <p className="text-muted-foreground mb-4">
            Ce compte n'est pas associé à un profil partenaire.
          </p>
          <a href="/" className="text-primary hover:underline">
            Retour au site
          </a>
        </div>
      </div>
    );
  }

  // Influencer is suspended
  if (influencer.status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-red-500 mb-2">Compte suspendu</h2>
          <p className="text-muted-foreground mb-4">
            Votre compte partenaire a été suspendu. Contactez le support pour plus d'informations.
          </p>
          <a href="mailto:partenaires@nivratelecom.ca" className="text-primary hover:underline">
            partenaires@nivratelecom.ca
          </a>
        </div>
      </div>
    );
  }

  // Influencer is still invited (shouldn't happen but just in case)
  if (influencer.status === "invited") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-foreground mb-2">Inscription incomplète</h2>
          <p className="text-muted-foreground mb-4">
            Veuillez compléter votre inscription en utilisant le lien d'invitation reçu par email.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default InfluencerProtectedRoute;
