import { Wifi, Smartphone, Tv, Monitor, Shield, Headphones, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Bell-style "Shop Nivra services" grid of category tiles
 */
const ShopServices = () => {
  const categories = [
    { icon: Smartphone, label: "Forfaits mobile", link: "/mobile", color: "bg-blue-50 text-[#003366]" },
    { icon: Wifi, label: "Internet", link: "/internet", color: "bg-teal-50 text-teal-700" },
    { icon: Tv, label: "Télévision", link: "/tv", color: "bg-indigo-50 text-indigo-700" },
    { icon: Monitor, label: "Streaming", link: "/streaming", color: "bg-purple-50 text-purple-700" },
    { icon: Shield, label: "Sécurité", link: "/services", color: "bg-emerald-50 text-emerald-700" },
    { icon: Headphones, label: "Support", link: "/aide", color: "bg-amber-50 text-amber-700" },
  ];

  return (
    <section className="py-16 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4 max-w-7xl">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
          Magasiner les services Nivra
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.link}
              to={cat.link}
              className="group flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border border-slate-200 hover:border-[#003366] hover:shadow-md transition-all duration-300 text-center"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${cat.color}`}>
                <cat.icon className="w-7 h-7" />
              </div>
              <span className="text-sm font-medium text-slate-700 group-hover:text-[#003366] transition-colors">
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
