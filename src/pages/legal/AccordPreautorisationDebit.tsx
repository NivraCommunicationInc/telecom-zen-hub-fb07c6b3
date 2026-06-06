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

export default function AccordPreautorisationDebit() {
  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1920&q=80"
        opacity={0.10}
        filter="saturate(0.5) brightness(0.6)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.10) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Header />

      <main className="pt-24 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#8b5cf6", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Paiements Canada — Règle H1</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Accord de prélèvement automatique
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2.5rem" }}>
            Pre-Authorized Debit (PAD) Agreement · Paiements Canada Règle H1 · Dernière mise à jour : juin 2026
          </p>

          <div style={infoBox} className="mb-8">
            <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>À propos du prélèvement automatique</p>
            <p style={p}>
              Lorsque vous activez un abonnement avec facturation automatique chez Nivra Telecom (via PayPal
              Facturation automatique), vous autorisez Nivra Communications Inc. à prélever automatiquement
              le montant dû à chaque date de renouvellement. Cet accord est régi par les règles de
              Paiements Canada (Règle H1).
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>1. Autorisation</h2>
            <p style={p}>
              En activant la facturation automatique (abonnement PayPal), vous autorisez{" "}
              <strong style={{ color: "#e2e8f0" }}>Nivra Communications Inc.</strong> à initier des prélèvements
              automatiques sur votre compte PayPal ou carte de crédit liée pour le montant exact de votre
              facture de renouvellement, incluant les taxes applicables (TPS/TVQ).
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>2. Montant et fréquence</h2>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Fréquence :</strong> mensuelle (ou selon le cycle de votre forfait)</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Montant :</strong> prix du forfait + TPS + TVQ + tout frais d'ajustement approuvé</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Date de prélèvement :</strong> votre « Bill Cycle Day » (jour de renouvellement mensuel)</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Devise :</strong> Dollar canadien (CAD)</li>
            </ul>
          </div>

          <div style={infoBox} className="mb-4">
            <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>
              Préavis de {CONTRACT_TERMS.pad.noticeDaysBeforeFirstDebit} jours
            </p>
            <p style={{ color: "#94a3b8" }}>
              Conformément à la Règle H1 de Paiements Canada, vous recevrez un avis d'au moins{" "}
              <strong style={{ color: "#e2e8f0" }}>{CONTRACT_TERMS.pad.noticeDaysBeforeFirstDebit} jours civils</strong> avant
              le premier prélèvement automatique. Le montant, la date et la fréquence seront communiqués
              clairement. Tout changement de montant ou de date fera l'objet d'un préavis identique.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>3. Modification et annulation</h2>
            <p style={p}>
              Vous pouvez modifier ou annuler votre autorisation de prélèvement automatique à tout moment :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Via votre portail client Nivra Telecom</li>
              <li style={li}>Via votre compte PayPal (section « Paiements préapprouvés »)</li>
              <li style={li}>En contactant notre support : <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmail}</a></li>
            </ul>
            <p style={p}>
              L'annulation doit parvenir au moins{" "}
              <strong style={{ color: "#e2e8f0" }}>{CONTRACT_TERMS.pad.revocationNoticeDays} jours</strong> avant
              la prochaine date de prélèvement pour être prise en compte dans le cycle en cours. L'annulation
              du PAD n'annule pas votre service — votre service reste actif jusqu'à la fin de la période prépayée.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>4. Remboursement en cas de prélèvement non autorisé</h2>
            <div style={warnBox}>
              <p style={{ color: "#fbbf24", fontWeight: 600, marginBottom: "0.5rem" }}>
                <span style={{ marginRight: "0.5rem" }}>⚠</span> Droit au remboursement — Règle H1
              </p>
              <p style={{ color: "#94a3b8" }}>
                Si un prélèvement a été effectué sans votre autorisation ou ne correspond pas à l'accord,
                vous avez le droit d'être remboursé dans un délai de{" "}
                <strong style={{ color: "#e2e8f0" }}>{CONTRACT_TERMS.pad.reimbursementWindow} jours civils</strong> suivant
                le prélèvement contesté. Contactez-nous immédiatement :{" "}
                <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#fbbf24" }}>{COMPANY_CONTACT.supportEmail}</a>
              </p>
            </div>
          </div>

          <div style={section}>
            <h2 style={h2}>5. Processeur de paiement</h2>
            <p style={p}>
              Les prélèvements automatiques sont traités via{" "}
              <strong style={{ color: "#e2e8f0" }}>{CONTRACT_TERMS.pad.processorName}</strong>. Vos informations
              financières sont gérées directement par PayPal conformément à leurs propres politiques de
              confidentialité et de sécurité. Nivra Telecom ne stocke pas vos numéros de carte de crédit.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>6. Échecs de prélèvement</h2>
            <p style={p}>
              En cas d'échec du prélèvement automatique (fonds insuffisants, carte expirée, etc.) :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Vous serez immédiatement notifié par courriel</li>
              <li style={li}>Votre service restera actif jusqu'à la date de renouvellement (Bill Cycle Day)</li>
              <li style={li}>Vous pouvez régler manuellement via votre portail avant la date de renouvellement</li>
              <li style={li}>Si non réglé à la date de renouvellement, le service expirera (non-renouvellement prépayé)</li>
              <li style={li}>Aucuns frais de pénalité pour un premier échec de prélèvement</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>7. Contact</h2>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Courriel : <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmail}</a></li>
              <li style={li}>Adresse : {COMPANY_CONTACT.fullAddress}</li>
              <li style={li}>Portail : <a href={COMPANY_CONTACT.portalUrl} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.website}</a></li>
            </ul>
          </div>

          <div style={{ ...infoBox, marginTop: "2rem" }}>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
              <strong style={{ color: "#22d3ee" }}>English summary:</strong> By activating auto-billing, you authorize Nivra Communications Inc. to charge your PayPal account monthly for your renewal amount (plan + taxes). You receive 10 days' notice before the first debit and any amount changes. You may cancel at any time via your client portal or PayPal. Unauthorized debits may be reimbursed within {CONTRACT_TERMS.pad.reimbursementWindow} days under Payments Canada Rule H1.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
