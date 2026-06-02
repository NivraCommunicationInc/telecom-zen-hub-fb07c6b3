/**
 * Presse — Public press / media page for Nivra Telecom.
 * Route: /presse
 */
import { Helmet } from "react-helmet-async";
import { Download, Mail, Calendar, Building2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const PRESS_EMAIL = "presse@nivra-telecom.ca";

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 20,
  padding: 28,
};

const h2Style: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 28,
  fontWeight: 800,
  color: '#FFFFFF',
  marginBottom: 28,
  letterSpacing: '-1.5px',
};

const bodyText: React.CSSProperties = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.65)',
  lineHeight: 1.75,
};

export default function Presse() {
  return (
    <>
      <Helmet>
        <title>Presse & Médias | Nivra Telecom</title>
        <meta name="description" content="Salle de presse Nivra Telecom — kit média, communiqués, contact presse au Québec." />
        <link rel="canonical" href="https://nivra-telecom.ca/presse" />
      </Helmet>

      <div style={{ background: '#020209', minHeight: '100vh' }}>
        <Header />

        {/* HERO */}
        <section className="relative overflow-hidden" style={{ padding: '120px 24px 80px' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 550, height: 550, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 2 }}>
            <div className="n-animate-in inline-flex items-center gap-2 mb-6" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 999, padding: '6px 16px' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#A78BFA' }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#A78BFA', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Salle de presse
              </span>
            </div>
            <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, color: '#FFFFFF', margin: '0 0 20px', letterSpacing: '-2.5px', lineHeight: 1.0 }}>
              Nivra Telecom{' '}<span className="n-shimmer-text">dans les médias</span>
            </h1>
            <p className="n-animate-in-delay-2" style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>
              Pour toute demande médiatique :{" "}
              <a href={`mailto:${PRESS_EMAIL}`} style={{ color: '#A78BFA', fontWeight: 600, textDecoration: 'none' }}>
                {PRESS_EMAIL}
              </a>
            </p>
          </div>
        </section>

        {/* FACTS */}
        <section style={{ padding: '80px 24px', background: '#020209' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={h2Style}>Nivra Telecom en chiffres</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {[
                { label: 'Fondée en', value: '2025 — Montréal, QC' },
                { label: 'Modèle', value: 'Internet prépayé sans contrat' },
                { label: 'Crédit', value: 'Sans vérification de crédit' },
                { label: 'Couverture', value: 'Grand Montréal + Québec' },
                { label: 'Technologie', value: 'Fibre + DOCSIS 3.1' },
              ].map((f) => (
                <div key={f.label} style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 20, background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', margin: '0 0 8px', fontWeight: 600 }}>
                    {f.label}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRESS KIT */}
        <section style={{ padding: '80px 24px', background: '#020209' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={h2Style}>Kit média</h2>
            <div style={{ display: 'grid', gap: 16 }}>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', marginBottom: 8, marginTop: 0 }}>Logo officiel</h3>
                <p style={{ ...bodyText, marginBottom: 20 }}>
                  Logo Nivra Telecom au format SVG, libre d'utilisation éditoriale.
                </p>
                <a
                  href="/favicon.svg"
                  download="nivra-telecom-logo.svg"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#7C3AED', color: '#fff', padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
                >
                  <Download size={15} /> Télécharger le logo (SVG)
                </a>
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', marginBottom: 8, marginTop: 0 }}>Description courte (≈150 mots)</h3>
                <p style={bodyText}>
                  Nivra Telecom est un fournisseur de services Internet prépayés fondé à Montréal en 2025.
                  L'entreprise offre des forfaits Internet, télévision et mobile sans contrat ni vérification
                  de crédit, dans une approche entièrement transparente : prix clairs, premier mois gratuit,
                  équipement requis détaillé à l'avance, et gestion 100 % en ligne via un portail client
                  bilingue. Présente dans le Grand Montréal et la grande région de Québec, Nivra s'appuie
                  sur les réseaux fibre et DOCSIS 3.1 disponibles à l'adresse du client. Son modèle prépayé
                  cible une clientèle exclue ou frustrée par les offres traditionnelles : étudiants, nouveaux
                  arrivants, locataires temporaires, ménages refusés ailleurs. Le service est livré, activé
                  et facturé sans représentant à domicile par défaut, avec un support local par courriel.
                </p>
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', marginBottom: 8, marginTop: 0 }}>Description longue (≈500 mots)</h3>
                <p style={{ ...bodyText, whiteSpace: 'pre-line' }}>
                  {`Nivra Telecom est une entreprise québécoise de télécommunications fondée à Montréal en 2025, spécialisée dans des services Internet, télévision et mobile entièrement prépayés. L'entreprise cible un segment de marché historiquement mal servi par les fournisseurs traditionnels : les ménages qui refusent les engagements de 12 ou 24 mois, les nouveaux arrivants sans dossier de crédit canadien, les étudiants et locataires mobiles, ainsi que les personnes refusées par les grands joueurs en raison de leur cote ou de leur historique.

Le modèle Nivra repose sur quatre principes : transparence totale des prix (aucun frais caché, équipement détaillé à l'avance), absence de contrat (le client paie chaque mois et peut arrêter à tout moment), absence de vérification de crédit (aucun impact sur la cote du client), et autonomie complète via un portail bilingue (français / anglais) qui couvre la commande, l'activation, le paiement, le suivi de livraison, le support, et la résiliation.

Côté infrastructure, Nivra revend les capacités fibre et DOCSIS 3.1 disponibles à l'adresse du client dans le Grand Montréal et la grande région de Québec. Le déploiement est livré sans technicien sur site dans la majorité des cas : le client reçoit l'équipement (borne WiFi, terminal TV, carte SIM selon le service) et procède à l'auto-installation guidée. Un réseau d'agents Nivra Field accompagne les clients qui le préfèrent en porte-à-porte ou en kiosque.

L'écosystème logiciel de Nivra est entièrement bâti sur mesure : portail client public, portail employé pour les opérations, portail RH pour la paie et les commissions, portail Field pour les agents de vente terrain, et plateforme administrative Core qui orchestre la facturation, la conformité, la trésorerie et le support. Tous les paiements transitent par PayPal pour les prélèvements récurrents et par les réseaux Visa, Mastercard et Interac pour les paiements ponctuels.

Le support client est offert exclusivement par courriel dans une logique de coût opérationnel maîtrisé, ce qui permet à Nivra d'offrir des prix nettement sous le marché traditionnel. Tous les échanges sont archivés, traçables, et utilisés pour améliorer en continu les procédures internes documentées (SOPs) qui régissent chaque processus.

Nivra Telecom se positionne comme une alternative directe aux fournisseurs nationaux pour la clientèle qui valorise la souplesse, la simplicité et la maîtrise de ses dépenses télécoms — sans renoncer à la qualité technique du service livré.`}
                </p>
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', marginBottom: 8, marginTop: 0 }}>Fiche technique produits</h3>
                <ul style={{ ...bodyText, paddingLeft: 20, margin: 0 }}>
                  <li><strong style={{ color: 'rgba(255,255,255,0.85)' }}>Internet</strong> — Forfaits fibre / DOCSIS 3.1, sans contrat, premier mois gratuit. Borne WiFi requise (60 $).</li>
                  <li><strong style={{ color: 'rgba(255,255,255,0.85)' }}>Télévision</strong> — Bouquet IPTV avec terminal Nivra TV requis (50 $ par terminal, max 4).</li>
                  <li><strong style={{ color: 'rgba(255,255,255,0.85)' }}>Mobile</strong> — Forfaits prépayés avec carte SIM requise (30 $).</li>
                  <li><strong style={{ color: 'rgba(255,255,255,0.85)' }}>Paiements</strong> — PayPal (récurrent), Visa, Mastercard, Interac.</li>
                  <li><strong style={{ color: 'rgba(255,255,255,0.85)' }}>Support</strong> — Courriel uniquement, bilingue FR / EN.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* RELEASES */}
        <section style={{ padding: '80px 24px', background: '#020209' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={h2Style}>Communiqués</h2>
            <article style={{ border: '1px solid rgba(124,58,237,0.25)', borderRadius: 20, padding: 28, background: 'rgba(124,58,237,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12, fontWeight: 500 }}>
                <Calendar size={13} /> 2025 · Communiqué de lancement
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', marginBottom: 12, marginTop: 0 }}>
                Lancement Nivra Telecom 2025 — Internet prépayé sans contrat au Québec
              </h3>
              <p style={bodyText}>
                Nivra Telecom annonce le lancement de son service Internet prépayé sans contrat ni vérification
                de crédit dans le Grand Montréal et la région de Québec. L'entreprise vise les ménages exclus
                ou frustrés par les offres traditionnelles, avec un modèle 100 % en ligne, un premier mois
                gratuit et un support local bilingue.
              </p>
              <p style={{ fontSize: 13, color: '#C4B5FD', fontWeight: 600, marginTop: 16, marginBottom: 0 }}>
                Demandes médias :{" "}
                <a href={`mailto:${PRESS_EMAIL}`} style={{ color: '#C4B5FD' }}>{PRESS_EMAIL}</a>
              </p>
            </article>
          </div>
        </section>

        {/* CONTACT */}
        <section style={{ padding: '80px 24px', background: '#020209' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', background: 'linear-gradient(135deg, #16111F 0%, #0A0A0F 100%)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 24, padding: '64px 40px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Mail size={24} style={{ color: '#A78BFA' }} />
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', marginBottom: 12, letterSpacing: '-0.5px' }}>
              Contact presse
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
              <a href={`mailto:${PRESS_EMAIL}`} style={{ color: '#C4B5FD', textDecoration: 'underline', fontWeight: 600 }}>
                {PRESS_EMAIL}
              </a>
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Réponse sous 24 heures.</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              <Building2 size={14} /> Nivra Telecom · Montréal, QC
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
