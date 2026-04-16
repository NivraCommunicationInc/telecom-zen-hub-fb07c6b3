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
      <div className="max-w-[1100px] mx-auto px-5 sm:px-6 py-6 sm:py-8">
        {/* ROW 1 — Logo + tagline */}
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <LogoIcon size={28} />
          <div className="text-center">
            <span className="font-bold text-base text-white">Nivra</span>
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {isFr ? "Internet et TV sans contrat au Québec" : "Internet & TV without contract in Quebec"}
            </p>
          </div>
        </div>

        {/* ROW 2 — All links in one line */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mb-4">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="transition-colors text-[13px] hover:text-white"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* ROW 3 — Payment + Security (single instance, no duplicates) */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            {['VISA', 'Mastercard', 'Interac'].map(p => (
              <span key={p} className="text-[11px] font-semibold px-2 py-0.5" style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4 }}>
                {p}
              </span>
            ))}
          </div>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>🔒 SSL 256-bit</span>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>🛡 Cloudflare</span>
        </div>

        {/* ROW 4 — Copyright only */}
        <p className="text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          © {currentYear} {COMPANY_CONTACT.legalName}
        </p>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
