/**
 * ProductCategories — Product category grid
 */
import { Link } from "react-router-dom";
import { Wifi, Smartphone, Tv, Shield, Layers } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const ProductCategories = () => {
  const { t } = useLanguage();

  const categories = [
    { id: "internet", labelKey: "categories.internet", icon: Wifi, to: "/internet", descKey: "categories.internet.desc" },
    { id: "mobile", labelKey: "categories.mobile", icon: Smartphone, to: "/mobile", descKey: "categories.mobile.desc" },
    { id: "tv", labelKey: "categories.tv", icon: Tv, to: "/tv", descKey: "categories.tv.desc" },
    { id: "security", labelKey: "categories.security", icon: Shield, to: "/contact", descKey: "categories.security.desc" },
    { id: "build", labelKey: "categories.build", icon: Layers, to: "/commander", descKey: "categories.build.desc" },
  ];

  return (
    <section className="py-10 sm:py-16 lg:py-20" style={{ background: '#080612' }}>
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-6 lg:gap-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                to={cat.to}
                className="group flex flex-col items-center text-center gap-2.5 sm:gap-4 p-3 sm:p-6 rounded-xl sm:rounded-2xl transition-all duration-200"
                style={{ color: 'inherit', textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div
                  className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-200"
                  style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.22)' }}
                >
                  <Icon className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 transition-colors duration-200" style={{ color: '#A78BFA' }} />
                </div>
                <span className="text-[13px] sm:text-sm lg:text-base font-semibold transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.78)' }}>
                  {t(cat.labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProductCategories;
