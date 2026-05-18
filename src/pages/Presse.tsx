/**
 * Presse — Public press / media page for Nivra Telecom.
 * Route: /presse
 */
import { Helmet } from "react-helmet-async";
import { Download, Mail, Calendar, Building2 } from "lucide-react";

const PRESS_EMAIL = "presse@nivra-telecom.ca";

export default function Presse() {
  return (
    <>
      <Helmet>
        <title>Presse & Médias | Nivra Telecom</title>
        <meta
          name="description"
          content="Salle de presse Nivra Telecom — kit média, communiqués, contact presse au Québec."
        />
        <link rel="canonical" href="https://nivra-telecom.ca/presse" />
      </Helmet>

      {/* HERO */}
      <section style={{ background: "#EDE9FF", padding: "64px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 11, letterSpacing: 2, color: "#7C3AED", textTransform: "uppercase", marginBottom: 12 }}>
            Salle de presse
          </p>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: "#111", margin: 0, letterSpacing: "-1px" }}>
            Nivra Telecom dans les médias
          </h1>
          <p style={{ marginTop: 16, fontSize: 16, color: "#444" }}>
            Pour toute demande médiatique :{" "}
            <a href={`mailto:${PRESS_EMAIL}`} style={{ color: "#7C3AED", fontWeight: 600 }}>
              {PRESS_EMAIL}
            </a>
          </p>
        </div>
      </section>

      {/* FACTS */}
      <section style={{ padding: "64px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 32 }}>
            Nivra Telecom en chiffres
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {[
              { label: "Fondée en", value: "2025 — Montréal, QC" },
              { label: "Modèle", value: "Internet prépayé sans contrat" },
              { label: "Crédit", value: "Sans vérification de crédit" },
              { label: "Couverture", value: "Grand Montréal + Québec" },
              { label: "Technologie", value: "Fibre + DOCSIS 3.1" },
            ].map((f) => (
              <div key={f.label} style={{ border: "1px solid #EEE", borderRadius: 16, padding: 20, background: "#fff" }}>
                <p style={{ fontSize: 11, letterSpacing: 1.5, color: "#999", textTransform: "uppercase", margin: 0 }}>
                  {f.label}
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111", marginTop: 8 }}>{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRESS KIT */}
      <section style={{ padding: "64px 24px", background: "#F7F7F7" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 24 }}>
            Kit média
          </h2>

          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>Logo officiel</h3>
              <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
                Logo Nivra Telecom au format SVG, libre d'utilisation éditoriale.
              </p>
              <a
                href="/favicon.svg"
                download="nivra-telecom-logo.svg"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#7C3AED",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Download size={16} /> Télécharger le logo (SVG)
              </a>
            </div>

            <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>Description courte (≈150 mots)</h3>
              <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7 }}>
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

            <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>Description longue (≈500 mots)</h3>
              <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {`Nivra Telecom est une entreprise québécoise de télécommunications fondée à Montréal en 2025, spécialisée dans des services Internet, télévision et mobile entièrement prépayés. L'entreprise cible un segment de marché historiquement mal servi par les fournisseurs traditionnels : les ménages qui refusent les engagements de 12 ou 24 mois, les nouveaux arrivants sans dossier de crédit canadien, les étudiants et locataires mobiles, ainsi que les personnes refusées par les grands joueurs en raison de leur cote ou de leur historique.

Le modèle Nivra repose sur quatre principes : transparence totale des prix (aucun frais caché, équipement détaillé à l'avance), absence de contrat (le client paie chaque mois et peut arrêter à tout moment), absence de vérification de crédit (aucun impact sur la cote du client), et autonomie complète via un portail bilingue (français / anglais) qui couvre la commande, l'activation, le paiement, le suivi de livraison, le support, et la résiliation.

Côté infrastructure, Nivra revend les capacités fibre et DOCSIS 3.1 disponibles à l'adresse du client dans le Grand Montréal et la grande région de Québec. Le déploiement est livré sans technicien sur site dans la majorité des cas : le client reçoit l'équipement (borne WiFi, terminal TV, carte SIM selon le service) et procède à l'auto-installation guidée. Un réseau d'agents Nivra Field accompagne les clients qui le préfèrent en porte-à-porte ou en kiosque.

L'écosystème logiciel de Nivra est entièrement bâti sur mesure : portail client public, portail employé pour les opérations, portail RH pour la paie et les commissions, portail Field pour les agents de vente terrain, et plateforme administrative Core qui orchestre la facturation, la conformité, la trésorerie et le support. Tous les paiements transitent par PayPal pour les prélèvements récurrents et par les réseaux Visa, Mastercard et Interac pour les paiements ponctuels.

Le support client est offert exclusivement par courriel dans une logique de coût opérationnel maîtrisé, ce qui permet à Nivra d'offrir des prix nettement sous le marché traditionnel. Tous les échanges sont archivés, traçables, et utilisés pour améliorer en continu les procédures internes documentées (SOPs) qui régissent chaque processus.

Nivra Telecom se positionne comme une alternative directe aux fournisseurs nationaux pour la clientèle qui valorise la souplesse, la simplicité et la maîtrise de ses dépenses télécoms — sans renoncer à la qualité technique du service livré.`}
              </p>
            </div>

            <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>Fiche technique produits</h3>
              <ul style={{ fontSize: 14, color: "#444", lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
                <li><strong>Internet</strong> — Forfaits fibre / DOCSIS 3.1, sans contrat, premier mois gratuit. Borne WiFi requise (60 $).</li>
                <li><strong>Télévision</strong> — Bouquet IPTV avec terminal Nivra TV requis (50 $ par terminal, max 4).</li>
                <li><strong>Mobile</strong> — Forfaits prépayés avec carte SIM requise (30 $).</li>
                <li><strong>Paiements</strong> — PayPal (récurrent), Visa, Mastercard, Interac.</li>
                <li><strong>Support</strong> — Courriel uniquement, bilingue FR / EN.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* RELEASES */}
      <section style={{ padding: "64px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 24 }}>
            Communiqués
          </h2>
          <article style={{ border: "1px solid #EEE", borderRadius: 16, padding: 24, background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#999", fontSize: 12, marginBottom: 8 }}>
              <Calendar size={14} /> 2025 · Communiqué de lancement
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 8 }}>
              Lancement Nivra Telecom 2025 — Internet prépayé sans contrat au Québec
            </h3>
            <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7 }}>
              Nivra Telecom annonce le lancement de son service Internet prépayé sans contrat ni vérification
              de crédit dans le Grand Montréal et la région de Québec. L'entreprise vise les ménages exclus
              ou frustrés par les offres traditionnelles, avec un modèle 100 % en ligne, un premier mois
              gratuit et un support local bilingue.
            </p>
            <p style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, marginTop: 12 }}>
              Demandes médias : <a href={`mailto:${PRESS_EMAIL}`} style={{ color: "#7C3AED" }}>{PRESS_EMAIL}</a>
            </p>
          </article>
        </div>
      </section>

      {/* CONTACT */}
      <section style={{ padding: "64px 24px", background: "#111", color: "#fff" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <Mail size={32} style={{ color: "#7C3AED", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 12 }}>
            Contact presse
          </h2>
          <p style={{ fontSize: 16, color: "#ccc", marginBottom: 8 }}>
            <a href={`mailto:${PRESS_EMAIL}`} style={{ color: "#fff", textDecoration: "underline" }}>
              {PRESS_EMAIL}
            </a>
          </p>
          <p style={{ fontSize: 13, color: "#888" }}>Réponse sous 24 heures.</p>
          <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 8, color: "#888", fontSize: 12 }}>
            <Building2 size={14} /> Nivra Telecom · Montréal, QC
          </div>
        </div>
      </section>
    </>
  );
}
