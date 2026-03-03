import { Button } from "@/components/ui/button";
import { ArrowRight, Wifi, Smartphone, Tv, Monitor, Radio, Tag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";

const Hero = () => {
  const { t, language } = useLanguage();
  const isFr = language === 'fr';
  const { data: services } = usePublicServices();

  // Get Internet starting price
  const internetPrice = (() => {
    if (!services) return "--";
    const internetServices = services.filter(s => s.category === "Internet");
    if (internetServices.length === 0) return "--";
    return Math.min(...internetServices.map(s => Number(s.price))).toFixed(0);
  })();

  const quickCategories = [
    { icon: Smartphone, label: isFr ? "Forfaits mobile" : "Mobility plans", link: "/mobile" },
    { icon: Wifi, label: "Internet", link: "/internet" },
    { icon: Tv, label: isFr ? "Télévision" : "TV", link: "/tv" },
    { icon: Monitor, label: "Streaming+", link: "/streaming" },
    { icon: Radio, label: isFr ? "Combos" : "Bundles", link: "/compare" },
  ];

  return (
    <section className="bg-white">
      {/* Promo banner — Bell-style blue bar with tag icon */}
      <div className="bg-[#003366] text-white">
        <div className="container mx-auto px-4 max-w-7xl py-2.5 flex items-center justify-center gap-2">
          <Tag className="w-4 h-4 text-white/80 shrink-0" />
          <p className="text-sm text-center">
            {isFr 
              ? "Nouveau client? Obtenez 50% de rabais sur votre première facture. Offre exclusive — Aucun contrat requis." 
              : "New customer? Get 50% off your first bill. Exclusive offer — No contract required."}
          </p>
        </div>
      </div>

      {/* Main Hero — Bell-style large banner */}
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="py-8 lg:py-12">
          <div className="bg-gradient-to-br from-slate-50 via-blue-50/60 to-slate-100 rounded-3xl overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-8 items-center p-8 lg:p-14">
              {/* Left Content */}
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-[1.12] text-slate-900 mb-4">
                  {isFr 
                    ? "Internet haute vitesse. Sans contrat. Sans surprise." 
                    : "High-speed Internet. No contract. No surprises."}
                </h1>
                <p className="text-lg text-slate-600 mb-3">
                  {isFr 
                    ? "Internet fibre optique illimité pour toute la famille." 
                    : "Unlimited fibre optic Internet for the whole family."}
                </p>
                <div className="mb-6">
                  <span className="text-sm text-slate-500">{isFr ? "À partir de" : "Starting at"}</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-5xl font-bold text-slate-900">{internetPrice}$</span>
                    <span className="text-lg text-slate-500">/{isFr ? "mois" : "mo."}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    className="bg-[#003366] hover:bg-[#002244] text-white rounded-full px-8 h-12 text-base font-semibold"
                    asChild
                  >
                    <Link to="/internet">
                      {isFr ? "Magasiner" : "Shop now"}
                    </Link>
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-slate-300 text-slate-700 rounded-full px-8 h-12 text-base font-medium hover:bg-slate-50"
                    asChild
                  >
                    <Link to="/contact">
                      {isFr ? "Nous joindre" : "Contact us"}
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Right - Stats/Visual */}
              <div className="hidden lg:flex items-center justify-center">
                <div className="relative">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="text-4xl font-bold text-[#003366] mb-1">1 Gbps</div>
                      <div className="text-sm text-slate-500">{isFr ? "Vitesse max" : "Max speed"}</div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="text-4xl font-bold text-[#003366] mb-1">5G</div>
                      <div className="text-sm text-slate-500">{isFr ? "Réseau mobile" : "Mobile network"}</div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="text-4xl font-bold text-[#003366] mb-1">200+</div>
                      <div className="text-sm text-slate-500">{isFr ? "Chaînes TV" : "TV channels"}</div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="text-4xl font-bold text-[#003366] mb-1">7j/7</div>
                      <div className="text-sm text-slate-500">{isFr ? "Support local" : "Local support"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick category buttons — Bell-style pills row */}
      <div className="border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 max-w-7xl py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
            <div className="shrink-0">
              <p className="text-sm font-medium text-slate-900">
                {isFr ? "Déjà client Nivra?" : "Already a Nivra customer?"}
              </p>
              <Link to="/portal/auth" className="text-sm text-[#003366] hover:underline font-medium">
                {isFr ? "Connexion à MonNivra" : "Log in to MyNivra"} →
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 flex-1">
              {quickCategories.map((cat) => (
                <Link
                  key={cat.link}
                  to={cat.link}
                  className="flex items-center gap-2.5 px-5 py-3 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 hover:border-[#003366] hover:text-[#003366] hover:bg-blue-50/40 transition-all shadow-sm"
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
