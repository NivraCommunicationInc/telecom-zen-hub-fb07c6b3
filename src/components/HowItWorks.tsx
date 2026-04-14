import { ClipboardList, MapPin, Settings, Wifi } from "lucide-react";

const steps = [
  { icon: ClipboardList, title: "Choisissez votre forfait", text: "Sélectionnez le plan Internet qui correspond à vos besoins." },
  { icon: MapPin, title: "Vérification de votre adresse", text: "Nous validons la disponibilité du service à votre adresse." },
  { icon: Settings, title: "Installation ou activation", text: "Un technicien installe ou active votre service rapidement." },
  { icon: Wifi, title: "Service actif", text: "Profitez de votre connexion Internet dès l'activation." },
];

const HowItWorks = () => (
  <section className="py-20 lg:py-28 bg-white">
    <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
      <h2 className="text-3xl md:text-[2.5rem] font-bold text-black text-center mb-16 tracking-[-0.025em]">
        Comment ça fonctionne
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
        {steps.map((step, i) => (
          <div key={i} className="relative text-center group">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-5 group-hover:bg-purple-200 transition-colors">
              <step.icon className="w-7 h-7 text-purple-600" />
            </div>
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mx-auto mb-4">
              {i + 1}
            </div>
            <h3 className="font-bold text-black mb-2">{step.title}</h3>
            <p className="text-sm text-black/60 leading-relaxed max-w-[220px] mx-auto">{step.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
