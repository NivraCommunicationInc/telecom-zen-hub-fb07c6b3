import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Loader2 } from "lucide-react";

interface PartnerTermsAcceptanceGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that checks if the influencer has accepted partner terms.
 * If not, redirects to the terms page.
 * Allows access to the terms page itself without redirect loop.
 */
const PartnerTermsAcceptanceGuard = ({ children }: PartnerTermsAcceptanceGuardProps) => {
  const { influencer, isLoading } = useInfluencerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPrompt, setShowPrompt] = useState(false);

  // Pages that don't require terms acceptance
  const exemptPaths = ["/influencer/terms", "/influencer/settings"];
  const isExemptPath = exemptPaths.some(path => location.pathname.startsWith(path));

  useEffect(() => {
    if (!isLoading && influencer && !isExemptPath) {
      // Check if terms have been accepted
      if (!influencer.accepted_partner_terms_at) {
        setShowPrompt(true);
      } else {
        setShowPrompt(false);
      }
    }
  }, [influencer, isLoading, isExemptPath]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If on exempt path or terms are accepted, render children
  if (isExemptPath || !showPrompt) {
    return <>{children}</>;
  }

  // Show terms acceptance prompt
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="max-w-lg w-full border-primary/30 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Bienvenue au Programme Partenaires!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            Avant d'accéder à votre tableau de bord, veuillez lire et accepter les conditions
            du programme, la structure de commissions et les politiques de référence.
          </p>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">💰</span>
              <div>
                <p className="font-medium">Structure de commissions</p>
                <p className="text-muted-foreground text-xs">
                  Découvrez combien vous gagnez par référence
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📋</span>
              <div>
                <p className="font-medium">Politique de traitement</p>
                <p className="text-muted-foreground text-xs">
                  Comment vos références sont validées et payées
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📜</span>
              <div>
                <p className="font-medium">Conditions générales</p>
                <p className="text-muted-foreground text-xs">
                  Les règles du programme partenaires
                </p>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => navigate("/influencer/terms")}
            className="w-full"
            size="lg"
          >
            Lire et Accepter les Conditions
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Cette étape est obligatoire pour accéder à votre tableau de bord partenaire.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerTermsAcceptanceGuard;
