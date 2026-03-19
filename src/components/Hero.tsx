import { Button } from "@/components/ui/button";
import { ArrowRight, Wifi, Smartphone, Tv, Monitor, Radio, Tag } from "lucide-react";
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
    <section className="bg-white">
      {/* Promo banner */}
      <div className="bg-[#003366] text-white">
        <div className="container mx-auto px-4 max-w-[1320px] py-2.5 flex items-center justify-center gap-2">
          <Tag className="w-4 h-4 text-white/80 shrink-0 hidden sm:block" />
          <p className="text-xs sm:text-sm text-center leading-snug">
            {isFr 
              ? "Nouveau client? 50% de rabais sur votre 1re facture. Sans contrat." 
              : "New customer? 50% off your first bill. No contract."}
          </p>
        </div>
      </div>

      {/* Main Hero */}
      <div className="container mx-auto px-4 max-w-[1320px]">
        <div className="py-6 sm:py-8 lg:py-12">
          <div className="bg-gradient-to-br from-slate-50 via-blue-50/60 to-slate-100 rounded-2xl sm:rounded-3xl overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center p-6 sm:p-8 lg:py-14 lg:px-10">
              {/* Left Content */}
              <div>
                {/* Mobile: 22-26px, Tablet: 28-32px, Desktop: up to 44px */}
                <h1 className="text-[22px] sm:text-[28px] lg:text-[2.75rem] font-bold leading-[1.15] text-slate-900 mb-3 sm:mb-4">
                  {isFr 
                    ? "Internet haute vitesse. Sans contrat." 
                    : "High-speed Internet. No contract."}
                </h1>
                <p className="text-base sm:text-lg text-slate-600 mb-4 leading-relaxed">
                  {isFr 
                    ? "Internet fibre optique illimité pour toute la famille." 
                    : "Unlimited fibre optic Internet for the whole family."}
                </p>
                <div className="mb-5 sm:mb-6">
                  <span className="text-sm text-slate-500">{isFr ? "À partir de" : "Starting at"}</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-4xl sm:text-5xl font-bold text-slate-900">{internetPrice}$</span>
                    <span className="text-base sm:text-lg text-slate-500">/{isFr ? "mois" : "mo."}</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    className="bg-[#003366] hover:bg-[#002244] text-white rounded-full px-8 h-12 text-base font-semibold w-full sm:w-auto"
                    asChild
                  >
                    <Link to="/internet">
                      {isFr ? "Magasiner" : "Shop now"}
                    </Link>
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-slate-300 text-slate-700 rounded-full px-8 h-12 text-base font-medium hover:bg-slate-50 w-full sm:w-auto"
                    asChild
                  >
                    <Link to="/contact">
                      {isFr ? "Nous joindre" : "Contact us"}
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Right - Stats grid (tablet+) */}
              <div className="hidden md:flex items-center justify-center">
                <div className="grid grid-cols-2 gap-3 lg:gap-4 w-full max-w-sm">
                  {[
                    { value: "1 Gbps", label: isFr ? "Vitesse max" : "Max speed" },
                    { value: "5G", label: isFr ? "Réseau mobile" : "Mobile network" },
                    { value: "200+", label: isFr ? "Chaînes TV" : "TV channels" },
                    { value: "7j/7", label: isFr ? "Support local" : "Local support" },
                  ].map((stat) => (
                    <div key={stat.value} className="bg-white rounded-2xl p-5 lg:p-6 shadow-sm border border-slate-200">
                      <div className="text-2xl lg:text-4xl font-bold text-[#003366] mb-1">{stat.value}</div>
                      <div className="text-xs lg:text-sm text-slate-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick category pills */}
      <div className="border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 max-w-[1320px] py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
            <div className="shrink-0">
              <p className="text-sm font-medium text-slate-900">
                {isFr ? "Déjà client Nivra?" : "Already a Nivra customer?"}
              </p>
              <Link to="/portal/auth" className="text-sm text-[#003366] hover:underline font-medium">
                {isFr ? "Connexion à MonNivra" : "Log in to MyNivra"} →
              </Link>
            </div>
            {/* Horizontally scrollable on mobile */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible w-full">
              {quickCategories.map((cat) => (
                <Link
                  key={cat.link}
                  to={cat.link}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 hover:border-[#003366] hover:text-[#003366] hover:bg-blue-50/40 transition-all shadow-sm whitespace-nowrap shrink-0 min-h-[44px]"
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
