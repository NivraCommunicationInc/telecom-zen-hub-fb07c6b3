import { PublicLayout } from "@/components/PublicLayout";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
      
      <Header />
      <div style={{ background: '#020209' }} className="min-h-screen pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden" style={{ paddingTop: 80, paddingBottom: 64, textAlign: 'center' }}>
          <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
          <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
          <div className="container relative max-w-4xl mx-auto px-4">
            <div className="n-animate-in inline-flex items-center gap-2 mb-8" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, padding: '7px 18px' }}>
              <Trophy className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
              <span style={{ color: '#A78BFA', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>Concours exclusif</span>
            </div>
            <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5.5vw, 64px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
              Gagnez <span className="n-shimmer-text">500$ cash</span>
            </h1>
            <p className="n-animate-in-delay-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.65, maxWidth: 560, margin: '0 auto 32px' }}>
              Devenez client Nivra et participez automatiquement à notre grand tirage!
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/internet" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', color: '#fff', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 15, textDecoration: 'none', transition: 'opacity 0.2s' }}>
                <Trophy className="w-5 h-5" />
                Voir nos forfaits
              </Link>
              <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 12, padding: '12px 28px', fontWeight: 600, fontSize: 15, textDecoration: 'none', transition: 'all 0.2s' }}>
                <Phone className="w-5 h-5" />
                Nous contacter
              </Link>
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
      <Footer />
    </>
  );
};

export default Contest;
