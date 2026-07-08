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
import { PhotoBg } from "@/components/PhotoBg";

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
    title: "3 factures mensuelles consécutives payées",
    desc: "Le compte parrainé doit rester actif et régler 3 factures mensuelles consécutives entièrement payées. Vous suivez la progression en temps réel dans votre portail.",
  },
  {
    icon: CreditCard,
    num: "4",
    title: "Recevez 25 $ + 300 points",
    desc: "Après validation, vous recevez 25 $ (versement Interac e-Transfer recommandé, ou carte prépayée Visa/Mastercard au choix) ainsi que 300 points de fidélité. Versement effectué dans un délai de 7 à 14 jours.",
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
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg url="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1920&q=80" opacity={0.10} filter="saturate(0.5) brightness(0.6)" />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <SEOHead
        title="Programme de parrainage | Nivra Telecom — 25$ pour vous, 50$ pour votre proche"
        description="Parrainez vos proches chez Nivra Telecom : 25$ pour vous après 2 mois, 5$/mois pendant 10 mois (50$) pour votre proche. Sans limite, transparent et simple."
      />
      <Header />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden" style={{ paddingTop: 120, paddingBottom: 80 }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 550, height: 550, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
          <div className="container mx-auto px-4 max-w-5xl text-center" style={{ position: 'relative', zIndex: 2 }}>
            <div className="n-animate-in inline-flex items-center gap-2 mb-6" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 100, padding: '6px 16px' }}>
              <Gift style={{ width: 14, height: 14, color: '#7C3AED' }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#A78BFA', letterSpacing: '0.08em' }}>PROGRAMME DE PARRAINAGE</span>
            </div>
            <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5.5vw, 60px)', letterSpacing: '-2.5px', lineHeight: 1.05, marginBottom: 20, color: '#fff' }}>
              Vous recevez{' '}<span className="n-shimmer-text">25$</span>,<br />
              votre proche économise{' '}<span style={{ color: '#06B6D4' }}>50$</span>
            </h1>
            <p className="n-animate-in-delay-2" style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
              Partagez votre code de parrainage. Après 2 mois de service payé, vous recevez 25$. Votre filleul économise 5$ par mois pendant 10 mois (50$ au total). Sans limite de parrainages.
            </p>
            <div className="n-animate-in-delay-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/portal/referrals"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', color: '#fff', borderRadius: 12, padding: '12px 28px', fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", textDecoration: 'none', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}
              >
                <Gift style={{ width: 18, height: 18 }} />
                Voir mon code de parrainage
              </Link>
              <Link
                to="/commander"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)', color: '#A78BFA', borderRadius: 12, padding: '12px 28px', fontSize: 15, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", textDecoration: 'none' }}
              >
                Commander avec un code
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-20" style={{ background: '#020209' }}>
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px' }}>Comment ça fonctionne</h2>
              <p className="text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>Un processus simple et transparent en 4 étapes</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-5 p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
                  <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                    {step.num}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <step.icon className="w-5 h-5" style={{ color: '#A78BFA' }} />
                      <h3 className="font-semibold text-white">{step.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="py-16" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { Icon: ShieldCheck, title: "Système sécurisé", desc: "Suivi automatique, anti-fraude intégré, traçabilité complète de chaque parrainage." },
                { Icon: CheckCircle, title: "Transparent", desc: "Suivez la progression de vos parrainages en temps réel depuis votre portail client." },
                { Icon: CreditCard, title: "Récompense au choix", desc: "PayPal, carte-cadeau Visa/Mastercard prépayée ou Interac : 25$ versés à votre convenance." },
              ].map(({ Icon, title, desc }, i) => (
                <div key={i}>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124,58,237,0.12)' }}>
                    <Icon className="w-7 h-7" style={{ color: '#A78BFA' }} />
                  </div>
                  <h3 className="font-semibold text-white mb-1">{title}</h3>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20" style={{ background: '#020209' }}>
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px' }}>Questions fréquentes</h2>
            </div>
            <div className="space-y-4">
              {faq.map((item, i) => (
                <div key={i} className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex gap-3">
                    <HelpCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#A78BFA' }} />
                    <div>
                      <h3 className="font-semibold text-white mb-1">{item.q}</h3>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16" style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #7C3AED 100%)' }}>
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px' }}>Prêt à parrainer ?</h2>
            <p className="mb-8" style={{ color: 'rgba(255,255,255,0.8)' }}>Connectez-vous à votre compte pour accéder à votre code et commencer à gagner des récompenses.</p>
            <Button
              className="rounded-full px-8 h-12 font-semibold gap-2 text-base text-violet-700 hover:opacity-90"
              style={{ background: '#FFFFFF' }}
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
