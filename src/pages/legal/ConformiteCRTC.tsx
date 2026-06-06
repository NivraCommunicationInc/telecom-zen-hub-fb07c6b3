import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PhotoBg } from "@/components/PhotoBg";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";

const infoBox = {
  background: "rgba(6,182,212,0.07)",
  border: "1px solid rgba(6,182,212,0.22)",
  borderRadius: 10,
  padding: "24px 28px",
} as const;

const successBox = {
  background: "rgba(16,185,129,0.07)",
  border: "1px solid rgba(16,185,129,0.22)",
  borderRadius: 10,
  padding: "24px 28px",
} as const;

const section = { marginBottom: "2rem" } as const;
const h2 = { color: "#e2e8f0", fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.75rem" } as const;
const p = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.75rem" } as const;
const li = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.35rem" } as const;

export default function ConformiteCRTC() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1524508762098-a05572d88d92?auto=format&fit=crop&w=1920&q=80"
        opacity={0.11}
        filter="saturate(0.6) brightness(0.6)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <SEOHead
        title={isFr ? "Conformité réglementaire — Nivra Telecom" : "Regulatory Compliance — Nivra Telecom"}
        description={isFr
          ? "Nivra Telecom opère en conformité avec les règlements du CRTC, le Code Internet, le Code sans fil et la Loi 25."
          : "Nivra Telecom operates in compliance with CRTC regulations, Internet Code, Wireless Code and Law 25."
        }
      />
      <Header />

      <main className="pt-24 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#6366f1", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>CRTC · CPRST · Loi 25 · CASL</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            {isFr ? "Conformité réglementaire" : "Regulatory Compliance"}
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2.5rem" }}>
            {isFr ? "Dernière mise à jour : juin 2026" : "Last updated: June 2026"}
          </p>

          <div style={successBox} className="mb-8">
            <p style={{ color: "#34d399", fontWeight: 600, marginBottom: "0.5rem" }}>
              {isFr ? "Engagement Nivra Telecom" : "Nivra Telecom Commitment"}
            </p>
            <p style={p}>
              {isFr
                ? `${COMPANY_CONTACT.legalName} opère en conformité complète avec les règlements du CRTC, le Code sur les services Internet, le Code sur les services sans fil, la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE), et la Loi 25 du Québec.`
                : `${COMPANY_CONTACT.legalName} operates in full compliance with CRTC regulations, the Internet Code, the Wireless Code, PIPEDA, and Québec Law 25.`
              }
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>1. CRTC</h2>
            <p style={p}>
              {isFr
                ? "Le Conseil de la radiodiffusion et des télécommunications canadiennes (CRTC) réglemente les services de télécommunication au Canada. Nivra Telecom respecte l'ensemble des décisions, politiques et codes du CRTC applicables à notre gamme de services."
                : "The Canadian Radio-television and Telecommunications Commission (CRTC) regulates telecommunications in Canada. Nivra Telecom complies with all applicable CRTC decisions, policies, and codes."
              }
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}><a href="https://crtc.gc.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee" }}>crtc.gc.ca</a></li>
              <li style={li}>{isFr ? "Codes applicables : " : "Applicable codes: "}{CONTRACT_TERMS.regulatory.crtc.codes.join(", ")}</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>2. {isFr ? "Code sur les services Internet — Vos droits" : "Internet Code — Your Rights"}</h2>
            <div style={infoBox}>
              <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.75rem" }}>
                {isFr ? "Droits des clients (Code CRTC)" : "Customer Rights (CRTC Code)"}
              </p>
              <ul style={{ paddingLeft: "1.5rem" }}>
                <li style={li}>{isFr ? "Contrat clair et simplifié en langage accessible" : "Clear and simplified contract in accessible language"}</li>
                <li style={li}>{isFr ? "Préavis de 30 jours avant tout changement de prix ou de conditions matérielles" : "30-day notice before any price or material conditions change"}</li>
                <li style={li}>{isFr ? "Alertes de consommation de données à 75%, 90% et 100% de votre limite mensuelle" : "Data usage alerts at 75%, 90%, and 100% of your monthly cap"}</li>
                <li style={li}>{isFr ? "Résiliation sans frais excessifs (service prépayé : aucun frais de résiliation)" : "Cancellation without excessive fees (prepaid: no cancellation fees)"}</li>
                <li style={li}>{isFr ? "Accès à un processus de résolution de plaintes (CPRST)" : "Access to a complaint resolution process (CCTS)"}</li>
                <li style={li}>{isFr ? "Divulgation complète des pratiques de gestion du trafic Internet (ITMP)" : "Full disclosure of Internet Traffic Management Practices (ITMP)"}</li>
              </ul>
              <p style={{ ...p, marginTop: "1rem", marginBottom: 0 }}>
                {isFr ? "Voir nos " : "See our "}<Link to="/pratiques-reseau" style={{ color: "#22d3ee" }}>{isFr ? "Pratiques de gestion du trafic Internet" : "Internet Traffic Management Practices"}</Link>.
              </p>
            </div>
          </div>

          <div style={section}>
            <h2 style={h2}>3. {isFr ? "Code sur les services sans fil — Portabilité & Déverrouillage" : "Wireless Code — Portability & Unlocking"}</h2>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>{isFr ? "Transfert de numéro (portabilité) en maximum 2,5 jours ouvrables" : "Number transfer (portability) within maximum 2.5 business days"}</li>
              <li style={li}>{isFr ? "Déverrouillage d'appareil gratuit — tous les appareils Nivra sont déverrouillés par défaut" : "Free device unlocking — all Nivra devices are unlocked by default"}</li>
              <li style={li}>{isFr ? "Aucun contrat à terme — services 100% prépayés" : "No term contracts — 100% prepaid services"}</li>
              <li style={li}>{isFr ? "Conservation du numéro pendant 90 jours après expiration du service prépayé" : "Number held 90 days after prepaid service expiry"}</li>
            </ul>
            <p style={{ ...p, marginTop: "0.75rem" }}>
              {isFr ? "En savoir plus : " : "Learn more: "}<Link to="/portabilite-numero" style={{ color: "#22d3ee" }}>{isFr ? "Politique de portabilité des numéros" : "Number Portability Policy"}</Link>.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>4. {isFr ? "CPRST — Processus de plaintes" : "CCTS — Complaint Process"}</h2>
            <div style={infoBox}>
              <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.75rem" }}>
                {isFr ? "Commission des plaintes relatives aux services de télécom-télévision (CPRST)" : "Commission for Complaints for Telecom-television Services (CCTS)"}
              </p>
              <p style={p}>
                {isFr
                  ? "Si vous ne pouvez pas résoudre un problème avec nous, vous avez le droit de soumettre une plainte au CPRST — organisme indépendant et gratuit pour les consommateurs."
                  : "If you cannot resolve an issue with us, you have the right to file a complaint with the CCTS — a free, independent organization for consumers."
                }
              </p>
              <ul style={{ paddingLeft: "1.5rem" }}>
                <li style={li}><strong style={{ color: "#e2e8f0" }}>{isFr ? "Site web : " : "Website: "}</strong><a href={CONTRACT_TERMS.regulatory.ccts.website} target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee" }}>{CONTRACT_TERMS.regulatory.ccts.website}</a></li>
                <li style={li}><strong style={{ color: "#e2e8f0" }}>{isFr ? "Numéro de membre Nivra : " : "Nivra member number: "}</strong>{CONTRACT_TERMS.regulatory.ccts.memberNumber}</li>
                <li style={li}><strong style={{ color: "#e2e8f0" }}>{isFr ? "Description : " : "Description: "}</strong>{CONTRACT_TERMS.regulatory.ccts.description}</li>
              </ul>
              <p style={{ ...p, marginTop: "0.75rem", marginBottom: 0 }}>
                {isFr ? "Notre processus interne : " : "Our internal process: "}<Link to="/support-et-plaintes" style={{ color: "#22d3ee" }}>{isFr ? "Support et plaintes" : "Support and Complaints"}</Link>.
              </p>
            </div>
          </div>

          <div style={section}>
            <h2 style={h2}>5. {isFr ? "LPRPDE / Loi 25 — Vie privée" : "PIPEDA / Law 25 — Privacy"}</h2>
            <p style={p}>
              {isFr
                ? "Nous respectons la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) au niveau fédéral et la Loi 25 au niveau provincial (Québec). Un responsable de la protection des renseignements personnels est désigné."
                : "We comply with PIPEDA at the federal level and Law 25 at the provincial level (Québec). A Privacy Officer is designated."
              }
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>{isFr ? "Responsable : " : "Officer: "}</strong>{COMPANY_CONTACT.privacyOfficer}</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>{isFr ? "Courriel : " : "Email: "}</strong><a href={`mailto:${COMPANY_CONTACT.privacyOfficerEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.privacyOfficerEmail}</a></li>
            </ul>
            <p style={{ ...p, marginTop: "0.75rem" }}>
              <Link to="/politique-de-confidentialite" style={{ color: "#22d3ee" }}>{isFr ? "Politique de confidentialité complète →" : "Full Privacy Policy →"}</Link>
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>6. {isFr ? "CASL — Anti-pourriel" : "CASL — Anti-Spam"}</h2>
            <p style={p}>
              {isFr
                ? "Toutes nos communications commerciales électroniques respectent la Loi canadienne anti-pourriel (CASL). Nous recueillons votre consentement exprès avant tout envoi de courriel marketing, et chaque courriel inclut une option de désinscription fonctionnelle."
                : "All our commercial electronic messages comply with Canada's Anti-Spam Legislation (CASL). We collect express consent before sending marketing emails, and every email includes a functioning unsubscribe option."
              }
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>{isFr ? "Consentement exprès requis pour les courriels marketing" : "Express consent required for marketing emails"}</li>
              <li style={li}>{isFr ? "Désinscription honorée dans les 10 jours ouvrables" : "Unsubscribe honored within 10 business days"}</li>
              <li style={li}>{isFr ? "Adresse postale incluse dans chaque communication commerciale" : "Postal address included in every commercial communication"}</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>7. {isFr ? "Pages de conformité connexes" : "Related Compliance Pages"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                { label: isFr ? "Pratiques de gestion du trafic (ITMP)" : "Internet Traffic Management Practices", to: "/pratiques-reseau" },
                { label: isFr ? "Politique d'utilisation acceptable (AUP)" : "Acceptable Use Policy", to: "/politique-utilisation-acceptable" },
                { label: isFr ? "Portabilité des numéros" : "Number Portability", to: "/portabilite-numero" },
                { label: isFr ? "Accord de prélèvement automatique (PAD)" : "Pre-Authorized Debit Agreement", to: "/accord-preautorise-debit" },
                { label: isFr ? "Niveaux de service (SLA)" : "Service Level Agreement", to: "/niveaux-de-service" },
                { label: isFr ? "Confidentialité (Loi 25)" : "Privacy (Law 25)", to: "/confidentialite-loi25" },
              ].map((link) => (
                <Link key={link.to} to={link.to} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "12px 16px", color: "#22d3ee", textDecoration: "none", fontSize: "0.9rem", transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(6,182,212,0.4)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                >
                  {link.label} →
                </Link>
              ))}
            </div>
          </div>

          <div style={section}>
            <h2 style={h2}>{isFr ? "Contact réglementaire" : "Regulatory Contact"}</h2>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}><a href="mailto:legal@nivra-telecom.ca" style={{ color: "#22d3ee" }}>legal@nivra-telecom.ca</a></li>
              <li style={li}>{COMPANY_CONTACT.fullAddress}</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
