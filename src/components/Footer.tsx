import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";
import { LogoIcon } from "@/components/brand";

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { language } = useLanguage();
  const currentYear = new Date().getFullYear();
  const isFr = language === 'fr';

  const links = [
    { label: isFr ? "Forfaits" : "Plans", href: "/forfaits" },
    { label: "Contact", href: "/contact" },
    { label: "FAQ", href: "/aide" },
    { label: isFr ? "État des services" : "System Status", href: "/status" },
    { label: isFr ? "Confidentialité" : "Privacy", href: "/privacy-policy" },
    { label: isFr ? "Conditions" : "Terms", href: "/conditions-de-service" },
    { label: isFr ? "Conformité CRTC" : "CRTC Compliance", href: "/conformite-crtc" },
  ];

  return (
    <footer ref={ref} style={{ background: '#0D0D0D', marginTop: 0 }} className="text-white" data-testid="footer" role="contentinfo">
      <div className="container mx-auto px-4 sm:px-6 py-10 max-w-[1200px]">
        {/* ROW 1 — Logo + tagline */}
        <div className="flex items-center gap-3 mb-6">
          <LogoIcon size={32} />
          <div>
            <span className="font-bold text-lg text-white">Nivra</span>
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {isFr ? "Internet et TV sans contrat au Québec" : "Internet & TV without contract in Quebec"}
            </p>
          </div>
        </div>

        {/* ROW 2 — All links */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-6">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="transition-colors text-[13px]"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* ROW 3 — Payment + Security */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-3">
            <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {isFr ? "Paiements:" : "Payments:"}
            </span>
            {['VISA', 'MC', 'Interac', 'PayPal'].map(p => (
              <span key={p} className="text-[11px] font-semibold px-2 py-0.5" style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4 }}>
                {p}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>🔒 SSL 256-bit</span>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>🛡 Cloudflare WAF</span>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>✓ Stripe</span>
          </div>
        </div>

        {/* ROW 4 — Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            © {currentYear} {COMPANY_CONTACT.legalName}
          </p>
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            🔒 SSL • Cloudflare
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
