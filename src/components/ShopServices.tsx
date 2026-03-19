import { Wifi, Smartphone, Tv, Monitor, Shield, Headphones } from "lucide-react";
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
    <section className="py-20 border-t border-slate-100">
      <div className="container mx-auto px-4 max-w-7xl">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-10 text-center">
          {isFr ? "Explorer les services Nivra" : "Explore Nivra services"}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.link}
              to={cat.link}
              className="group flex flex-col items-center gap-4 p-6 bg-white rounded-2xl border border-slate-200/80 hover:border-blue-200 hover:shadow-md transition-all duration-300 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <cat.icon className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
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
