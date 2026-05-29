import { Wifi, Smartphone, Tv, Monitor, Shield, Headphones } from "lucide-react";
import { Link } from "react-router-dom";

const ShopServices = () => {
  const categories = [
    { icon: Smartphone, label: "Forfaits mobile", link: "/mobile" },
    { icon: Wifi, label: "Internet", link: "/internet" },
    { icon: Tv, label: "Télévision", link: "/tv" },
    { icon: Monitor, label: "Streaming", link: "/streaming" },
    { icon: Shield, label: "Sécurité", link: "/services" },
    { icon: Headphones, label: "Support", link: "/aide" },
  ];

  return (
    <section className="py-16" style={{ background: '#0A0A18', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="container mx-auto px-4 max-w-7xl">
        <h2 className="font-bold text-white mb-8" style={{ fontSize: 'clamp(20px, 3vw, 28px)', letterSpacing: '-0.5px' }}>
          Magasiner les services Nivra
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.link}
              to={cat.link}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(124,58,237,0.2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                <cat.icon className="w-7 h-7" style={{ color: '#A78BFA' }} />
              </div>
              <span className="text-sm font-medium transition-colors" style={{ color: 'rgba(255,255,255,0.72)' }}>
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
