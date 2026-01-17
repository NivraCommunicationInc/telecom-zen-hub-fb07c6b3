import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  CheckCircle2,
  ArrowRight,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import { toast } from "sonner";
import InfluencerLayout from "@/components/influencer/InfluencerLayout";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const InfluencerTerms = () => {
  const navigate = useNavigate();
  const { influencer, refetch } = useInfluencerAuth();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCommission, setAcceptedCommission] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch active terms from database
  const { data: activeTerms, isLoading: termsLoading } = useQuery({
    queryKey: ["partner-terms-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_program_terms")
        .select("*")
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const hasAcceptedCurrentVersion = influencer?.accepted_partner_terms_at && 
    influencer?.partner_terms_version === activeTerms?.version;

  const handleAcceptTerms = async () => {
    if (!influencer?.id || !activeTerms) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("influencers")
        .update({
          accepted_partner_terms_at: new Date().toISOString(),
          partner_terms_version: activeTerms.version
        })
        .eq("id", influencer.id);

      if (error) throw error;

      toast.success("Conditions acceptées avec succès!");
      await refetch();
      navigate("/influencer/dashboard");
    } catch (error) {
      console.error("Error accepting terms:", error);
      toast.error("Une erreur s'est produite. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allAccepted = acceptedTerms && acceptedCommission && acceptedPolicy;

  if (termsLoading) {
    return (
      <InfluencerLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </InfluencerLayout>
    );
  }

  return (
    <InfluencerLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-4">
            <FileText className="w-3 h-3 mr-1" />
            Version {activeTerms?.version || "1.0"}
          </Badge>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {activeTerms?.title || "Programme Partenaires Nivra"}
          </h1>
          <p className="text-muted-foreground">
            Conditions, commissions et politiques du programme
          </p>
        </div>

        {/* Terms Content from Database */}
        <Card>
          <CardContent className="pt-6">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {activeTerms?.content || "Chargement des conditions..."}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        {/* Acceptance Section */}
        {!hasAcceptedCurrentVersion ? (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-center">Acceptation des Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    J'ai lu et j'accepte les <strong>conditions générales</strong> du Programme Partenaires Nivra.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={acceptedCommission}
                    onCheckedChange={(checked) => setAcceptedCommission(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    J'accepte la <strong>structure de commissions</strong> et les <strong>modalités de paiement</strong> du programme.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={acceptedPolicy}
                    onCheckedChange={(checked) => setAcceptedPolicy(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    J'accepte la <strong>politique de traitement des références</strong> et m'engage à respecter les règles du programme.
                  </span>
                </label>
              </div>

              <Button
                onClick={handleAcceptTerms}
                disabled={!allAccepted || isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    Accepter et Continuer
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-3 text-green-600">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-medium">
                  Conditions acceptées le {new Date(influencer.accepted_partner_terms_at!).toLocaleDateString("fr-CA")}
                </span>
                <Badge variant="outline" className="ml-2">
                  v{influencer.partner_terms_version}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </InfluencerLayout>
  );
};

export default InfluencerTerms;
