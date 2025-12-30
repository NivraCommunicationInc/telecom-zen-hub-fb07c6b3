import { Phone, Mail, MapPin } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    services: [
      { label: "Téléphonie mobile", href: "#services" },
      { label: "Internet", href: "#services" },
      { label: "Télévision", href: "#services" },
      { label: "Sécurité", href: "#services" },
    ],
    company: [
      { label: "À propos", href: "#benefits" },
      { label: "Notre équipe", href: "#benefits" },
      { label: "Carrières", href: "#contact" },
      { label: "Presse", href: "#contact" },
    ],
    support: [
      { label: "FAQ", href: "#how-it-works" },
      { label: "Contact", href: "#contact" },
      { label: "Portail client", href: "#contact" },
      { label: "Documentation", href: "#how-it-works" },
      { label: "Administration", href: "/admin/login" },
    ],
  };

  return (
    <footer className="bg-navy-900 text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                <span className="font-display font-bold text-navy-900 text-xl">N</span>
              </div>
              <span className="font-display font-bold text-xl">Nivra</span>
            </div>
            <p className="text-cyan-100/60 mb-6 max-w-xs">
              Votre courtier télécom indépendant au Québec. Nous simplifions et sécurisons vos services de télécommunication.
            </p>
            <div className="space-y-3">
              <a href="tel:1-800-NIVRA" className="flex items-center gap-3 text-cyan-100/60 hover:text-cyan-300 transition-colors">
                <Phone className="w-4 h-4" />
                <span>1-800-NIVRA</span>
              </a>
              <a href="mailto:info@nivra.ca" className="flex items-center gap-3 text-cyan-100/60 hover:text-cyan-300 transition-colors">
                <Mail className="w-4 h-4" />
                <span>info@nivra.ca</span>
              </a>
              <div className="flex items-center gap-3 text-cyan-100/60">
                <MapPin className="w-4 h-4" />
                <span>Québec, Canada</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4">Services</h4>
            <ul className="space-y-3">
              {links.services.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4">Entreprise</h4>
            <ul className="space-y-3">
              {links.company.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4">Support</h4>
            <ul className="space-y-3">
              {links.support.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-cyan-100/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-cyan-100/40 text-sm">
            © {currentYear} Nivra. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
              Politique de confidentialité
            </a>
            <a href="#" className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
              Conditions d'utilisation
            </a>
            <div className="flex items-center gap-2">
              <button className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm font-medium">
                FR
              </button>
              <span className="text-cyan-100/20">|</span>
              <button className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
                EN
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
