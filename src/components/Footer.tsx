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

  const linkStyle = { color: 'rgba(255,255,255,0.55)', fontSize: 13 };

  return (
    <footer ref={ref} style={{ background: '#111111', marginTop: 0, paddingBottom: 20 }} className="text-white" role="contentinfo">
      <div className="max-w-[1100px] mx-auto px-5 sm:px-6" style={{ paddingTop: 32 }}>
        {/* Logo + tagline */}
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <LogoIcon size={28} />
          <div className="text-center">
            <span className="font-bold text-base text-white">Nivra</span>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              {isFr ? "Internet et TV sans contrat au Québec" : "Internet & TV without contract in Quebec"}
            </p>
          </div>
        </div>

        {/* Links row 1 */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1" style={{ marginBottom: 4 }}>
          {linksRow1.map(link => (
            <Link key={link.href} to={link.href} className="hover:text-white transition-colors" style={linkStyle}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Links row 2 */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-4">
          {linksRow2.map(link => (
            <Link key={link.href} to={link.href} className="hover:text-white transition-colors" style={linkStyle}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Payment + Security — single row */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-3 mb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{isFr ? 'Paiements acceptés:' : 'Accepted payments:'}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 700, background: '#1A1F71', padding: '2px 6px', borderRadius: 3 }}>VISA</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 700, background: '#EB001B', padding: '2px 6px', borderRadius: 3 }}>MC</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{isFr ? 'Traité par PayPal — aucun compte requis' : 'Processed by PayPal — no account required'}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>🔒 SSL 256-bit</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>🛡 Cloudflare</span>
        </div>

        {/* Copyright */}
        <p className="text-center" style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          © {currentYear} {COMPANY_CONTACT.legalName} — {isFr ? 'Tous droits réservés' : 'All rights reserved'}
        </p>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
