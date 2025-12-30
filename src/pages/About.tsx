import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Users, Target, Shield, Award } from "lucide-react";

const About = () => {
  const values = [
    {
      icon: Users,
      title: "Client d'abord",
      description: "Vous nous payez directement. Nous travaillons exclusivement pour vous, jamais pour les fournisseurs.",
    },
    {
      icon: Target,
      title: "Transparence",
      description: "Tarification claire et directe. Aucune commission cachée des compagnies de télécom.",
    },
    {
      icon: Shield,
      title: "Indépendance totale",
      description: "Aucun partenariat ni accord avec les fournisseurs. Conseils 100% objectifs et impartiaux.",
    },
    {
      icon: Award,
      title: "Expertise",
      description: "Plus de 10 ans d'expérience dans l'industrie des télécommunications au Québec.",
    },
  ];

  const team = [
    { name: "Marie-Claire Dubois", role: "Fondatrice & PDG", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop" },
    { name: "Jean-François Tremblay", role: "Directeur des opérations", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop" },
    { name: "Sophie Gagnon", role: "Responsable service client", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop" },
    { name: "Marc-Antoine Roy", role: "Expert télécom entreprise", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-navy-900 to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            À propos de <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">Nivra</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Votre courtier télécom indépendant au Québec depuis 2015. Nous simplifions vos télécommunications.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl font-bold text-foreground mb-6">Notre mission</h2>
              <p className="text-muted-foreground mb-4">
                Chez Nivra, nous croyons que chaque Québécois mérite d'avoir accès à des conseils objectifs et transparents 
                en matière de télécommunications, sans être influencé par les intérêts des fournisseurs.
              </p>
              <p className="text-muted-foreground mb-6">
                En tant que courtier 100% indépendant, nous ne recevons aucune commission ni rémunération des compagnies de télécom. 
                Nous sommes payés directement par nos clients, ce qui garantit notre impartialité totale dans nos recommandations.
              </p>
              <Link to="/#contact">
                <Button variant="hero" size="lg">Nous contacter</Button>
              </Link>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 flex items-center justify-center">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                  <span className="font-display font-bold text-navy-900 text-6xl">N</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-12">Nos valeurs</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => (
              <div key={value.title} className="bg-card border border-border rounded-xl p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="font-display font-bold text-foreground mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-12">Notre équipe</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member) => (
              <div key={member.name} className="text-center">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-cyan-500/20"
                />
                <h3 className="font-display font-bold text-foreground">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
