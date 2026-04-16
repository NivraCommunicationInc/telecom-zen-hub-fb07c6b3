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
    <footer ref={ref} style={{ background: '#111111' }} className="text-white" data-testid="footer" role="contentinfo">
      <div className="container mx-auto px-4 sm:px-6 py-10 max-w-[1200px]">
        {/* ROW 1 — Logo + tagline */}
        <div className="flex items-center gap-3 mb-6">
          <LogoIcon size={32} />
          <div>
            <span className="font-bold text-lg text-white">Nivra</span>
            <p className="text-white/35 text-[13px]">
              {isFr ? "Internet et TV sans contrat au Québec" : "Internet & TV without contract in Quebec"}
            </p>
          </div>
        </div>

        {/* ROW 2 — All links in one compact row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-8">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-white/55 hover:text-white transition-colors text-[13px]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* ROW 3 — Copyright + SSL on same line */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-white/30 text-[12px]">
            © {currentYear} {COMPANY_CONTACT.legalName}
          </p>
          <p className="text-white/30 text-[12px]">
            🔒 SSL • Cloudflare
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
