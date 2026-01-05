import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { COMPANY_CONTACT } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

const EquipementGarantie = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
            Équipement & garantie
          </h1>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-lg">
              Dernière mise à jour : {CONTRACT_TERMS.lastUpdated}
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Équipement Nivra</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-card/50 border-border">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-foreground mb-2">Nivra Born WiFi Router</h3>
                    <p className="text-sm">Routeur haute performance pour Internet résidentiel</p>
                    <p className="text-lg font-bold text-foreground mt-2">{CONTRACT_TERMS.fees.router}$ (achat)</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-border">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-foreground mb-2">Nivra 4K Smart Terminal</h3>
                    <p className="text-sm">Terminal intelligent pour les forfaits TV</p>
                    <p className="text-lg font-bold text-foreground mt-2">{CONTRACT_TERMS.fees.tvTerminal}$/terminal (achat)</p>
                    <p className="text-xs text-muted-foreground">Maximum {CONTRACT_TERMS.fees.maxTerminals} terminaux par compte</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Garantie limitée (1 an)</h2>
              <p>
                Tous les équipements Nivra sont couverts par une <strong>garantie manufacturier d'un (1) an</strong> 
                à compter de la date d'activation.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Durée :</strong> {CONTRACT_TERMS.warranty.duration}</li>
                <li><strong>Couverture :</strong> {CONTRACT_TERMS.warranty.coverage}</li>
                <li><strong>Fenêtre d'échange DOA :</strong> {CONTRACT_TERMS.warranty.doaDays} jours à compter de la livraison</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Exclusions de garantie</h2>
              <p>La garantie ne couvre pas :</p>
              <ul className="list-disc pl-6 space-y-2">
                {CONTRACT_TERMS.warranty.exclusions.map((exclusion, index) => (
                  <li key={index}>{exclusion}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Procédure de remplacement</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Ouvrez un ticket de support via le portail client ou par téléphone</li>
                <li>Décrivez le problème et fournissez le numéro de série de l'équipement</li>
                <li>Notre équipe technique évaluera la demande</li>
                <li>Si approuvé, un équipement de remplacement sera envoyé</li>
                <li>L'équipement défectueux doit être retourné dans les délais indiqués</li>
              </ol>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Retour d'équipement</h2>
              <p>
                En cas d'annulation du service, l'équipement Nivra doit être retourné dans les{" "}
                <strong>{CONTRACT_TERMS.cancellation.returnDays} jours</strong> suivant l'annulation.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Les frais de retour sont à la charge du client</li>
                <li>L'équipement non retourné peut entraîner des frais supplémentaires</li>
                <li>L'équipement doit être retourné dans son état d'origine (usure normale acceptée)</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. Frais SIM (Mobile)</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Carte SIM physique :</strong> {CONTRACT_TERMS.fees.simPhysical}$</li>
                <li><strong>eSIM :</strong> {CONTRACT_TERMS.fees.esim}$</li>
              </ul>
              <p className="text-sm text-muted-foreground/70">
                Ce frais inclut l'activation de votre ligne mobile.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">Contact support équipement</h2>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li><strong>Téléphone :</strong> {COMPANY_CONTACT.supportPhoneDisplay}</li>
                <li><strong>Portail client :</strong> Section « Remplacement équipement »</li>
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

export default EquipementGarantie;
