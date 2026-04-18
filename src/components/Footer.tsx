import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";
import { LogoIcon } from "@/components/brand";

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { language } = useLanguage();
  const currentYear = new Date().getFullYear();
  const isFr = language === 'fr';

  const linksRow1 = [
    { label: isFr ? "Forfaits" : "Plans", href: "/forfaits" },
    { label: "Internet", href: "/internet" },
    { label: "TV", href: "/television" },
    { label: "Support", href: "/support" },
    { label: "Contact", href: "/contact" },
    { label: "FAQ", href: "/aide" },
    { label: isFr ? "État des services" : "System Status", href: "/status" },
  ];

  const linksRow2 = [
    { label: isFr ? "Confidentialité" : "Privacy", href: "/privacy-policy" },
    { label: isFr ? "Conditions" : "Terms", href: "/conditions-de-service" },
    { label: isFr ? "Remboursement" : "Refund", href: "/politique-remboursement" },
    { label: isFr ? "Frais" : "Fees", href: "/frais-possibles" },
    { label: isFr ? "CRTC" : "CRTC", href: "/conformite-crtc" },
    { label: isFr ? "Loi 25" : "Law 25", href: "/confidentialite-loi25" },
  ];

  const linkStyle = { color: 'rgba(255,255,255,0.55)' };

  return (
    <footer ref={ref} style={{ background: '#111111', marginTop: 0 }} className="text-white pb-5 md:pb-5" role="contentinfo">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 md:pt-8">
        {/* Logo + tagline */}
        <div className="flex items-center justify-center gap-2.5 mb-4 md:mb-5">
          <LogoIcon size={28} />
          <div className="text-center">
            <span className="font-bold text-base text-white">Nivra</span>
            <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-[11px] md:text-xs">
              {isFr ? "Internet et TV sans contrat au Québec" : "Internet & TV without contract in Quebec"}
            </p>
          </div>
        </div>

        {/* Links row 1 */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 md:gap-x-4 gap-y-2 mb-1 text-[12px] md:text-[13px]">
          {linksRow1.map(link => (
            <Link key={link.href} to={link.href} className="hover:text-white transition-colors" style={linkStyle}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Links row 2 */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 md:gap-x-4 gap-y-2 mb-4 text-[12px] md:text-[13px]">
          {linksRow2.map(link => (
            <Link key={link.href} to={link.href} className="hover:text-white transition-colors" style={linkStyle}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Payment logos */}
        <div
          className="flex flex-col md:flex-row flex-wrap items-center justify-center gap-3 md:gap-4 pt-3 pb-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {isFr ? 'Paiements acceptés' : 'Accepted payments'}
          </span>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <div style={{ background: '#fff', borderRadius: 4, padding: '4px 8px', display: 'flex', alignItems: 'center', height: 26 }}>
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg"
                alt="Visa"
                style={{ height: 14, width: 'auto', display: 'block' }}
                loading="lazy"
              />
            </div>
            <div style={{ background: '#fff', borderRadius: 4, padding: '3px 6px', display: 'flex', alignItems: 'center', height: 26 }}>
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg"
                alt="Mastercard"
                style={{ height: 18, width: 'auto', display: 'block' }}
                loading="lazy"
              />
            </div>
            <div style={{ background: '#fff', borderRadius: 4, padding: '3px 8px', display: 'flex', alignItems: 'center', height: 26 }}>
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                alt="PayPal"
                style={{ height: 16, width: 'auto', display: 'block' }}
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Security badges */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pb-3 mb-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
            <img
              src="https://www.cloudflare.com/favicon.ico"
              alt="Cloudflare"
              style={{ height: 14, width: 14 }}
              loading="lazy"
            />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {isFr ? 'Protégé par Cloudflare' : 'Protected by Cloudflare'}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>🔒 SSL 256-bit</span>
        </div>

        {/* Copyright */}
        <p className="text-center px-2" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          © {currentYear} {COMPANY_CONTACT.legalName} — {isFr ? 'Tous droits réservés' : 'All rights reserved'}
        </p>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
