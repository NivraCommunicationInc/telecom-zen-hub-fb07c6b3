import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";

const MUTED = "rgba(255,255,255,0.38)";

const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    style={{ color: MUTED, fontSize: 13.5, textDecoration: "none", lineHeight: 2.1, display: "block", transition: "color 0.15s" }}
    onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
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
    { label: isFr ? "Centre d'aide" : "Help Center", to: "/aide" },
    { label: isFr ? "État des services" : "Service Status", to: "/status" },
    { label: "FAQ", to: "/faq" },
    { label: isFr ? "Test de vitesse" : "Speed Test", to: "/test-vitesse" },
    { label: isFr ? "Suivre ma commande" : "Track Order", to: "/track-order" },
    { label: isFr ? "Nous contacter" : "Contact Us", to: "/contact" },
    { label: isFr ? "Soumettre une plainte" : "Submit Complaint", to: "/plainte" },
  ];

  const company = [
    { label: isFr ? "À propos" : "About Us", to: "/a-propos" },
    { label: isFr ? "Carrières" : "Careers", to: "/emplois" },
    { label: "Presse", to: "/presse" },
    { label: isFr ? "Portail client" : "Client Portal", to: "/portal" },
    { label: isFr ? "Mon compte" : "My Account", to: "/portal" },
  ];

  const legal = [
    { label: isFr ? "Conditions d'utilisation" : "Terms of Use", to: "/conditions-de-service" },
    { label: isFr ? "Politique de confidentialité" : "Privacy Policy", to: "/politique-de-confidentialite" },
    { label: isFr ? "Garantie 30 jours" : "30-day Guarantee", to: "/garantie" },
    { label: "Loi 25", to: "/confidentialite-loi25" },
    { label: isFr ? "Frais possibles" : "Possible Fees", to: "/frais-possibles" },
  ];

  return (
    <footer
      ref={ref}
      role="contentinfo"
      style={{ background: "linear-gradient(180deg, #050510 0%, #020209 100%)", borderTop: "1px solid rgba(124,58,237,0.2)", position: "relative", overflow: "hidden" }}
      className="text-white"
    >
      {/* Top glow line */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.6), rgba(6,182,212,0.4), rgba(124,58,237,0.6), transparent)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 500, height: 250, background: "radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 24px 28px" }}>

        {/* Main grid */}
        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: "40px 48px" }}>

          {/* Col 1 — Brand */}
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "-1px", lineHeight: 1, color: "#fff" }}>NIVRA</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 10, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", marginTop: 2 }}>TELECOM</div>
            </div>

            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.65, marginBottom: 18, maxWidth: 240 }}>
              {isFr
                ? "Fournisseur Internet et TV sans contrat au Québec. Prix honnêtes, service local."
                : "No-contract Internet & TV in Quebec. Honest prices, local service."}
            </p>

            {/* Contact */}
            <a href={`mailto:${COMPANY_CONTACT.supportEmail}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#A78BFA", fontSize: 13, textDecoration: "none", transition: "color .15s", marginBottom: 20 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C4B5FD")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#A78BFA")}
            >
              <Mail className="w-3.5 h-3.5" />
              {COMPANY_CONTACT.supportEmail}
            </a>

            {/* Social icons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[
                { label: "Facebook", href: "https://facebook.com", path: <path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z" fill="white" /> },
                { label: "Instagram", href: "https://instagram.com", path: <><rect x="2" y="2" width="20" height="20" rx="5" stroke="white" strokeWidth="2" fill="none" /><circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" fill="none" /><circle cx="17.5" cy="6.5" r="1.5" fill="white" /></> },
                { label: "TikTok", href: "https://tiktok.com", path: <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.45a8.16 8.16 0 0 0 4.77 1.52V6.55a4.85 4.85 0 0 1-1.84-.13Z" fill="white" /> },
              ].map(({ label, href, path }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .18s, border-color .18s", flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#7C3AED"; e.currentTarget.style.borderColor = "#7C3AED"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24">{path}</svg>
                </a>
              ))}
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "SSL 256-bit", color: "#10B981" },
                { label: "Visa / MC", color: "#6B7280" },
                { label: "QC, Canada", color: "#A78BFA" },
              ].map(({ label, color }) => (
                <span key={label} style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px", letterSpacing: "0.05em" }}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Col 2 — Services */}
          <div>
            <h3 style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}>
              {isFr ? "Nos services" : "Our Services"}
            </h3>
            {services.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </div>

          {/* Col 3 — Support */}
          <div>
            <h3 style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}>
              {isFr ? "Aide & Support" : "Help & Support"}
            </h3>
            {support.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </div>

          {/* Col 4 — Company */}
          <div>
            <h3 style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}>
              {isFr ? "Entreprise" : "Company"}
            </h3>
            {company.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(124,58,237,0.12)", marginTop: 40, paddingTop: 20 }} className="footer-bottom">
          <div className="footer-bottom-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: 0 }}>
              © {currentYear} {COMPANY_CONTACT.legalName} — {isFr ? "Tous droits réservés" : "All rights reserved"} · Québec, Canada
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
              {legal.map((l) => (
                <Link key={l.to} to={l.to}
                  style={{ color: "rgba(255,255,255,0.28)", fontSize: 12, textDecoration: "none", transition: "color .15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
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
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 640px) {
          .footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .footer-bottom-row { flex-direction: column !important; gap: 16px !important; }
        }
      `}</style>
    </footer>
  );
});

Footer.displayName = "Footer";
export default Footer;
