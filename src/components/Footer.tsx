import { forwardRef } from "react";
import { Mail, MapPin, Clock, MessageSquare } from "lucide-react";
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
      { label: isFr ? "Couverture Mobile" : "Mobile Coverage", href: "/mobile-coverage" },
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
      { label: isFr ? "Conditions de service" : "Terms of Service", href: "/conditions-de-service" },
      { label: isFr ? "Politique de confidentialité" : "Privacy Policy", href: "/privacy-policy" },
      { label: isFr ? "Politique de remboursement" : "Refund Policy", href: "/refund-policy" },
      { label: isFr ? "Paiement / e-Transfer" : "Payment / e-Transfer", href: "/modalites-paiement" },
      { label: isFr ? "Frais possibles" : "Possible Fees", href: "/frais-possibles" },
      { label: isFr ? "Équipement & garantie" : "Equipment & Warranty", href: "/equipement-garantie" },
      { label: isFr ? "Support & plaintes" : "Support & Complaints", href: "/support-et-plaintes" },
    ],
  };

  return (
    <footer ref={ref} className="bg-slate-900 text-white" data-testid="footer">
      {/* Main Content Grid */}
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#003366] flex items-center justify-center">
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <span className="font-bold text-lg text-white">{COMPANY_CONTACT.companyName}</span>
            </div>
            
            <p className="text-sm font-medium mb-3 text-slate-300">
              {isFr ? "Télécoms prépayés au Québec" : "Prepaid Telecom in Quebec"}
            </p>
            
            <p className="text-slate-400 mb-5 text-sm leading-relaxed max-w-xs">
              {isFr 
                ? "Activation rapide, installation professionnelle et support local." 
                : "Fast activation, professional installation, and local support."}
            </p>
            
            <div className="space-y-2.5">
              <Link 
                to="/portal/auth"
                className="flex items-center gap-2.5 text-slate-400 hover:text-white transition-colors text-sm"
                data-testid="footer-chat"
              >
                <MessageSquare className="w-4 h-4 text-slate-500" />
                <span>{isFr ? "Chat / Tickets" : "Chat / Tickets"}</span>
              </Link>
              <a 
                href={`mailto:${supportEmail.toLowerCase()}`} 
                className="flex items-center gap-2.5 text-slate-400 hover:text-white transition-colors text-sm"
                data-testid="footer-email"
              >
                <Mail className="w-4 h-4 text-slate-500" />
                <span>{supportEmail}</span>
              </a>
              <div className="flex items-start gap-2.5 text-slate-400 text-sm" data-testid="footer-address">
                <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-400 text-sm" data-testid="footer-hours">
                <Clock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <span>{businessHours}</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-widest mb-4 text-white">
              Services
            </h4>
            <ul className="space-y-2.5">
              {links.services.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-slate-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-widest mb-4 text-white">
              Support
            </h4>
            <ul className="space-y-2.5">
              {links.support.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-slate-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-widest mb-4 text-white">
              {isFr ? "Légal" : "Legal"}
            </h4>
            <ul className="space-y-2.5">
              {links.legal.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-slate-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Payment & Security */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">
                {isFr ? "Méthodes de paiement acceptées" : "Accepted Payment Methods"}
              </p>
              <div className="flex items-center gap-3">
                <img src={paymentMethodsImg} alt="Interac, Cash, Mastercard" className="h-8 object-contain" />
                <img src={paypalSecureImg} alt="PayPal" className="h-8 object-contain" />
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2">
              <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">
                {isFr ? "Sécurité" : "Security"}
              </p>
              <img src={googleSafeBrowsingImg} alt="Google Safe Browsing" className="h-10 object-contain" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-5 max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-slate-500 text-xs text-center sm:text-left">
              © {currentYear} {COMPANY_CONTACT.legalName} {isFr ? "Tous droits réservés." : "All rights reserved."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <Link to="/privacy-policy" className="text-slate-500 hover:text-white transition-colors text-xs">
                {isFr ? "Confidentialité" : "Privacy"}
              </Link>
              <span className="text-slate-600 text-xs hidden sm:inline">|</span>
              <Link to="/terms-and-conditions" className="text-slate-500 hover:text-white transition-colors text-xs">
                {isFr ? "Conditions" : "Terms"}
              </Link>
              <span className="text-slate-600 text-xs hidden sm:inline">|</span>
              <Link to="/refund-policy" className="text-slate-500 hover:text-white transition-colors text-xs">
                {isFr ? "Remboursement" : "Refunds"}
              </Link>
              <span className="text-slate-600 text-xs hidden sm:inline">·</span>
              <span className="text-slate-600 text-xs">HTTPS + WAF</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
