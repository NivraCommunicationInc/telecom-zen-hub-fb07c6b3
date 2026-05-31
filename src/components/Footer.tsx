import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";

const P = "#7C3AED";
const PE = "#A78BFA";
const BG = "#07070F";
const MUTED = "rgba(255,255,255,0.38)";
const HOVER_COLOR = "rgba(255,255,255,0.85)";

const SocialIcon = ({ href, label, children }: { href: string; label: string; children: React.ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0, cursor: "pointer" }}
    onMouseEnter={(e) => { e.currentTarget.style.background = P; e.currentTarget.style.borderColor = P; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.1)"; e.currentTarget.style.borderColor = "rgba(124,58,237,0.25)"; }}
  >
    {children}
  </a>
);

const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    style={{ color: MUTED, fontSize: 13.5, textDecoration: "none", lineHeight: 2, display: "block", transition: "color 0.18s" }}
    onMouseEnter={(e) => (e.currentTarget.style.color = HOVER_COLOR)}
    onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
  >
    {children}
  </Link>
);

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { language } = useLanguage();
  const currentYear = new Date().getFullYear();
  const isFr = language === "fr";

  const services = [
    { label: isFr ? "Internet haute vitesse" : "High-speed Internet", to: "/internet" },
    { label: isFr ? "Télévision" : "Television", to: "/tv" },
    { label: "Mobile", to: "/mobile" },
    { label: "Streaming", to: "/streaming" },
    { label: isFr ? "Comparer les forfaits" : "Compare Plans", to: "/compare" },
    { label: isFr ? "Carte de couverture" : "Coverage Map", to: "/couverture" },
    { label: isFr ? "Programme de parrainage" : "Refer a Friend", to: "/parrainage" },
    { label: isFr ? "Commander" : "Order Now", to: "/commander" },
  ];

  const support = [
    { label: isFr ? "Centre de support" : "Support Center", to: "/support" },
    { label: isFr ? "Centre d'aide" : "Help Center", to: "/aide" },
    { label: isFr ? "État des services" : "Service Status", to: "/status" },
    { label: "FAQ", to: "/faq" },
    { label: isFr ? "Test de vitesse" : "Speed Test", to: "/test-vitesse" },
    { label: isFr ? "Suivre ma commande" : "Track Order", to: "/track-order" },
    { label: isFr ? "Nous contacter" : "Contact Us", to: "/contact" },
    { label: isFr ? "Soumettre une plainte" : "Submit complaint", to: "/plainte" },
  ];

  const company = [
    { label: isFr ? "À propos" : "About Us", to: "/a-propos" },
    { label: isFr ? "Carrières" : "Careers", to: "/emplois" },
    { label: "Presse", to: "/presse" },
    { label: isFr ? "Mon compte" : "My Account", to: "/portal" },
    { label: isFr ? "Portail client" : "Client Portal", to: "/portal" },
  ];

  const legal = [
    { label: isFr ? "Conditions d'utilisation" : "Terms of Use", to: "/conditions-de-service" },
    { label: isFr ? "Politique de confidentialité" : "Privacy Policy", to: "/politique-de-confidentialite" },
    { label: isFr ? "Garantie 30 jours" : "30-day Guarantee", to: "/garantie" },
    { label: "Loi 25", to: "/confidentialite-loi25" },
    { label: isFr ? "Frais possibles" : "Possible Fees", to: "/frais-possibles" },
    { label: isFr ? "Accessibilité" : "Accessibility", to: "/accessibilite" },
  ];

  return (
    <footer ref={ref} role="contentinfo" style={{ background: BG, borderTop: "1px solid rgba(124,58,237,0.12)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "72px 24px 0" }}>

        {/* Top: brand + columns */}
        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "300px 1fr 1fr 1fr", gap: 48, marginBottom: 56 }}>

          {/* Brand column */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <span className="font-extrabold text-white" style={{ fontSize: 26, letterSpacing: "-0.5px" }}>NIVRA</span>
              <span style={{ color: PE, fontSize: 13, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", marginLeft: 8 }}>Telecom</span>
            </div>
            <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.7, marginBottom: 20, maxWidth: 260 }}>
              {isFr
                ? "Fournisseur Internet et TV sans contrat au Québec. Prix honnêtes, service local, aucune surprise."
                : "No-contract Internet & TV in Quebec. Honest prices, local service, no surprises."}
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <SocialIcon href="https://facebook.com" label="Facebook">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z" /></svg>
              </SocialIcon>
              <SocialIcon href="https://instagram.com" label="Instagram">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="18" cy="6" r="1" fill="white" /></svg>
              </SocialIcon>
              <SocialIcon href="https://tiktok.com" label="TikTok">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.45a8.16 8.16 0 0 0 4.77 1.52V6.55a4.85 4.85 0 0 1-1.84-.13Z" /></svg>
              </SocialIcon>
            </div>
            {/* Payment badges */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { text: isFr ? "Visa accepté" : "Visa accepted", badge: <span style={{ background: "#1A1F71", color: "#fff", fontFamily: "Arial", fontWeight: 800, fontSize: 10, padding: "4px 8px", borderRadius: 3, letterSpacing: 1 }}>VISA</span> },
                { text: isFr ? "Mastercard accepté" : "Mastercard accepted", badge: <span style={{ display: "inline-flex", background: "#fff", borderRadius: 3, padding: "2px 4px" }}><svg width="28" height="18" viewBox="0 0 36 22"><circle cx="14" cy="11" r="11" fill="#EB001B"/><circle cx="22" cy="11" r="11" fill="#F79E1B"/><path d="M18 4.8a11 11 0 0 1 0 12.4A11 11 0 0 1 18 4.8z" fill="#FF5F00"/></svg></span> },
              ].map((item) => (
                <div key={item.text} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {item.badge}
                  <span style={{ color: MUTED, fontSize: 12 }}>{item.text}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <span style={{ color: MUTED, fontSize: 12 }}>{isFr ? "SSL 256-bit" : "SSL 256-bit"}</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 16 }}>{isFr ? "Nos services" : "Our Services"}</h3>
            {services.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </div>

          {/* Support */}
          <div>
            <h3 style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 16 }}>{isFr ? "Aide & Support" : "Help & Support"}</h3>
            {support.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </div>

          {/* Company */}
          <div>
            <h3 style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 16 }}>{isFr ? "Entreprise" : "Company"}</h3>
            {company.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(124,58,237,0.1)", paddingTop: 24, paddingBottom: 28 }}>
          <div className="footer-bottom-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, margin: 0 }}>
              © {currentYear} {COMPANY_CONTACT.legalName} — {isFr ? "Tous droits réservés" : "All rights reserved"} · Québec, Canada
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
              {legal.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textDecoration: "none", transition: "color 0.18s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .footer-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .footer-bottom-row { flex-direction: column !important; }
        }
      `}</style>
    </footer>
  );
});

Footer.displayName = "Footer";
export default Footer;
