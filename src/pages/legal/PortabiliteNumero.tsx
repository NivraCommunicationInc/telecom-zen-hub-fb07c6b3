import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PhotoBg } from "@/components/PhotoBg";
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

export default function PortabiliteNumero() {
  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1556742502-ec7c0e9f34b6?auto=format&fit=crop&w=1920&q=80"
        opacity={0.12}
        filter="saturate(0.6) brightness(0.6)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(16,185,129,0.10) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Header />

      <main className="pt-24 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#10b981", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Code sur les services sans fil · CRTC</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Portabilité des numéros
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2.5rem" }}>
            Transférez votre numéro de téléphone existant vers Nivra Telecom — ou repartez avec. · Dernière mise à jour : juin 2026
          </p>

          <div style={successBox} className="mb-8">
            <p style={{ color: "#34d399", fontWeight: 600, marginBottom: "0.5rem" }}>Votre numéro vous appartient</p>
            <p style={p}>
              Conformément aux règles du CRTC et du Code sur les services sans fil, vous avez le droit de
              conserver votre numéro de téléphone lorsque vous changez de fournisseur. Ce droit est gratuit
              et ne peut pas vous être refusé.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>1. Transférer votre numéro VERS Nivra Telecom</h2>
            <p style={p}>
              Lorsque vous activez un service mobile chez Nivra Telecom, vous pouvez transférer votre
              numéro existant depuis un autre fournisseur québécois.
            </p>
            <p style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: "0.5rem" }}>Codes régionaux acceptés :</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
              {CONTRACT_TERMS.portability.allowedAreaCodes.map((code) => (
                <span key={code} style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399", borderRadius: 6, padding: "4px 12px", fontSize: "0.9rem", fontWeight: 600 }}>
                  {code}
                </span>
              ))}
            </div>
            <p style={p}>
              Si votre indicatif régional n'est pas dans la liste ci-dessus, contactez-nous — nous évaluons
              les demandes au cas par cas.
            </p>

            <p style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: "0.5rem", marginTop: "1rem" }}>Ce dont vous avez besoin :</p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Votre numéro de téléphone actuel</li>
              <li style={li}>Le nom du compte tel qu'enregistré chez votre fournisseur actuel</li>
              <li style={li}>Votre numéro de compte (si requis par votre fournisseur actuel)</li>
              <li style={li}>Un NIP de transfert (PIN de portabilité) si votre fournisseur l'exige</li>
            </ul>
          </div>

          <div style={infoBox} className="mb-8">
            <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>
              Délai de transfert : 2,5 jours ouvrables
            </p>
            <p style={{ color: "#94a3b8" }}>
              Conformément au Code sur les services sans fil du CRTC, le transfert de numéro doit être
              complété dans un délai maximum de <strong style={{ color: "#e2e8f0" }}>2,5 jours ouvrables</strong> suivant
              la réception de votre demande complète. Nous visons généralement un transfert en moins de 24 heures.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>2. Transférer votre numéro DEPUIS Nivra Telecom</h2>
            <p style={p}>
              Si vous souhaitez quitter Nivra Telecom et transférer votre numéro vers un autre fournisseur :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Initiez le transfert directement auprès de votre nouveau fournisseur — ils s'occupent du processus</li>
              <li style={li}>Votre service Nivra restera actif pendant le transfert</li>
              <li style={li}>Aucun frais de transfert sortant ne s'applique</li>
              <li style={li}>Le transfert doit être complété avant l'expiration de votre service prépayé pour garantir la conservation du numéro</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>3. Conservation du numéro après non-renouvellement</h2>
            <div style={warnBox}>
              <p style={{ color: "#fbbf24", fontWeight: 600, marginBottom: "0.5rem" }}>
                <span style={{ marginRight: "0.5rem" }}>⚠</span> Important — Numéros prépayés
              </p>
              <p style={{ color: "#94a3b8" }}>
                Si votre service prépayé expire (non-renouvelé), votre numéro de téléphone est conservé
                pendant une période maximale de <strong style={{ color: "#e2e8f0" }}>90 jours</strong>. Après
                cette période, le numéro peut être récupéré par notre fournisseur de réseau et ne sera plus récupérable.
                Renouvelez avant l'expiration des 90 jours pour garantir la conservation de votre numéro.
              </p>
            </div>
          </div>

          <div style={section}>
            <h2 style={h2}>4. Déverrouillage d'appareil</h2>
            <p style={p}>
              Conformément au Code sur les services sans fil du CRTC :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Tous les appareils vendus par Nivra Telecom sont <strong style={{ color: "#e2e8f0" }}>déverrouillés par défaut</strong> — aucuns frais de déverrouillage</li>
              <li style={li}>Vous pouvez utiliser votre appareil avec n'importe quel réseau compatible</li>
              <li style={li}>Aucun appareil vendu sous contrat à terme chez Nivra (nous sommes 100 % prépayé)</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>5. Contact et assistance</h2>
            <p style={p}>
              Pour initier un transfert ou poser des questions sur la portabilité :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Portail client : <a href={COMPANY_CONTACT.portalUrl} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.website}</a></li>
              <li style={li}>Courriel : <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmail}</a></li>
              <li style={li}>Heures de support : {COMPANY_CONTACT.supportHours}</li>
            </ul>
          </div>

          <div style={infoBox}>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
              <strong style={{ color: "#22d3ee" }}>English summary:</strong> You have the right to keep your phone number when switching providers. Inbound port: complete within 2.5 business days, supported area codes include 514, 438, 418, 450, 579, 819 and others. Outbound port: initiate with your new provider — no transfer fees. Prepaid numbers are held for 90 days after service expiry. All devices sold by Nivra Telecom are unlocked at no charge.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
