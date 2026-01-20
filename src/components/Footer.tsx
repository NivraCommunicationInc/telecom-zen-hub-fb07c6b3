import { forwardRef } from "react";
import { Mail, MapPin, Clock, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { language } = useLanguage();
  const { data: siteSettings } = useSiteSettings();
  const currentYear = new Date().getFullYear();

  // Use database values if available, fallback to config
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
    <footer ref={ref} className="bg-navy-900 text-white" data-testid="footer">
      {/* Tier 1: Main Content Grid */}
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          
          {/* Column A: Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <span className="font-bold text-lg text-white">{COMPANY_CONTACT.companyName}</span>
            </div>
            
            <p className="text-accent text-sm font-medium mb-3">
              {isFr ? "Télécoms prépayés au Québec" : "Prepaid Telecom in Quebec"}
            </p>
            
            <p className="text-white/60 mb-5 text-sm leading-relaxed max-w-xs">
              {isFr 
                ? "Activation rapide, installation professionnelle et support local." 
                : "Fast activation, professional installation, and local support."}
            </p>
            
            <div className="space-y-2.5">
              <Link 
                to="/portal/auth"
                className="flex items-center gap-2.5 text-white/70 hover:text-accent transition-colors text-sm"
                data-testid="footer-chat"
              >
                <MessageSquare className="w-4 h-4 text-accent/80" />
                <span>{isFr ? "Chat / Tickets" : "Chat / Tickets"}</span>
              </Link>
              <a 
                href={`mailto:${supportEmail.toLowerCase()}`} 
                className="flex items-center gap-2.5 text-white/70 hover:text-accent transition-colors text-sm"
                data-testid="footer-email"
              >
                <Mail className="w-4 h-4 text-accent/80" />
                <span>{supportEmail}</span>
              </a>
              <div className="flex items-start gap-2.5 text-white/70 text-sm" data-testid="footer-address">
                <MapPin className="w-4 h-4 text-accent/80 flex-shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
              <div className="flex items-start gap-2.5 text-white/70 text-sm" data-testid="footer-hours">
                <Clock className="w-4 h-4 text-accent/80 flex-shrink-0 mt-0.5" />
                <span>{businessHours}</span>
              </div>
            </div>
          </div>

          {/* Column B: Services */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-widest mb-4 text-white/90">
              Services
            </h4>
            <ul className="space-y-2.5">
              {links.services.map((link) => (
                <li key={link.href}>
                  <Link 
                    to={link.href} 
                    className="text-white/60 hover:text-accent transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column C: Support */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-widest mb-4 text-white/90">
              Support
            </h4>
            <ul className="space-y-2.5">
              {links.support.map((link) => (
                <li key={link.href}>
                  <Link 
                    to={link.href} 
                    className="text-white/60 hover:text-accent transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column D: Legal */}
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-widest mb-4 text-white/90">
              {isFr ? "Légal" : "Legal"}
            </h4>
            <ul className="space-y-2.5">
              {links.legal.map((link) => (
                <li key={link.href}>
                  <Link 
                    to={link.href} 
                    className="text-white/60 hover:text-accent transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Tier 2: Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-5 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Copyright */}
            <p className="text-white/50 text-xs text-center sm:text-left">
              © {currentYear} {COMPANY_CONTACT.legalName} {isFr ? "Tous droits réservés." : "All rights reserved."}
            </p>

            {/* Legal shortcuts + Security */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <Link 
                to="/privacy-policy" 
                className="text-white/50 hover:text-accent transition-colors text-xs"
              >
                {isFr ? "Confidentialité" : "Privacy"}
              </Link>
              <span className="text-white/30 text-xs hidden sm:inline">|</span>
              <Link 
                to="/terms-and-conditions" 
                className="text-white/50 hover:text-accent transition-colors text-xs"
              >
                {isFr ? "Conditions" : "Terms"}
              </Link>
              <span className="text-white/30 text-xs hidden sm:inline">|</span>
              <Link 
                to="/refund-policy" 
                className="text-white/50 hover:text-accent transition-colors text-xs"
              >
                {isFr ? "Remboursement" : "Refunds"}
              </Link>
              <span className="text-white/30 text-xs hidden sm:inline">·</span>
              <span className="text-white/40 text-xs">
                HTTPS + WAF
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
