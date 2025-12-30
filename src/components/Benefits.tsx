import { Check, TrendingDown, Eye, Lock, Users, Award } from "lucide-react";

const benefits = [
  {
    icon: TrendingDown,
    title: "Économies garanties",
    description: "Nous négocions les meilleurs tarifs du marché, souvent inaccessibles au grand public.",
  },
  {
    icon: Eye,
    title: "Transparence totale",
    description: "Aucune clause cachée, aucune surprise. Chaque détail de votre contrat est expliqué clairement.",
  },
  {
    icon: Lock,
    title: "Facturation protégée",
    description: "Nous surveillons vos factures et intervenons immédiatement en cas d'erreur ou de surfacturation.",
  },
  {
    icon: Users,
    title: "Rabais employeur",
    description: "Accédez à des programmes de rabais exclusifs liés à votre employeur ou secteur d'activité.",
  },
  {
    icon: Award,
    title: "100% indépendant",
    description: "Nous travaillons pour vous, pas pour les fournisseurs. Vos intérêts sont notre priorité.",
  },
  {
    icon: Check,
    title: "Service bilingue",
    description: "Service complet en français et en anglais pour répondre aux besoins de tous les Québécois.",
  },
];

const Benefits = () => {
  return (
    <section id="benefits" className="py-20 md:py-32 bg-background relative overflow-hidden">
      {/* 3D Background Decoration */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-accent/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-cyan-500/5 to-transparent pointer-events-none" />
      
      {/* Floating 3D Elements */}
      <div className="absolute top-1/4 right-10 w-20 h-20 border border-accent/10 rounded-2xl rotate-12 float-3d opacity-30" />
      <div className="absolute bottom-1/4 left-10 w-16 h-16 border border-cyan-500/10 rounded-xl -rotate-12 float-3d-delayed opacity-25" />
      
      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4 card-3d">
              Pourquoi Nivra
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Vos avantages avec{" "}
              <span className="text-gradient">Nivra</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              En tant que courtier télécom indépendant, nous mettons notre expertise au service de vos économies et de votre tranquillité d'esprit.
            </p>

            {/* Stats with 3D Effect */}
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 rounded-xl bg-card/50 border border-border card-3d">
                <div className="font-display text-3xl md:text-4xl font-bold text-accent mb-1 text-3d">30%</div>
                <div className="text-sm text-muted-foreground">Économies moyennes</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-card/50 border border-border card-3d">
                <div className="font-display text-3xl md:text-4xl font-bold text-accent mb-1 text-3d">500+</div>
                <div className="text-sm text-muted-foreground">Clients satisfaits</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-card/50 border border-border card-3d">
                <div className="font-display text-3xl md:text-4xl font-bold text-accent mb-1 text-3d">24/7</div>
                <div className="text-sm text-muted-foreground">Support disponible</div>
              </div>
            </div>
          </div>

          {/* Right - Benefits Grid with 3D Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className="group p-5 rounded-xl bg-card border border-border hover:border-accent/30 hover:shadow-xl transition-all duration-300 animate-fade-in card-3d"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors shadow-lg group-hover:shadow-glow">
                  <benefit.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display font-bold text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;