import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, Wifi, Shield, Zap, Activity } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";
import { PhotoBg } from "@/components/PhotoBg";

const MUTED = "rgba(255,255,255,0.38)";

const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    style={{ color: MUTED, fontSize:13.5, textDecoration:"none", lineHeight:2.1, display:"block", transition:"color 0.15s" }}
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
    { label: isFr ? "Internet haute vitesse" : "High-speed Internet",  to: "/internet" },
    { label: isFr ? "Télévision" : "Television",                        to: "/tv" },
    { label: "Mobile",                                                   to: "/mobile" },
    { label: "Streaming",                                                to: "/streaming" },
    { label: isFr ? "Catalogue de téléphones" : "Phone Catalog",        to: "/telephones" },
    { label: isFr ? "Comparer les forfaits" : "Compare Plans",          to: "/compare" },
    { label: isFr ? "Grille des canaux" : "Channel Guide",              to: "/grille-canaux" },
    { label: isFr ? "Carte de couverture" : "Coverage Map",             to: "/couverture" },
    { label: isFr ? "Programme de parrainage" : "Refer a Friend",       to: "/parrainage" },
    { label: isFr ? "Vérifier mon numéro" : "Check My Number",          to: "/verifier-mon-numero" },
    { label: isFr ? "Commander" : "Order Now",                          to: "/commander" },
  ];

  const support = [
    { label: isFr ? "Centre d'aide" : "Help Center",              to: "/aide" },
    { label: isFr ? "État des services" : "Service Status",        to: "/status" },
    { label: "FAQ",                                                 to: "/faq" },
    { label: isFr ? "Test de vitesse" : "Speed Test",              to: "/test-vitesse" },
    { label: isFr ? "Suivre ma commande" : "Track Order",          to: "/track-order" },
    { label: isFr ? "Nous contacter" : "Contact Us",               to: "/contact" },
    { label: isFr ? "Soumettre une plainte" : "Submit Complaint",  to: "/plainte" },
    { label: isFr ? "Sécurité anti-fraude" : "Security & Fraud",  to: "/securite-anti-fraude" },
  ];

  const company = [
    { label: isFr ? "À propos" : "About Us",     to: "/a-propos" },
    { label: isFr ? "Carrières" : "Careers",     to: "/emplois" },
    { label: "Presse",                            to: "/presse" },
    { label: isFr ? "Mon compte" : "My Account", to: "/portal" },
  ];

  const legal = [
    { label: isFr ? "Conditions d'utilisation" : "Terms of Use",        to: "/conditions-de-service" },
    { label: isFr ? "Politique de confidentialité" : "Privacy Policy",  to: "/politique-de-confidentialite" },
    { label: isFr ? "Garantie 30 jours" : "30-day Guarantee",          to: "/garantie" },
    { label: "Loi 25",                                                   to: "/confidentialite-loi25" },
    { label: isFr ? "Frais possibles" : "Possible Fees",                to: "/frais-possibles" },
    { label: isFr ? "Conformité CRTC" : "CRTC Compliance",             to: "/conformite-crtc" },
    { label: isFr ? "Pratiques réseau" : "Network Practices",           to: "/pratiques-reseau" },
    { label: isFr ? "Utilisation acceptable" : "Acceptable Use",        to: "/politique-utilisation-acceptable" },
    { label: isFr ? "Portabilité" : "Number Portability",              to: "/portabilite-numero" },
    { label: isFr ? "Débit préautorisé" : "Pre-Auth Debit",            to: "/accord-preautorise-debit" },
    { label: isFr ? "Niveaux de service" : "Service Levels",            to: "/niveaux-de-service" },
    { label: isFr ? "Remboursement" : "Refund Policy",                  to: "/refund-policy" },
    { label: isFr ? "Modalités de paiement" : "Payment Terms",         to: "/modalites-paiement" },
    { label: isFr ? "Accessibilité" : "Accessibility",                 to: "/accessibilite" },
  ];

  const footerStats = [
    { val:"940",   unit:"Mbps",   label: isFr ? "Vitesse max" : "Max speed",        icon: Zap,      color:"#A78BFA" },
    { val:"99.9",  unit:"%",      label: isFr ? "Uptime réseau" : "Network uptime",  icon: Activity, color:"#10B981" },
    { val:"22+",   unit:"",       label: isFr ? "Villes couvertes" : "Cities",       icon: Wifi,     color:"#06B6D4" },
    { val:"0$",    unit:"",       label: isFr ? "Frais d'installation" : "Setup fee", icon: Shield,   color:"#FBBF24" },
  ];

  return (
    <footer
      ref={ref}
      role="contentinfo"
      style={{ background:"linear-gradient(180deg, #060612 0%, #020209 100%)", borderTop:"1px solid rgba(124,58,237,0.2)", position:"relative", overflow:"hidden" }}
      className="text-white"
    >
      <style>{`
        @keyframes footer-pulse {
          0%,100% { opacity:.8; transform:scale(1); }
          50%      { opacity:1; transform:scale(1.15); }
        }
      `}</style>

      {/* Earth from space — city lights, global scale, beautiful closing visual */}
      <PhotoBg url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80" opacity={0.11} filter="saturate(0.6) brightness(0.65)" position="center center" />

      {/* Top accent glow line */}
      <div aria-hidden style={{ position:"absolute", top:0, left:"10%", right:"10%", height:1, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.7), rgba(6,182,212,0.5), rgba(124,58,237,0.7), transparent)", pointerEvents:"none", zIndex:1 }} />
      <div aria-hidden style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:600, height:300, background:"radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)", pointerEvents:"none" }} />

      {/* Pre-footer stats strip */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(0,0,0,0.3)" }}>
        <div style={{ maxWidth:1280, margin:"0 auto", padding:"24px 24px" }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {footerStats.map(({ val, unit, label, icon:Icon, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div style={{ width:36, height:36, borderRadius:10, background:`${color}14`, border:`1px solid ${color}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:18, lineHeight:1, letterSpacing:"-0.5px", color:"#fff" }}>
                    {val}<span style={{ color, fontSize:14 }}>{unit}</span>
                  </div>
                  <div style={{ color:"rgba(255,255,255,0.35)", fontSize:11, fontFamily:"'JetBrains Mono', monospace", marginTop:2 }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1280, margin:"0 auto", padding:"52px 24px 28px" }}>

        {/* Main grid */}
        <div className="footer-grid" style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 1fr", gap:"40px 48px" }}>

          {/* Col 1 — Brand */}
          <div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:28, letterSpacing:"-1.5px", lineHeight:1, color:"#fff" }}>NIVRA</div>
              <div style={{ fontFamily:"'JetBrains Mono', monospace", color:"#A78BFA", fontSize:10, fontWeight:700, letterSpacing:"4px", textTransform:"uppercase", marginTop:2 }}>TELECOM</div>
            </div>

            {/* Network status badge */}
            <div className="flex items-center gap-2 mb-4" style={{ background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:999, padding:"6px 12px", width:"fit-content" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#10B981", display:"block", animation:"footer-pulse 2s ease-in-out infinite" }} />
              <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#34D399", fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>
                {isFr ? "Réseau opérationnel" : "Network operational"}
              </span>
            </div>

            <p style={{ color:"rgba(255,255,255,0.45)", fontSize:13, lineHeight:1.7, marginBottom:16, maxWidth:240 }}>
              {isFr
                ? "Fournisseur Internet et TV sans contrat au Québec. Prix honnêtes, service local, infrastructure fibre XGS-PON."
                : "No-contract Internet & TV in Quebec. Honest prices, local service, XGS-PON fiber infrastructure."}
            </p>

            <a
              href={`mailto:${COMPANY_CONTACT.supportEmail}`}
              style={{ display:"inline-flex", alignItems:"center", gap:7, color:"#A78BFA", fontSize:13, textDecoration:"none", transition:"color .15s", marginBottom:20 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C4B5FD")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#A78BFA")}
            >
              <Mail className="w-3.5 h-3.5" />
              {COMPANY_CONTACT.supportEmail}
            </a>

            {/* Social icons */}
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {[
                { label:"Facebook",  href:"https://facebook.com",  path:<path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z" fill="white" /> },
                { label:"Instagram", href:"https://instagram.com", path:<><rect x="2" y="2" width="20" height="20" rx="5" stroke="white" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" fill="none"/><circle cx="17.5" cy="6.5" r="1.5" fill="white"/></> },
                { label:"TikTok",    href:"https://tiktok.com",    path:<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.45a8.16 8.16 0 0 0 4.77 1.52V6.55a4.85 4.85 0 0 1-1.84-.13Z" fill="white" /> },
              ].map(({ label, href, path }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  style={{ width:34, height:34, borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .18s, border-color .18s, transform .18s", flexShrink:0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background="#7C3AED"; e.currentTarget.style.borderColor="#7C3AED"; e.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"; e.currentTarget.style.transform="none"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24">{path}</svg>
                </a>
              ))}
            </div>

            {/* Trust badges */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {[
                { label:"SSL 256-bit", color:"#10B981", border:"rgba(16,185,129,0.25)" },
                { label:"Visa / MC",   color:"#6B7280", border:"rgba(107,114,128,0.25)" },
                { label:"Québec 🍁",   color:"#A78BFA", border:"rgba(167,139,250,0.25)" },
                { label:"CRTC ✓",      color:"#06B6D4", border:"rgba(6,182,212,0.25)" },
              ].map(({ label, color, border }) => (
                <span key={label} style={{ fontSize:10, fontWeight:700, fontFamily:"'JetBrains Mono', monospace", color, background:`${color}0A`, border:`1px solid ${border}`, borderRadius:6, padding:"4px 9px", letterSpacing:"0.05em" }}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Col 2 — Services */}
          <div>
            <h3 style={{ color:"rgba(255,255,255,0.6)", fontSize:10, fontWeight:700, letterSpacing:"2px", textTransform:"uppercase", marginBottom:16, fontFamily:"'JetBrains Mono', monospace" }}>
              {isFr ? "Nos services" : "Our Services"}
            </h3>
            {services.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </div>

          {/* Col 3 — Support */}
          <div>
            <h3 style={{ color:"rgba(255,255,255,0.6)", fontSize:10, fontWeight:700, letterSpacing:"2px", textTransform:"uppercase", marginBottom:16, fontFamily:"'JetBrains Mono', monospace" }}>
              {isFr ? "Aide & Support" : "Help & Support"}
            </h3>
            {support.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </div>

          {/* Col 4 — Company + CTA */}
          <div>
            <h3 style={{ color:"rgba(255,255,255,0.6)", fontSize:10, fontWeight:700, letterSpacing:"2px", textTransform:"uppercase", marginBottom:16, fontFamily:"'JetBrains Mono', monospace" }}>
              {isFr ? "Entreprise" : "Company"}
            </h3>
            {company.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}

            {/* Mini CTA */}
            <div style={{ marginTop:24, background:"linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.06) 100%)", border:"1px solid rgba(124,58,237,0.25)", borderRadius:14, padding:"16px 14px" }}>
              <p style={{ color:"rgba(255,255,255,0.65)", fontSize:12, lineHeight:1.5, marginBottom:10, fontFamily:"'Space Grotesk', sans-serif" }}>
                {isFr ? "Prêt à vous connecter ?" : "Ready to connect?"}
              </p>
              <Link to="/commander" className="flex items-center gap-1.5 font-bold text-white"
                style={{ fontSize:12, textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", background:"linear-gradient(135deg, #7C3AED, #6D28D9)", borderRadius:8, padding:"8px 12px", width:"fit-content", boxShadow:"0 4px 12px rgba(124,58,237,0.35)" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow="0 6px 20px rgba(124,58,237,0.5)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow="0 4px 12px rgba(124,58,237,0.35)"; }}
              >
                {isFr ? "Commander" : "Order now"} <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", marginTop:44, paddingTop:20 }} className="footer-bottom">
          <div className="footer-bottom-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <p style={{ color:"rgba(255,255,255,0.28)", fontSize:12, margin:0, fontFamily:"'JetBrains Mono', monospace" }}>
                © {currentYear} {COMPANY_CONTACT.legalName}
              </p>
              <span style={{ color:"rgba(255,255,255,0.1)", fontSize:12 }}>·</span>
              <p style={{ color:"rgba(255,255,255,0.2)", fontSize:12, margin:0 }}>
                {isFr ? "Tous droits réservés · Québec, Canada 🍁" : "All rights reserved · Quebec, Canada 🍁"}
              </p>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 14px" }}>
              {legal.map((l) => (
                <Link key={l.to} to={l.to}
                  style={{ color:"rgba(255,255,255,0.24)", fontSize:11.5, textDecoration:"none", transition:"color .15s", fontFamily:"'JetBrains Mono', monospace" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.24)")}
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
          .footer-bottom-row { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
        }
      `}</style>
    </footer>
  );
});

Footer.displayName = "Footer";
export default Footer;
