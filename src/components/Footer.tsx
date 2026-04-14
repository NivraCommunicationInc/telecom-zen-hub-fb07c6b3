import { forwardRef } from "react";
import { Mail, MapPin, Clock, MessageSquare, Facebook, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import paymentMethodsImg from "@/assets/payment-methods.png";
import googleSafeBrowsingImg from "@/assets/google-safe-browsing.png";
import paypalSecureImg from "@/assets/paypal-secure.png";

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { language } = useLanguage();
  const { data: siteSettings } = useSiteSettings();
  const currentYear = new Date().getFullYear();

  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const businessHours = siteSettings?.business_hours || COMPANY_CONTACT.supportHours;
  const address = siteSettings?.address || COMPANY_CONTACT.fullAddress;

  const isFr = language === 'fr';

  const links = {
    services: [
      { label: "Mobile", href: "/mobile" },
      { label: isFr ? "Couverture" : "Coverage", href: "/mobile-coverage" },
      { label: "Internet", href: "/internet" },
      { label: isFr ? "Télévision" : "Television", href: "/tv" },
      { label: isFr ? "Sécurité" : "Security", href: "/services" },
    ],
    support: [
      { label: isFr ? "Nous joindre" : "Contact Us", href: "/#contact" },
      { label: "FAQ", href: "/aide" },
      { label: isFr ? "Suivi de commande" : "Track Order", href: "/track-order" },
      { label: isFr ? "État des systèmes" : "System Status", href: "/status" },
      { label: isFr ? "Portail client" : "Client Portal", href: "/portal/auth" },
      { label: isFr ? "Portail partenaires" : "Partner Portal", href: "/influencer/login" },
    ],
    legal: [
      { label: isFr ? "Conditions" : "Terms", href: "/conditions-de-service" },
      { label: isFr ? "Confidentialité" : "Privacy", href: "/privacy-policy" },
      { label: isFr ? "Loi 25 — Vos droits" : "Law 25 — Your Rights", href: "/politique-de-confidentialite" },
      { label: isFr ? "Remboursement" : "Refunds", href: "/refund-policy" },
      { label: isFr ? "Paiement" : "Payment", href: "/modalites-paiement" },
      { label: isFr ? "Frais" : "Fees", href: "/frais-possibles" },
      { label: isFr ? "Équipement" : "Equipment", href: "/equipement-garantie" },
      { label: isFr ? "Support & plaintes" : "Complaints", href: "/support-et-plaintes" },
    ],
  };

  return (
    <footer ref={ref} className="bg-black text-white" data-testid="footer" role="contentinfo">
      {/* Main Content Grid */}
      <div className="container mx-auto px-4 sm:px-6 py-14 lg:py-20 max-w-[1320px]">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-14">
          
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center">
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <span className="font-bold text-lg text-white">{COMPANY_CONTACT.companyName}</span>
            </div>
            
            <p className="text-sm font-medium mb-3 text-white/60">
              {isFr ? "Télécoms prépayés au Québec" : "Prepaid Telecom in Quebec"}
            </p>
            
            <p className="text-white/40 mb-5 text-sm leading-relaxed max-w-xs">
              {isFr 
                ? "Activation rapide, installation professionnelle et support local." 
                : "Fast activation, professional installation, and local support."}
            </p>
            
            <div className="space-y-2.5">
              <Link 
                to="/portal/auth"
                className="flex items-center gap-2.5 text-white/40 hover:text-white transition-colors text-sm"
              >
                <MessageSquare className="w-4 h-4 text-white/30 shrink-0" />
                <span>Chat / Tickets</span>
              </Link>
              <a 
                href={`mailto:${supportEmail.toLowerCase()}`} 
                className="flex items-center gap-2.5 text-white/40 hover:text-white transition-colors text-sm"
              >
                <Mail className="w-4 h-4 text-white/30 shrink-0" />
                <span className="break-all">{supportEmail}</span>
              </a>
              <div className="flex items-start gap-2.5 text-white/40 text-sm">
                <MapPin className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
              <div className="flex items-start gap-2.5 text-white/40 text-sm">
                <Clock className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
                <span>{businessHours}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <a
                href="https://www.facebook.com/profile.php?id=61584408712750"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://www.instagram.com/nivratelecom/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-widest mb-5 text-white">
              Services
            </h4>
            <ul className="space-y-3">
              {links.services.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-white/40 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-widest mb-5 text-white">
              Support
            </h4>
            <ul className="space-y-3">
              {links.support.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-white/40 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-widest mb-5 text-white">
              {isFr ? "Légal" : "Legal"}
            </h4>
            <ul className="space-y-3">
              {links.legal.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-white/40 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Payment & Security */}
      <div className="border-t border-white/8">
        <div className="container mx-auto px-4 sm:px-6 py-6 max-w-[1320px]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center sm:items-start gap-2">
              <p className="text-white/30 text-xs uppercase tracking-wider font-medium">
                {isFr ? "Paiement" : "Payment"}
              </p>
              <div className="flex items-center gap-3">
                <img src={paymentMethodsImg} alt="Interac, Cash, Mastercard" className="h-7 object-contain" />
                <img src={paypalSecureImg} alt="PayPal" className="h-7 object-contain" />
              </div>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-2">
              <p className="text-white/30 text-xs uppercase tracking-wider font-medium">
                {isFr ? "Sécurité" : "Security"}
              </p>
              <img src={googleSafeBrowsingImg} alt="Google Safe Browsing" className="h-8 object-contain" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 py-4 max-w-[1320px]">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-white/30 text-xs">
              © {currentYear} {COMPANY_CONTACT.legalName}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <Link to="/privacy-policy" className="text-white/30 hover:text-white transition-colors text-xs">
                {isFr ? "Confidentialité" : "Privacy"}
              </Link>
              <span className="text-white/15 text-xs">·</span>
              <Link to="/terms-and-conditions" className="text-white/30 hover:text-white transition-colors text-xs">
                {isFr ? "Conditions" : "Terms"}
              </Link>
              <span className="text-white/15 text-xs">·</span>
              <Link to="/refund-policy" className="text-white/30 hover:text-white transition-colors text-xs">
                {isFr ? "Remboursement" : "Refunds"}
              </Link>
              <span className="text-white/15 text-xs hidden sm:inline">·</span>
              <span className="text-white/20 text-xs">HTTPS + WAF</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
