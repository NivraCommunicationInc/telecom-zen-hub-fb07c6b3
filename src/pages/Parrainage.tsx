/**
 * Parrainage — Public landing page for the Nivra referral program
 * Full explanation, FAQ, trust signals
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
    desc: "Le nouveau client entre votre code lors de sa commande Nivra. Le parrainage est automatiquement lié à votre compte dès la commande complétée.",
  },
  {
    icon: Clock,
    num: "3",
    title: "3 cycles mensuels payés",
    desc: "Le nouveau client doit maintenir son service actif et payer 3 cycles de facturation mensuels consécutifs. Vous pouvez suivre la progression en temps réel dans votre portail.",
  },
  {
    icon: CreditCard,
    num: "4",
    title: "Recevez votre carte-cadeau",
    desc: "Une fois les 3 cycles payés, votre récompense est automatiquement mise en file d'attente. Vous recevez une carte-cadeau Visa/Mastercard prépayée de 25$.",
  },
];

const faq = [
  {
    q: "Combien de personnes puis-je parrainer ?",
    a: "Il n'y a aucune limite. Chaque parrainage qualifié vous rapporte 25$. Plus vous parrainez, plus vous gagnez.",
  },
  {
    q: "Quand est-ce que je reçois ma récompense ?",
    a: "La récompense est émise après que la personne parrainée ait payé 3 cycles de facturation mensuels. Vous pouvez suivre la progression dans votre portail.",
  },
  {
    q: "Sous quelle forme est la récompense ?",
    a: "Carte-cadeau Visa/Mastercard prépayée de 25$, utilisable partout où Visa/Mastercard est accepté.",
  },
  {
    q: "Puis-je me parrainer moi-même ?",
    a: "Non. L'auto-parrainage est interdit et détecté automatiquement par notre système anti-fraude.",
  },
  {
    q: "Que se passe-t-il si le client annule avant 3 mois ?",
    a: "Le parrainage est annulé et la récompense n'est pas émise. Le statut est visible dans votre portail en temps réel.",
  },
  {
    q: "Mon code est-il permanent ?",
    a: "Oui. Votre code de parrainage est lié à votre compte Nivra et ne change jamais.",
  },
];

const Parrainage = () => {
  return (
    <div className="min-h-screen public-dark" style={{ background: 'hsl(230 60% 4%)' }}>
      <SEOHead
        title="Programme de parrainage | Nivra Telecom — Gagnez 25$ par parrainage"
        description="Parrainez vos proches chez Nivra Telecom et recevez une carte-cadeau Visa/Mastercard de 25$ pour chaque parrainage qualifié. Sans limite, transparent et simple."
      />
      <Header />

      <main>
        {/* Hero */}
        <section className="relative bg-[#003366] py-20 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/10 to-transparent" />
            <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-white/5 to-transparent" />
          </div>
          <div className="container mx-auto px-4 max-w-5xl relative text-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-emerald-300 text-sm font-medium mb-6 border border-white/10">
              <Gift className="w-4 h-4" />
              Programme de parrainage Nivra
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-5">
              Parrainez un proche,<br />recevez <span className="text-emerald-400">25$</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl mx-auto mb-8 leading-relaxed">
              Partagez votre code de parrainage avec vos proches. Après 3 mois de service payé, vous recevez une carte-cadeau Visa/Mastercard prépayée de 25$. Sans limite de parrainages.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                className="bg-white text-[#003366] hover:bg-slate-100 rounded-full px-8 h-12 font-semibold gap-2 text-base"
                asChild
              >
                <Link to="/portal/referrals">
                  <Gift className="w-5 h-5" />
                  Voir mon code de parrainage
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 h-12 font-semibold gap-2 text-base"
                asChild
              >
                <Link to="/portal/auth">
                  Créer mon compte
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Comment ça fonctionne</h2>
              <p className="text-slate-600 text-lg">Un processus simple et transparent en 4 étapes</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-5 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-[#003366] text-white flex items-center justify-center text-lg font-bold">
                    {step.num}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <step.icon className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-semibold text-slate-900">{step.title}</h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="py-16 bg-slate-50 border-y border-slate-200">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Système sécurisé</h3>
                <p className="text-sm text-slate-600">Suivi automatique, anti-fraude intégré, traçabilité complète de chaque parrainage.</p>
              </div>
              <div>
                <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Transparent</h3>
                <p className="text-sm text-slate-600">Suivez la progression de vos parrainages en temps réel depuis votre portail client.</p>
              </div>
              <div>
                <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Récompense réelle</h3>
                <p className="text-sm text-slate-600">Carte-cadeau Visa/Mastercard prépayée de 25$, utilisable partout, sans restriction.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Questions fréquentes</h2>
            </div>
            <div className="space-y-4">
              {faq.map((item, i) => (
                <div key={i} className="p-5 rounded-xl border border-slate-200 bg-white">
                  <div className="flex gap-3">
                    <HelpCircle className="w-5 h-5 text-[#003366] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">{item.q}</h3>
                      <p className="text-sm text-slate-600">{item.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-[#003366]">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Prêt à parrainer ?</h2>
            <p className="text-white/70 mb-8">Connectez-vous à votre compte pour accéder à votre code et commencer à gagner des récompenses.</p>
            <Button
              className="bg-white text-[#003366] hover:bg-slate-100 rounded-full px-8 h-12 font-semibold gap-2 text-base"
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
        <section className="py-10 bg-slate-50 border-t border-slate-200">
          <div className="container mx-auto px-4 max-w-3xl">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Conditions du programme</h3>
            <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li>La récompense de 25$ est sous forme de carte-cadeau Visa/Mastercard prépayée</li>
              <li>Le client référé doit compléter 3 cycles de facturation mensuelle payés</li>
              <li>L'auto-parrainage est interdit et détecté automatiquement</li>
              <li>Un seul parrainage par nouveau client</li>
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
