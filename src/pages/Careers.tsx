import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  Heart, 
  Zap, 
  Users, 
  TrendingUp,
  Shield,
  GraduationCap,
  Coffee,
  ChevronRight,
  Building2,
  Send
} from "lucide-react";
import { backendClient as supabase } from "@/integrations/backend";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string | null;
}

const Careers = () => {
  const { t } = useLanguage();

  const benefits = [
    { 
      icon: TrendingUp, 
      title: "Rémunération compétitive", 
      description: "Salaires alignés sur le marché télécom canadien avec révisions annuelles" 
    },
    { 
      icon: Heart, 
      title: "Assurance complète", 
      description: "Couverture santé, dentaire et vision pour vous et votre famille" 
    },
    { 
      icon: Clock, 
      title: "Flexibilité", 
      description: "Horaires adaptés et possibilité de télétravail selon le poste" 
    },
    { 
      icon: GraduationCap, 
      title: "Formation continue", 
      description: "Budget annuel de développement professionnel et certifications" 
    },
    { 
      icon: Users, 
      title: "Équipe collaborative", 
      description: "Environnement de travail inclusif et esprit d'équipe" 
    },
    { 
      icon: Coffee, 
      title: "Bien-être", 
      description: "Programme de santé mentale et activités d'équipe" 
    },
  ];

  const values = [
    {
      icon: Shield,
      title: "Intégrité",
      description: "Nous agissons avec honnêteté et transparence dans toutes nos interactions."
    },
    {
      icon: Zap,
      title: "Excellence",
      description: "Nous visons l'excellence dans chaque service que nous offrons."
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "Nous croyons au pouvoir du travail d'équipe et de l'entraide."
    },
  ];

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["public-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, department, location, type, description")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Job[];
    },
  });

  return (
    <div className="min-h-screen public-light" >
      <SEOHead {...SEO_DATA.careers} />
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-navy-900 via-navy-800 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
              <Building2 className="w-3 h-3 mr-1" />
              Carrières chez Nivra
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Bâtissez votre carrière dans les{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
                télécommunications
              </span>
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
              Rejoignez une équipe dynamique au cœur de l'industrie télécom québécoise. 
              Nous recherchons des talents passionnés pour accompagner notre croissance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg" asChild>
                <a href="#positions">
                  Voir les postes ouverts
                  <ChevronRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/apply">Candidature spontanée</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Nos valeurs
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Ce qui nous guide au quotidien dans notre mission d'offrir des services télécom de qualité.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {values.map((value) => (
              <Card key={value.title} className="bg-card border-border text-center">
                <CardContent className="p-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center mx-auto mb-6">
                    <value.icon className="w-8 h-8 text-cyan-400" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground mb-3">
                    {value.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-cyan-500/30 text-cyan-400">
              Avantages
            </Badge>
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Pourquoi travailler chez Nivra?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Nous investissons dans le bien-être et le développement de nos employés.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {benefits.map((benefit) => (
              <div 
                key={benefit.title} 
                className="flex items-start gap-4 p-6 bg-card border border-border rounded-xl hover:border-cyan-500/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-1">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section id="positions" className="py-20 bg-muted/30 scroll-mt-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-cyan-500/30 text-cyan-400">
              <Briefcase className="w-3 h-3 mr-1" />
              Opportunités
            </Badge>
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Postes ouverts
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Découvrez les opportunités actuelles au sein de notre équipe.
            </p>
          </div>
          
          <div className="max-w-3xl mx-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4" />
                <p className="text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : jobs && jobs.length > 0 ? (
              <div className="space-y-4">
                {jobs.map((position) => (
                  <Card 
                    key={position.id} 
                    className="bg-card border-border hover:border-cyan-500/30 transition-all hover:shadow-lg"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-display font-bold text-lg text-foreground">
                              {position.title}
                            </h3>
                            <Badge variant="secondary" className="text-xs">
                              {position.type}
                            </Badge>
                          </div>
                          {position.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {position.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-cyan-400" />
                              {position.department}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-cyan-400" />
                              {position.location}
                            </span>
                          </div>
                        </div>
                        <Button variant="hero" size="sm" asChild className="lg:flex-shrink-0">
                          <Link to={`/apply/${position.id}`}>
                            Postuler
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
                    <Briefcase className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-2">
                    Aucun poste ouvert actuellement
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Nous n'avons pas de poste à pourvoir en ce moment, mais nous sommes toujours 
                    à la recherche de talents exceptionnels.
                  </p>
                  <Button variant="outline" asChild>
                    <Link to="/apply">
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer une candidature spontanée
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-br from-navy-800 to-navy-900 border-navy-700 overflow-hidden">
            <CardContent className="p-8 md:p-12 relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
              <div className="relative z-10 max-w-2xl">
                <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Vous ne trouvez pas le poste idéal?
                </h2>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Envoyez-nous votre CV et lettre de motivation. Nous conservons les candidatures 
                  prometteuses et vous contacterons si une opportunité correspondant à votre profil 
                  se présente.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button variant="hero" size="lg" asChild>
                    <Link to="/apply">
                      <Send className="w-4 h-4 mr-2" />
                      Candidature spontanée
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link to="/contact">Nous contacter</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;
