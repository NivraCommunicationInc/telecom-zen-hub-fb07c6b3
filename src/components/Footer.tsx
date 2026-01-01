import { forwardRef } from "react";
import { Phone, Mail, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  const links = {
    services: [
      { labelKey: "services.mobile.title", href: "/#services" },
      { labelKey: "services.internet.title", href: "/#services" },
      { labelKey: "services.tv.title", href: "/#services" },
      { labelKey: "services.business.title", href: "/#services" },
    ],
    company: [
      { labelKey: "nav.about", href: "/about" },
      { labelKey: "nav.careers", href: "/careers" },
      { labelKey: "nav.faq", href: "/faq" },
      { labelKey: "nav.contact", href: "/#contact" },
    ],
    support: [
      { labelKey: "nav.faq", href: "/faq" },
      { labelKey: "nav.portal", href: "/portal/auth" },
    ],
  };

  return (
    <footer ref={ref} className="bg-navy-900 text-primary-foreground">
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
              {t('footer.description')}
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
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4">{t('footer.services')}</h4>
            <ul className="space-y-3">
              {links.services.map((link) => (
                <li key={link.labelKey}>
                  <Link to={link.href} className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4">{t('footer.company')}</h4>
            <ul className="space-y-3">
              {links.company.map((link) => (
                <li key={link.labelKey}>
                  <Link to={link.href} className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4">{t('footer.legal')}</h4>
            <ul className="space-y-3">
              {links.support.map((link) => (
                <li key={link.labelKey}>
                  <Link to={link.href} className="text-cyan-100/60 hover:text-cyan-300 transition-colors text-sm">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-cyan-100/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-cyan-100/40 text-sm">
            © {currentYear} Nivra. {t('footer.rights')}
          </p>
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <Link to="/privacy" className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
              {t('footer.privacy')}
            </Link>
            <Link to="/terms" className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
              {t('footer.terms')}
            </Link>
            <Link to="/admin" className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
              Admin
            </Link>
            <Link to="/employee/login" className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
              Connexion Employé
            </Link>
            <Link to="/technician/auth" className="text-cyan-100/40 hover:text-cyan-300 transition-colors text-sm">
              Connexion Technicien
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;