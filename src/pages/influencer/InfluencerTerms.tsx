import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  DollarSign, 
  Clock, 
  Shield, 
  Users, 
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import { toast } from "sonner";
import InfluencerLayout from "@/components/influencer/InfluencerLayout";

// Current terms version - increment when terms change
export const PARTNER_TERMS_VERSION = "v1.0";

const InfluencerTerms = () => {
  const navigate = useNavigate();
  const { influencer, refetch } = useInfluencerAuth();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCommission, setAcceptedCommission] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasAcceptedTerms = !!influencer?.accepted_partner_terms_at;

  const handleAcceptTerms = async () => {
    if (!influencer?.id) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("influencers")
        .update({
          accepted_partner_terms_at: new Date().toISOString(),
          partner_terms_version: PARTNER_TERMS_VERSION
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

  return (
    <InfluencerLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-4">
            <FileText className="w-3 h-3 mr-1" />
            Version {PARTNER_TERMS_VERSION}
          </Badge>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Programme Partenaires Nivra
          </h1>
          <p className="text-muted-foreground">
            Conditions, commissions et politiques du programme
          </p>
        </div>

        {/* Commission Structure */}
        <Card className="border-green-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-600">
              <DollarSign className="w-5 h-5" />
              Structure des Commissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                  Commission par Activation
                </h4>
                <p className="text-2xl font-bold text-green-600">10$ CAD</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Par nouveau client activé avec votre code promo
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">
                  Bonus Volume Mensuel
                </h4>
                <ul className="text-sm space-y-1">
                  <li>5-9 activations: <span className="font-medium">+2$/activation</span></li>
                  <li>10-19 activations: <span className="font-medium">+5$/activation</span></li>
                  <li>20+ activations: <span className="font-medium">+10$/activation</span></li>
                </ul>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <h4 className="font-medium">Conditions d'éligibilité:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Le client doit être un <strong>nouveau client</strong> Nivra</li>
                <li>Le client doit activer son service dans les <strong>30 jours</strong> suivant l'inscription</li>
                <li>Le client doit maintenir son service actif pendant au moins <strong>30 jours</strong></li>
                <li>Auto-référencement interdit (vous ne pouvez pas utiliser votre propre code)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Payment Terms */}
        <Card className="border-yellow-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <Clock className="w-5 h-5" />
              Modalités de Paiement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Minimum retrait</p>
                <p className="text-xl font-bold">50$ CAD</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Délai traitement</p>
                <p className="text-xl font-bold">5-7 jours</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Méthodes</p>
                <p className="text-xl font-bold">Interac / PayPal</p>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                Période de validation
              </h4>
              <p className="text-sm text-muted-foreground">
                Les commissions passent par une période de validation de <strong>30 jours</strong> après l'activation du client.
                Durant cette période, si le client annule ou désactive son service, la commission sera annulée.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Referral Processing Policy */}
        <Card className="border-purple-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-purple-600">
              <Users className="w-5 h-5" />
              Politique de Traitement des Références
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-1">1. Attribution des références</h4>
                  <p className="text-muted-foreground">
                    Une référence est attribuée lorsqu'un nouveau client utilise votre code promo lors de son inscription.
                    L'attribution est définitive et ne peut être transférée à un autre partenaire.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">2. Validation des références</h4>
                  <p className="text-muted-foreground">
                    Chaque référence passe par un processus de validation pour confirmer que le client est légitime
                    et que les conditions d'éligibilité sont respectées. Ce processus peut prendre jusqu'à 48 heures.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">3. Références invalides</h4>
                  <p className="text-muted-foreground">
                    Sont considérées invalides: les auto-références, les clients existants, les comptes frauduleux,
                    les inscriptions multiples d'une même personne, et les références provenant de méthodes promotionnelles interdites.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">4. Annulation de commission</h4>
                  <p className="text-muted-foreground">
                    Nivra se réserve le droit d'annuler une commission si: le client annule dans les 30 jours,
                    une fraude est détectée, ou les conditions du programme ne sont pas respectées.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">5. Récupération de commissions</h4>
                  <p className="text-muted-foreground">
                    En cas de commissions payées par erreur ou pour des références invalides, Nivra peut déduire
                    ces montants de vos futures commissions ou demander un remboursement.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Terms and Conditions */}
        <Card className="border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <Shield className="w-5 h-5" />
              Conditions Générales du Programme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px] pr-4">
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-1">1. Éligibilité</h4>
                  <p className="text-muted-foreground">
                    Pour participer au programme, vous devez être âgé d'au moins 18 ans et résider au Canada.
                    Nivra se réserve le droit de refuser ou de révoquer l'adhésion à tout moment.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">2. Représentation de la marque</h4>
                  <p className="text-muted-foreground">
                    En tant que partenaire, vous acceptez de représenter Nivra de manière professionnelle et honnête.
                    Vous ne devez pas faire de déclarations fausses ou trompeuses sur les services Nivra.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">3. Méthodes promotionnelles</h4>
                  <p className="text-muted-foreground">
                    Sont interdits: le spam, les publicités mensongères, l'utilisation de marques déposées sans autorisation,
                    le référencement payant sur les mots-clés de la marque, et toute méthode contraire à l'éthique.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">4. Confidentialité</h4>
                  <p className="text-muted-foreground">
                    Vous vous engagez à ne pas divulguer les informations confidentielles du programme,
                    y compris les taux de commission spécifiques et les stratégies marketing internes.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">5. Modifications du programme</h4>
                  <p className="text-muted-foreground">
                    Nivra peut modifier les termes du programme à tout moment avec un préavis de 30 jours.
                    La continuation de votre participation après ce délai constitue une acceptation des nouveaux termes.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">6. Résiliation</h4>
                  <p className="text-muted-foreground">
                    Vous pouvez quitter le programme à tout moment. Les commissions validées avant la résiliation
                    seront payées selon le calendrier habituel. Nivra peut résilier votre compte pour violation des termes.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">7. Responsabilité fiscale</h4>
                  <p className="text-muted-foreground">
                    Vous êtes responsable de déclarer vos revenus de commission aux autorités fiscales.
                    Nivra émettra un relevé T4A si vos gains dépassent 500$ CAD par année civile.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">8. Loi applicable</h4>
                  <p className="text-muted-foreground">
                    Ce programme est régi par les lois du Québec et du Canada. Tout litige sera résolu
                    par les tribunaux compétents du Québec.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Acceptance Section */}
        {!hasAcceptedTerms ? (
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
                  {influencer.partner_terms_version}
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
