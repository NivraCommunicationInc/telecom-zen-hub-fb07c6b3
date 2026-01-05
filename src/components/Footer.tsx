import { forwardRef } from "react";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT, getMailtoLink, getTelLink } from "@/config/company";

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  const links = {
    services: [
      { labelKey: "services.mobile.title", href: "/mobile" },
      { labelKey: "services.internet.title", href: "/internet" },
      { labelKey: "services.tv.title", href: "/tv" },
      { label: "Streaming+", href: "/streaming" },
      { labelKey: "services.business.title", href: "/services" },
    ],
    support: [
      { labelKey: "footer.contact", href: "/#contact" },
      { labelKey: "nav.faq", href: "/faq" },
      { labelKey: "nav.portal", href: "/portal/auth" },
    ],
    company: [
      { labelKey: "nav.about", href: "/about" },
    ],
    legal: [
      { label: "Conditions de service", href: "/conditions-de-service" },
      { label: "Installation & rendez-vous", href: "/installation-rendezvous" },
      { label: "Paiement / e-Transfer", href: "/modalites-paiement" },
      { label: "Équipement & garantie", href: "/equipement-garantie" },
      { label: "Support & plaintes", href: "/support-et-plaintes" },
      { label: "Confidentialité (Loi 25)", href: "/confidentialite-loi25" },
    ],
  };

  return (
    <footer ref={ref} className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <span className="font-bold text-lg text-white">{COMPANY_CONTACT.legalName}</span>
            </div>
            
            {/* Positioning statement */}
            <p className="text-accent text-sm font-medium mb-4">
              Activation • Installation • Support
            </p>
            
            <p className="text-white/60 mb-6 max-w-xs text-sm leading-relaxed">
              {t('footer.description')}
            </p>
            
            <div className="space-y-3">
              <a href={getTelLink()} className="flex items-center gap-3 text-white/60 hover:text-accent transition-colors text-sm">
                <Phone className="w-4 h-4" />
                <span>{COMPANY_CONTACT.supportPhoneDisplay}</span>
              </a>
              <a href={getMailtoLink()} className="flex items-center gap-3 text-white/60 hover:text-accent transition-colors text-sm">
                <Mail className="w-4 h-4" />
                <span>{COMPANY_CONTACT.supportEmailDisplay}</span>
              </a>
              <div className="flex items-center gap-3 text-white/60 text-sm">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{COMPANY_CONTACT.fullAddress}</span>
              </div>
              <div className="flex items-start gap-3 text-white/60 text-sm">
                <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p>{COMPANY_CONTACT.supportHoursWeekday}</p>
                  <p>{COMPANY_CONTACT.supportHoursWeekend}</p>
                </div>
              </div>
            </div>
            
            {/* Notice about invoices */}
            <p className="text-white/40 text-xs mt-4 italic">
              Avis et factures transmis via le portail et/ou courriel.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 text-white">{t('footer.services')}</h4>
            <ul className="space-y-2.5">
              {links.services.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-white/60 hover:text-accent transition-colors text-sm">
                    {'label' in link ? link.label : t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 text-white">{t('footer.support')}</h4>
            <ul className="space-y-2.5">
              {links.support.map((link) => (
                <li key={link.labelKey}>
                  <Link to={link.href} className="text-white/60 hover:text-accent transition-colors text-sm">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 text-white">{t('footer.company')}</h4>
            <ul className="space-y-2.5">
              {links.company.map((link) => (
                <li key={link.labelKey}>
                  <Link to={link.href} className="text-white/60 hover:text-accent transition-colors text-sm">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 text-white">{t('footer.legal')}</h4>
            <ul className="space-y-2.5">
              {links.legal.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-white/60 hover:text-accent transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 mt-12 pt-8">
          {/* Compliance line */}
          <p className="text-white/40 text-xs text-center mb-4">
            {COMPANY_CONTACT.legalName} — Services télécoms prépayés au Québec. Support et activation.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              © {currentYear} {COMPANY_CONTACT.legalName}. {t('footer.rights')}
            </p>
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <Link to="/conditions-de-service" className="text-white/40 hover:text-accent transition-colors text-sm">
                Conditions
              </Link>
              <Link to="/confidentialite-loi25" className="text-white/40 hover:text-accent transition-colors text-sm">
                Confidentialité
              </Link>
              <Link to="/admin" className="text-white/40 hover:text-accent transition-colors text-sm">
                Admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;