import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PhotoBg } from "@/components/PhotoBg";
import { COMPANY_CONTACT, ETRANSFER_CONFIG } from "@/config/company";
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
const h2s = { color: "#e2e8f0", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.65rem" } as const;
const ps = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.65rem" } as const;
const lis = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.3rem" } as const;

export default function ModalitesPaiement() {
  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&q=80"
        opacity={0.13}
        filter="saturate(0.7) brightness(0.65)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Header />

      <main className="pt-24 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#06b6d4", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Paiements · Facturation · PAD</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 tracking-tight text-foreground">
            Modalités de paiement
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2rem" }}>
            Dernière mise à jour : {CONTRACT_TERMS.lastUpdated}
          </p>

          <section style={{ ...section, fontSize: "0.93rem", lineHeight: 1.8 }}>

            <div style={section}>
              <h2 style={h2s}>1. Services prépayés</h2>
              <p style={ps}>
                Tous les services Nivra sont facturés à l'avance par cycle de service.
                Le renouvellement s'effectue uniquement si le paiement est reçu et confirmé.
              </p>
              <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.5rem" }}>
                <li style={lis}>Vous pouvez annuler à tout moment — le service reste actif jusqu'à la fin de la période payée.</li>
                <li style={lis}>Le cycle en cours n'est pas remboursable, sauf obligation légale ou erreur de facturation confirmée.</li>
              </ul>
            </div>

            <div style={section}>
              <h2 style={h2s}>2. Moyens de paiement acceptés</h2>
              <ul style={{ paddingLeft: "1.5rem", marginBottom: "0.5rem" }}>
                {CONTRACT_TERMS.paymentTerms.acceptedMethods.map((method, index) => (
                  <li key={index} style={lis}>{method}</li>
                ))}
              </ul>
            </div>

            <div style={section}>
              <h2 style={h2s}>3. Paiement par Virement Interac (e-Transfer)</h2>
              <div style={infoBox}>
                <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.75rem" }}>Instructions e-Transfer</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {[
                    ["Courriel de destination", ETRANSFER_CONFIG.emailDisplay],
                    ["Question de sécurité", ETRANSFER_CONFIG.securityQuestion],
                    ["Réponse", ETRANSFER_CONFIG.securityAnswer],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "0.4rem" }}>
                      <span style={{ color: "#64748b", flexShrink: 0 }}>{label}</span>
                      <span style={{ color: "#e2e8f0", textAlign: "right" }}>{val}</span>
                    </div>
                  ))}
                </div>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.75rem" }}>
                  Incluez votre numéro de commande ou de compte dans le message du virement.
                </p>
              </div>

              <div style={{ marginTop: "1.25rem" }}>
                <p style={{ ...ps, marginBottom: "0.5rem" }}>Statuts de paiement e-Transfer :</p>
                <ul style={{ paddingLeft: "1.5rem" }}>
                  {[
                    ["Pending (En attente)", "Virement envoyé, en attente de réception"],
                    ["In verification (En vérification)", "Virement reçu, en cours de validation"],
                    ["Complete (Complété)", "Paiement confirmé, service activé/renouvelé"],
                    ["Declined (Refusé)", "Virement refusé ou annulé"],
                    ["Fraud (Fraude)", "Activité suspecte détectée — compte suspendu"],
                  ].map(([status, desc]) => (
                    <li key={status} style={lis}><strong style={{ color: "#e2e8f0" }}>{status} :</strong> {desc}</li>
                  ))}
                </ul>
                <p style={{ color: "#475569", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                  L'activation du service s'effectue après réception et vérification du virement.
                </p>
              </div>
            </div>

            <div style={section}>
              <h2 style={h2s}>4. Débit préautorisé (PAD) — PayPal</h2>
              <div style={infoBox}>
                <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Accord de prélèvement automatique (Payments Canada Règle H1)</p>
                <p style={ps}>
                  Pour les renouvellements automatiques via PayPal Billing Agreements, les règles suivantes s'appliquent :
                </p>
                <ul style={{ paddingLeft: "1.5rem" }}>
                  <li style={lis}>Avis de <strong style={{ color: "#e2e8f0" }}>10 jours</strong> avant le premier débit ou tout changement de montant</li>
                  <li style={lis}>Révocation possible en tout temps avec un préavis de <strong style={{ color: "#e2e8f0" }}>30 jours</strong></li>
                  <li style={lis}>Remboursement disponible dans les <strong style={{ color: "#e2e8f0" }}>90 jours</strong> pour tout débit non autorisé</li>
                  <li style={lis}>Processeur : <strong style={{ color: "#e2e8f0" }}>PayPal Billing Agreements</strong></li>
                </ul>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.75rem" }}>
                  <Link to="/accord-preautorise-debit" style={{ color: "#22d3ee" }}>Voir l'accord complet de prélèvement préautorisé →</Link>
                </p>
              </div>
            </div>

            <div style={section}>
              <h2 style={h2s}>5. Cycle de facturation — ancrage mensuel fixe</h2>
              <p style={ps}>
                Chaque abonnement a une <strong style={{ color: "#e2e8f0" }}>date d'ancrage de facturation</strong> fixée au jour du mois de la première activation du service. Ce jour reste le même chaque mois pour toute la durée de l'abonnement.
              </p>
              <div style={infoBox}>
                <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Fonctionnement du cycle prépayé</p>
                <ul style={{ paddingLeft: "1.5rem" }}>
                  <li style={lis}><strong style={{ color: "#e2e8f0" }}>Renouvellement :</strong> le même jour chaque mois (ex. : activation le 15 → renouvellement le 15 de chaque mois)</li>
                  <li style={lis}><strong style={{ color: "#e2e8f0" }}>Facture émise :</strong> {CONTRACT_TERMS.billingCycle.invoiceGeneratedDaysBefore} jours avant la date d'ancrage (J-5)</li>
                  <li style={lis}><strong style={{ color: "#e2e8f0" }}>Paiement requis :</strong> AVANT la date d'ancrage (J0) pour renouveler le service</li>
                  <li style={lis}><strong style={{ color: "#e2e8f0" }}>Non-renouvellement :</strong> Si le paiement n'est pas confirmé au J0, le service devient Expiré</li>
                  <li style={lis}><strong style={{ color: "#e2e8f0" }}>Jours 29-31 :</strong> Si le mois ne contient pas ce jour, la facturation se fait le dernier jour du mois</li>
                </ul>
              </div>
              <p style={{ ...ps, marginTop: "0.5rem" }}>Devise : {CONTRACT_TERMS.paymentTerms.currency}</p>
            </div>

            <div style={section}>
              <h2 style={h2s}>6. Non-renouvellement et frais</h2>
              <div style={warnBox}>
                <p style={{ color: "#fbbf24", fontWeight: 600, marginBottom: "0.5rem" }}>
                  <span style={{ marginRight: "0.5rem" }}>⚠</span> Politique de non-renouvellement (prépayé)
                </p>
                <ul style={{ paddingLeft: "1.5rem" }}>
                  <li style={lis}>Si le paiement n'est pas confirmé au J0, le service devient <strong style={{ color: "#e2e8f0" }}>Expiré</strong></li>
                  <li style={lis}>E-Transfer en vérification au J0 : fenêtre de grâce de <strong style={{ color: "#e2e8f0" }}>{CONTRACT_TERMS.billingCycle.etransferGraceHours}h</strong> maximum</li>
                  <li style={lis}><strong style={{ color: "#e2e8f0" }}>Aucun intérêt ni frais</strong> pour un non-renouvellement prépayé normal</li>
                  <li style={lis}>Après 90 jours sans renouvellement : le numéro peut devenir irrécupérable</li>
                  <li style={lis}>Contestation bancaire / Chargeback : intérêt de <strong style={{ color: "#e2e8f0" }}>{CONTRACT_TERMS.disputeChargeback.interestRate}%</strong>/mois + frais de réactivation de <strong style={{ color: "#e2e8f0" }}>{CONTRACT_TERMS.disputeChargeback.reactivationFee}$</strong></li>
                </ul>
              </div>
            </div>

            <div style={section}>
              <h2 style={h2s}>7. Contestation de facturation</h2>
              <p style={ps}>
                Toute contestation de facturation doit être soumise dans les <strong style={{ color: "#e2e8f0" }}>10 jours</strong> suivant
                la réception de la facture via le portail client ou par courriel.
              </p>
            </div>

            <div style={section}>
              <h2 style={h2s}>8. Rétrofacturation et fraude</h2>
              <p style={ps}>Les rétrofacturations (chargebacks) non justifiées ou frauduleuses peuvent entraîner :</p>
              <ul style={{ paddingLeft: "1.5rem" }}>
                <li style={lis}>La suspension immédiate du compte</li>
                <li style={lis}>Des frais de traitement</li>
                <li style={lis}>La transmission du dossier aux autorités compétentes</li>
              </ul>
            </div>

            <div style={section}>
              <h2 style={h2s}>9. Prorata sur changement de forfait</h2>
              <p style={ps}>
                Depuis le <strong style={{ color: "#e2e8f0" }}>11 juin 2026</strong>, Nivra applique automatiquement un calcul au prorata lorsqu'un changement de forfait est approuvé et appliqué en cours de cycle.
              </p>
              <div style={infoBox}>
                <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Règles de prorata</p>
                <ul style={{ paddingLeft: "1.5rem" }}>
                  <li style={lis}>
                    <strong style={{ color: "#e2e8f0" }}>Upgrade :</strong> le montant proratisé est automatiquement ajouté comme ligne à votre <strong style={{ color: "#e2e8f0" }}>prochaine facture de renouvellement mensuelle</strong> (TPS + TVQ incluses). Aucune facture séparée n'est émise.
                    <br /><span style={{ color: "#475569", fontSize: "0.85rem" }}>Formule : (Nouveau prix − Ancien prix) × (jours restants dans le cycle ÷ jours réels du cycle, 28–31 jours)</span>
                  </li>
                  <li style={lis}>
                    <strong style={{ color: "#e2e8f0" }}>Downgrade :</strong> le nouveau tarif prend effet au prochain renouvellement. Aucun crédit prorata ni remboursement en espèces pour la période en cours.
                  </li>
                </ul>
              </div>
              <p style={{ color: "#475569", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                Le changement immédiat s'applique uniquement si « Appliquer immédiatement » est sélectionné lors de l'approbation. Sinon, le changement prend effet au prochain renouvellement sans prorata.
              </p>
            </div>

            <div style={section}>
              <h2 style={h2s}>Contact</h2>
              <ul style={{ paddingLeft: "1.5rem" }}>
                <li style={lis}><strong style={{ color: "#e2e8f0" }}>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li style={lis}><strong style={{ color: "#e2e8f0" }}>Adresse :</strong> {COMPANY_CONTACT.fullAddress}</li>
              </ul>
              <p style={{ ...ps, marginTop: "1rem" }}>
                <Link to="/conditions-de-service" style={{ color: "#22d3ee" }}>← Retour aux Conditions de service</Link>
                {" · "}
                <Link to="/accord-preautorise-debit" style={{ color: "#22d3ee" }}>Accord PAD →</Link>
                {" · "}
                <Link to="/refund-policy" style={{ color: "#22d3ee" }}>Politique de remboursement →</Link>
              </p>
            </div>

          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
