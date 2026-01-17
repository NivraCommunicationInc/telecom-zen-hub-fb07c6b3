import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface PartnerTermsAcceptanceGuardProps {
  children: React.ReactNode;
}

const normalizeVersion = (v?: string | null) => (v ?? "").toString().trim().replace(/^v/i, "");
const formatVersion = (v?: string | null) => {
  const n = normalizeVersion(v);
  return n ? `v${n}` : "";
};

/**
 * Guard component that checks if the influencer has accepted partner terms.
 * Also checks if the accepted version matches the current active version.
 * If not, shows a prompt that redirects to the terms page.
 * Allows access to the terms page itself without redirect loop.
 */
const PartnerTermsAcceptanceGuard = ({ children }: PartnerTermsAcceptanceGuardProps) => {
  const { influencer, isLoading } = useInfluencerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isNewVersion, setIsNewVersion] = useState(false);

  // Fetch current active terms version
  const { data: activeTerms, isLoading: termsLoading } = useQuery({
    queryKey: ["partner-terms-version"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_program_terms")
        .select("version, title")
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Pages that don't require terms acceptance
  const exemptPaths = ["/influencer/terms", "/influencer/settings"];
  const isExemptPath = exemptPaths.some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    if (isLoading || termsLoading || isExemptPath) return;

    if (!influencer || !activeTerms) {
      setShowPrompt(false);
      setIsNewVersion(false);
      return;
    }

    // Never accepted -> must accept
    if (!influencer.accepted_partner_terms_at) {
      setShowPrompt(true);
      setIsNewVersion(false);
      return;
    }

    // Accepted, but maybe older version
    const acceptedVersion = normalizeVersion(influencer.partner_terms_version);
    const currentVersion = normalizeVersion(activeTerms.version);

    if (!acceptedVersion || acceptedVersion !== currentVersion) {
      setShowPrompt(true);
      setIsNewVersion(true);
      return;
    }

    setShowPrompt(false);
    setIsNewVersion(false);
  }, [
    influencer,
    isLoading,
    termsLoading,
    activeTerms,
    isExemptPath,
  ]);

  if (isLoading || termsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isExemptPath || !showPrompt) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="max-w-lg w-full border-primary/30 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            {isNewVersion ? (
              <AlertCircle className="w-8 h-8 text-orange-500" />
            ) : (
              <FileText className="w-8 h-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isNewVersion ? "Mise à jour des conditions" : "Bienvenue au Programme Partenaires!"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isNewVersion ? (
            <div className="space-y-3">
              <p className="text-center text-muted-foreground">
                Les conditions du programme partenaires ont été mises à jour (
                {formatVersion(influencer?.partner_terms_version) || "v?"} → {formatVersion(activeTerms?.version)}).
              </p>
              <p className="text-center text-sm text-orange-600 dark:text-orange-400">
                Veuillez lire et accepter les nouvelles conditions pour continuer à accéder à votre tableau de bord.
              </p>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              Avant d'accéder à votre tableau de bord, veuillez lire et accepter les conditions du programme, la structure de commissions et les politiques de référence.
            </p>
          )}

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">💰</span>
              <div>
                <p className="font-medium">Structure de commissions</p>
                <p className="text-muted-foreground text-xs">Découvrez combien vous gagnez par référence</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📋</span>
              <div>
                <p className="font-medium">Politique de traitement</p>
                <p className="text-muted-foreground text-xs">Comment vos références sont validées et payées</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-lg">📜</span>
              <div>
                <p className="font-medium">Conditions générales</p>
                <p className="text-muted-foreground text-xs">Les règles du programme partenaires</p>
              </div>
            </div>
          </div>

          <Button onClick={() => navigate("/influencer/terms")} className="w-full" size="lg">
            {isNewVersion ? "Voir les nouvelles conditions" : "Lire et Accepter les Conditions"}
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
