import { Users, MapPin, Clock, Award } from "lucide-react";

const TelecomStatsBar = () => {
  const stats = [
    {
      icon: Users,
      value: "10 000+",
      label: "Clients satisfaits",
    },
    {
      icon: MapPin,
      value: "Québec",
      label: "Couverture provinciale",
    },
    {
      icon: Clock,
      value: "< 24h",
      label: "Temps d'activation",
    },
    {
      icon: Award,
      value: "99.9%",
      label: "Disponibilité réseau",
    },
  ];

  return (
    <section className="bg-primary py-6 border-b border-white/10">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="flex items-center gap-4 justify-center lg:justify-start"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <stat.icon className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="text-xl lg:text-2xl font-bold text-white">
                  {stat.value}
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wide">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TelecomStatsBar;
