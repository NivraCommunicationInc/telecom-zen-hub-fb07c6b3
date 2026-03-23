import { ClipboardList, MapPin, Settings, Wifi } from "lucide-react";

const steps = [
  { icon: ClipboardList, title: "Choisissez votre forfait", text: "Sélectionnez le plan Internet qui correspond à vos besoins." },
  { icon: MapPin, title: "Vérification de votre adresse", text: "Nous validons la disponibilité du service à votre adresse." },
  { icon: Settings, title: "Installation ou activation", text: "Un technicien installe ou active votre service rapidement." },
  { icon: Wifi, title: "Service actif", text: "Profitez de votre connexion Internet dès l'activation." },
];

const HowItWorks = () => (
  <section className="py-16 lg:py-20 bg-background">
    <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
      <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
        Comment ça fonctionne
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {steps.map((step, i) => (
          <div key={i} className="relative text-center">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-md mx-auto mb-3">
              {i + 1}
            </div>
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
              <step.icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-1.5">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
