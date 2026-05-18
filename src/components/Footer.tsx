import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { language } = useLanguage();
  const currentYear = new Date().getFullYear();
  const isFr = language === "fr";

  const linkStyle: React.CSSProperties = {
    color: "#666",
    fontSize: 13,
    textDecoration: "none",
    transition: "color 0.2s",
    lineHeight: 1.8,
  };

  const headingStyle: React.CSSProperties = {
    color: "white",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    marginBottom: 16,
  };

  const services = [
    { label: isFr ? "Internet haute vitesse" : "High-speed Internet", to: "/internet" },
    { label: isFr ? "Télévision" : "Television", to: "/tv" },
    { label: "Mobile", to: "/mobile" },
    { label: isFr ? "Comparer les forfaits" : "Compare Plans", to: "/compare" },
    { label: isFr ? "Carte de couverture" : "Coverage Map", to: "/couverture" },
    { label: isFr ? "Programme de parrainage" : "Refer a Friend", to: "/parrainage" },
    { label: isFr ? "Nos équipements" : "Our Equipment", to: "/frais-possibles" },
    { label: isFr ? "Commander" : "Order Now", to: "/commander" },
  ];

  const support = [
    { label: isFr ? "Centre de support" : "Support Center", to: "/support" },
    { label: "FAQ", to: "/faq" },
    { label: isFr ? "Activation WiFi" : "WiFi Activation", to: "/portail" },
    { label: isFr ? "Terminal Nivra TV" : "Nivra TV Terminal", to: "/support" },
    { label: isFr ? "Suivre ma commande" : "Track Order", to: "/track-order" },
    { label: isFr ? "Test de vitesse" : "Speed Test", to: "/test-vitesse" },
    { label: isFr ? "Nous contacter" : "Contact Us", to: "/contact" },
  ];

  return (
    <footer
      ref={ref}
      role="contentinfo"
      style={{ background: "#0A0A0A", borderTop: "1px solid #222" }}
      className="text-white"
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 24px 32px" }}>
        {/* 4-column grid */}
        <div
          className="footer-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 48,
          }}
        >
          {/* Column 1 — Brand */}
          <div>
            <div
              style={{
                color: "white",
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.5px",
                lineHeight: 1,
              }}
            >
              NIVRA
            </div>
            <div
              style={{
                color: "#7C3AED",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                marginTop: 4,
                marginBottom: 16,
              }}
            >
              Telecom
            </div>
            <p style={{ color: "#666", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              {isFr
                ? "Fournisseur Internet et TV sans contrat au Québec. Premier mois gratuit. Sans vérification de crédit."
                : "Internet & TV provider without contract in Quebec. First month free. No credit check."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              {/* Facebook */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                style={{
                  width: 32,
                  height: 32,
                  background: "#1a1a1a",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#7C3AED")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z" />
                </svg>
              </a>
              {/* Instagram */}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                style={{
                  width: 32,
                  height: 32,
                  background: "#1a1a1a",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#7C3AED")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="18" cy="6" r="1" fill="white" />
                </svg>
              </a>
              {/* TikTok */}
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                style={{
                  width: 32,
                  height: 32,
                  background: "#1a1a1a",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#7C3AED")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#1a1a1a")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.45a8.16 8.16 0 0 0 4.77 1.52V6.55a4.85 4.85 0 0 1-1.84-.13Z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2 — Services */}
          <div>
            <h3 style={headingStyle}>{isFr ? "Nos services" : "Our Services"}</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {services.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  style={linkStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Column 3 — Support */}
          <div>
            <h3 style={headingStyle}>{isFr ? "Aide & Support" : "Help & Support"}</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {support.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  style={linkStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Column 4 — Payments & Security */}
          <div>
            <h3 style={headingStyle}>{isFr ? "Paiements & Sécurité" : "Payments & Security"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Visa */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "#1A1F71",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 11,
                    padding: "5px 8px",
                    borderRadius: 4,
                    letterSpacing: 1,
                    fontFamily: "Arial, sans-serif",
                    minWidth: 44,
                    textAlign: "center",
                    lineHeight: 1,
                  }}
                >
                  VISA
                </div>
                <span style={{ color: "#666", fontSize: 12 }}>
                  {isFr ? "Visa accepté" : "Visa accepted"}
                </span>
              </div>

              {/* Mastercard */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 4,
                    padding: "3px 6px",
                    minWidth: 44,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="32" height="20" viewBox="0 0 36 22" style={{ flexShrink: 0, display: "block" }} aria-label="Mastercard">
                    <circle cx="14" cy="11" r="11" fill="#EB001B"/>
                    <circle cx="22" cy="11" r="11" fill="#F79E1B"/>
                    <path d="M18 4.8a11 11 0 0 1 0 12.4A11 11 0 0 1 18 4.8z" fill="#FF5F00"/>
                  </svg>
                </div>
                <span style={{ color: "#666", fontSize: 12 }}>
                  {isFr ? "Mastercard accepté" : "Mastercard accepted"}
                </span>
              </div>

              {/* PayPal */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 4,
                    padding: "3px 6px",
                    minWidth: 44,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                    alt="PayPal"
                    style={{ height: 12, width: "auto", display: "block" }}
                    loading="lazy"
                  />
                </div>
                <span style={{ color: "#666", fontSize: 12 }}>
                  {isFr ? "PayPal accepté" : "PayPal accepted"}
                </span>
              </div>

              {/* Cloudflare */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <svg width="20" height="20" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                  <circle cx="50" cy="50" r="50" fill="#F38020" />
                  <path
                    d="M67 38C65 30 58 25 50 25C43 25 37 29 34 35C29 35 25 39 25 44C25 49 29 53 34 53H66C71 53 75 49 75 44C75 40 71 37 67 38Z"
                    fill="white"
                  />
                </svg>
                <span style={{ color: "#666", fontSize: 12 }}>
                  {isFr ? "Protégé par Cloudflare" : "Protected by Cloudflare"}
                </span>
              </div>

              {/* SSL */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span style={{ color: "#666", fontSize: 12 }}>
                  {isFr ? "Chiffrement SSL 256-bit" : "SSL 256-bit Encryption"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid #1a1a1a",
            marginTop: 48,
            paddingTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
          className="footer-bottom"
        >
          <div
            className="footer-bottom-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <p style={{ color: "#555", fontSize: 12, margin: 0 }}>
              © {currentYear} {COMPANY_CONTACT.legalName} —{" "}
              {isFr ? "Tous droits réservés" : "All rights reserved"} · Québec, Canada
            </p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { label: isFr ? "Conditions d'utilisation" : "Terms of Use", to: "/conditions-de-service" },
                { label: isFr ? "Termes et conditions" : "Terms and Conditions", to: "/terms-and-conditions" },
                { label: isFr ? "Politique de confidentialité" : "Privacy Policy", to: "/politique-de-confidentialite" },
                { label: isFr ? "Garantie 30 jours" : "30-day Guarantee", to: "/garantie" },
                { label: "Loi 25", to: "/confidentialite-loi25" },
                { label: isFr ? "Frais possibles" : "Possible Fees", to: "/frais-possibles" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{ color: "#555", fontSize: 12, textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 32px !important;
          }
          .footer-bottom-row {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
        @media (max-width: 480px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
