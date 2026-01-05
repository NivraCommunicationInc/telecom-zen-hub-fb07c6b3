import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Info, AlertTriangle } from "lucide-react";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";

const FraisPossibles = () => {
  const oneTimeFees = [
    { name: "Activation", amount: `${CONTRACT_TERMS.fees.activation}$`, note: "Par nouveau service" },
    { name: "Livraison standard", amount: `${CONTRACT_TERMS.fees.delivery}$`, note: "Délai 24-78h ouvrables" },
    { name: "Livraison express (Uber)", amount: `${CONTRACT_TERMS.fees.uberExpress}$`, note: "Zones éligibles seulement" },
    { name: "Routeur Nivra Born WiFi", amount: `${CONTRACT_TERMS.fees.router}$`, note: "Achat, inclus garantie 1 an" },
    { name: "Terminal Nivra 4K Smart", amount: `${CONTRACT_TERMS.fees.tvTerminal}$`, note: "Par terminal (max 4)" },
    { name: "Carte SIM physique", amount: `${CONTRACT_TERMS.fees.simPhysical}$`, note: "Activation ou remplacement" },
    { name: "eSIM", amount: `${CONTRACT_TERMS.fees.esim}$`, note: "Activation ou remplacement" },
  ];

  const conditionalFees = [
    { 
      name: "Frais de réactivation", 
      amount: `${CONTRACT_TERMS.fees.reactivation}$`, 
      condition: "Après suspension pour non-paiement" 
    },
    { 
      name: "Frais de retard", 
      amount: `${CONTRACT_TERMS.latePayment.feePercent}%`, 
      condition: "Sur factures impayées après échéance" 
    },
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
                    {oneTimeFees.map((fee, index) => (
                      <tr key={index} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-foreground">{fee.name}</td>
                        <td className="p-4 text-right font-mono text-accent font-medium">{fee.amount}</td>
                        <td className="p-4 text-sm text-muted-foreground hidden sm:table-cell">{fee.note}</td>
                      </tr>
                    ))}
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

            {/* Suspension et réactivation */}
            <section>
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">
                Suspension et réactivation
              </h2>
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                    <div>
                      <ul className="space-y-2 text-sm">
                        <li>
                          <strong>Suspension :</strong> Les services peuvent être suspendus après{" "}
                          <strong>{CONTRACT_TERMS.latePayment.suspensionDays} jours</strong> de non-paiement.
                        </li>
                        <li>
                          <strong>Réactivation :</strong> Frais de{" "}
                          <strong>{CONTRACT_TERMS.fees.reactivation}$</strong> + paiement du solde dû.
                        </li>
                        <li>
                          <strong>Frais de retard :</strong>{" "}
                          <strong>{CONTRACT_TERMS.latePayment.feePercent}%</strong> sur le solde impayé.
                        </li>
                      </ul>
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
