import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Info, AlertTriangle } from "lucide-react";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { useCanonicalFees } from "@/hooks/useCanonicalFees";
import { useEquipmentPrices } from "@/hooks/usePublicServices";

const FraisPossibles = () => {
  const fees = useCanonicalFees();
  const equipment = useEquipmentPrices();

  // Use canonical DB values with CONTRACT_TERMS as fallback for legal/policy items
  const activationSingle = fees.activationSingle || CONTRACT_TERMS.fees.activationSingle;
  const activationMultiple = fees.activationBundle || CONTRACT_TERMS.fees.activationMultiple;
  const delivery = fees.deliveryStandard || CONTRACT_TERMS.fees.delivery;
  const uberExpress = fees.deliveryUber || CONTRACT_TERMS.fees.uberExpress;
  const router = equipment.routerPrice;
  const tvTerminal = equipment.terminalPrice;
  const sim = equipment.simPrice;
  const esim = equipment.esimPrice;

  // Old → new prices map for "NOUVEAU" highlight
  const OLD_PRICES: Record<string, number> = {
    "Activation (1 service)": 25,
    "Livraison standard": 30,
    "Installation par technicien": 50,
  };

  const oneTimeFees = [
    { name: "Activation (1 service)", amount: `${activationSingle}$`, note: "Internet, TV ou Mobile seul" },
    { name: "Activation (2+ services)", amount: `${activationMultiple}$`, note: "Forfait groupé (Internet + TV + Mobile)" },
    { name: "Livraison standard", amount: `${delivery}$`, note: "Auto-installation — délai 2 à 5 jours ouvrables" },
    { name: "Installation par technicien", amount: `${fees.installationTechnician || 25}$`, note: "Visite à domicile — sur rendez-vous" },
    { name: "Livraison express (Uber)", amount: `${uberExpress}$`, note: "Zones éligibles seulement" },
    { name: "Routeur Nivra Born WiFi", amount: `${router}$`, note: "Achat, inclus garantie 1 an" },
    { name: "Terminal Nivra 4K Smart", amount: `${tvTerminal}$`, note: "Par terminal (max 4)" },
    { name: "Carte SIM physique", amount: `${sim}$`, note: "Activation ou remplacement" },
    { name: "eSIM", amount: `${esim}$`, note: "Activation ou remplacement" },
  ];

  const conditionalFees = [
    { 
      name: "Installation standard", 
      amount: "Selon commande/facture", 
      condition: "Internet/TV nécessitant technicien" 
    },
    { 
      name: "Installation complexe", 
      amount: "Selon commande/facture", 
      condition: "Câblage additionnel, configuration spéciale" 
    },
    { 
      name: "Technicien — absence client", 
      amount: "Selon commande/facture", 
      condition: "Client absent au rendez-vous confirmé" 
    },
    { 
      name: "Équipement non retourné", 
      amount: "Variable (validation Admin)", 
      condition: `Si non retourné dans les ${CONTRACT_TERMS.cancellation.returnDays} jours après annulation` 
    },
    { 
      name: "Remplacement équipement (hors garantie)", 
      amount: "Selon commande/facture", 
      condition: "Bris, perte, vol, dommages liquides" 
    },
  ];

  const disputeOnlyFees = [
    { 
      name: "Intérêt sur montants contestés", 
      amount: `${CONTRACT_TERMS.disputeChargeback.interestRate}% / mois`, 
      condition: "Sur montants dus suite à contestation bancaire/chargeback confirmée contre le client" 
    },
    { 
      name: "Frais de réactivation", 
      amount: `${CONTRACT_TERMS.disputeChargeback.reactivationFee}$`, 
      condition: "Après résolution de contestation bancaire/chargeback et paiement complet" 
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Frais possibles
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Transparence sur les frais qui peuvent s'appliquer à votre compte.
          </p>

          <Card className="bg-primary/10 border-primary/30 mb-6">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Nouveaux tarifs en vigueur</h3>
                  <p className="text-sm text-muted-foreground">
                    Nous avons réduit nos frais pour rendre Nivra encore plus accessible : <strong>activation à 10 $</strong>,{" "}
                    <strong>livraison à 20 $</strong>, <strong>technicien à 25 $</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-cyan-500/10 border-cyan-500/30 mb-8">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Services prépayés</h3>
                  <p className="text-sm text-muted-foreground">
                    Nivra fonctionne sur un modèle <strong>prépayé</strong>. Vous payez à l'avance par cycle de service. 
                    Le renouvellement s'effectue uniquement si le paiement est reçu et confirmé. 
                    Pas de surprise — les montants sont confirmés avant paiement.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            {/* Frais uniques */}
            <section>
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">
                Frais uniques (à la commande)
              </h2>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-foreground">Description</th>
                      <th className="text-right p-4 font-medium text-foreground">Montant</th>
                      <th className="text-left p-4 font-medium text-foreground hidden sm:table-cell">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {oneTimeFees.map((fee, index) => {
                      const oldPrice = OLD_PRICES[fee.name];
                      return (
                        <tr key={index} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4 text-foreground">{fee.name}</td>
                          <td className="p-4 text-right font-mono font-medium">
                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                              {oldPrice && (
                                <span className="text-xs text-muted-foreground line-through">{oldPrice}$</span>
                              )}
                              <span className="text-accent">{fee.amount}</span>
                              {oldPrice && (
                                <span className="text-[9px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Nouveau</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground hidden sm:table-cell">{fee.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Frais conditionnels */}
            <section>
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">
                Frais conditionnels
              </h2>
              <p className="text-muted-foreground mb-4">
                Ces frais s'appliquent dans certaines situations. Les montants exacts sont confirmés 
                sur votre commande ou facture.
              </p>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-foreground">Description</th>
                      <th className="text-right p-4 font-medium text-foreground">Montant</th>
                      <th className="text-left p-4 font-medium text-foreground hidden sm:table-cell">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {conditionalFees.map((fee, index) => (
                      <tr key={index} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-foreground">{fee.name}</td>
                        <td className="p-4 text-right font-mono text-accent font-medium">{fee.amount}</td>
                        <td className="p-4 text-sm text-muted-foreground hidden sm:table-cell">{fee.condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Taxes */}
            <section>
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">
                Taxes applicables
              </h2>
              <Card className="bg-muted/30 border-border">
                <CardContent className="p-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">TPS (fédérale)</p>
                      <p className="text-lg font-medium text-foreground">5%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">TVQ (Québec)</p>
                      <p className="text-lg font-medium text-foreground">9.975%</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    Les taxes sont calculées et affichées avant la confirmation de paiement.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Cycle de facturation prépayé */}
            <section>
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">
                Cycle de facturation prépayé
              </h2>
              <Card className="bg-cyan-500/10 border-cyan-500/30 mb-4">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Fonctionnement du Bill Cycle</h3>
                      <ul className="space-y-2 text-sm">
                        <li>
                          <strong>Bill Cycle Day :</strong> Chaque compte a un jour de cycle (jour du mois défini à la création du compte).
                        </li>
                        <li>
                          <strong>Facture émise :</strong> {CONTRACT_TERMS.billingCycle.invoiceGeneratedDaysBefore} jours avant le Bill Cycle (J-5).
                        </li>
                        <li>
                          <strong>Paiement requis :</strong> Avant la date du Bill Cycle (J0) pour renouveler le service.
                        </li>
                        <li>
                          <strong>Si jour inexistant :</strong> Pour les jours 29-31, le système utilise le dernier jour du mois.
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-amber-500/10 border-amber-500/30 mb-4">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Non-renouvellement prépayé (aucun intérêt/frais)</h3>
                      <ul className="space-y-2 text-sm">
                        <li>
                          <strong>Non-renouvellement :</strong> Si le paiement n'est pas reçu au Bill Cycle (J0), 
                          le service devient <strong>Expiré (non-renouvelé)</strong>.
                        </li>
                        <li>
                          <strong>Aucun intérêt ni frais de réactivation</strong> ne s'applique simplement parce que le paiement n'a pas été reçu au Bill Cycle.
                        </li>
                        <li>
                          <strong>E-Transfer en vérification :</strong> Fenêtre de grâce de{" "}
                          <strong>{CONTRACT_TERMS.billingCycle.etransferGraceHours} heures</strong> maximum au J0. 
                          Aucun intérêt ni frais ne s'applique.
                        </li>
                        <li>
                          <strong>Après 90 jours sans renouvellement :</strong> Le numéro de téléphone peut devenir 
                          irrécupérable. Une réactivation exigera l'attribution d'un nouveau numéro.
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dispute/Chargeback penalties */}
              <Card className="bg-red-500/10 border-red-500/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Contestation bancaire / Chargeback (pénalités applicables)</h3>
                      <ul className="space-y-2 text-sm">
                        <li>
                          <strong>Suspension pendant enquête :</strong> En cas de contestation bancaire ou chargeback, 
                          le service peut être suspendu pendant l'enquête.
                        </li>
                        <li>
                          <strong>Intérêt :</strong> Si la contestation est confirmée contre le client OU si Nivra est débité, 
                          un intérêt de <strong>{CONTRACT_TERMS.disputeChargeback.interestRate}% par mois</strong> s'applique 
                          sur les montants dus jusqu'au paiement complet.
                        </li>
                        <li>
                          <strong>Frais de réactivation :</strong> Après paiement complet et résolution, des frais de{" "}
                          <strong>{CONTRACT_TERMS.disputeChargeback.reactivationFee}$</strong> peuvent s'appliquer pour rétablir le service.
                        </li>
                      </ul>
                      <div className="bg-card border border-border rounded-lg p-4 mt-4">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium text-foreground text-xs">Description</th>
                              <th className="text-right p-2 font-medium text-foreground text-xs">Montant</th>
                              <th className="text-left p-2 font-medium text-foreground text-xs hidden sm:table-cell">Condition</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {disputeOnlyFees.map((fee, index) => (
                              <tr key={index} className="hover:bg-muted/30 transition-colors">
                                <td className="p-2 text-foreground text-sm">{fee.name}</td>
                                <td className="p-2 text-right font-mono text-red-500 font-medium text-sm">{fee.amount}</td>
                                <td className="p-2 text-xs text-muted-foreground hidden sm:table-cell">{fee.condition}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Prix à confirmer */}
            <section>
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">
                Prix à confirmer / erreurs d'affichage
              </h2>
              <p className="text-muted-foreground">
                En cas d'erreur d'affichage sur le site, le prix applicable est celui indiqué sur 
                la <strong>confirmation de commande</strong> et/ou la <strong>facture</strong>. 
                Nous nous efforçons de maintenir des prix exacts, mais des erreurs peuvent survenir.
              </p>
            </section>

            {/* Contestation */}
            <section>
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">
                Contestation de facturation
              </h2>
              <p className="text-muted-foreground">
                Toute contestation doit être soumise dans les <strong>10 jours</strong> suivant 
                la réception de la facture. Ouvrez un ticket via le portail client avec le sujet 
                « Contestation de facturation ».
              </p>
              <p className="mt-4">
                <Link to="/conditions-de-service" className="text-primary hover:underline">
                  Voir les conditions complètes (contestations) →
                </Link>
              </p>
            </section>

            <section className="pt-4">
              <p className="text-sm">
                <Link to="/conditions-de-service" className="text-primary hover:underline">
                  ← Retour aux Conditions de service
                </Link>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FraisPossibles;
