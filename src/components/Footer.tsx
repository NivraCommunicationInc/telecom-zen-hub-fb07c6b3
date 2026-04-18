import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { language } = useLanguage();
  const currentYear = new Date().getFullYear();
  const isFr = language === 'fr';

  const navLinks = [
    { label: isFr ? 'Accueil' : 'Home', to: '/' },
    { label: isFr ? 'Forfaits' : 'Plans', to: '/forfaits' },
    { label: 'Internet', to: '/internet' },
    { label: 'TV', to: '/television' },
    { label: 'Support', to: '/support' },
    { label: isFr ? 'Garantie 30 jours' : '30-day Guarantee', to: '/garantie' },
    { label: 'Contact', to: '/contact' },
    { label: 'FAQ', to: '/aide' },
  ];

  const legalLinks = [
    { label: isFr ? 'Conditions' : 'Terms', to: '/conditions-de-service' },
    { label: isFr ? 'Confidentialité' : 'Privacy', to: '/privacy-policy' },
    { label: isFr ? 'Remboursement' : 'Refund', to: '/politique-remboursement' },
    { label: isFr ? 'Frais' : 'Fees', to: '/frais-possibles' },
    { label: 'CRTC', to: '/conformite-crtc' },
    { label: isFr ? 'Loi 25' : 'Law 25', to: '/confidentialite-loi25' },
    { label: isFr ? 'État des services' : 'System Status', to: '/status' },
  ];

  const linkBase: React.CSSProperties = {
    color: '#999',
    fontSize: 13,
    textDecoration: 'none',
    transition: 'color 0.2s',
  };

  return (
    <footer
      ref={ref}
      role="contentinfo"
      style={{ background: '#0A0A0A', borderTop: '1px solid #222' }}
      className="text-white"
    >
      {/* Main footer content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 32px' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">

          {/* Column 1 — Logo + tagline */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <div
              style={{
                color: 'white',
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '-0.5px',
              }}
            >
              NIVRA <span style={{ color: '#7C3AED' }}>TELECOM</span>
            </div>
            <p
              style={{
                color: '#666',
                fontSize: 12,
                lineHeight: 1.6,
                maxWidth: 220,
              }}
              className="text-center md:text-left"
            >
              {isFr
                ? 'Internet et TV sans contrat au Québec.'
                : 'Internet & TV without contract in Quebec.'}
            </p>
          </div>

          {/* Column 2 — Navigation links */}
          <div className="flex flex-col items-center md:items-start gap-2.5">
            <p
              style={{
                color: '#888',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Navigation
            </p>
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={linkBase}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#999')}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Column 3 — Legal + Payment + Security */}
          <div className="flex flex-col items-center md:items-end gap-5">
            {/* Legal links */}
            <div className="flex flex-col items-center md:items-end gap-2.5">
              <p
                style={{
                  color: '#888',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                {isFr ? 'Légal' : 'Legal'}
              </p>
              {legalLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  style={linkBase}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#999')}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Payment logos */}
            <div className="flex flex-col items-center md:items-end gap-2.5">
              <p
                style={{
                  color: '#888',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  marginBottom: 2,
                }}
              >
                {isFr ? 'Paiements acceptés' : 'Accepted payments'}
              </p>
              <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-end">
                {/* Visa */}
                <div
                  style={{
                    background: '#1A1F71',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: 12,
                    padding: '5px 10px',
                    borderRadius: 4,
                    letterSpacing: 1,
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: 1,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  VISA
                </div>
                {/* Mastercard */}
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 4,
                    padding: '3px 6px',
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg"
                    alt="Mastercard"
                    style={{ height: 16, width: 'auto', display: 'block' }}
                    loading="lazy"
                  />
                </div>
                {/* PayPal */}
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 4,
                    padding: '3px 8px',
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                    alt="PayPal"
                    style={{ height: 14, width: 'auto', display: 'block' }}
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Security badges */}
            <div className="flex flex-col items-center md:items-end gap-1.5">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                  <circle cx="50" cy="50" r="50" fill="#F38020" />
                  <path
                    d="M67 38C65 30 58 25 50 25C43 25 37 29 34 35C29 35 25 39 25 44C25 49 29 53 34 53H66C71 53 75 49 75 44C75 40 71 37 67 38Z"
                    fill="white"
                  />
                </svg>
                <span style={{ color: '#666', fontSize: 11 }}>
                  {isFr ? 'Protégé par Cloudflare' : 'Protected by Cloudflare'}
                </span>
              </div>
              <span style={{ color: '#555', fontSize: 11 }}>🔒 SSL 256-bit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar — copyright */}
      <div
        style={{
          borderTop: '1px solid #1a1a1a',
          padding: '16px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#555', fontSize: 11, margin: 0 }}>
          © {currentYear} {COMPANY_CONTACT.legalName} —{' '}
          {isFr ? 'Tous droits réservés' : 'All rights reserved'} · Québec, Canada
        </p>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;
