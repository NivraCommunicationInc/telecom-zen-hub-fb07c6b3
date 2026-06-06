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

const dangerBox = {
  background: "rgba(239,68,68,0.07)",
  border: "1px solid rgba(239,68,68,0.20)",
  borderRadius: 10,
  padding: "24px 28px",
} as const;

const section = { marginBottom: "2rem" } as const;
const h2 = { color: "#e2e8f0", fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.75rem" } as const;
const p = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.75rem" } as const;
const li = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.35rem" } as const;

export default function PolitiqueUtilisationAcceptable() {
  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1920&q=80"
        opacity={0.11}
        filter="saturate(0.5) brightness(0.6)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(239,68,68,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Header />

      <main className="pt-24 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#6366f1", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Conformité</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Politique d'utilisation acceptable
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2.5rem" }}>
            Acceptable Use Policy (AUP) · Dernière mise à jour : juin 2026
          </p>

          <div style={infoBox} className="mb-8">
            <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Portée</p>
            <p style={p}>
              Cette politique s'applique à tous les clients de Nivra Telecom utilisant nos services
              Internet, mobile, téléphonie, TV ou tout autre service de télécommunication. En utilisant
              nos services, vous acceptez de respecter cette politique.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>1. Utilisation autorisée</h2>
            <p style={p}>Nos services sont fournis à des fins légales, notamment :</p>
            <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.75rem" }}>
              <li style={li}>Navigation Web, courriel, messagerie</li>
              <li style={li}>Streaming vidéo et audio légaux</li>
              <li style={li}>Appels VoIP et visioconférence</li>
              <li style={li}>Télétravail, accès VPN d'entreprise</li>
              <li style={li}>Jeux en ligne, services cloud légaux</li>
              <li style={li}>Téléchargement et partage de fichiers légaux</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>2. Utilisations strictement interdites</h2>
            <div style={dangerBox} className="mb-4">
              <p style={{ color: "#f87171", fontWeight: 600, marginBottom: "0.75rem" }}>
                Les activités suivantes sont strictement interdites et peuvent entraîner la suspension immédiate du service sans remboursement :
              </p>
              <ul style={{ paddingLeft: "1.5rem" }}>
                <li style={{ ...li, color: "#fca5a5" }}>Activités illégales : fraude, exploitation, cyberattaques, téléchargement de contenu piraté</li>
                <li style={{ ...li, color: "#fca5a5" }}>Envoi de spam ou de communications non sollicitées en masse (CASL)</li>
                <li style={{ ...li, color: "#fca5a5" }}>Attaques par déni de service distribué (DDoS) ou tout type de cyberattaque</li>
                <li style={{ ...li, color: "#fca5a5" }}>Distribution de logiciels malveillants, virus, chevaux de Troie</li>
                <li style={{ ...li, color: "#fca5a5" }}>Accès non autorisé à des systèmes informatiques tiers</li>
                <li style={{ ...li, color: "#fca5a5" }}>Exploitation sexuelle d'enfants (CSAM) — signalé immédiatement aux autorités</li>
                <li style={{ ...li, color: "#fca5a5" }}>Usurpation d'identité ou hameçonnage</li>
                <li style={{ ...li, color: "#fca5a5" }}>Revente non autorisée des services Nivra Telecom</li>
                <li style={{ ...li, color: "#fca5a5" }}>Saturation intentionnelle du réseau affectant les autres clients</li>
              </ul>
            </div>
          </div>

          <div style={section}>
            <h2 style={h2}>3. Contenu et communications</h2>
            <p style={p}>
              Les clients sont responsables de tout contenu qu'ils transmettent via les services Nivra Telecom.
              Il est interdit de transmettre ou de stocker du contenu :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Diffamatoire, haineux, harcelant ou menaçant</li>
              <li style={li}>Violant les droits d'auteur, brevets, marques ou secrets commerciaux</li>
              <li style={li}>Violant la vie privée d'autrui</li>
              <li style={li}>Constituant du contenu sexuel impliquant des mineurs</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>4. Ressources réseau</h2>
            <p style={p}>
              Les clients doivent utiliser les ressources réseau de manière raisonnable. Une utilisation
              excessive qui dégrade l'expérience des autres clients peut entraîner une limitation temporaire
              de vitesse conformément à nos{" "}
              <Link to="/pratiques-reseau" style={{ color: "#22d3ee" }}>pratiques de gestion du trafic</Link>.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>5. Sécurité</h2>
            <p style={p}>
              Vous êtes responsable de sécuriser vos appareils et votre réseau local. Nivra Telecom n'est pas
              responsable des dommages causés par un accès non autorisé à votre réseau si celui-ci n'était
              pas adéquatement sécurisé.
            </p>
          </div>

          <div style={warnBox} className="mb-8">
            <p style={{ color: "#fbbf24", fontWeight: 600, marginBottom: "0.5rem" }}>
              <span style={{ marginRight: "0.5rem" }}>⚠</span> Conséquences d'une violation
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={{ color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.35rem" }}>Avertissement écrit (pour violations mineures)</li>
              <li style={{ color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.35rem" }}>Limitation de vitesse temporaire</li>
              <li style={{ color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.35rem" }}>Suspension ou résiliation du service sans remboursement</li>
              <li style={{ color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.35rem" }}>Signalement aux autorités compétentes pour activités illégales</li>
              <li style={{ color: "#94a3b8", lineHeight: 1.8 }}>Recours civil ou pénal</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>6. Signalement d'abus</h2>
            <p style={p}>
              Si vous êtes victime d'abus provenant du réseau Nivra Telecom, ou si vous constatez une
              violation de cette politique, contactez-nous immédiatement :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Courriel abus : <a href="mailto:abus@nivra-telecom.ca" style={{ color: "#22d3ee" }}>abus@nivra-telecom.ca</a></li>
              <li style={li}>Support général : <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmail}</a></li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>7. Modifications</h2>
            <p style={p}>
              Nivra Telecom peut modifier cette politique à tout moment. Les modifications importantes seront
              communiquées par courriel avec un préavis de 30 jours conformément au Code sur les services
              Internet du CRTC.
            </p>
          </div>

          <div style={infoBox}>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
              <strong style={{ color: "#22d3ee" }}>English summary:</strong> Nivra Telecom services may only be used for lawful purposes. Prohibited activities include spam, cyberattacks, DDoS, illegal content, unauthorized access, and CSAM. Violations may result in immediate service suspension without refund. Report abuse to <a href="mailto:abus@nivra-telecom.ca" style={{ color: "#22d3ee" }}>abus@nivra-telecom.ca</a>.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
