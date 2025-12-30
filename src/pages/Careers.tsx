import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, MapPin, Clock, DollarSign, Heart, Zap } from "lucide-react";

const Careers = () => {
  const benefits = [
    { icon: DollarSign, title: "Salaire compétitif", description: "Rémunération au-dessus du marché" },
    { icon: Heart, title: "Assurance complète", description: "Santé, dentaire et vision" },
    { icon: Clock, title: "Horaires flexibles", description: "Télétravail et horaires adaptés" },
    { icon: Zap, title: "Formation continue", description: "Budget annuel de développement" },
  ];

  const positions = [
    {
      title: "Conseiller(ère) télécom",
      department: "Ventes",
      location: "Montréal, QC",
      type: "Temps plein",
      description: "Accompagner nos clients dans le choix de leurs services télécoms et négocier les meilleures offres.",
    },
    {
      title: "Spécialiste support technique",
      department: "Service client",
      location: "Québec, QC",
      type: "Temps plein",
      description: "Fournir un support technique de premier niveau et résoudre les problèmes de nos clients.",
    },
    {
      title: "Gestionnaire de comptes entreprises",
      department: "B2B",
      location: "Télétravail",
      type: "Temps plein",
      description: "Gérer un portefeuille de clients entreprises et développer de nouvelles opportunités.",
    },
    {
      title: "Analyste données télécom",
      department: "Analytique",
      location: "Montréal, QC",
      type: "Temps plein",
      description: "Analyser les tendances du marché et optimiser nos offres grâce aux données.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-navy-900 to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            Rejoignez <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">l'équipe Nivra</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Construisez votre carrière dans une entreprise en croissance qui valorise l'innovation et le bien-être de ses employés.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-12">Pourquoi nous rejoindre?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="bg-card border border-border rounded-xl p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="font-display font-bold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-4">Postes ouverts</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            Nous recherchons des talents passionnés pour rejoindre notre équipe en pleine croissance.
          </p>
          <div className="space-y-4 max-w-3xl mx-auto">
            {positions.map((position) => (
              <Card key={position.title} className="bg-card border-border hover:border-cyan-400/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-display font-bold text-lg text-foreground mb-1">{position.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{position.description}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {position.department}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {position.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {position.type}
                        </span>
                      </div>
                    </div>
                    <Button variant="hero" size="sm">
                      Postuler
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-2xl font-bold text-foreground mb-4">
            Vous ne trouvez pas le poste idéal?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Envoyez-nous votre CV et nous vous contacterons si une opportunité correspondant à votre profil se présente.
          </p>
          <Button variant="outline" size="lg">
            Candidature spontanée
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;
