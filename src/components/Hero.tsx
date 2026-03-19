import { Button } from "@/components/ui/button";
import { ArrowRight, Wifi, Smartphone, Tv, Monitor, Radio, Tag, Shield, Clock, Zap, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";

const Hero = () => {
  const { t, language } = useLanguage();
  const isFr = language === 'fr';
  const { data: services } = usePublicServices();

  const internetPrice = (() => {
    if (!services) return "--";
    const internetServices = services.filter(s => s.category === "Internet");
    if (internetServices.length === 0) return "--";
    return Math.min(...internetServices.map(s => Number(s.price))).toFixed(0);
  })();

  const quickCategories = [
    { icon: Smartphone, label: isFr ? "Mobile" : "Mobility", link: "/mobile" },
    { icon: Wifi, label: "Internet", link: "/internet" },
    { icon: Tv, label: isFr ? "TV" : "TV", link: "/tv" },
    { icon: Monitor, label: "Streaming+", link: "/streaming" },
    { icon: Radio, label: isFr ? "Combos" : "Bundles", link: "/compare" },
  ];

  return (
    <section className="bg-background">
      {/* Promo banner — urgent deal feel */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 max-w-[1320px] py-3 flex items-center justify-center gap-3">
          <span className="hidden sm:inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/15 shrink-0">
            <Tag className="w-3.5 h-3.5" />
          </span>
          <p className="text-xs sm:text-sm text-center leading-snug font-semibold tracking-wide">
            {isFr
              ? "🔥 Nouveau client? 50% de rabais sur votre 1re facture. Sans contrat."
              : "🔥 New customer? 50% off your first bill. No contract."}
          </p>
          <Link
            to="/internet"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-primary-foreground/90 hover:text-primary-foreground underline underline-offset-2 shrink-0"
          >
            {isFr ? "En profiter" : "Claim now"}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Hero */}
      <div className="container mx-auto px-4 max-w-[1320px]">
        <div className="py-8 sm:py-10 lg:py-14">
          <div className="bg-gradient-to-br from-secondary via-primary/5 to-secondary rounded-2xl sm:rounded-3xl overflow-hidden relative">
            {/* Subtle glow */}
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center p-7 sm:p-10 lg:py-16 lg:px-12 relative">
              {/* Left Content */}
              <div>
                {/* Eyebrow */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 mb-5">
                  <Wifi className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {isFr ? "Fibre optique illimitée" : "Unlimited fibre optic"}
                  </span>
                </div>

                <h1 className="text-[26px] sm:text-[34px] lg:text-[3.25rem] font-extrabold leading-[1.08] text-foreground mb-4 sm:mb-5">
                  {isFr
                    ? "Internet haute vitesse. Sans contrat."
                    : "High-speed Internet. No contract."}
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground mb-6 leading-relaxed max-w-md">
                  {isFr
                    ? "Internet fibre optique illimité pour toute la famille."
                    : "Unlimited fibre optic Internet for the whole family."}
                </p>

                {/* Price block — deal-focused */}
                <div className="mb-7 sm:mb-8 bg-card rounded-2xl border border-border p-5 inline-block shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isFr ? "À partir de" : "Starting at"}
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-5xl sm:text-6xl font-black text-foreground leading-none">{internetPrice}$</span>
                    <span className="text-base text-muted-foreground font-medium">/{isFr ? "mois" : "mo."}</span>
                  </div>
                  <p className="text-xs text-primary font-semibold mt-2">
                    {isFr ? "✓ Routeur Wi-Fi inclus • Données illimitées" : "✓ Wi-Fi router included • Unlimited data"}
                  </p>
                </div>

                {/* CTAs — clear hierarchy */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-10 h-14 text-base font-bold w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-300"
                    asChild
                  >
                    <Link to="/internet">
                      {isFr ? "Voir les forfaits" : "View plans"}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border text-foreground rounded-full px-8 h-14 text-base font-semibold hover:bg-secondary w-full sm:w-auto transition-all duration-300"
                    asChild
                  >
                    <Link to="/contact">
                      {isFr ? "Nous joindre" : "Contact us"}
                    </Link>
                  </Button>
                </div>

                {/* Trust micro-indicators */}
                <div className="flex flex-wrap gap-5">
                  {[
                    { icon: Shield, text: isFr ? "Sans contrat" : "No contract" },
                    { icon: Clock, text: isFr ? "Activation rapide" : "Fast activation" },
                    { icon: CheckCircle, text: isFr ? "Sans vérif. crédit" : "No credit check" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <item.icon className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right - Stats grid (tablet+) */}
              <div className="hidden md:flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                  {[
                    { value: "1 Gbps", label: isFr ? "Vitesse max" : "Max speed" },
                    { value: "5G", label: isFr ? "Réseau mobile" : "Mobile network" },
                    { value: "200+", label: isFr ? "Chaînes TV" : "TV channels" },
                    { value: "7j/7", label: isFr ? "Support local" : "Local support" },
                  ].map((stat) => (
                    <div key={stat.value} className="bg-card rounded-2xl p-6 shadow-sm border border-border hover:shadow-md hover:border-primary/20 transition-all duration-300 group">
                      <div className="text-3xl lg:text-4xl font-black text-primary mb-1.5 group-hover:scale-105 transition-transform duration-300 origin-left">{stat.value}</div>
                      <div className="text-xs lg:text-sm text-muted-foreground font-medium">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick category pills */}
      <div className="border-t border-border bg-background">
        <div className="container mx-auto px-4 max-w-[1320px] py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
            <div className="shrink-0">
              <p className="text-sm font-semibold text-foreground">
                {isFr ? "Déjà client Nivra?" : "Already a Nivra customer?"}
              </p>
              <Link to="/portal/auth" className="text-sm text-primary hover:underline font-semibold">
                {isFr ? "Connexion à MonNivra" : "Log in to MyNivra"} →
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible w-full">
              {quickCategories.map((cat) => (
                <Link
                  key={cat.link}
                  to={cat.link}
                  className="flex items-center gap-2 px-5 py-2.5 bg-card border border-border rounded-full text-sm font-semibold text-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200 shadow-sm whitespace-nowrap shrink-0 min-h-[44px] hover:shadow-md"
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
