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

const ModalitesPaiement = () => {
  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&q=80"
        opacity={0.13}
        filter="saturate(0.7) brightness(0.65)"
      />
      <div aria-hidden style={{ position: 'absolute', top: '-10%', right: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-10%', left: '-6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <Header />

      <main className="pt-24 pb-16" style={{ position: 'relative', zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
            Modalités de paiement
          </h1>

          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-lg">
              Dernière mise à jour : {CONTRACT_TERMS.lastUpdated}
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Services prépayés</h2>
              <p>
                Tous les services Nivra sont facturés à l'avance par cycle de service.
                Le renouvellement s'effectue uniquement si le paiement est reçu et confirmé.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Vous pouvez annuler à tout moment — le service reste actif jusqu'à la fin de la période payée.</li>
                <li>Le cycle en cours n'est pas remboursable, sauf obligation légale ou erreur de facturation confirmée.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Moyens de paiement acceptés</h2>
              <ul className="list-disc pl-6 space-y-2">
                {CONTRACT_TERMS.paymentTerms.acceptedMethods.map((method, index) => (
                  <li key={index}>{method}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Paiement par Virement Interac (e-Transfer)</h2>
              <div style={infoBox}>
                <h3 className="font-semibold text-foreground mb-4">Instructions e-Transfer</h3>
                <ul className="list-none space-y-2">
                  <li><strong>Courriel de destination :</strong> {ETRANSFER_CONFIG.emailDisplay}</li>
                  <li><strong>Question de sécurité :</strong> {ETRANSFER_CONFIG.securityQuestion}</li>
                  <li><strong>Réponse :</strong> {ETRANSFER_CONFIG.securityAnswer}</li>
                </ul>
                <p className="mt-4 text-sm">
                  <strong>Important :</strong> Incluez votre numéro de commande ou numéro de compte dans le message du virement.
                </p>
              </div>

              <h3 className="text-xl font-display font-bold text-foreground mt-6">Statuts de paiement e-Transfer</h3>
              <p>Après l'envoi de votre virement, votre paiement passera par les statuts suivants :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Pending (En attente) :</strong> Virement envoyé, en attente de réception</li>
                <li><strong>In verification (En vérification) :</strong> Virement reçu, en cours de validation</li>
                <li><strong>Complete (Complété) :</strong> Paiement confirmé, service activé/renouvelé</li>
                <li><strong>Declined (Refusé) :</strong> Virement refusé ou annulé</li>
                <li><strong>Fraud (Fraude) :</strong> Activité suspecte détectée — compte suspendu</li>
              </ul>
              <p className="text-sm text-muted-foreground/70">
                L'activation du service s'effectue après réception et vérification du virement.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Cycle de facturation (Bill Cycle)</h2>
              <p>
                Chaque compte a un <strong>Bill Cycle Day</strong> (jour du mois) défini par défaut à la date de création du compte.
              </p>
              <div style={infoBox}>
                <h3 className="font-semibold text-foreground mb-3">Fonctionnement du cycle prépayé</h3>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li><strong>Facture émise :</strong> {CONTRACT_TERMS.billingCycle.invoiceGeneratedDaysBefore} jours avant le Bill Cycle (J-5)</li>
                  <li><strong>Paiement requis :</strong> AVANT la date du Bill Cycle (J0) pour renouveler le service</li>
                  <li><strong>Non-renouvellement :</strong> Si le paiement n'est pas confirmé au J0, le service devient Expiré</li>
                  <li><strong>Jours 29-31 :</strong> Si le mois ne contient pas ce jour, la facturation se fait le dernier jour du mois</li>
                </ul>
              </div>
              <ul className="list-disc pl-6 space-y-2">
                <li>Devise : {CONTRACT_TERMS.paymentTerms.currency}</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Non-renouvellement et frais</h2>
              <div style={warnBox}>
                <div className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(245,158,11)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Politique de non-renouvellement (prépayé)</h3>
                    <ul className="list-disc pl-6 space-y-2 text-sm">
                      <li><strong>Non-renouvellement :</strong> Si le paiement n'est pas confirmé au Bill Cycle (J0), le service devient Expiré</li>
                      <li><strong>E-Transfer en vérification au J0 :</strong> Fenêtre de grâce de <strong>{CONTRACT_TERMS.billingCycle.etransferGraceHours} heures</strong> maximum</li>
                      <li><strong>Aucun intérêt/frais</strong> pour un non-renouvellement prépayé normal</li>
                      <li><strong>Après 90 jours sans renouvellement :</strong> Le numéro peut devenir irrécupérable (nouveau numéro requis)</li>
                      <li><strong>Contestation bancaire/Chargeback :</strong> Intérêt de <strong>{CONTRACT_TERMS.disputeChargeback.interestRate}%</strong> par mois + frais de réactivation de <strong>{CONTRACT_TERMS.disputeChargeback.reactivationFee}$</strong> (UNIQUEMENT pour disputes/chargebacks)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. Contestation de facturation</h2>
              <p>
                Toute contestation de facturation doit être soumise dans les <strong>10 jours</strong> suivant
                la réception de la facture via le portail client ou par courriel.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">7. Rétrofacturation et fraude</h2>
              <p>
                Les rétrofacturations (chargebacks) non justifiées ou frauduleuses peuvent entraîner :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>La suspension immédiate du compte</li>
                <li>Des frais de traitement</li>
                <li>La transmission du dossier aux autorités compétentes</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">8. Prorata sur changement de forfait</h2>
              <p>
                Depuis le <strong>5 juin 2026</strong>, Nivra applique automatiquement un calcul au prorata lorsqu'un changement de forfait est approuvé et appliqué en cours de cycle.
              </p>
              <div style={infoBox}>
                <h3 className="font-semibold text-foreground mb-3">Règles de prorata</h3>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li>
                    <strong>Upgrade (passage à un forfait supérieur) :</strong> une ligne de facturation prorata est ajoutée à la facture de renouvellement en cours pour la différence de prix, calculée au prorata des jours restants dans le cycle. Le total de la facture est mis à jour en conséquence (TPS et TVQ incluses).
                    <br />
                    <em>Formule : (Nouveau prix − Ancien prix) ÷ 30 × Jours restants dans le cycle</em>
                  </li>
                  <li>
                    <strong>Downgrade (passage à un forfait inférieur) :</strong> un crédit prorata est ajouté à la facture de renouvellement en cours (ou sur la prochaine facture si la facture courante n'est pas encore générée). Le crédit apparaît comme ligne de rabais et réduit le total dû.
                    <br />
                    <em>Formule : (Ancien prix − Nouveau prix) ÷ 30 × Jours restants dans le cycle</em>
                  </li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground/70">
                Le changement de forfait effectif immédiatement s'applique uniquement si l'option "Appliquer immédiatement" est sélectionnée lors de l'approbation. Sinon, le changement prend effet au prochain renouvellement sans prorata.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">Contact</h2>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li><strong>Téléphone :</strong> {COMPANY_CONTACT.supportPhoneDisplay}</li>
              </ul>
            </section>

            <section className="space-y-4">
              <p className="text-sm">
                <Link to="/conditions-de-service" className="text-primary hover:underline">← Retour aux Conditions de service</Link>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ModalitesPaiement;
