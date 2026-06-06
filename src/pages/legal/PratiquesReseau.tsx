import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PhotoBg } from "@/components/PhotoBg";
import { COMPANY_CONTACT } from "@/config/company";
import { Link } from "react-router-dom";

const infoBox = {
  background: "rgba(6,182,212,0.07)",
  border: "1px solid rgba(6,182,212,0.22)",
  borderRadius: 10,
  padding: "24px 28px",
} as const;

const warnBox = {
  background: "rgba(245,158,11,0.07)",
  border: "1px solid rgba(245,158,11,0.22)",
  borderRadius: 10,
  padding: "24px 28px",
} as const;

const section = { marginBottom: "2rem" } as const;
const h2 = { color: "#e2e8f0", fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.75rem" } as const;
const p = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.75rem" } as const;
const li = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.35rem" } as const;

export default function PratiquesReseau() {
  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1920&q=80"
        opacity={0.12}
        filter="saturate(0.6) brightness(0.6)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.10) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Header />

      <main className="pt-24 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#6366f1", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Conformité CRTC</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Pratiques de Gestion du Trafic Internet
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2.5rem" }}>
            Internet Traffic Management Practices (ITMP) — Divulgation CRTC obligatoire · Dernière mise à jour : juin 2026
          </p>

          <div style={infoBox} className="mb-8">
            <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Politique générale</p>
            <p style={p}>
              Nivra Telecom s'engage à offrir une expérience Internet ouverte et non discriminatoire. Nous appliquons
              des pratiques de gestion du trafic minimales, transparentes, et conformes aux exigences du CRTC
              (Décision de réglementation de la télécommunication CRTC 2009-657).
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>1. Objectif de la gestion du trafic</h2>
            <p style={p}>
              La gestion du trafic réseau vise à maintenir la qualité du service pour tous les utilisateurs,
              à prévenir les utilisations abusives, et à protéger l'intégrité du réseau. Nous n'utilisons pas
              ces pratiques à des fins commerciales ou concurrentielles.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>2. Pratiques de gestion économique (limites de données)</h2>
            <p style={p}>
              Certains forfaits Internet résidentiel incluent un plafond mensuel de données (Go). Lorsque vous
              approchez de votre limite :
            </p>
            <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.75rem" }}>
              <li style={li}>À <strong style={{ color: "#e2e8f0" }}>75 %</strong> — avis par courriel</li>
              <li style={li}>À <strong style={{ color: "#e2e8f0" }}>90 %</strong> — avis par courriel + notification dans le portail</li>
              <li style={li}>À <strong style={{ color: "#e2e8f0" }}>100 %</strong> — avis immédiat; frais de dépassement ou réduction de vitesse selon forfait</li>
            </ul>
            <p style={p}>
              Les détails de frais de dépassement sont disponibles sur la page{" "}
              <Link to="/frais-possibles" style={{ color: "#22d3ee" }}>Frais possibles</Link>.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>3. Gestion technique du trafic</h2>
            <p style={p}>
              Nous pouvons appliquer les mesures techniques suivantes dans des situations spécifiques :
            </p>
            <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.75rem" }}>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Limitation de vitesse (throttling)</strong> : Uniquement en cas de congestion exceptionnelle, de manière non discriminatoire entre les types de trafic légal.</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Priorisation d'urgence</strong> : Le trafic 911 et les communications d'urgence sont prioritaires en tout temps.</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Filtrage de sécurité</strong> : Blocage des communications malveillantes connues (malware, DDoS, spam) pour protéger l'ensemble du réseau.</li>
            </ul>
            <p style={p}>
              Nous ne bloquons ni ne dégradons le trafic légal basé sur sa source, destination, ou type d'application.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>4. Ce que nous ne faisons PAS</h2>
            <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.75rem" }}>
              <li style={li}>Nous ne bloquons pas les applications VoIP légales (Skype, FaceTime, WhatsApp, etc.)</li>
              <li style={li}>Nous ne dégradons pas les services de streaming vidéo légaux</li>
              <li style={li}>Nous ne ralentissons pas les réseaux privés virtuels (VPN) légaux</li>
              <li style={li}>Nous n'appliquons pas d'inspections approfondies des paquets (DPI) à des fins commerciales</li>
              <li style={li}>Nous ne discriminons pas entre les contenus de différents fournisseurs</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>5. Gestion des situations d'urgence réseau</h2>
            <p style={p}>
              En cas d'attaque DDoS, de panne majeure, ou d'événement menaçant la stabilité du réseau, nous nous
              réservons le droit d'appliquer temporairement des mesures de mitigation. Ces mesures sont levées dès
              que la situation est résolue. Les clients affectés sont informés dès que possible.
            </p>
          </div>

          <div style={warnBox} className="mb-8">
            <p style={{ color: "#fbbf24", fontWeight: 600, marginBottom: "0.5rem" }}>
              <span style={{ marginRight: "0.5rem" }}>⚠</span> Utilisation prohibée
            </p>
            <p style={{ color: "#94a3b8" }}>
              L'utilisation du réseau à des fins illégales, pour générer du spam, ou pour mener des attaques
              informatiques est strictement interdite et peut entraîner la suspension immédiate du service.
              Voir notre <Link to="/politique-utilisation-acceptable" style={{ color: "#fbbf24" }}>Politique d'utilisation acceptable</Link>.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>6. Plaintes et questions</h2>
            <p style={p}>
              Si vous croyez que nos pratiques de gestion du trafic vous affectent de façon injuste ou
              discriminatoire, contactez-nous :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Courriel : <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmail}</a></li>
              <li style={li}>Portail client : <a href={COMPANY_CONTACT.portalUrl} style={{ color: "#22d3ee" }}>nivra-telecom.ca</a></li>
              <li style={li}>CRTC : <a href="https://crtc.gc.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee" }}>crtc.gc.ca</a></li>
              <li style={li}>CPRST : <a href="https://www.ccts-cprst.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee" }}>ccts-cprst.ca</a></li>
            </ul>
          </div>

          <div style={infoBox}>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
              <strong style={{ color: "#22d3ee" }}>English summary:</strong> Nivra Telecom applies minimal, transparent internet traffic management. We do not block or degrade lawful applications. Data caps trigger email alerts at 75%, 90%, and 100% of monthly usage. Emergency (911) traffic is always prioritized. No commercial DPI is used. Complaints: <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmail}</a>.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
