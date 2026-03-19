import { Wifi, Smartphone, Tv, Monitor, Shield, Headphones, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const ShopServices = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const categories = [
    { icon: Smartphone, label: isFr ? "Forfaits mobile" : "Mobile plans", link: "/mobile" },
    { icon: Wifi, label: "Internet", link: "/internet" },
    { icon: Tv, label: isFr ? "Télévision" : "Television", link: "/tv" },
    { icon: Monitor, label: "Streaming", link: "/streaming" },
    { icon: Shield, label: isFr ? "Sécurité" : "Security", link: "/services" },
    { icon: Headphones, label: "Support", link: "/aide" },
  ];

  return (
    <section className="py-16 bg-slate-50 border-t border-slate-200">
      <div className="container mx-auto px-4 max-w-[1320px]">
        <div className="text-center mb-10">
          <p className="text-amber-600 text-sm font-bold uppercase tracking-[0.15em] mb-3">
            {isFr ? "EXPLORER" : "EXPLORE"}
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            {isFr ? "Tous les services Nivra" : "All Nivra services"}
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.link}
              to={cat.link}
              className="group flex flex-col items-center gap-3 p-5 bg-white rounded-xl border-2 border-slate-200 hover:border-amber-400 hover:shadow-lg transition-all duration-300 text-center"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center group-hover:bg-amber-400 transition-colors">
                <cat.icon className="w-5 h-5 text-amber-400 group-hover:text-black transition-colors" />
              </div>
              <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                {cat.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ShopServices;
