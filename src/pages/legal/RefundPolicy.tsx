import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";

const RefundPolicy = () => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';

  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <div aria-hidden style={{ position: 'absolute', top: '-10%', right: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-10%', left: '-6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            {isFrench ? 'Politique de remboursement' : 'Refund Policy'}
          </h1>
          
          <p className="text-muted-foreground mb-8">
            {isFrench ? 'Dernière mise à jour : 2026-06-05' : 'Last updated: 2026-06-05'}
          </p>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            {isFrench ? (
              <>
                <section className="space-y-4">
                  <p className="text-lg font-medium text-foreground">
                    <strong>Date d'entrée en vigueur :</strong> 2025-01-07
                  </p>
                  <p>
                    <strong>Contact :</strong>{" "}
                    <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} className="text-primary hover:underline">
                      {COMPANY_CONTACT.supportEmailDisplay}
                    </a>{" "}
                    | {COMPANY_CONTACT.fullAddress}
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.1 Portée</h2>
                  <p>
                    Cette politique s'applique aux achats effectués sur le site {COMPANY_CONTACT.companyName} ou via nos canaux de paiement autorisés, incluant :
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Forfaits et combos (mobile, internet, télévision, sécurité connectée)</li>
                    <li>Frais de mise en service/activation</li>
                    <li>Cartes SIM, équipements et accessoires</li>
                    <li>Frais de livraison/pickup, installation et rendez-vous (le cas échéant)</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.2 Principe général (services télécom)</h2>
                  <p>
                    Les services télécom prépayés ou déjà activés sont généralement non remboursables, sauf si :
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>l'activation a échoué et le service n'a pas été fourni,</li>
                    <li>une erreur de facturation est démontrée (double paiement, montant incorrect),</li>
                    <li>la loi exige un remboursement ou un crédit.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.3 Abonnements mensuels</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Tu peux annuler à tout moment via ton compte ou en contactant le support.</li>
                    <li>L'annulation prend effet à la fin de la période de facturation en cours, sauf mention contraire dans ton offre.</li>
                    <li>Aucun remboursement partiel n'est généralement accordé pour une période déjà commencée, sauf exceptions prévues à la section 1.2.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.4 Frais d'activation, mise en service et installation</h2>
                  <p>
                    Les frais d'activation/mise en service et certains frais d'installation/rendez-vous sont non remboursables une fois le travail engagé (ex. réservation de technicien, configuration, activation, portabilité initiée), sauf si Nivra n'a pas pu fournir le service pour une raison imputable à Nivra.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.5 SIM, équipements et accessoires</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Retour (changement d'avis) :</strong> accepté dans les 15 jours suivant la réception, si l'article est neuf, non utilisé, complet, dans son emballage d'origine.</li>
                    <li><strong>Défectueux à l'arrivée (DOA) :</strong> échange/remplacement possible selon les conditions du fabricant et notre processus de vérification.</li>
                    <li>Les frais de livraison initiaux ne sont pas remboursables, sauf erreur de notre part.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.6 Paiements en attente / vérification (ex. e-Transfer)</h2>
                  <p>Si un paiement nécessite une vérification (ex. e-Transfer) :</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>la commande demeure en statut "En attente / Vérification" jusqu'à confirmation;</li>
                    <li>si le paiement n'est pas reçu ou confirmé dans un délai raisonnable, la commande peut être annulée sans activation.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.7 Contestations (chargebacks)</h2>
                  <p>
                    Avant toute contestation auprès de la banque, contacte-nous :{" "}
                    <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} className="text-primary hover:underline">
                      {COMPANY_CONTACT.supportEmailDisplay}
                    </a>.
                  </p>
                  <p>
                    En cas de contestation abusive ou de fraude présumée, Nivra peut suspendre temporairement le service, dans la mesure permise.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.8 Changements de forfait (prorata)</h2>
                  <p>
                    Depuis le <strong>5 juin 2026</strong>, tout changement de forfait approuvé et appliqué immédiatement en cours de cycle déclenche un calcul au prorata automatique :
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong>Upgrade :</strong> une ligne prorata est ajoutée à la facture de renouvellement en cours pour la différence de prix (TPS et TVQ recalculées sur le nouveau sous-total). Le montant total de la facture est mis à jour automatiquement.
                    </li>
                    <li>
                      <strong>Downgrade :</strong> un crédit prorata apparaît comme ligne de rabais sur la facture de renouvellement en cours (ou la prochaine si non encore générée), réduisant directement le montant dû. Aucun remboursement en espèces n'est effectué.
                    </li>
                    <li>
                      <strong>Le cycle en cours n'est pas remboursable</strong> si l'annulation du service se fait en cours de cycle, sauf obligation légale ou erreur de facturation confirmée.
                    </li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.9 Comment demander un remboursement</h2>
                  <p>
                    Envoie : nom complet, numéro de commande/facture, service concerné, motif, preuve (au besoin).
                  </p>
                  <p>
                    <strong>Délais :</strong> nous visons un traitement sous 5 à 10 jours ouvrables après réception des informations complètes.
                  </p>
                  <p>
                    Les remboursements sont effectués via le même moyen de paiement (quand possible).
                  </p>
                </section>
              </>
            ) : (
              <>
                <section className="space-y-4">
                  <p className="text-lg font-medium text-foreground">
                    <strong>Effective Date:</strong> 2025-01-07
                  </p>
                  <p>
                    <strong>Contact:</strong>{" "}
                    <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} className="text-primary hover:underline">
                      {COMPANY_CONTACT.supportEmailDisplay}
                    </a>{" "}
                    | {COMPANY_CONTACT.fullAddress}
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.1 Scope</h2>
                  <p>
                    This policy applies to purchases made on the {COMPANY_CONTACT.companyName} website or through our authorized payment channels, including:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Plans and bundles (mobile, internet, television, connected security)</li>
                    <li>Setup/activation fees</li>
                    <li>SIM cards, equipment and accessories</li>
                    <li>Delivery/pickup, installation and appointment fees (where applicable)</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.2 General Principle (Telecom Services)</h2>
                  <p>
                    Prepaid or already activated telecom services are generally non-refundable, unless:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>activation failed and the service was not provided,</li>
                    <li>a billing error is demonstrated (double payment, incorrect amount),</li>
                    <li>the law requires a refund or credit.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.3 Monthly Subscriptions</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>You can cancel at any time through your account or by contacting support.</li>
                    <li>Cancellation takes effect at the end of the current billing period, unless otherwise stated in your offer.</li>
                    <li>No partial refund is generally granted for a period already started, except as provided in section 1.2.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.4 Activation, Setup and Installation Fees</h2>
                  <p>
                    Activation/setup fees and certain installation/appointment fees are non-refundable once work has begun (e.g., technician booking, configuration, activation, porting initiated), unless Nivra was unable to provide the service for a reason attributable to Nivra.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.5 SIM, Equipment and Accessories</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Return (change of mind):</strong> accepted within 15 days of receipt, if the item is new, unused, complete, in its original packaging.</li>
                    <li><strong>Dead on Arrival (DOA):</strong> exchange/replacement possible according to manufacturer conditions and our verification process.</li>
                    <li>Initial delivery fees are non-refundable, except for our error.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.6 Pending Payments / Verification (e.g., e-Transfer)</h2>
                  <p>If a payment requires verification (e.g., e-Transfer):</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>the order remains in "Pending / Verification" status until confirmed;</li>
                    <li>if payment is not received or confirmed within a reasonable time, the order may be cancelled without activation.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.7 Disputes (Chargebacks)</h2>
                  <p>
                    Before any dispute with your bank, contact us:{" "}
                    <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} className="text-primary hover:underline">
                      {COMPANY_CONTACT.supportEmailDisplay}
                    </a>.
                  </p>
                  <p>
                    In case of abusive dispute or suspected fraud, Nivra may temporarily suspend service, to the extent permitted.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.8 Plan Changes (Prorated Billing)</h2>
                  <p>
                    Effective <strong>June 5, 2026</strong>, any approved plan change applied immediately mid-cycle triggers an automatic prorated calculation:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong>Upgrade:</strong> a prorated line is added to the current renewal invoice for the price difference (TPS and TVQ recalculated on the new subtotal). The invoice total is updated automatically.
                    </li>
                    <li>
                      <strong>Downgrade:</strong> a prorated credit appears as a discount line on the current renewal invoice (or the next one if not yet generated), directly reducing the amount due. No cash refund is issued.
                    </li>
                    <li>
                      <strong>The current cycle is not refundable</strong> if service is cancelled mid-cycle, except as required by law or confirmed billing error.
                    </li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">1.9 How to Request a Refund</h2>
                  <p>
                    Send: full name, order/invoice number, service concerned, reason, proof (if needed).
                  </p>
                  <p>
                    <strong>Timeline:</strong> we aim to process within 5 to 10 business days after receiving complete information.
                  </p>
                  <p>
                    Refunds are made via the same payment method (when possible).
                  </p>
                </section>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default RefundPolicy;