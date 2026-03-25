import { ClipboardList, MapPin, Settings, Wifi } from "lucide-react";

const steps = [
  { icon: ClipboardList, title: "Choisissez votre forfait", text: "Sélectionnez le plan Internet qui correspond à vos besoins." },
  { icon: MapPin, title: "Vérification de votre adresse", text: "Nous validons la disponibilité du service à votre adresse." },
  { icon: Settings, title: "Installation ou activation", text: "Un technicien installe ou active votre service rapidement." },
  { icon: Wifi, title: "Service actif", text: "Profitez de votre connexion Internet dès l'activation." },
];

const HowItWorks = () => (
  <section className="py-24 lg:py-36 bg-background">
    <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
      <h2 className="text-3xl md:text-[2.75rem] font-bold text-foreground text-center mb-6 tracking-[-0.03em]">
        Comment ça fonctionne
      </h2>
      <p className="text-muted-foreground text-lg text-center mb-16 lg:mb-20 max-w-lg mx-auto">
        Un processus simple en 4 étapes
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
        {steps.map((step, i) => (
          <div key={i} className="relative text-center bg-card border border-border rounded-3xl p-8 lg:p-10 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 hover:-translate-y-1 group">
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-md mx-auto mb-6">
              {i + 1}
            </div>
            <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/12 transition-colors duration-300">
              <step.icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-3 text-base">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
