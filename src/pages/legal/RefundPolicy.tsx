import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PhotoBg } from "@/components/PhotoBg";
import { useLanguage } from "@/contexts/LanguageContext";
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
  border: "1px solid rgba(239,68,68,0.22)",
  borderRadius: 10,
  padding: "24px 28px",
} as const;

const section = { marginBottom: "2rem" } as const;
const h2s = { color: "#e2e8f0", fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.65rem" } as const;
const ps = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.65rem" } as const;
const lis = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.3rem" } as const;

export default function RefundPolicy() {
  const { language } = useLanguage();
  const isFrench = language === "fr";

  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80"
        opacity={0.12}
        filter="saturate(0.6) brightness(0.65)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Header />

      <main className="pt-24 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#06b6d4", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {isFrench ? "Remboursements · PAD · Prorata" : "Refunds · PAD · Prorated Billing"}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 tracking-tight text-foreground">
            {isFrench ? "Politique de remboursement" : "Refund Policy"}
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2rem" }}>
            {isFrench ? "Entrée en vigueur : 7 janvier 2025 · Dernière mise à jour : juin 2026" : "Effective: January 7, 2025 · Last updated: June 2026"}
          </p>

          <div style={{ ...infoBox, marginBottom: "2rem" }}>
            <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.35rem" }}>
              {isFrench ? "Contact — Demandes de remboursement" : "Contact — Refund Requests"}
            </p>
            <p style={ps}>
              <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmailDisplay}</a>
              {" — "}{COMPANY_CONTACT.fullAddress}
            </p>
          </div>

          <section style={{ ...section, fontSize: "0.93rem", lineHeight: 1.8 }}>

            {isFrench ? (
              <>
                <div style={section}>
                  <h2 style={h2s}>1. Portée</h2>
                  <p style={ps}>Cette politique s'applique aux achats effectués sur {COMPANY_CONTACT.companyName} ou via nos canaux autorisés :</p>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}>Forfaits et combos (mobile, internet, télévision)</li>
                    <li style={lis}>Frais de mise en service et d'activation</li>
                    <li style={lis}>Cartes SIM, eSIM, équipements et accessoires</li>
                    <li style={lis}>Frais d'installation et de rendez-vous (le cas échéant)</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>2. Principe général — services télécom prépayés</h2>
                  <p style={ps}>Les services télécom prépayés ou déjà activés sont généralement <strong style={{ color: "#e2e8f0" }}>non remboursables</strong>, sauf si :</p>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}>L'activation a échoué et le service n'a pas été fourni</li>
                    <li style={lis}>Une erreur de facturation est démontrée (double paiement, montant incorrect)</li>
                    <li style={lis}>La loi exige un remboursement ou un crédit</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>3. Abonnements mensuels</h2>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}>Vous pouvez annuler à tout moment via votre compte ou en contactant le support.</li>
                    <li style={lis}>L'annulation prend effet à la fin de la période de facturation en cours, sauf mention contraire dans votre offre.</li>
                    <li style={lis}>Aucun remboursement partiel n'est accordé pour une période déjà commencée, sauf exceptions prévues à la section 2.</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>4. Frais d'activation, mise en service et installation</h2>
                  <p style={ps}>
                    Ces frais sont <strong style={{ color: "#e2e8f0" }}>non remboursables</strong> une fois le travail engagé (réservation de technicien, configuration, activation, portabilité initiée), sauf si Nivra n'a pas pu fournir le service pour une raison imputable à Nivra.
                  </p>
                </div>

                <div style={section}>
                  <h2 style={h2s}>5. SIM, équipements et accessoires</h2>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}><strong style={{ color: "#e2e8f0" }}>Retour (changement d'avis) :</strong> accepté dans les 15 jours suivant la réception, si l'article est neuf, non utilisé, complet, dans son emballage d'origine.</li>
                    <li style={lis}><strong style={{ color: "#e2e8f0" }}>Défectueux à l'arrivée (DOA) :</strong> échange ou remplacement possible selon les conditions du fabricant et notre processus de vérification.</li>
                    <li style={lis}>Les frais de livraison initiaux ne sont pas remboursables, sauf erreur de notre part.</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>6. Paiements en attente / vérification (e-Transfer)</h2>
                  <p style={ps}>Si un paiement nécessite une vérification :</p>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}>La commande demeure en statut « En attente / Vérification » jusqu'à confirmation.</li>
                    <li style={lis}>Si le paiement n'est pas reçu ou confirmé dans un délai raisonnable, la commande peut être annulée sans activation.</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>7. Débit préautorisé (PAD) — Payments Canada Règle H1</h2>
                  <div style={infoBox}>
                    <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Fenêtre de remboursement PAD : 90 jours</p>
                    <p style={ps}>
                      Pour tout débit préautorisé non autorisé ou erroné effectué via PayPal Billing Agreements,
                      vous disposez d'une fenêtre de <strong style={{ color: "#e2e8f0" }}>90 jours</strong> à compter de la date du débit pour demander le remboursement complet du montant.
                    </p>
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                      Conformément à la Règle H1 de Payments Canada.{" "}
                      <Link to="/accord-preautorise-debit" style={{ color: "#22d3ee" }}>Voir l'accord PAD complet →</Link>
                    </p>
                  </div>
                </div>

                <div style={section}>
                  <h2 style={h2s}>8. Changements de forfait — prorata</h2>
                  <p style={ps}>Depuis le <strong style={{ color: "#e2e8f0" }}>11 juin 2026</strong>, tout changement de forfait approuvé et appliqué immédiatement en cours de cycle déclenche un calcul au prorata automatique :</p>
                  <div style={infoBox}>
                    <ul style={{ paddingLeft: "1.5rem" }}>
                      <li style={lis}><strong style={{ color: "#e2e8f0" }}>Upgrade :</strong> une <strong style={{ color: "#e2e8f0" }}>facture d'ajustement séparée</strong> est émise immédiatement pour le montant proratisé (différence de prix × jours restants ÷ jours réels du cycle, 28–31 jours), avec TPS + TVQ incluses. Un courriel de notification est envoyé avec lien de paiement vers le portail client.</li>
                      <li style={lis}><strong style={{ color: "#e2e8f0" }}>Downgrade :</strong> le nouveau tarif prend effet au prochain renouvellement. <strong style={{ color: "#e2e8f0" }}>Aucun crédit prorata ni remboursement en espèces</strong> n'est accordé pour la période en cours.</li>
                      <li style={lis}><strong style={{ color: "#e2e8f0" }}>Le cycle en cours n'est pas remboursable</strong> si l'annulation du service se fait en cours de cycle, sauf obligation légale ou erreur de facturation.</li>
                    </ul>
                  </div>
                </div>

                <div style={section}>
                  <h2 style={h2s}>9. Contestations (chargebacks)</h2>
                  <div style={dangerBox}>
                    <p style={{ color: "#f87171", fontWeight: 600, marginBottom: "0.5rem" }}>Contactez-nous AVANT de contacter votre banque</p>
                    <p style={{ color: "#94a3b8", margin: 0 }}>
                      Avant toute contestation auprès de votre institution financière, contactez-nous à{" "}
                      <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmailDisplay}</a>.
                      En cas de contestation abusive ou de fraude présumée, Nivra peut suspendre temporairement le service.
                    </p>
                  </div>
                </div>

                <div style={section}>
                  <h2 style={h2s}>10. Comment demander un remboursement</h2>
                  <div style={infoBox}>
                    <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Informations requises</p>
                    <ul style={{ paddingLeft: "1.5rem" }}>
                      <li style={lis}>Nom complet et numéro de compte</li>
                      <li style={lis}>Numéro de commande ou de facture</li>
                      <li style={lis}>Service concerné et motif de la demande</li>
                      <li style={lis}>Preuve à l'appui (si applicable)</li>
                    </ul>
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.75rem" }}>
                      <strong style={{ color: "#e2e8f0" }}>Délai de traitement :</strong> 5 à 10 jours ouvrables après réception des informations complètes.
                      Les remboursements sont effectués via le même moyen de paiement (quand possible).
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={section}>
                  <h2 style={h2s}>1. Scope</h2>
                  <p style={ps}>This policy applies to purchases made on {COMPANY_CONTACT.companyName} or through our authorized channels:</p>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}>Plans and bundles (mobile, internet, television)</li>
                    <li style={lis}>Setup and activation fees</li>
                    <li style={lis}>SIM cards, eSIM, equipment and accessories</li>
                    <li style={lis}>Installation and appointment fees (where applicable)</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>2. General Principle — Prepaid Telecom Services</h2>
                  <p style={ps}>Prepaid or already activated telecom services are generally <strong style={{ color: "#e2e8f0" }}>non-refundable</strong>, unless:</p>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}>Activation failed and the service was not provided</li>
                    <li style={lis}>A billing error is demonstrated (double payment, incorrect amount)</li>
                    <li style={lis}>The law requires a refund or credit</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>3. Monthly Subscriptions</h2>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}>You can cancel at any time through your account or by contacting support.</li>
                    <li style={lis}>Cancellation takes effect at the end of the current billing period, unless otherwise stated in your offer.</li>
                    <li style={lis}>No partial refund is granted for a period already started, except as provided in section 2.</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>4. Activation, Setup and Installation Fees</h2>
                  <p style={ps}>
                    These fees are <strong style={{ color: "#e2e8f0" }}>non-refundable</strong> once work has begun (technician booking, configuration, activation, porting initiated), unless Nivra was unable to provide the service for a reason attributable to Nivra.
                  </p>
                </div>

                <div style={section}>
                  <h2 style={h2s}>5. SIM, Equipment and Accessories</h2>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}><strong style={{ color: "#e2e8f0" }}>Return (change of mind):</strong> accepted within 15 days of receipt, if the item is new, unused, complete, in its original packaging.</li>
                    <li style={lis}><strong style={{ color: "#e2e8f0" }}>Dead on Arrival (DOA):</strong> exchange or replacement possible according to manufacturer conditions and our verification process.</li>
                    <li style={lis}>Initial delivery fees are non-refundable, except for our error.</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>6. Pending Payments / Verification (e-Transfer)</h2>
                  <p style={ps}>If a payment requires verification:</p>
                  <ul style={{ paddingLeft: "1.5rem" }}>
                    <li style={lis}>The order remains in "Pending / Verification" status until confirmed.</li>
                    <li style={lis}>If payment is not received or confirmed within a reasonable time, the order may be cancelled without activation.</li>
                  </ul>
                </div>

                <div style={section}>
                  <h2 style={h2s}>7. Pre-Authorized Debit (PAD) — Payments Canada Rule H1</h2>
                  <div style={infoBox}>
                    <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>PAD Reimbursement Window: 90 Days</p>
                    <p style={ps}>
                      For any unauthorized or erroneous pre-authorized debit made via PayPal Billing Agreements,
                      you have <strong style={{ color: "#e2e8f0" }}>90 days</strong> from the date of the debit to request a full reimbursement.
                    </p>
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                      Per Payments Canada Rule H1.{" "}
                      <Link to="/accord-preautorise-debit" style={{ color: "#22d3ee" }}>View full PAD agreement →</Link>
                    </p>
                  </div>
                </div>

                <div style={section}>
                  <h2 style={h2s}>8. Plan Changes — Prorated Billing</h2>
                  <p style={ps}>Effective <strong style={{ color: "#e2e8f0" }}>June 11, 2026</strong>, any approved plan change applied immediately mid-cycle triggers an automatic prorated calculation:</p>
                  <div style={infoBox}>
                    <ul style={{ paddingLeft: "1.5rem" }}>
                      <li style={lis}><strong style={{ color: "#e2e8f0" }}>Upgrade:</strong> a <strong style={{ color: "#e2e8f0" }}>separate adjustment invoice</strong> is issued immediately for the prorated amount (price difference × days remaining ÷ actual cycle days, 28–31 days), with GST + QST included. A notification email is sent with a payment link to your client portal.</li>
                      <li style={lis}><strong style={{ color: "#e2e8f0" }}>Downgrade:</strong> the new rate takes effect at the next renewal. <strong style={{ color: "#e2e8f0" }}>No prorated credit or cash refund</strong> is issued for the current billing period.</li>
                      <li style={lis}><strong style={{ color: "#e2e8f0" }}>The current cycle is not refundable</strong> if service is cancelled mid-cycle, except as required by law or confirmed billing error.</li>
                    </ul>
                  </div>
                </div>

                <div style={section}>
                  <h2 style={h2s}>9. Disputes (Chargebacks)</h2>
                  <div style={dangerBox}>
                    <p style={{ color: "#f87171", fontWeight: 600, marginBottom: "0.5rem" }}>Contact us BEFORE contacting your bank</p>
                    <p style={{ color: "#94a3b8", margin: 0 }}>
                      Before any dispute with your financial institution, contact us at{" "}
                      <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmailDisplay}</a>.
                      In case of abusive dispute or suspected fraud, Nivra may temporarily suspend service.
                    </p>
                  </div>
                </div>

                <div style={section}>
                  <h2 style={h2s}>10. How to Request a Refund</h2>
                  <div style={infoBox}>
                    <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Required Information</p>
                    <ul style={{ paddingLeft: "1.5rem" }}>
                      <li style={lis}>Full name and account number</li>
                      <li style={lis}>Order or invoice number</li>
                      <li style={lis}>Service concerned and reason for request</li>
                      <li style={lis}>Supporting proof (if applicable)</li>
                    </ul>
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.75rem" }}>
                      <strong style={{ color: "#e2e8f0" }}>Processing time:</strong> 5–10 business days after receiving complete information.
                      Refunds are made via the same payment method (when possible).
                    </p>
                  </div>
                </div>
              </>
            )}

            <div style={section}>
              <p style={{ color: "#475569", fontSize: "0.85rem" }}>
                <Link to="/modalites-paiement" style={{ color: "#22d3ee" }}>← Modalités de paiement</Link>
                {" · "}
                <Link to="/accord-preautorise-debit" style={{ color: "#22d3ee" }}>Accord PAD</Link>
                {" · "}
                <Link to="/support-et-plaintes" style={{ color: "#22d3ee" }}>Support & plaintes</Link>
              </p>
            </div>

          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
