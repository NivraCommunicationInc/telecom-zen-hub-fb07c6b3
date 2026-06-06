import PageSEO from "@/components/shared/PageSEO";
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

const section = { marginBottom: "2rem" } as const;
const h2s = { color: "#e2e8f0", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.65rem" } as const;
const ps = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.65rem" } as const;
const lis = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.3rem" } as const;

export default function PolitiqueConfidentialite() {
  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=1920&q=80"
        opacity={0.10}
        filter="saturate(0.5) brightness(0.6)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <PageSEO
        title="Politique de confidentialité — Loi 25"
        description="Politique de confidentialité de Nivra Telecom, conforme à la Loi 25 du Québec et à la LPRPDE. Responsable désigné, droits d'accès, EFVP."
        path="/politique-de-confidentialite"
      />
      <Header />

      <div className="container mx-auto px-4 sm:px-6 max-w-3xl py-16 sm:py-20 pt-24 sm:pt-28" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: "0.5rem" }}>
          <span style={{ color: "#8b5cf6", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Loi 25 · LPRPDE · Loi 25 QC</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 tracking-tight text-foreground">Politique de confidentialité</h1>
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2rem" }}>Dernière mise à jour : juin 2026</p>

        <div style={infoBox} className="mb-8">
          <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Responsable de la protection des renseignements personnels</p>
          <p style={ps}>
            <strong style={{ color: "#e2e8f0" }}>{COMPANY_CONTACT.privacyOfficer}</strong><br />
            {COMPANY_CONTACT.legalName}<br />
            Courriel : <a href={`mailto:${COMPANY_CONTACT.privacyOfficerEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.privacyOfficerEmail}</a><br />
            Adresse : {COMPANY_CONTACT.fullAddress}
          </p>
        </div>

        <section style={{ ...section, fontSize: "0.93rem", lineHeight: 1.8 }}>

          <div style={section}>
            <h2 style={h2s}>1. Responsable du traitement</h2>
            <p style={ps}>
              {COMPANY_CONTACT.legalName}, entreprise constituée au Québec, Canada, est responsable du traitement de vos
              renseignements personnels. Pour toute question :{" "}
              <a href={`mailto:${COMPANY_CONTACT.privacyOfficerEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.privacyOfficerEmail}</a>
            </p>
          </div>

          <div style={section}>
            <h2 style={h2s}>2. Renseignements collectés</h2>
            <p style={ps}>Nous collectons :</p>
            <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.5rem" }}>
              <li style={lis}>Nom, adresse courriel, numéro de téléphone, adresse de service</li>
              <li style={lis}>Informations de paiement (tokenisées via PayPal — jamais stockées en clair chez Nivra)</li>
              <li style={lis}>Données de navigation (adresse IP, navigateur, pages visitées) via cookies analytiques</li>
              <li style={lis}>Informations KYC (vérification d'identité) lorsque requis</li>
              <li style={lis}>Communications de support (tickets, courriels)</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2s}>3. Finalités du traitement</h2>
            <p style={ps}>Vos renseignements sont utilisés pour :</p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={lis}>Fournir et gérer nos services télécom (Internet, mobile, TV)</li>
              <li style={lis}>Traiter vos paiements et gérer la facturation</li>
              <li style={lis}>Vous envoyer des communications de service (transactionnelles)</li>
              <li style={lis}>Améliorer notre site web et nos services (analyses anonymisées)</li>
              <li style={lis}>Respecter nos obligations légales et réglementaires</li>
              <li style={lis}>Prévenir la fraude et assurer la sécurité du réseau</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2s}>4. Partage des renseignements</h2>
            <p style={ps}>
              Nous ne vendons jamais vos renseignements personnels. Nous les partageons uniquement avec nos
              sous-traitants contractuellement tenus de les protéger :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>PayPal :</strong> traitement des paiements</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Supabase / Lovable :</strong> hébergement infrastructure cloud (Québec ou Canada)</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Sentry :</strong> surveillance des erreurs (données techniques anonymisées)</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Autorités :</strong> si requis par une ordonnance légale valide</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2s}>5. Vos droits (Loi 25)</h2>
            <p style={ps}>Conformément à la Loi 25 (Loi modernisant des dispositions législatives en matière de protection des renseignements personnels), vous avez le droit de :</p>
            <ul style={{ paddingLeft: "1.5rem", marginBottom: "1rem" }}>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Accéder</strong> à vos renseignements personnels détenus par Nivra Telecom</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Corriger</strong> des renseignements inexacts ou incomplets</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Demander la suppression</strong> de vos renseignements (droit à l'effacement)</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Retirer votre consentement</strong> au traitement non essentiel</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Obtenir une copie portable</strong> de vos données (portabilité)</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>S'opposer</strong> à certains traitements automatisés</li>
            </ul>
            <p style={ps}>
              Pour exercer ces droits, écrivez à{" "}
              <a href={`mailto:${COMPANY_CONTACT.privacyOfficerEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.privacyOfficerEmail}</a>.
              Nous répondrons dans les 30 jours suivant la réception de votre demande.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2s}>6. Cookies et technologies similaires</h2>
            <p style={ps}>Notre site utilise les types de cookies suivants :</p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Cookies essentiels :</strong> nécessaires au fonctionnement du site (session, sécurité) — non désactivables</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Cookies analytiques :</strong> mesure d'audience anonymisée (Google Analytics ou équivalent) — consentement requis</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Cookies PayPal :</strong> sécurité des transactions de paiement — nécessaires si vous utilisez PayPal</li>
              <li style={lis}><strong style={{ color: "#e2e8f0" }}>Cookies Sentry :</strong> surveillance des erreurs techniques anonymisées</li>
            </ul>
            <p style={{ ...ps, marginTop: "0.75rem" }}>
              Vous pouvez gérer vos préférences via notre bannière de consentement ou en modifiant les paramètres de votre navigateur.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2s}>7. Conservation des données</h2>
            <p style={ps}>
              Vos données sont conservées aussi longtemps que nécessaire pour la prestation du service.
              Après la fin du service :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={lis}>Données financières et factures : <strong style={{ color: "#e2e8f0" }}>7 ans</strong> (obligations fiscales)</li>
              <li style={lis}>Logs de support et communications : <strong style={{ color: "#e2e8f0" }}>3 ans</strong></li>
              <li style={lis}>Données de navigation (cookies analytiques) : <strong style={{ color: "#e2e8f0" }}>13 mois maximum</strong></li>
              <li style={lis}>Données KYC : <strong style={{ color: "#e2e8f0" }}>selon exigences légales applicables</strong></li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2s}>8. Sécurité</h2>
            <p style={ps}>
              Nous utilisons le chiffrement SSL/TLS pour toutes les communications, l'authentification à deux facteurs
              pour l'accès aux systèmes internes, des contrôles d'accès stricts par rôle (Admin, Employé, Technicien),
              et des journaux d'audit pour toutes les modifications sensibles.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2s}>9. Évaluation des facteurs relatifs à la vie privée (EFVP)</h2>
            <p style={ps}>
              Conformément à la Loi 25, Nivra Telecom réalise une Évaluation des facteurs relatifs à la vie privée (EFVP)
              avant tout déploiement de nouveaux systèmes susceptibles d'affecter la protection des renseignements personnels,
              notamment nos systèmes d'intelligence artificielle (NOVA) et les nouvelles intégrations tierces.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2s}>10. Incidents de confidentialité</h2>
            <p style={ps}>
              En cas d'incident de confidentialité (accès non autorisé, divulgation, perte) présentant un risque sérieux
              de préjudice :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={lis}>Signalement à la Commission d'accès à l'information (CAI) dans les <strong style={{ color: "#e2e8f0" }}>72 heures</strong></li>
              <li style={lis}>Notification des personnes concernées dans les meilleurs délais</li>
              <li style={lis}>Consignation de l'incident dans notre registre interne des incidents</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2s}>11. Contact et plaintes</h2>
            <p style={ps}>
              Pour toute plainte ou demande concernant le traitement de vos données, contactez-nous à{" "}
              <a href={`mailto:${COMPANY_CONTACT.privacyOfficerEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.privacyOfficerEmail}</a>.
            </p>
            <p style={ps}>
              Vous pouvez également déposer une plainte auprès de la Commission d'accès à l'information du Québec (CAI) :{" "}
              <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee" }}>
                www.cai.gouv.qc.ca
              </a>
            </p>
          </div>

        </section>
      </div>
      <Footer />
    </div>
  );
}
