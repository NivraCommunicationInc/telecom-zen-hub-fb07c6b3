/**
 * Parrainage — Public landing page for the Nivra referral program
 * Full explanation, FAQ, trust signals.
 * Uses semantic design-system tokens (bg-background, text-foreground, bg-primary, …).
 */
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Gift, Users, CreditCard, CheckCircle, ArrowRight, ShieldCheck, Clock, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: Users,
    num: "1",
    title: "Partagez votre code",
    desc: "Connectez-vous à votre compte Nivra et trouvez votre code de parrainage unique dans la section Parrainage. Partagez-le par texto, courriel ou réseaux sociaux.",
  },
  {
    icon: Gift,
    num: "2",
    title: "Votre proche s'abonne",
    desc: "Le nouveau client entre votre code lors de sa commande Nivra. Il obtient automatiquement un rabais de 5$/mois pendant 10 mois (50$ d'économies au total).",
  },
  {
    icon: Clock,
    num: "3",
    title: "2 cycles mensuels payés",
    desc: "Le nouveau client doit maintenir son service actif et payer 2 cycles de facturation mensuels consécutifs. Vous suivez la progression en temps réel dans votre portail.",
  },
  {
    icon: CreditCard,
    num: "4",
    title: "Recevez votre 25$",
    desc: "Une fois les 2 cycles payés, votre récompense de 25$ est mise en file d'attente. Choisissez votre mode de versement : PayPal, carte-cadeau Visa/Mastercard prépayée ou Interac.",
  },
];

const faq = [
  {
    q: "Combien de personnes puis-je parrainer ?",
    a: "Il n'y a aucune limite. Chaque parrainage qualifié vous rapporte 25$. Plus vous parrainez, plus vous gagnez.",
  },
  {
    q: "Quand est-ce que je reçois ma récompense ?",
    a: "La récompense est émise après que la personne parrainée ait payé 2 cycles de facturation mensuels. Vous pouvez suivre la progression dans votre portail.",
  },
  {
    q: "Quel rabais reçoit la personne que je parraine ?",
    a: "Votre filleul reçoit automatiquement un rabais de 5$/mois pendant 10 mois, soit 50$ d'économies au total sur son forfait Nivra.",
  },
  {
    q: "Sous quelle forme est ma récompense ?",
    a: "Vous choisissez : versement PayPal, carte-cadeau Visa/Mastercard prépayée, ou virement Interac. Le choix se fait dans votre portail dès qu'un parrainage est qualifié.",
  },
  {
    q: "Puis-je me parrainer moi-même ?",
    a: "Non. L'auto-parrainage est interdit et détecté automatiquement par notre système anti-fraude.",
  },
  {
    q: "Que se passe-t-il si le client annule avant 2 mois ?",
    a: "Le parrainage est annulé et la récompense n'est pas émise. Le statut est visible dans votre portail en temps réel.",
  },
  {
    q: "Mon code est-il permanent ?",
    a: "Oui. Votre code de parrainage est lié à votre compte Nivra et ne change jamais.",
  },
];

const Parrainage = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Programme de parrainage | Nivra Telecom — 25$ pour vous, 50$ pour votre proche"
        description="Parrainez vos proches chez Nivra Telecom : 25$ pour vous après 2 mois, 5$/mois pendant 10 mois (50$) pour votre proche. Sans limite, transparent et simple."
      />
      <Header />

      <main>
        {/* Hero */}
        <section className="relative bg-primary py-20 overflow-hidden">
          <div className="container mx-auto px-4 max-w-5xl relative text-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground text-sm font-medium mb-6 border border-primary-foreground/15">
              <Gift className="w-4 h-4" />
              Programme de parrainage Nivra
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-5">
              Vous recevez <span className="underline decoration-primary-foreground/40">25$</span>,<br />
              votre proche économise <span className="underline decoration-primary-foreground/40">50$</span>
            </h1>
            <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              Partagez votre code de parrainage. Après 2 mois de service payé, vous recevez 25$. Votre filleul économise 5$ par mois pendant 10 mois (50$ au total). Sans limite de parrainages.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                className="bg-background text-foreground hover:bg-background/90 rounded-full px-8 h-12 font-semibold gap-2 text-base"
                asChild
              >
                <Link to="/portal/referrals">
                  <Gift className="w-5 h-5" />
                  Voir mon code de parrainage
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground rounded-full px-8 h-12 font-semibold gap-2 text-base"
                asChild
              >
                <Link to="/commander">
                  Commander avec un code
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-foreground mb-3">Comment ça fonctionne</h2>
              <p className="text-muted-foreground text-lg">Un processus simple et transparent en 4 étapes</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-5 p-6 bg-card text-card-foreground rounded-2xl border border-border">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                    {step.num}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <step.icon className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">{step.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="py-16 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { Icon: ShieldCheck, title: "Système sécurisé", desc: "Suivi automatique, anti-fraude intégré, traçabilité complète de chaque parrainage." },
                { Icon: CheckCircle, title: "Transparent", desc: "Suivez la progression de vos parrainages en temps réel depuis votre portail client." },
                { Icon: CreditCard, title: "Récompense au choix", desc: "PayPal, carte-cadeau Visa/Mastercard prépayée ou Interac : 25$ versés à votre convenance." },
              ].map(({ Icon, title, desc }, i) => (
                <div key={i}>
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-3">Questions fréquentes</h2>
            </div>
            <div className="space-y-4">
              {faq.map((item, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-card text-card-foreground">
                  <div className="flex gap-3">
                    <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{item.q}</h3>
                      <p className="text-sm text-muted-foreground">{item.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-primary">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-primary-foreground mb-4">Prêt à parrainer ?</h2>
            <p className="text-primary-foreground/80 mb-8">Connectez-vous à votre compte pour accéder à votre code et commencer à gagner des récompenses.</p>
            <Button
              className="bg-background text-foreground hover:bg-background/90 rounded-full px-8 h-12 font-semibold gap-2 text-base"
              asChild
            >
              <Link to="/portal/referrals">
                <Gift className="w-5 h-5" />
                Accéder à mon programme de parrainage
              </Link>
            </Button>
          </div>
        </section>

        {/* Terms */}
        <section className="py-10 bg-card border-t border-border">
          <div className="container mx-auto px-4 max-w-3xl">
            <h3 className="text-sm font-semibold text-foreground mb-3">Conditions du programme</h3>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>La récompense référent est de 25$ (PayPal, carte-cadeau Visa/Mastercard prépayée ou Interac, au choix)</li>
              <li>Le rabais filleul est de 5$/mois pendant 10 mois (50$ d'économies au total)</li>
              <li>Le client référé doit compléter 2 cycles de facturation mensuels payés pour que le référent soit qualifié</li>
              <li>L'auto-parrainage est interdit et détecté automatiquement (même adresse, même courriel ou même mode de paiement)</li>
              <li>Un seul code de parrainage par nouveau client</li>
              <li>Nivra se réserve le droit de disqualifier les parrainages frauduleux</li>
              <li>Programme sujet à modification sans préavis</li>
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Parrainage;
