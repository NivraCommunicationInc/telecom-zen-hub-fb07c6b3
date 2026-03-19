import { PublicLayout } from "@/components/PublicLayout";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, 
  Calendar, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Phone, 
  Mail,
  Trophy,
  DollarSign,
  MapPin,
  Clock,
  Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Contest = () => {
  return (
    <>
      <SEOHead
        title="Concours 500$ | Nivra"
        description="Participez à notre tirage de 500$ cash! Devenez client Nivra et courez la chance de gagner."
      />
      
      <div className="min-h-screen public-light" >
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/5" />
          <div className="container relative">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                <Gift className="w-5 h-5 mr-2 inline" />
                Concours exclusif
              </Badge>
              
              <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight">
                Gagnez <span className="text-primary">500$ cash</span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Devenez client Nivra et participez automatiquement à notre grand tirage!
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button size="lg" asChild>
                  <Link to="/internet">
                    <Trophy className="w-5 h-5 mr-2" />
                    Voir nos forfaits
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/contact">
                    <Phone className="w-5 h-5 mr-2" />
                    Nous contacter
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Prize Details */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <DollarSign className="w-6 h-6 text-primary" />
                    Détails du prix
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <Trophy className="w-10 h-10 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-lg">Valeur du prix</p>
                        <p className="text-3xl font-bold text-primary">500$ CAD</p>
                        <p className="text-sm text-muted-foreground">En argent comptant</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border">
                      <Calendar className="w-10 h-10 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-lg">Date du tirage</p>
                        <p className="text-2xl font-bold">15 février 2026</p>
                        <p className="text-sm text-muted-foreground">Heure de Montréal</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      Comment participer
                    </h3>
                    <ol className="space-y-3">
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</span>
                        <div>
                          <p className="font-medium">Devenez nouveau client Nivra</p>
                          <p className="text-sm text-muted-foreground">Souscrivez à un forfait Internet, TV, Mobile ou Streaming</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</span>
                        <div>
                          <p className="font-medium">Appliquez le code <span className="font-mono font-bold text-primary">BIENVENUE</span></p>
                          <p className="text-sm text-muted-foreground">Lors de votre commande, entrez le code promo pour être inscrit automatiquement</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</span>
                        <div>
                          <p className="font-medium">Complétez votre première commande</p>
                          <p className="text-sm text-muted-foreground">Une fois votre service activé, vous êtes inscrit au tirage</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</span>
                        <div>
                          <p className="font-medium">Attendez le tirage!</p>
                          <p className="text-sm text-muted-foreground">Le gagnant sera contacté par courriel et téléphone</p>
                        </div>
                      </li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              {/* Eligibility & Rules */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Admissibilité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>Résident du Québec, Canada</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>18 ans et plus</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>Nouveau client Nivra</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>1 participation par client</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-primary" />
                      Chances de gagner
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Les chances de gagner dépendent du nombre total de participations 
                      admissibles reçues avant la date du tirage. Le gagnant sera sélectionné 
                      au hasard parmi toutes les participations valides.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      Contact du gagnant
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Le gagnant sera contacté par courriel et/ou téléphone dans les 
                      48 heures suivant le tirage.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Délai de réponse:</strong> 7 jours pour réclamer le prix. 
                      À défaut, un nouveau gagnant sera tiré au sort.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Math Question Notice */}
            <Card className="mt-8 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="py-6">
                <div className="flex items-start gap-4">
                  <Calculator className="w-8 h-8 text-amber-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Question d'habileté mathématique</h3>
                    <p className="text-sm text-muted-foreground">
                      Conformément à la réglementation canadienne, le gagnant potentiel devra 
                      répondre correctement à une question d'habileté mathématique avant de 
                      recevoir le prix. Cette question sera posée lors du contact téléphonique.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Promo Code Section */}
            <Card className="mt-8 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="py-8">
                <div className="max-w-3xl mx-auto text-center space-y-4">
                  <Badge variant="secondary" className="text-base px-4 py-1">
                    <Gift className="w-4 h-4 mr-2 inline" />
                    Bonus exclusif
                  </Badge>
                  <h2 className="text-2xl md:text-3xl font-bold">
                    Utilisez le code <span className="text-primary font-mono">BIENVENUE</span>
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    Obtenez <strong>50% de rabais</strong> sur votre premier mois de forfaits!
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <Badge variant="outline">Forfaits mensuels seulement</Badge>
                    <Badge variant="outline">1er mois uniquement</Badge>
                    <Badge variant="outline">1 fois par client</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">
                    Rabais applicable uniquement sur les forfaits mensuels, 1er mois seulement; 
                    exclut taxes et frais uniques (activation, installation, livraison, équipement).
                  </p>
                  <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      ✨ Aucune inscription requise! En appliquant le code <span className="font-mono font-bold">BIENVENUE</span> lors de votre commande, vous êtes automatiquement inscrit au tirage.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Full Rules Link */}
            <div className="mt-12 text-center">
              <h3 className="text-lg font-semibold mb-4">Règlements complets</h3>
              <Card className="max-w-2xl mx-auto">
                <CardContent className="py-6">
                  <div className="space-y-4 text-sm text-left">
                    <p>
                      <strong>Organisateur:</strong> Nivra Inc., Québec, Canada.
                    </p>
                    <p>
                      <strong>Période du concours:</strong> Du lancement jusqu'au 14 février 2026, 
                      23h59 (heure de Montréal).
                    </p>
                    <p>
                      <strong>Tirage:</strong> Le 15 février 2026. Le tirage sera effectué au hasard 
                      parmi toutes les participations admissibles.
                    </p>
                    <p>
                      <strong>Prix:</strong> Un (1) prix de 500$ CAD en argent comptant.
                    </p>
                    <p>
                      <strong>Admissibilité:</strong> Ouvert aux résidents du Québec, Canada, 
                      âgés de 18 ans et plus. Les employés de Nivra et leurs familles immédiates 
                      ne sont pas admissibles.
                    </p>
                    <p>
                      <strong>Comment participer:</strong> Devenir nouveau client Nivra en 
                      complétant une première commande de service avant la fin de la période 
                      du concours.
                    </p>
                    <p>
                      <strong>Limite:</strong> Une (1) participation par personne/foyer.
                    </p>
                    <p>
                      <strong>Notification:</strong> Le gagnant sera contacté par courriel et 
                      téléphone. Le gagnant doit répondre dans les 7 jours suivant la 
                      notification. À défaut, un nouveau gagnant sera tiré.
                    </p>
                    <p>
                      <strong>Question d'habileté:</strong> Le gagnant potentiel doit répondre 
                      correctement à une question mathématique d'habileté pour recevoir le prix.
                    </p>
                    <p>
                      <strong>Responsabilités:</strong> L'organisateur n'est pas responsable des 
                      problèmes techniques empêchant la participation ou la notification.
                    </p>
                    <p className="text-muted-foreground">
                      Pour toute question, contactez-nous à{" "}
                      <a href="mailto:support@nivra-telecom.ca" className="text-primary hover:underline">
                        Support@nivra-telecom.ca
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Contest;
