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
    <footer ref={ref} style={{ background: '#111111', padding: '40px 0 20px', marginTop: 0 }} className="text-white" role="contentinfo">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 mb-8">
          <div className="flex justify-center md:justify-start md:flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <LogoIcon size={28} />
              <div className="text-center md:text-left">
                <span className="font-bold text-base text-white">Nivra</span>
                <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-[11px] md:text-xs">
                  {isFr ? "Internet et TV sans contrat au Québec" : "Internet & TV without contract in Quebec"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 md:flex-1">
            <div className="flex flex-wrap justify-center gap-x-3 md:gap-x-6 gap-y-2 text-[12px] md:text-[13px]">
              {linksRow1.map(link => (
                <Link key={link.href} to={link.href} className="hover:text-white transition-colors" style={linkStyle}>
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 md:gap-x-6 gap-y-2 text-[12px] md:text-[13px]">
              {linksRow2.map(link => (
                <Link key={link.href} to={link.href} className="hover:text-white transition-colors" style={linkStyle}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-3 md:flex-shrink-0">
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {isFr ? 'Paiements acceptés' : 'Accepted payments'}
            </span>
            <div className="flex items-center justify-center md:justify-end gap-3 flex-wrap">
              <div style={{ background: '#1A1F71', borderRadius: 4, padding: '4px 10px', display: 'flex', alignItems: 'center', height: 26 }}>
                <span style={{
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 13,
                  fontFamily: 'Arial, sans-serif',
                  letterSpacing: 1,
                  lineHeight: 1,
                }}>
                  VISA
                </span>
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
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-3 gap-y-1">
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
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20 }}>
          <p className="text-center px-2" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            © {currentYear} {COMPANY_CONTACT.legalName} — {isFr ? 'Tous droits réservés' : 'All rights reserved'}
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
