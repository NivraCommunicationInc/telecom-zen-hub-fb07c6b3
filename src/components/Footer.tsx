import { Phone, Mail, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    services: [
      { label: "Téléphonie mobile", href: "/#services", isExternal: false },
      { label: "Internet", href: "/#services", isExternal: false },
      { label: "Télévision", href: "/#services", isExternal: false },
      { label: "Sécurité", href: "/#services", isExternal: false },
    ],
    company: [
      { label: "À propos", href: "/about", isExternal: false },
      { label: "Notre équipe", href: "/about", isExternal: false },
      { label: "Carrières", href: "/careers", isExternal: false },
      { label: "Presse", href: "/#contact", isExternal: false },
    ],
    support: [
      { label: "FAQ", href: "/faq", isExternal: false },
      { label: "Contact", href: "/#contact", isExternal: false },
      { label: "Portail client", href: "/portal/auth", isExternal: false },
      { label: "Administration", href: "/admin/login", isExternal: false },
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
              Votre courtier télécom 100% indépendant au Québec. Payé par vous, sans aucune affiliation aux fournisseurs.
            </p>
            <div className="space-y-3">
              <a href="tel:+14385442233" className="flex items-center gap-3 text-cyan-100/60 hover:text-cyan-300 transition-colors">
                <Phone className="w-4 h-4" />
                <span>438-544-2233</span>
              </a>
              <a href="mailto:Nivratelecom@gmail.com" className="flex items-center gap-3 text-cyan-100/60 hover:text-cyan-300 transition-colors">
                <Mail className="w-4 h-4" />
                <span>Nivratelecom@gmail.com</span>
              </a>
              <div className="flex items-center gap-3 text-cyan-100/60">
                <MapPin className="w-4 h-4" />
                <span>Montréal, QC</span>
              </div>
              <div className="text-cyan-100/60 text-sm mt-2">
                <p className="font-medium text-cyan-100/80">Heures d'ouverture</p>
                <p>7 jours sur 7: 9h00 - 17h00</p>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4">Services</h4>
            <ul className="space-y-3">
              {links.services.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm">
                    {link.label}
                  </Link>
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
                  <Link to={link.href} className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm">
                    {link.label}
                  </Link>
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
                  <Link to={link.href} className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm">
                    {link.label}
                  </Link>
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
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <Link to="/privacy" className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
              Politique de confidentialité
            </Link>
            <Link to="/terms" className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
              Conditions d'utilisation
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
