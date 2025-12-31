import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, MapPin, Clock, DollarSign, Heart, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

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
    { icon: DollarSign, title: "Salaire compétitif", description: "Rémunération au-dessus du marché" },
    { icon: Heart, title: "Assurance complète", description: "Santé, dentaire et vision" },
    { icon: Clock, title: "Horaires flexibles", description: "Télétravail et horaires adaptés" },
    { icon: Zap, title: "Formation continue", description: "Budget annuel de développement" },
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
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
            ) : jobs && jobs.length > 0 ? (
              jobs.map((position) => (
                <Card key={position.id} className="bg-card border-border hover:border-cyan-400/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-display font-bold text-lg text-foreground mb-1">{position.title}</h3>
                        {position.description && (
                          <p className="text-sm text-muted-foreground mb-2">{position.description}</p>
                        )}
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
                      <Button variant="hero" size="sm" asChild>
                        <Link to={`/apply/${position.id}`}>Postuler</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun poste ouvert pour le moment.</p>
                <p className="text-sm text-muted-foreground mt-2">Envoyez-nous une candidature spontanée!</p>
              </div>
            )}
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
          <Button variant="outline" size="lg" asChild>
            <Link to="/apply">Candidature spontanée</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;